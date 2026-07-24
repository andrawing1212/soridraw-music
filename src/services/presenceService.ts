import {
  onDisconnect,
  onValue,
  ref,
  remove,
  serverTimestamp,
  set,
  type Unsubscribe,
} from 'firebase/database';
import { realtimeDb } from '../firebase';

export type ClientPresenceState = 'active' | 'away' | 'background';
export type PresenceDiagnosticStatus = 'connecting' | 'connected' | 'error' | 'stopped';

export type PresenceDiagnostic = {
  uid: string;
  status: PresenceDiagnosticStatus;
  message: string;
  updatedAt: number;
};

export const PRESENCE_DIAGNOSTIC_EVENT = 'soridraw:presence-diagnostic';

export type PresenceController = {
  stop: () => Promise<void>;
  markActivity: () => void;
};

type PresenceOptions = {
  onIdleTimeout?: () => void | Promise<void>;
  authLastSignInAt?: number;
};

const AWAY_AFTER_MS = 10 * 60 * 1000;
const LOGOUT_AFTER_MS = 60 * 60 * 1000;
const ACTIVITY_SYNC_MIN_MS = 5 * 60 * 1000;
const HEARTBEAT_MS = 10 * 60 * 1000;
const ACTIVITY_LOCAL_THROTTLE_MS = 15 * 1000;
const IDLE_LOGOUT_LOCK_MS = 2 * 60 * 1000;
const CONNECTION_SETUP_RETRY_MS = 5 * 1000;
const PRESENCE_DIAGNOSTIC_KEY_PREFIX = 'soridraw_presence_diagnostic_';

const buildSessionId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const getDeviceLabel = () => {
  if (typeof navigator === 'undefined') return 'web';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
};


const safeStorageGet = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeStorageSet = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Presence keeps working in-memory when browser storage is unavailable.
  }
};

const safeStorageRemove = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore browser storage restrictions.
  }
};

const emitPresenceDiagnostic = (diagnostic: PresenceDiagnostic) => {
  safeStorageSet(`${PRESENCE_DIAGNOSTIC_KEY_PREFIX}${diagnostic.uid}`, JSON.stringify(diagnostic));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PRESENCE_DIAGNOSTIC_EVENT, { detail: diagnostic }));
  }
};

export const readPresenceDiagnostic = (uid: string): PresenceDiagnostic | null => {
  if (!uid || typeof window === 'undefined') return null;
  try {
    const raw = safeStorageGet(`${PRESENCE_DIAGNOSTIC_KEY_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.uid !== uid) return null;
    if (!['connecting', 'connected', 'error', 'stopped'].includes(parsed.status)) return null;
    return {
      uid,
      status: parsed.status,
      message: String(parsed.message || ''),
      updatedAt: safeNumber(parsed.updatedAt) || Date.now(),
    };
  } catch {
    return null;
  }
};

const safeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const startUserPresence = (uid: string, options: PresenceOptions = {}): PresenceController => {
  if (!uid || typeof window === 'undefined' || typeof document === 'undefined') {
    return { stop: async () => undefined, markActivity: () => undefined };
  }

  const sessionId = buildSessionId();
  const device = getDeviceLabel();
  const activityKey = `soridraw_presence_last_activity_${uid}`;
  const logoutLockKey = `soridraw_presence_idle_logout_lock_${uid}`;
  const sessionRef = ref(realtimeDb, `presence/${uid}/connections/${sessionId}`);
  const lastSeenRef = ref(realtimeDb, `presence/${uid}/lastSeenAt`);
  const connectedRef = ref(realtimeDb, '.info/connected');

  let stopped = false;
  let connected = false;
  let currentState: ClientPresenceState | null = null;
  let lastServerWriteAt = 0;
  let lastSyncedActivityAt = 0;
  let lastLocalActivityWriteAt = 0;
  let idleLogoutTriggered = false;
  let connectedUnsubscribe: Unsubscribe | null = null;
  let checkTimer: number | null = null;
  let connectionSetupRetryTimer: number | null = null;

  const storedActivityAt = safeNumber(safeStorageGet(activityKey));
  const authLastSignInAt = safeNumber(options.authLastSignInAt);
  const isFreshAuthentication = authLastSignInAt > 0 && Date.now() - authLastSignInAt < 2 * 60 * 1000;
  let lastActivityAt = isFreshAuthentication
    ? Date.now()
    : storedActivityAt || Date.now();
  safeStorageSet(activityKey, String(lastActivityAt));
  emitPresenceDiagnostic({ uid, status: 'connecting', message: 'Realtime Database 연결을 준비하고 있습니다.', updatedAt: Date.now() });

  const getDesiredState = (now = Date.now()): ClientPresenceState => {
    if (document.visibilityState !== 'visible') return 'background';
    if (now - lastActivityAt >= AWAY_AFTER_MS) return 'away';
    return 'active';
  };

  const writeSession = async (force = false) => {
    if (stopped || !connected) return;
    const now = Date.now();
    const nextState = getDesiredState(now);
    const stateChanged = currentState !== nextState;
    const activityNeedsSync = lastActivityAt > lastSyncedActivityAt && now - lastServerWriteAt >= ACTIVITY_SYNC_MIN_MS;
    const heartbeatDue = now - lastServerWriteAt >= HEARTBEAT_MS;
    if (!force && !stateChanged && !activityNeedsSync && !heartbeatDue) return;

    await set(sessionRef, {
      sessionId,
      state: nextState,
      device,
      visible: document.visibilityState === 'visible',
      lastActivityAt,
      updatedAt: serverTimestamp(),
    });
    currentState = nextState;
    lastServerWriteAt = now;
    lastSyncedActivityAt = lastActivityAt;
    emitPresenceDiagnostic({ uid, status: 'connected', message: '접속 상태가 정상 기록되고 있습니다.', updatedAt: Date.now() });
  };

  const acquireIdleLogoutLock = () => {
    const now = Date.now();
    const existing = safeNumber(safeStorageGet(logoutLockKey));
    if (existing && now - existing < IDLE_LOGOUT_LOCK_MS) return false;
    safeStorageSet(logoutLockKey, String(now));
    return true;
  };

  const checkState = () => {
    if (stopped) return;
    const now = Date.now();
    const sharedActivityAt = safeNumber(safeStorageGet(activityKey));
    if (sharedActivityAt > lastActivityAt) lastActivityAt = sharedActivityAt;

    if (now - lastActivityAt >= LOGOUT_AFTER_MS) {
      if (!idleLogoutTriggered && acquireIdleLogoutLock()) {
        idleLogoutTriggered = true;
        void Promise.resolve(options.onIdleTimeout?.()).catch((error) => {
          console.warn('[Presence] idle logout failed:', error);
          idleLogoutTriggered = false;
        });
      }
      return;
    }

    void writeSession(false).catch((error) => console.warn('[Presence] state sync failed:', error));
  };

  const markActivity = () => {
    if (stopped) return;
    const now = Date.now();
    lastActivityAt = now;
    idleLogoutTriggered = false;
    safeStorageRemove(logoutLockKey);
    if (now - lastLocalActivityWriteAt >= ACTIVITY_LOCAL_THROTTLE_MS) {
      lastLocalActivityWriteAt = now;
      safeStorageSet(activityKey, String(now));
    }
    if (currentState !== 'active' && document.visibilityState === 'visible') {
      void writeSession(true).catch((error) => console.warn('[Presence] activity sync failed:', error));
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') markActivity();
    void writeSession(true).catch((error) => console.warn('[Presence] visibility sync failed:', error));
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== activityKey) return;
    const next = safeNumber(event.newValue);
    if (next > lastActivityAt) {
      lastActivityAt = next;
      idleLogoutTriggered = false;
      void writeSession(false).catch((error) => console.warn('[Presence] cross-tab sync failed:', error));
    }
  };

  // Only deliberate interaction counts as activity. Mouse hover/pointer movement and
  // programmatic scroll events previously refreshed idle time even when the user did nothing.
  const passiveEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
  passiveEvents.forEach((eventName) => window.addEventListener(eventName, markActivity, { passive: true }));
  window.addEventListener('storage', handleStorage);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  const clearConnectionSetupRetry = () => {
    if (connectionSetupRetryTimer !== null) {
      window.clearTimeout(connectionSetupRetryTimer);
      connectionSetupRetryTimer = null;
    }
  };

  const scheduleConnectionSetupRetry = () => {
    if (stopped || !connected || connectionSetupRetryTimer !== null) return;
    connectionSetupRetryTimer = window.setTimeout(() => {
      connectionSetupRetryTimer = null;
      void setupConnection();
    }, CONNECTION_SETUP_RETRY_MS);
  };

  const setupConnection = async () => {
    if (stopped || !connected) return;
    clearConnectionSetupRetry();
    try {
      // Register stale-session cleanup before announcing this tab as online.
      await onDisconnect(sessionRef).remove();
      await writeSession(true);
      // lastSeen registration is useful, but must not block the live session record.
      try {
        await onDisconnect(lastSeenRef).set(serverTimestamp());
      } catch (lastSeenError) {
        console.warn('[Presence] lastSeen onDisconnect setup failed:', lastSeenError);
      }
    } catch (error: any) {
      currentState = null;
      console.warn('[Presence] connection setup failed:', error);
      emitPresenceDiagnostic({
        uid,
        status: 'error',
        message: error?.message || '접속 상태 기록에 실패했습니다. 자동으로 다시 연결합니다.',
        updatedAt: Date.now(),
      });
      scheduleConnectionSetupRetry();
    }
  };

  connectedUnsubscribe = onValue(connectedRef, (snapshot) => {
    connected = snapshot.val() === true;
    if (!connected || stopped) {
      clearConnectionSetupRetry();
      if (!stopped) {
        emitPresenceDiagnostic({ uid, status: 'connecting', message: '네트워크 연결을 기다리고 있습니다.', updatedAt: Date.now() });
      }
      return;
    }
    void setupConnection();
  });

  checkTimer = window.setInterval(checkState, 30_000);
  checkState();

  const stop = async () => {
    if (stopped) return;
    stopped = true;
    connectedUnsubscribe?.();
    connectedUnsubscribe = null;
    if (checkTimer !== null) window.clearInterval(checkTimer);
    clearConnectionSetupRetry();
    passiveEvents.forEach((eventName) => window.removeEventListener(eventName, markActivity));
    window.removeEventListener('storage', handleStorage);
    document.removeEventListener('visibilitychange', handleVisibilityChange);

    try {
      await onDisconnect(sessionRef).cancel();
      await onDisconnect(lastSeenRef).cancel();
      await remove(sessionRef);
      await set(lastSeenRef, serverTimestamp());
    } catch (error) {
      console.warn('[Presence] cleanup deferred to onDisconnect:', error);
    }
    emitPresenceDiagnostic({ uid, status: 'stopped', message: '접속 상태 기록이 종료되었습니다.', updatedAt: Date.now() });
  };

  return { stop, markActivity };
};

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
  let pointerMoveTimer: number | null = null;

  const storedActivityAt = safeNumber(safeStorageGet(activityKey));
  const authLastSignInAt = safeNumber(options.authLastSignInAt);
  const isFreshAuthentication = authLastSignInAt > 0 && Date.now() - authLastSignInAt < 2 * 60 * 1000;
  let lastActivityAt = isFreshAuthentication
    ? Date.now()
    : storedActivityAt || Date.now();
  safeStorageSet(activityKey, String(lastActivityAt));

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

    currentState = nextState;
    lastServerWriteAt = now;
    lastSyncedActivityAt = lastActivityAt;
    await set(sessionRef, {
      sessionId,
      state: nextState,
      device,
      visible: document.visibilityState === 'visible',
      lastActivityAt,
      updatedAt: serverTimestamp(),
    });
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

  const handlePointerMove = () => {
    if (pointerMoveTimer !== null) return;
    pointerMoveTimer = window.setTimeout(() => {
      pointerMoveTimer = null;
      markActivity();
    }, 1000);
  };

  const passiveEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'];
  passiveEvents.forEach((eventName) => window.addEventListener(eventName, markActivity, { passive: true }));
  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  window.addEventListener('storage', handleStorage);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  connectedUnsubscribe = onValue(connectedRef, async (snapshot) => {
    connected = snapshot.val() === true;
    if (!connected || stopped) return;
    try {
      await onDisconnect(sessionRef).remove();
      await onDisconnect(lastSeenRef).set(serverTimestamp());
      await writeSession(true);
    } catch (error) {
      console.warn('[Presence] connection setup failed:', error);
    }
  });

  checkTimer = window.setInterval(checkState, 30_000);
  checkState();

  const stop = async () => {
    if (stopped) return;
    stopped = true;
    connectedUnsubscribe?.();
    connectedUnsubscribe = null;
    if (checkTimer !== null) window.clearInterval(checkTimer);
    if (pointerMoveTimer !== null) window.clearTimeout(pointerMoveTimer);
    passiveEvents.forEach((eventName) => window.removeEventListener(eventName, markActivity));
    window.removeEventListener('pointermove', handlePointerMove);
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
  };

  return { stop, markActivity };
};

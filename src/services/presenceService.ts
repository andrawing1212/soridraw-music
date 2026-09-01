import {
  goOffline,
  goOnline,
  onDisconnect,
  onValue,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
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


const PRESENCE_DEVICE_ID_KEY = 'soridraw_presence_device_id_v1';

type PresenceDeviceInfo = {
  label: string;
  platform: string;
  browser: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
};

const getOrCreateDeviceId = () => {
  const stored = safeStorageGet(PRESENCE_DEVICE_ID_KEY);
  if (stored) return stored;
  const next = buildSessionId();
  safeStorageSet(PRESENCE_DEVICE_ID_KEY, next);
  return next;
};

const getDeviceInfo = (): PresenceDeviceInfo => {
  if (typeof navigator === 'undefined') {
    return { label: '웹 브라우저', platform: 'Web', browser: 'Browser', deviceType: 'desktop' };
  }

  const userAgent = navigator.userAgent || '';
  const platformHint = String((navigator as any).userAgentData?.platform || navigator.platform || '');
  const isIPad = /iPad/i.test(userAgent) || (platformHint === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isIPhone = /iPhone|iPod/i.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  const isMobile = /Mobile/i.test(userAgent) || isIPhone;

  let platform = '기타 OS';
  if (/Windows/i.test(userAgent) || /Win/i.test(platformHint)) platform = 'Windows';
  else if (isIPad) platform = 'iPad';
  else if (isIPhone) platform = 'iPhone';
  else if (isAndroid) platform = 'Android';
  else if (/CrOS/i.test(userAgent)) platform = 'ChromeOS';
  else if (/Macintosh|Mac OS X/i.test(userAgent) || /Mac/i.test(platformHint)) platform = 'macOS';
  else if (/Linux/i.test(userAgent) || /Linux/i.test(platformHint)) platform = 'Linux';

  let browser = '브라우저';
  if (/SamsungBrowser/i.test(userAgent)) browser = 'Samsung Internet';
  else if (/EdgA|EdgiOS|Edg\//i.test(userAgent)) browser = 'Edge';
  else if (/OPR\//i.test(userAgent)) browser = 'Opera';
  else if (/FxiOS|Firefox\//i.test(userAgent)) browser = 'Firefox';
  else if (/CriOS|Chrome\//i.test(userAgent)) browser = 'Chrome';
  else if (/Safari\//i.test(userAgent)) browser = 'Safari';

  const deviceType: PresenceDeviceInfo['deviceType'] = isIPad || (isAndroid && !isMobile)
    ? 'tablet'
    : isMobile || isAndroid
      ? 'mobile'
      : 'desktop';

  return {
    label: `${platform} · ${browser}`,
    platform,
    browser,
    deviceType,
  };
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

// SORIDRAW_1001_PRESENCE_PERMISSION_STORM_GUARD
// Realtime Database rules are configuration, not a transient network condition.
// A permission-denied response must not create a 5-second retry loop that keeps
// allocating promises/log entries and sending writes for as long as the app is open.
const isPermissionDeniedError = (error: unknown) => {
  const code = String((error as any)?.code || '').toUpperCase();
  const message = String((error as any)?.message || error || '').toUpperCase();
  return code.includes('PERMISSION_DENIED')
    || message.includes('PERMISSION_DENIED')
    || message.includes('PERMISSION DENIED');
};

export const startUserPresence = (uid: string, options: PresenceOptions = {}): PresenceController => {
  if (!uid || typeof window === 'undefined' || typeof document === 'undefined') {
    return { stop: async () => undefined, markActivity: () => undefined };
  }

  // A previous sign-out may have intentionally closed the RTDB socket so its
  // onDisconnect cleanup can run. Reopen it before creating the next session.
  goOnline(realtimeDb);

  const sessionId = buildSessionId();
  const deviceId = getOrCreateDeviceId();
  const deviceInfo = getDeviceInfo();
  const activityKey = `soridraw_presence_last_activity_${uid}`;
  const logoutLockKey = `soridraw_presence_idle_logout_lock_${uid}`;
  const sessionRef = ref(realtimeDb, `presence/${uid}/connections/${sessionId}`);
  const deviceRef = ref(realtimeDb, `presence/${uid}/devices/${deviceId}`);
  const deviceLastSeenRef = ref(realtimeDb, `presence/${uid}/devices/${deviceId}/lastSeenAt`);
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
  let presencePermissionDenied = false;
  let devicePresenceDenied = false;
  let devicePermissionWarningLogged = false;
  let presencePermissionWarningLogged = false;

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
    if (stopped || !connected || presencePermissionDenied) return;
    const now = Date.now();
    const nextState = getDesiredState(now);
    const stateChanged = currentState !== nextState;
    const activityNeedsSync = lastActivityAt > lastSyncedActivityAt && now - lastServerWriteAt >= ACTIVITY_SYNC_MIN_MS;
    const heartbeatDue = now - lastServerWriteAt >= HEARTBEAT_MS;
    if (!force && !stateChanged && !activityNeedsSync && !heartbeatDue) return;

    await set(sessionRef, {
      sessionId,
      deviceId,
      device: deviceInfo.deviceType,
      deviceLabel: deviceInfo.label,
      platform: deviceInfo.platform,
      browser: deviceInfo.browser,
      state: nextState,
      visible: document.visibilityState === 'visible',
      lastActivityAt,
      updatedAt: serverTimestamp(),
    });
    if (!devicePresenceDenied) {
      try {
        await update(deviceRef, {
          deviceId,
          label: deviceInfo.label,
          platform: deviceInfo.platform,
          browser: deviceInfo.browser,
          deviceType: deviceInfo.deviceType,
          lastActivityAt,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        if (isPermissionDeniedError(error)) {
          devicePresenceDenied = true;
          if (!devicePermissionWarningLogged) {
            devicePermissionWarningLogged = true;
            console.warn('[Presence] device history permission denied; device writes are disabled for this session.');
          }
        } else {
          console.warn('[Presence] device history sync failed:', error);
        }
      }
    }
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

    const rememberLoginEnabled = safeStorageGet('rememberLogin') === 'true';

    if (!rememberLoginEnabled && now - lastActivityAt >= LOGOUT_AFTER_MS) {
      if (!idleLogoutTriggered && acquireIdleLogoutLock()) {
        idleLogoutTriggered = true;
        void Promise.resolve(options.onIdleTimeout?.()).catch((error) => {
          console.warn('[Presence] idle logout failed:', error);
          idleLogoutTriggered = false;
        });
      }
      return;
    }

    if (rememberLoginEnabled) {
      idleLogoutTriggered = false;
      safeStorageRemove(logoutLockKey);
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
    if (stopped || !connected || presencePermissionDenied || connectionSetupRetryTimer !== null) return;
    connectionSetupRetryTimer = window.setTimeout(() => {
      connectionSetupRetryTimer = null;
      void setupConnection();
    }, CONNECTION_SETUP_RETRY_MS);
  };

  const setupConnection = async () => {
    if (stopped || !connected || presencePermissionDenied) return;
    clearConnectionSetupRetry();
    try {
      // Register stale-session cleanup before announcing this tab as online.
      await onDisconnect(sessionRef).remove();
      await writeSession(true);
      // Device history is kept separately from live tab sessions so Chrome and Edge
      // on the same computer remain visible as separate browser environments.
      if (!devicePresenceDenied) {
        try {
          await onDisconnect(deviceLastSeenRef).set(serverTimestamp());
        } catch (deviceLastSeenError) {
          if (isPermissionDeniedError(deviceLastSeenError)) {
            devicePresenceDenied = true;
            if (!devicePermissionWarningLogged) {
              devicePermissionWarningLogged = true;
              console.warn('[Presence] device history permission denied; device writes are disabled for this session.');
            }
          } else {
            console.warn('[Presence] device lastSeen onDisconnect setup failed:', deviceLastSeenError);
          }
        }
      }
      // lastSeen registration is useful, but must not block the live session record.
      try {
        await onDisconnect(lastSeenRef).set(serverTimestamp());
      } catch (lastSeenError) {
        console.warn('[Presence] lastSeen onDisconnect setup failed:', lastSeenError);
      }
    } catch (error: any) {
      currentState = null;
      if (isPermissionDeniedError(error)) {
        presencePermissionDenied = true;
        clearConnectionSetupRetry();
        if (!presencePermissionWarningLogged) {
          presencePermissionWarningLogged = true;
          console.warn('[Presence] permission denied; automatic presence retries are paused until reload.');
        }
        emitPresenceDiagnostic({
          uid,
          status: 'error',
          message: '접속 상태 저장 권한이 거부되어 반복 재시도를 중지했습니다.',
          updatedAt: Date.now(),
        });
        return;
      }
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

    let explicitCleanupSucceeded = false;
    try {
      // Remove the live session while the user credential is still usable.
      // Do not cancel onDisconnect first: if Auth changes during cleanup, the
      // server-side disconnect hook must remain available as the fallback.
      await remove(sessionRef);
      if (!devicePresenceDenied) {
        try {
          await update(deviceRef, { lastSeenAt: serverTimestamp(), updatedAt: serverTimestamp() });
        } catch (deviceCleanupError) {
          if (!isPermissionDeniedError(deviceCleanupError)) {
            console.warn('[Presence] device cleanup failed:', deviceCleanupError);
          }
        }
      }
      await set(lastSeenRef, serverTimestamp());
      explicitCleanupSucceeded = true;
    } catch (error) {
      console.warn('[Presence] explicit cleanup failed; using onDisconnect fallback:', error);
    }

    if (explicitCleanupSucceeded) {
      await Promise.allSettled([
        onDisconnect(sessionRef).cancel(),
        onDisconnect(deviceLastSeenRef).cancel(),
        onDisconnect(lastSeenRef).cancel(),
      ]);
    }

    // Closing this tab's RTDB socket immediately executes any remaining
    // onDisconnect cleanup. Presence is the only RTDB feature in this app, and
    // the next login calls goOnline() before starting a new session.
    goOffline(realtimeDb);
    emitPresenceDiagnostic({ uid, status: 'stopped', message: '접속 상태 기록이 종료되었습니다.', updatedAt: Date.now() });
  };

  return { stop, markActivity };
};

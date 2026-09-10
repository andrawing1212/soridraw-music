const CURRENT_APP_VERSION = __SORIDRAW_APP_VERSION__;
const VERSION_URL = '/app-version.json';
const NOTICE_ID = 'soridraw-app-update-notice';
const MIN_CHECK_INTERVAL_MS = 30_000;
let started = false;
let lastCheckedAt = 0;
let updateAvailable = false;

const applyButtonState = (button: HTMLButtonElement, hasUpdate: boolean, status: 'ready' | 'checking' | 'error' = 'ready') => {
  updateAvailable = hasUpdate;
  button.textContent = hasUpdate
    ? '새 업데이트 · 적용'
    : status === 'checking'
      ? `업데이트 확인 중 · ${CURRENT_APP_VERSION}`
      : status === 'error'
        ? `업데이트 확인 · ${CURRENT_APP_VERSION}`
        : `업데이트 · ${CURRENT_APP_VERSION}`;
  button.setAttribute('aria-label', hasUpdate ? '새 업데이트 적용' : '업데이트 확인');
  Object.assign(button.style, hasUpdate ? {
    background: '#ffb400',
    color: '#151515',
    border: '1px solid rgba(255,180,0,.9)',
    opacity: '1',
  } : {
    background: 'rgba(20,20,20,.72)',
    color: '#ffb400',
    border: '1px solid rgba(255,180,0,.38)',
    opacity: '.82',
  });
};

const ensureUpdateNotice = () => {
  const existing = document.getElementById(NOTICE_ID) as HTMLButtonElement | null;
  if (existing) return existing;

  const button = document.createElement('button');
  button.id = NOTICE_ID;
  button.type = 'button';
  Object.assign(button.style, {
    position: 'fixed', top: 'max(12px, env(safe-area-inset-top))', right: '12px',
    zIndex: '2147483646', borderRadius: '999px', padding: '7px 10px',
    fontSize: '11px', fontWeight: '700', lineHeight: '1', cursor: 'pointer',
    boxShadow: '0 3px 12px rgba(0,0,0,.18)', backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)', transition: 'opacity .15s ease, background .15s ease, color .15s ease',
  });
  applyButtonState(button, false);
  button.addEventListener('click', () => {
    if (updateAvailable) {
      window.location.reload();
      return;
    }
    void checkForUpdate(true);
  });
  document.body.appendChild(button);
  return button;
};

const checkForUpdate = async (force = false) => {
  const now = Date.now();
  if (!force && now - lastCheckedAt < MIN_CHECK_INTERVAL_MS) return;
  lastCheckedAt = now;
  const button = ensureUpdateNotice();
  applyButtonState(button, updateAvailable, 'checking');
  try {
    const response = await fetch(`${VERSION_URL}?t=${now}`, { cache: 'no-store' });
    if (!response.ok) {
      applyButtonState(button, updateAvailable, 'error');
      return;
    }
    const payload = await response.json() as { version?: string | number };
    const remoteVersion = String(payload?.version || '').trim();
    if (!remoteVersion) {
      applyButtonState(button, updateAvailable, 'error');
      return;
    }
    applyButtonState(button, remoteVersion !== CURRENT_APP_VERSION);
  } catch {
    // Keep the small control visible even when offline; retry on focus/return or click.
    applyButtonState(button, updateAvailable, 'error');
  }
};

export const startAppUpdateNotice = () => {
  if (started || typeof window === 'undefined') return;
  started = true;
  ensureUpdateNotice();
  void checkForUpdate(true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate();
  });
  window.addEventListener('focus', () => void checkForUpdate());
};

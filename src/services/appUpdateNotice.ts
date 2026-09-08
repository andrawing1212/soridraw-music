const CURRENT_APP_VERSION = '044';
const VERSION_URL = '/app-version.json';
const NOTICE_ID = 'soridraw-app-update-notice';
const MIN_CHECK_INTERVAL_MS = 30_000;
let started = false;
let lastCheckedAt = 0;

const showUpdateNotice = () => {
  if (document.getElementById(NOTICE_ID)) return;
  const button = document.createElement('button');
  button.id = NOTICE_ID;
  button.type = 'button';
  button.textContent = '새 업데이트 · 적용';
  button.setAttribute('aria-label', '새 업데이트 적용');
  Object.assign(button.style, {
    position: 'fixed', top: 'max(12px, env(safe-area-inset-top))', right: '12px',
    zIndex: '2147483646', border: '0', borderRadius: '999px', padding: '9px 13px',
    background: '#ffb400', color: '#151515', fontSize: '12px', fontWeight: '700',
    lineHeight: '1', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,.22)'
  });
  button.addEventListener('click', () => window.location.reload());
  document.body.appendChild(button);
};

const checkForUpdate = async (force = false) => {
  const now = Date.now();
  if (!force && now - lastCheckedAt < MIN_CHECK_INTERVAL_MS) return;
  lastCheckedAt = now;
  try {
    const response = await fetch(`${VERSION_URL}?t=${now}`, { cache: 'no-store' });
    if (!response.ok) return;
    const payload = await response.json() as { version?: string | number };
    const remoteVersion = String(payload?.version || '').trim();
    if (remoteVersion && remoteVersion !== CURRENT_APP_VERSION) showUpdateNotice();
  } catch {
    // Offline/network errors stay silent and retry on the next app return.
  }
};

export const startAppUpdateNotice = () => {
  if (started || typeof window === 'undefined') return;
  started = true;
  void checkForUpdate(true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate();
  });
  window.addEventListener('focus', () => void checkForUpdate());
};

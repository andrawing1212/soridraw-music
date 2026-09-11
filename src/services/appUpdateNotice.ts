const CURRENT_APP_VERSION = __SORIDRAW_APP_VERSION__;
const VERSION_URL = '/app-version.json';
const NOTICE_ID = 'soridraw-app-update-notice';
const COMPLETED_NOTICE_ID = 'soridraw-app-update-completed-notice';
const LAST_STARTED_VERSION_KEY = 'soridraw.app-update.last-started-version.v1';
const COMPLETED_NOTICE_VERSION_KEY = 'soridraw.app-update.completed-notice-version.v1';
const MIN_CHECK_INTERVAL_MS = 30_000;
const ACTIVE_CHECK_INTERVAL_MS = 60_000;
const COMPLETED_NOTICE_DURATION_MS = 8_000;
const PREVIEW_UPDATE_HOSTS = new Set([
  'preview.soridraw.com',
  'soridraw-preview.web.app',
  'soridraw-preview.firebaseapp.com',
  'localhost',
  '127.0.0.1',
]);
let started = false;
let lastCheckedAt = 0;
let activeCheckTimer: number | null = null;
let completedNoticeTimer: number | null = null;
const attachRetryTimers = new Map<string, number>();

const isPreviewUpdateHost = () => {
  if (typeof window === 'undefined') return false;
  return PREVIEW_UPDATE_HOSTS.has(window.location.hostname.toLowerCase());
};

const clearAttachRetry = (noticeId: string) => {
  const timer = attachRetryTimers.get(noticeId);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    attachRetryTimers.delete(noticeId);
  }
};

const removeNotice = (noticeId: string) => {
  clearAttachRetry(noticeId);
  document.getElementById(noticeId)?.remove();
};

const removeUpdateNotice = () => removeNotice(NOTICE_ID);

const removeCompletedNotice = () => {
  if (completedNoticeTimer !== null) {
    window.clearTimeout(completedNoticeTimer);
    completedNoticeTimer = null;
  }
  removeNotice(COMPLETED_NOTICE_ID);
};

const findStatusRowAnchor = (): HTMLElement | null => {
  const accountButton = document.querySelector<HTMLElement>('button[aria-label="계정 메뉴"]');
  if (accountButton) {
    const rect = accountButton.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return accountButton;
  }

  const desktopRow = Array.from(document.querySelectorAll<HTMLElement>('div')).find((element) => {
    const classes = element.classList;
    if (
      !classes.contains('flex') ||
      !classes.contains('min-w-[176px]') ||
      !classes.contains('shrink-0') ||
      !classes.contains('items-center') ||
      !classes.contains('justify-end')
    ) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  return desktopRow || null;
};

const positionNoticeInStatusRow = (button: HTMLButtonElement): boolean => {
  const anchor = findStatusRowAnchor();
  if (!anchor) return false;

  const anchorRect = anchor.getBoundingClientRect();
  const buttonHeight = button.offsetHeight || 28;
  const top = Math.max(2, Math.round(anchorRect.top + (anchorRect.height - buttonHeight) / 2));

  if (anchor.matches('button[aria-label="계정 메뉴"]')) {
    const right = Math.max(8, Math.round(window.innerWidth - anchorRect.left + 8));
    button.style.top = `${top}px`;
    button.style.right = `${right}px`;
  } else {
    const right = Math.max(8, Math.round(window.innerWidth - anchorRect.right));
    button.style.top = `${top}px`;
    button.style.right = `${right}px`;
  }

  button.style.visibility = 'visible';
  return true;
};

const showFallbackPosition = (button: HTMLButtonElement) => {
  button.style.top = '12px';
  button.style.right = '12px';
  button.style.visibility = 'visible';
};

const scheduleStatusRowPosition = (button: HTMLButtonElement, noticeId: string) => {
  clearAttachRetry(noticeId);
  const tryPosition = (attempt: number) => {
    if (!document.getElementById(noticeId)) return;
    if (positionNoticeInStatusRow(button)) return;
    showFallbackPosition(button);
    if (attempt >= 40) return;
    const timer = window.setTimeout(() => tryPosition(attempt + 1), 250);
    attachRetryTimers.set(noticeId, timer);
  };
  window.requestAnimationFrame(() => tryPosition(0));
};

const applyNoticeStyle = (button: HTMLButtonElement) => {
  Object.assign(button.style, {
    position: 'fixed',
    zIndex: '2147483646',
    visibility: 'hidden',
    border: '1px solid rgba(255,180,0,.9)',
    borderRadius: '999px',
    padding: '7px 10px',
    background: '#ffb400',
    color: '#151515',
    fontSize: '11px',
    fontWeight: '700',
    lineHeight: '1',
    cursor: 'pointer',
    boxShadow: '0 3px 12px rgba(0,0,0,.18)',
    whiteSpace: 'nowrap',
  });
};

const showUpdateNotice = () => {
  if (!isPreviewUpdateHost()) {
    removeUpdateNotice();
    return;
  }

  removeCompletedNotice();

  let button = document.getElementById(NOTICE_ID) as HTMLButtonElement | null;
  if (!button) {
    button = document.createElement('button');
    button.id = NOTICE_ID;
    button.type = 'button';
    button.textContent = '새 업데이트 · 적용';
    button.setAttribute('aria-label', '새 업데이트 적용');
    applyNoticeStyle(button);
    button.addEventListener('click', () => window.location.reload());
    document.body.appendChild(button);
  }

  showFallbackPosition(button);
  scheduleStatusRowPosition(button, NOTICE_ID);
};

const hasExistingSoridrawState = () => {
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = String(window.localStorage.key(index) || '');
      if (!key.startsWith('soridraw')) continue;
      if (key === LAST_STARTED_VERSION_KEY || key === COMPLETED_NOTICE_VERSION_KEY) continue;
      return true;
    }
  } catch {
    return false;
  }
  return false;
};

const isVersionUpgrade = (previousVersion: string, currentVersion: string) => {
  const previous = Number(previousVersion);
  const current = Number(currentVersion);
  if (Number.isFinite(previous) && Number.isFinite(current)) return current > previous;
  return previousVersion !== currentVersion;
};

const showCompletedNotice = () => {
  if (!isPreviewUpdateHost()) return;
  removeUpdateNotice();
  removeCompletedNotice();

  const button = document.createElement('button');
  button.id = COMPLETED_NOTICE_ID;
  button.type = 'button';
  button.textContent = `업데이트 완료 · ${CURRENT_APP_VERSION}`;
  button.setAttribute('aria-label', `업데이트 완료 ${CURRENT_APP_VERSION}`);
  button.title = '눌러서 닫기';
  applyNoticeStyle(button);
  button.addEventListener('click', removeCompletedNotice);
  document.body.appendChild(button);

  showFallbackPosition(button);
  scheduleStatusRowPosition(button, COMPLETED_NOTICE_ID);
  completedNoticeTimer = window.setTimeout(removeCompletedNotice, COMPLETED_NOTICE_DURATION_MS);
};

const rememberLaunchVersionAndMaybeShowCompletedNotice = () => {
  if (!isPreviewUpdateHost()) return;

  let previousVersion = '';
  let completedVersion = '';
  let hadExistingState = false;
  try {
    previousVersion = String(window.localStorage.getItem(LAST_STARTED_VERSION_KEY) || '').trim();
    completedVersion = String(window.localStorage.getItem(COMPLETED_NOTICE_VERSION_KEY) || '').trim();
    hadExistingState = hasExistingSoridrawState();
    window.localStorage.setItem(LAST_STARTED_VERSION_KEY, CURRENT_APP_VERSION);
  } catch {
    return;
  }

  const upgraded = previousVersion
    ? isVersionUpgrade(previousVersion, CURRENT_APP_VERSION)
    : hadExistingState;
  if (!upgraded || completedVersion === CURRENT_APP_VERSION) return;

  try { window.localStorage.setItem(COMPLETED_NOTICE_VERSION_KEY, CURRENT_APP_VERSION); } catch { /* optional */ }
  showCompletedNotice();
};

const checkForUpdate = async (force = false) => {
  if (!isPreviewUpdateHost()) {
    removeUpdateNotice();
    return;
  }

  const now = Date.now();
  if (!force && now - lastCheckedAt < MIN_CHECK_INTERVAL_MS) return;
  lastCheckedAt = now;

  try {
    const response = await fetch(`${VERSION_URL}?t=${now}`, { cache: 'no-store' });
    if (!response.ok) {
      removeUpdateNotice();
      return;
    }
    const payload = await response.json() as { version?: string | number };
    const remoteVersion = String(payload?.version || '').trim();
    if (!remoteVersion || remoteVersion === CURRENT_APP_VERSION) {
      removeUpdateNotice();
      return;
    }
    showUpdateNotice();
  } catch {
    // 업데이트 확인에 실패하면 현재 앱을 방해하지 않고 다음 주기/복귀 때 다시 확인한다.
    removeUpdateNotice();
  }
};

const startActiveUpdateChecks = () => {
  if (activeCheckTimer !== null || typeof window === 'undefined') return;
  activeCheckTimer = window.setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    void checkForUpdate();
  }, ACTIVE_CHECK_INTERVAL_MS);
};

export const startAppUpdateNotice = () => {
  if (started || typeof window === 'undefined') return;
  started = true;

  if (!isPreviewUpdateHost()) {
    removeUpdateNotice();
    removeCompletedNotice();
    return;
  }

  rememberLaunchVersionAndMaybeShowCompletedNotice();
  void checkForUpdate(true);
  startActiveUpdateChecks();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate(true);
  });
  window.addEventListener('focus', () => void checkForUpdate(true));
  window.addEventListener('online', () => void checkForUpdate(true));
  window.addEventListener('resize', () => {
    const updateButton = document.getElementById(NOTICE_ID) as HTMLButtonElement | null;
    if (updateButton) scheduleStatusRowPosition(updateButton, NOTICE_ID);
    const completedButton = document.getElementById(COMPLETED_NOTICE_ID) as HTMLButtonElement | null;
    if (completedButton) scheduleStatusRowPosition(completedButton, COMPLETED_NOTICE_ID);
  }, { passive: true });
};

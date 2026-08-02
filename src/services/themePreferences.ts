export type SoridrawTheme = 'classic' | 'studio-black';
export type SoridrawColorMode = 'dark' | 'light';
export type SoridrawDisplayMode = SoridrawColorMode | 'studio-black';

const THEME_STORAGE_KEY = 'soridraw_app_theme';
const PHONE_MODE_STORAGE_KEY = 'soridraw_phone_display_mode';
const LARGE_MODE_STORAGE_KEY = 'soridraw_large_display_mode';

export const normalizeSoridrawTheme = (value: unknown): SoridrawTheme =>
  value === 'studio-black' ? 'studio-black' : 'classic';

export const isSoridrawPhoneDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;

  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  if (typeof nav.userAgentData?.mobile === 'boolean') {
    return nav.userAgentData.mobile;
  }

  const ua = navigator.userAgent || '';
  if (/iPhone|iPod|Windows Phone|IEMobile|Opera Mini|BlackBerry|webOS/i.test(ua)) return true;
  return /Android/i.test(ua) && /Mobile/i.test(ua);
};

export const readSoridrawTheme = (): SoridrawTheme => {
  try {
    return normalizeSoridrawTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'classic';
  }
};

const readStoredDisplayMode = (isPhone: boolean): SoridrawDisplayMode => {
  try {
    const stored = localStorage.getItem(isPhone ? PHONE_MODE_STORAGE_KEY : LARGE_MODE_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    if (!isPhone && stored === 'studio-black') return 'studio-black';

    if (!isPhone && readSoridrawTheme() === 'studio-black') return 'studio-black';
    return 'dark';
  } catch {
    return !isPhone && readSoridrawTheme() === 'studio-black' ? 'studio-black' : 'dark';
  }
};

export const readSoridrawDisplayMode = (): SoridrawDisplayMode =>
  readStoredDisplayMode(isSoridrawPhoneDevice());

const persistDisplayMode = (mode: SoridrawDisplayMode, isPhone: boolean) => {
  try {
    localStorage.setItem(isPhone ? PHONE_MODE_STORAGE_KEY : LARGE_MODE_STORAGE_KEY, mode);
    if (!isPhone) {
      localStorage.setItem(THEME_STORAGE_KEY, mode === 'studio-black' ? 'studio-black' : 'classic');
    }
    localStorage.setItem('themeMode', mode === 'light' ? 'light' : 'dark');
  } catch {
    // Keep the current in-memory appearance even when storage is unavailable.
  }
};

export const applySoridrawDisplayMode = (requestedMode: SoridrawDisplayMode) => {
  if (typeof document === 'undefined') return requestedMode;

  const isPhone = isSoridrawPhoneDevice();
  const mode: SoridrawDisplayMode = isPhone && requestedMode === 'studio-black'
    ? 'dark'
    : requestedMode;
  const theme: SoridrawTheme = mode === 'studio-black' ? 'studio-black' : 'classic';
  const colorMode: SoridrawColorMode = mode === 'light' ? 'light' : 'dark';

  const root = document.documentElement;
  root.dataset.soridrawTheme = theme;
  root.dataset.soridrawColorMode = colorMode;
  root.dataset.soridrawDevice = isPhone ? 'phone' : 'large-screen';
  root.classList.toggle('dark', colorMode === 'dark');

  persistDisplayMode(mode, isPhone);

  window.dispatchEvent(new CustomEvent('soridraw-theme-change', {
    detail: { mode, theme, colorMode, isPhone },
  }));

  return mode;
};

export const applyStoredSoridrawDisplayMode = () =>
  applySoridrawDisplayMode(readSoridrawDisplayMode());

export const cycleSoridrawDisplayMode = () => {
  const isPhone = isSoridrawPhoneDevice();
  const sequence: SoridrawDisplayMode[] = isPhone
    ? ['dark', 'light']
    : ['dark', 'light', 'studio-black'];
  const current = readStoredDisplayMode(isPhone);
  const currentIndex = sequence.indexOf(current);
  const next = sequence[(currentIndex < 0 ? 0 : currentIndex + 1) % sequence.length];
  return applySoridrawDisplayMode(next);
};

export const getSoridrawDisplayModeLabel = (mode: SoridrawDisplayMode): string => {
  if (mode === 'studio-black') return '블랙';
  return mode === 'light' ? '라이트' : '다크';
};

export const applySoridrawTheme = (theme: SoridrawTheme) => {
  const normalized = normalizeSoridrawTheme(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, normalized);
  } catch {
    // Keep the current in-memory appearance even when storage is unavailable.
  }

  if (isSoridrawPhoneDevice()) {
    return applySoridrawDisplayMode(readStoredDisplayMode(true));
  }
  return applySoridrawDisplayMode(normalized === 'studio-black' ? 'studio-black' : 'dark');
};

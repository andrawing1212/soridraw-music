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

  // 631: `userAgentData.mobile === false` is not strong enough to classify a
  // Samsung/Android device as a tablet. Some browser/PWA combinations report
  // false while the legacy UA still carries the Android `Mobile` token. Treat
  // only an explicit `true` as decisive, then fall through to the UA and a
  // conservative physical-screen fallback. This keeps a real phone classified
  // as a phone even when it is rotated to landscape.
  if (nav.userAgentData?.mobile === true) return true;

  const ua = navigator.userAgent || '';
  if (/iPhone|iPod|Windows Phone|IEMobile|Opera Mini|BlackBerry|webOS/i.test(ua)) return true;
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return true;

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const coarsePrimary = window.matchMedia('(pointer: coarse)').matches;
    const noHover = window.matchMedia('(hover: none)').matches;
    const screenShortSide = Math.min(window.screen?.width || 9999, window.screen?.height || 9999);
    if ((coarsePrimary || noHover) && screenShortSide <= 600) return true;
  }

  return false;
};

export const readSoridrawTheme = (): SoridrawTheme => {
  try {
    return normalizeSoridrawTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'classic';
  }
};

const normalizeDisplayModeForDevice = (mode: SoridrawDisplayMode, isPhone: boolean): SoridrawDisplayMode => {
  // 630: physical phones never enter the split workspace. The phone/large-screen
  // distinction comes from the device UA, not viewport width, so rotating a
  // phone to landscape cannot accidentally promote it into the tablet split UI.
  // Tablets (Galaxy Tab/iPad/etc.) keep the existing split-capable path.
  if (isPhone && mode === 'studio-black') return 'dark';
  return mode;
};

const readStoredDisplayMode = (isPhone: boolean): SoridrawDisplayMode => {
  try {
    const stored = localStorage.getItem(isPhone ? PHONE_MODE_STORAGE_KEY : LARGE_MODE_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'studio-black') {
      return normalizeDisplayModeForDevice(stored, isPhone);
    }

    const legacyThemeMode: SoridrawDisplayMode = readSoridrawTheme() === 'studio-black' ? 'studio-black' : 'dark';
    return normalizeDisplayModeForDevice(legacyThemeMode, isPhone);
  } catch {
    const fallbackMode: SoridrawDisplayMode = readSoridrawTheme() === 'studio-black' ? 'studio-black' : 'dark';
    return normalizeDisplayModeForDevice(fallbackMode, isPhone);
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
  const mode: SoridrawDisplayMode = normalizeDisplayModeForDevice(requestedMode, isPhone);
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
  if (mode === 'studio-black') return '분할';
  return mode === 'light' ? '라이트' : '다크';
};

export const applySoridrawTheme = (theme: SoridrawTheme) => {
  const normalized = normalizeSoridrawTheme(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, normalized);
  } catch {
    // Keep the current in-memory appearance even when storage is unavailable.
  }

  return applySoridrawDisplayMode(normalized === 'studio-black' ? 'studio-black' : 'dark');
};

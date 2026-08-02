export type SoridrawTheme = 'classic' | 'studio-black';
export type SoridrawColorMode = 'dark' | 'light';
export type SoridrawDisplayMode = SoridrawColorMode | 'studio-black';

const THEME_STORAGE_KEY = 'soridraw_app_theme';
const LEGACY_COLOR_MODE_STORAGE_KEY = 'soridraw_color_mode';
const PHONE_COLOR_MODE_STORAGE_KEY = 'soridraw_phone_color_mode';
const LARGE_SCREEN_COLOR_MODE_STORAGE_KEY = 'soridraw_large_screen_color_mode';

export const normalizeSoridrawTheme = (value: unknown): SoridrawTheme =>
  value === 'studio-black' ? 'studio-black' : 'classic';

export const normalizeSoridrawColorMode = (value: unknown): SoridrawColorMode =>
  value === 'light' ? 'light' : 'dark';

export const isSoridrawPhoneDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;

  const navigatorWithData = navigator as Navigator & {
    userAgentData?: { mobile?: boolean };
  };
  if (typeof navigatorWithData.userAgentData?.mobile === 'boolean') {
    return navigatorWithData.userAgentData.mobile;
  }

  const userAgent = navigator.userAgent || '';
  if (/iPhone|iPod/i.test(userAgent)) return true;
  if (/Android/i.test(userAgent)) return /Mobile/i.test(userAgent);
  if (/Windows Phone|IEMobile|Opera Mini|BlackBerry|webOS/i.test(userAgent)) return true;
  return false;
};

export const readSoridrawTheme = (): SoridrawTheme => {
  try {
    return normalizeSoridrawTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'classic';
  }
};

export const readSoridrawColorMode = (): SoridrawColorMode => {
  try {
    const deviceKey = isSoridrawPhoneDevice()
      ? PHONE_COLOR_MODE_STORAGE_KEY
      : LARGE_SCREEN_COLOR_MODE_STORAGE_KEY;
    return normalizeSoridrawColorMode(
      localStorage.getItem(deviceKey)
      || localStorage.getItem(LEGACY_COLOR_MODE_STORAGE_KEY)
      || localStorage.getItem('themeMode'),
    );
  } catch {
    return 'dark';
  }
};

const writeAppearancePreferences = (theme: SoridrawTheme, colorMode: SoridrawColorMode) => {
  try {
    if (isSoridrawPhoneDevice()) {
      // Mobile color choice must not overwrite the tablet/PC Classic/Black choice.
      localStorage.setItem(PHONE_COLOR_MODE_STORAGE_KEY, colorMode);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      localStorage.setItem(LARGE_SCREEN_COLOR_MODE_STORAGE_KEY, colorMode);
      // Keep the legacy keys synchronized only from tablet/PC.
      localStorage.setItem(LEGACY_COLOR_MODE_STORAGE_KEY, colorMode);
      localStorage.setItem('themeMode', colorMode);
    }
  } catch {
    // Keep the in-memory appearance even when storage is unavailable.
  }
};

export const applySoridrawAppearance = (
  theme: SoridrawTheme,
  colorMode: SoridrawColorMode,
  options: { persist?: boolean } = {},
) => {
  const normalizedTheme = normalizeSoridrawTheme(theme);
  const normalizedColorMode = normalizeSoridrawColorMode(colorMode);
  const isPhone = isSoridrawPhoneDevice();

  // Studio Black is a tablet/desktop-only design. Phones always use Classic layout.
  const effectiveTheme: SoridrawTheme = isPhone ? 'classic' : normalizedTheme;
  const effectiveColorMode: SoridrawColorMode = effectiveTheme === 'studio-black' ? 'dark' : normalizedColorMode;

  document.documentElement.dataset.soridrawTheme = effectiveTheme;
  document.documentElement.dataset.soridrawColorMode = effectiveColorMode;
  document.documentElement.dataset.soridrawDevice = isPhone ? 'phone' : 'large-screen';
  document.documentElement.classList.toggle('dark', effectiveColorMode === 'dark');
  const themeColor = effectiveColorMode === 'light'
    ? '#ffffff'
    : effectiveTheme === 'studio-black' ? '#101010' : '#0f0f0f';
  document.documentElement.style.setProperty('--soridraw-initial-bg', themeColor);
  document.documentElement.style.setProperty('--soridraw-initial-text', effectiveColorMode === 'light' ? '#1a1a1a' : '#f8f9fa');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);

  if (options.persist !== false) {
    writeAppearancePreferences(normalizedTheme, normalizedColorMode);
  }

  const displayMode: SoridrawDisplayMode = effectiveTheme === 'studio-black'
    ? 'studio-black'
    : effectiveColorMode;

  window.dispatchEvent(new CustomEvent('soridraw-theme-change', {
    detail: {
      theme: normalizedTheme,
      colorMode: normalizedColorMode,
      effectiveTheme,
      effectiveColorMode,
      displayMode,
      isPhone,
    },
  }));

  return displayMode;
};

export const applyStoredSoridrawAppearance = () =>
  applySoridrawAppearance(readSoridrawTheme(), readSoridrawColorMode(), { persist: false });

export const applySoridrawTheme = (theme: SoridrawTheme) =>
  applySoridrawAppearance(theme, readSoridrawColorMode());

export const applySoridrawColorMode = (colorMode: SoridrawColorMode) =>
  applySoridrawAppearance(readSoridrawTheme(), colorMode);

export const readSoridrawDisplayMode = (): SoridrawDisplayMode => {
  const theme = readSoridrawTheme();
  const colorMode = readSoridrawColorMode();
  if (!isSoridrawPhoneDevice() && theme === 'studio-black') return 'studio-black';
  return colorMode;
};

export const applySoridrawDisplayMode = (displayMode: SoridrawDisplayMode) => {
  if (isSoridrawPhoneDevice()) {
    // Keep the tablet/PC theme untouched while switching phone dark/light.
    return applySoridrawAppearance(readSoridrawTheme(), displayMode === 'light' ? 'light' : 'dark');
  }
  if (displayMode === 'studio-black') {
    return applySoridrawAppearance('studio-black', 'dark');
  }
  return applySoridrawAppearance('classic', displayMode === 'light' ? 'light' : 'dark');
};

export const cycleSoridrawDisplayMode = (): SoridrawDisplayMode => {
  const current = readSoridrawDisplayMode();
  const sequence: SoridrawDisplayMode[] = isSoridrawPhoneDevice()
    ? ['dark', 'light']
    : ['dark', 'light', 'studio-black'];
  const currentIndex = Math.max(0, sequence.indexOf(current));
  const next = sequence[(currentIndex + 1) % sequence.length];
  return applySoridrawDisplayMode(next);
};

export const getSoridrawDisplayModeLabel = (displayMode: SoridrawDisplayMode): string => {
  if (displayMode === 'studio-black') return '블랙';
  return displayMode === 'light' ? '라이트' : '다크';
};

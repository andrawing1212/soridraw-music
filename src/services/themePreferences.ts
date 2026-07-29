export type SoridrawTheme = 'classic' | 'studio-black';

const STORAGE_KEY = 'soridraw_app_theme';

export const normalizeSoridrawTheme = (value: unknown): SoridrawTheme =>
  value === 'studio-black' ? 'studio-black' : 'classic';

export const readSoridrawTheme = (): SoridrawTheme => {
  try {
    return normalizeSoridrawTheme(localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'classic';
  }
};

export const applySoridrawTheme = (theme: SoridrawTheme) => {
  const normalized = normalizeSoridrawTheme(theme);
  document.documentElement.dataset.soridrawTheme = normalized;
  try {
    localStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    // Keep the in-memory theme even when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent('soridraw-theme-change', { detail: normalized }));
  return normalized;
};

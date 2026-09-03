export const MENU_HELP_TIPS_STORAGE_KEY = 'soridraw.menuHelpTips.v1';
export const MENU_HELP_TIPS_EVENT = 'soridraw:menu-help-tips-changed';

export function readMenuHelpTipsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(MENU_HELP_TIPS_STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function writeMenuHelpTipsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MENU_HELP_TIPS_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // Keep the in-session behavior even when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(MENU_HELP_TIPS_EVENT, { detail: { enabled } }));
}

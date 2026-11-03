// Manual admin recovery of colors already inspected from the owner's
// Firestore documents. Never writes to Firestore/R2, never replaces an
// explicit local color/reset, and never performs a network request.
export const SORIDRAW_COLOR_LOCAL_RECOVERY_EVENT = 'soridraw-color-local-recovery';

const VALID_COLORS = new Set(['red', 'orange', 'yellow', 'green', 'blue', 'purple']);
export const applyInspectedColorsToDevice = (
  uid: string,
  baseKey: string,
  entries: Record<string, string>,
): number => {
  if (!uid || !['soridraw.favoriteColorTags', 'soridraw.library.workspaceColorTags'].includes(baseKey)) return 0;
  const storageKey = baseKey + '.' + uid;
  let existing: Record<string, string> = {};
  try {
    const raw = localStorage.getItem(storageKey) || localStorage.getItem(baseKey);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      existing = parsed as Record<string, string>;
    }
  } catch {
    return 0;
  }
  const next = { ...existing };
  let applied = 0;
  for (const [key, color] of Object.entries(entries)) {
    if (!key || key.length > 320 || !VALID_COLORS.has(color)) continue;
    // Preserve a user's own (possibly newer) explicit local change, even gray.
    if (Object.prototype.hasOwnProperty.call(next, key)) continue;
    next[key] = color;
    applied++;
  }
  if (!applied) return 0;
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(SORIDRAW_COLOR_LOCAL_RECOVERY_EVENT, {
      detail: { uid, baseKey },
    }));
    return applied;
  } catch {
    return 0;
  }
};

// app468: "다음곡에 적용" is a same-tab SPA handoff, not a database write.
// Full/restricted Web Storage must not block the route change or lose its recipe.
// This bridge never clears unrelated local-first user data.
let inMemoryPendingKeywords: string | null = null;

type StorageTarget = 'sessionStorage' | 'localStorage';

const safeStorage = (target: StorageTarget): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window[target];
  } catch {
    return null;
  }
};

const safeRead = (target: StorageTarget, key: string): string | null => {
  try {
    return safeStorage(target)?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const safeWrite = (target: StorageTarget, key: string, value: string): boolean => {
  try {
    const storage = safeStorage(target);
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const safeRemove = (target: StorageTarget, key: string): void => {
  try {
    safeStorage(target)?.removeItem(key);
  } catch {
    // Storage can be blocked or full. The SPA in-memory handoff is independent.
  }
};

export const stageNextSongKeywords = (serialized: string): {
  sessionSaved: boolean;
  backupSaved: boolean;
} => {
  // Always keep the latest click's recipe in the active tab until it is applied.
  inMemoryPendingKeywords = serialized;
  const sessionSaved = safeWrite('sessionStorage', 'pendingAppliedKeywords', serialized);
  const backupSaved = safeWrite('localStorage', 'pendingAppliedKeywordsBackup', serialized);
  return { sessionSaved, backupSaved };
};

export const readNextSongKeywords = (): string | null =>
  inMemoryPendingKeywords ||
  safeRead('sessionStorage', 'pendingAppliedKeywords') ||
  safeRead('localStorage', 'pendingAppliedKeywordsBackup');

export const clearNextSongKeywords = (applied: string): void => {
  // An older async consumer must never delete a later click's new recipe.
  if (inMemoryPendingKeywords !== null && inMemoryPendingKeywords !== applied) return;
  inMemoryPendingKeywords = null;
  // These are the two legacy handoff-only keys; never clear any other storage.
  safeRemove('sessionStorage', 'pendingAppliedKeywords');
  safeRemove('localStorage', 'pendingAppliedKeywordsBackup');
};

// Preserve the current Result when the existing Studio Builder is already
// visible next to Music Note/Library. The URL remains the canonical owner of
// split workspace selection; no new event, data store or pane observer.
export const resolveNextSongApplyRoute = (timestamp: number): string => {
  const createRoute = `/studio?applyPending=1&t=${timestamp}`;
  if (typeof window === 'undefined' || typeof document === 'undefined') return createRoute;
  if (
    document.documentElement?.dataset.soridrawTheme !== 'studio-black'
    || !window.matchMedia?.('(min-width: 1100px)').matches
    || window.location.pathname !== '/studio'
  ) return createRoute;

  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  if (view !== 'music-note' && view !== 'library') return createRoute;
  params.set('applyPending', '1');
  params.set('t', String(timestamp));
  return `/studio?${params.toString()}`;
};

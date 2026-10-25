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

export const FIRESTORE_READ_CACHE_KEYS = {
  navigationVisibility: 'soridraw_firestore_cache_navigation_visibility_v1',
  lyricClicheGuard: 'soridraw_firestore_cache_lyric_cliche_guard_v1',
  sectionTags: 'soridraw_firestore_cache_section_tags_v1',
} as const;

// Shared configuration caches are mutation/version driven. App restart or elapsed time must not create paid reads.
export const FIRESTORE_READ_CACHE_TTL_MS = {
  navigationVisibility: Number.POSITIVE_INFINITY,
  lyricClicheGuard: Number.POSITIVE_INFINITY,
  sectionTags: Number.POSITIVE_INFINITY,
} as const;

type CacheEnvelope<T> = {
  cachedAt: number;
  data: T;
};

export const readFirestoreReadCache = <T,>(key: string, ttlMs: number) => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed.cachedAt !== 'number' || !('data' in parsed)) return null;
    return {
      data: parsed.data,
      cachedAt: parsed.cachedAt,
      isFresh: Date.now() - parsed.cachedAt < ttlMs,
    };
  } catch {
    return null;
  }
};

export const writeFirestoreReadCache = <T,>(key: string, data: T) => {
  if (typeof window === 'undefined') return;
  try {
    const envelope: CacheEnvelope<T> = { cachedAt: Date.now(), data };
    window.localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // A failed write must never leave an older cache value looking current.
    // Remove only this expendable SORIDRAW read-cache key; never touch Auth,
    // Firestore SDK internals, or unrelated site storage.
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Storage can be unavailable in private/restricted browser contexts.
    }
  }
};

export const clearFirestoreReadCache = (key: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore unavailable storage.
  }
};

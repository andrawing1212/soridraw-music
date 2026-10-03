import {
  readSoridrawPersistentCache,
  removeSoridrawPersistentCachesBySourceType,
  writeSoridrawPersistentCache,
} from '../lib/soridrawPersistentCache';

// SORIDRAW_LONG_TERM_CACHE_STAGE_1_3_990
// SORIDRAW_EXPLORE_FEED_REVISION_033_20260908
// SORIDRAW_EXPLORE_FEED_STALE_COUNT_CACHE_RECOVERY_108_20260916
// 108 rejected schema-1 once. Real mobile evidence showed a stale schema-2 public-count payload can survive,
// so 109 performs one final contract bump. Keep this value stable across ordinary future app versions.
// SORIDRAW_EXPLORE_MOBILE_STALE_PUBLIC_COUNT_RECOVERY_109_20260916
const EXPLORE_FEED_CACHE_SCHEMA_VERSION = 3;
const EXPLORE_FEED_SOURCE_TYPE = 'explore_feed';

// SORIDRAW_EXPLORE_SEARCH_LOCAL_ZERO_REENTRY_340_20261004
// Search is public read-only data. Keep the first result on-device briefly so
// repeating the exact same query does not call Worker/D1 again.
const EXPLORE_SEARCH_CACHE_SCHEMA_VERSION_340 = 1;
const EXPLORE_SEARCH_SOURCE_TYPE_340 = 'explore_search';
const EXPLORE_SEARCH_CACHE_TTL_MS_340 = 2 * 60 * 1000;

type ExploreSearchCacheData340 = {
  rows: Array<Record<string, unknown>>;
};

const exploreSearchMemoryCache340 = new Map<string, {
  rows: Array<Record<string, unknown>>;
  expiresAt: number;
}>();

const isExploreSearchRequest340 = (url: string) => {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname === '/v1/search'
      && Boolean(parsed.searchParams.get('q'))
      && !parsed.searchParams.get('cursor');
  } catch {
    return url.includes('/v1/search?') && !url.includes('cursor=');
  }
};

const getExploreSearchCacheKey340 = (url: string) => `explore-search:${url}`;

export const readExploreSearchCache340 = (url: string): Array<Record<string, unknown>> | null => {
  if (!isExploreSearchRequest340(url)) return null;
  const memory = exploreSearchMemoryCache340.get(url);
  if (memory) {
    if (memory.expiresAt > Date.now()) return cloneRows(memory.rows);
    exploreSearchMemoryCache340.delete(url);
  }

  const envelope = readSoridrawPersistentCache<ExploreSearchCacheData340>({
    cacheKey: getExploreSearchCacheKey340(url),
    sourceType: EXPLORE_SEARCH_SOURCE_TYPE_340,
    schemaVersion: EXPLORE_SEARCH_CACHE_SCHEMA_VERSION_340,
    uid: null,
  });
  if (!envelope || !Array.isArray(envelope.data?.rows)) return null;
  const rows = cloneRows(envelope.data.rows);
  exploreSearchMemoryCache340.set(url, {
    rows,
    expiresAt: Number(envelope.expiresAt || 0),
  });
  return cloneRows(rows);
};

export const writeExploreSearchCache340 = (
  url: string,
  rows: Array<Record<string, unknown>>,
) => {
  if (!isExploreSearchRequest340(url) || !Array.isArray(rows)) return;
  const expiresAt = Date.now() + EXPLORE_SEARCH_CACHE_TTL_MS_340;
  const cloned = cloneRows(rows);
  exploreSearchMemoryCache340.set(url, { rows: cloned, expiresAt });
  writeSoridrawPersistentCache<ExploreSearchCacheData340>({
    cacheKey: getExploreSearchCacheKey340(url),
    sourceType: EXPLORE_SEARCH_SOURCE_TYPE_340,
    schemaVersion: EXPLORE_SEARCH_CACHE_SCHEMA_VERSION_340,
    dataVersion: 0,
    uid: null,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt,
    dirty: false,
    pendingMutationId: null,
    data: { rows: cloned },
  });
};

export const invalidateExploreSearchCache340 = () => {
  exploreSearchMemoryCache340.clear();
  removeSoridrawPersistentCachesBySourceType(EXPLORE_SEARCH_SOURCE_TYPE_340);
};


  
// SORIDRAW_EXPLORE_MORE_PAGE_CACHE_213_20260927
// Explicit cursor pages are user-demand reads. Cache a small bounded set locally so
// reopening the same already-viewed page does not spend D1 again. Shared public
// data can change underneath a cursor page, so reuse is intentionally capped to
// the existing two-minute Explore viewer freshness window.
const EXPLORE_MORE_PAGE_CACHE_NAME_213 = 'soridraw-explore-more-pages-v1';
const EXPLORE_MORE_PAGE_CACHE_TTL_MS_213 = 2 * 60 * 1000;
const EXPLORE_MORE_PAGE_CACHE_MAX_ENTRIES_213 = 12;

type ExploreMorePageCacheEntry213 = {
  schemaVersion: 1;
  cachedAt: number;
  expiresAt: number;
  baseRevision: string;
  rows: Array<Record<string, unknown>>;
  nextCursor: string | null;
};

const exploreMorePageMemoryCache213 = new Map<string, ExploreMorePageCacheEntry213>();

const isExploreMorePageUrl213 = (url: string) => {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname === '/v1/feed'
      && Boolean(parsed.searchParams.get('cursor'))
      && Number(parsed.searchParams.get('limit') || 40) === 40;
  } catch {
    return false;
  }
};

const cloneMorePageEntry213 = (entry: ExploreMorePageCacheEntry213): ExploreMorePageCacheEntry213 => ({
  ...entry,
  rows: cloneRows(entry.rows),
});

const isValidMorePageEntry213 = (
  value: unknown,
  expectedRevision: string,
): value is ExploreMorePageCacheEntry213 => {
  if (!value || typeof value !== 'object') return false;
  const entry = value as ExploreMorePageCacheEntry213;
  return entry.schemaVersion === 1
    && Number.isFinite(entry.cachedAt)
    && Number.isFinite(entry.expiresAt)
    && entry.expiresAt > Date.now()
    && entry.baseRevision === expectedRevision
    && Array.isArray(entry.rows)
    && entry.rows.length <= 40
    && (entry.nextCursor === null || typeof entry.nextCursor === 'string');
};

const pruneExploreMorePageCache213 = async (cache: Cache) => {
  try {
    const keys = await cache.keys();
    const overflow = Math.max(0, keys.length - EXPLORE_MORE_PAGE_CACHE_MAX_ENTRIES_213);
    for (let index = 0; index < overflow; index += 1) {
      exploreMorePageMemoryCache213.delete(keys[index].url);
      await cache.delete(keys[index]);
    }
  } catch {
    // Browser cache is best-effort only.
  }
};

export const readExploreMorePageCache213 = async (
  url: string,
  expectedRevision: string | null,
): Promise<{ rows: Array<Record<string, unknown>>; nextCursor: string | null } | null> => {
  const revision = String(expectedRevision || '').trim();
  if (!revision || !isExploreMorePageUrl213(url)) return null;

  const memory = exploreMorePageMemoryCache213.get(url);
  if (memory) {
    if (isValidMorePageEntry213(memory, revision)) {
      const cloned = cloneMorePageEntry213(memory);
      return { rows: cloned.rows, nextCursor: cloned.nextCursor };
    }
    exploreMorePageMemoryCache213.delete(url);
  }

  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(EXPLORE_MORE_PAGE_CACHE_NAME_213);
    const response = await cache.match(url);
    if (!response) return null;
    const parsed = await response.json() as ExploreMorePageCacheEntry213;
    if (!isValidMorePageEntry213(parsed, revision)) {
      await cache.delete(url);
      return null;
    }
    exploreMorePageMemoryCache213.set(url, parsed);
    const cloned = cloneMorePageEntry213(parsed);
    return { rows: cloned.rows, nextCursor: cloned.nextCursor };
  } catch {
    return null;
  }
};

export const writeExploreMorePageCache213 = async (
  url: string,
  baseRevision: string | null,
  rows: Array<Record<string, unknown>>,
  nextCursor: string | null,
): Promise<void> => {
  const revision = String(baseRevision || '').trim();
  if (!revision || !isExploreMorePageUrl213(url) || !Array.isArray(rows) || rows.length > 40) return;
  const now = Date.now();
  const entry: ExploreMorePageCacheEntry213 = {
    schemaVersion: 1,
    cachedAt: now,
    expiresAt: now + EXPLORE_MORE_PAGE_CACHE_TTL_MS_213,
    baseRevision: revision,
    rows: cloneRows(rows),
    nextCursor: nextCursor ? String(nextCursor) : null,
  };
  exploreMorePageMemoryCache213.set(url, entry);
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(EXPLORE_MORE_PAGE_CACHE_NAME_213);
    await cache.put(url, new Response(JSON.stringify(entry), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }));
    await pruneExploreMorePageCache213(cache);
  } catch {
    // Local page reuse is an optimization; the normal bounded D1 path remains available.
  }
};

export const invalidateExploreMorePageCache213 = () => {
  exploreMorePageMemoryCache213.clear();
  if (typeof caches !== 'undefined') {
    void caches.delete(EXPLORE_MORE_PAGE_CACHE_NAME_213).catch(() => undefined);
  }
};

type ExploreFeedCacheData = {
  rows: Array<Record<string, unknown>>;
};

type ExploreFeedMemoryEntry = {
  rows: Array<Record<string, unknown>>;
  serverRevision: string | null;
};

const exploreFeedMemoryCache = new Map<string, ExploreFeedMemoryEntry>();

const isFeedRequest = (url: string) => {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname === '/v1/feed';
  } catch {
    return url.includes('/v1/feed?');
  }
};

const getFeedCacheKey = (url: string) => `explore-feed:${url}`;
const cloneRows = (rows: Array<Record<string, unknown>>) => rows.map((row) => ({ ...row }));
const normalizeRevision = (value: unknown) => {
  const normalized = String(value ?? '').trim();
  return normalized || null;
};

const readFeedEnvelope = (url: string) => readSoridrawPersistentCache<ExploreFeedCacheData>({
  cacheKey: getFeedCacheKey(url),
  sourceType: EXPLORE_FEED_SOURCE_TYPE,
  schemaVersion: EXPLORE_FEED_CACHE_SCHEMA_VERSION,
  uid: null,
});

export const readExploreFeedSessionCache = (url: string): Array<Record<string, unknown>> | null => {
  if (!isFeedRequest(url)) return null;
  const memory = exploreFeedMemoryCache.get(url);
  if (memory) return cloneRows(memory.rows);

  const envelope = readFeedEnvelope(url);
  if (!envelope || !Array.isArray(envelope.data?.rows)) return null;
  const rows = cloneRows(envelope.data.rows);
  exploreFeedMemoryCache.set(url, {
    rows,
    serverRevision: normalizeRevision(envelope.serverRevision),
  });
  return cloneRows(rows);
};

export const readExploreFeedSessionCacheRevision = (url: string): string | null => {
  if (!isFeedRequest(url)) return null;
  const memory = exploreFeedMemoryCache.get(url);
  if (memory) return normalizeRevision(memory.serverRevision);
  return normalizeRevision(readFeedEnvelope(url)?.serverRevision);
};

export const readExploreFeedSessionCacheCursor = (url: string): string | null => {
  if (!isFeedRequest(url)) return null;
  return normalizeRevision(readFeedEnvelope(url)?.syncCursor);
};

export const writeExploreFeedSessionCache = (
  url: string,
  rows: Array<Record<string, unknown>>,
  syncCursor: string | null = null,
  serverRevision: string | null = null,
) => {
  if (!isFeedRequest(url)) return;
  const cloned = cloneRows(rows);
  const normalizedRevision = normalizeRevision(serverRevision);
  exploreFeedMemoryCache.set(url, { rows: cloned, serverRevision: normalizedRevision });
  writeSoridrawPersistentCache<ExploreFeedCacheData>({
    cacheKey: getFeedCacheKey(url),
    sourceType: EXPLORE_FEED_SOURCE_TYPE,
    schemaVersion: EXPLORE_FEED_CACHE_SCHEMA_VERSION,
    dataVersion: 0,
    uid: null,
    syncCursor,
    serverRevision: normalizedRevision,
    deletedIds: [],
    expiresAt: null,
    dirty: false,
    pendingMutationId: null,
    data: { rows: cloned },
  });
};

export const patchExploreFeedSessionCacheRow = (
  url: string,
  trackId: string,
  patch: Record<string, unknown>,
) => {
  if (!isFeedRequest(url)) return;
  const cached = readExploreFeedSessionCache(url);
  if (!cached) return;
  let changed = false;
  const rows = cached.map((row) => {
    const rowId = String(row.id || row.trackId || '').trim();
    if (!rowId || rowId !== trackId) return row;
    changed = true;
    return { ...row, ...patch };
  });
  if (!changed) return;
  const previous = readFeedEnvelope(url);
  writeExploreFeedSessionCache(
    url,
    rows,
    previous?.syncCursor ?? null,
    normalizeRevision(previous?.serverRevision),
  );
};


// SORIDRAW_EXPLORE_TARGETED_PUBLICATION_CACHE_075_20260913
const rewriteLoadedFeedRows075 = (
  mutator: (url: string, rows: Array<Record<string, unknown>>) => Array<Record<string, unknown>> | null,
) => {
  [...exploreFeedMemoryCache.entries()].forEach(([url, memory]) => {
    if (!isFeedRequest(url)) return;
    const nextRows = mutator(url, cloneRows(memory.rows));
    if (!nextRows) return;
    const previous = readFeedEnvelope(url);
    writeExploreFeedSessionCache(
      url,
      nextRows,
      previous?.syncCursor ?? null,
      normalizeRevision(previous?.serverRevision),
    );
  });
};

export const patchExploreFeedSessionCachesRow = (
  trackId: string,
  patch: Record<string, unknown>,
) => {
  const normalizedId = String(trackId || '').trim();
  if (!normalizedId) return;
  rewriteLoadedFeedRows075((_url, rows) => {
    let changed = false;
    const next = rows.map((row) => {
      const rowId = String(row.id || row.trackId || '').trim();
      if (rowId !== normalizedId) return row;
      changed = true;
      return { ...row, ...patch };
    });
    return changed ? next : null;
  });
};

export const upsertExploreFeedSessionCacheRow = (
  trackId: string,
  row: Record<string, unknown>,
) => {
  const normalizedId = String(trackId || '').trim();
  if (!normalizedId) return;
  rewriteLoadedFeedRows075((url, rows) => {
    const index = rows.findIndex((item) => String(item.id || item.trackId || '').trim() === normalizedId);
    if (index >= 0) {
      const next = [...rows];
      next[index] = { ...next[index], ...row };
      return next;
    }
    try {
      const parsed = new URL(url, window.location.origin);
      if (parsed.searchParams.get('sort') !== 'latest') return null;
    } catch {
      return null;
    }
    const limit = Math.max(1, rows.length || 40);
    return [{ ...row }, ...rows].slice(0, limit);
  });
};

export const removeExploreFeedSessionCacheRow = (trackId: string) => {
  const normalizedId = String(trackId || '').trim();
  if (!normalizedId) return;
  rewriteLoadedFeedRows075((_url, rows) => {
    const next = rows.filter((row) => String(row.id || row.trackId || '').trim() !== normalizedId);
    return next.length === rows.length ? null : next;
  });
};

export const invalidateExploreFeedSessionCache = () => {
  exploreFeedMemoryCache.clear();
  removeSoridrawPersistentCachesBySourceType(EXPLORE_FEED_SOURCE_TYPE);
};

// Firebase Preview deployment trigger: 2026-09-08 Explore feed revision sync.

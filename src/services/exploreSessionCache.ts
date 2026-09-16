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

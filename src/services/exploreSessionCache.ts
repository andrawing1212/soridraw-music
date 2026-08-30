import {
  readSoridrawPersistentCache,
  removeSoridrawPersistentCachesBySourceType,
  writeSoridrawPersistentCache,
} from '../lib/soridrawPersistentCache';

// SORIDRAW_LONG_TERM_CACHE_STAGE_1_3_990
const EXPLORE_FEED_CACHE_SCHEMA_VERSION = 1;
const EXPLORE_FEED_SOURCE_TYPE = 'explore_feed';

type ExploreFeedCacheData = {
  rows: Array<Record<string, unknown>>;
};

type ExploreFeedMemoryEntry = {
  rows: Array<Record<string, unknown>>;
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

export const readExploreFeedSessionCache = (url: string): Array<Record<string, unknown>> | null => {
  if (!isFeedRequest(url)) return null;
  const memory = exploreFeedMemoryCache.get(url);
  if (memory) return cloneRows(memory.rows);

  const envelope = readSoridrawPersistentCache<ExploreFeedCacheData>({
    cacheKey: getFeedCacheKey(url),
    sourceType: EXPLORE_FEED_SOURCE_TYPE,
    schemaVersion: EXPLORE_FEED_CACHE_SCHEMA_VERSION,
    uid: null,
  });
  if (!envelope || !Array.isArray(envelope.data?.rows)) return null;
  const rows = cloneRows(envelope.data.rows);
  exploreFeedMemoryCache.set(url, { rows });
  return cloneRows(rows);
};

export const writeExploreFeedSessionCache = (
  url: string,
  rows: Array<Record<string, unknown>>,
  syncCursor: string | null = null,
) => {
  if (!isFeedRequest(url)) return;
  const cloned = cloneRows(rows);
  exploreFeedMemoryCache.set(url, { rows: cloned });
  writeSoridrawPersistentCache<ExploreFeedCacheData>({
    cacheKey: getFeedCacheKey(url),
    sourceType: EXPLORE_FEED_SOURCE_TYPE,
    schemaVersion: EXPLORE_FEED_CACHE_SCHEMA_VERSION,
    dataVersion: 0,
    uid: null,
    syncCursor,
    serverRevision: null,
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
  const previous = readSoridrawPersistentCache<ExploreFeedCacheData>({
    cacheKey: getFeedCacheKey(url),
    sourceType: EXPLORE_FEED_SOURCE_TYPE,
    schemaVersion: EXPLORE_FEED_CACHE_SCHEMA_VERSION,
    uid: null,
  });
  writeExploreFeedSessionCache(url, rows, previous?.syncCursor ?? null);
};

export const invalidateExploreFeedSessionCache = () => {
  exploreFeedMemoryCache.clear();
  removeSoridrawPersistentCachesBySourceType(EXPLORE_FEED_SOURCE_TYPE);
};

// Firebase Preview deployment trigger: 2026-08-31 stage 1-3 cache foundation.

import {
  readSoridrawPersistentCache,
  removeSoridrawPersistentCachesBySourceType,
  writeSoridrawPersistentCache,
} from '../lib/soridrawPersistentCache';
import { auth } from '../firebase';
import { EXPLORE_LIKE_SYNC_EVENT, refreshExploreLikedTrackStates } from './exploreLikeService';

// SORIDRAW_LONG_TERM_CACHE_STAGE_1_3_990
// SORIDRAW_EXPLORE_FEED_REVISION_033_20260908
// SORIDRAW_EXPLORE_LIKE_CROSS_DEVICE_REVALIDATION_058_20260911
const EXPLORE_FEED_CACHE_SCHEMA_VERSION = 1;
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

type ExploreLikeRevalidationRow = {
  trackId: string;
  ownerUid: string;
  likeCount: number;
};

const readTrackId = (row: Record<string, unknown>) => String(row.id || row.trackId || '').trim();
const readTrackOwnerUid = (row: Record<string, unknown>) => String(row.ownerUid || row.owner_uid || '').trim();
const readTrackLikeCount = (row: Record<string, unknown>) => {
  const stats = row.stats && typeof row.stats === 'object' ? row.stats as Record<string, unknown> : null;
  const value = Number(row.likeCount ?? stats?.likeCount ?? 0);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
};

const toLikeRevalidationRow = (row: Record<string, unknown>): ExploreLikeRevalidationRow | null => {
  const trackId = readTrackId(row);
  if (!trackId) return null;
  return {
    trackId,
    ownerUid: readTrackOwnerUid(row),
    likeCount: readTrackLikeCount(row),
  };
};

const collectLikeRevalidationRows = (
  previousRows: Array<Record<string, unknown>>,
  nextRows: Array<Record<string, unknown>>,
  previousRevision: string | null,
  nextRevision: string | null,
): ExploreLikeRevalidationRow[] => {
  if (!nextRows.length) return [];

  // A cold feed fetch is already paying for fresh public data. Re-check only
  // personal-like entries this device already knows about; the like service
  // filters uncached ids without making a request.
  if (!previousRows.length) {
    return nextRows.map(toLikeRevalidationRow).filter((row): row is ExploreLikeRevalidationRow => Boolean(row));
  }

  // Local optimistic count patches preserve the same server revision, so they
  // must never trigger a personal-state server read.
  if (previousRevision === nextRevision) return [];

  const previousById = new Map<string, Record<string, unknown>>();
  for (const row of previousRows) {
    const trackId = readTrackId(row);
    if (trackId) previousById.set(trackId, row);
  }
  const changed: ExploreLikeRevalidationRow[] = [];
  for (const row of nextRows) {
    const normalized = toLikeRevalidationRow(row);
    if (!normalized) continue;
    const previous = previousById.get(normalized.trackId);
    if (!previous || readTrackLikeCount(previous) !== normalized.likeCount) changed.push(normalized);
  }
  return changed;
};

const revalidateChangedPersonalLikes = (rows: ExploreLikeRevalidationRow[]) => {
  if (typeof window === 'undefined' || !rows.length) return;
  const user = auth.currentUser;
  if (!user) return;

  const byId = new Map(rows.map((row) => [row.trackId, row]));
  const trackIds = [...byId.keys()].slice(0, 50);
  void refreshExploreLikedTrackStates(user, trackIds)
    .then((states) => {
      for (const trackId of trackIds) {
        if (!Object.prototype.hasOwnProperty.call(states, trackId)) continue;
        const row = byId.get(trackId);
        if (!row) continue;
        window.dispatchEvent(new CustomEvent(EXPLORE_LIKE_SYNC_EVENT, {
          detail: {
            trackId,
            ownerUid: row.ownerUid,
            liked: Boolean(states[trackId]),
            likeCount: row.likeCount,
          },
        }));
      }
    })
    .catch((reason) => {
      console.warn('Explore personal-like cross-device revalidation failed:', reason);
    });
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
  const previousMemory = exploreFeedMemoryCache.get(url);
  const previousEnvelope = previousMemory ? null : readFeedEnvelope(url);
  const previousRows = previousMemory?.rows
    ?? (Array.isArray(previousEnvelope?.data?.rows) ? previousEnvelope.data.rows : []);
  const previousRevision = normalizeRevision(previousMemory?.serverRevision ?? previousEnvelope?.serverRevision);
  const cloned = cloneRows(rows);
  const normalizedRevision = normalizeRevision(serverRevision);
  const likeRevalidationRows = collectLikeRevalidationRows(
    previousRows,
    cloned,
    previousRevision,
    normalizedRevision,
  );
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
  revalidateChangedPersonalLikes(likeRevalidationRows);
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

export const invalidateExploreFeedSessionCache = () => {
  exploreFeedMemoryCache.clear();
  removeSoridrawPersistentCachesBySourceType(EXPLORE_FEED_SOURCE_TYPE);
};

// Firebase Preview deployment trigger: 2026-09-08 Explore feed revision sync.

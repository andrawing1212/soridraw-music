from pathlib import Path

LIKE = Path('src/services/exploreLikeService.ts')
SESSION = Path('src/services/exploreSessionCache.ts')
VERSION = Path('public/app-version.json')

like = LIKE.read_text(encoding='utf-8')
marker = '// SORIDRAW_EXPLORE_LIKE_CROSS_DEVICE_REVALIDATION_058_20260911'
if marker not in like:
    anchor = '// SORIDRAW_EXPLORE_LIKE_PREVIEW_1MIN_TEST_037_20260911\n'
    if anchor not in like:
        raise RuntimeError('058: like marker anchor missing')
    like = like.replace(anchor, anchor + marker + '\n', 1)

refresh_fn = '''export const refreshExploreLikedTrackStates = async (
  user: User,
  trackIds: string[],
): Promise<Record<string, boolean>> => {
  const normalized = [...new Set(trackIds.map((trackId) => String(trackId || '').trim()).filter(Boolean))].slice(0, 50);
  if (!normalized.length) return {};

  const cache = getLikedStateCache(user.uid);
  const refreshIds = normalized.filter((trackId) => cache.has(trackId));
  if (!refreshIds.length) return {};

  const query = new URLSearchParams({ trackIds: refreshIds.join(',') });
  const payload = await requestExploreLike(user, `/v1/me/likes?${query.toString()}`);
  const likedIds = new Set(
    Array.isArray(payload?.data?.likedTrackIds)
      ? payload.data.likedTrackIds.map((trackId: unknown) => String(trackId || '').trim()).filter(Boolean)
      : [],
  );
  refreshIds.forEach((trackId) => cache.set(trackId, likedIds.has(trackId)));
  persistLikedStateCache(user.uid, cache);

  const outbox = readLikeOutbox(user.uid);
  resumePendingLikes(user);
  return Object.fromEntries(
    refreshIds.map((trackId) => [
      trackId,
      outbox[trackId]?.desiredLiked ?? (cache.get(trackId) === true),
    ]),
  );
};'''

if 'export const refreshExploreLikedTrackStates' not in like:
    insert_anchor = '''export const setExploreTrackLike = async (\n'''
    if insert_anchor not in like:
        raise RuntimeError('058: set like anchor missing')
    like = like.replace(insert_anchor, refresh_fn + '\n\n' + insert_anchor, 1)

LIKE.write_text(like, encoding='utf-8')

session = SESSION.read_text(encoding='utf-8')
session_marker = '// SORIDRAW_EXPLORE_LIKE_CROSS_DEVICE_REVALIDATION_058_20260911'
if session_marker not in session:
    import_anchor = '''import {
  readSoridrawPersistentCache,
  removeSoridrawPersistentCachesBySourceType,
  writeSoridrawPersistentCache,
} from '../lib/soridrawPersistentCache';
'''
    if import_anchor not in session:
        raise RuntimeError('058: session import anchor missing')
    session = session.replace(
        import_anchor,
        import_anchor + "import { auth } from '../firebase';\nimport { EXPLORE_LIKE_SYNC_EVENT, refreshExploreLikedTrackStates } from './exploreLikeService';\n",
        1,
    )
    marker_anchor = '// SORIDRAW_EXPLORE_FEED_REVISION_033_20260908\n'
    if marker_anchor not in session:
        raise RuntimeError('058: session marker anchor missing')
    session = session.replace(marker_anchor, marker_anchor + session_marker + '\n', 1)

helpers = '''type ExploreLikeRevalidationRow = {
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

  const previousById = new Map(previousRows.map((row) => [readTrackId(row), row]).filter(([trackId]) => Boolean(trackId)));
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
};'''

if 'const collectLikeRevalidationRows' not in session:
    helper_anchor = '''const normalizeRevision = (value: unknown) => {
  const normalized = String(value ?? '').trim();
  return normalized || null;
};
'''
    if helper_anchor not in session:
        raise RuntimeError('058: normalize revision anchor missing')
    session = session.replace(helper_anchor, helper_anchor + '\n' + helpers + '\n', 1)

old_write = '''export const writeExploreFeedSessionCache = (
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
};'''

new_write = '''export const writeExploreFeedSessionCache = (
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
};'''

if old_write in session:
    session = session.replace(old_write, new_write, 1)
elif new_write not in session:
    raise RuntimeError('058: feed cache write block missing')

SESSION.write_text(session, encoding='utf-8')

version = VERSION.read_text(encoding='utf-8')
if '"version": "057"' in version:
    version = version.replace('"version": "057"', '"version": "058"', 1)
elif '"version": "058"' not in version:
    raise RuntimeError('058: unexpected app version')
VERSION.write_text(version, encoding='utf-8')

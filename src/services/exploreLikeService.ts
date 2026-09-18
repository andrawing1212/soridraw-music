import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import type { User } from 'firebase/auth';
import { getFirebaseAppCheckToken } from '../firebase';
import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';
import {
  readSoridrawPersistentCache,
  removeSoridrawPersistentCache,
  writeSoridrawPersistentCache,
} from '../lib/soridrawPersistentCache';

// SORIDRAW_EXPLORE_LIKE_ACTOR_COUNT_LOCK_120_20260918
// App 120 keeps only current-version Explore-like caches. The actor's newest
// optimistic count is protected from stale Feed/Profile payloads until the shared
// one-minute publication catches up.
const EXPLORE_LIKE_CACHE_SCHEMA_VERSION = 120;
const EXPLORE_LIKE_CACHE_KEY = 'explore-liked-state-120';
const EXPLORE_LIKE_SOURCE_TYPE = 'explore_likes_120';
const EXPLORE_LIKE_OUTBOX_SCHEMA_VERSION = 120;
const EXPLORE_LIKE_OUTBOX_CACHE_KEY = 'explore-like-outbox-120';
const EXPLORE_LIKE_OUTBOX_SOURCE_TYPE = 'explore_like_outbox_120';
const EXPLORE_LIKE_DISPLAY_LOCK_SCHEMA_VERSION = 120;
const EXPLORE_LIKE_DISPLAY_LOCK_CACHE_KEY = 'explore-like-display-lock-120';
const EXPLORE_LIKE_DISPLAY_LOCK_SOURCE_TYPE = 'explore_like_display_lock_120';
const EXPLORE_LIKE_BATCH_MAX = 50;
const EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 20_000;
const EXPLORE_LIKE_SHARED_PUBLISH_LOCK_MS_120 = 90_000;

export const EXPLORE_LIKE_SYNC_EVENT = 'soridraw:explore-like-sync';
export const EXPLORE_LIKE_SYNC_ERROR_EVENT = 'soridraw:explore-like-sync-error';
// Retained only as a compatibility export for older callers. App 119 never emits it.
export const EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT = 'soridraw:explore-like-account-invalidation';

type ExploreLikePendingMutation = {
  trackId: string;
  ownerUid: string;
  baseLiked: boolean;
  desiredLiked: boolean;
  baseLikeCount: number;
  optimisticLikeCount: number;
  queuedAt: number;
  updatedAt: number;
  retryCount: number;
};

type ExploreLikeOutbox = Record<string, ExploreLikePendingMutation>;

type ExploreLikeDisplayLock = {
  liked: boolean;
  likeCount: number;
  updatedAt: number;
  protectUntil: number;
};

type ExploreLikeDisplayLocks = Record<string, ExploreLikeDisplayLock>;

type ExploreLikeBatchResult = {
  trackId: string;
  liked: boolean;
};

type ExploreLikeSyncEventDetail = {
  uid: string;
  trackId: string;
  ownerUid: string;
  liked: boolean;
  likeCount: number;
};

const likedStateByUid = new Map<string, Map<string, boolean>>();
const flushTimerByUid = new Map<string, number>();
const inflightByUid = new Map<string, Promise<void>>();

const clampLikeCount = (value: unknown) => {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
};

const readLikedStateStorage = (uid: string): Map<string, boolean> => {
  const values = new Map<string, boolean>();
  const envelope = readSoridrawPersistentCache<Record<string, boolean>>({
    cacheKey: EXPLORE_LIKE_CACHE_KEY,
    sourceType: EXPLORE_LIKE_SOURCE_TYPE,
    schemaVersion: EXPLORE_LIKE_CACHE_SCHEMA_VERSION,
    uid,
  });
  if (!envelope?.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) return values;
  Object.entries(envelope.data).forEach(([trackId, liked]) => {
    if (trackId && typeof liked === 'boolean') values.set(trackId, liked);
  });
  return values;
};

const persistLikedStateCache = (uid: string, cache: Map<string, boolean>) => {
  writeSoridrawPersistentCache<Record<string, boolean>>({
    cacheKey: EXPLORE_LIKE_CACHE_KEY,
    sourceType: EXPLORE_LIKE_SOURCE_TYPE,
    schemaVersion: EXPLORE_LIKE_CACHE_SCHEMA_VERSION,
    dataVersion: 120,
    uid,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: false,
    pendingMutationId: null,
    data: Object.fromEntries(cache),
  });
};

const getLikedStateCache = (uid: string) => {
  const normalizedUid = String(uid || '').trim();
  let cache = likedStateByUid.get(normalizedUid);
  if (!cache) {
    cache = readLikedStateStorage(normalizedUid);
    likedStateByUid.set(normalizedUid, cache);
  }
  return cache;
};

const normalizePendingMutation = (value: unknown): ExploreLikePendingMutation | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Partial<ExploreLikePendingMutation>;
  const trackId = String(row.trackId || '').trim();
  if (!trackId || typeof row.baseLiked !== 'boolean' || typeof row.desiredLiked !== 'boolean') return null;
  const updatedAt = Math.max(0, Number(row.updatedAt || 0));
  return {
    trackId,
    ownerUid: String(row.ownerUid || '').trim(),
    baseLiked: row.baseLiked,
    desiredLiked: row.desiredLiked,
    baseLikeCount: clampLikeCount(row.baseLikeCount),
    optimisticLikeCount: clampLikeCount(row.optimisticLikeCount),
    queuedAt: Math.max(0, Number(row.queuedAt || updatedAt)),
    updatedAt,
    retryCount: Math.max(0, Math.floor(Number(row.retryCount || 0))),
  };
};

const readLikeOutbox = (uid: string): ExploreLikeOutbox => {
  const envelope = readSoridrawPersistentCache<ExploreLikeOutbox>({
    cacheKey: EXPLORE_LIKE_OUTBOX_CACHE_KEY,
    sourceType: EXPLORE_LIKE_OUTBOX_SOURCE_TYPE,
    schemaVersion: EXPLORE_LIKE_OUTBOX_SCHEMA_VERSION,
    uid,
  });
  if (!envelope?.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) return {};
  return Object.entries(envelope.data).reduce<ExploreLikeOutbox>((acc, [trackId, value]) => {
    const normalized = normalizePendingMutation(value);
    if (normalized && normalized.trackId === trackId) acc[trackId] = normalized;
    return acc;
  }, {});
};

const persistLikeOutbox = (uid: string, outbox: ExploreLikeOutbox) => {
  if (!Object.keys(outbox).length) {
    removeSoridrawPersistentCache(EXPLORE_LIKE_OUTBOX_CACHE_KEY, uid);
    return;
  }
  writeSoridrawPersistentCache<ExploreLikeOutbox>({
    cacheKey: EXPLORE_LIKE_OUTBOX_CACHE_KEY,
    sourceType: EXPLORE_LIKE_OUTBOX_SOURCE_TYPE,
    schemaVersion: EXPLORE_LIKE_OUTBOX_SCHEMA_VERSION,
    dataVersion: 120,
    uid,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: true,
    pendingMutationId: 'explore-like-idle-batch-120',
    data: outbox,
  });
};

export const getPendingExploreLikeMutationCount = (uid: string): number => Object.keys(readLikeOutbox(uid)).length;

const normalizeDisplayLock = (value: unknown): ExploreLikeDisplayLock | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Partial<ExploreLikeDisplayLock>;
  if (typeof row.liked !== 'boolean') return null;
  const likeCount = clampLikeCount(row.likeCount);
  const updatedAt = Math.max(0, Number(row.updatedAt || 0));
  const protectUntil = Math.max(0, Number(row.protectUntil || 0));
  if (!updatedAt || !protectUntil) return null;
  return { liked: row.liked, likeCount, updatedAt, protectUntil };
};

const readLikeDisplayLocks = (uid: string): ExploreLikeDisplayLocks => {
  const envelope = readSoridrawPersistentCache<ExploreLikeDisplayLocks>({
    cacheKey: EXPLORE_LIKE_DISPLAY_LOCK_CACHE_KEY,
    sourceType: EXPLORE_LIKE_DISPLAY_LOCK_SOURCE_TYPE,
    schemaVersion: EXPLORE_LIKE_DISPLAY_LOCK_SCHEMA_VERSION,
    uid,
  });
  if (!envelope?.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) return {};
  return Object.entries(envelope.data).reduce<ExploreLikeDisplayLocks>((acc, [trackId, value]) => {
    const normalized = normalizeDisplayLock(value);
    if (trackId && normalized) acc[trackId] = normalized;
    return acc;
  }, {});
};

const persistLikeDisplayLocks = (uid: string, locks: ExploreLikeDisplayLocks) => {
  if (!Object.keys(locks).length) {
    removeSoridrawPersistentCache(EXPLORE_LIKE_DISPLAY_LOCK_CACHE_KEY, uid);
    return;
  }
  writeSoridrawPersistentCache<ExploreLikeDisplayLocks>({
    cacheKey: EXPLORE_LIKE_DISPLAY_LOCK_CACHE_KEY,
    sourceType: EXPLORE_LIKE_DISPLAY_LOCK_SOURCE_TYPE,
    schemaVersion: EXPLORE_LIKE_DISPLAY_LOCK_SCHEMA_VERSION,
    dataVersion: 120,
    uid,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: false,
    pendingMutationId: null,
    data: locks,
  });
};

// The current user's newest count always wins while the 20-second outbox is
// pending. After batch ACK, the same count stays protected briefly until a shared
// Feed/Profile payload reaches that exact count. This prevents old public cache
// responses from making the actor's number jump backward and forward.
export function overlayExploreLikeDisplayCounts<T extends { id: string; likeCount: number }>(
  uid: string,
  tracks: T[],
): T[] {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid || !tracks.length) return tracks;

  const outbox = readLikeOutbox(normalizedUid);
  const locks = readLikeDisplayLocks(normalizedUid);
  const now = Date.now();
  let locksChanged = false;

  const overlaid = tracks.map((track) => {
    const trackId = String(track.id || '').trim();
    if (!trackId) return track;

    const pending = outbox[trackId];
    if (pending) {
      const nextCount = pending.optimisticLikeCount;
      return nextCount === track.likeCount ? track : { ...track, likeCount: nextCount };
    }

    const lock = locks[trackId];
    if (!lock) return track;

    const sharedCount = clampLikeCount(track.likeCount);
    if (sharedCount === lock.likeCount || lock.protectUntil <= now) {
      delete locks[trackId];
      locksChanged = true;
      return track;
    }

    return lock.likeCount === track.likeCount ? track : { ...track, likeCount: lock.likeCount };
  });

  if (locksChanged) persistLikeDisplayLocks(normalizedUid, locks);
  return overlaid;
}

const dispatchLikeSync = (detail: ExploreLikeSyncEventDetail) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ExploreLikeSyncEventDetail>(EXPLORE_LIKE_SYNC_EVENT, { detail }));
};

const dispatchLikeSyncError = (detail: ExploreLikeSyncEventDetail & { message: string }) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EXPLORE_LIKE_SYNC_ERROR_EVENT, { detail }));
};

const buildAuthHeaders = async (user: User) => {
  const [idToken, appCheckToken] = await Promise.all([
    user.getIdToken(),
    getFirebaseAppCheckToken(),
  ]);
  if (!appCheckToken) {
    throw new Error('Explore 보안 인증을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
  return {
    Authorization: `Bearer ${idToken}`,
    'X-Firebase-AppCheck': appCheckToken,
  };
};

const requestExploreLike = async (user: User, path: string, init: RequestInit = {}) => {
  const authHeaders = await buildAuthHeaders(user);
  const response = await fetch(`${EXPLORE_API_BASE}${path}`, {
    ...init,
    headers: {
      ...authHeaders,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  recordCloudflareResponse(response, path);
  let payload: any = null;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const message = String(payload?.message || payload?.error?.message || payload?.error || '좋아요 요청을 처리하지 못했습니다.').trim();
    throw new Error(message || '좋아요 요청을 처리하지 못했습니다.');
  }
  return payload;
};

const normalizeBatchResults = (payload: unknown, expectedTrackIds: string[]): ExploreLikeBatchResult[] => {
  const body = payload && typeof payload === 'object' ? payload as { data?: { results?: unknown[] } } : null;
  const rows = Array.isArray(body?.data?.results) ? body!.data!.results! : [];
  const expected = new Set(expectedTrackIds);
  const results: ExploreLikeBatchResult[] = [];
  for (const value of rows) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const trackId = String(row.trackId || '').trim();
    if (!trackId || !expected.has(trackId) || typeof row.liked !== 'boolean') continue;
    results.push({ trackId, liked: row.liked });
  }
  if (results.length !== expected.size || new Set(results.map((result) => result.trackId)).size !== expected.size) {
    throw new Error('좋아요 묶음 응답을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
  return results;
};

const clearFlushTimer = (uid: string) => {
  const timer = flushTimerByUid.get(uid);
  if (timer !== undefined && typeof window !== 'undefined') window.clearTimeout(timer);
  flushTimerByUid.delete(uid);
};

const latestOutboxUpdatedAt = (outbox: ExploreLikeOutbox) => Object.values(outbox)
  .reduce((latest, pending) => Math.max(latest, pending.updatedAt || 0), 0);

let flushPendingLikes: (user: User) => Promise<void>;

const schedulePendingFlush = (user: User) => {
  const uid = String(user?.uid || '').trim();
  if (!uid || typeof window === 'undefined') return;
  const outbox = readLikeOutbox(uid);
  if (!Object.keys(outbox).length) {
    clearFlushTimer(uid);
    return;
  }
  clearFlushTimer(uid);
  const deadline = latestOutboxUpdatedAt(outbox) + EXPLORE_LIKE_IDLE_FLUSH_MS_120;
  const delay = Math.max(0, deadline - Date.now());
  const timer = window.setTimeout(() => {
    flushTimerByUid.delete(uid);
    void flushPendingLikes(user);
  }, delay);
  flushTimerByUid.set(uid, timer);
};

flushPendingLikes = async (user: User): Promise<void> => {
  const uid = String(user?.uid || '').trim();
  if (!uid || inflightByUid.has(uid)) return;

  const outbox = readLikeOutbox(uid);
  const ordered = Object.values(outbox)
    .sort((a, b) => (a.queuedAt || a.updatedAt) - (b.queuedAt || b.updatedAt))
    .slice(0, EXPLORE_LIKE_BATCH_MAX);

  if (!ordered.length) return;

  const noOps = ordered.filter((pending) => pending.desiredLiked === pending.baseLiked);
  if (noOps.length) {
    const latest = readLikeOutbox(uid);
    for (const pending of noOps) {
      const current = latest[pending.trackId];
      if (current?.updatedAt === pending.updatedAt) delete latest[pending.trackId];
    }
    persistLikeOutbox(uid, latest);
  }

  const batchEntries = ordered.filter((pending) => pending.desiredLiked !== pending.baseLiked);
  if (!batchEntries.length) {
    if (getPendingExploreLikeMutationCount(uid) > 0) schedulePendingFlush(user);
    return;
  }

  let succeeded = false;
  const task = (async () => {
    try {
      const payload = await requestExploreLike(user, '/v1/me/likes/batch', {
        method: 'POST',
        body: JSON.stringify({
          mutations: batchEntries.map((pending) => ({
            trackId: pending.trackId,
            liked: pending.desiredLiked,
            baseLiked: pending.baseLiked,
            mutationAt: pending.updatedAt,
          })),
        }),
      });
      const results = normalizeBatchResults(payload, batchEntries.map((pending) => pending.trackId));
      const resultByTrack = new Map(results.map((result) => [result.trackId, result]));
      const latest = readLikeOutbox(uid);
      const cache = getLikedStateCache(uid);
      const displayLocks = readLikeDisplayLocks(uid);
      const acknowledgedAt = Date.now();

      for (const pending of batchEntries) {
        const result = resultByTrack.get(pending.trackId);
        if (!result) continue;
        const current = latest[pending.trackId];
        const hasNewerPending = Boolean(current && current.updatedAt !== pending.updatedAt);
        if (!hasNewerPending) {
          cache.set(pending.trackId, result.liked);
          displayLocks[pending.trackId] = {
            liked: result.liked,
            likeCount: pending.optimisticLikeCount,
            updatedAt: acknowledgedAt,
            protectUntil: acknowledgedAt + EXPLORE_LIKE_SHARED_PUBLISH_LOCK_MS_120,
          };
          delete latest[pending.trackId];
          dispatchLikeSync({
            uid,
            trackId: pending.trackId,
            ownerUid: pending.ownerUid,
            liked: result.liked,
            likeCount: pending.optimisticLikeCount,
          });
        }
      }

      persistLikedStateCache(uid, cache);
      persistLikeDisplayLocks(uid, displayLocks);
      persistLikeOutbox(uid, latest);
      succeeded = true;
    } catch (reason) {
      const latest = readLikeOutbox(uid);
      const first = batchEntries[0];
      for (const pending of batchEntries) {
        const current = latest[pending.trackId];
        if (current?.updatedAt === pending.updatedAt) {
          current.retryCount = Math.min(8, current.retryCount + 1);
          latest[pending.trackId] = current;
        }
      }
      persistLikeOutbox(uid, latest);
      if (first) {
        dispatchLikeSyncError({
          uid,
          trackId: first.trackId,
          ownerUid: first.ownerUid,
          liked: first.desiredLiked,
          likeCount: first.optimisticLikeCount,
          message: reason instanceof Error
            ? reason.message
            : '좋아요 변경분을 최신 기기 캐시에 보관했습니다. 다음 조작 또는 재접속 때 다시 동기화합니다.',
        });
      }
    }
  })().finally(() => {
    inflightByUid.delete(uid);
    if (succeeded && getPendingExploreLikeMutationCount(uid) > 0) schedulePendingFlush(user);
  });

  inflightByUid.set(uid, task);
  await task;
};

// App 120 deliberately ignores historical RTDB Explore-like replay payloads.
// Personal heart state is recovered from the 120 cache, pending outbox, or one
// targeted canonical request for missing visible track IDs.
export const observeExploreLikeAccountSyncSignal = (_user: User, _value: unknown) => {};

export const flushPendingExploreLikesForPageExit = async (user: User): Promise<void> => {
  // Page/profile navigation must not cut short the 20-second idle window.
  // The module-level timer survives route changes; the durable 120 outbox survives reloads.
  schedulePendingFlush(user);
};

export const getExploreLikedTrackIds = async (user: User, trackIds: string[]): Promise<string[]> => {
  const normalized = [...new Set(
    trackIds.map((trackId) => String(trackId || '').trim()).filter(Boolean),
  )].slice(0, EXPLORE_LIKE_BATCH_MAX);
  if (!normalized.length) return [];

  const cache = getLikedStateCache(user.uid);
  const missing = normalized.filter((trackId) => !cache.has(trackId));
  if (missing.length) {
    const query = new URLSearchParams({ trackIds: missing.join(',') });
    const payload = await requestExploreLike(user, `/v1/me/likes?${query.toString()}`);
    const likedIds = new Set(
      Array.isArray(payload?.data?.likedTrackIds)
        ? payload.data.likedTrackIds.map((trackId: unknown) => String(trackId || '').trim()).filter(Boolean)
        : [],
    );
    missing.forEach((trackId) => cache.set(trackId, likedIds.has(trackId)));
    persistLikedStateCache(user.uid, cache);
  }

  const outbox = readLikeOutbox(user.uid);
  if (Object.keys(outbox).length) schedulePendingFlush(user);

  return normalized.filter((trackId) => outbox[trackId]?.desiredLiked ?? cache.get(trackId) === true);
};

export const reconcileExploreLikedTrackCollectionState = (
  uid: string,
  canonicalLikedTrackIds: string[],
): string[] => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return [];

  const canonical = new Set(
    canonicalLikedTrackIds.map((trackId) => String(trackId || '').trim()).filter(Boolean),
  );
  const cache = getLikedStateCache(normalizedUid);
  const outbox = readLikeOutbox(normalizedUid);
  const scope = new Set<string>([
    ...cache.keys(),
    ...canonical,
    ...Object.keys(outbox),
  ]);
  const effectiveLikedTrackIds: string[] = [];
  let changed = false;

  for (const trackId of scope) {
    const pending = outbox[trackId];
    const nextLiked = pending ? pending.desiredLiked : canonical.has(trackId);
    if (cache.get(trackId) !== nextLiked) {
      cache.set(trackId, nextLiked);
      changed = true;
    }
    if (nextLiked) effectiveLikedTrackIds.push(trackId);
  }

  if (changed) persistLikedStateCache(normalizedUid, cache);
  return effectiveLikedTrackIds;
};

export const setExploreTrackLike = async (
  user: User,
  trackId: string,
  liked: boolean,
  currentLikeCount = 0,
  ownerUid = '',
): Promise<{ trackId: string; liked: boolean; likeCount: number }> => {
  const normalizedTrackId = String(trackId || '').trim();
  if (!normalizedTrackId) throw new Error('Explore 곡 ID를 확인하지 못했습니다.');

  const uid = user.uid;
  const outbox = readLikeOutbox(uid);
  const existing = outbox[normalizedTrackId];
  const cache = getLikedStateCache(uid);
  const previousVisibleLiked = existing?.desiredLiked ?? cache.get(normalizedTrackId) ?? !liked;
  const baseLiked = existing?.baseLiked ?? previousVisibleLiked;
  const baseLikeCount = existing?.baseLikeCount ?? clampLikeCount(currentLikeCount);
  const optimisticLikeCount = clampLikeCount(
    baseLikeCount + (liked ? 1 : 0) - (baseLiked ? 1 : 0),
  );
  const now = Date.now();

  cache.set(normalizedTrackId, liked);
  persistLikedStateCache(uid, cache);

  outbox[normalizedTrackId] = {
    trackId: normalizedTrackId,
    ownerUid: String(ownerUid || existing?.ownerUid || '').trim(),
    baseLiked,
    desiredLiked: liked,
    baseLikeCount,
    optimisticLikeCount,
    queuedAt: existing?.queuedAt || now,
    updatedAt: now,
    retryCount: 0,
  };
  persistLikeOutbox(uid, outbox);

  // Sliding idle window: every click restarts the same 20-second timer. One song
  // or many songs therefore leave as one final-state batch after the last click.
  schedulePendingFlush(user);

  dispatchLikeSync({
    uid,
    trackId: normalizedTrackId,
    ownerUid: String(ownerUid || existing?.ownerUid || '').trim(),
    liked,
    likeCount: optimisticLikeCount,
  });

  return { trackId: normalizedTrackId, liked, likeCount: optimisticLikeCount };
};

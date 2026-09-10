import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import type { User } from 'firebase/auth';
import { getFirebaseAppCheckToken } from '../firebase';
import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';
import {
  readSoridrawPersistentCache,
  removeSoridrawPersistentCache,
  writeSoridrawPersistentCache,
} from '../lib/soridrawPersistentCache';

// SORIDRAW_LONG_TERM_CACHE_STAGE_2_3_990
// SORIDRAW_EXPLORE_LIKE_BATCH_034_20260911
const EXPLORE_LIKE_CACHE_SCHEMA_VERSION = 1;
const EXPLORE_LIKE_CACHE_KEY = 'explore-liked-state';
const EXPLORE_LIKE_SOURCE_TYPE = 'explore_likes';
const EXPLORE_LIKE_OUTBOX_SCHEMA_VERSION = 1;
const EXPLORE_LIKE_OUTBOX_CACHE_KEY = 'explore-like-outbox';
const EXPLORE_LIKE_OUTBOX_SOURCE_TYPE = 'explore_like_outbox';
const EXPLORE_LIKE_BATCH_WINDOW_MS = 4 * 60_000;
const EXPLORE_LIKE_BATCH_MAX = 50;
const EXPLORE_LIKE_RETRY_BASE_MS = 15_000;
const EXPLORE_LIKE_RETRY_MAX_MS = 60_000;

export const EXPLORE_LIKE_SYNC_EVENT = 'soridraw:explore-like-sync';
export const EXPLORE_LIKE_SYNC_ERROR_EVENT = 'soridraw:explore-like-sync-error';

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

type ExploreLikeSyncEventDetail = {
  trackId: string;
  ownerUid: string;
  liked: boolean;
  likeCount: number;
};

type ExploreLikeBatchResult = {
  trackId: string;
  liked: boolean;
  likeCount: number;
};

const likedStateByUid = new Map<string, Map<string, boolean>>();
const pendingTimers = new Map<string, number>();
const inflightByUid = new Map<string, ExploreLikeOutbox>();

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
    dataVersion: 0,
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
    dataVersion: 0,
    uid,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: true,
    pendingMutationId: 'explore-like-pending',
    data: outbox,
  });
};

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

const readPayload = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
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
  const payload = await readPayload(response);

  if (!response.ok) {
    const message = String(payload?.message || payload?.error?.message || payload?.error || '좋아요 요청을 처리하지 못했습니다.').trim();
    throw new Error(message || '좋아요 요청을 처리하지 못했습니다.');
  }

  return payload;
};

const getInflightMutation = (uid: string, trackId: string) => inflightByUid.get(uid)?.[trackId];

const clearPendingLikeTimer = (uid: string) => {
  const timer = pendingTimers.get(uid);
  if (timer && typeof window !== 'undefined') window.clearTimeout(timer);
  pendingTimers.delete(uid);
};

const oldestPendingQueuedAt = (outbox: ExploreLikeOutbox) => {
  const values = Object.values(outbox);
  if (!values.length) return null;
  return Math.min(...values.map((pending) => pending.queuedAt || pending.updatedAt || Date.now()));
};

const schedulePendingLikes = (user: User, delayMs?: number, replace = false) => {
  if (typeof window === 'undefined') return;
  const uid = user.uid;
  if (!replace && pendingTimers.has(uid)) return;
  if (replace) clearPendingLikeTimer(uid);

  const outbox = readLikeOutbox(uid);
  if (!Object.keys(outbox).length) return;
  const queuedAt = oldestPendingQueuedAt(outbox) ?? Date.now();
  const remaining = delayMs ?? Math.max(0, EXPLORE_LIKE_BATCH_WINDOW_MS - (Date.now() - queuedAt));
  const timer = window.setTimeout(() => {
    pendingTimers.delete(uid);
    void flushPendingLikes(user);
  }, Math.max(0, remaining));
  pendingTimers.set(uid, timer);
};

const normalizeBatchResults = (payload: unknown, expectedTrackIds: string[]): ExploreLikeBatchResult[] => {
  const body = payload && typeof payload === 'object' ? payload as { data?: { results?: unknown[] } } : null;
  const rows = Array.isArray(body?.data?.results) ? body.data.results : [];
  const expected = new Set(expectedTrackIds);
  const results: ExploreLikeBatchResult[] = [];
  for (const value of rows) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const trackId = String(row.trackId || '').trim();
    if (!trackId || !expected.has(trackId)) continue;
    results.push({
      trackId,
      liked: Boolean(row.liked),
      likeCount: clampLikeCount(row.likeCount),
    });
  }
  if (results.length !== expected.size || new Set(results.map((result) => result.trackId)).size !== expected.size) {
    throw new Error('좋아요 묶음 응답을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
  return results;
};

const flushPendingLikes = async (user: User): Promise<void> => {
  const uid = user.uid;
  if (inflightByUid.has(uid)) return;

  const outbox = readLikeOutbox(uid);
  let changed = false;
  for (const [trackId, pending] of Object.entries(outbox)) {
    if (pending.desiredLiked !== pending.baseLiked) continue;
    delete outbox[trackId];
    changed = true;
  }
  if (changed) persistLikeOutbox(uid, outbox);

  const batchEntries = Object.values(outbox)
    .sort((a, b) => (a.queuedAt || a.updatedAt) - (b.queuedAt || b.updatedAt))
    .slice(0, EXPLORE_LIKE_BATCH_MAX);
  if (!batchEntries.length) {
    clearPendingLikeTimer(uid);
    return;
  }

  const snapshot = Object.fromEntries(batchEntries.map((pending) => [pending.trackId, { ...pending }])) as ExploreLikeOutbox;
  inflightByUid.set(uid, snapshot);

  try {
    const payload = await requestExploreLike(user, '/v1/me/likes/batch', {
      method: 'POST',
      body: JSON.stringify({
        mutations: batchEntries.map((pending) => ({
          trackId: pending.trackId,
          liked: pending.desiredLiked,
        })),
      }),
    });
    const results = normalizeBatchResults(payload, batchEntries.map((pending) => pending.trackId));
    const resultByTrack = new Map(results.map((result) => [result.trackId, result]));
    const confirmedCache = getLikedStateCache(uid);
    const latestOutbox = readLikeOutbox(uid);

    for (const pending of batchEntries) {
      const result = resultByTrack.get(pending.trackId);
      if (!result) continue;
      confirmedCache.set(result.trackId, result.liked);

      const latest = latestOutbox[pending.trackId];
      let visibleLiked = result.liked;
      let visibleLikeCount = result.likeCount;
      let ownerUid = pending.ownerUid;

      if (latest && latest.updatedAt !== pending.updatedAt) {
        ownerUid = latest.ownerUid || ownerUid;
        latest.baseLiked = result.liked;
        latest.baseLikeCount = result.likeCount;
        latest.retryCount = 0;
        if (latest.desiredLiked === result.liked) {
          delete latestOutbox[pending.trackId];
        } else {
          visibleLiked = latest.desiredLiked;
          visibleLikeCount = Math.max(0, result.likeCount + (visibleLiked ? 1 : -1));
          latest.optimisticLikeCount = visibleLikeCount;
          latestOutbox[pending.trackId] = latest;
        }
      } else {
        delete latestOutbox[pending.trackId];
      }

      dispatchLikeSync({
        trackId: result.trackId,
        ownerUid,
        liked: visibleLiked,
        likeCount: visibleLikeCount,
      });
    }

    persistLikedStateCache(uid, confirmedCache);
    persistLikeOutbox(uid, latestOutbox);
    if (Object.keys(latestOutbox).length) schedulePendingLikes(user, undefined, true);
  } catch (reason) {
    const latestOutbox = readLikeOutbox(uid);
    let maxRetryCount = 0;
    let firstPending: ExploreLikePendingMutation | null = null;
    for (const pending of batchEntries) {
      const latest = latestOutbox[pending.trackId] || pending;
      if (latest.updatedAt === pending.updatedAt) {
        latest.retryCount = Math.min(8, latest.retryCount + 1);
        latest.updatedAt = Date.now();
        latestOutbox[pending.trackId] = latest;
      }
      maxRetryCount = Math.max(maxRetryCount, latest.retryCount);
      firstPending ||= latest;
    }
    persistLikeOutbox(uid, latestOutbox);
    const retryDelay = Math.min(
      EXPLORE_LIKE_RETRY_MAX_MS,
      EXPLORE_LIKE_RETRY_BASE_MS * (2 ** Math.max(0, maxRetryCount - 1)),
    );
    schedulePendingLikes(user, retryDelay, true);
    if (firstPending) {
      dispatchLikeSyncError({
        trackId: firstPending.trackId,
        ownerUid: firstPending.ownerUid,
        liked: firstPending.desiredLiked,
        likeCount: firstPending.optimisticLikeCount,
        message: reason instanceof Error ? reason.message : '좋아요 서버 동기화를 재시도하고 있어요.',
      });
    }
  } finally {
    inflightByUid.delete(uid);
  }
};

const resumePendingLikes = (user: User) => {
  const outbox = readLikeOutbox(user.uid);
  if (!Object.keys(outbox).length) {
    clearPendingLikeTimer(user.uid);
    return;
  }
  schedulePendingLikes(user);
};

export const getExploreLikedTrackIds = async (user: User, trackIds: string[]): Promise<string[]> => {
  const normalized = [...new Set(trackIds.map((trackId) => String(trackId || '').trim()).filter(Boolean))].slice(0, 50);
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
  resumePendingLikes(user);
  return normalized.filter((trackId) => outbox[trackId]?.desiredLiked ?? cache.get(trackId) === true);
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

  const outbox = readLikeOutbox(user.uid);
  const existing = outbox[normalizedTrackId];
  const inflight = getInflightMutation(user.uid, normalizedTrackId);
  const previousVisibleLiked = !liked;
  const baselineLiked = inflight?.desiredLiked ?? existing?.baseLiked ?? previousVisibleLiked;
  const baselineLikeCount = inflight?.optimisticLikeCount ?? existing?.baseLikeCount ?? clampLikeCount(currentLikeCount);
  const optimisticLikeCount = Math.max(0, clampLikeCount(currentLikeCount) + (liked ? 1 : -1));

  if (!inflight && liked === baselineLiked) {
    delete outbox[normalizedTrackId];
    persistLikeOutbox(user.uid, outbox);
    if (!Object.keys(outbox).length) clearPendingLikeTimer(user.uid);
    return { trackId: normalizedTrackId, liked, likeCount: optimisticLikeCount };
  }

  const now = Date.now();
  outbox[normalizedTrackId] = {
    trackId: normalizedTrackId,
    ownerUid: String(ownerUid || existing?.ownerUid || inflight?.ownerUid || '').trim(),
    baseLiked: baselineLiked,
    desiredLiked: liked,
    baseLikeCount: baselineLikeCount,
    optimisticLikeCount,
    queuedAt: existing?.queuedAt || now,
    updatedAt: now,
    retryCount: 0,
  };
  persistLikeOutbox(user.uid, outbox);
  schedulePendingLikes(user);
  return { trackId: normalizedTrackId, liked, likeCount: optimisticLikeCount };
};

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
// SORIDRAW_EXPLORE_LIKE_DEBOUNCE_033_20260910
const EXPLORE_LIKE_CACHE_SCHEMA_VERSION = 1;
const EXPLORE_LIKE_CACHE_KEY = 'explore-liked-state';
const EXPLORE_LIKE_SOURCE_TYPE = 'explore_likes';
const EXPLORE_LIKE_OUTBOX_SCHEMA_VERSION = 1;
const EXPLORE_LIKE_OUTBOX_CACHE_KEY = 'explore-like-outbox';
const EXPLORE_LIKE_OUTBOX_SOURCE_TYPE = 'explore_like_outbox';
const EXPLORE_LIKE_IDLE_MS = 5_000;
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

const likedStateByUid = new Map<string, Map<string, boolean>>();
const pendingTimers = new Map<string, number>();
const inflightByKey = new Map<string, ExploreLikePendingMutation>();

const mutationKey = (uid: string, trackId: string) => `${uid}:${trackId}`;
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
  return {
    trackId,
    ownerUid: String(row.ownerUid || '').trim(),
    baseLiked: row.baseLiked,
    desiredLiked: row.desiredLiked,
    baseLikeCount: clampLikeCount(row.baseLikeCount),
    optimisticLikeCount: clampLikeCount(row.optimisticLikeCount),
    updatedAt: Math.max(0, Number(row.updatedAt || 0)),
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

const schedulePendingLike = (user: User, trackId: string, delayMs = EXPLORE_LIKE_IDLE_MS) => {
  if (typeof window === 'undefined') return;
  const key = mutationKey(user.uid, trackId);
  const previous = pendingTimers.get(key);
  if (previous) window.clearTimeout(previous);
  const timer = window.setTimeout(() => {
    pendingTimers.delete(key);
    void flushPendingLike(user, trackId);
  }, Math.max(0, delayMs));
  pendingTimers.set(key, timer);
};

const removePendingLike = (uid: string, trackId: string) => {
  const outbox = readLikeOutbox(uid);
  if (!outbox[trackId]) return;
  delete outbox[trackId];
  persistLikeOutbox(uid, outbox);
};

const flushPendingLike = async (user: User, trackId: string): Promise<void> => {
  const key = mutationKey(user.uid, trackId);
  if (inflightByKey.has(key)) return;
  const outbox = readLikeOutbox(user.uid);
  const pending = outbox[trackId];
  if (!pending) return;
  if (pending.desiredLiked === pending.baseLiked) {
    removePendingLike(user.uid, trackId);
    return;
  }

  inflightByKey.set(key, pending);
  try {
    const payload = await requestExploreLike(
      user,
      `/v1/tracks/${encodeURIComponent(trackId)}/like`,
      { method: pending.desiredLiked ? 'PUT' : 'DELETE' },
    );
    const result = {
      trackId: String(payload?.data?.trackId || trackId).trim(),
      liked: Boolean(payload?.data?.liked),
      likeCount: clampLikeCount(payload?.data?.likeCount),
    };
    const confirmedCache = getLikedStateCache(user.uid);
    confirmedCache.set(result.trackId, result.liked);
    persistLikedStateCache(user.uid, confirmedCache);

    const latestOutbox = readLikeOutbox(user.uid);
    const latest = latestOutbox[trackId];
    let visibleLiked = result.liked;
    let visibleLikeCount = result.likeCount;
    let ownerUid = pending.ownerUid;

    if (latest && latest.updatedAt !== pending.updatedAt) {
      ownerUid = latest.ownerUid || ownerUid;
      latest.baseLiked = result.liked;
      latest.baseLikeCount = result.likeCount;
      latest.retryCount = 0;
      if (latest.desiredLiked === result.liked) {
        delete latestOutbox[trackId];
      } else {
        visibleLiked = latest.desiredLiked;
        visibleLikeCount = Math.max(0, result.likeCount + (visibleLiked ? 1 : -1));
        latest.optimisticLikeCount = visibleLikeCount;
        latestOutbox[trackId] = latest;
      }
      persistLikeOutbox(user.uid, latestOutbox);
      if (latestOutbox[trackId]) {
        const remaining = Math.max(0, EXPLORE_LIKE_IDLE_MS - (Date.now() - latest.updatedAt));
        schedulePendingLike(user, trackId, remaining);
      }
    } else {
      delete latestOutbox[trackId];
      persistLikeOutbox(user.uid, latestOutbox);
    }

    dispatchLikeSync({
      trackId: result.trackId,
      ownerUid,
      liked: visibleLiked,
      likeCount: visibleLikeCount,
    });
  } catch (reason) {
    const latestOutbox = readLikeOutbox(user.uid);
    const latest = latestOutbox[trackId] || pending;
    latest.retryCount = Math.min(8, latest.retryCount + 1);
    latest.updatedAt = Date.now();
    latestOutbox[trackId] = latest;
    persistLikeOutbox(user.uid, latestOutbox);
    const retryDelay = Math.min(EXPLORE_LIKE_RETRY_MAX_MS, EXPLORE_LIKE_RETRY_BASE_MS * (2 ** Math.max(0, latest.retryCount - 1)));
    schedulePendingLike(user, trackId, retryDelay);
    dispatchLikeSyncError({
      trackId,
      ownerUid: latest.ownerUid,
      liked: latest.desiredLiked,
      likeCount: latest.optimisticLikeCount,
      message: reason instanceof Error ? reason.message : '좋아요 서버 동기화를 재시도하고 있어요.',
    });
  } finally {
    inflightByKey.delete(key);
  }
};

const resumePendingLikes = (user: User) => {
  const outbox = readLikeOutbox(user.uid);
  Object.values(outbox).forEach((pending) => {
    const remaining = Math.max(0, EXPLORE_LIKE_IDLE_MS - (Date.now() - pending.updatedAt));
    schedulePendingLike(user, pending.trackId, remaining);
  });
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

  const key = mutationKey(user.uid, normalizedTrackId);
  const outbox = readLikeOutbox(user.uid);
  const existing = outbox[normalizedTrackId];
  const inflight = inflightByKey.get(key);
  const previousVisibleLiked = !liked;
  const baselineLiked = inflight?.desiredLiked ?? existing?.baseLiked ?? previousVisibleLiked;
  const baselineLikeCount = inflight?.optimisticLikeCount ?? existing?.baseLikeCount ?? clampLikeCount(currentLikeCount);
  const optimisticLikeCount = Math.max(0, clampLikeCount(currentLikeCount) + (liked ? 1 : -1));

  if (!inflight && liked === baselineLiked) {
    delete outbox[normalizedTrackId];
    persistLikeOutbox(user.uid, outbox);
    const previousTimer = pendingTimers.get(key);
    if (previousTimer && typeof window !== 'undefined') window.clearTimeout(previousTimer);
    pendingTimers.delete(key);
    return { trackId: normalizedTrackId, liked, likeCount: optimisticLikeCount };
  }

  outbox[normalizedTrackId] = {
    trackId: normalizedTrackId,
    ownerUid: String(ownerUid || existing?.ownerUid || inflight?.ownerUid || '').trim(),
    baseLiked: baselineLiked,
    desiredLiked: liked,
    baseLikeCount: baselineLikeCount,
    optimisticLikeCount,
    updatedAt: Date.now(),
    retryCount: 0,
  };
  persistLikeOutbox(user.uid, outbox);
  schedulePendingLike(user, normalizedTrackId, EXPLORE_LIKE_IDLE_MS);
  return { trackId: normalizedTrackId, liked, likeCount: optimisticLikeCount };
};

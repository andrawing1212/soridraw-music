import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import type { User } from 'firebase/auth';
import { getFirebaseAppCheckToken } from '../firebase';
import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';
import { readSoridrawPersistentCache, writeSoridrawPersistentCache } from '../lib/soridrawPersistentCache';



// SORIDRAW_LONG_TERM_CACHE_STAGE_2_3_990
const EXPLORE_LIKE_CACHE_SCHEMA_VERSION = 1;
const EXPLORE_LIKE_CACHE_KEY = 'explore-liked-state';
const EXPLORE_LIKE_SOURCE_TYPE = 'explore_likes';
const likedStateByUid = new Map<string, Map<string, boolean>>();

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

  return normalized.filter((trackId) => cache.get(trackId) === true);
};

export const setExploreTrackLike = async (
  user: User,
  trackId: string,
  liked: boolean,
): Promise<{ trackId: string; liked: boolean; likeCount: number }> => {
  const normalizedTrackId = String(trackId || '').trim();
  if (!normalizedTrackId) throw new Error('Explore 곡 ID를 확인하지 못했습니다.');

  const payload = await requestExploreLike(
    user,
    `/v1/tracks/${encodeURIComponent(normalizedTrackId)}/like`,
    { method: liked ? 'PUT' : 'DELETE' },
  );

  const result = {
    trackId: String(payload?.data?.trackId || normalizedTrackId).trim(),
    liked: Boolean(payload?.data?.liked),
    likeCount: Number(payload?.data?.likeCount || 0),
  };
  const cache = getLikedStateCache(user.uid);
  cache.set(result.trackId, result.liked);
  persistLikedStateCache(user.uid, cache);
  return result;
};

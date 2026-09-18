import type { User } from 'firebase/auth';
import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import { getFirebaseAppCheckToken } from '../firebase';
import { recordCloudflareLocalCacheHit, recordCloudflareResponse } from '../lib/cloudflareDiagnostics';
import {
  readSoridrawPersistentCache,
  writeSoridrawPersistentCache,
} from '../lib/soridrawPersistentCache';

// SORIDRAW_EXPLORE_LIKED_TRACK_COLLECTION_085_20260914
// SORIDRAW_EXPLORE_LIKED_TRACK_CANONICAL_REPAIR_086_20260914
// SORIDRAW_EXPLORE_LIKED_CARD_CONSISTENCY_087_20260914
// SORIDRAW_EXPLORE_SHARED_DISPLAY_COUNT_091_20260915
// SORIDRAW_EXPLORE_LIKED_CARD_RETENTION_100_20260916
// SORIDRAW_EXPLORE_LIKED_TRACK_LATEST_CACHE_119_20260918
const LIKED_TRACK_CACHE_SCHEMA_VERSION = 119;
const LIKED_TRACK_CACHE_KEY = 'explore-liked-track-collection-119';
const LIKED_TRACK_CACHE_SOURCE_TYPE = 'explore_liked_track_collection_119';
const LIKED_TRACK_ROUTE = '/v1/me/liked-tracks';
const LIKED_TRACK_BATCH_MAX = 200;
const LIKED_TRACK_DORMANT_CARD_MAX = 100;
const LIKED_TRACK_DORMANT_CARD_TTL_MS = 7 * 24 * 60 * 60_000;

type LikedTrackCacheData = {
  items: Record<string, Record<string, unknown>>;
  unavailable: Record<string, boolean>;
  canonicalLikedTrackIds: string[] | null;
  dormantSince: Record<string, number>;
};

type LikedTrackResponse = {
  ok?: boolean;
  data?: {
    likedTrackIds?: string[];
    items?: Array<Record<string, unknown>>;
    unavailableTrackIds?: string[];
  };
};

const normalizeId = (value: unknown) => String(value || '').trim();
const normalizeIds = (value: unknown) => [
  ...new Set((Array.isArray(value) ? value : []).map(normalizeId).filter(Boolean)),
];

const normalizeCache = (value: unknown): LikedTrackCacheData => {
  const row = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const rawItems = row.items && typeof row.items === 'object' && !Array.isArray(row.items)
    ? row.items as Record<string, unknown>
    : {};
  const items: Record<string, Record<string, unknown>> = {};
  for (const [trackId, item] of Object.entries(rawItems)) {
    const id = normalizeId(trackId);
    if (!id || !item || typeof item !== 'object' || Array.isArray(item)) continue;
    const normalized = item as Record<string, unknown>;
    if (normalizeId(normalized.id) !== id) continue;
    items[id] = normalized;
  }

  const rawUnavailable = row.unavailable && typeof row.unavailable === 'object' && !Array.isArray(row.unavailable)
    ? row.unavailable as Record<string, unknown>
    : {};
  const unavailable: Record<string, boolean> = {};
  for (const [trackId, state] of Object.entries(rawUnavailable)) {
    const id = normalizeId(trackId);
    if (id && state === true) unavailable[id] = true;
  }

  const rawDormantSince = row.dormantSince && typeof row.dormantSince === 'object' && !Array.isArray(row.dormantSince)
    ? row.dormantSince as Record<string, unknown>
    : {};
  const dormantSince: Record<string, number> = {};
  for (const [trackId, value] of Object.entries(rawDormantSince)) {
    const id = normalizeId(trackId);
    const at = Math.max(0, Number(value || 0));
    if (id && items[id] && Number.isFinite(at) && at > 0) dormantSince[id] = at;
  }

  const canonicalLikedTrackIds = Array.isArray(row.canonicalLikedTrackIds)
    ? normalizeIds(row.canonicalLikedTrackIds)
    : null;
  return { items, unavailable, canonicalLikedTrackIds, dormantSince };
};

const trimDormantCards = (data: LikedTrackCacheData) => {
  if (data.canonicalLikedTrackIds === null) return;
  const liked = new Set(normalizeIds(data.canonicalLikedTrackIds));
  const now = Date.now();

  for (const trackId of liked) delete data.dormantSince[trackId];

  const dormant = Object.keys(data.items)
    .filter((trackId) => !liked.has(trackId))
    .map((trackId) => ({ trackId, at: Math.max(0, Number(data.dormantSince[trackId] || 0)) }))
    .filter(({ at }) => at > 0 && now - at <= LIKED_TRACK_DORMANT_CARD_TTL_MS)
    .sort((a, b) => b.at - a.at);
  const keep = new Set(dormant.slice(0, LIKED_TRACK_DORMANT_CARD_MAX).map(({ trackId }) => trackId));

  for (const trackId of Object.keys(data.items)) {
    if (liked.has(trackId) || keep.has(trackId)) continue;
    delete data.items[trackId];
    delete data.dormantSince[trackId];
  }
  for (const trackId of Object.keys(data.dormantSince)) {
    if (!data.items[trackId] || liked.has(trackId)) delete data.dormantSince[trackId];
  }
};

const readCache = (uid: string): LikedTrackCacheData => {
  const envelope = readSoridrawPersistentCache<LikedTrackCacheData>({
    cacheKey: LIKED_TRACK_CACHE_KEY,
    sourceType: LIKED_TRACK_CACHE_SOURCE_TYPE,
    schemaVersion: LIKED_TRACK_CACHE_SCHEMA_VERSION,
    uid,
  });
  return normalizeCache(envelope?.data);
};

const writeCache = (uid: string, data: LikedTrackCacheData) => {
  trimDormantCards(data);
  writeSoridrawPersistentCache<LikedTrackCacheData>({
    cacheKey: LIKED_TRACK_CACHE_KEY,
    sourceType: LIKED_TRACK_CACHE_SOURCE_TYPE,
    schemaVersion: LIKED_TRACK_CACHE_SCHEMA_VERSION,
    dataVersion: 0,
    uid,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: false,
    pendingMutationId: null,
    data: normalizeCache(data),
  });
};

const buildAuthHeaders = async (user: User) => {
  const [idToken, appCheckToken] = await Promise.all([
    user.getIdToken(),
    getFirebaseAppCheckToken(),
  ]);
  if (!appCheckToken) throw new Error('Explore 보안 인증을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');
  return {
    Authorization: `Bearer ${idToken}`,
    'X-Firebase-AppCheck': appCheckToken,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
};

const requestLikedTracks = async (user: User, trackIds: string[]) => {
  const headers = await buildAuthHeaders(user);
  const response = await fetch(`${EXPLORE_API_BASE}${LIKED_TRACK_ROUTE}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ trackIds }),
  });
  recordCloudflareResponse(response, LIKED_TRACK_ROUTE);
  let payload: LikedTrackResponse | null = null;
  try { payload = await response.json() as LikedTrackResponse; } catch { payload = null; }
  if (!response.ok) {
    const fallback = response.status === 401 ? '로그인 상태를 다시 확인해주세요.' : '좋아요 곡을 불러오지 못했습니다.';
    throw new Error(fallback);
  }
  const canonicalLikedTrackIds = Array.isArray(payload?.data?.likedTrackIds)
    ? normalizeIds(payload?.data?.likedTrackIds)
    : null;
  const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
  const unavailableTrackIds = Array.isArray(payload?.data?.unavailableTrackIds)
    ? payload!.data!.unavailableTrackIds!.map(normalizeId).filter(Boolean)
    : [];
  return { canonicalLikedTrackIds, items, unavailableTrackIds };
};

export const patchExploreLikedTrackMembership = (uid: string, trackId: string, liked: boolean) => {
  const normalizedUid = normalizeId(uid);
  const normalizedTrackId = normalizeId(trackId);
  if (!normalizedUid || !normalizedTrackId) return;
  const cache = readCache(normalizedUid);
  if (cache.canonicalLikedTrackIds) {
    const next = new Set(cache.canonicalLikedTrackIds);
    if (liked) next.add(normalizedTrackId); else next.delete(normalizedTrackId);
    cache.canonicalLikedTrackIds = [...next];
  }
  if (liked) {
    delete cache.dormantSince[normalizedTrackId];
    delete cache.unavailable[normalizedTrackId];
  } else {
    if (cache.items[normalizedTrackId]) cache.dormantSince[normalizedTrackId] = Date.now();
    delete cache.unavailable[normalizedTrackId];
  }
  writeCache(normalizedUid, cache);
};

export const invalidateExploreLikedTrackCollection = (uid: string) => {
  const normalizedUid = normalizeId(uid);
  if (!normalizedUid) return;
  const cache = readCache(normalizedUid);
  cache.canonicalLikedTrackIds = null;
  cache.unavailable = {};
  writeCache(normalizedUid, cache);
};

export const rememberExploreLikedTrack = (
  uid: string,
  track: Record<string, unknown> | null,
  liked: boolean,
) => {
  const normalizedUid = normalizeId(uid);
  const trackId = normalizeId(track?.id);
  if (!normalizedUid || !trackId) return;
  const cache = readCache(normalizedUid);
  if (cache.canonicalLikedTrackIds) {
    const next = new Set(cache.canonicalLikedTrackIds);
    if (liked) next.add(trackId); else next.delete(trackId);
    cache.canonicalLikedTrackIds = [...next];
  }
  cache.items[trackId] = { ...(track || {}), id: trackId };
  if (liked) delete cache.dormantSince[trackId];
  else cache.dormantSince[trackId] = Date.now();
  delete cache.unavailable[trackId];
  writeCache(normalizedUid, cache);
};

export const patchExploreLikedTrackCachedCount091 = (
  uid: string,
  trackId: string,
  likeCount: number,
) => {
  const normalizedUid = normalizeId(uid);
  const normalizedTrackId = normalizeId(trackId);
  if (!normalizedUid || !normalizedTrackId) return;
  const cache = readCache(normalizedUid);
  const item = cache.items[normalizedTrackId];
  if (!item) return;
  const normalizedCount = Math.max(0, Math.floor(Number(likeCount || 0)));
  if (Number(item.likeCount || 0) === normalizedCount) return;
  cache.items[normalizedTrackId] = { ...item, likeCount: normalizedCount };
  writeCache(normalizedUid, cache);
};

export const getExploreLikedTrackCollectionIds = (uid: string): string[] | null => {
  const normalizedUid = normalizeId(uid);
  if (!normalizedUid) return null;
  const cache = readCache(normalizedUid);
  return cache.canonicalLikedTrackIds === null ? null : normalizeIds(cache.canonicalLikedTrackIds);
};

export const getExploreLikedTracks = async (user: User): Promise<Array<Record<string, unknown>>> => {
  const cache = readCache(user.uid);
  const hadCanonicalCache = cache.canonicalLikedTrackIds !== null;

  if (cache.canonicalLikedTrackIds === null) {
    const verification = await requestLikedTracks(user, []);
    if (verification.canonicalLikedTrackIds === null) {
      throw new Error('좋아요 곡 상태를 확인하지 못했습니다.');
    }
    cache.canonicalLikedTrackIds = verification.canonicalLikedTrackIds;
  }

  const likedTrackIds = normalizeIds(cache.canonicalLikedTrackIds);
  if (!likedTrackIds.length) {
    cache.unavailable = {};
    cache.canonicalLikedTrackIds = [];
    writeCache(user.uid, cache);
    if (hadCanonicalCache) recordCloudflareLocalCacheHit(LIKED_TRACK_ROUTE, 'LOCAL HIT · 좋아요 곡 없음');
    return [];
  }

  const likedSet = new Set(likedTrackIds);
  for (const trackId of Object.keys(cache.unavailable)) {
    if (!likedSet.has(trackId)) delete cache.unavailable[trackId];
  }

  const missing = likedTrackIds.filter((trackId) => !cache.items[trackId] && !cache.unavailable[trackId]);
  if (!missing.length) {
    writeCache(user.uid, cache);
    if (hadCanonicalCache) recordCloudflareLocalCacheHit(LIKED_TRACK_ROUTE, 'LOCAL HIT · 좋아요 곡 전체 캐시');
    return likedTrackIds.map((trackId) => cache.items[trackId]).filter(Boolean);
  }

  for (let start = 0; start < missing.length; start += LIKED_TRACK_BATCH_MAX) {
    const page = missing.slice(start, start + LIKED_TRACK_BATCH_MAX);
    const { items, unavailableTrackIds } = await requestLikedTracks(user, page);
    const returned = new Set<string>();
    for (const item of items) {
      const id = normalizeId(item?.id);
      if (!id || !likedSet.has(id)) continue;
      cache.items[id] = { ...item, id };
      delete cache.dormantSince[id];
      delete cache.unavailable[id];
      returned.add(id);
    }
    for (const trackId of unavailableTrackIds) {
      if (!likedSet.has(trackId) || returned.has(trackId)) continue;
      cache.unavailable[trackId] = true;
    }
    for (const trackId of page) {
      if (!returned.has(trackId) && !cache.unavailable[trackId]) cache.unavailable[trackId] = true;
    }
  }

  writeCache(user.uid, cache);
  return likedTrackIds.map((trackId) => cache.items[trackId]).filter(Boolean);
};

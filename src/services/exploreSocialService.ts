import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import type { User } from 'firebase/auth';
import { getFirebaseAppCheckToken } from '../firebase';
import { recordCloudflareLocalCacheHit, recordCloudflareResponse } from '../lib/cloudflareDiagnostics';
import { readSoridrawPersistentCache, removeSoridrawPersistentCache, writeSoridrawPersistentCache } from '../lib/soridrawPersistentCache';
import { requestOrderedExploreFollow354 } from './exploreFollowOrdering354';
import {
  getExplorePersonalSocialSnapshot,
  patchExplorePersonalSocialFollow,
} from './exploreSocialSnapshotService';

const EXPLORE_FOLLOW_CACHE_SCHEMA_VERSION = 2;
const EXPLORE_FOLLOW_BUNDLE_DIAGNOSTIC_PATH = '/v1/me/following-bundle';
// SORIDRAW_EXPLORE_PROFILE_FOLLOW_COST_1010_20260904
// SORIDRAW_EXPLORE_SOCIAL_SNAPSHOT_075_20260913
const EXPLORE_FOLLOW_CACHE_KEY = 'explore-follow-state';
const EXPLORE_FOLLOW_CACHE_SOURCE_TYPE = 'explore_follow_state';
const EXPLORE_FOLLOW_STATE_DIAGNOSTIC_PATH = '/v1/profiles/:id/follow-state';

const readPayload = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
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

const requestPublic = async (path: string) => {
  const response = await fetch(`${EXPLORE_API_BASE}${path}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  recordCloudflareResponse(response, path);
  const payload = await readPayload(response);
  if (!response.ok) {
    const message = String(payload?.message || payload?.error?.message || payload?.error || '공개 프로필을 불러오지 못했습니다.').trim();
    throw new Error(message || '공개 프로필을 불러오지 못했습니다.');
  }
  return payload;
};

const requestAuthed = async (user: User, path: string, init: RequestInit = {}) => {
  const authHeaders = await buildAuthHeaders(user);
  const response = await fetch(`${EXPLORE_API_BASE}${path}`, {
    ...init,
    headers: {
      ...authHeaders,
      Accept: 'application/json',
      ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  recordCloudflareResponse(response, path);
  const payload = await readPayload(response);
  if (!response.ok) {
    const code = String(payload?.code || payload?.error?.code || '').trim();
    const fallback = code === 'HANDLE_TAKEN'
      ? '이미 사용 중인 핸들입니다.'
      : code === 'PROFILE_MEDIA_NOT_CONFIGURED'
        ? '프로필 이미지 저장소 연결이 필요합니다.'
        : 'Explore 요청을 처리하지 못했습니다.';
    const message = String(payload?.message || payload?.error?.message || payload?.error || fallback).trim();
    const retryAfterSeconds = Number(response.headers.get('Retry-After') || 0);
    const retryAfterMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? Math.floor(retryAfterSeconds * 1000)
      : 0;
    throw Object.assign(new Error(message || fallback), {
      code,
      status: response.status,
      ...(retryAfterMs > 0 ? { retryAfterMs } : {}),
    });
  }
  return payload;
};

export type ExplorePublicProfile = {
  uid: string;
  nickname: string;
  avatarUrl: string;
  backgroundUrl: string;
  bio: string;
  handle: string;
  genres: string[];
  socialLinks: {
    spotify: string;
    instagram: string;
    tiktok: string;
    youtube: string;
  };
  followerCount: number;
  followingCount: number;
  trackCount: number;
};

export type ExploreProfileDraft = {
  nickname: string;
  bio: string;
  handle: string;
  genres: string[];
  spotifyUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  youtubeUrl: string;
};

export type ExploreFollowState = {
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  actorFollowingCount?: number;
};

export type ExploreProfileConnectionDirection = 'followers' | 'following';

export type ExploreProfileConnection = ExplorePublicProfile & {
  followedAt: number;
};

export type ExploreProfileConnectionPage = {
  items: ExploreProfileConnection[];
  nextCursor: string | null;
};

// SORIDRAW_EXPLORE_CONNECTION_PERSISTENT_CACHE_377_20261007
// Relation pages are change-driven. A browser refresh is not a relation change,
// so keep the first bounded page device-local until a real follow mutation/signal
// invalidates only the two affected directions.
const EXPLORE_PROFILE_CONNECTION_CACHE_SCHEMA_VERSION_377 = 1;
const EXPLORE_PROFILE_CONNECTION_CACHE_SOURCE_TYPE_377 = 'explore_profile_connections';
const EXPLORE_PROFILE_CONNECTION_DIAGNOSTIC_PATH_377 = '/v1/profiles/:id/connections';
const EXPLORE_FOLLOW_CONNECTION_CARD_CACHE_SCHEMA_VERSION_378 = 1;
const EXPLORE_FOLLOW_CONNECTION_CARD_CACHE_SOURCE_TYPE_378 = 'explore_follow_connection_card';

const profileConnectionCacheKey377 = (
  profileUid: string,
  direction: ExploreProfileConnectionDirection,
) => `explore-profile-connections:377:${direction}:${String(profileUid || '').trim()}`;

const readProfileConnectionCache377 = (
  profileUid: string,
  direction: ExploreProfileConnectionDirection,
): ExploreProfileConnectionPage | null => {
  const uid = String(profileUid || '').trim();
  if (!uid) return null;
  const envelope = readSoridrawPersistentCache<ExploreProfileConnectionPage>({
    cacheKey: profileConnectionCacheKey377(uid, direction),
    sourceType: EXPLORE_PROFILE_CONNECTION_CACHE_SOURCE_TYPE_377,
    schemaVersion: EXPLORE_PROFILE_CONNECTION_CACHE_SCHEMA_VERSION_377,
    uid: null,
  });
  const data = envelope?.data;
  if (!data || !Array.isArray(data.items)) return null;
  return {
    items: data.items.map((item) => ({ ...item })),
    nextCursor: String(data.nextCursor || '').trim() || null,
  };
};

export const readExploreProfileConnectionExactCount379 = (
  profileUid: string,
  direction: ExploreProfileConnectionDirection,
): number | null => {
  const cached = readProfileConnectionCache377(profileUid, direction);
  if (!cached || cached.nextCursor) return null;
  return cached.items.length;
};

const writeProfileConnectionCache377 = (
  profileUid: string,
  direction: ExploreProfileConnectionDirection,
  page: ExploreProfileConnectionPage,
) => {
  const uid = String(profileUid || '').trim();
  if (!uid) return;
  writeSoridrawPersistentCache<ExploreProfileConnectionPage>({
    cacheKey: profileConnectionCacheKey377(uid, direction),
    sourceType: EXPLORE_PROFILE_CONNECTION_CACHE_SOURCE_TYPE_377,
    schemaVersion: EXPLORE_PROFILE_CONNECTION_CACHE_SCHEMA_VERSION_377,
    dataVersion: Date.now(),
    uid: null,
    syncCursor: page.nextCursor,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: false,
    pendingMutationId: null,
    data: {
      items: page.items.map((item) => ({ ...item })),
      nextCursor: page.nextCursor,
    },
  });
};

export const invalidateExploreProfileConnections377 = (
  profileUid: string,
  direction: ExploreProfileConnectionDirection,
) => {
  const uid = String(profileUid || '').trim();
  if (!uid) return;
  removeSoridrawPersistentCache(profileConnectionCacheKey377(uid, direction), null);
};

type ExploreProfileConnectionSeed378 = Pick<
  ExplorePublicProfile,
  'uid' | 'nickname' | 'avatarUrl' | 'handle'
>;

const profileConnectionSeedCacheKey378 = (targetUid: string) =>
  `explore-follow-connection-card:378:${String(targetUid || '').trim()}`;

const readProfileConnectionSeed378 = (targetUid: string): ExploreProfileConnectionSeed378 | null => {
  const target = String(targetUid || '').trim();
  if (!target) return null;
  const envelope = readSoridrawPersistentCache<ExploreProfileConnectionSeed378>({
    cacheKey: profileConnectionSeedCacheKey378(target),
    sourceType: EXPLORE_FOLLOW_CONNECTION_CARD_CACHE_SOURCE_TYPE_378,
    schemaVersion: EXPLORE_FOLLOW_CONNECTION_CARD_CACHE_SCHEMA_VERSION_378,
    uid: null,
  });
  const row = envelope?.data;
  if (!row || String(row.uid || '').trim() !== target) return null;
  return {
    uid: target,
    nickname: String(row.nickname || 'SORiDRAW').trim() || 'SORiDRAW',
    avatarUrl: String(row.avatarUrl || '').trim(),
    handle: String(row.handle || '').trim().replace(/^@+/, ''),
  };
};

const writeProfileConnectionSeed378 = (seed: ExploreProfileConnectionSeed378) => {
  const target = String(seed?.uid || '').trim();
  if (!target) return;
  writeSoridrawPersistentCache<ExploreProfileConnectionSeed378>({
    cacheKey: profileConnectionSeedCacheKey378(target),
    sourceType: EXPLORE_FOLLOW_CONNECTION_CARD_CACHE_SOURCE_TYPE_378,
    schemaVersion: EXPLORE_FOLLOW_CONNECTION_CARD_CACHE_SCHEMA_VERSION_378,
    dataVersion: 0,
    uid: null,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: false,
    pendingMutationId: null,
    data: {
      uid: target,
      nickname: String(seed.nickname || 'SORiDRAW').trim() || 'SORiDRAW',
      avatarUrl: String(seed.avatarUrl || '').trim(),
      handle: String(seed.handle || '').trim().replace(/^@+/, ''),
    },
  });
};

const patchExploreFollowingConnectionCache378 = (
  viewerUid: string,
  targetUid: string,
  following: boolean,
  targetProfile?: ExploreProfileConnectionSeed378 | null,
): boolean => {
  const viewer = String(viewerUid || '').trim();
  const target = String(targetUid || '').trim();
  if (!viewer || !target) return false;

  const envelope = readSoridrawPersistentCache<ExploreProfileConnectionPage>({
    cacheKey: profileConnectionCacheKey377(viewer, 'following'),
    sourceType: EXPLORE_PROFILE_CONNECTION_CACHE_SOURCE_TYPE_377,
    schemaVersion: EXPLORE_PROFILE_CONNECTION_CACHE_SCHEMA_VERSION_377,
    uid: null,
  });
  const page = envelope?.data;
  if (!page || !Array.isArray(page.items)) return false;

  const previous = page.items.find((item) => item.uid === target) || null;
  if (previous) {
    writeProfileConnectionSeed378({
      uid: previous.uid,
      nickname: previous.nickname,
      avatarUrl: previous.avatarUrl,
      handle: previous.handle,
    });
  }
  let items = page.items.filter((item) => item.uid !== target);

  if (following) {
    const seed = targetProfile || previous || readProfileConnectionSeed378(target);
    const seedUid = String(seed?.uid || '').trim();
    if (seedUid !== target) return false;
    writeProfileConnectionSeed378(seed);
    const card: ExploreProfileConnection = {
      uid: target,
      nickname: String(seed.nickname || previous?.nickname || 'SORiDRAW').trim() || 'SORiDRAW',
      avatarUrl: String(seed.avatarUrl || previous?.avatarUrl || '').trim(),
      backgroundUrl: previous?.backgroundUrl || '',
      bio: previous?.bio || '',
      handle: String(seed.handle || previous?.handle || '').trim().replace(/^@+/, ''),
      genres: previous?.genres || [],
      socialLinks: previous?.socialLinks || { spotify: '', instagram: '', tiktok: '', youtube: '' },
      followerCount: previous?.followerCount || 0,
      followingCount: previous?.followingCount || 0,
      trackCount: previous?.trackCount || 0,
      followedAt: Date.now(),
    };
    items = [card, ...items];
    if (page.nextCursor && items.length > 30) items = items.slice(0, 30);
  }

  writeProfileConnectionCache377(viewer, 'following', {
    items,
    nextCursor: page.nextCursor,
  });
  return true;
};

export const patchExploreFollowLocalState377 = (
  viewerUid: string,
  targetUid: string,
  following: boolean,
  targetProfile?: ExploreProfileConnectionSeed378 | null,
) => {
  const viewer = String(viewerUid || '').trim();
  const target = String(targetUid || '').trim();
  if (!viewer || !target) return;
  rememberExploreFollowState(viewer, target, following);
  patchExplorePersonalSocialFollow(viewer, target, following);

  // app378: a real relation change patches the already-cached Following page
  // by one card instead of throwing the whole page away. App upgrades/reloads
  // therefore remain Worker 0 / D1 R0 after the first list hydration.
  if (!patchExploreFollowingConnectionCache378(viewer, target, following, targetProfile)) {
    invalidateExploreProfileConnections377(viewer, 'following');
  }
  // The target account's Followers page belongs to another account and this
  // UID-scoped signal does not carry the actor card. Keep the existing safe
  // changed-only invalidation for that separate surface.
  invalidateExploreProfileConnections377(target, 'followers');
};

type ExploreFollowCacheData = {
  complete: boolean;
  states: Record<string, boolean>;
};

const exploreFollowBundleInflight = new Map<string, Promise<ExploreFollowCacheData>>();

const normalizeExploreFollowCache = (value: unknown): ExploreFollowCacheData => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { complete: false, states: {} };
  const row = value as any;
  const rawStates = row?.states && typeof row.states === 'object' && !Array.isArray(row.states) ? row.states : {};
  const states = Object.entries(rawStates as Record<string, unknown>).reduce<Record<string, boolean>>((acc, [uid, state]) => {
    const normalizedUid = String(uid || '').trim();
    if (normalizedUid) acc[normalizedUid] = Boolean(state);
    return acc;
  }, {});
  // Legacy schema2 marked a capped 5,000-member list complete. Preserve its
  // known states, but absence cannot certify a negative membership.
  const capped = Object.values(states).filter((following) => following).length >= 5000;
  return { complete: Boolean(row?.complete) && !capped, states };
};

const readExploreFollowCache = (viewerUid: string): ExploreFollowCacheData => {
  const envelope = readSoridrawPersistentCache<ExploreFollowCacheData>({
    cacheKey: EXPLORE_FOLLOW_CACHE_KEY,
    sourceType: EXPLORE_FOLLOW_CACHE_SOURCE_TYPE,
    schemaVersion: EXPLORE_FOLLOW_CACHE_SCHEMA_VERSION,
    uid: viewerUid,
  });
  return normalizeExploreFollowCache(envelope?.data);
};

export const readExploreFollowingExactCount379 = (viewerUid: string): number | null => {
  const data = readExploreFollowCache(viewerUid);
  if (!data.complete) return null;
  return Object.values(data.states).reduce(
    (count, following) => count + (following ? 1 : 0),
    0,
  );
};

const writeExploreFollowCache = (viewerUid: string, data: ExploreFollowCacheData) => {
  const normalized = normalizeExploreFollowCache(data);
  writeSoridrawPersistentCache<ExploreFollowCacheData>({
    cacheKey: EXPLORE_FOLLOW_CACHE_KEY,
    sourceType: EXPLORE_FOLLOW_CACHE_SOURCE_TYPE,
    schemaVersion: EXPLORE_FOLLOW_CACHE_SCHEMA_VERSION,
    dataVersion: 0,
    uid: viewerUid,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: false,
    pendingMutationId: null,
    data: normalized,
  });
};

const readCachedExploreFollowState = (viewerUid: string, targetUid: string, data = readExploreFollowCache(viewerUid)): boolean | null => {
  if (Object.prototype.hasOwnProperty.call(data.states, targetUid)) return Boolean(data.states[targetUid]);
  return data.complete ? false : null;
};

export const readExploreFollowMembership379 = (
  viewerUid: string,
  targetUid: string,
): boolean | null => readCachedExploreFollowState(
  String(viewerUid || '').trim(),
  String(targetUid || '').trim(),
);

const rememberExploreFollowState = (viewerUid: string, targetUid: string, isFollowing: boolean) => {
  const data = readExploreFollowCache(viewerUid);
  data.states[targetUid] = Boolean(isFollowing);
  writeExploreFollowCache(viewerUid, data);
};

const loadExploreFollowingBundle = async (user: User): Promise<ExploreFollowCacheData> => {
  const cached = readExploreFollowCache(user.uid);
  if (cached.complete) return cached;

  const existing = exploreFollowBundleInflight.get(user.uid);
  if (existing) return existing;

  const task = (async () => {
    let rawUids: unknown[] = [];
    let complete = false;
    try {
      const snapshot = await getExplorePersonalSocialSnapshot(user);
      rawUids = snapshot.followingUids;
      complete = snapshot.followingComplete !== false && rawUids.length < 5000;
    } catch (snapshotError) {
      console.warn('[Explore follow] Social Snapshot unavailable; using following bundle recovery.', snapshotError);
      const payload = await requestAuthed(user, EXPLORE_FOLLOW_BUNDLE_DIAGNOSTIC_PATH);
      rawUids = Array.isArray(payload?.data?.followingUids) ? payload.data.followingUids : [];
      complete = typeof payload?.data?.followingComplete === 'boolean'
        ? payload.data.followingComplete : rawUids.length < 5000;
    }
    const states: Record<string, boolean> = rawUids.reduce<Record<string, boolean>>((acc, value: unknown) => {
      const uid = String(value || '').trim();
      if (uid) acc[uid] = true;
      return acc;
    }, {} as Record<string, boolean>);
    const next: ExploreFollowCacheData = { complete, states };
    writeExploreFollowCache(user.uid, next);
    return next;
  })().finally(() => {
    if (exploreFollowBundleInflight.get(user.uid) === task) exploreFollowBundleInflight.delete(user.uid);
  });

  exploreFollowBundleInflight.set(user.uid, task);
  return task;
};

// SORIDRAW_EXPLORE_LATEST_FOLLOWING_FILTER_312_20261003
// Reuse the existing local/R2 social snapshot. The Latest Following filter must
// never create a second D1-backed feed or re-read one profile per followed user.
export const getExploreFollowingUids312 = async (user: User): Promise<string[]> => {
  const bundle = await loadExploreFollowingBundle(user);
  return Object.entries(bundle.states)
    .filter(([, following]) => following === true)
    .map(([uid]) => uid)
    .filter(Boolean);
};

const toCount = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

const normalizeProfile = (row: any, fallbackRef = ''): ExplorePublicProfile => ({
  uid: String(row?.uid || fallbackRef).trim(),
  nickname: String(row?.nickname || row?.displayName || 'SORiDRAW').trim() || 'SORiDRAW',
  avatarUrl: String(row?.avatarUrl || row?.avatar_url || '').trim(),
  backgroundUrl: String(row?.backgroundUrl || row?.background_url || '').trim(),
  bio: String(row?.bio || '').trim(),
  handle: String(row?.handle || '').trim().replace(/^@+/, ''),
  genres: Array.isArray(row?.genres) ? row.genres.map((value: unknown) => String(value || '').trim()).filter(Boolean).slice(0, 5) : [],
  socialLinks: {
    spotify: String(row?.socialLinks?.spotify || row?.spotifyUrl || row?.spotify_url || '').trim(),
    instagram: String(row?.socialLinks?.instagram || row?.instagramUrl || row?.instagram_url || '').trim(),
    tiktok: String(row?.socialLinks?.tiktok || row?.tiktokUrl || row?.tiktok_url || '').trim(),
    youtube: String(row?.socialLinks?.youtube || row?.youtubeUrl || row?.youtube_url || '').trim(),
  },
  followerCount: toCount(row?.followerCount ?? row?.follower_count),
  followingCount: toCount(row?.followingCount ?? row?.following_count),
  trackCount: toCount(row?.trackCount ?? row?.track_count),
});

export const getExplorePublicProfile = async (profileRef: string): Promise<ExplorePublicProfile> => {
  const normalizedRef = String(profileRef || '').trim();
  if (!normalizedRef) throw new Error('공개 프로필 ID를 확인하지 못했습니다.');
  const payload = await requestPublic(`/v1/profiles/${encodeURIComponent(normalizedRef)}`);
  return normalizeProfile(payload?.data?.profile || payload?.data || {}, normalizedRef);
};

// SORIDRAW_EXPLORE_PROFILE_CONNECTIONS_376_20261007
// Followers/following are loaded only after an explicit stats click. One bounded
// connection query already returns the card fields, so never re-read one profile
// per row and never add a profile-entry server request.
export const getExploreProfileConnections = async (
  profileRef: string,
  direction: ExploreProfileConnectionDirection,
  cursor: string | null = null,
): Promise<ExploreProfileConnectionPage> => {
  const normalizedRef = String(profileRef || '').trim();
  if (!normalizedRef) throw new Error('공개 프로필 ID를 확인하지 못했습니다.');
  const normalizedDirection: ExploreProfileConnectionDirection = direction === 'following' ? 'following' : 'followers';
  const normalizedCursor = String(cursor || '').trim();

  if (!normalizedCursor) {
    const cached = readProfileConnectionCache377(normalizedRef, normalizedDirection);
    if (cached) {
      recordCloudflareLocalCacheHit(
        EXPLORE_PROFILE_CONNECTION_DIAGNOSTIC_PATH_377,
        `LOCAL HIT · ${normalizedDirection === 'followers' ? '팔로워' : '팔로잉'} 목록 · Worker 0 · D1 R0`,
      );
      return cached;
    }
  }

  const params = new URLSearchParams({ limit: '30' });
  if (normalizedCursor) params.set('cursor', normalizedCursor);
  const payload = await requestPublic(
    `/v1/profiles/${encodeURIComponent(normalizedRef)}/${normalizedDirection}?${params.toString()}`,
  );
  const rows = Array.isArray(payload?.data?.items) ? payload.data.items : [];
  const page: ExploreProfileConnectionPage = {
    items: rows.map((row: any) => ({
      ...normalizeProfile(row, String(row?.uid || '').trim()),
      followedAt: Math.max(0, Number(row?.followedAt ?? row?.followed_at ?? 0) || 0),
    })).filter((row: ExploreProfileConnection) => Boolean(row.uid)),
    nextCursor: String(payload?.data?.nextCursor || '').trim() || null,
  };
  if (!normalizedCursor) writeProfileConnectionCache377(normalizedRef, normalizedDirection, page);
  return page;
};

export const getExplorePublicProfileTracks = async (profileRef: string): Promise<Array<Record<string, unknown>>> => {
  const normalizedRef = String(profileRef || '').trim();
  if (!normalizedRef) return [];
  const payload = await requestPublic(`/v1/profiles/${encodeURIComponent(normalizedRef)}/tracks?limit=50`);
  return Array.isArray(payload?.data?.items) ? payload.data.items : [];
};

export const getExploreFollowState = async (user: User, uid: string): Promise<ExploreFollowState> => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) throw new Error('공개 프로필 ID를 확인하지 못했습니다.');

  const cachedBundle = readExploreFollowCache(user.uid);
  const cached = readCachedExploreFollowState(user.uid, normalizedUid, cachedBundle);
  if (cached !== null) {
    recordCloudflareLocalCacheHit(EXPLORE_FOLLOW_STATE_DIAGNOSTIC_PATH, 'LOCAL HIT · 전체 팔로우 묶음');
    return { isFollowing: cached, followerCount: 0, followingCount: 0 };
  }

  // An existing partial list needs only this missing target, not another list
  // hydration that could reintroduce an older snapshot's complete flag.
  const partialCache = !cachedBundle.complete && Object.keys(cachedBundle.states).length > 0;
  if (!partialCache) {
    try {
      const bundle = await loadExploreFollowingBundle(user);
      if (Object.prototype.hasOwnProperty.call(bundle.states, normalizedUid) || bundle.complete) {
        const isFollowing = Boolean(bundle.states[normalizedUid]);
        recordCloudflareLocalCacheHit(EXPLORE_FOLLOW_STATE_DIAGNOSTIC_PATH, 'LOCAL RESOLVE · 팔로우 묶음 1회 로드');
        return { isFollowing, followerCount: 0, followingCount: 0 };
      }
    } catch (bundleError) {
      console.warn('[Explore follow] following bundle unavailable; using per-target recovery.', bundleError);
    }
  }

  const payload = await requestAuthed(user, `/v1/profiles/${encodeURIComponent(normalizedUid)}/follow-state`);
  const row = payload?.data || {};
  const result = {
    isFollowing: Boolean(row?.isFollowing ?? row?.following ?? row?.followed),
    followerCount: toCount(row?.followerCount ?? row?.follower_count),
    followingCount: toCount(row?.followingCount ?? row?.following_count),
  };
  rememberExploreFollowState(user.uid, normalizedUid, result.isFollowing);
  return result;
};

export const setExploreFollow = async (
  user: User,
  uid: string,
  follow: boolean,
  targetProfile?: ExploreProfileConnectionSeed378 | null,
): Promise<ExploreFollowState> => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) throw new Error('공개 프로필 ID를 확인하지 못했습니다.');
  const payload = await requestOrderedExploreFollow354(
    user.uid, normalizedUid, follow,
    (path, init) => requestAuthed(user, path, init),
  );
  const row = payload?.data || {};
  const result = {
    isFollowing: Boolean(row?.isFollowing ?? row?.following ?? row?.followed ?? follow),
    followerCount: toCount(row?.followerCount ?? row?.follower_count),
    followingCount: toCount(row?.followingCount ?? row?.following_count),
    actorFollowingCount: toCount(row?.actorFollowingCount ?? row?.actor_following_count),
  };
  patchExploreFollowLocalState377(user.uid, normalizedUid, result.isFollowing, targetProfile);
  return result;
};

export const updateExplorePublicProfile = async (
  user: User,
  draft: ExploreProfileDraft,
  options: { youtubeChanged?: boolean } = {},
): Promise<ExplorePublicProfile> => {
  const includeYoutube252 = options.youtubeChanged !== false;
  const body252 = {
    nickname: draft.nickname.trim(),
    bio: draft.bio.trim(),
    handle: draft.handle.trim().replace(/^@+/, '').toLowerCase(),
    genres: draft.genres.map((value) => value.trim()).filter(Boolean).slice(0, 5),
    spotifyUrl: draft.spotifyUrl.trim(),
    instagramUrl: draft.instagramUrl.trim(),
    tiktokUrl: draft.tiktokUrl.trim(),
    profileMutationVersion: 252,
    ...(includeYoutube252 ? {
      youtubeUrl: draft.youtubeUrl.trim(),
      ...(options.youtubeChanged === true ? { youtubeChanged: true } : {}),
    } : {}),
  };
  const payload = await requestAuthed(user, '/v1/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(body252),
  });
  const saved = normalizeProfile(payload?.data?.profile || payload?.data || {}, user.uid);
  return {
    ...saved,
    socialLinks: {
      spotify: draft.spotifyUrl.trim(),
      instagram: draft.instagramUrl.trim(),
      tiktok: draft.tiktokUrl.trim(),
      youtube: draft.youtubeUrl.trim(),
    },
  };
};

export type ExploreProfileMediaKind = 'avatar' | 'background';

export type ExploreProfileMediaCrop = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

export type ExploreProfileCropRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const getExploreProfileCropRect = (
  sourceWidth: number,
  sourceHeight: number,
  kind: ExploreProfileMediaKind,
  crop: ExploreProfileMediaCrop = { zoom: 1, offsetX: 0, offsetY: 0 },
): ExploreProfileCropRect => {
  const safeWidth = Math.max(1, Number(sourceWidth) || 1);
  const safeHeight = Math.max(1, Number(sourceHeight) || 1);
  const targetRatio = kind === 'avatar' ? 1 : 1600 / 600;
  const sourceRatio = safeWidth / safeHeight;

  let baseWidth = safeWidth;
  let baseHeight = safeHeight;
  if (sourceRatio > targetRatio) {
    baseHeight = safeHeight;
    baseWidth = safeHeight * targetRatio;
  } else {
    baseWidth = safeWidth;
    baseHeight = safeWidth / targetRatio;
  }

  const zoom = clamp(Number(crop.zoom) || 1, 1, 3);
  const sw = Math.max(1, baseWidth / zoom);
  const sh = Math.max(1, baseHeight / zoom);
  const xRange = Math.max(0, (safeWidth - sw) / 2);
  const yRange = Math.max(0, (safeHeight - sh) / 2);
  const offsetX = clamp(Number(crop.offsetX) || 0, -1, 1);
  const offsetY = clamp(Number(crop.offsetY) || 0, -1, 1);

  return {
    sx: clamp((safeWidth - sw) / 2 + offsetX * xRange, 0, Math.max(0, safeWidth - sw)),
    sy: clamp((safeHeight - sh) / 2 + offsetY * yRange, 0, Math.max(0, safeHeight - sh)),
    sw,
    sh,
  };
};

export const uploadExploreProfileMedia = async (
  user: User,
  kind: ExploreProfileMediaKind,
  blob: Blob,
): Promise<string> => {
  const payload = await requestAuthed(user, `/v1/me/profile-media/${kind}`, {
    method: 'PUT',
    headers: { 'Content-Type': blob.type || 'image/webp' },
    body: blob,
  });
  return String(payload?.data?.url || '').trim();
};

export const uploadExploreProfileMediaBatch = async (
  user: User,
  media: { avatar: Blob; background: Blob },
): Promise<{ avatarUrl: string; backgroundUrl: string }> => {
  const form = new FormData();
  form.set('avatar', media.avatar, 'avatar.webp');
  form.set('background', media.background, 'background.webp');
  const payload = await requestAuthed(user, '/v1/me/profile-media', {
    method: 'PUT',
    body: form,
  });
  return {
    avatarUrl: String(payload?.data?.avatarUrl || '').trim(),
    backgroundUrl: String(payload?.data?.backgroundUrl || '').trim(),
  };
};

// SORIDRAW_UNIFIED_PROFILE_SAVE_CLIENT_252_20260930
export const saveExplorePublicProfileUnified = async (
  user: User,
  draft: ExploreProfileDraft,
  media: { avatar?: Blob | null; background?: Blob | null },
  options: { youtubeChanged?: boolean } = {},
): Promise<ExplorePublicProfile> => {
  if (!media.avatar && !media.background) {
    throw new Error('통합 프로필 저장에는 변경된 이미지가 필요합니다.');
  }
  const profilePayload252 = {
    nickname: draft.nickname.trim(),
    bio: draft.bio.trim(),
    handle: draft.handle.trim().replace(/^@+/, '').toLowerCase(),
    genres: draft.genres.map((value) => value.trim()).filter(Boolean).slice(0, 5),
    spotifyUrl: draft.spotifyUrl.trim(),
    instagramUrl: draft.instagramUrl.trim(),
    tiktokUrl: draft.tiktokUrl.trim(),
    profileMutationVersion: 252,
    ...(options.youtubeChanged === true
      ? { youtubeUrl: draft.youtubeUrl.trim(), youtubeChanged: true }
      : {}),
  };
  const form = new FormData();
  form.set('profile', JSON.stringify(profilePayload252));
  if (media.avatar) form.set('avatar', media.avatar, 'avatar.webp');
  if (media.background) form.set('background', media.background, 'background.webp');
  const payload = await requestAuthed(user, '/v1/me/profile-save', {
    method: 'PUT',
    body: form,
  });
  const saved = normalizeProfile(payload?.data?.profile || payload?.data || {}, user.uid);
  return {
    ...saved,
    socialLinks: {
      spotify: draft.spotifyUrl.trim(),
      instagram: draft.instagramUrl.trim(),
      tiktok: draft.tiktokUrl.trim(),
      youtube: draft.youtubeUrl.trim(),
    },
  };
};

const loadBitmap = async (file: Blob): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, sx: number, sy: number, sw: number, sh: number, dw: number, dh: number) => void; close: () => void }> => {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, sx, sy, sw, sh, dw, dh) => ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, dw, dh),
      close: () => bitmap.close(),
    };
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const next = new Image();
      next.onload = () => resolve(next);
      next.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
      next.src = url;
    });
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw: (ctx, sx, sy, sw, sh, dw, dh) => ctx.drawImage(image, sx, sy, sw, sh, 0, 0, dw, dh),
      close: () => undefined,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const prepareExploreProfileMedia = async (
  file: Blob,
  kind: ExploreProfileMediaKind,
  crop: ExploreProfileMediaCrop = { zoom: 1, offsetX: 0, offsetY: 0 },
): Promise<Blob> => {
  if (!String(file.type || '').startsWith('image/')) throw new Error('이미지 파일만 선택할 수 있습니다.');
  const source = await loadBitmap(file);
  try {
    const targetWidth = kind === 'avatar' ? 512 : 1600;
    const targetHeight = kind === 'avatar' ? 512 : 600;
    const rect = getExploreProfileCropRect(source.width, source.height, kind, crop);
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('이미지 처리 기능을 사용할 수 없습니다.');
    source.draw(ctx, rect.sx, rect.sy, rect.sw, rect.sh, targetWidth, targetHeight);
    const quality = kind === 'avatar' ? 0.82 : 0.78;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('이미지 압축에 실패했습니다.')), 'image/webp', quality);
    });
    const maxBytes = kind === 'avatar' ? 600 * 1024 : 1600 * 1024;
    if (blob.size > maxBytes) throw new Error(kind === 'avatar' ? '프로필 사진 용량을 더 줄여주세요.' : '배경 이미지 용량을 더 줄여주세요.');
    return blob;
  } finally {
    source.close();
  }
};

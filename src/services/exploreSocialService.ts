import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import type { User } from 'firebase/auth';
import { getFirebaseAppCheckToken } from '../firebase';
import { recordCloudflareLocalCacheHit, recordCloudflareResponse } from '../lib/cloudflareDiagnostics';
import { readSoridrawPersistentCache, writeSoridrawPersistentCache } from '../lib/soridrawPersistentCache';

const EXPLORE_FOLLOW_CACHE_SCHEMA_VERSION = 2;
const EXPLORE_FOLLOW_BUNDLE_DIAGNOSTIC_PATH = '/v1/me/following-bundle';
// SORIDRAW_EXPLORE_PROFILE_FOLLOW_COST_1010_20260904
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
    throw new Error(message || fallback);
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
};

export type ExploreFollowState = {
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
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
  return { complete: Boolean(row?.complete), states };
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

const readCachedExploreFollowState = (viewerUid: string, targetUid: string): boolean | null => {
  const data = readExploreFollowCache(viewerUid);
  if (Object.prototype.hasOwnProperty.call(data.states, targetUid)) return Boolean(data.states[targetUid]);
  return data.complete ? false : null;
};

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
    const payload = await requestAuthed(user, EXPLORE_FOLLOW_BUNDLE_DIAGNOSTIC_PATH);
    const rawUids = Array.isArray(payload?.data?.followingUids) ? payload.data.followingUids : [];
    const states: Record<string, boolean> = rawUids.reduce((acc: Record<string, boolean>, value: unknown) => {
      const uid = String(value || '').trim();
      if (uid) acc[uid] = true;
      return acc;
    }, {} as Record<string, boolean>);
    const next: ExploreFollowCacheData = { complete: true, states };
    writeExploreFollowCache(user.uid, next);
    return next;
  })().finally(() => {
    if (exploreFollowBundleInflight.get(user.uid) === task) exploreFollowBundleInflight.delete(user.uid);
  });

  exploreFollowBundleInflight.set(user.uid, task);
  return task;
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

export const getExplorePublicProfileTracks = async (profileRef: string): Promise<Array<Record<string, unknown>>> => {
  const normalizedRef = String(profileRef || '').trim();
  if (!normalizedRef) return [];
  const payload = await requestPublic(`/v1/profiles/${encodeURIComponent(normalizedRef)}/tracks?limit=50`);
  return Array.isArray(payload?.data?.items) ? payload.data.items : [];
};

export const getExploreFollowState = async (user: User, uid: string): Promise<ExploreFollowState> => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) throw new Error('공개 프로필 ID를 확인하지 못했습니다.');

  const cached = readCachedExploreFollowState(user.uid, normalizedUid);
  if (cached !== null) {
    recordCloudflareLocalCacheHit(EXPLORE_FOLLOW_STATE_DIAGNOSTIC_PATH, 'LOCAL HIT · 전체 팔로우 묶음');
    return { isFollowing: cached, followerCount: 0, followingCount: 0 };
  }

  try {
    const bundle = await loadExploreFollowingBundle(user);
    const isFollowing = Boolean(bundle.states[normalizedUid]);
    recordCloudflareLocalCacheHit(EXPLORE_FOLLOW_STATE_DIAGNOSTIC_PATH, 'LOCAL RESOLVE · 팔로우 묶음 1회 로드');
    return { isFollowing, followerCount: 0, followingCount: 0 };
  } catch (bundleError) {
    console.warn('[Explore follow] following bundle unavailable; using per-target recovery.', bundleError);
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

export const setExploreFollow = async (user: User, uid: string, follow: boolean): Promise<ExploreFollowState> => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) throw new Error('공개 프로필 ID를 확인하지 못했습니다.');
  const payload = await requestAuthed(
    user,
    `/v1/profiles/${encodeURIComponent(normalizedUid)}/follow`,
    { method: follow ? 'PUT' : 'DELETE' },
  );
  const row = payload?.data || {};
  const result = {
    isFollowing: Boolean(row?.isFollowing ?? row?.following ?? row?.followed ?? follow),
    followerCount: toCount(row?.followerCount ?? row?.follower_count),
    followingCount: toCount(row?.followingCount ?? row?.following_count),
  };
  rememberExploreFollowState(user.uid, normalizedUid, result.isFollowing);
  return result;
};

export const updateExplorePublicProfile = async (
  user: User,
  draft: ExploreProfileDraft,
): Promise<ExplorePublicProfile> => {
  const payload = await requestAuthed(user, '/v1/me/profile', {
    method: 'PATCH',
    body: JSON.stringify({
      nickname: draft.nickname.trim(),
      bio: draft.bio.trim(),
      handle: draft.handle.trim().replace(/^@+/, '').toLowerCase(),
      genres: draft.genres.map((value) => value.trim()).filter(Boolean).slice(0, 5),
      spotifyUrl: draft.spotifyUrl.trim(),
      instagramUrl: draft.instagramUrl.trim(),
      tiktokUrl: draft.tiktokUrl.trim(),
    }),
  });
  return normalizeProfile(payload?.data?.profile || payload?.data || {}, user.uid);
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
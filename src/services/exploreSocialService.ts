import type { User } from 'firebase/auth';
import { getFirebaseAppCheckToken } from '../firebase';

const EXPLORE_API_BASE = 'https://soridraw-explore-api.andrawing1212.workers.dev';

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
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  const payload = await readPayload(response);
  if (!response.ok) {
    const message = String(payload?.message || payload?.error?.message || payload?.error || 'Explore 요청을 처리하지 못했습니다.').trim();
    throw new Error(message || 'Explore 요청을 처리하지 못했습니다.');
  }
  return payload;
};

export type ExplorePublicProfile = {
  uid: string;
  nickname: string;
  avatarUrl: string;
  bio: string;
  followerCount: number;
  followingCount: number;
  trackCount: number;
};

export type ExploreFollowState = {
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
};

const toCount = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

export const getExplorePublicProfile = async (uid: string): Promise<ExplorePublicProfile> => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) throw new Error('공개 프로필 ID를 확인하지 못했습니다.');
  const payload = await requestPublic(`/v1/profiles/${encodeURIComponent(normalizedUid)}`);
  const row = payload?.data?.profile || payload?.data || {};
  return {
    uid: String(row?.uid || normalizedUid).trim(),
    nickname: String(row?.nickname || row?.displayName || 'SORiDRAW').trim() || 'SORiDRAW',
    avatarUrl: String(row?.avatarUrl || row?.avatar_url || '').trim(),
    bio: String(row?.bio || '').trim(),
    followerCount: toCount(row?.followerCount ?? row?.follower_count),
    followingCount: toCount(row?.followingCount ?? row?.following_count),
    trackCount: toCount(row?.trackCount ?? row?.track_count),
  };
};

export const getExplorePublicProfileTracks = async (uid: string): Promise<Array<Record<string, unknown>>> => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return [];
  const payload = await requestPublic(`/v1/profiles/${encodeURIComponent(normalizedUid)}/tracks?limit=50`);
  return Array.isArray(payload?.data?.items) ? payload.data.items : [];
};

export const getExploreFollowState = async (user: User, uid: string): Promise<ExploreFollowState> => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) throw new Error('공개 프로필 ID를 확인하지 못했습니다.');
  const payload = await requestAuthed(user, `/v1/profiles/${encodeURIComponent(normalizedUid)}/follow-state`);
  const row = payload?.data || {};
  return {
    isFollowing: Boolean(row?.isFollowing ?? row?.following ?? row?.followed),
    followerCount: toCount(row?.followerCount ?? row?.follower_count),
    followingCount: toCount(row?.followingCount ?? row?.following_count),
  };
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
  return {
    isFollowing: Boolean(row?.isFollowing ?? row?.following ?? row?.followed ?? follow),
    followerCount: toCount(row?.followerCount ?? row?.follower_count),
    followingCount: toCount(row?.followingCount ?? row?.following_count),
  };
};

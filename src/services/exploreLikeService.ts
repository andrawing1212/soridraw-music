import type { User } from 'firebase/auth';
import { getFirebaseAppCheckToken } from '../firebase';

const EXPLORE_API_BASE = 'https://soridraw-explore-api.andrawing1212.workers.dev';

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

  const query = new URLSearchParams({ trackIds: normalized.join(',') });
  const payload = await requestExploreLike(user, `/v1/me/likes?${query.toString()}`);
  return Array.isArray(payload?.data?.likedTrackIds)
    ? payload.data.likedTrackIds.map((trackId: unknown) => String(trackId || '').trim()).filter(Boolean)
    : [];
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

  return {
    trackId: String(payload?.data?.trackId || normalizedTrackId).trim(),
    liked: Boolean(payload?.data?.liked),
    likeCount: Number(payload?.data?.likeCount || 0),
  };
};

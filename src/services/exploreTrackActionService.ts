import type { User } from 'firebase/auth';
import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import { getFirebaseAppCheckToken } from '../firebase';
import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';

export type ExploreTrackApplySource = {
  trackId: string;
  title: string;
  style?: string | null;
  prompt?: string | null;
  tags?: Array<{ kind?: string; value?: string }>;
  shareBundle?: {
    schemaVersion?: number;
    selectedKeywords?: Record<string, unknown>;
    nextSong?: Record<string, unknown> | null;
  } | null;
  nextSong?: Record<string, unknown> | null;
};

export type ExploreTrackSaveAccess = {
  trackId: string;
  ownerUid: string;
  permissionEnabled: boolean;
  following: boolean;
  allowed: boolean;
  saveSource?: {
    sourceType: 'shared_track';
    exploreTrackId: string;
    originalSourceType?: string;
    originalSourceId?: string;
    sourceSubTrackKey?: string;
    sourceSubTrackIndex?: number | null;
    sourceSubTrackId?: string | null;
    title?: string;
    coverUrl?: string;
    sunoUrlPrimary?: string;
    sunoUrlSecondary?: string | null;
  } | null;
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
    Accept: 'application/json',
  };
};

const requestTrackAction = async <T>(user: User, trackId: string, action: 'apply-source' | 'save-access'): Promise<T> => {
  const normalizedTrackId = String(trackId || '').trim();
  if (!normalizedTrackId) throw new Error('곡 정보를 확인하지 못했습니다.');
  const path = `/v1/tracks/${encodeURIComponent(normalizedTrackId)}/${action}`;
  const response = await fetch(`${EXPLORE_API_BASE}${path}`, {
    method: 'GET',
    headers: await buildAuthHeaders(user),
  });
  recordCloudflareResponse(response, `/v1/tracks/:id/${action}`);
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok !== true) {
    const message = String(payload?.error?.message || payload?.message || payload?.error || '').trim();
    throw new Error(message || (action === 'apply-source'
      ? '다음곡 적용 정보를 불러오지 못했습니다.'
      : '폴더 저장 권한을 확인하지 못했습니다.'));
  }
  return payload?.data as T;
};

export const getExploreTrackApplySource = (user: User, trackId: string) =>
  requestTrackAction<ExploreTrackApplySource>(user, trackId, 'apply-source');

export const getExploreTrackSaveAccess = (user: User, trackId: string) =>
  requestTrackAction<ExploreTrackSaveAccess>(user, trackId, 'save-access');

const dislikeStorageKey = (uid: string) => `soridraw:explore:disliked:v1:${encodeURIComponent(String(uid || '').trim())}`;

export const readExploreDislikedTrackIds = (uid: string): Set<string> => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid || typeof window === 'undefined') return new Set();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(dislikeStorageKey(normalizedUid)) || '[]');
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((value) => String(value || '').trim()).filter(Boolean).slice(0, 2000));
  } catch {
    return new Set();
  }
};

export const markExploreTrackDisliked = (uid: string, trackId: string) => {
  const normalizedUid = String(uid || '').trim();
  const normalizedTrackId = String(trackId || '').trim();
  if (!normalizedUid || !normalizedTrackId || typeof window === 'undefined') return;
  const next = readExploreDislikedTrackIds(normalizedUid);
  next.add(normalizedTrackId);
  try {
    window.localStorage.setItem(dislikeStorageKey(normalizedUid), JSON.stringify([...next].slice(-2000)));
  } catch {}
};

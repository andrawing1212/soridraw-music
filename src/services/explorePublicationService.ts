import type { User } from 'firebase/auth';
import { getFirebaseAppCheckToken } from '../firebase';
import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';

const EXPLORE_API_BASE = 'https://soridraw-explore-api.andrawing1212.workers.dev';
const PUBLICATION_PAGE_SIZE = 50;
const MAX_PUBLICATION_PAGES = 8;

export type ExplorePublicationOptions = {
  allowNextSongApply: boolean;
  allowFollowerSave: boolean;
  profilePinned: boolean;
};

export type ExploreMusicNotePublicationState = ExplorePublicationOptions & {
  status: 'private' | 'public';
  trackId: string;
};

type ExplorePublicationItem = {
  id?: string;
  trackId?: string;
  sourceType?: string;
  sourceId?: string;
  isPublic?: boolean;
  allowNextSongApply?: boolean;
  allowFollowerSave?: boolean;
  profilePinned?: boolean;
};

class ExploreApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 0) {
    super(message);
    this.name = 'ExploreApiError';
    this.code = code;
    this.status = status;
  }
}

const DEFAULT_PUBLICATION_OPTIONS: ExplorePublicationOptions = {
  allowNextSongApply: false,
  allowFollowerSave: false,
  profilePinned: false,
};

const getMusicNoteTrackId = (uid: string, sourceId: string) => `music_note_${uid}_${sourceId}`;

const readResponsePayload = async (response: Response): Promise<any> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const getErrorMessage = (payload: any, fallback: string) =>
  String(payload?.error?.message || payload?.message || payload?.error || fallback).trim();

const getErrorCode = (payload: any, fallback: string) =>
  String(payload?.error?.code || payload?.code || fallback).trim();

const buildAuthHeaders = async (user: User) => {
  const [idToken, appCheckToken] = await Promise.all([
    user.getIdToken(),
    getFirebaseAppCheckToken(),
  ]);

  if (!appCheckToken) {
    throw new ExploreApiError(
      'APP_CHECK_UNAVAILABLE',
      'Explore 보안 인증을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.',
    );
  }

  return {
    Authorization: `Bearer ${idToken}`,
    'X-Firebase-AppCheck': appCheckToken,
  };
};

const requestExplore = async (
  user: User,
  path: string,
  init: RequestInit = {},
): Promise<any> => {
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
  const payload = await readResponsePayload(response);

  if (!response.ok) {
    throw new ExploreApiError(
      getErrorCode(payload, `HTTP_${response.status}`),
      getErrorMessage(payload, 'Explore 요청을 처리하지 못했습니다.'),
      response.status,
    );
  }

  return payload;
};

const normalizePublicationItem = (item: any): ExplorePublicationItem => ({
  id: String(item?.id || item?.trackId || '').trim() || undefined,
  trackId: String(item?.trackId || item?.id || '').trim() || undefined,
  sourceType: String(item?.sourceType || '').trim() || undefined,
  sourceId: String(item?.sourceId || '').trim() || undefined,
  isPublic: Boolean(item?.isPublic),
  allowNextSongApply: Boolean(item?.allowNextSongApply),
  allowFollowerSave: Boolean(item?.allowFollowerSave),
  profilePinned: Boolean(item?.profilePinned),
});

const normalizePublicationOptions = (
  options?: Partial<ExplorePublicationOptions> | null,
): ExplorePublicationOptions => ({
  allowNextSongApply: Boolean(options?.allowNextSongApply),
  allowFollowerSave: Boolean(options?.allowFollowerSave),
  profilePinned: Boolean(options?.profilePinned),
});

// SORIDRAW_EXPLORE_PUBLICATION_BATCH_STATE_965
export const getExploreMusicNotePublicationStates = async (
  user: User,
): Promise<Record<string, ExploreMusicNotePublicationState>> => {
  const result: Record<string, ExploreMusicNotePublicationState> = {};
  let cursor = '';

  for (let page = 0; page < MAX_PUBLICATION_PAGES; page += 1) {
    const query = new URLSearchParams({
      visibility: 'all',
      limit: String(PUBLICATION_PAGE_SIZE),
    });
    if (cursor) query.set('cursor', cursor);

    const payload = await requestExplore(user, `/v1/me/publications?${query.toString()}`);
    const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];

    items
      .map(normalizePublicationItem)
      .forEach((item) => {
        if (item.sourceType !== 'music_note') return;
        const sourceId = String(item.sourceId || '').trim();
        if (!sourceId) return;
        const expectedTrackId = getMusicNoteTrackId(user.uid, sourceId);
        result[sourceId] = {
          status: item.isPublic ? 'public' : 'private',
          trackId: item.trackId || item.id || expectedTrackId,
          allowNextSongApply: Boolean(item.allowNextSongApply),
          allowFollowerSave: Boolean(item.allowFollowerSave),
          profilePinned: Boolean(item.profilePinned),
        };
      });

    cursor = String(payload?.data?.nextCursor || '').trim();
    if (!cursor) break;
  }

  return result;
};

export const getExploreMusicNotePublicationState = async (
  user: User,
  sourceId: string,
): Promise<ExploreMusicNotePublicationState> => {
  const normalizedSourceId = String(sourceId || '').trim();
  const expectedTrackId = getMusicNoteTrackId(user.uid, normalizedSourceId);
  let cursor = '';

  for (let page = 0; page < MAX_PUBLICATION_PAGES; page += 1) {
    const query = new URLSearchParams({
      visibility: 'all',
      limit: String(PUBLICATION_PAGE_SIZE),
    });
    if (cursor) query.set('cursor', cursor);

    const payload = await requestExplore(user, `/v1/me/publications?${query.toString()}`);
    const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
    const match = items
      .map(normalizePublicationItem)
      .find((item) =>
        item.id === expectedTrackId
        || (item.sourceType === 'music_note' && item.sourceId === normalizedSourceId)
      );

    if (match) {
      return {
        status: match.isPublic ? 'public' : 'private',
        trackId: match.trackId || match.id || expectedTrackId,
        allowNextSongApply: Boolean(match.allowNextSongApply),
        allowFollowerSave: Boolean(match.allowFollowerSave),
        profilePinned: Boolean(match.profilePinned),
      };
    }

    cursor = String(payload?.data?.nextCursor || '').trim();
    if (!cursor) break;
  }

  return {
    status: 'private',
    trackId: expectedTrackId,
    ...DEFAULT_PUBLICATION_OPTIONS,
  };
};

export const publishMusicNoteToExplore = async (
  user: User,
  sourceId: string,
  options?: Partial<ExplorePublicationOptions>,
): Promise<ExploreMusicNotePublicationState> => {
  const normalizedSourceId = String(sourceId || '').trim();
  if (!normalizedSourceId) {
    throw new ExploreApiError('SOURCE_ID_REQUIRED', '뮤직노트 원본 ID를 확인하지 못했습니다.');
  }

  const normalizedOptions = normalizePublicationOptions(options);
  const payload = await requestExplore(user, '/v1/publications', {
    method: 'POST',
    body: JSON.stringify({
      sourceType: 'music_note',
      sourceId: normalizedSourceId,
      ...normalizedOptions,
    }),
  });

  const trackId = String(payload?.data?.trackId || getMusicNoteTrackId(user.uid, normalizedSourceId)).trim();
  return {
    status: 'public',
    trackId,
    allowNextSongApply: Boolean(payload?.data?.allowNextSongApply ?? normalizedOptions.allowNextSongApply),
    allowFollowerSave: Boolean(payload?.data?.allowFollowerSave ?? normalizedOptions.allowFollowerSave),
    profilePinned: Boolean(payload?.data?.profilePinned ?? normalizedOptions.profilePinned),
  };
};

export const setExploreTrackVisibility = async (
  user: User,
  trackId: string,
  isPublic: boolean,
): Promise<ExploreMusicNotePublicationState> => {
  const normalizedTrackId = String(trackId || '').trim();
  if (!normalizedTrackId) {
    throw new ExploreApiError('TRACK_ID_REQUIRED', 'Explore 곡 ID를 확인하지 못했습니다.');
  }

  const payload = await requestExplore(
    user,
    `/v1/tracks/${encodeURIComponent(normalizedTrackId)}/visibility`,
    {
      method: 'PATCH',
      body: JSON.stringify({ isPublic }),
    },
  );

  return {
    status: Boolean(payload?.data?.isPublic) ? 'public' : 'private',
    trackId: String(payload?.data?.trackId || normalizedTrackId).trim(),
    ...DEFAULT_PUBLICATION_OPTIONS,
  };
};

export const setExploreTrackPublicationOptions = async (
  user: User,
  trackId: string,
  options: ExplorePublicationOptions,
): Promise<ExplorePublicationOptions> => {
  const normalizedTrackId = String(trackId || '').trim();
  if (!normalizedTrackId) {
    throw new ExploreApiError('TRACK_ID_REQUIRED', 'Explore 곡 ID를 확인하지 못했습니다.');
  }

  const normalizedOptions = normalizePublicationOptions(options);
  const payload = await requestExplore(
    user,
    `/v1/tracks/${encodeURIComponent(normalizedTrackId)}/publication-options`,
    {
      method: 'PATCH',
      body: JSON.stringify(normalizedOptions),
    },
  );

  return {
    allowNextSongApply: Boolean(payload?.data?.allowNextSongApply ?? normalizedOptions.allowNextSongApply),
    allowFollowerSave: Boolean(payload?.data?.allowFollowerSave ?? normalizedOptions.allowFollowerSave),
    profilePinned: Boolean(payload?.data?.profilePinned ?? normalizedOptions.profilePinned),
  };
};

export const getExplorePublicationErrorMessage = (error: unknown): string => {
  if (error instanceof ExploreApiError) {
    if (error.code === 'SUNO_SHARE_URL_REQUIRED' || error.code === 'SUNO_URL_REQUIRED') {
      return '수노 URL을 먼저 연결해주세요.';
    }
    if (error.code === 'APP_CHECK_UNAVAILABLE') return error.message;
    if (error.status === 401 || error.status === 403) return 'Explore 보안 인증에 실패했습니다. 다시 로그인한 뒤 시도해주세요.';
    return error.message || 'Explore 공개 상태 변경에 실패했습니다.';
  }
  return 'Explore 공개 상태 변경에 실패했습니다.';
};

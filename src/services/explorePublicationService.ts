import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import type { User } from 'firebase/auth';
import { getFirebaseAppCheckToken } from '../firebase';
import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';
import {
  readSoridrawPersistentCache,
  removeSoridrawPersistentCache,
  removeSoridrawPersistentCachesBySourceType,
  writeSoridrawPersistentCache,
} from '../lib/soridrawPersistentCache';
import { invalidateExploreFeedSessionCache } from './exploreSessionCache';

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


// SORIDRAW_LONG_TERM_CACHE_STAGE_2_3_990
const PUBLICATION_CACHE_SCHEMA_VERSION = 1;
const PUBLICATION_CACHE_KEY = 'explore-publication-states';
const PUBLICATION_CACHE_SOURCE_TYPE = 'explore_publication_states';
const publicationMemoryCache = new Map<string, Record<string, ExploreMusicNotePublicationState>>();
const publicationInflight = new Map<string, Promise<Record<string, ExploreMusicNotePublicationState>>>();

const clonePublicationStates = (
  states: Record<string, ExploreMusicNotePublicationState>,
): Record<string, ExploreMusicNotePublicationState> => Object.fromEntries(
  Object.entries(states).map(([sourceId, state]) => [sourceId, { ...state }]),
);

const readPublicationStateCache = (uid: string): Record<string, ExploreMusicNotePublicationState> | null => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return null;
  const memory = publicationMemoryCache.get(normalizedUid);
  if (memory) return clonePublicationStates(memory);

  const envelope = readSoridrawPersistentCache<Record<string, ExploreMusicNotePublicationState>>({
    cacheKey: PUBLICATION_CACHE_KEY,
    sourceType: PUBLICATION_CACHE_SOURCE_TYPE,
    schemaVersion: PUBLICATION_CACHE_SCHEMA_VERSION,
    uid: normalizedUid,
  });
  if (!envelope?.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) return null;

  const normalized: Record<string, ExploreMusicNotePublicationState> = {};
  Object.entries(envelope.data).forEach(([sourceId, value]) => {
    const state = value as Partial<ExploreMusicNotePublicationState> | null;
    const trackId = String(state?.trackId || '').trim();
    if (!sourceId || !trackId) return;
    normalized[sourceId] = {
      status: state?.status === 'public' ? 'public' : 'private',
      trackId,
      allowNextSongApply: Boolean(state?.allowNextSongApply),
      allowFollowerSave: Boolean(state?.allowFollowerSave),
      profilePinned: Boolean(state?.profilePinned),
    };
  });
  publicationMemoryCache.set(normalizedUid, normalized);
  return clonePublicationStates(normalized);
};

const writePublicationStateCache = (
  uid: string,
  states: Record<string, ExploreMusicNotePublicationState>,
) => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return;
  const cloned = clonePublicationStates(states);
  publicationMemoryCache.set(normalizedUid, cloned);
  writeSoridrawPersistentCache<Record<string, ExploreMusicNotePublicationState>>({
    cacheKey: PUBLICATION_CACHE_KEY,
    sourceType: PUBLICATION_CACHE_SOURCE_TYPE,
    schemaVersion: PUBLICATION_CACHE_SCHEMA_VERSION,
    dataVersion: 0,
    uid: normalizedUid,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: false,
    pendingMutationId: null,
    data: cloned,
  });
};

const patchPublicationStateBySourceId = (
  uid: string,
  sourceId: string,
  nextState: ExploreMusicNotePublicationState,
) => {
  const existing = readPublicationStateCache(uid) || {};
  writePublicationStateCache(uid, { ...existing, [sourceId]: { ...nextState } });
};

const patchPublicationStateByTrackId = (
  uid: string,
  trackId: string,
  patcher: (state: ExploreMusicNotePublicationState) => ExploreMusicNotePublicationState,
) => {
  const existing = readPublicationStateCache(uid);
  if (!existing) return;
  let changed = false;
  const next = clonePublicationStates(existing);
  Object.entries(next).forEach(([sourceId, state]) => {
    if (state.trackId !== trackId) return;
    next[sourceId] = patcher(state);
    changed = true;
  });
  if (changed) writePublicationStateCache(uid, next);
};

export const clearExplorePublicationSessionCache = (uid?: string | null) => {
  const normalizedUid = String(uid || '').trim();
  if (normalizedUid) {
    publicationMemoryCache.delete(normalizedUid);
    publicationInflight.delete(normalizedUid);
    removeSoridrawPersistentCache(PUBLICATION_CACHE_KEY, normalizedUid);
    return;
  }
  publicationMemoryCache.clear();
  publicationInflight.clear();
  removeSoridrawPersistentCachesBySourceType(PUBLICATION_CACHE_SOURCE_TYPE);
};

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
  const cached = readPublicationStateCache(user.uid);
  if (cached) return cached;

  const inFlight = publicationInflight.get(user.uid);
  if (inFlight) return inFlight;

  const task = (async () => {
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

    writePublicationStateCache(user.uid, result);
    return clonePublicationStates(result);
  })().finally(() => {
    publicationInflight.delete(user.uid);
  });

  publicationInflight.set(user.uid, task);
  return task;
};

export const getExploreMusicNotePublicationState = async (
  user: User,
  sourceId: string,
): Promise<ExploreMusicNotePublicationState> => {
  const normalizedSourceId = String(sourceId || '').trim();
  const expectedTrackId = getMusicNoteTrackId(user.uid, normalizedSourceId);
  const states = await getExploreMusicNotePublicationStates(user);
  const state = states[normalizedSourceId];
  return state ? { ...state } : {
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
  const nextState: ExploreMusicNotePublicationState = {
    status: 'public',
    trackId,
    allowNextSongApply: Boolean(payload?.data?.allowNextSongApply ?? normalizedOptions.allowNextSongApply),
    allowFollowerSave: Boolean(payload?.data?.allowFollowerSave ?? normalizedOptions.allowFollowerSave),
    profilePinned: Boolean(payload?.data?.profilePinned ?? normalizedOptions.profilePinned),
  };
  patchPublicationStateBySourceId(user.uid, normalizedSourceId, nextState);
  invalidateExploreFeedSessionCache();
  return nextState;
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

  const resolvedTrackId = String(payload?.data?.trackId || normalizedTrackId).trim();
  const status: ExploreMusicNotePublicationState['status'] = Boolean(payload?.data?.isPublic) ? 'public' : 'private';
  let cachedOptions = DEFAULT_PUBLICATION_OPTIONS;
  const cachedStates = readPublicationStateCache(user.uid);
  if (cachedStates) {
    const existing = Object.values(cachedStates).find((state) => state.trackId === resolvedTrackId);
    if (existing) {
      cachedOptions = {
        allowNextSongApply: existing.allowNextSongApply,
        allowFollowerSave: existing.allowFollowerSave,
        profilePinned: existing.profilePinned,
      };
    }
  }
  patchPublicationStateByTrackId(user.uid, resolvedTrackId, (state) => ({ ...state, status }));
  invalidateExploreFeedSessionCache();
  return {
    status,
    trackId: resolvedTrackId,
    ...cachedOptions,
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

  const nextOptions: ExplorePublicationOptions = {
    allowNextSongApply: Boolean(payload?.data?.allowNextSongApply ?? normalizedOptions.allowNextSongApply),
    allowFollowerSave: Boolean(payload?.data?.allowFollowerSave ?? normalizedOptions.allowFollowerSave),
    profilePinned: Boolean(payload?.data?.profilePinned ?? normalizedOptions.profilePinned),
  };
  patchPublicationStateByTrackId(user.uid, normalizedTrackId, (state) => ({ ...state, ...nextOptions }));
  invalidateExploreFeedSessionCache();
  return nextOptions;
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

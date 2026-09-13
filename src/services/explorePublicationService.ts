import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import type { User } from 'firebase/auth';
import { getFirebaseAppCheckToken } from '../firebase';
import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';
import {
  readSoridrawPersistentCache,
  writeSoridrawPersistentCache,
} from '../lib/soridrawPersistentCache';
import {
  invalidateExploreFeedSessionCache,
  patchExploreFeedSessionCachesRow,
  removeExploreFeedSessionCacheRow,
  upsertExploreFeedSessionCacheRow,
} from './exploreSessionCache';
import {
  invalidateExplorePublicProfileFirstView,
  patchExplorePublicProfileFirstViewTrack,
  removeExplorePublicProfileFirstViewTrack,
  upsertExplorePublicProfileFirstViewTrack,
} from './exploreProfileFirstViewService';

// SORIDRAW_EXPLORE_TARGETED_PUBLICATION_CACHE_075_20260913
// SORIDRAW_PUBLICATION_PERSISTENT_REVISION_078_20260913

export type ExplorePublicationOptions = {
  allowNextSongApply: boolean;
  allowFollowerSave: boolean;
  profilePinned: boolean;
};

export type ExploreMusicNotePublicationState = ExplorePublicationOptions & {
  status: 'private' | 'public';
  trackId: string;
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
// Schema v2 is intentionally kept stable across app releases. App updates must not
// throw away a healthy device snapshot. A tiny R2 revision HEAD validates the
// persistent snapshot; the full R2 bundle is fetched only on first device use or
// when that revision actually changed.
const PUBLICATION_CACHE_SCHEMA_VERSION = 2;
const PUBLICATION_CACHE_KEY = 'explore-publication-states';
const PUBLICATION_CACHE_SOURCE_TYPE = 'explore_publication_states';
const publicationMemoryCache = new Map<string, Record<string, ExploreMusicNotePublicationState>>();
const publicationInflight = new Map<string, Promise<Record<string, ExploreMusicNotePublicationState>>>();
const publicationServerValidatedUids = new Set<string>();

const clonePublicationStates = (
  states: Record<string, ExploreMusicNotePublicationState>,
): Record<string, ExploreMusicNotePublicationState> => Object.fromEntries(
  Object.entries(states).map(([sourceId, state]) => [sourceId, { ...state }]),
);

const readPublicationStateEnvelope = (uid: string) => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return null;
  return readSoridrawPersistentCache<Record<string, ExploreMusicNotePublicationState>>({
    cacheKey: PUBLICATION_CACHE_KEY,
    sourceType: PUBLICATION_CACHE_SOURCE_TYPE,
    schemaVersion: PUBLICATION_CACHE_SCHEMA_VERSION,
    uid: normalizedUid,
  });
};

const normalizeCachedPublicationStates = (data: Record<string, ExploreMusicNotePublicationState>) => {
  const normalized: Record<string, ExploreMusicNotePublicationState> = {};
  Object.entries(data).forEach(([sourceId, value]) => {
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
  return normalized;
};

const readPublicationStateCache = (uid: string): Record<string, ExploreMusicNotePublicationState> | null => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return null;
  const memory = publicationMemoryCache.get(normalizedUid);
  if (memory) return clonePublicationStates(memory);

  const envelope = readPublicationStateEnvelope(normalizedUid);
  if (!envelope?.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) return null;
  const normalized = normalizeCachedPublicationStates(envelope.data);
  publicationMemoryCache.set(normalizedUid, normalized);
  return clonePublicationStates(normalized);
};

const writePublicationStateCache = (
  uid: string,
  states: Record<string, ExploreMusicNotePublicationState>,
  serverRevision?: string | null,
) => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return;
  const existingEnvelope = readPublicationStateEnvelope(normalizedUid);
  const cloned = clonePublicationStates(states);
  publicationMemoryCache.set(normalizedUid, cloned);
  writeSoridrawPersistentCache<Record<string, ExploreMusicNotePublicationState>>({
    cacheKey: PUBLICATION_CACHE_KEY,
    sourceType: PUBLICATION_CACHE_SOURCE_TYPE,
    schemaVersion: PUBLICATION_CACHE_SCHEMA_VERSION,
    dataVersion: 0,
    uid: normalizedUid,
    syncCursor: null,
    serverRevision: serverRevision === undefined
      ? (existingEnvelope?.serverRevision ?? null)
      : serverRevision,
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
    publicationServerValidatedUids.delete(normalizedUid);
    return;
  }
  publicationMemoryCache.clear();
  publicationInflight.clear();
  publicationServerValidatedUids.clear();
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

const normalizePublicationOptions = (
  options?: Partial<ExplorePublicationOptions> | null,
): ExplorePublicationOptions => ({
  allowNextSongApply: Boolean(options?.allowNextSongApply),
  allowFollowerSave: Boolean(options?.allowFollowerSave),
  profilePinned: Boolean(options?.profilePinned),
});

const parseMusicNotePublicationBundle = (
  data: any,
): Record<string, ExploreMusicNotePublicationState> | null => {
  const rawStates = data?.states;
  const entries = rawStates && typeof rawStates === 'object' && !Array.isArray(rawStates)
    ? Object.entries(rawStates as Record<string, any>)
    : [];
  const isValidBundle = Number(data?.schemaVersion || 0) === 1
    && rawStates
    && typeof rawStates === 'object'
    && !Array.isArray(rawStates)
    && Number(data?.itemCount ?? -1) === entries.length
    && entries.every(([sourceId, value]) => Boolean(
      String(sourceId || '').trim()
      && String((value as any)?.trackId || '').trim(),
    ));
  if (!isValidBundle) return null;

  const bundledStates: Record<string, ExploreMusicNotePublicationState> = {};
  entries.forEach(([sourceId, value]) => {
    const state = value as any;
    bundledStates[sourceId] = {
      status: state?.status === 'public' ? 'public' : 'private',
      trackId: String(state?.trackId || '').trim(),
      allowNextSongApply: Boolean(state?.allowNextSongApply),
      allowFollowerSave: Boolean(state?.allowFollowerSave),
      profilePinned: Boolean(state?.profilePinned),
    };
  });
  return bundledStates;
};

// SORIDRAW_EXPLORE_PUBLICATION_BATCH_STATE_965
export const getExploreMusicNotePublicationStates = async (
  user: User,
): Promise<Record<string, ExploreMusicNotePublicationState>> => {
  const uid = String(user.uid || '').trim();
  const cached = readPublicationStateCache(uid);
  const envelope = readPublicationStateEnvelope(uid);
  if (cached && publicationServerValidatedUids.has(uid)) return cached;

  const inFlight = publicationInflight.get(uid);
  if (inFlight) return inFlight;

  const task = (async () => {
    let knownRevision = '';

    // Warm device: validate only the tiny R2 object HEAD. This route is D1 R0/W0.
    // A network/R2 outage never discards a valid device snapshot.
    if (cached) {
      try {
        const revisionPayload = await requestExplore(user, '/v1/me/music-note-publications-revision');
        const revisionData = revisionPayload?.data || {};
        knownRevision = String(revisionData?.revision || '').trim();
        const exists = Boolean(revisionData?.exists);
        const remoteUpdatedAt = Math.max(0, Number(revisionData?.updatedAt || 0));
        const localRevision = String(envelope?.serverRevision || '').trim();
        const localSyncedAt = Math.max(0, Number(envelope?.syncedAt || 0));

        if (!exists) {
          publicationServerValidatedUids.add(uid);
          return clonePublicationStates(cached);
        }
        if (knownRevision && localRevision && knownRevision === localRevision) {
          publicationServerValidatedUids.add(uid);
          return clonePublicationStates(cached);
        }
        // Upgrade a healthy 076 cache without downloading the whole state bundle.
        // If the R2 object has not changed since this device snapshot was written,
        // the cached data is already current; simply attach the current revision.
        if (knownRevision && !localRevision && remoteUpdatedAt > 0 && localSyncedAt >= remoteUpdatedAt) {
          writePublicationStateCache(uid, cached, knownRevision);
          publicationServerValidatedUids.add(uid);
          return clonePublicationStates(cached);
        }
      } catch (revisionError) {
        console.warn('[Explore publication] revision validation unavailable; using persistent snapshot.', revisionError);
        publicationServerValidatedUids.add(uid);
        return clonePublicationStates(cached);
      }
    }

    // Cold device, or a warm device whose revision actually changed: one R2 snapshot.
    // There is intentionally no paginated D1 fallback on the client.
    const payload = await requestExplore(user, '/v1/me/music-note-publications-bundle');
    const bundledStates = parseMusicNotePublicationBundle(payload?.data);
    if (!bundledStates) {
      if (cached) {
        publicationServerValidatedUids.add(uid);
        return clonePublicationStates(cached);
      }
      throw new ExploreApiError(
        'MUSIC_NOTE_PUBLICATION_BUNDLE_INVALID',
        '뮤직노트 공개상태 번들을 확인하지 못했습니다.',
      );
    }
    const bundleRevision = String(payload?.data?.revision || knownRevision || '').trim() || null;
    writePublicationStateCache(uid, bundledStates, bundleRevision);
    publicationServerValidatedUids.add(uid);
    return clonePublicationStates(bundledStates);
  })().finally(() => {
    publicationInflight.delete(uid);
  });

  publicationInflight.set(uid, task);
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
  const snapshotItem = payload?.data?.snapshotItem;
  if (snapshotItem && typeof snapshotItem === 'object' && !Array.isArray(snapshotItem)) {
    upsertExploreFeedSessionCacheRow(trackId, snapshotItem as Record<string, unknown>);
    upsertExplorePublicProfileFirstViewTrack(user.uid, snapshotItem as Record<string, unknown>);
  } else {
    // Backward-compatible fallback while older Workers are still active.
    invalidateExploreFeedSessionCache();
    invalidateExplorePublicProfileFirstView(user.uid);
  }
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
  if (status === 'private') {
    removeExploreFeedSessionCacheRow(resolvedTrackId);
    removeExplorePublicProfileFirstViewTrack(user.uid, resolvedTrackId);
  } else {
    const snapshotItem = payload?.data?.snapshotItem;
    if (snapshotItem && typeof snapshotItem === 'object' && !Array.isArray(snapshotItem)) {
      upsertExploreFeedSessionCacheRow(resolvedTrackId, snapshotItem as Record<string, unknown>);
      upsertExplorePublicProfileFirstViewTrack(user.uid, snapshotItem as Record<string, unknown>);
    } else {
      invalidateExploreFeedSessionCache();
      invalidateExplorePublicProfileFirstView(user.uid);
    }
  }
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
  patchExploreFeedSessionCachesRow(normalizedTrackId, nextOptions);
  patchExplorePublicProfileFirstViewTrack(user.uid, normalizedTrackId, nextOptions);
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
import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import type { User } from 'firebase/auth';
import { getFirebaseAppCheckToken } from '../firebase';
import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';
import {
  readSoridrawPersistentCache,
  removeSoridrawPersistentCache,
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
// SORIDRAW_PUBLICATION_REGISTERED_STATE_080_20260913
// SORIDRAW_PAGE_EXIT_PUBLICATION_OUTBOX_081_20260914

export type ExplorePublicationOptions = {
  allowNextSongApply: boolean;
  allowFollowerSave: boolean;
  profilePinned: boolean;
};

export type ExploreMusicNotePublicationState = ExplorePublicationOptions & {
  status: 'private' | 'public';
  trackId: string;
  registered: boolean;
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


const EXPLORE_PUBLICATION_OUTBOX_SCHEMA_VERSION = 1;
const EXPLORE_PUBLICATION_OUTBOX_CACHE_KEY = 'explore-publication-outbox';
const EXPLORE_PUBLICATION_OUTBOX_SOURCE_TYPE = 'explore_publication_outbox';

type ExplorePublicationPendingMutation = {
  sourceId: string;
  trackId: string;
  baseState: ExploreMusicNotePublicationState;
  desiredState: ExploreMusicNotePublicationState;
  updatedAt: number;
};

type ExplorePublicationOutbox = Record<string, ExplorePublicationPendingMutation>;

const normalizePublicationState = (
  value: Partial<ExploreMusicNotePublicationState> | null | undefined,
  trackId: string,
  registered = false,
): ExploreMusicNotePublicationState => ({
  status: value?.status === 'public' ? 'public' : 'private',
  trackId: String(value?.trackId || trackId || '').trim(),
  registered: value?.registered === undefined ? registered : Boolean(value.registered),
  allowNextSongApply: Boolean(value?.allowNextSongApply),
  allowFollowerSave: Boolean(value?.allowFollowerSave),
  profilePinned: Boolean(value?.profilePinned),
});

const samePublicationState = (a: ExploreMusicNotePublicationState, b: ExploreMusicNotePublicationState) => (
  a.status === b.status
  && a.trackId === b.trackId
  && a.registered === b.registered
  && a.allowNextSongApply === b.allowNextSongApply
  && a.allowFollowerSave === b.allowFollowerSave
  && a.profilePinned === b.profilePinned
);

const readPublicationOutbox = (uid: string): ExplorePublicationOutbox => {
  const envelope = readSoridrawPersistentCache<ExplorePublicationOutbox>({
    cacheKey: EXPLORE_PUBLICATION_OUTBOX_CACHE_KEY,
    sourceType: EXPLORE_PUBLICATION_OUTBOX_SOURCE_TYPE,
    schemaVersion: EXPLORE_PUBLICATION_OUTBOX_SCHEMA_VERSION,
    uid,
  });
  if (!envelope?.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) return {};
  const next: ExplorePublicationOutbox = {};
  Object.entries(envelope.data).forEach(([sourceId, raw]) => {
    const value = raw as Partial<ExplorePublicationPendingMutation> | null;
    const trackId = String(value?.trackId || '').trim();
    if (!sourceId || !trackId || !value?.baseState || !value?.desiredState) return;
    next[sourceId] = {
      sourceId,
      trackId,
      baseState: normalizePublicationState(value.baseState, trackId, Boolean(value.baseState.registered)),
      desiredState: normalizePublicationState(value.desiredState, trackId, Boolean(value.desiredState.registered)),
      updatedAt: Math.max(0, Number(value.updatedAt || 0)),
    };
  });
  return next;
};

const persistPublicationOutbox = (uid: string, outbox: ExplorePublicationOutbox) => {
  if (!Object.keys(outbox).length) {
    removeSoridrawPersistentCache(EXPLORE_PUBLICATION_OUTBOX_CACHE_KEY, uid);
    return;
  }
  writeSoridrawPersistentCache<ExplorePublicationOutbox>({
    cacheKey: EXPLORE_PUBLICATION_OUTBOX_CACHE_KEY,
    sourceType: EXPLORE_PUBLICATION_OUTBOX_SOURCE_TYPE,
    schemaVersion: EXPLORE_PUBLICATION_OUTBOX_SCHEMA_VERSION,
    dataVersion: 0,
    uid,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: true,
    pendingMutationId: 'publication-page-exit',
    data: outbox,
  });
};

export const getPendingExplorePublicationMutationCount = (uid: string): number => Object.keys(readPublicationOutbox(uid)).length;

const overlayPendingPublicationStates = (
  uid: string,
  states: Record<string, ExploreMusicNotePublicationState>,
) => {
  const next = clonePublicationStates(states);
  Object.values(readPublicationOutbox(uid)).forEach((pending) => {
    next[pending.sourceId] = { ...pending.desiredState };
  });
  return next;
};

const findPublicationSourceByTrackId = (uid: string, trackId: string) => {
  const normalizedTrackId = String(trackId || '').trim();
  const states = readPublicationStateCache(uid) || {};
  const matched = Object.entries(states).find(([, state]) => state.trackId === normalizedTrackId);
  if (matched) return { sourceId: matched[0], state: matched[1] };
  const pending = Object.values(readPublicationOutbox(uid)).find((item) => item.trackId === normalizedTrackId);
  if (pending) return { sourceId: pending.sourceId, state: pending.desiredState };
  const prefix = `music_note_${uid}_`;
  const sourceId = normalizedTrackId.startsWith(prefix) ? normalizedTrackId.slice(prefix.length) : normalizedTrackId;
  return {
    sourceId,
    state: normalizePublicationState({ status: 'private', registered: true }, normalizedTrackId, true),
  };
};

const queuePublicationMutation = (
  uid: string,
  sourceId: string,
  currentState: ExploreMusicNotePublicationState,
  requestedState: ExploreMusicNotePublicationState,
) => {
  const outbox = readPublicationOutbox(uid);
  const existing = outbox[sourceId];
  const baseState = existing?.baseState || { ...currentState };
  let desiredState = { ...requestedState };
  if (!baseState.registered && desiredState.status === 'private') {
    desiredState = { ...baseState, status: 'private', registered: false };
  }
  if (samePublicationState(baseState, desiredState)) {
    delete outbox[sourceId];
  } else {
    outbox[sourceId] = {
      sourceId,
      trackId: desiredState.trackId,
      baseState: { ...baseState },
      desiredState: { ...desiredState },
      updatedAt: Date.now(),
    };
  }
  persistPublicationOutbox(uid, outbox);
  patchPublicationStateBySourceId(uid, sourceId, desiredState);
  return desiredState;
};

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
      registered: state?.registered !== false,
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
      registered: true,
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
  if (cached && getPendingExplorePublicationMutationCount(uid) > 0) return cached;
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
          // SORIDRAW_PUBLICATION_MISSING_R2_REPAIR_082_20260914
          // A missing shared snapshot is a repair signal, not proof that this device cache is current.
          // Fall through to the bundle route; the Worker rebuilds once from canonical D1 and repopulates R2.
          knownRevision = '';
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
    const mergedStates = overlayPendingPublicationStates(uid, bundledStates);
    writePublicationStateCache(uid, mergedStates, bundleRevision);
    publicationServerValidatedUids.add(uid);
    return clonePublicationStates(mergedStates);
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
    registered: false,
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
  const trackId = getMusicNoteTrackId(user.uid, normalizedSourceId);
  const states = readPublicationStateCache(user.uid) || {};
  const current = states[normalizedSourceId] || normalizePublicationState({
    status: 'private',
    registered: false,
    ...DEFAULT_PUBLICATION_OPTIONS,
  }, trackId, false);
  const normalizedOptions = normalizePublicationOptions(options);
  const optimistic = queuePublicationMutation(user.uid, normalizedSourceId, current, {
    status: 'public',
    trackId,
    registered: current.registered,
    ...normalizedOptions,
  });
  await flushPendingExplorePublicationsForPageExit(user);
  const confirmed = readPublicationStateCache(user.uid)?.[normalizedSourceId];
  return confirmed ? { ...confirmed } : optimistic;
};

export const setExploreTrackVisibility = async (
  user: User,
  trackId: string,
  isPublic: boolean,
  options?: Partial<ExplorePublicationOptions>,
): Promise<ExploreMusicNotePublicationState> => {
  const normalizedTrackId = String(trackId || '').trim();
  if (!normalizedTrackId) {
    throw new ExploreApiError('TRACK_ID_REQUIRED', 'Explore 곡 ID를 확인하지 못했습니다.');
  }
  const found = findPublicationSourceByTrackId(user.uid, normalizedTrackId);
  const requestedOptions = options ? normalizePublicationOptions(options) : {
    allowNextSongApply: found.state.allowNextSongApply,
    allowFollowerSave: found.state.allowFollowerSave,
    profilePinned: found.state.profilePinned,
  };
  const optimistic = queuePublicationMutation(user.uid, found.sourceId, found.state, {
    ...found.state,
    status: isPublic ? 'public' : 'private',
    trackId: normalizedTrackId,
    ...requestedOptions,
  });
  await flushPendingExplorePublicationsForPageExit(user);
  const confirmed = readPublicationStateCache(user.uid)?.[found.sourceId];
  return confirmed ? { ...confirmed } : optimistic;
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
  const found = findPublicationSourceByTrackId(user.uid, normalizedTrackId);
  const normalizedOptions = normalizePublicationOptions(options);
  queuePublicationMutation(user.uid, found.sourceId, found.state, {
    ...found.state,
    ...normalizedOptions,
    trackId: normalizedTrackId,
  });
  await flushPendingExplorePublicationsForPageExit(user);
  const confirmed = readPublicationStateCache(user.uid)?.[found.sourceId];
  return confirmed ? {
    allowNextSongApply: confirmed.allowNextSongApply,
    allowFollowerSave: confirmed.allowFollowerSave,
    profilePinned: confirmed.profilePinned,
  } : normalizedOptions;
};

export const flushPendingExplorePublicationsForPageExit = async (user: User): Promise<void> => {
  const uid = String(user.uid || '').trim();
  const initialOutbox = readPublicationOutbox(uid);
  const entries = Object.values(initialOutbox).sort((a, b) => a.updatedAt - b.updatedAt);
  if (!entries.length) return;

  const payload = await requestExplore(user, '/v1/me/music-note-publications/batch', {
    method: 'POST',
    body: JSON.stringify({
      mutations: entries.map((pending) => ({
        sourceId: pending.sourceId,
        trackId: pending.trackId,
        status: pending.desiredState.status,
        registered: pending.baseState.registered,
        options: {
allowNextSongApply: pending.desiredState.allowNextSongApply,
allowFollowerSave: pending.desiredState.allowFollowerSave,
profilePinned: pending.desiredState.profilePinned,
        },
        mutationAt: pending.updatedAt,
      })),
    }),
  });
  const rows = Array.isArray(payload?.data?.results) ? payload.data.results : [];
  const resultBySource = new Map(rows.map((row: any) => [String(row?.sourceId || ''), row]));
  const latestOutbox = readPublicationOutbox(uid);
  const states = readPublicationStateCache(uid) || {};
  let failed = false;

  for (const pending of entries) {
    const row: any = resultBySource.get(pending.sourceId);
    if (!row?.ok) {
      failed = true;
      continue;
    }
    const confirmed: ExploreMusicNotePublicationState = {
      status: row.status === 'public' ? 'public' : 'private',
      trackId: String(row.trackId || pending.trackId),
      registered: row.registered !== false,
      allowNextSongApply: Boolean(row.allowNextSongApply),
      allowFollowerSave: Boolean(row.allowFollowerSave),
      profilePinned: Boolean(row.profilePinned),
    };
    const latest = latestOutbox[pending.sourceId];
    let visibleState = confirmed;
    if (latest && latest.updatedAt !== pending.updatedAt) {
      const rebased = { ...latest, baseState: confirmed };
      if (samePublicationState(rebased.baseState, rebased.desiredState)) {
        delete latestOutbox[pending.sourceId];
        visibleState = confirmed;
      } else {
        latestOutbox[pending.sourceId] = rebased;
        visibleState = rebased.desiredState;
      }
    } else {
      delete latestOutbox[pending.sourceId];
    }
    states[pending.sourceId] = { ...visibleState };

    if (visibleState.status === 'private') {
      removeExploreFeedSessionCacheRow(visibleState.trackId);
      removeExplorePublicProfileFirstViewTrack(uid, visibleState.trackId);
    } else if (row.snapshotItem && typeof row.snapshotItem === 'object' && !Array.isArray(row.snapshotItem)) {
      upsertExploreFeedSessionCacheRow(visibleState.trackId, row.snapshotItem as Record<string, unknown>);
      upsertExplorePublicProfileFirstViewTrack(uid, row.snapshotItem as Record<string, unknown>);
    }
  }

  persistPublicationOutbox(uid, latestOutbox);
  const revision = String(payload?.data?.revision || '').trim();
  writePublicationStateCache(uid, states, revision || undefined);
  publicationServerValidatedUids.add(uid);
  if (failed || Object.keys(latestOutbox).length > 0) {
    throw new ExploreApiError('PUBLICATION_BATCH_PENDING', '일부 공개상태 변경을 반영하지 못했습니다. 다음 페이지 이동 또는 재접속에서 다시 시도합니다.');
  }
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
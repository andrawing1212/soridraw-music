import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import type { User } from 'firebase/auth';
import { ref as databaseRef, runTransaction } from 'firebase/database';
import { getFirebaseAppCheckToken, realtimeDb } from '../firebase';
import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';
import {
  readSoridrawPersistentCache,
  removeSoridrawPersistentCache,
  writeSoridrawPersistentCache,
} from '../lib/soridrawPersistentCache';
import {
  getExplorePersonalSocialSnapshot,
  patchExplorePersonalSocialLike,
} from './exploreSocialSnapshotService';
import { patchExploreLikedTrackMembership } from './exploreLikedTracksService';
import {
  confirmExploreLikeDisplayTransition094,
  rebaseExploreLikePendingDisplay094,
  beginExploreLikeDisplayTransition091,
  getExploreLikeCanonicalCount091,
  getExploreLikeDisplayCount091,
} from './exploreLikeDisplayStateService';

// SORIDRAW_LONG_TERM_CACHE_STAGE_2_3_990
// SORIDRAW_EXPLORE_LIKE_BATCH_034_20260911
// SORIDRAW_EXPLORE_LIKE_PREVIEW_1MIN_TEST_037_20260911
// SORIDRAW_EXPLORE_LIKE_ACCOUNT_SIGNAL_058_20260911
// SORIDRAW_EXPLORE_LIKE_ACCOUNT_COUNT_REPLAY_065_20260911
// SORIDRAW_EXPLORE_LIKE_VISIBLE_COUNT_SIGNAL_067_20260911
// SORIDRAW_EXPLORE_LIKE_W1_DELAYED_COUNT_069_20260912
// SORIDRAW_EXPLORE_LIKE_LOCAL_VISIBLE_COUNT_074_20260912
// SORIDRAW_EXPLORE_SOCIAL_SNAPSHOT_075_20260913
// SORIDRAW_PAGE_EXIT_LIKE_OUTBOX_081_20260914
// SORIDRAW_EXPLORE_UID_SCOPED_SYNC_EVENT_075_20260913
// SORIDRAW_EXPLORE_LIKE_MISSED_SIGNAL_REPAIR_086_20260914
// SORIDRAW_EXPLORE_LIKED_CARD_CONSISTENCY_087_20260914
// SORIDRAW_EXPLORE_SAME_SESSION_PENDING_LIKE_088_20260914
// SORIDRAW_EXPLORE_CROSS_DEVICE_CANONICAL_DISPLAY_089_20260914
// SORIDRAW_EXPLORE_LIKE_LIVE_DISPLAY_090_20260915
// SORIDRAW_EXPLORE_SHARED_DISPLAY_COUNT_091_20260915
// SORIDRAW_EXPLORE_LIKE_RTDB_SIGNAL_093_20260915
// SORIDRAW_EXPLORE_SESSION_BATCH_094_20260915
// SORIDRAW_EXPLORE_ACKNOWLEDGED_COUNT_094_20260915
// SORIDRAW_EXPLORE_LIKE_CROSS_DEVICE_REPLAY_096_20260915
// SORIDRAW_EXPLORE_LIKE_REMOTE_PENDING_ACK_097_20260916
// SORIDRAW_EXPLORE_LIKE_ATOMIC_SIGNAL_098_20260916
// SORIDRAW_EXPLORE_UPDATE_ZERO_READ_099_20260916
// SORIDRAW_EXPLORE_PUBLIC_COUNT_SOURCE_SEPARATION_106_20260916
const EXPLORE_LIKE_CACHE_SCHEMA_VERSION = 2;
const EXPLORE_LIKE_CACHE_KEY = 'explore-liked-state';
const EXPLORE_LIKE_SOURCE_TYPE = 'explore_likes';
const EXPLORE_LIKE_OUTBOX_SCHEMA_VERSION = 1;
const EXPLORE_LIKE_OUTBOX_CACHE_KEY = 'explore-like-outbox';
const EXPLORE_LIKE_OUTBOX_SOURCE_TYPE = 'explore_like_outbox';
const EXPLORE_LIKE_ACCOUNT_PATCH_SCHEMA_VERSION = 2;
const EXPLORE_LIKE_ACCOUNT_PATCH_CACHE_KEY = 'explore-like-account-patches';
const EXPLORE_LIKE_ACCOUNT_PATCH_SOURCE_TYPE = 'explore_like_account_patches';
const EXPLORE_LIKE_ACCOUNT_PATCH_TTL_MS = 20 * 60_000;
const EXPLORE_LIKE_BATCH_MAX = 50;
// SORIDRAW_EXPLORE_LIKE_CLIENT_EVENT_WINDOW_104_20260916
// SORIDRAW_EXPLORE_LIKE_CLIENT_EVENT_WINDOW_105_20260916
// The first real local like change starts the PREVIEW server-side one-minute
// aggregate window. Later changes stay local and are flushed once near the end
// of that window, so repeated toggles collapse to the final desired state.
const EXPLORE_LIKE_EVENT_WINDOW_MS_105 = 1 * 60_000;
const EXPLORE_LIKE_FINAL_FLUSH_LEAD_MS_104 = 15_000;
type ExploreLikeEventWindow104 = {
  startedAt: number;
  finalFlushTimer: number;
};
const exploreLikeEventWindowByUid104 = new Map<string, ExploreLikeEventWindow104>();

export const EXPLORE_LIKE_SYNC_EVENT = 'soridraw:explore-like-sync';
export const EXPLORE_LIKE_SYNC_ERROR_EVENT = 'soridraw:explore-like-sync-error';
export const EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT = 'soridraw:explore-like-account-invalidation';
const EXPLORE_LIKE_ACCOUNT_SIGNAL_VERSION_STORAGE_BASE = 'soridraw_explore_like_account_signal_v1';

type ExploreLikePendingMutation = {
  trackId: string;
  ownerUid: string;
  baseLiked: boolean;
  desiredLiked: boolean;
  baseLikeCount: number;
  optimisticLikeCount: number;
  queuedAt: number;
  updatedAt: number;
  retryCount: number;
};

type ExploreLikeOutbox = Record<string, ExploreLikePendingMutation>;

type ExploreLikeSyncEventDetail = {
  uid: string;
  trackId: string;
  ownerUid: string;
  liked: boolean;
  likeCount: number;
  displayLikeCount?: number;
};

type ExploreLikeBatchResult = {
  trackId: string;
  liked: boolean;
  likeCount: number;
};

type ExploreLikeAccountSyncResult = ExploreLikeBatchResult & {
  ownerUid: string;
  displayLikeCount?: number;
};

type ExploreLikeAccountSyncSignal = {
  version: number;
  previousVersion: number;
  results: ExploreLikeAccountSyncResult[];
};

type ExploreLikeAccountPatch = ExploreLikeAccountSyncResult & {
  updatedAt: number;
  expiresAt: number;
};

type ExploreLikeAccountPatchCache = Record<string, ExploreLikeAccountPatch>;

const likedStateByUid = new Map<string, Map<string, boolean>>();
const inflightByUid = new Map<string, ExploreLikeOutbox>();
const observedAccountSignalVersionByUid = new Map<string, number>();

const getAccountSignalVersionStorageKey = (uid: string) => `${EXPLORE_LIKE_ACCOUNT_SIGNAL_VERSION_STORAGE_BASE}_${uid}`;

const readSeenAccountSignalVersion = (uid: string) => {
  if (!uid || typeof localStorage === 'undefined') return 0;
  try {
    const value = Number(localStorage.getItem(getAccountSignalVersionStorageKey(uid)) || 0);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
};

const setSeenAccountSignalVersion = (uid: string, version: number) => {
  if (!uid || typeof localStorage === 'undefined') return;
  try {
    if (Number.isFinite(version) && version > 0) {
      localStorage.setItem(getAccountSignalVersionStorageKey(uid), String(Math.floor(version)));
    } else {
      localStorage.removeItem(getAccountSignalVersionStorageKey(uid));
    }
  } catch {}
};

const normalizeAccountSyncSignal = (value: unknown): ExploreLikeAccountSyncSignal | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const version = Math.max(0, Math.floor(Number(raw.version || 0)));
  const previousVersion = Math.max(0, Math.floor(Number(raw.previousVersion || 0)));
  const rows = Array.isArray(raw.results) ? raw.results : [];
  if (!version || rows.length > EXPLORE_LIKE_BATCH_MAX) return null;
  const results: ExploreLikeAccountSyncResult[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const item = row as Record<string, unknown>;
    const trackId = String(item.trackId || '').trim();
    if (!trackId) continue;
    const displayLikeCount = Number(item.displayLikeCount);
    results.push({
      trackId,
      ownerUid: String(item.ownerUid || '').trim(),
      liked: Boolean(item.liked),
      likeCount: clampLikeCount(item.likeCount),
      ...(Number.isFinite(displayLikeCount) ? { displayLikeCount: clampLikeCount(displayLikeCount) } : {}),
    });
  }
  if (results.length !== rows.length) return null;
  return { version, previousVersion, results };
};

const clampLikeCount = (value: unknown) => {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
};

const readAccountPatchCache = (uid: string): ExploreLikeAccountPatchCache => {
  const envelope = readSoridrawPersistentCache<ExploreLikeAccountPatchCache>({
    cacheKey: EXPLORE_LIKE_ACCOUNT_PATCH_CACHE_KEY,
    sourceType: EXPLORE_LIKE_ACCOUNT_PATCH_SOURCE_TYPE,
    schemaVersion: EXPLORE_LIKE_ACCOUNT_PATCH_SCHEMA_VERSION,
    uid,
  });
  if (!envelope?.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) return {};

  const now = Date.now();
  const next: ExploreLikeAccountPatchCache = {};
  let changed = false;
  for (const [trackId, value] of Object.entries(envelope.data)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      changed = true;
      continue;
    }
    const patch = value as Partial<ExploreLikeAccountPatch>;
    const normalizedTrackId = String(patch.trackId || trackId || '').trim();
    const expiresAt = Math.max(0, Number(patch.expiresAt || 0));
    if (!normalizedTrackId || normalizedTrackId !== trackId || !expiresAt || expiresAt <= now || typeof patch.liked !== 'boolean') {
      changed = true;
      continue;
    }
    const displayLikeCount = Number(patch.displayLikeCount);
    next[trackId] = {
      trackId,
      ownerUid: String(patch.ownerUid || '').trim(),
      liked: patch.liked,
      likeCount: clampLikeCount(patch.likeCount),
      ...(Number.isFinite(displayLikeCount) ? { displayLikeCount: clampLikeCount(displayLikeCount) } : {}),
      updatedAt: Math.max(0, Number(patch.updatedAt || 0)),
      expiresAt,
    };
  }

  if (changed) {
    if (!Object.keys(next).length) {
      removeSoridrawPersistentCache(EXPLORE_LIKE_ACCOUNT_PATCH_CACHE_KEY, uid);
    } else {
      writeSoridrawPersistentCache<ExploreLikeAccountPatchCache>({
        cacheKey: EXPLORE_LIKE_ACCOUNT_PATCH_CACHE_KEY,
        sourceType: EXPLORE_LIKE_ACCOUNT_PATCH_SOURCE_TYPE,
        schemaVersion: EXPLORE_LIKE_ACCOUNT_PATCH_SCHEMA_VERSION,
        dataVersion: 0,
        uid,
        syncCursor: null,
        serverRevision: null,
        deletedIds: [],
        expiresAt: null,
        dirty: false,
        pendingMutationId: null,
        data: next,
      });
    }
  }
  return next;
};

const persistAccountPatchCache = (uid: string, cache: ExploreLikeAccountPatchCache) => {
  if (!Object.keys(cache).length) {
    removeSoridrawPersistentCache(EXPLORE_LIKE_ACCOUNT_PATCH_CACHE_KEY, uid);
    return;
  }
  writeSoridrawPersistentCache<ExploreLikeAccountPatchCache>({
    cacheKey: EXPLORE_LIKE_ACCOUNT_PATCH_CACHE_KEY,
    sourceType: EXPLORE_LIKE_ACCOUNT_PATCH_SOURCE_TYPE,
    schemaVersion: EXPLORE_LIKE_ACCOUNT_PATCH_SCHEMA_VERSION,
    dataVersion: 0,
    uid,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: false,
    pendingMutationId: null,
    data: cache,
  });
};

const rememberAccountSyncResults = (uid: string, results: ExploreLikeAccountSyncResult[]) => {
  if (!uid || !results.length) return;
  const cache = readAccountPatchCache(uid);
  const now = Date.now();
  const expiresAt = now + EXPLORE_LIKE_ACCOUNT_PATCH_TTL_MS;
  for (const result of results) {
    cache[result.trackId] = {
      trackId: result.trackId,
      ownerUid: result.ownerUid,
      liked: result.liked,
      likeCount: clampLikeCount(result.likeCount),
      ...(result.displayLikeCount === undefined ? {} : { displayLikeCount: clampLikeCount(result.displayLikeCount) }),
      updatedAt: now,
      expiresAt,
    };
    patchExplorePersonalSocialLike(uid, result.trackId, result.liked);
  }
  persistAccountPatchCache(uid, cache);
};

const readLikedStateStorage = (uid: string): Map<string, boolean> => {
  const values = new Map<string, boolean>();
  const envelope = readSoridrawPersistentCache<Record<string, boolean>>({
    cacheKey: EXPLORE_LIKE_CACHE_KEY,
    sourceType: EXPLORE_LIKE_SOURCE_TYPE,
    schemaVersion: EXPLORE_LIKE_CACHE_SCHEMA_VERSION,
    uid,
  });
  if (!envelope?.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) return values;
  Object.entries(envelope.data).forEach(([trackId, liked]) => {
    if (trackId && typeof liked === 'boolean') values.set(trackId, liked);
  });
  return values;
};

const persistLikedStateCache = (uid: string, cache: Map<string, boolean>) => {
  writeSoridrawPersistentCache<Record<string, boolean>>({
    cacheKey: EXPLORE_LIKE_CACHE_KEY,
    sourceType: EXPLORE_LIKE_SOURCE_TYPE,
    schemaVersion: EXPLORE_LIKE_CACHE_SCHEMA_VERSION,
    dataVersion: 0,
    uid,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: false,
    pendingMutationId: null,
    data: Object.fromEntries(cache),
  });
};

const getLikedStateCache = (uid: string) => {
  const normalizedUid = String(uid || '').trim();
  let cache = likedStateByUid.get(normalizedUid);
  if (!cache) {
    cache = readLikedStateStorage(normalizedUid);
    likedStateByUid.set(normalizedUid, cache);
  }
  return cache;
};

const normalizePendingMutation = (value: unknown): ExploreLikePendingMutation | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Partial<ExploreLikePendingMutation>;
  const trackId = String(row.trackId || '').trim();
  if (!trackId || typeof row.baseLiked !== 'boolean' || typeof row.desiredLiked !== 'boolean') return null;
  const updatedAt = Math.max(0, Number(row.updatedAt || 0));
  return {
    trackId,
    ownerUid: String(row.ownerUid || '').trim(),
    baseLiked: row.baseLiked,
    desiredLiked: row.desiredLiked,
    baseLikeCount: clampLikeCount(row.baseLikeCount),
    optimisticLikeCount: clampLikeCount(row.optimisticLikeCount),
    queuedAt: Math.max(0, Number(row.queuedAt || updatedAt)),
    updatedAt,
    retryCount: Math.max(0, Math.floor(Number(row.retryCount || 0))),
  };
};

const readLikeOutbox = (uid: string): ExploreLikeOutbox => {
  const envelope = readSoridrawPersistentCache<ExploreLikeOutbox>({
    cacheKey: EXPLORE_LIKE_OUTBOX_CACHE_KEY,
    sourceType: EXPLORE_LIKE_OUTBOX_SOURCE_TYPE,
    schemaVersion: EXPLORE_LIKE_OUTBOX_SCHEMA_VERSION,
    uid,
  });
  if (!envelope?.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) return {};
  return Object.entries(envelope.data).reduce<ExploreLikeOutbox>((acc, [trackId, value]) => {
    const normalized = normalizePendingMutation(value);
    if (normalized && normalized.trackId === trackId) acc[trackId] = normalized;
    return acc;
  }, {});
};

const persistLikeOutbox = (uid: string, outbox: ExploreLikeOutbox) => {
  if (!Object.keys(outbox).length) {
    removeSoridrawPersistentCache(EXPLORE_LIKE_OUTBOX_CACHE_KEY, uid);
    return;
  }
  writeSoridrawPersistentCache<ExploreLikeOutbox>({
    cacheKey: EXPLORE_LIKE_OUTBOX_CACHE_KEY,
    sourceType: EXPLORE_LIKE_OUTBOX_SOURCE_TYPE,
    schemaVersion: EXPLORE_LIKE_OUTBOX_SCHEMA_VERSION,
    dataVersion: 0,
    uid,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: true,
    pendingMutationId: 'explore-like-pending',
    data: outbox,
  });
};


export const getPendingExploreLikeMutationCount = (uid: string): number => Object.values(readLikeOutbox(uid))
  .filter((pending) => pending.desiredLiked !== pending.baseLiked)
  .length;

const dispatchLikeSync = (detail: ExploreLikeSyncEventDetail) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ExploreLikeSyncEventDetail>(EXPLORE_LIKE_SYNC_EVENT, { detail }));
};

const dispatchLikeSyncError = (detail: ExploreLikeSyncEventDetail & { message: string }) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EXPLORE_LIKE_SYNC_ERROR_EVENT, { detail }));
};

export const observeExploreLikeAccountSyncSignal = (user: User, value: unknown) => {
  const signal = normalizeAccountSyncSignal(value);
  if (!signal || !user?.uid) return;
  const uid = user.uid;
  const seenVersion = readSeenAccountSignalVersion(uid);
  observedAccountSignalVersionByUid.set(
    uid,
    Math.max(observedAccountSignalVersionByUid.get(uid) || 0, signal.version),
  );
  if (signal.version <= seenVersion) return;


// 099: a version gap/reconnect is not cache corruption. 098 already retains
// recent approved deltas in RTDB, so preserve known-good local membership,
// card and social caches and merge only the retained results below. Never turn
// an app update or wake-up into a full liked-track verification/read.
const cache = getLikedStateCache(uid);

  // 097: a local pending click should win only while it disagrees with the
  // server-acknowledged account signal. If both already describe the same liked
  // state, the durable pending row is stale/redundant: clear it and accept the
  // remote display count too. This lets a sleeping second device converge without
  // adding a D1/Firestore recovery read or requiring the user to clear app cache.
  const pendingOutbox = readLikeOutbox(uid);
  let pendingOutboxChanged = false;
  const effectiveResults = signal.results.map((result) => {
    const pending = pendingOutbox[result.trackId];
    if (!pending) return result;
    if (pending.desiredLiked === result.liked) {
      delete pendingOutbox[result.trackId];
      pendingOutboxChanged = true;
      return result;
    }
    return { ...result, liked: pending.desiredLiked };
  });
  if (pendingOutboxChanged) persistLikeOutbox(uid, pendingOutbox);
  rememberAccountSyncResults(uid, effectiveResults);
  for (const result of effectiveResults) {
    // 106 final rule: account RTDB synchronizes only personal heart membership.
    // Its likeCount/displayLikeCount fields remain parse-compatible for older
    // clients, but this client never uses them to alter the public number.
    cache.set(result.trackId, result.liked);
    patchExploreLikedTrackMembership(uid, result.trackId, result.liked);
    dispatchLikeSync({
      uid: user.uid,
      trackId: result.trackId,
      ownerUid: result.ownerUid,
      liked: result.liked,
      likeCount: result.likeCount,
    });
  }
  persistLikedStateCache(uid, cache);
  setSeenAccountSignalVersion(uid, signal.version);

};

const publishExploreLikeAccountSyncSignal = async (
  user: User,
  batchEntries: ExploreLikePendingMutation[],
  results: Array<ExploreLikeBatchResult & { displayLikeCount?: number }>,
) => {
  if (!user?.uid || !results.length) return;
  const uid = user.uid;
  const ownerByTrack = new Map(batchEntries.map((pending) => [pending.trackId, pending.ownerUid]));
  const currentConfirmedResults: ExploreLikeAccountSyncResult[] = results.map((result) => ({
    ...result,
    ownerUid: ownerByTrack.get(result.trackId) || '',
  }));

  // 098: 093-097 could blind-overwrite another device's retained rows
  // because set() rebuilt the whole signal from only this browser's cache.
  // Merge the just-confirmed D1 batch against RTDB's actual latest value.
  // Firebase retries this transaction on concurrent PC/mobile writes.
  try {
    const transaction = await runTransaction(
      databaseRef(realtimeDb, `userSync/${uid}/exploreLike`),
      (currentValue) => {
        const currentSignal = normalizeAccountSyncSignal(currentValue);
        const mergedByTrack = new Map<string, ExploreLikeAccountSyncResult>();
        for (const currentResult of currentConfirmedResults) {
          mergedByTrack.set(currentResult.trackId, currentResult);
        }
        for (const existing of currentSignal?.results || []) {
          if (mergedByTrack.size >= EXPLORE_LIKE_BATCH_MAX) break;
          if (!mergedByTrack.has(existing.trackId)) mergedByTrack.set(existing.trackId, existing);
        }
        const previousVersion = Math.max(0, currentSignal?.version || 0);
        const version = Math.max(Date.now(), previousVersion + 1);
        return {
          version,
          previousVersion,
          results: [...mergedByTrack.values()].slice(0, EXPLORE_LIKE_BATCH_MAX),
        } satisfies ExploreLikeAccountSyncSignal;
      },
      { applyLocally: false },
    );

    const committedSignal = transaction.committed
      ? normalizeAccountSyncSignal(transaction.snapshot.val())
      : null;
    if (!committedSignal) return;
    setSeenAccountSignalVersion(uid, committedSignal.version);
    observedAccountSignalVersionByUid.set(
      uid,
      Math.max(observedAccountSignalVersionByUid.get(uid) || 0, committedSignal.version),
    );
  } catch (reason) {
    // D1 already acknowledged this batch; never undo canonical like data.
    console.warn('Explore account like atomic RTDB sync signal publish failed:', reason);
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
  recordCloudflareResponse(response, path);
  const payload = await readPayload(response);

  if (!response.ok) {
    const message = String(payload?.message || payload?.error?.message || payload?.error || '좋아요 요청을 처리하지 못했습니다.').trim();
    throw new Error(message || '좋아요 요청을 처리하지 못했습니다.');
  }

  return payload;
};

const getInflightMutation = (uid: string, trackId: string) => inflightByUid.get(uid)?.[trackId];

const normalizeBatchResults = (payload: unknown, expectedTrackIds: string[]): ExploreLikeBatchResult[] => {
  const body = payload && typeof payload === 'object' ? payload as { data?: { results?: unknown[] } } : null;
  const rows = Array.isArray(body?.data?.results) ? body.data.results : [];
  const expected = new Set(expectedTrackIds);
  const results: ExploreLikeBatchResult[] = [];
  for (const value of rows) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const trackId = String(row.trackId || '').trim();
    if (!trackId || !expected.has(trackId)) continue;
    results.push({
      trackId,
      liked: Boolean(row.liked),
      likeCount: clampLikeCount(row.likeCount),
    });
  }
  if (results.length !== expected.size || new Set(results.map((result) => result.trackId)).size !== expected.size) {
    throw new Error('좋아요 묶음 응답을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
  return results;
};

const flushPendingLikes = async (user: User): Promise<void> => {
  const uid = user.uid;
  if (inflightByUid.has(uid)) return;

  const outbox = readLikeOutbox(uid);
  let changed = false;
  for (const [trackId, pending] of Object.entries(outbox)) {
    if (pending.desiredLiked !== pending.baseLiked) continue;
    delete outbox[trackId];
    changed = true;
  }
  if (changed) persistLikeOutbox(uid, outbox);

  const batchEntries = Object.values(outbox)
    .sort((a, b) => (a.queuedAt || a.updatedAt) - (b.queuedAt || b.updatedAt))
    .slice(0, EXPLORE_LIKE_BATCH_MAX);
  if (!batchEntries.length) return;

  const snapshot = Object.fromEntries(batchEntries.map((pending) => [pending.trackId, { ...pending }])) as ExploreLikeOutbox;
  inflightByUid.set(uid, snapshot);

  try {
    const payload = await requestExploreLike(user, '/v1/me/likes/batch', {
      method: 'POST',
      body: JSON.stringify({
        mutations: batchEntries.map((pending) => ({
          trackId: pending.trackId,
          liked: pending.desiredLiked,
          baseLiked: pending.baseLiked,
          mutationAt: pending.updatedAt,
        })),
      }),
    });
    const results = normalizeBatchResults(payload, batchEntries.map((pending) => pending.trackId));
    const resultByTrack = new Map(results.map((result) => [result.trackId, result]));
    const confirmedCache = getLikedStateCache(uid);
    const latestOutbox = readLikeOutbox(uid);
    const accountSyncResults: Array<ExploreLikeBatchResult & { displayLikeCount?: number }> = [];
    const accountReplayResults: ExploreLikeAccountSyncResult[] = [];

    for (const pending of batchEntries) {
      const result = resultByTrack.get(pending.trackId);
      if (!result) continue;
      confirmedCache.set(result.trackId, result.liked);

      const latest = latestOutbox[pending.trackId];
      // 094: once this exact queued transition is acknowledged, keep its
      // visible +/- delta stable until the deferred public aggregate catches up.
      // This is not a liked=>1 guess: the value comes from the acknowledged
      // transition's own base count + actual state change.
      const acknowledgedDisplayLikeCount = clampLikeCount(
        pending.baseLikeCount + Number(result.liked) - Number(pending.baseLiked),
      );
      let visibleLiked = result.liked;
      let visibleDisplayLikeCount = acknowledgedDisplayLikeCount;
      let ownerUid = pending.ownerUid;

      const hasNewerPending = Boolean(latest && latest.updatedAt !== pending.updatedAt);
      if (hasNewerPending && latest) {
        ownerUid = latest.ownerUid || ownerUid;
        latest.baseLiked = result.liked;
        latest.baseLikeCount = acknowledgedDisplayLikeCount;
        latest.retryCount = 0;
        visibleLiked = latest.desiredLiked;
        visibleDisplayLikeCount = rebaseExploreLikePendingDisplay094(
          uid,
          result.trackId,
          ownerUid,
          result.liked,
          latest.desiredLiked,
          acknowledgedDisplayLikeCount,
        );
        latest.optimisticLikeCount = visibleDisplayLikeCount;
        if (latest.desiredLiked === result.liked) {
          delete latestOutbox[pending.trackId];
          visibleDisplayLikeCount = confirmExploreLikeDisplayTransition094(
            uid,
            result.trackId,
            ownerUid,
            pending.baseLiked,
            result.liked,
            pending.baseLikeCount,
            acknowledgedDisplayLikeCount,
          );
        } else {
          latestOutbox[pending.trackId] = latest;
        }
      } else {
        delete latestOutbox[pending.trackId];
        visibleDisplayLikeCount = confirmExploreLikeDisplayTransition094(
          uid,
          result.trackId,
          ownerUid,
          pending.baseLiked,
          result.liked,
          pending.baseLikeCount,
          acknowledgedDisplayLikeCount,
        );
      }

      // Cross-device RTDB carries only the server-acknowledged transition.
      // A newer local click remains local/outbox until its own boundary flush.
      // 106: RTDB/account replay carries membership plus the server response only.
      // The optimistic display number is device-local and must not become a public total.
      const confirmedResult = {
        trackId: result.trackId,
        liked: result.liked,
        likeCount: result.likeCount,
      };
      accountSyncResults.push(confirmedResult);
      accountReplayResults.push({ ...confirmedResult, ownerUid });
      dispatchLikeSync({
        uid,
        trackId: result.trackId,
        ownerUid,
        liked: visibleLiked,
        likeCount: result.likeCount,
        displayLikeCount: visibleDisplayLikeCount,
      });
    }

    persistLikedStateCache(uid, confirmedCache);
    persistLikeOutbox(uid, latestOutbox);
    rememberAccountSyncResults(uid, accountReplayResults);
    await publishExploreLikeAccountSyncSignal(user, batchEntries, accountSyncResults);
  } catch (reason) {
    const latestOutbox = readLikeOutbox(uid);
    let firstPending: ExploreLikePendingMutation | null = null;
    for (const pending of batchEntries) {
      const latest = latestOutbox[pending.trackId] || pending;
      if (latest.updatedAt === pending.updatedAt) {
        latest.retryCount = Math.min(8, latest.retryCount + 1);
        // Keep updatedAt stable for idempotent replay. 094 deliberately has no
        // retry timer: the durable outbox retries at the next meaningful boundary.
        latestOutbox[pending.trackId] = latest;
      }
      firstPending ||= latest;
    }
    persistLikeOutbox(uid, latestOutbox);

    if (firstPending) {
      dispatchLikeSyncError({
        uid,
        trackId: firstPending.trackId,
        ownerUid: firstPending.ownerUid,
        liked: firstPending.desiredLiked,
        likeCount: firstPending.optimisticLikeCount,
        message: reason instanceof Error ? reason.message : '좋아요 변경분을 기기에 보관했습니다. 다음 화면 이동 때 다시 동기화합니다.',
      });
    }
  } finally {
    inflightByUid.delete(uid);
  }
};


const waitForExploreLikeInflight094 = async (uid: string) => {
  const startedAt = Date.now();
  while (inflightByUid.has(uid) && Date.now() - startedAt < 5_000) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 25));
  }
};

export const flushPendingExploreLikesForPageExit = async (user: User): Promise<void> => {
  await waitForExploreLikeInflight094(user.uid);
  let previousPending = Number.POSITIVE_INFINITY;
  while (true) {
    const pending = getPendingExploreLikeMutationCount(user.uid);
    if (pending <= 0) return;
    if (pending >= previousPending) {
      throw new Error('좋아요 변경분을 서버에 반영하지 못했습니다. 다음 페이지 이동 또는 재접속에서 다시 시도합니다.');
    }
    previousPending = pending;
    await flushPendingLikes(user);
    await waitForExploreLikeInflight094(user.uid);
  }
};


const beginExploreLikeEventWindow104 = (user: User, now = Date.now()) => {
  const uid = user.uid;
  const finalFlushDelay = EXPLORE_LIKE_EVENT_WINDOW_MS_105 - EXPLORE_LIKE_FINAL_FLUSH_LEAD_MS_104;
  const active = exploreLikeEventWindowByUid104.get(uid);
  if (active && now - active.startedAt < finalFlushDelay) return false;
  if (active) window.clearTimeout(active.finalFlushTimer);

  const startedAt = now;
  const finalFlushTimer = window.setTimeout(() => {
    const current = exploreLikeEventWindowByUid104.get(uid);
    if (!current || current.startedAt != startedAt) return;
    exploreLikeEventWindowByUid104.delete(uid);
    // No request is made when the outbox is already empty. If later toggles
    // exist, this sends their final states before the server aggregate alarm.
    void flushPendingLikes(user);
  }, finalFlushDelay);

  exploreLikeEventWindowByUid104.set(uid, { startedAt, finalFlushTimer });
  return true;
};

export const getExploreLikedTrackIds = async (user: User, trackIds: string[]): Promise<string[]> => {
  const normalized = [...new Set(trackIds.map((trackId) => String(trackId || '').trim()).filter(Boolean))].slice(0, 50);
  if (!normalized.length) return [];

  // 094: reading/hydrating Explore must never flush the durable outbox.
  const cache = getLikedStateCache(user.uid);
  const missing = normalized.filter((trackId) => !cache.has(trackId));
  if (missing.length) {
    let resolved = false;
    try {
      const snapshot = await getExplorePersonalSocialSnapshot(user);
      const likedIds = new Set(snapshot.likedTrackIds);
      missing.forEach((trackId) => cache.set(trackId, likedIds.has(trackId)));
      resolved = true;
    } catch (snapshotError) {
      console.warn('[Explore like] Social Snapshot unavailable; using targeted likes recovery.', snapshotError);
    }
    if (!resolved) {
      const query = new URLSearchParams({ trackIds: missing.join(',') });
      const payload = await requestExploreLike(user, `/v1/me/likes?${query.toString()}`);
      const likedIds = new Set(
        Array.isArray(payload?.data?.likedTrackIds)
          ? payload.data.likedTrackIds.map((trackId: unknown) => String(trackId || '').trim()).filter(Boolean)
          : [],
      );
      missing.forEach((trackId) => cache.set(trackId, likedIds.has(trackId)));
    }
    persistLikedStateCache(user.uid, cache);
  }

  const outbox = readLikeOutbox(user.uid);

  // 088: outbox/current liked-state are the heart source of truth. Historical
  // account patches remain available only to getExploreLikeDisplayCounts().
  return normalized.filter((trackId) => outbox[trackId]?.desiredLiked ?? cache.get(trackId) === true);
};


export const reconcileExploreLikedTrackCollectionState = (
  uid: string,
  canonicalLikedTrackIds: string[],
): string[] => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return [];

  const canonical = new Set(
    canonicalLikedTrackIds.map((trackId) => String(trackId || '').trim()).filter(Boolean),
  );
  const cache = getLikedStateCache(normalizedUid);
  const outbox = readLikeOutbox(normalizedUid);
  const scope = new Set<string>([
    ...cache.keys(),
    ...canonical,
    ...Object.keys(outbox),
  ]);
  const effectiveLikedTrackIds: string[] = [];
  let changed = false;

  for (const trackId of scope) {
    const pending = outbox[trackId];
    const nextLiked = pending ? pending.desiredLiked : canonical.has(trackId);
    if (cache.get(trackId) !== nextLiked) {
      cache.set(trackId, nextLiked);
      changed = true;
    }
    if (nextLiked) effectiveLikedTrackIds.push(trackId);
  }

  if (changed) persistLikedStateCache(normalizedUid, cache);
  return effectiveLikedTrackIds;
};


export const getExploreLikeDisplayCounts = (
  _user: User,
  _trackIds: string[],
): Record<string, number> => ({});

export const setExploreTrackLike = async (
  user: User,
  trackId: string,
  liked: boolean,
  currentLikeCount = 0,
  ownerUid = '',
): Promise<{ trackId: string; liked: boolean; likeCount: number }> => {
  const normalizedTrackId = String(trackId || '').trim();
  if (!normalizedTrackId) throw new Error('Explore 곡 ID를 확인하지 못했습니다.');
  const outbox = readLikeOutbox(user.uid);
  const existing = outbox[normalizedTrackId];
  const inflight = getInflightMutation(user.uid, normalizedTrackId);
  const optimisticLikedCache = getLikedStateCache(user.uid);
  const previousVisibleLiked = existing?.desiredLiked ?? inflight?.desiredLiked ?? optimisticLikedCache.get(normalizedTrackId) ?? !liked;
  const canonicalLikeCount = getExploreLikeCanonicalCount091(user.uid, normalizedTrackId, currentLikeCount);
  const baselineLiked = inflight?.desiredLiked ?? existing?.baseLiked ?? previousVisibleLiked;
  const baselineLikeCount = existing?.baseLikeCount ?? canonicalLikeCount;
  const optimisticLikeCount = beginExploreLikeDisplayTransition091(
    user.uid, normalizedTrackId, ownerUid, previousVisibleLiked, liked, canonicalLikeCount,
  );
  patchExplorePersonalSocialLike(user.uid, normalizedTrackId, liked);
  patchExploreLikedTrackMembership(user.uid, normalizedTrackId, liked);
  optimisticLikedCache.set(normalizedTrackId, liked);
  persistLikedStateCache(user.uid, optimisticLikedCache);
  if (!inflight && liked === baselineLiked) {
    delete outbox[normalizedTrackId];
    persistLikeOutbox(user.uid, outbox);
    return { trackId: normalizedTrackId, liked, likeCount: optimisticLikeCount };
  }
  const now = Date.now();
  outbox[normalizedTrackId] = {
    trackId: normalizedTrackId,
    ownerUid: String(ownerUid || existing?.ownerUid || inflight?.ownerUid || '').trim(),
    baseLiked: baselineLiked,
    desiredLiked: liked,
    baseLikeCount: baselineLikeCount,
    optimisticLikeCount,
    queuedAt: existing?.queuedAt || now,
    updatedAt: now,
    retryCount: 0,
  };
  persistLikeOutbox(user.uid, outbox);
  // 105: start one one-minute server aggregate window on the first real
  // change, then keep later clicks local until the single near-deadline flush.
  // This preserves idle=0 and avoids one server request per click.
  const startedEventWindow104 = beginExploreLikeEventWindow104(user, now);
  if (startedEventWindow104) {
    void flushPendingLikes(user);
  } else if (getPendingExploreLikeMutationCount(user.uid) >= EXPLORE_LIKE_BATCH_MAX) {
    void flushPendingLikes(user);
  }
  return { trackId: normalizedTrackId, liked, likeCount: optimisticLikeCount };
};

import { EXPLORE_API_BASE, EXPLORE_ENVIRONMENT } from '../config/exploreEnvironment';
import type { User } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db, getFirebaseAppCheckToken } from '../firebase';
import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';
import {
  readSoridrawPersistentCache,
  removeSoridrawPersistentCache,
  writeSoridrawPersistentCache,
} from '../lib/soridrawPersistentCache';

// SORIDRAW_LONG_TERM_CACHE_STAGE_2_3_990
// SORIDRAW_EXPLORE_LIKE_BATCH_034_20260911
// SORIDRAW_EXPLORE_LIKE_PREVIEW_1MIN_TEST_037_20260911
// SORIDRAW_EXPLORE_LIKE_ACCOUNT_SIGNAL_058_20260911
// SORIDRAW_EXPLORE_LIKE_ACCOUNT_COUNT_REPLAY_065_20260911
// SORIDRAW_EXPLORE_LIKE_VISIBLE_COUNT_SIGNAL_067_20260911
const EXPLORE_LIKE_CACHE_SCHEMA_VERSION = 1;
const EXPLORE_LIKE_CACHE_KEY = 'explore-liked-state';
const EXPLORE_LIKE_SOURCE_TYPE = 'explore_likes';
const EXPLORE_LIKE_OUTBOX_SCHEMA_VERSION = 1;
const EXPLORE_LIKE_OUTBOX_CACHE_KEY = 'explore-like-outbox';
const EXPLORE_LIKE_OUTBOX_SOURCE_TYPE = 'explore_like_outbox';
const EXPLORE_LIKE_ACCOUNT_PATCH_SCHEMA_VERSION = 1;
const EXPLORE_LIKE_ACCOUNT_PATCH_CACHE_KEY = 'explore-like-account-patches';
const EXPLORE_LIKE_ACCOUNT_PATCH_SOURCE_TYPE = 'explore_like_account_patches';
const EXPLORE_LIKE_ACCOUNT_PATCH_TTL_MS = 20 * 60_000;
const EXPLORE_LIKE_BATCH_WINDOW_PREVIEW_MS = 60_000;
const EXPLORE_LIKE_BATCH_WINDOW_DEFAULT_MS = 4 * 60_000;
const EXPLORE_LIKE_BATCH_WINDOW_MS = EXPLORE_ENVIRONMENT === 'preview'
  ? EXPLORE_LIKE_BATCH_WINDOW_PREVIEW_MS
  : EXPLORE_LIKE_BATCH_WINDOW_DEFAULT_MS;
const EXPLORE_LIKE_BATCH_MAX = 50;
const EXPLORE_LIKE_RETRY_BASE_MS = 15_000;
const EXPLORE_LIKE_RETRY_MAX_MS = 60_000;

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
  trackId: string;
  ownerUid: string;
  liked: boolean;
  likeCount: number;
};

type ExploreLikeBatchResult = {
  trackId: string;
  liked: boolean;
  likeCount: number;
};

type ExploreLikeAccountSyncResult = ExploreLikeBatchResult & {
  ownerUid: string;
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
const pendingTimers = new Map<string, number>();
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
    results.push({
      trackId,
      ownerUid: String(item.ownerUid || '').trim(),
      liked: Boolean(item.liked),
      likeCount: clampLikeCount(item.likeCount),
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
    next[trackId] = {
      trackId,
      ownerUid: String(patch.ownerUid || '').trim(),
      liked: patch.liked,
      likeCount: clampLikeCount(patch.likeCount),
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
      updatedAt: now,
      expiresAt,
    };
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

const dispatchLikeSync = (detail: ExploreLikeSyncEventDetail) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ExploreLikeSyncEventDetail>(EXPLORE_LIKE_SYNC_EVENT, { detail }));
};

const replayAccountSyncPatches = (uid: string, trackIds: string[]) => {
  if (!uid || typeof window === 'undefined' || !trackIds.length) return;
  const cache = readAccountPatchCache(uid);
  const patches = trackIds.map((trackId) => cache[trackId]).filter(Boolean) as ExploreLikeAccountPatch[];
  if (!patches.length) return;
  window.setTimeout(() => {
    patches.forEach((patch) => dispatchLikeSync({
      trackId: patch.trackId,
      ownerUid: patch.ownerUid,
      liked: patch.liked,
      likeCount: patch.likeCount,
    }));
  }, 0);
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

  // If previousVersion does not match, this browser slept through at least one
  // batch. Clear only this user's personal like-state cache. Explore will
  // rehydrate only currently visible IDs; no public feed/full scan is triggered.
  const missedSignal = signal.previousVersion !== seenVersion;
  const cache = getLikedStateCache(uid);
  if (missedSignal) cache.clear();

  rememberAccountSyncResults(uid, signal.results);
  for (const result of signal.results) {
    cache.set(result.trackId, result.liked);
    dispatchLikeSync({
      trackId: result.trackId,
      ownerUid: result.ownerUid,
      liked: result.liked,
      likeCount: result.likeCount,
    });
  }
  persistLikedStateCache(uid, cache);
  setSeenAccountSignalVersion(uid, signal.version);

  if (missedSignal && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT, {
      detail: { uid, version: signal.version },
    }));
  }
};

const publishExploreLikeAccountSyncSignal = async (
  user: User,
  batchEntries: ExploreLikePendingMutation[],
  results: ExploreLikeBatchResult[],
) => {
  if (!user?.uid || !results.length) return;
  const uid = user.uid;
  const previousVersion = Math.max(
    readSeenAccountSignalVersion(uid),
    observedAccountSignalVersionByUid.get(uid) || 0,
  );
  const version = Math.max(Date.now(), previousVersion + 1);
  const ownerByTrack = new Map(batchEntries.map((pending) => [pending.trackId, pending.ownerUid]));
  const signal: ExploreLikeAccountSyncSignal = {
    version,
    previousVersion,
    results: results.map((result) => ({
      ...result,
      ownerUid: ownerByTrack.get(result.trackId) || '',
    })),
  };

  // Mark the origin browser before Firestore's local snapshot fires so it never
  // replays its own already-applied batch. If the signal write is rejected,
  // restore the previous marker; the canonical like batch itself remains saved.
  setSeenAccountSignalVersion(uid, version);
  observedAccountSignalVersionByUid.set(uid, version);
  try {
    await updateDoc(doc(db, 'users', uid), { exploreLikeSyncSignal: signal });
  } catch (reason) {
    if (readSeenAccountSignalVersion(uid) === version) setSeenAccountSignalVersion(uid, previousVersion);
    if ((observedAccountSignalVersionByUid.get(uid) || 0) === version) {
      observedAccountSignalVersionByUid.set(uid, previousVersion);
    }
    console.warn('Explore account like sync signal publish failed:', reason);
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

const clearPendingLikeTimer = (uid: string) => {
  const timer = pendingTimers.get(uid);
  if (timer && typeof window !== 'undefined') window.clearTimeout(timer);
  pendingTimers.delete(uid);
};

const oldestPendingQueuedAt = (outbox: ExploreLikeOutbox) => {
  const values = Object.values(outbox);
  if (!values.length) return null;
  return Math.min(...values.map((pending) => pending.queuedAt || pending.updatedAt || Date.now()));
};

const schedulePendingLikes = (user: User, delayMs?: number, replace = false) => {
  if (typeof window === 'undefined') return;
  const uid = user.uid;
  if (!replace && pendingTimers.has(uid)) return;
  if (replace) clearPendingLikeTimer(uid);

  const outbox = readLikeOutbox(uid);
  if (!Object.keys(outbox).length) return;
  const queuedAt = oldestPendingQueuedAt(outbox) ?? Date.now();
  const remaining = delayMs ?? Math.max(0, EXPLORE_LIKE_BATCH_WINDOW_MS - (Date.now() - queuedAt));
  const timer = window.setTimeout(() => {
    pendingTimers.delete(uid);
    void flushPendingLikes(user);
  }, Math.max(0, remaining));
  pendingTimers.set(uid, timer);
};

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
  if (!batchEntries.length) {
    clearPendingLikeTimer(uid);
    return;
  }

  const snapshot = Object.fromEntries(batchEntries.map((pending) => [pending.trackId, { ...pending }])) as ExploreLikeOutbox;
  inflightByUid.set(uid, snapshot);

  try {
    const payload = await requestExploreLike(user, '/v1/me/likes/batch', {
      method: 'POST',
      body: JSON.stringify({
        mutations: batchEntries.map((pending) => ({
          trackId: pending.trackId,
          liked: pending.desiredLiked,
        })),
      }),
    });
    const results = normalizeBatchResults(payload, batchEntries.map((pending) => pending.trackId));
    const resultByTrack = new Map(results.map((result) => [result.trackId, result]));
    const confirmedCache = getLikedStateCache(uid);
    const latestOutbox = readLikeOutbox(uid);
    const accountSyncResults: ExploreLikeBatchResult[] = [];

    for (const pending of batchEntries) {
      const result = resultByTrack.get(pending.trackId);
      if (!result) continue;
      confirmedCache.set(result.trackId, result.liked);

      const latest = latestOutbox[pending.trackId];
      // The Worker accepts this mutation immediately, but its public like-count
      // baseline is intentionally deferred. Keep the already-visible optimistic
      // count as the same-account signal until the public aggregate catches up.
      let visibleLiked = pending.desiredLiked;
      let visibleLikeCount = pending.optimisticLikeCount;
      let ownerUid = pending.ownerUid;

      if (latest && latest.updatedAt !== pending.updatedAt) {
        ownerUid = latest.ownerUid || ownerUid;
        latest.baseLiked = result.liked;
        latest.baseLikeCount = result.likeCount;
        latest.retryCount = 0;
        visibleLiked = latest.desiredLiked;
        visibleLikeCount = latest.optimisticLikeCount;
        if (latest.desiredLiked === result.liked) {
          delete latestOutbox[pending.trackId];
        } else {
          latestOutbox[pending.trackId] = latest;
        }
      } else {
        delete latestOutbox[pending.trackId];
      }

      const visibleResult = {
        trackId: result.trackId,
        liked: visibleLiked,
        likeCount: visibleLikeCount,
      };
      accountSyncResults.push(visibleResult);
      dispatchLikeSync({
        ...visibleResult,
        ownerUid,
      });
    }

    persistLikedStateCache(uid, confirmedCache);
    persistLikeOutbox(uid, latestOutbox);
    await publishExploreLikeAccountSyncSignal(user, batchEntries, accountSyncResults);
    if (Object.keys(latestOutbox).length) schedulePendingLikes(user, undefined, true);
  } catch (reason) {
    const latestOutbox = readLikeOutbox(uid);
    let maxRetryCount = 0;
    let firstPending: ExploreLikePendingMutation | null = null;
    for (const pending of batchEntries) {
      const latest = latestOutbox[pending.trackId] || pending;
      if (latest.updatedAt === pending.updatedAt) {
        latest.retryCount = Math.min(8, latest.retryCount + 1);
        latest.updatedAt = Date.now();
        latestOutbox[pending.trackId] = latest;
      }
      maxRetryCount = Math.max(maxRetryCount, latest.retryCount);
      firstPending ||= latest;
    }
    persistLikeOutbox(uid, latestOutbox);
    const retryDelay = Math.min(
      EXPLORE_LIKE_RETRY_MAX_MS,
      EXPLORE_LIKE_RETRY_BASE_MS * (2 ** Math.max(0, maxRetryCount - 1)),
    );
    schedulePendingLikes(user, retryDelay, true);
    if (firstPending) {
      dispatchLikeSyncError({
        trackId: firstPending.trackId,
        ownerUid: firstPending.ownerUid,
        liked: firstPending.desiredLiked,
        likeCount: firstPending.optimisticLikeCount,
        message: reason instanceof Error ? reason.message : '좋아요 서버 동기화를 재시도하고 있어요.',
      });
    }
  } finally {
    inflightByUid.delete(uid);
  }
};

const resumePendingLikes = (user: User) => {
  const outbox = readLikeOutbox(user.uid);
  if (!Object.keys(outbox).length) {
    clearPendingLikeTimer(user.uid);
    return;
  }
  schedulePendingLikes(user);
};

export const getExploreLikedTrackIds = async (user: User, trackIds: string[]): Promise<string[]> => {
  const normalized = [...new Set(trackIds.map((trackId) => String(trackId || '').trim()).filter(Boolean))].slice(0, 50);
  if (!normalized.length) return [];

  const cache = getLikedStateCache(user.uid);
  const missing = normalized.filter((trackId) => !cache.has(trackId));
  if (missing.length) {
    const query = new URLSearchParams({ trackIds: missing.join(',') });
    const payload = await requestExploreLike(user, `/v1/me/likes?${query.toString()}`);
    const likedIds = new Set(
      Array.isArray(payload?.data?.likedTrackIds)
        ? payload.data.likedTrackIds.map((trackId: unknown) => String(trackId || '').trim()).filter(Boolean)
        : [],
    );
    missing.forEach((trackId) => cache.set(trackId, likedIds.has(trackId)));
    persistLikedStateCache(user.uid, cache);
  }

  const outbox = readLikeOutbox(user.uid);
  resumePendingLikes(user);
  replayAccountSyncPatches(user.uid, normalized);
  return normalized.filter((trackId) => outbox[trackId]?.desiredLiked ?? cache.get(trackId) === true);
};

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
  const previousVisibleLiked = !liked;
  const baselineLiked = inflight?.desiredLiked ?? existing?.baseLiked ?? previousVisibleLiked;
  const baselineLikeCount = inflight?.optimisticLikeCount ?? existing?.baseLikeCount ?? clampLikeCount(currentLikeCount);
  const optimisticLikeCount = Math.max(0, clampLikeCount(currentLikeCount) + (liked ? 1 : -1));

  if (!inflight && liked === baselineLiked) {
    delete outbox[normalizedTrackId];
    persistLikeOutbox(user.uid, outbox);
    if (!Object.keys(outbox).length) clearPendingLikeTimer(user.uid);
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
  schedulePendingLikes(user);
  return { trackId: normalizedTrackId, liked, likeCount: optimisticLikeCount };
};

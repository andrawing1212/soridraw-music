import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { onValue, ref as databaseRef, runTransaction, type Unsubscribe } from 'firebase/database';
import { auth, getFirebaseAppCheckToken, realtimeDb } from '../firebase';
import {
  patchExploreLikedTrackMembership,
  reconcileExploreLikedTrackCollectionSnapshot127,
} from './exploreLikedTracksService';
import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';
import {
  readSoridrawPersistentCache,
  removeSoridrawPersistentCache,
  writeSoridrawPersistentCache,
} from '../lib/soridrawPersistentCache';

// SORIDRAW_EXPLORE_LIKE_ACTOR_COUNT_LOCK_120_20260918
// App 120 keeps only current-version Explore-like caches. The actor's newest
// optimistic count is protected from stale Feed/Profile payloads until the shared
// one-minute publication catches up.
const EXPLORE_LIKE_CACHE_SCHEMA_VERSION = 120;
const EXPLORE_LIKE_CACHE_KEY = 'explore-liked-state-120';
const EXPLORE_LIKE_SOURCE_TYPE = 'explore_likes_120';
const EXPLORE_LIKE_OUTBOX_SCHEMA_VERSION = 120;
const EXPLORE_LIKE_OUTBOX_CACHE_KEY = 'explore-like-outbox-120';
const EXPLORE_LIKE_OUTBOX_SOURCE_TYPE = 'explore_like_outbox_120';
const EXPLORE_LIKE_DISPLAY_LOCK_SCHEMA_VERSION = 120;
const EXPLORE_LIKE_DISPLAY_LOCK_CACHE_KEY = 'explore-like-display-lock-120';
const EXPLORE_LIKE_DISPLAY_LOCK_SOURCE_TYPE = 'explore_like_display_lock_120';
const EXPLORE_LIKE_BATCH_MAX = 50;
const EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 30_000;
const EXPLORE_LIKE_SHARED_PUBLISH_LOCK_MS_120 = 90_000;

export const EXPLORE_LIKE_SYNC_EVENT = 'soridraw:explore-like-sync';
export const EXPLORE_LIKE_SYNC_ERROR_EVENT = 'soridraw:explore-like-sync-error';
// 127: used only when a confirmed-change notification gap requires targeted reconciliation.
export const EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT = 'soridraw:explore-like-account-invalidation';
const EXPLORE_LIKE_BASELINE_127 = 'soridraw:explore:like-baseline:127';
const EXPLORE_LIKE_SIGNAL_SEEN_127 = 'soridraw:explore:like-signal-seen:127';
const EXPLORE_LIKE_SIGNAL_RETRY_127 = 'soridraw:explore:like-signal-retry:127';
const EXPLORE_LIKE_SIGNAL_GAP_127 = 'soridraw:explore:like-signal-gap:127';
const EXPLORE_LIKE_SIGNAL_MAX_127 = 50;

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

type ExploreLikeDisplayLock = {
  liked: boolean;
  likeCount: number;
  updatedAt: number;
  protectUntil: number;
};

type ExploreLikeDisplayLocks = Record<string, ExploreLikeDisplayLock>;

type ExploreLikeBatchResult = {
  trackId: string;
  liked: boolean;
};

type ExploreLikeSyncEventDetail = {
  uid: string;
  trackId: string;
  ownerUid: string;
  liked: boolean;
  likeCount: number;
  source?: 'local' | 'confirmed' | 'remote';
};

const likedStateByUid = new Map<string, Map<string, boolean>>();
const flushTimerByUid = new Map<string, number>();
const inflightByUid = new Map<string, Promise<void>>();
const baselineInFlight127 = new Map<string, Promise<void>>();
const baselineCompleted127 = new Set<string>();
const signalRevisionByUid127 = new Map<string, number>();
const signalPublishInFlight127 = new Map<string, Promise<void>>();

const clampLikeCount = (value: unknown) => {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
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
    dataVersion: 120,
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

// SORIDRAW_EXPLORE_ATOMIC_PERSONAL_LIKE_127_20260920
// "Liked" is one user-owned boolean. The public count remains independently
// authoritative because other users can like the same track. A local pending
// intention always outranks an older cross-device acknowledgement.
export const readExploreTrackLikeMembership127 = (uid: string, trackId: string): boolean | undefined => {
  const id = String(trackId || '').trim();
  if (!uid || !id) return undefined;
  const pending = readLikeOutbox(uid)[id];
  if (pending) return pending.desiredLiked;
  // Do not allow a stale legacy-cache boolean to initiate a new mutation until
  // the account's one-time authoritative R2 reconciliation has succeeded.
  if (!baselineCompleted127.has(uid) &&
      readLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_BASELINE_127, uid)) !== '1') return undefined;
  return getLikedStateCache(uid).get(id);
};

const scopedLikeKey127 = (prefix: string, uid: string) => prefix + ':' + uid;
const readLikeLocal127 = (key: string) => {
  if (typeof window === 'undefined') return '';
  try { return window.localStorage.getItem(key) || ''; } catch { return ''; }
};
const writeLikeLocal127 = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(key, value); } catch {}
};
const readSeenLikeSignal127 = (uid: string) =>
  Math.max(signalRevisionByUid127.get(uid) || 0, Number(readLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_SIGNAL_SEEN_127, uid))) || 0);
const markSeenLikeSignal127 = (uid: string, version: number) => {
  const next = Math.max(readSeenLikeSignal127(uid), version);
  signalRevisionByUid127.set(uid, next);
  writeLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_SIGNAL_SEEN_127, uid), String(next));
};

type ExploreLikeAcceptedRow127 = ExploreLikeSyncEventDetail;
type ExploreLikeSignal127 = {
  version: number;
  previousVersion: number;
  results: ExploreLikeAcceptedRow127[];
};

const normalizeLikeSignal127 = (raw: unknown): ExploreLikeSignal127 | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const version = Math.floor(Number(row.version || 0));
  const previousVersion = Math.floor(Number(row.previousVersion || 0));
  if (!Number.isSafeInteger(version) || version <= 0 ||
      !Number.isSafeInteger(previousVersion) || previousVersion < 0 ||
      previousVersion >= version || !Array.isArray(row.results)) return null;
  const results: ExploreLikeAcceptedRow127[] = [];
  for (const item of row.results.slice(0, EXPLORE_LIKE_SIGNAL_MAX_127)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const value = item as Record<string, unknown>;
    const trackId = String(value.trackId || '').trim();
    if (!trackId || trackId.length > 512 || typeof value.liked !== 'boolean') continue;
    results.push({
      uid: '',
      trackId,
      ownerUid: String(value.ownerUid || '').trim(),
      liked: value.liked,
      likeCount: clampLikeCount(value.likeCount),
    });
  }
  return { version, previousVersion, results };
};

const applyRemoteLikeSignal127 = (uid: string, signal: ExploreLikeSignal127) => {
  const lastSeen = readSeenLikeSignal127(uid);
  if (signal.version <= lastSeen) return;
  // If an initial retained signal arrives after the R2 baseline, its rows
  // could predate that snapshot. Reconcile once rather than accepting it as
  // a newer personal state solely because no local signal version was stored.
  const baselineAlreadyVerified = baselineCompleted127.has(uid) ||
    readLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_BASELINE_127, uid)) === '1';
  const gap = (lastSeen > 0 && signal.previousVersion !== lastSeen) ||
    (lastSeen === 0 && baselineAlreadyVerified);
  const pending = readLikeOutbox(uid);
  const cache = getLikedStateCache(uid);
  let changed = false;
  for (const item of signal.results) {
    if (pending[item.trackId]) continue;
    if (cache.get(item.trackId) === item.liked) continue;
    cache.set(item.trackId, item.liked);
    patchExploreLikedTrackMembership(uid, item.trackId, item.liked);
    changed = true;
    // The numeric count is from the shared Feed, not this personal signal.
    // Do not replace a public count with another device's optimistic estimate.
    dispatchLikeSync({ ...item, uid, source: 'remote' });
  }
  if (changed) persistLikedStateCache(uid, cache);
  markSeenLikeSignal127(uid, signal.version);
  if (gap && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT, {
      detail: { uid, reason: 'missed-confirmed-like-signal' },
    }));
  }
};

let activeLikeSignalUid127 = '';
let unsubscribeLikeSignal127: Unsubscribe | null = null;
const startLikeSignal127 = (uid: string) => {
  if (uid === activeLikeSignalUid127) return;
  unsubscribeLikeSignal127?.();
  unsubscribeLikeSignal127 = null;
  activeLikeSignalUid127 = uid;
  if (!uid) return;
  unsubscribeLikeSignal127 = onValue(
    databaseRef(realtimeDb, `userSync/${uid}/exploreLike`),
    (snapshot) => {
      const signal = normalizeLikeSignal127(snapshot.val());
      if (signal) applyRemoteLikeSignal127(uid, signal);
    },
    (error) => console.warn('[127] Personal like signal unavailable; local cache preserved:', error),
  );
};
// This listener does not read Firestore/D1 and subscribes once for the signed-in
// account, not once per song/card/tab. No continuous timer or global Feed reload.
onAuthStateChanged(auth, (user) => startLikeSignal127(user?.uid || ''));

const requestPersonalLikeBaseline127 = async (user: User) => {
  const headers = await buildAuthHeaders(user);
  const response = await fetch(EXPLORE_API_BASE + '/v1/me/social-snapshot', {
    method: 'GET',
    headers,
  });
  recordCloudflareResponse(response, '/v1/me/social-snapshot');
  if (!response.ok) throw new Error('Personal like snapshot unavailable: HTTP ' + response.status);
  const payload = await response.json() as { ok?: boolean; data?: { likedTrackIds?: unknown } };
  if (payload?.ok !== true || !Array.isArray(payload?.data?.likedTrackIds)) {
    throw new Error('Personal like snapshot is invalid; preserving cached likes');
  }
  return [...new Set(payload.data.likedTrackIds.map((id) => String(id || '').trim()).filter(Boolean))];
};

// One-time per user migration from older local liked-state to the already
// materialized per-user R2 bundle. Never clear device data, never scan D1 on
// ordinary entry. The server may use its existing recovery path if R2 is absent.
const ensurePersonalLikeBaseline127 = async (user: User): Promise<void> => {
  const uid = user.uid;
  if (!uid || baselineCompleted127.has(uid) ||
      readLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_BASELINE_127, uid)) === '1') return;
  const inflight = baselineInFlight127.get(uid);
  if (inflight) return inflight;
  const task = (async () => {
    const versionAtStart = readSeenLikeSignal127(uid);
    const likedIds = await requestPersonalLikeBaseline127(user);
    // The existing R2 writer intentionally caps an account at 2,000 liked
    // IDs. At capacity, absence from the snapshot is NOT proof of unliked.
    if (likedIds.length >= 2000) {
      throw new Error('Personal like snapshot reached its 2000-ID limit; existing cache preserved');
    }
    if (readSeenLikeSignal127(uid) !== versionAtStart) {
      throw new Error('Personal like signal advanced during baseline; retry on next entry');
    }
    const confirmed = new Set(likedIds);
    const outbox = readLikeOutbox(uid);
    const cache = getLikedStateCache(uid);
    const scope = new Set([...cache.keys(), ...confirmed, ...Object.keys(outbox)]);
    let changed = false;
    for (const id of scope) {
      const nextLiked = outbox[id]?.desiredLiked ?? confirmed.has(id);
      if (cache.get(id) === nextLiked) continue;
      cache.set(id, nextLiked);
      changed = true;
    }
    if (changed) persistLikedStateCache(uid, cache);
    reconcileExploreLikedTrackCollectionSnapshot127(
      uid, likedIds, Object.fromEntries(Object.entries(outbox).map(([id, row]) => [id, row.desiredLiked])),
    );
    baselineCompleted127.add(uid);
    writeLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_BASELINE_127, uid), '1');
  })().finally(() => { baselineInFlight127.delete(uid); });
  baselineInFlight127.set(uid, task);
  return task;
};

export const invalidateExplorePersonalLikeBaseline127 = (uid: string) => {
  if (!uid) return;
  baselineCompleted127.delete(uid);
  writeLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_BASELINE_127, uid), '');
};

export const ensureExplorePersonalLikeBaseline127 = ensurePersonalLikeBaseline127;

const readSignalRetry127 = (uid: string): ExploreLikeAcceptedRow127[] => {
  const raw = readLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_SIGNAL_RETRY_127, uid));
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((row: unknown) =>
      row && typeof row === 'object' && typeof (row as ExploreLikeAcceptedRow127).trackId === 'string',
    ).slice(0, EXPLORE_LIKE_SIGNAL_MAX_127) : [];
  } catch { return []; }
};
const saveSignalRetry127 = (uid: string, rows: ExploreLikeAcceptedRow127[]) =>
  writeLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_SIGNAL_RETRY_127, uid), JSON.stringify(rows));

const publishConfirmedLikeSignal127 = async (uid: string, fresh: ExploreLikeAcceptedRow127[]): Promise<void> => {
  if (!fresh.length) return;
  // Serialize before touching the durable retry: an in-flight successful
  // publication must never clear a second accepted batch's notification.
  const task = signalPublishInFlight127.get(uid);
  if (task) {
    try { await task; } catch {}
    return publishConfirmedLikeSignal127(uid, fresh);
  }
  const pending = new Map<string, ExploreLikeAcceptedRow127>();
  for (const row of [...fresh, ...readSignalRetry127(uid)]) {
    if (row.trackId && !pending.has(row.trackId)) pending.set(row.trackId, row);
  }
  // If >50 distinct changes accrued during an offline notification failure,
  // tell recipients they missed an interval. They revalidate their personal
  // R2 snapshot once instead of treating the retained 50 as a complete delta.
  if (pending.size > EXPLORE_LIKE_SIGNAL_MAX_127) {
    writeLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_SIGNAL_GAP_127, uid), '1');
  }
  const forceGap = readLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_SIGNAL_GAP_127, uid)) === '1';
  const rows = [...pending.values()].slice(0, EXPLORE_LIKE_SIGNAL_MAX_127);
  saveSignalRetry127(uid, rows);
  // Persist latest final-state mutations even if the Firebase notification fails:
  // retry is triggered on the next successful batch or after reconnect/focus.
  const publish = (async () => {
    const notification = await runTransaction(
      databaseRef(realtimeDb, `userSync/${uid}/exploreLike`),
      (raw) => {
        const current = normalizeLikeSignal127(raw);
        const version = Math.max(Date.now(), (current?.version || 0) + 1);
        const merged = new Map<string, ExploreLikeAcceptedRow127>();
        [...rows, ...(current?.results || [])].forEach((row) => {
          if (!merged.has(row.trackId) && merged.size < EXPLORE_LIKE_SIGNAL_MAX_127) merged.set(row.trackId, row);
        });
        return {
          version,
          previousVersion: forceGap ? 0 : current?.version || 0,
          results: [...merged.values()].map(({ trackId, ownerUid, liked, likeCount }) =>
            ({ trackId, ownerUid, liked, likeCount: clampLikeCount(likeCount) })),
        };
      },
      { applyLocally: false },
    );
    if (!notification.committed) throw new Error('Personal like notification was not committed');
    saveSignalRetry127(uid, []);
    writeLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_SIGNAL_GAP_127, uid), '');
  })().finally(() => { signalPublishInFlight127.delete(uid); });
  signalPublishInFlight127.set(uid, publish);
  await publish;
};

let likeSignalRetryListenerInstalled127 = false;
const installLikeSignalRetry127 = () => {
  if (typeof window === 'undefined' || likeSignalRetryListenerInstalled127) return;
  likeSignalRetryListenerInstalled127 = true;
  const retry = () => {
    const current = auth.currentUser;
    if (!current?.uid || !readSignalRetry127(current.uid).length) return;
    void publishConfirmedLikeSignal127(current.uid, readSignalRetry127(current.uid))
      .catch((error) => console.warn('[127] Pending personal like notification retained:', error));
  };
  window.addEventListener('online', retry);
  window.addEventListener('focus', retry);
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
    dataVersion: 120,
    uid,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: true,
    pendingMutationId: 'explore-like-idle-batch-120',
    data: outbox,
  });
};

export const getPendingExploreLikeMutationCount = (uid: string): number => Object.keys(readLikeOutbox(uid)).length;

const normalizeDisplayLock = (value: unknown): ExploreLikeDisplayLock | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Partial<ExploreLikeDisplayLock>;
  if (typeof row.liked !== 'boolean') return null;
  const likeCount = clampLikeCount(row.likeCount);
  const updatedAt = Math.max(0, Number(row.updatedAt || 0));
  const protectUntil = Math.max(0, Number(row.protectUntil || 0));
  if (!updatedAt || !protectUntil) return null;
  return { liked: row.liked, likeCount, updatedAt, protectUntil };
};

const readLikeDisplayLocks = (uid: string): ExploreLikeDisplayLocks => {
  const envelope = readSoridrawPersistentCache<ExploreLikeDisplayLocks>({
    cacheKey: EXPLORE_LIKE_DISPLAY_LOCK_CACHE_KEY,
    sourceType: EXPLORE_LIKE_DISPLAY_LOCK_SOURCE_TYPE,
    schemaVersion: EXPLORE_LIKE_DISPLAY_LOCK_SCHEMA_VERSION,
    uid,
  });
  if (!envelope?.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) return {};
  return Object.entries(envelope.data).reduce<ExploreLikeDisplayLocks>((acc, [trackId, value]) => {
    const normalized = normalizeDisplayLock(value);
    if (trackId && normalized) acc[trackId] = normalized;
    return acc;
  }, {});
};

const persistLikeDisplayLocks = (uid: string, locks: ExploreLikeDisplayLocks) => {
  if (!Object.keys(locks).length) {
    removeSoridrawPersistentCache(EXPLORE_LIKE_DISPLAY_LOCK_CACHE_KEY, uid);
    return;
  }
  writeSoridrawPersistentCache<ExploreLikeDisplayLocks>({
    cacheKey: EXPLORE_LIKE_DISPLAY_LOCK_CACHE_KEY,
    sourceType: EXPLORE_LIKE_DISPLAY_LOCK_SOURCE_TYPE,
    schemaVersion: EXPLORE_LIKE_DISPLAY_LOCK_SCHEMA_VERSION,
    dataVersion: 120,
    uid,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: false,
    pendingMutationId: null,
    data: locks,
  });
};

// The current user's newest count always wins while the 30-second outbox is
// pending. After batch ACK, the same count stays protected briefly until a shared
// Feed/Profile payload reaches that exact count. This prevents old public cache
// responses from making the actor's number jump backward and forward.
export function overlayExploreLikeDisplayCounts<T extends { id: string; likeCount: number }>(
  uid: string,
  tracks: T[],
): T[] {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid || !tracks.length) return tracks;

  const outbox = readLikeOutbox(normalizedUid);
  const locks = readLikeDisplayLocks(normalizedUid);
  const now = Date.now();
  let locksChanged = false;

  const overlaid = tracks.map((track) => {
    const trackId = String(track.id || '').trim();
    if (!trackId) return track;

    const pending = outbox[trackId];
    if (pending) {
      const nextCount = pending.optimisticLikeCount;
      return nextCount === track.likeCount ? track : { ...track, likeCount: nextCount };
    }

    const lock = locks[trackId];
    if (!lock) return track;

    const sharedCount = clampLikeCount(track.likeCount);
    if (sharedCount === lock.likeCount || lock.protectUntil <= now) {
      delete locks[trackId];
      locksChanged = true;
      return track;
    }

    return lock.likeCount === track.likeCount ? track : { ...track, likeCount: lock.likeCount };
  });

  if (locksChanged) persistLikeDisplayLocks(normalizedUid, locks);
  return overlaid;
}

const dispatchLikeSync = (detail: ExploreLikeSyncEventDetail) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ExploreLikeSyncEventDetail>(EXPLORE_LIKE_SYNC_EVENT, { detail }));
};

const dispatchLikeSyncError = (detail: ExploreLikeSyncEventDetail & { message: string }) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EXPLORE_LIKE_SYNC_ERROR_EVENT, { detail }));
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
  let payload: any = null;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const message = String(payload?.message || payload?.error?.message || payload?.error || '좋아요 요청을 처리하지 못했습니다.').trim();
    throw new Error(message || '좋아요 요청을 처리하지 못했습니다.');
  }
  return payload;
};

const normalizeBatchResults = (payload: unknown, expectedTrackIds: string[]): ExploreLikeBatchResult[] => {
  const body = payload && typeof payload === 'object' ? payload as { data?: { results?: unknown[] } } : null;
  const rows = Array.isArray(body?.data?.results) ? body!.data!.results! : [];
  const expected = new Set(expectedTrackIds);
  const results: ExploreLikeBatchResult[] = [];
  for (const value of rows) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const trackId = String(row.trackId || '').trim();
    if (!trackId || !expected.has(trackId) || typeof row.liked !== 'boolean') continue;
    results.push({ trackId, liked: row.liked });
  }
  if (results.length !== expected.size || new Set(results.map((result) => result.trackId)).size !== expected.size) {
    throw new Error('좋아요 묶음 응답을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
  return results;
};

const clearFlushTimer = (uid: string) => {
  const timer = flushTimerByUid.get(uid);
  if (timer !== undefined && typeof window !== 'undefined') window.clearTimeout(timer);
  flushTimerByUid.delete(uid);
};

const latestOutboxUpdatedAt = (outbox: ExploreLikeOutbox) => Object.values(outbox)
  .reduce((latest, pending) => Math.max(latest, pending.updatedAt || 0), 0);

let flushPendingLikes: (user: User) => Promise<void>;

const schedulePendingFlush = (user: User) => {
  const uid = String(user?.uid || '').trim();
  if (!uid || typeof window === 'undefined') return;
  const outbox = readLikeOutbox(uid);
  if (!Object.keys(outbox).length) {
    clearFlushTimer(uid);
    return;
  }
  clearFlushTimer(uid);
  const deadline = latestOutboxUpdatedAt(outbox) + EXPLORE_LIKE_IDLE_FLUSH_MS_120;
  const delay = Math.max(0, deadline - Date.now());
  const timer = window.setTimeout(() => {
    flushTimerByUid.delete(uid);
    void flushPendingLikes(user);
  }, delay);
  flushTimerByUid.set(uid, timer);
};

flushPendingLikes = async (user: User): Promise<void> => {
  const uid = String(user?.uid || '').trim();
  if (!uid || inflightByUid.has(uid)) return;

  const outbox = readLikeOutbox(uid);
  const ordered = Object.values(outbox)
    .sort((a, b) => (a.queuedAt || a.updatedAt) - (b.queuedAt || b.updatedAt))
    .slice(0, EXPLORE_LIKE_BATCH_MAX);

  if (!ordered.length) return;

  const noOps = ordered.filter((pending) => pending.desiredLiked === pending.baseLiked);
  if (noOps.length) {
    const latest = readLikeOutbox(uid);
    for (const pending of noOps) {
      const current = latest[pending.trackId];
      if (current?.updatedAt === pending.updatedAt) delete latest[pending.trackId];
    }
    persistLikeOutbox(uid, latest);
  }

  const batchEntries = ordered.filter((pending) => pending.desiredLiked !== pending.baseLiked);
  if (!batchEntries.length) {
    if (getPendingExploreLikeMutationCount(uid) > 0) schedulePendingFlush(user);
    return;
  }

  let succeeded = false;
  const task = (async () => {
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
      const latest = readLikeOutbox(uid);
      const cache = getLikedStateCache(uid);
      const displayLocks = readLikeDisplayLocks(uid);
      const acknowledgedAt = Date.now();
      const acceptedForSignal127: ExploreLikeAcceptedRow127[] = [];

      for (const pending of batchEntries) {
        const result = resultByTrack.get(pending.trackId);
        if (!result) continue;
        const current = latest[pending.trackId];
        const hasNewerPending = Boolean(current && current.updatedAt !== pending.updatedAt);
        if (!hasNewerPending) {
          cache.set(pending.trackId, result.liked);
          displayLocks[pending.trackId] = {
            liked: result.liked,
            likeCount: pending.optimisticLikeCount,
            updatedAt: acknowledgedAt,
            protectUntil: acknowledgedAt + EXPLORE_LIKE_SHARED_PUBLISH_LOCK_MS_120,
          };
          delete latest[pending.trackId];
          const accepted: ExploreLikeAcceptedRow127 = {
            uid,
            trackId: pending.trackId,
            ownerUid: pending.ownerUid,
            liked: result.liked,
            likeCount: pending.optimisticLikeCount,
            source: 'confirmed',
          };
          acceptedForSignal127.push(accepted);
          dispatchLikeSync(accepted);
        }
      }

      persistLikedStateCache(uid, cache);
      persistLikeDisplayLocks(uid, displayLocks);
      persistLikeOutbox(uid, latest);
      succeeded = true;
      // The Worker has acknowledged this final-state batch for processing.
      // A notification failure must NEVER replay a successful like mutation.
      try {
        await publishConfirmedLikeSignal127(uid, acceptedForSignal127);
      } catch (notifyError) {
        console.warn('[127] Like accepted; cross-device signal pending retry:', notifyError);
      }
    } catch (reason) {
      const latest = readLikeOutbox(uid);
      const first = batchEntries[0];
      for (const pending of batchEntries) {
        const current = latest[pending.trackId];
        if (current?.updatedAt === pending.updatedAt) {
          current.retryCount = Math.min(8, current.retryCount + 1);
          latest[pending.trackId] = current;
        }
      }
      persistLikeOutbox(uid, latest);
      if (first) {
        dispatchLikeSyncError({
          uid,
          trackId: first.trackId,
          ownerUid: first.ownerUid,
          liked: first.desiredLiked,
          likeCount: first.optimisticLikeCount,
          message: reason instanceof Error
            ? reason.message
            : '좋아요 변경분을 최신 기기 캐시에 보관했습니다. 다음 조작 또는 재접속 때 다시 동기화합니다.',
        });
      }
    }
  })().finally(() => {
    inflightByUid.delete(uid);
    if (succeeded && getPendingExploreLikeMutationCount(uid) > 0) schedulePendingFlush(user);
  });

  inflightByUid.set(uid, task);
  await task;
};

// App 120 deliberately ignores historical RTDB Explore-like replay payloads.
// Personal heart state is recovered from the 120 cache, pending outbox, or one
// targeted canonical request for missing visible track IDs.
export const observeExploreLikeAccountSyncSignal = (_user: User, _value: unknown) => {};

export const flushPendingExploreLikesForPageExit = async (user: User): Promise<void> => {
  // Page/profile navigation must not cut short the 30-second idle window.
  // The module-level timer survives route changes; the durable 120 outbox survives reloads.
  schedulePendingFlush(user);
};

export const getExploreLikedTrackIds = async (user: User, trackIds: string[]): Promise<string[]> => {
  const normalized = [...new Set(
    trackIds.map((trackId) => String(trackId || '').trim()).filter(Boolean),
  )].slice(0, EXPLORE_LIKE_BATCH_MAX);
  if (!normalized.length) return [];
  installLikeSignalRetry127();
  try {
    await ensurePersonalLikeBaseline127(user);
  } catch (reason) {
    // The existing account cache is still usable while an R2 repair is retried.
    console.warn('[127] Personal like baseline pending; retaining local state:', reason);
  }

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
  if (Object.keys(outbox).length) schedulePendingFlush(user);

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

export const setExploreTrackLike = async (
  user: User,
  trackId: string,
  liked: boolean,
  currentLikeCount = 0,
  ownerUid = '',
): Promise<{ trackId: string; liked: boolean; likeCount: number }> => {
  const normalizedTrackId = String(trackId || '').trim();
  if (!normalizedTrackId) throw new Error('Explore 곡 ID를 확인하지 못했습니다.');

  const uid = user.uid;
  installLikeSignalRetry127();
  const outbox = readLikeOutbox(uid);
  const existing = outbox[normalizedTrackId];
  const cache = getLikedStateCache(uid);
  const previousVisibleLiked = existing?.desiredLiked ?? cache.get(normalizedTrackId) ?? !liked;
  const baseLiked = existing?.baseLiked ?? previousVisibleLiked;
  const baseLikeCount = existing?.baseLikeCount ?? clampLikeCount(currentLikeCount);
  const optimisticLikeCount = clampLikeCount(
    baseLikeCount + (liked ? 1 : 0) - (baseLiked ? 1 : 0),
  );
  const now = Date.now();

  cache.set(normalizedTrackId, liked);
  persistLikedStateCache(uid, cache);

  outbox[normalizedTrackId] = {
    trackId: normalizedTrackId,
    ownerUid: String(ownerUid || existing?.ownerUid || '').trim(),
    baseLiked,
    desiredLiked: liked,
    baseLikeCount,
    optimisticLikeCount,
    queuedAt: existing?.queuedAt || now,
    updatedAt: now,
    retryCount: 0,
  };
  persistLikeOutbox(uid, outbox);

  // Sliding idle window: every click restarts the same 30-second timer. One song
  // or many songs therefore leave as one final-state batch after the last click.
  schedulePendingFlush(user);

  dispatchLikeSync({
    uid,
    trackId: normalizedTrackId,
    ownerUid: String(ownerUid || existing?.ownerUid || '').trim(),
    liked,
    likeCount: optimisticLikeCount,
    source: 'local',
  });

  return { trackId: normalizedTrackId, liked, likeCount: optimisticLikeCount };
};

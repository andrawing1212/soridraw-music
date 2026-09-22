import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { onValue, ref as databaseRef, runTransaction, type Unsubscribe } from 'firebase/database';
import { auth, getFirebaseAppCheckToken, realtimeDb } from '../firebase';
import {
  patchExploreLikedTrackMembership,
  reconcileExploreLikedTrackCollectionSnapshot127,
  seedExploreLikedTrackCandidates129,
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
// 172: local-only canonical mutation revision. This does not invalidate the
// existing 120 membership cache and causes no page-entry/server read.
const EXPLORE_LIKE_CANONICAL_REVISION_SCHEMA_VERSION_172 = 1;
const EXPLORE_LIKE_CANONICAL_REVISION_CACHE_KEY_172 = 'explore-like-canonical-revision-172';
const EXPLORE_LIKE_CANONICAL_REVISION_SOURCE_TYPE_172 = 'explore_like_canonical_revision_172';
const EXPLORE_LIKE_BATCH_MAX = 50;
const EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 30_000;
const EXPLORE_LIKE_SHARED_PUBLISH_LOCK_MS_120 = 90_000;

export const EXPLORE_LIKE_SYNC_EVENT = 'soridraw:explore-like-sync';
export const EXPLORE_LIKE_SYNC_ERROR_EVENT = 'soridraw:explore-like-sync-error';
// 127: used only when a confirmed-change notification gap requires targeted reconciliation.
export const EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT = 'soridraw:explore-like-account-invalidation';
const EXPLORE_LIKE_BASELINE_127 = 'soridraw:explore:like-baseline:127';
// 161: legacy v114 R2 may be truncated even below 2,000 after later unlikes.
// This marker means the current R2 revision was observed but is NOT complete.
const EXPLORE_LIKE_PARTIAL_BASELINE_161 = 'soridraw:explore:like-partial-baseline:161';
// App127: when the legacy shared R2 bundle is incomplete, a bounded /v1/me/likes
// response is still authoritative for the requested visible track IDs. Persist
// only those verified IDs so clicks work without trusting stale legacy booleans.
const EXPLORE_LIKE_TARGETED_VERIFIED_127 = 'soridraw:explore:like-targeted-verified:127';
// App134 keeps the prior revision-bound targeted proof key across app updates.
// App version changes alone must never force another D1 membership read.
const EXPLORE_LIKE_TARGETED_VERIFIED_130 = 'soridraw:explore:like-targeted-verified:130';
const EXPLORE_LIKE_SIGNAL_SEEN_127 = 'soridraw:explore:like-signal-seen:127';
const EXPLORE_LIKE_SIGNAL_RETRY_127 = 'soridraw:explore:like-signal-retry:127';
const EXPLORE_LIKE_SIGNAL_GAP_127 = 'soridraw:explore:like-signal-gap:127';
const EXPLORE_LIKE_REPAIR_TARGET_127 = 'soridraw:explore:like-repair-target:127';
const EXPLORE_LIKE_R2_REVISION_127 = 'soridraw:explore:like-r2-revision:127';
const EXPLORE_LIKE_SNAPSHOT_PENDING_127 = 'soridraw:explore:like-snapshot-pending:127';
const EXPLORE_LIKE_LEGACY_CHECK_MS_127 = 5 * 60_000;
const EXPLORE_LIKE_SIGNAL_MAX_127 = 50;
// SORIDRAW_EXPLORE_LIKE_CROSS_DEVICE_ACK_RESTORE_131_20260922

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
  operationId?: string; // stable across a retry, replaced on every new click
  expectedRevision?: number; // 172: canonical per-user/track mutation revision
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
  likeCount?: number;
  revision?: number;
  generation?: number;
  operationId?: string;
  status?: 'applied' | 'duplicate' | 'already-desired' | 'revision-conflict' | 'ineligible' | 'legacy-queued';
};

type ExploreLikeBaselineSnapshot161 = {
  likedTrackIds: string[];
  complete: boolean;
  exactLikeCount: number | null;
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
const revisionCheckAtByUid127 = new Map<string, number>();
const revisionCheckInFlight127 = new Map<string, Promise<void>>();
const targetedVerifiedByUid127 = new Map<string, Set<string>>();
const targetedVerifiedRevisionByUid130 = new Map<string, string>();

const clampLikeCount = (value: unknown) => {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
};

// Local mutation order must not rely solely on Date.now(): same-ms clicks are
// distinct user intentions, and older ACKs may not resolve the later one.
export const nextExploreLikeMutationAt127 = (previousUpdatedAt: number, now: number): number =>
  Math.max(now, previousUpdatedAt + 1);

// A device clock, track ID or UID is not a globally unique operation ID.
// Generate once per new click and persist before sending: retries must reuse
// the SAME ID so the future fenced server can reject duplicate executions.
export const createExploreLikeOperationId144 = (): string => {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error('안전한 좋아요 요청 ID를 생성할 수 없습니다.');
  }
  return crypto.randomUUID();
};

// App129 single-like atom:
// one (uid, trackId) relation contributes either 0 or exactly 1 to the public
// total. Heart + this user's one-count contribution are therefore one state
// transition, never two independent UI values.
export const normalizeExploreLikeDisplayPair129 = (
  liked: boolean,
  publicCount: number,
): { liked: boolean; likeCount: number } => ({
  liked,
  // A filled heart with public count 0 is impossible because this account
  // itself contributes one like. Repair only that impossible stale display;
  // never collapse counts from other users.
  likeCount: Math.max(clampLikeCount(publicCount), liked ? 1 : 0),
});

export const computeExploreLikeAction127 = (
  baseLiked: boolean,
  desiredLiked: boolean,
  publicCount: number,
): { liked: boolean; likeCount: number } => {
  const base = normalizeExploreLikeDisplayPair129(baseLiked, publicCount);
  return normalizeExploreLikeDisplayPair129(
    desiredLiked,
    base.likeCount + Number(desiredLiked) - Number(baseLiked),
  );
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

const hasLikedStateStorage127 = (uid: string): boolean => Boolean(
  readSoridrawPersistentCache<Record<string, boolean>>({
    cacheKey: EXPLORE_LIKE_CACHE_KEY,
    sourceType: EXPLORE_LIKE_SOURCE_TYPE,
    schemaVersion: EXPLORE_LIKE_CACHE_SCHEMA_VERSION,
    uid,
  }),
);

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

const readLikeCanonicalRevisions172 = (uid: string): Record<string, number> => {
  const envelope = readSoridrawPersistentCache<Record<string, number>>({
    cacheKey: EXPLORE_LIKE_CANONICAL_REVISION_CACHE_KEY_172,
    sourceType: EXPLORE_LIKE_CANONICAL_REVISION_SOURCE_TYPE_172,
    schemaVersion: EXPLORE_LIKE_CANONICAL_REVISION_SCHEMA_VERSION_172,
    uid,
  });
  if (!envelope?.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) return {};
  return Object.entries(envelope.data).reduce<Record<string, number>>((acc, [trackId, value]) => {
    const revision = Number(value);
    if (trackId && Number.isSafeInteger(revision) && revision >= 0) acc[trackId] = revision;
    return acc;
  }, {});
};

const persistLikeCanonicalRevisions172 = (uid: string, revisions: Record<string, number>) => {
  if (!Object.keys(revisions).length) {
    removeSoridrawPersistentCache(EXPLORE_LIKE_CANONICAL_REVISION_CACHE_KEY_172, uid);
    return;
  }
  writeSoridrawPersistentCache<Record<string, number>>({
    cacheKey: EXPLORE_LIKE_CANONICAL_REVISION_CACHE_KEY_172,
    sourceType: EXPLORE_LIKE_CANONICAL_REVISION_SOURCE_TYPE_172,
    schemaVersion: EXPLORE_LIKE_CANONICAL_REVISION_SCHEMA_VERSION_172,
    dataVersion: 172,
    uid,
    syncCursor: null,
    serverRevision: null,
    deletedIds: [],
    expiresAt: null,
    dirty: false,
    pendingMutationId: null,
    data: revisions,
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
  const acceptedButNotMaterialized = readSnapshotPending127(uid);
  if (Object.prototype.hasOwnProperty.call(acceptedButNotMaterialized, id)) return acceptedButNotMaterialized[id];
  // A complete account snapshot is globally authoritative. If the legacy R2
  // snapshot is partial, only IDs explicitly rechecked through the bounded
  // /v1/me/likes endpoint may unlock a mutation.
  const baselineReady = baselineCompleted127.has(uid) ||
    readLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_BASELINE_127, uid)) === '1';
  if (!baselineReady && !readTargetedVerifiedLikeTracks127(uid).has(id)) return undefined;
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

const readCurrentPersonalLikeRevision130 = (uid: string) =>
  readLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_R2_REVISION_127, uid));

const readTargetedVerifiedLikeTracks127 = (uid: string): Set<string> => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return new Set<string>();
  const currentRevision = readCurrentPersonalLikeRevision130(normalizedUid);
  const cached = targetedVerifiedByUid127.get(normalizedUid);
  if (cached && targetedVerifiedRevisionByUid130.get(normalizedUid) === currentRevision) return cached;

  const verified = new Set<string>();
  // App134: an unchanged private R2 revision preserves existing verified/local
  // membership across an app update. App version changes are never a reason to
  // force another D1 membership read.
  if (currentRevision) {
    try {
      const raw = JSON.parse(
        readLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_TARGETED_VERIFIED_130, normalizedUid)),
      ) as { revision?: unknown; trackIds?: unknown };
      if (String(raw?.revision || '') === currentRevision && Array.isArray(raw?.trackIds)) {
        raw.trackIds.slice(-1000).forEach((value) => {
          const id = String(value || '').trim();
          if (id) verified.add(id);
        });
      }
    } catch {}
  }

  targetedVerifiedByUid127.set(normalizedUid, verified);
  targetedVerifiedRevisionByUid130.set(normalizedUid, currentRevision);
  return verified;
};

const persistTargetedVerifiedLikeTracks127 = (uid: string, verified: Set<string>) => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return;
  const currentRevision = readCurrentPersonalLikeRevision130(normalizedUid);
  const bounded = [...verified].slice(-1000);
  targetedVerifiedByUid127.set(normalizedUid, new Set(bounded));
  targetedVerifiedRevisionByUid130.set(normalizedUid, currentRevision);
  if (!currentRevision) return;
  writeLikeLocal127(
    scopedLikeKey127(EXPLORE_LIKE_TARGETED_VERIFIED_130, normalizedUid),
    JSON.stringify({ revision: currentRevision, trackIds: bounded }),
  );
};

const clearTargetedVerifiedLikeTracks127 = (uid: string) => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return;
  targetedVerifiedByUid127.delete(normalizedUid);
  targetedVerifiedRevisionByUid130.delete(normalizedUid);
  writeLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_TARGETED_VERIFIED_127, normalizedUid), '');
  writeLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_TARGETED_VERIFIED_130, normalizedUid), '');
};
// Accepted D1 queue != updated personal R2. Keep a UID-scoped override for
// accepted tracks whose shared R2 CAS was not materialized; an older R2 read
// must not silently reverse this device's final intention on the next visit.
// An updated *R2 snapshot* is still only an accepted, pre-aggregate intent:
// the canonical D1 likes relation can be changed later by 069/075 processing.
// A missing field or 'updated' is NOT evidence of final personal membership.
// Only a future independently verified canonical-settled response may release
// this guard and send a cross-device confirmed event. No current intake Worker
// emits 'settled'; do not turn this on until a durable settlement protocol exists.
export const canBroadcastExploreLikeSnapshot127 = (status: unknown): boolean => status === 'settled';

const readSnapshotPending127 = (uid: string): Record<string, boolean> => {
  try {
    const raw = JSON.parse(readLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_SNAPSHOT_PENDING_127, uid)));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return Object.fromEntries(Object.entries(raw).filter(
      ([id, value]) => Boolean(id) && typeof value === 'boolean',
    )) as Record<string, boolean>;
  } catch { return {}; }
};
const writeSnapshotPending127 = (uid: string, values: Record<string, boolean>) => {
  writeLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_SNAPSHOT_PENDING_127, uid), JSON.stringify(values));
};

const readSeenLikeSignal127 = (uid: string) =>
  Math.max(signalRevisionByUid127.get(uid) || 0, Number(readLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_SIGNAL_SEEN_127, uid))) || 0);
const markSeenLikeSignal127 = (uid: string, version: number) => {
  const next = Math.max(readSeenLikeSignal127(uid), version);
  signalRevisionByUid127.set(uid, next);
  writeLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_SIGNAL_SEEN_127, uid), String(next));
};
const readRepairTarget127 = (uid: string) =>
  Math.max(0, Number(readLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_REPAIR_TARGET_127, uid))) || 0);
const requestRepair127 = (uid: string, version: number) => {
  const target = Math.max(readRepairTarget127(uid), version);
  writeLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_REPAIR_TARGET_127, uid), String(target));
  baselineCompleted127.delete(uid);
  clearTargetedVerifiedLikeTracks127(uid);
  // A remote account change must invalidate BOTH complete and partial baseline
  // markers. Otherwise a partial legacy snapshot can make ensurePersonalLikeBaseline127
  // return immediately and the other device never re-checks the changed heart.
  writeLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_BASELINE_127, uid), '');
  writeLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_PARTIAL_BASELINE_161, uid), '');
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
  // On first subscription the retained RTDB signal can contain account changes
  // accepted after this device's R2 baseline. Do not discard those exact track
  // transitions merely because this device has no prior signal watermark.
  // An actual missing interval (a previously seen version) still requires repair.
  const gap = lastSeen > 0 && signal.previousVersion !== lastSeen;
  if (gap || readRepairTarget127(uid) > 0) {
    // A failed R2 repair must never ACK the incoming RTDB revision. Record a
    // durable retry target and let the verified personal snapshot finish first.
    requestRepair127(uid, signal.version);
    const current = auth.currentUser;
    if (current?.uid === uid) {
      void ensurePersonalLikeBaseline127(current)
        .then(() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT, {
              detail: { uid, reason: 'personal-like-repair-complete' },
            }));
          }
        })
        .catch((error) => console.warn('[127] Personal like gap repair retained for retry:', error));
    }
    return;
  }
  const pending = readLikeOutbox(uid);
  const unresolved = readSnapshotPending127(uid);
  const cache = getLikedStateCache(uid);
  const displayLocks = readLikeDisplayLocks(uid);
  const acceptedAt = Date.now();
  let changed = false;
  let unresolvedChanged = false;
  let locksChanged = false;
  for (const item of signal.results) {
    // A newer unsent local click must win. An older accepted-but-unsettled
    // intention must NOT permanently block a newer server-accepted device state.
    if (pending[item.trackId]) continue;
    if (cache.get(item.trackId) !== item.liked) {
      cache.set(item.trackId, item.liked);
      patchExploreLikedTrackMembership(uid, item.trackId, item.liked);
      changed = true;
    }
    // The same accepted state must remain visible even on partial legacy R2
    // accounts, where a targeted D1 read can still lag behind the intake queue.
    // It is not an extra write to the shared user database.
    if (unresolved[item.trackId] !== item.liked) {
      unresolved[item.trackId] = item.liked;
      unresolvedChanged = true;
    }
    // Persist the accepted count as well as the heart: an RTDB event can arrive
    // before Explore mounts, and a cached Feed may still carry an older count.
    displayLocks[item.trackId] = {
      liked: item.liked,
      likeCount: clampLikeCount(item.likeCount),
      updatedAt: acceptedAt,
      protectUntil: acceptedAt + EXPLORE_LIKE_SHARED_PUBLISH_LOCK_MS_120,
    };
    locksChanged = true;
    // A changed count matters even when the heart boolean is already identical.
    // Reconcile Feed/Profile/My Likes with the same accepted account pair.
    dispatchLikeSync({ ...item, uid, source: 'remote' });
  }
  if (changed) persistLikedStateCache(uid, cache);
  if (unresolvedChanged) writeSnapshotPending127(uid, unresolved);
  if (locksChanged) persistLikeDisplayLocks(uid, displayLocks);
  markSeenLikeSignal127(uid, signal.version);
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
      if (activeLikeSignalUid127 !== uid || auth.currentUser?.uid !== uid) return;
      const signal = normalizeLikeSignal127(snapshot.val());
      if (signal) applyRemoteLikeSignal127(uid, signal);
    },
    (error) => console.warn('[127] Personal like signal unavailable; local cache preserved:', error),
  );
};
// This listener does not read Firestore/D1 and subscribes once for the signed-in
// account, not once per song/card/tab. No continuous timer or global Feed reload.
onAuthStateChanged(auth, (user) => startLikeSignal127(user?.uid || ''));

const requestPersonalLikeBaseline127 = async (user: User): Promise<ExploreLikeBaselineSnapshot161> => {
  const headers = await buildAuthHeaders(user);
  const response = await fetch(EXPLORE_API_BASE + '/v1/me/social-snapshot', {
    method: 'GET',
    headers,
  });
  recordCloudflareResponse(response, '/v1/me/social-snapshot');
  if (!response.ok) throw new Error('Personal like snapshot unavailable: HTTP ' + response.status);
  const payload = await response.json() as {
    ok?: boolean;
    data?: {
      likedTrackIds?: unknown;
      likesComplete?: unknown;
      exactLikeCount?: unknown;
    };
  };
  if (payload?.ok !== true || !Array.isArray(payload?.data?.likedTrackIds)) {
    throw new Error('Personal like snapshot is invalid; preserving cached likes');
  }
  const likedTrackIds = [...new Set(
    payload.data.likedTrackIds.map((id) => String(id || '').trim()).filter(Boolean),
  )];
  const exactLikeCount = Number(payload.data.exactLikeCount);
  const complete = payload.data.likesComplete === true &&
    Number.isSafeInteger(exactLikeCount) && exactLikeCount >= 0 &&
    exactLikeCount === likedTrackIds.length;
  return {
    likedTrackIds,
    complete,
    exactLikeCount: complete ? exactLikeCount : null,
  };
}

// One-time per user migration from older local liked-state to the already
// materialized per-user R2 bundle. Never clear device data, never scan D1 on
// ordinary entry. The server may use its existing recovery path if R2 is absent.
const ensurePersonalLikeBaseline127 = async (user: User): Promise<void> => {
  const uid = user.uid;
  if (!uid || baselineCompleted127.has(uid) ||
      readLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_BASELINE_127, uid)) === '1' ||
      readLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_PARTIAL_BASELINE_161, uid)) === '1') return;
  const inflight = baselineInFlight127.get(uid);
  if (inflight) return inflight;
  const task = (async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const versionAtStart = readSeenLikeSignal127(uid);
      const repairAtStart = readRepairTarget127(uid);
      const snapshot161 = await requestPersonalLikeBaseline127(user);
      const likedIds = snapshot161.likedTrackIds;
      if (readSeenLikeSignal127(uid) !== versionAtStart ||
          readRepairTarget127(uid) !== repairAtStart) {
        // Concurrent device mutation: reread the small per-user R2 snapshot,
        // never accept an older response over the user's latest signal.
        if (attempt === 0) continue;
        throw new Error('Personal like signal advanced during baseline; retry on next entry');
      }

      // Reader-first 161: an old v114 object is useful only as a cache hint.
      // It may have been truncated at 2,000 in the past and later fallen below
      // 2,000, so neither size nor absence proves an unliked relation. Preserve
      // every local heart and let the bounded /v1/me/likes route verify only
      // visible cache misses. The R2 revision marker prevents repeated snapshot
      // GETs until that shared object actually changes.
      if (!snapshot161.complete) {
        // Legacy partial R2 is a positive catalog hint, never a reason to scan
        // visible Feed rows on every entry. Merge its known liked IDs into the
        // device catalog and keep the last device state for the rest.
        seedExploreLikedTrackCandidates129(uid, likedIds);
        const cache = getLikedStateCache(uid);
        let changed = false;
        for (const id of likedIds) {
          if (cache.get(id) === true) continue;
          cache.set(id, true);
          changed = true;
        }
        if (changed) persistLikedStateCache(uid, cache);
        writeLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_PARTIAL_BASELINE_161, uid), '1');
        return;
      }

      const confirmed = new Set(likedIds);
      const outbox = readLikeOutbox(uid);
      const unresolved = readSnapshotPending127(uid);
      const cache = getLikedStateCache(uid);
      const scope = new Set([...cache.keys(), ...confirmed, ...Object.keys(unresolved), ...Object.keys(outbox)]);
      let changed = false;
      for (const id of scope) {
        const nextLiked = outbox[id]?.desiredLiked ?? unresolved[id] ?? confirmed.has(id);
        if (cache.get(id) === nextLiked) continue;
        cache.set(id, nextLiked);
        changed = true;
      }
      if (changed) persistLikedStateCache(uid, cache);
      reconcileExploreLikedTrackCollectionSnapshot127(
        uid, likedIds, {
          ...unresolved,
          ...Object.fromEntries(Object.entries(outbox).map(([id, row]) => [id, row.desiredLiked])),
        },
      );
      if (repairAtStart > 0) {
        markSeenLikeSignal127(uid, repairAtStart);
        writeLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_REPAIR_TARGET_127, uid), '');
      }
      baselineCompleted127.add(uid);
      writeLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_PARTIAL_BASELINE_161, uid), '');
      writeLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_BASELINE_127, uid), '1');
      return;
    }
  })().finally(() => { baselineInFlight127.delete(uid); });
  baselineInFlight127.set(uid, task);
  return task;
}

export const invalidateExplorePersonalLikeBaseline127 = (uid: string) => {
  if (!uid) return;
  baselineCompleted127.delete(uid);
  clearTargetedVerifiedLikeTracks127(uid);
  writeLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_BASELINE_127, uid), '');
  writeLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_PARTIAL_BASELINE_161, uid), '');
};

export const ensureExplorePersonalLikeBaseline127 = ensurePersonalLikeBaseline127;

// SORIDRAW_EXPLORE_LIKE_LEGACY_R2_COMPAT_072_20260920
// All old and new app generations share one user R2 like bundle. Check its
// private HEAD at most once per five minutes of active Explore use. Unlike a
// global Feed revision, this detects a legacy app's change to the current
// account without a broad D1 membership scan. Unchanged HEAD -> no data GET.
const requestPersonalLikeRevision127 = async (user: User): Promise<string> => {
  const payload = await requestExploreLike(user, '/v1/me/likes-revision');
  const revision = String(payload?.data?.revision || '').trim();
  if (payload?.ok !== true || !revision || revision.length > 256) {
    throw new Error('Personal like revision unavailable; preserving last confirmed cache');
  }
  return revision;
};

export const checkExplorePersonalLikeRevision127 = async (user: User): Promise<void> => {
  const uid = String(user?.uid || '').trim();
  if (!uid) return;
  const now = Date.now();
  if (now - (revisionCheckAtByUid127.get(uid) || 0) < EXPLORE_LIKE_LEGACY_CHECK_MS_127) return;
  const existing = revisionCheckInFlight127.get(uid);
  if (existing) return existing;
  const task = (async () => {
    try {
      const revision = await requestPersonalLikeRevision127(user);
      if (auth.currentUser?.uid !== uid) return;
      const key = scopedLikeKey127(EXPLORE_LIKE_R2_REVISION_127, uid);
      const previous = readLikeLocal127(key);
      if (previous !== revision) {
        invalidateExplorePersonalLikeBaseline127(uid);
        await ensurePersonalLikeBaseline127(user);
        if (auth.currentUser?.uid !== uid) return;
        // A failed snapshot never advances this marker. The next focus/entry
        // retries the exact same revision without hiding a stale heart.
        writeLikeLocal127(key, revision);
        if (typeof window !== 'undefined' && previous) {
          window.dispatchEvent(new CustomEvent(EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT, {
            detail: { uid, reason: 'personal-r2-revision-changed' },
          }));
        }
      }
      // Same private R2 revision means no account like changed. Keep the
      // app134 per-track canonical proof and make ordinary re-entry D1 R0.
      revisionCheckAtByUid127.set(uid, Date.now());
    } catch (error) {
      // Throttle a broken connection for only 30 seconds, not for the entire
      // five-minute normal check window. Never clear the last good liked set.
      revisionCheckAtByUid127.set(uid, Date.now() - EXPLORE_LIKE_LEGACY_CHECK_MS_127 + 30_000);
      throw error;
    }
  })().finally(() => { revisionCheckInFlight127.delete(uid); });
  revisionCheckInFlight127.set(uid, task);
  return task;
};

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
    if (!current?.uid) return;
    if (readSignalRetry127(current.uid).length) {
      void publishConfirmedLikeSignal127(current.uid, readSignalRetry127(current.uid))
        .catch((error) => console.warn('[127] Pending personal like notification retained:', error));
    }
    if (readRepairTarget127(current.uid) > 0) {
      void ensurePersonalLikeBaseline127(current)
        .then(() => {
          window.dispatchEvent(new CustomEvent(EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT, {
            detail: { uid: current.uid, reason: 'personal-like-repair-complete' },
          }));
        })
        .catch((error) => console.warn('[127] Pending like repair retained:', error));
    }
  };
  window.addEventListener('online', retry);
  window.addEventListener('focus', retry);
  // Recover a previously ACKed but unannounced batch immediately on reopen.
  retry();
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
    operationId: typeof row.operationId === 'string' && /^[0-9a-f-]{36}$/i.test(row.operationId)
      ? row.operationId : undefined,
    expectedRevision: Number.isSafeInteger(Number(row.expectedRevision)) && Number(row.expectedRevision) >= 0
      ? Number(row.expectedRevision) : undefined,
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
      const pair = normalizeExploreLikeDisplayPair129(
        pending.desiredLiked,
        pending.optimisticLikeCount,
      );
      return pair.likeCount === track.likeCount ? track : { ...track, likeCount: pair.likeCount };
    }

    const effectiveLiked = readExploreTrackLikeMembership127(normalizedUid, trackId);
    const lock = locks[trackId];
    if (lock) {
      const sharedCount = clampLikeCount(track.likeCount);
      if (sharedCount === lock.likeCount || lock.protectUntil <= now) {
        delete locks[trackId];
        locksChanged = true;
      } else {
        const pair = normalizeExploreLikeDisplayPair129(lock.liked, lock.likeCount);
        return pair.likeCount === track.likeCount ? track : { ...track, likeCount: pair.likeCount };
      }
    }

    if (effectiveLiked === true) {
      const pair = normalizeExploreLikeDisplayPair129(true, track.likeCount);
      return pair.likeCount === track.likeCount ? track : { ...track, likeCount: pair.likeCount };
    }
    return track;
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
    const likeCount = Number(row.likeCount);
    const revision = Number(row.revision);
    const generation = Number(row.generation);
    const status = typeof row.status === 'string' && [
      'applied', 'duplicate', 'already-desired', 'revision-conflict', 'ineligible', 'legacy-queued',
    ].includes(row.status) ? row.status as ExploreLikeBatchResult['status'] : undefined;
    results.push({
      trackId,
      liked: row.liked,
      ...(Number.isSafeInteger(likeCount) && likeCount >= 0 ? { likeCount } : {}),
      ...(Number.isSafeInteger(revision) && revision >= 0 ? { revision } : {}),
      ...(Number.isSafeInteger(generation) && generation >= 0 ? { generation } : {}),
      ...(typeof row.operationId === 'string' && row.operationId.trim() ? { operationId: row.operationId.trim() } : {}),
      ...(status ? { status } : {}),
    });
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

// An earlier batch may be in flight while the same song is toggled again.
// Never discard a later unlike just because its ORIGINAL baseline was unliked:
// the earlier like may still commit. Rebase the later intent to the earlier
// intake outcome even when the response was lost (the accepted state is then
// uncertain, but a final explicit desired state must still be transmitted).
const rebaseExploreLikeAfterInFlight127 = (
  latest: ExploreLikePendingMutation,
  prior: ExploreLikePendingMutation,
): ExploreLikePendingMutation => {
  const baseLiked = prior.desiredLiked;
  const baseLikeCount = prior.optimisticLikeCount;
  return {
    ...latest,
    baseLiked,
    baseLikeCount,
    optimisticLikeCount: computeExploreLikeAction127(baseLiked, latest.desiredLiked, baseLikeCount).likeCount,
  };
};

flushPendingLikes = async (user: User): Promise<void> => {
  const uid = String(user?.uid || '').trim();
  if (!uid || inflightByUid.has(uid)) return;

  const outbox = readLikeOutbox(uid);
  // One-time recovery for pending entries written by older app versions.
  // Do not regenerate an ID after an ambiguous response: the persisted ID is
  // the identity of this user intention, not of each HTTP attempt.
  let upgradedLegacyOutbox144 = false;
  const revisions172 = readLikeCanonicalRevisions172(uid);
  for (const mutation of Object.values(outbox)) {
    if (!mutation.operationId) {
      mutation.operationId = createExploreLikeOperationId144();
      upgradedLegacyOutbox144 = true;
    }
    if (!Number.isSafeInteger(mutation.expectedRevision) || Number(mutation.expectedRevision) < 0) {
      mutation.expectedRevision = revisions172[mutation.trackId] ?? 0;
      upgradedLegacyOutbox144 = true;
    }
  }
  if (upgradedLegacyOutbox144) persistLikeOutbox(uid, outbox);
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
            operationId: pending.operationId,
            expectedRevision: pending.expectedRevision ?? 0,
          })),
        }),
      });
      const results = normalizeBatchResults(payload, batchEntries.map((pending) => pending.trackId));
      // An accepted response must match the specific mutation sent in THIS
      // request. A stale/mixed response is not proof of that intent; retaining
      // the outbox is safer than clearing the user's last click.
      const sentByTrack127 = new Map(batchEntries.map((pending) => [pending.trackId, pending.desiredLiked]));
      if (results.some((row) =>
        row.status !== 'revision-conflict' &&
        row.status !== 'ineligible' &&
        sentByTrack127.get(row.trackId) !== row.liked
      )) {
        throw new Error('좋아요 서버 응답이 전송한 변경과 일치하지 않습니다. 최신 상태를 보관했습니다.');
      }
      // The account-private heart state is committed at batch ACK/R2 intake.
      // Public aggregate publication may still be delayed, but another device
      // must receive the accepted account state now instead of waiting for a
      // "settled" flag that the current Worker never emits.
      const canonicalLikeSettled127 = canBroadcastExploreLikeSnapshot127(payload?.data?.personalLikeSnapshot);
      const resultByTrack = new Map(results.map((result) => [result.trackId, result]));
      const latest = readLikeOutbox(uid);
      const cache = getLikedStateCache(uid);
      const canonicalRevisions172 = readLikeCanonicalRevisions172(uid);
      const snapshotPending127 = readSnapshotPending127(uid);
      const displayLocks = readLikeDisplayLocks(uid);
      const acknowledgedAt = Date.now();
      const acceptedForSignal127: ExploreLikeAcceptedRow127[] = [];

      for (const pending of batchEntries) {
        const result = resultByTrack.get(pending.trackId);
        if (!result) continue;
        const current = latest[pending.trackId];
        const hasNewerPending = Boolean(current && current.updatedAt !== pending.updatedAt);
        const canonicalLikeCount = Number.isSafeInteger(result.likeCount)
          ? Number(result.likeCount) : pending.optimisticLikeCount;
        if (Number.isSafeInteger(result.revision) && Number(result.revision) >= 0) {
          canonicalRevisions172[pending.trackId] = Number(result.revision);
        }
        if (hasNewerPending && current) {
          // A newer local click continues only after rebasing onto the exact
          // canonical revision returned for the older in-flight request.
          if (Number.isSafeInteger(result.revision) && Number(result.revision) >= 0) {
            const baseLiked = result.liked;
            const baseLikeCount = canonicalLikeCount;
            latest[pending.trackId] = {
              ...current,
              baseLiked,
              baseLikeCount,
              expectedRevision: Number(result.revision),
              optimisticLikeCount: computeExploreLikeAction127(
                baseLiked, current.desiredLiked, baseLikeCount,
              ).likeCount,
            };
          } else {
            latest[pending.trackId] = rebaseExploreLikeAfterInFlight127(current, pending);
          }
          continue;
        }
        if (!hasNewerPending) {
          // A stale PC/mobile request is not automatically replayed over a
          // newer canonical state. The returned server state becomes local
          // truth; the next explicit click creates a fresh operation.
          cache.set(pending.trackId, result.liked);
          displayLocks[pending.trackId] = {
            liked: result.liked,
            likeCount: canonicalLikeCount,
            updatedAt: acknowledgedAt,
            protectUntil: acknowledgedAt + EXPLORE_LIKE_SHARED_PUBLISH_LOCK_MS_120,
          };
          delete latest[pending.trackId];
          if (result.status === 'revision-conflict' || result.status === 'ineligible') {
            delete snapshotPending127[pending.trackId];
            dispatchLikeSync({
              uid,
              trackId: pending.trackId,
              ownerUid: pending.ownerUid,
              liked: result.liked,
              likeCount: canonicalLikeCount,
              source: 'remote',
            });
            continue;
          }
          const accepted: ExploreLikeAcceptedRow127 = {
            uid,
            trackId: pending.trackId,
            ownerUid: pending.ownerUid,
            liked: result.liked,
            likeCount: canonicalLikeCount,
            source: 'confirmed',
          };
          // Cross-device membership follows the server-accepted account state,
          // not the later public aggregate. Keep the local snapshot-pending guard
          // until canonical settlement, but still publish this accepted 0/1 heart
          // to the same account's other devices immediately after the 30s batch.
          acceptedForSignal127.push(accepted);
          if (canonicalLikeSettled127) {
            delete snapshotPending127[pending.trackId];
          } else {
            snapshotPending127[pending.trackId] = result.liked;
          }
          dispatchLikeSync({ ...accepted, source: canonicalLikeSettled127 ? 'confirmed' : 'local' });
        }
      }

      persistLikedStateCache(uid, cache);
      persistLikeCanonicalRevisions172(uid, canonicalRevisions172);
      persistLikeDisplayLocks(uid, displayLocks);
      writeSnapshotPending127(uid, snapshotPending127);
      persistLikeOutbox(uid, latest);
      succeeded = true;
      // Cross-device notification is now tied to the accepted account state.
      // Notification failure must NEVER replay a successful D1 queue intake.
      try {
        await publishConfirmedLikeSignal127(uid, acceptedForSignal127);
      } catch (notifyError) {
        console.warn('[127] Like accepted; cross-device signal pending retry:', notifyError);
        const firstAccepted = acceptedForSignal127[0];
        if (firstAccepted) {
          dispatchLikeSyncError({
            ...firstAccepted,
            message: '좋아요 변경은 접수됐지만 다른 기기 알림은 재시도 중이에요.',
          });
        }
      }
    } catch (reason) {
      const latest = readLikeOutbox(uid);
      const first = batchEntries[0];
      for (const pending of batchEntries) {
        const current = latest[pending.trackId];
        if (current?.updatedAt === pending.updatedAt) {
          current.retryCount = Math.min(8, current.retryCount + 1);
          latest[pending.trackId] = current;
        } else if (current && current.updatedAt > pending.updatedAt) {
          // The first request MAY have reached the server before the network
          // error. Explicitly retain the last click instead of deleting it as
          // an apparent no-op against the old baseline.
          latest[pending.trackId] = rebaseExploreLikeAfterInFlight127(current, pending);
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
    await checkExplorePersonalLikeRevision127(user);
    await ensurePersonalLikeBaseline127(user);
  } catch (reason) {
    // The existing account cache is still usable while an R2 repair is retried.
    console.warn('[127] Personal like baseline pending; retaining local state:', reason);
  }

  const cache = getLikedStateCache(user.uid);
  const verified127 = readTargetedVerifiedLikeTracks127(user.uid);
  const baselineReady127 = baselineCompleted127.has(user.uid) ||
    readLikeLocal127(scopedLikeKey127(EXPLORE_LIKE_BASELINE_127, user.uid)) === '1';
  const beforeOutbox127 = readLikeOutbox(user.uid);
  const beforeUnresolved127 = readSnapshotPending127(user.uid);
  const localCatalogReady127 = baselineReady127 || hasLikedStateStorage127(user.uid);
  const missing = localCatalogReady127 ? [] : normalized.filter((trackId) => {
    if (beforeOutbox127[trackId] ||
        Object.prototype.hasOwnProperty.call(beforeUnresolved127, trackId)) return false;
    return !cache.has(trackId) || !verified127.has(trackId);
  });
  if (missing.length) {
    const query = new URLSearchParams({ trackIds: missing.join(',') });
    const payload = await requestExploreLike(user, `/v1/me/likes?${query.toString()}`);
    const likedIds = new Set(
      Array.isArray(payload?.data?.likedTrackIds)
        ? payload.data.likedTrackIds.map((trackId: unknown) => String(trackId || '').trim()).filter(Boolean)
        : [],
    );
    // A bounded /v1/me/likes result is exact for every requested ID even when
    // the account-wide legacy R2 snapshot is partial. Re-read local mutation
    // guards after the request; only untouched IDs become click-authoritative.
    const currentOutbox127 = readLikeOutbox(user.uid);
    const currentUnresolved127 = readSnapshotPending127(user.uid);
    for (const trackId of missing) {
      if (currentOutbox127[trackId] ||
          Object.prototype.hasOwnProperty.call(currentUnresolved127, trackId)) continue;
      cache.set(trackId, likedIds.has(trackId));
      verified127.add(trackId);
    }
    persistLikedStateCache(user.uid, cache);
    persistTargetedVerifiedLikeTracks127(user.uid, verified127);
  }

  const outbox = readLikeOutbox(user.uid);
  const unresolved = readSnapshotPending127(user.uid);
  if (Object.keys(outbox).length) schedulePendingFlush(user);

  return normalized.filter((trackId) => outbox[trackId]?.desiredLiked ?? unresolved[trackId] ?? cache.get(trackId) === true);
};

// App129 single-authority rule:
// - My Likes is NOT allowed to overwrite personal heart membership.
// - The liked-track collection is only a candidate/card index.
// - Effective membership always comes from the same personal-like state used by
//   Feed/Profile hearts: pending click > accepted-unsettled intent > verified
//   canonical membership cache.
export const getExploreKnownLikeCandidateIds127 = (uid: string): string[] => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return [];
  const cache = getLikedStateCache(normalizedUid);
  const outbox = readLikeOutbox(normalizedUid);
  const unresolved = readSnapshotPending127(normalizedUid);
  const candidates = new Set<string>();
  for (const [trackId, liked] of cache.entries()) if (liked) candidates.add(trackId);
  for (const [trackId, liked] of Object.entries(unresolved)) if (liked) candidates.add(trackId);
  for (const [trackId, pending] of Object.entries(outbox)) {
    if (pending.desiredLiked) candidates.add(trackId);
    else candidates.delete(trackId);
  }
  return [...candidates];
};

export const reconcileExploreLikedTrackCollectionState = (
  uid: string,
  candidateLikedTrackIds: string[],
): string[] => {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return [];

  const scope = new Set<string>([
    ...candidateLikedTrackIds.map((trackId) => String(trackId || '').trim()).filter(Boolean),
    ...getExploreKnownLikeCandidateIds127(normalizedUid),
  ]);
  const effectiveLikedTrackIds: string[] = [];
  for (const trackId of scope) {
    if (readExploreTrackLikeMembership127(normalizedUid, trackId) === true) {
      effectiveLikedTrackIds.push(trackId);
    }
  }
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
  // Pending accepted-but-unsettled intent outranks a legacy cached heart.
  const previousVisibleLiked = existing?.desiredLiked ??
    readExploreTrackLikeMembership127(uid, normalizedTrackId) ?? !liked;
  const baseLiked = existing?.baseLiked ?? previousVisibleLiked;
  const baseLikeCount = existing?.baseLikeCount ?? clampLikeCount(currentLikeCount);
  const optimisticAction127 = computeExploreLikeAction127(baseLiked, liked, baseLikeCount);
  const optimisticLikeCount = optimisticAction127.likeCount;
  // A millisecond timestamp is not a unique mutation version: two clicks in
  // the same millisecond could make an old ACK look like the newest action.
  // Keep updatedAt strictly monotonic for THIS track while preserving the
  // existing persisted outbox format and the 30-second batching contract.
  const now = nextExploreLikeMutationAt127(existing?.updatedAt || 0, Date.now());

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
    operationId: createExploreLikeOperationId144(),
    expectedRevision: existing?.expectedRevision ??
      readLikeCanonicalRevisions172(uid)[normalizedTrackId] ?? 0,
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

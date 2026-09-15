import { EXPLORE_API_BASE } from '../config/exploreEnvironment';
import { auth, getFirebaseAppCheckToken } from '../firebase';
import { recordCloudflareResponse } from '../lib/cloudflareDiagnostics';
import { readSoridrawPersistentCache } from '../lib/soridrawPersistentCache';

// SORIDRAW_EXPLORE_SHARED_DISPLAY_COUNT_091_20260915
// SORIDRAW_EXPLORE_LIKE_ZERO_COUNT_RECOVERY_093_20260915
const STORAGE_VERSION_091 = 1;
const STORAGE_PREFIX_091 = 'soridraw:explore-like-display:091:';
const DISPLAY_TTL_MS_091 = 30 * 60_000;

type ExploreLikeDisplayPhase091 = 'pending' | 'accepted';

type ExploreLikeDisplayState091 = {
  trackId: string;
  ownerUid: string;
  baseLiked: boolean;
  desiredLiked: boolean;
  baseLikeCount: number;
  displayLikeCount: number;
  phase: ExploreLikeDisplayPhase091;
  updatedAt: number;
  expiresAt: number;
};

export type ExploreLikeCanonicalCount091 = {
  trackId: string;
  likeCount: number;
};

const canonicalCountsByUid091 = new Map<string, Map<string, number>>();
const displayStatesByUid091 = new Map<string, Map<string, ExploreLikeDisplayState091>>();
const loadedUid091 = new Set<string>();

const normalizeUid091 = (value: unknown) => String(value || '').trim();
const normalizeTrackId091 = (value: unknown) => String(value || '').trim();
const clampCount091 = (value: unknown) => {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
};

const storageKey091 = (uid: string) => `${STORAGE_PREFIX_091}${uid}`;

const persistStates091 = (uid: string, states: Map<string, ExploreLikeDisplayState091>) => {
  if (!uid || typeof window === 'undefined') return;
  try {
    if (!states.size) {
      window.localStorage.removeItem(storageKey091(uid));
      return;
    }
    window.localStorage.setItem(storageKey091(uid), JSON.stringify({
      version: STORAGE_VERSION_091,
      states: [...states.values()],
    }));
  } catch {
    // Display state is a local UX aid; storage failure must never block likes.
  }
};

const loadStates091 = (uid: string) => {
  const normalizedUid = normalizeUid091(uid);
  let states = displayStatesByUid091.get(normalizedUid);
  if (!states) {
    states = new Map<string, ExploreLikeDisplayState091>();
    displayStatesByUid091.set(normalizedUid, states);
  }
  if (!normalizedUid || loadedUid091.has(normalizedUid)) return states;
  loadedUid091.add(normalizedUid);
  if (typeof window === 'undefined') return states;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey091(normalizedUid)) || 'null');
    if (!parsed || parsed.version !== STORAGE_VERSION_091 || !Array.isArray(parsed.states)) return states;
    const now = Date.now();
    for (const raw of parsed.states) {
      if (!raw || typeof raw !== 'object') continue;
      const trackId = normalizeTrackId091(raw.trackId);
      const expiresAt = Math.max(0, Number(raw.expiresAt || 0));
      if (!trackId || expiresAt <= now) continue;
      const phase: ExploreLikeDisplayPhase091 = raw.phase === 'pending' ? 'pending' : 'accepted';
      states.set(trackId, {
        trackId,
        ownerUid: normalizeUid091(raw.ownerUid),
        baseLiked: Boolean(raw.baseLiked),
        desiredLiked: Boolean(raw.desiredLiked),
        baseLikeCount: clampCount091(raw.baseLikeCount),
        displayLikeCount: clampCount091(raw.displayLikeCount),
        phase,
        updatedAt: Math.max(0, Number(raw.updatedAt || 0)),
        expiresAt,
      });
    }
    persistStates091(normalizedUid, states);
  } catch {
    // Ignore corrupt local display state and continue from canonical caches.
  }
  return states;
};

const canonicalMap091 = (uid: string) => {
  const normalizedUid = normalizeUid091(uid);
  let counts = canonicalCountsByUid091.get(normalizedUid);
  if (!counts) {
    counts = new Map<string, number>();
    canonicalCountsByUid091.set(normalizedUid, counts);
  }
  return counts;
};

export const seedExploreLikeCanonicalCounts091 = (
  uid: string,
  rows: ExploreLikeCanonicalCount091[],
) => {
  const normalizedUid = normalizeUid091(uid);
  if (!normalizedUid) return;
  const counts = canonicalMap091(normalizedUid);
  rows.forEach((row) => {
    const trackId = normalizeTrackId091(row.trackId);
    if (trackId && !counts.has(trackId)) counts.set(trackId, clampCount091(row.likeCount));
  });
};

export const updateExploreLikeCanonicalCounts091 = (
  uid: string,
  rows: ExploreLikeCanonicalCount091[],
  confirmAccepted = false,
) => {
  const normalizedUid = normalizeUid091(uid);
  if (!normalizedUid) return;
  const counts = canonicalMap091(normalizedUid);
  const states = loadStates091(normalizedUid);
  let stateChanged = false;
  rows.forEach((row) => {
    const trackId = normalizeTrackId091(row.trackId);
    if (!trackId) return;
    counts.set(trackId, clampCount091(row.likeCount));
    if (confirmAccepted && states.get(trackId)?.phase === 'accepted') {
      states.delete(trackId);
      stateChanged = true;
    }
  });
  if (stateChanged) persistStates091(normalizedUid, states);
};

export const getExploreLikeCanonicalCount091 = (
  uid: string,
  trackId: string,
  fallbackLikeCount = 0,
) => {
  const normalizedUid = normalizeUid091(uid);
  const normalizedTrackId = normalizeTrackId091(trackId);
  if (!normalizedUid || !normalizedTrackId) return clampCount091(fallbackLikeCount);
  const counts = canonicalMap091(normalizedUid);
  if (!counts.has(normalizedTrackId)) counts.set(normalizedTrackId, clampCount091(fallbackLikeCount));
  return counts.get(normalizedTrackId) ?? clampCount091(fallbackLikeCount);
};

const ZERO_COUNT_RECOVERY_ROUTE_093 = '/v1/me/liked-tracks';
const ZERO_COUNT_RECOVERY_BATCH_MAX_093 = 50;
const ZERO_COUNT_RECOVERY_COOLDOWN_MS_093 = 12 * 60_000;
const ZERO_COUNT_RECOVERY_FAILURE_COOLDOWN_MS_093 = 60_000;
const ZERO_COUNT_RECOVERY_STORAGE_PREFIX_093 = 'soridraw:explore-like-zero-count-recovery:093:';
const ZERO_COUNT_LIKED_CACHE_KEY_093 = 'explore-liked-state';
const ZERO_COUNT_LIKED_SOURCE_TYPE_093 = 'explore_likes';
const ZERO_COUNT_LIKED_SCHEMA_VERSION_093 = 2;
const zeroCountRecoveryQueueByUid093 = new Map<string, Set<string>>();
const zeroCountRecoveryTimerByUid093 = new Map<string, number>();
const zeroCountRecoveryInflightByUid093 = new Set<string>();
const zeroCountRecoveryFailureUntil093 = new Map<string, number>();

const zeroCountRecoveryStorageKey093 = (uid: string, trackId: string) => (
  `${ZERO_COUNT_RECOVERY_STORAGE_PREFIX_093}${uid}:${trackId}`
);

const readZeroCountRecoveryAttempt093 = (uid: string, trackId: string) => {
  if (typeof window === 'undefined') return 0;
  try {
    const value = Number(window.localStorage.getItem(zeroCountRecoveryStorageKey093(uid, trackId)) || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};

const rememberZeroCountRecoveryAttempt093 = (uid: string, trackId: string, at: number) => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(zeroCountRecoveryStorageKey093(uid, trackId), String(at)); } catch {}
};

const isPersistentlyLiked093 = (uid: string, trackId: string) => {
  const envelope = readSoridrawPersistentCache<Record<string, boolean>>({
    cacheKey: ZERO_COUNT_LIKED_CACHE_KEY_093,
    sourceType: ZERO_COUNT_LIKED_SOURCE_TYPE_093,
    schemaVersion: ZERO_COUNT_LIKED_SCHEMA_VERSION_093,
    uid,
  });
  return Boolean(envelope?.data && typeof envelope.data === 'object' && envelope.data[trackId] === true);
};

const armZeroCountRecovery093 = (uid: string) => {
  if (!uid || typeof window === 'undefined') return;
  if (zeroCountRecoveryTimerByUid093.has(uid) || zeroCountRecoveryInflightByUid093.has(uid)) return;
  const timer = window.setTimeout(() => {
    zeroCountRecoveryTimerByUid093.delete(uid);
    void flushZeroCountRecovery093(uid);
  }, 0);
  zeroCountRecoveryTimerByUid093.set(uid, timer);
};

const queueZeroCountRecovery093 = (uid: string, trackId: string) => {
  if (!uid || !trackId || typeof window === 'undefined') return;
  const now = Date.now();
  const key = `${uid}:${trackId}`;
  if ((zeroCountRecoveryFailureUntil093.get(key) || 0) > now) return;
  const lastAttempt = readZeroCountRecoveryAttempt093(uid, trackId);
  if (lastAttempt > 0 && now - lastAttempt < ZERO_COUNT_RECOVERY_COOLDOWN_MS_093) return;
  let queue = zeroCountRecoveryQueueByUid093.get(uid);
  if (!queue) {
    queue = new Set<string>();
    zeroCountRecoveryQueueByUid093.set(uid, queue);
  }
  queue.add(trackId);
  armZeroCountRecovery093(uid);
};

async function flushZeroCountRecovery093(uid: string): Promise<void> {
  if (!uid || zeroCountRecoveryInflightByUid093.has(uid)) return;
  const queue = zeroCountRecoveryQueueByUid093.get(uid);
  const trackIds = queue ? [...queue].slice(0, ZERO_COUNT_RECOVERY_BATCH_MAX_093) : [];
  if (!trackIds.length) return;
  trackIds.forEach((trackId) => queue?.delete(trackId));
  zeroCountRecoveryInflightByUid093.add(uid);

  try {
    const user = auth.currentUser;
    if (!user || user.uid !== uid) return;
    const [idToken, appCheckToken] = await Promise.all([
      user.getIdToken(),
      getFirebaseAppCheckToken(),
    ]);
    if (!appCheckToken) throw new Error('APP_CHECK_UNAVAILABLE');

    const response = await fetch(`${EXPLORE_API_BASE}${ZERO_COUNT_RECOVERY_ROUTE_093}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'X-Firebase-AppCheck': appCheckToken,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ trackIds }),
    });
    recordCloudflareResponse(response, ZERO_COUNT_RECOVERY_ROUTE_093);
    let payload: any = null;
    try { payload = await response.json(); } catch { payload = null; }
    if (!response.ok) throw new Error(`HTTP_${response.status}`);

    const canonicalLiked = new Set(
      (Array.isArray(payload?.data?.likedTrackIds) ? payload.data.likedTrackIds : [])
        .map((value: unknown) => String(value || '').trim())
        .filter(Boolean),
    );
    const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
    const itemById = new Map<string, any>(items.map((item: any) => [String(item?.id || '').trim(), item]));
    const now = Date.now();
    const counts = canonicalMap091(uid);
    const states = loadStates091(uid);
    const recovered: Array<{ trackId: string; ownerUid: string; likeCount: number }> = [];

    trackIds.forEach((trackId) => {
      rememberZeroCountRecoveryAttempt093(uid, trackId, now);
      if (!canonicalLiked.has(trackId)) return;
      const item = itemById.get(trackId);
      const nestedStats = item?.stats && typeof item.stats === 'object' ? item.stats : null;
      const likeCount = clampCount091(item?.likeCount ?? nestedStats?.likeCount);
      // Never invent a count from membership. If canonical track_stats is still 0,
      // the existing deferred aggregate/fresh-feed path remains responsible.
      if (likeCount <= 0) return;
      const ownerUid = normalizeUid091(item?.ownerUid ?? item?.owner_uid);
      counts.set(trackId, likeCount);
      states.set(trackId, {
        trackId,
        ownerUid,
        baseLiked: true,
        desiredLiked: true,
        baseLikeCount: likeCount,
        displayLikeCount: likeCount,
        phase: 'accepted',
        updatedAt: now,
        expiresAt: now + DISPLAY_TTL_MS_091,
      });
      recovered.push({ trackId, ownerUid, likeCount });
    });

    if (recovered.length) {
      persistStates091(uid, states);
      if (typeof window !== 'undefined') {
        recovered.forEach(({ trackId, ownerUid, likeCount }) => {
          window.dispatchEvent(new CustomEvent('soridraw:explore-like-sync', {
            detail: { uid, trackId, ownerUid, liked: true, likeCount, displayLikeCount: likeCount },
          }));
        });
      }
    }
  } catch (reason) {
    const retryAfter = Date.now() + ZERO_COUNT_RECOVERY_FAILURE_COOLDOWN_MS_093;
    trackIds.forEach((trackId) => zeroCountRecoveryFailureUntil093.set(`${uid}:${trackId}`, retryAfter));
    console.warn('[Explore like] targeted zero-count recovery unavailable.', reason);
  } finally {
    zeroCountRecoveryInflightByUid093.delete(uid);
    if ((zeroCountRecoveryQueueByUid093.get(uid)?.size || 0) > 0) armZeroCountRecovery093(uid);
  }
}

export const getExploreLikeDisplayCount091 = (
  uid: string,
  trackId: string,
  fallbackLikeCount = 0,
) => {
  const normalizedUid = normalizeUid091(uid);
  const normalizedTrackId = normalizeTrackId091(trackId);
  if (!normalizedUid || !normalizedTrackId) return clampCount091(fallbackLikeCount);
  const states = loadStates091(normalizedUid);
  const state = states.get(normalizedTrackId);
  if (state && state.expiresAt > Date.now()) {
    if (state.displayLikeCount === 0 && state.desiredLiked) queueZeroCountRecovery093(normalizedUid, normalizedTrackId);
    return state.displayLikeCount;
  }
  if (state) {
    states.delete(normalizedTrackId);
    persistStates091(normalizedUid, states);
  }
  const resolved = getExploreLikeCanonicalCount091(normalizedUid, normalizedTrackId, fallbackLikeCount);
  if (resolved === 0 && isPersistentlyLiked093(normalizedUid, normalizedTrackId)) {
    queueZeroCountRecovery093(normalizedUid, normalizedTrackId);
  }
  return resolved;
};

export const beginExploreLikeDisplayTransition091 = (
  uid: string,
  trackId: string,
  ownerUid: string,
  previousLiked: boolean,
  desiredLiked: boolean,
  fallbackLikeCount = 0,
) => {
  const normalizedUid = normalizeUid091(uid);
  const normalizedTrackId = normalizeTrackId091(trackId);
  if (!normalizedUid || !normalizedTrackId) return clampCount091(fallbackLikeCount);
  const states = loadStates091(normalizedUid);
  const existing = states.get(normalizedTrackId);
  const baseLiked = existing?.baseLiked ?? previousLiked;
  const baseLikeCount = existing?.baseLikeCount
    ?? getExploreLikeCanonicalCount091(normalizedUid, normalizedTrackId, fallbackLikeCount);
  const displayLikeCount = clampCount091(
    baseLikeCount + Number(desiredLiked) - Number(baseLiked),
  );
  if (desiredLiked === baseLiked) {
    states.delete(normalizedTrackId);
    persistStates091(normalizedUid, states);
    return displayLikeCount;
  }
  const now = Date.now();
  states.set(normalizedTrackId, {
    trackId: normalizedTrackId,
    ownerUid: normalizeUid091(ownerUid || existing?.ownerUid),
    baseLiked,
    desiredLiked,
    baseLikeCount,
    displayLikeCount,
    phase: 'pending',
    updatedAt: now,
    expiresAt: now + DISPLAY_TTL_MS_091,
  });
  persistStates091(normalizedUid, states);
  return displayLikeCount;
};

export const acceptExploreLikeDisplayTransition091 = (
  uid: string,
  trackId: string,
  liked: boolean,
) => {
  const normalizedUid = normalizeUid091(uid);
  const normalizedTrackId = normalizeTrackId091(trackId);
  if (!normalizedUid || !normalizedTrackId) return null;
  const states = loadStates091(normalizedUid);
  const existing = states.get(normalizedTrackId);
  if (!existing) return null;
  const now = Date.now();
  states.set(normalizedTrackId, {
    ...existing,
    desiredLiked: liked,
    phase: 'accepted',
    updatedAt: now,
    expiresAt: now + DISPLAY_TTL_MS_091,
  });
  persistStates091(normalizedUid, states);
  return states.get(normalizedTrackId)?.displayLikeCount ?? null;
};

export const importExploreLikeDisplaySignal091 = (
  uid: string,
  trackId: string,
  ownerUid: string,
  liked: boolean,
  displayLikeCount: number | undefined,
  preservePending: boolean,
) => {
  const normalizedUid = normalizeUid091(uid);
  const normalizedTrackId = normalizeTrackId091(trackId);
  const numericDisplay = Number(displayLikeCount);
  if (!normalizedUid || !normalizedTrackId || !Number.isFinite(numericDisplay)) return;
  const states = loadStates091(normalizedUid);
  if (preservePending && states.get(normalizedTrackId)?.phase === 'pending') return;
  const count = clampCount091(numericDisplay);
  const now = Date.now();
  states.set(normalizedTrackId, {
    trackId: normalizedTrackId,
    ownerUid: normalizeUid091(ownerUid),
    baseLiked: liked,
    desiredLiked: liked,
    baseLikeCount: count,
    displayLikeCount: count,
    phase: 'accepted',
    updatedAt: now,
    expiresAt: now + DISPLAY_TTL_MS_091,
  });
  persistStates091(normalizedUid, states);
};

export const resetExploreLikeDisplayState091ForTests = () => {
  canonicalCountsByUid091.clear();
  displayStatesByUid091.clear();
  loadedUid091.clear();
  if (typeof window !== 'undefined') {
    zeroCountRecoveryTimerByUid093.forEach((timer) => window.clearTimeout(timer));
  }
  zeroCountRecoveryQueueByUid093.clear();
  zeroCountRecoveryTimerByUid093.clear();
  zeroCountRecoveryInflightByUid093.clear();
  zeroCountRecoveryFailureUntil093.clear();
};

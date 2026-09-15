// SORIDRAW_EXPLORE_SHARED_DISPLAY_COUNT_091_20260915
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
  if (state && state.expiresAt > Date.now()) return state.displayLikeCount;
  if (state) {
    states.delete(normalizedTrackId);
    persistStates091(normalizedUid, states);
  }
  return getExploreLikeCanonicalCount091(normalizedUid, normalizedTrackId, fallbackLikeCount);
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
};

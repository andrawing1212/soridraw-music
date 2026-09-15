from pathlib import Path
import json


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)


display_path = Path('src/services/exploreLikeDisplayStateService.ts')
display_path.write_text(r'''// SORIDRAW_EXPLORE_SHARED_DISPLAY_COUNT_091_20260915
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
''')

like_path = Path('src/services/exploreLikeService.ts')
like = like_path.read_text()
like = replace_once(
    like,
    "import {\n  invalidateExploreLikedTrackCollection,\n  patchExploreLikedTrackMembership,\n} from './exploreLikedTracksService';\n",
    "import {\n  invalidateExploreLikedTrackCollection,\n  patchExploreLikedTrackMembership,\n} from './exploreLikedTracksService';\nimport {\n  acceptExploreLikeDisplayTransition091,\n  beginExploreLikeDisplayTransition091,\n  getExploreLikeCanonicalCount091,\n  getExploreLikeDisplayCount091,\n  importExploreLikeDisplaySignal091,\n} from './exploreLikeDisplayStateService';\n",
    '091 display service import',
)
like = replace_once(like, '// SORIDRAW_EXPLORE_LIKE_LIVE_DISPLAY_090_20260915\n', '// SORIDRAW_EXPLORE_LIKE_LIVE_DISPLAY_090_20260915\n// SORIDRAW_EXPLORE_SHARED_DISPLAY_COUNT_091_20260915\n', '091 service marker')
old_signal_loop = '''  for (const result of effectiveResults) {\n    cache.set(result.trackId, result.liked);\n    patchExploreLikedTrackMembership(uid, result.trackId, result.liked);\n    dispatchLikeSync({\n      uid: user.uid,\n      trackId: result.trackId,\n      ownerUid: result.ownerUid,\n      liked: result.liked,\n      likeCount: result.likeCount,\n      ...(result.displayLikeCount === undefined ? {} : { displayLikeCount: result.displayLikeCount }),\n    });\n  }'''
new_signal_loop = '''  for (const result of effectiveResults) {\n    cache.set(result.trackId, result.liked);\n    patchExploreLikedTrackMembership(uid, result.trackId, result.liked);\n    importExploreLikeDisplaySignal091(\n      uid, result.trackId, result.ownerUid, result.liked, result.displayLikeCount,\n      Boolean(pendingOutbox[result.trackId]),\n    );\n    dispatchLikeSync({\n      uid: user.uid,\n      trackId: result.trackId,\n      ownerUid: result.ownerUid,\n      liked: result.liked,\n      likeCount: result.likeCount,\n      ...(result.displayLikeCount === undefined ? {} : { displayLikeCount: result.displayLikeCount }),\n    });\n  }'''
like = replace_once(like, old_signal_loop, new_signal_loop, '091 account display signal')
old_flush_transition = '''      if (latest && latest.updatedAt !== pending.updatedAt) {\n        ownerUid = latest.ownerUid || ownerUid;\n        latest.baseLiked = result.liked;\n        latest.baseLikeCount = result.likeCount;\n        latest.retryCount = 0;\n        visibleLiked = latest.desiredLiked;\n        if (latest.desiredLiked === result.liked) {\n          delete latestOutbox[pending.trackId];\n        } else {\n          latestOutbox[pending.trackId] = latest;\n        }\n      } else {\n        delete latestOutbox[pending.trackId];\n      }\n\n      const visibleResult = {\n        trackId: result.trackId,\n        liked: visibleLiked,\n        likeCount: result.likeCount,\n      };'''
new_flush_transition = '''      const hasNewerPending = Boolean(latest && latest.updatedAt !== pending.updatedAt);\n      if (hasNewerPending && latest) {\n        ownerUid = latest.ownerUid || ownerUid;\n        latest.baseLiked = result.liked;\n        latest.baseLikeCount = getExploreLikeCanonicalCount091(uid, result.trackId, latest.baseLikeCount);\n        latest.retryCount = 0;\n        visibleLiked = latest.desiredLiked;\n        if (latest.desiredLiked === result.liked) {\n          delete latestOutbox[pending.trackId];\n          acceptExploreLikeDisplayTransition091(uid, result.trackId, visibleLiked);\n        } else {\n          latestOutbox[pending.trackId] = latest;\n        }\n      } else {\n        delete latestOutbox[pending.trackId];\n        acceptExploreLikeDisplayTransition091(uid, result.trackId, result.liked);\n      }\n\n      const displayLikeCount = getExploreLikeDisplayCount091(uid, result.trackId, pending.optimisticLikeCount);\n      const visibleResult = {\n        trackId: result.trackId,\n        liked: visibleLiked,\n        likeCount: result.likeCount,\n        displayLikeCount,\n      };'''
like = replace_once(like, old_flush_transition, new_flush_transition, '091 batch acknowledgement display')
start = like.index('export const setExploreTrackLike = async (')
end = like.index('\n};', start) + 3
if start < 0 or end < 3:
    raise SystemExit('091 setExploreTrackLike block not found')
new_set = r'''export const setExploreTrackLike = async (
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
};'''
like = like[:start] + new_set + like[end:]
like_path.write_text(like)

liked_path = Path('src/services/exploreLikedTracksService.ts')
liked = liked_path.read_text()
liked = replace_once(liked, '// SORIDRAW_EXPLORE_LIKED_CARD_CONSISTENCY_087_20260914\n', '// SORIDRAW_EXPLORE_LIKED_CARD_CONSISTENCY_087_20260914\n// SORIDRAW_EXPLORE_SHARED_DISPLAY_COUNT_091_20260915\n', '091 liked cache marker')
liked_anchor = 'export const getExploreLikedTrackCollectionIds = (uid: string): string[] | null => {'
liked_helper = r'''export const patchExploreLikedTrackCachedCount091 = (
  uid: string,
  trackId: string,
  likeCount: number,
) => {
  const normalizedUid = normalizeId(uid);
  const normalizedTrackId = normalizeId(trackId);
  if (!normalizedUid || !normalizedTrackId) return;
  const cache = readCache(normalizedUid);
  const item = cache.items[normalizedTrackId];
  if (!item) return;
  const normalizedCount = Math.max(0, Math.floor(Number(likeCount || 0)));
  if (Number(item.likeCount || 0) === normalizedCount) return;
  cache.items[normalizedTrackId] = { ...item, likeCount: normalizedCount };
  writeCache(normalizedUid, cache);
};

export const getExploreLikedTrackCollectionIds = (uid: string): string[] | null => {'''
liked = replace_once(liked, liked_anchor, liked_helper, '091 liked canonical count patch helper')
liked_path.write_text(liked)

page_path = Path('src/pages/ExplorePage.tsx')
page = page_path.read_text()
page = replace_once(page, "  reconcileExploreLikedTrackCollectionState,\n  setExploreTrackLike,\n} from '../services/exploreLikeService';\nimport { getExploreLikedTrackCollectionIds, getExploreLikedTracks, rememberExploreLikedTrack } from '../services/exploreLikedTracksService';\n", "  reconcileExploreLikedTrackCollectionState,\n  setExploreTrackLike,\n} from '../services/exploreLikeService';\nimport {\n  getExploreLikeCanonicalCount091,\n  getExploreLikeDisplayCount091,\n  seedExploreLikeCanonicalCounts091,\n  updateExploreLikeCanonicalCounts091,\n} from '../services/exploreLikeDisplayStateService';\nimport {\n  getExploreLikedTrackCollectionIds,\n  getExploreLikedTracks,\n  patchExploreLikedTrackCachedCount091,\n  rememberExploreLikedTrack,\n} from '../services/exploreLikedTracksService';\n", '091 page imports')
page = replace_once(page, '// SORIDRAW_EXPLORE_LIKE_LIVE_DISPLAY_090_20260915\n', '// SORIDRAW_EXPLORE_LIKE_LIVE_DISPLAY_090_20260915\n// SORIDRAW_EXPLORE_SHARED_DISPLAY_COUNT_091_20260915\n', '091 page marker')
old_apply_profile = '''    const applyProfileFirstView = (nextProfile: ExplorePublicProfile, rows: Array<Record<string, unknown>>) => {\n      if (cancelled) return;\n      const normalizedTracks = rows.map(normalizeTrack).filter((track) => track.id);\n      normalizedTracks.sort(comparePublicProfileTracks);\n      setProfile(nextProfile);\n      setProfileTracks(normalizedTracks);\n    };'''
new_apply_profile = '''    const applyProfileFirstView = (nextProfile: ExplorePublicProfile, rows: Array<Record<string, unknown>>) => {\n      if (cancelled) return;\n      const normalizedTracks = rows.map(normalizeTrack).filter((track) => track.id);\n      normalizedTracks.sort(comparePublicProfileTracks);\n      const activeUid = auth.currentUser?.uid || '';\n      if (activeUid) {\n        seedExploreLikeCanonicalCounts091(activeUid, normalizedTracks.map((track) => ({ trackId: track.id, likeCount: track.likeCount })));\n      }\n      setProfile(nextProfile);\n      setProfileTracks(normalizedTracks);\n    };'''
page = replace_once(page, old_apply_profile, new_apply_profile, '091 profile canonical seed')
old_liked_rows = '''        const normalizedLikedRows = normalizedRows.map((track) => (\n          effectiveLikedSet.has(track.id) && track.likeCount === 0\n            ? { ...track, likeCount: 1 }\n            : track\n        ));'''
new_liked_rows = '''        seedExploreLikeCanonicalCounts091(user.uid, normalizedRows.map((track) => ({ trackId: track.id, likeCount: track.likeCount })));\n        const normalizedLikedRows = normalizedRows;'''
page = replace_once(page, old_liked_rows, new_liked_rows, '091 liked rows raw canonical')
page = replace_once(page, '            merged.set(track.id, track.likeCount === 0 ? { ...track, likeCount: 1 } : track);\n', '            merged.set(track.id, track);\n', '091 same-session liked raw canonical')
old_floor = '''  useEffect(() => {\n    if (!user?.uid) return;\n    // 090: liked membership itself proves the shared count cannot be zero.\n    // Apply only the safe floor 0 -> 1 on every local card source, with no fetch.\n    const patchLikedZeroFloor = (list: ExploreTrack[]) => {\n      let changed = false;\n      const next = list.map((track) => {\n        if (track.likeCount !== 0 || likedTrackIds[track.id] !== true) return track;\n        changed = true;\n        return { ...track, likeCount: 1 };\n      });\n      return changed ? next : list;\n    };\n    setTracks(patchLikedZeroFloor);\n    setProfileTracks(patchLikedZeroFloor);\n    setProfileLikedTracks(patchLikedZeroFloor);\n  }, [user?.uid, likedTrackIds]);\n\n'''
page = replace_once(page, old_floor, '', 'remove 090 zero floor')
old_count_helper = '''  const updateTrackLikeCount090 = (trackId: string, likeCount: number) => {\n    const patch = (list: ExploreTrack[]) => {\n      let changed = false;\n      const next = list.map((track) => {\n        if (track.id !== trackId || track.likeCount === likeCount) return track;\n        changed = true;\n        return { ...track, likeCount };\n      });\n      return changed ? next : list;\n    };\n    setTracks(patch);\n    setProfileTracks(patch);\n    setProfileLikedTracks(patch);\n  };\n\n'''
page = replace_once(page, old_count_helper, '', 'remove 090 list count mutation')
old_toggle = '''      const result = await setExploreTrackLike(user, track.id, !currentLiked, track.likeCount, track.ownerUid);\n      const optimisticTrack = { ...track, likeCount: result.likeCount };\n      // 090: heart and count move together from one pending transition. The\n      // shared aggregate still replaces the temporary number on its normal cycle.\n      setLikedTrackIds((prev) => ({ ...prev, [track.id]: result.liked }));\n      updateTrackLikeCount090(track.id, result.likeCount);\n      rememberExploreLikedTrack(user.uid, optimisticTrack as unknown as Record<string, unknown>, result.liked);\n      setProfileLikedTracks((previous) => {\n        if (!result.liked) return previous.filter((item) => item.id !== track.id);\n        const rest = previous.filter((item) => item.id !== track.id);\n        return [optimisticTrack, ...rest];\n      });'''
new_toggle = '''      const result = await setExploreTrackLike(user, track.id, !currentLiked, track.likeCount, track.ownerUid);\n      const canonicalTrack = { ...track, likeCount: getExploreLikeCanonicalCount091(user.uid, track.id, track.likeCount) };\n      setLikedTrackIds((prev) => ({ ...prev, [track.id]: result.liked }));\n      rememberExploreLikedTrack(user.uid, canonicalTrack as unknown as Record<string, unknown>, result.liked);\n      setProfileLikedTracks((previous) => {\n        if (!result.liked) return previous.filter((item) => item.id !== track.id);\n        const rest = previous.filter((item) => item.id !== track.id);\n        return [canonicalTrack, ...rest];\n      });'''
page = replace_once(page, old_toggle, new_toggle, '091 toggle canonical cache')
old_render = '''      {items.map((track) => (\n        <ExploreTrackCard\n          key={track.id}\n          track={track}\n          liked={Boolean(likedTrackIds[track.id])}\n          likeBusy={likeBusyTrackId === track.id}\n          onToggleLike={toggleLike}\n          onOpenProfile={openProfile}\n        />\n      ))}'''
new_render = '''      {items.map((track) => {\n        const displayTrack = user?.uid ? { ...track, likeCount: getExploreLikeDisplayCount091(user.uid, track.id, track.likeCount) } : track;\n        return (\n          <ExploreTrackCard\n            key={track.id}\n            track={displayTrack}\n            liked={Boolean(likedTrackIds[track.id])}\n            likeBusy={likeBusyTrackId === track.id}\n            onToggleLike={toggleLike}\n            onOpenProfile={openProfile}\n          />\n        );\n      })}'''
page = replace_once(page, old_render, new_render, '091 shared render count')
old_cached = '''      setError('');\n      setFeedNextCursor(feedRequest ? readExploreFeedSessionCacheCursor(requestUrl) : null);\n      setLoadMoreError('');\n      setTracks(cachedRows.map(normalizeTrack).filter((track) => track.id));\n      setLoading(false);'''
new_cached = '''      setError('');\n      setFeedNextCursor(feedRequest ? readExploreFeedSessionCacheCursor(requestUrl) : null);\n      setLoadMoreError('');\n      const cachedTracks = cachedRows.map(normalizeTrack).filter((track) => track.id);\n      const activeUid = auth.currentUser?.uid || '';\n      if (activeUid) seedExploreLikeCanonicalCounts091(activeUid, cachedTracks.map((track) => ({ trackId: track.id, likeCount: track.likeCount })));\n      setTracks(cachedTracks);\n      setLoading(false);'''
page = replace_once(page, old_cached, new_cached, '091 cached feed seed')
old_apply_payload = '''      const normalizedTracks = rows.map(normalizeTrack).filter((track) => track.id);\n      setFeedNextCursor(nextCursor);\n      setLoadMoreError('');\n      setTracks(normalizedTracks);\n      if (feedRequest) {\n        const countByTrackId = new Map(normalizedTracks.map((track) => [track.id, track.likeCount]));\n        setProfileTracks((previous) => previous.map((track) => {\n          const nextCount = countByTrackId.get(track.id);\n          return nextCount === undefined || nextCount === track.likeCount\n            ? track\n            : { ...track, likeCount: nextCount };\n        }));\n        normalizedTracks.forEach((track) => {\n          if (track.ownerUid) {\n            patchExplorePublicProfileFirstViewTrack(track.ownerUid, track.id, { likeCount: track.likeCount });\n          }\n        });\n      }\n      if (feedRequest && forceLikeCountRefresh071) {\n        forceLikeCountRefreshRef071.current = false;\n        const refreshUid = auth.currentUser?.uid || '';\n        const deadline = readExploreLikeRefreshDeadline071(refreshUid);\n        // An immediate 072 stale-cache repair can happen before the scheduled\n        // aggregate. Preserve its deadline so reloads still get the final refresh.\n        if (!deadline || Date.now() >= deadline) clearExploreLikeRefreshDeadline071(refreshUid);\n      }'''
new_apply_payload = '''      const normalizedTracks = rows.map(normalizeTrack).filter((track) => track.id);\n      const activeUid = auth.currentUser?.uid || '';\n      const canonicalRows = normalizedTracks.map((track) => ({ trackId: track.id, likeCount: track.likeCount }));\n      const refreshDeadline = activeUid ? readExploreLikeRefreshDeadline071(activeUid) : 0;\n      const aggregateConfirmed = Boolean(feedRequest && forceLikeCountRefresh071 && refreshDeadline > 0 && Date.now() >= refreshDeadline);\n      if (activeUid) {\n        if (feedRequest) updateExploreLikeCanonicalCounts091(activeUid, canonicalRows, aggregateConfirmed);\n        else seedExploreLikeCanonicalCounts091(activeUid, canonicalRows);\n      }\n      setFeedNextCursor(nextCursor);\n      setLoadMoreError('');\n      setTracks(normalizedTracks);\n      if (feedRequest) {\n        const countByTrackId = new Map(normalizedTracks.map((track) => [track.id, track.likeCount]));\n        setProfileTracks((previous) => previous.map((track) => {\n          const nextCount = countByTrackId.get(track.id);\n          return nextCount === undefined || nextCount === track.likeCount ? track : { ...track, likeCount: nextCount };\n        }));\n        normalizedTracks.forEach((track) => {\n          if (track.ownerUid) patchExplorePublicProfileFirstViewTrack(track.ownerUid, track.id, { likeCount: track.likeCount });\n          if (activeUid) patchExploreLikedTrackCachedCount091(activeUid, track.id, track.likeCount);\n        });\n      }\n      if (feedRequest && forceLikeCountRefresh071) {\n        forceLikeCountRefreshRef071.current = false;\n        const refreshUid = auth.currentUser?.uid || '';\n        const deadline = readExploreLikeRefreshDeadline071(refreshUid);\n        if (!deadline || Date.now() >= deadline) clearExploreLikeRefreshDeadline071(refreshUid);\n      }'''
page = replace_once(page, old_apply_payload, new_apply_payload, '091 feed canonical reconciliation')
old_load_more = '''      const rows = Array.isArray(payload?.data?.items) ? payload.data.items : [];\n      const normalized = rows.map(normalizeTrack).filter((track) => track.id);\n      setTracks((previous) => {'''
new_load_more = '''      const rows = Array.isArray(payload?.data?.items) ? payload.data.items : [];\n      const normalized = rows.map(normalizeTrack).filter((track) => track.id);\n      const activeUid = auth.currentUser?.uid || '';\n      if (activeUid) {\n        updateExploreLikeCanonicalCounts091(activeUid, normalized.map((track) => ({ trackId: track.id, likeCount: track.likeCount })), false);\n        normalized.forEach((track) => {\n          if (track.ownerUid) patchExplorePublicProfileFirstViewTrack(track.ownerUid, track.id, { likeCount: track.likeCount });\n          patchExploreLikedTrackCachedCount091(activeUid, track.id, track.likeCount);\n        });\n      }\n      setTracks((previous) => {'''
page = replace_once(page, old_load_more, new_load_more, '091 load more canonical reconciliation')
page_path.write_text(page)

v87_path = Path('scripts/verify-087-liked-card-consistency.mjs')
v87 = v87_path.read_text()
v87 = replace_once(v87, "assert.match(page, /effectiveLikedSet\\.has\\(track\\.id\\) && track\\.likeCount === 0/);", "assert.doesNotMatch(page, /effectiveLikedSet\\.has\\(track\\.id\\) && track\\.likeCount === 0/);\nassert.match(page, /getExploreLikeDisplayCount091/);", '091 v87 shared display')
v87 = v87.replace('liked-card membership is repaired locally, a liked card cannot display zero, and no new server reads are added.', 'liked-card membership is repaired locally, display counts are shared without mutating canonical card cache, and no new server reads are added.')
v87_path.write_text(v87)

v88_path = Path('scripts/verify-088-same-session-liked-heart.mjs')
v88 = v88_path.read_text()
v88 = replace_once(v88, "assert.match(page, /const normalizedLikedRows = normalizedRows\\.map/);", "assert.match(page, /const normalizedLikedRows = normalizedRows;/);", '091 v88 raw liked rows')
v88 = replace_once(v88, "assert.match(page, /merged\\.set\\(track\\.id, track\\.likeCount === 0 \\? \\{ \\.\\.\\.track, likeCount: 1 \\} : track\\);/);", "assert.match(page, /merged\\.set\\(track\\.id, track\\);/);", '091 v88 raw merged rows')
v88_path.write_text(v88)

v89_path = Path('scripts/verify-089-like-cross-device-consistency.mjs')
v89 = v89_path.read_text()
v89 = replace_once(v89, "const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');", "const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');\nconst display = readFileSync('src/services/exploreLikeDisplayStateService.ts', 'utf8');", '091 v89 display source')
v89 = replace_once(v89, "assert.match(like, /baselineLikeCount \\+ Number\\(liked\\) - Number\\(baselineLiked\\)/);", "assert.match(display, /baseLikeCount \\+ Number\\(desiredLiked\\) - Number\\(baseLiked\\)/);", '091 v89 stable display baseline')
v89 = replace_once(v89, "assert.match(page, /track\\.likeCount === 0 \\? \\{ \\.\\.\\.track, likeCount: 1 \\} : track/);", "assert.doesNotMatch(page, /track\\.likeCount === 0 \\? \\{ \\.\\.\\.track, likeCount: 1 \\} : track/);", '091 v89 remove floor')
v89 = replace_once(v89, "assert.match(page, /updateTrackLikeCount090/);", "assert.match(page, /getExploreLikeDisplayCount091/);", '091 v89 shared display render')
v89 = v89.replace('PASS 089/090: cross-device state stays batch-based; numeric optimism is limited to the current pending transition, no account-patch numeric overlay is restored, and pending changes auto-flush within 5s.', 'PASS 089/091: cross-device state stays batch-based; one shared display ledger owns local numeric optimism, canonical caches remain raw, and pending changes auto-flush within 5s.')
v89_path.write_text(v89)

v90_path = Path('scripts/verify-090-like-live-display.mjs')
v90 = v90_path.read_text()
v90 = replace_once(v90, "assert.equal(String(version.version), '090');", "assert.ok(Number(version.version) >= 90, `expected app version 090+, got ${version.version}`);", '091 v90 version')
v90 = replace_once(v90, "assert.match(like, /baselineLikeCount \\+ Number\\(liked\\) - Number\\(baselineLiked\\)/);", "assert.match(like, /beginExploreLikeDisplayTransition091/);", '091 v90 display transition service')
v90 = replace_once(v90, "assert.match(page, /const optimisticTrack = \\{ \\.\\.\\.track, likeCount: result\\.likeCount \\}/);", "assert.match(page, /const canonicalTrack = \\{/);", '091 v90 canonical card')
v90 = replace_once(v90, "assert.match(page, /updateTrackLikeCount090\\(track\\.id, result\\.likeCount\\)/);", "assert.match(page, /getExploreLikeDisplayCount091/);", '091 v90 shared render display')
v90 = replace_once(v90, "assert.match(page, /rememberExploreLikedTrack\\(user\\.uid, optimisticTrack/);", "assert.match(page, /rememberExploreLikedTrack\\(user\\.uid, canonicalTrack/);", '091 v90 canonical liked cache')
v90 = replace_once(v90, "assert.match(page, /effectiveLikedSet\\.has\\(track\\.id\\) && track\\.likeCount === 0/);", "assert.doesNotMatch(page, /effectiveLikedSet\\.has\\(track\\.id\\) && track\\.likeCount === 0/);", '091 v90 remove zero floor')
v90 = replace_once(v90, "assert.match(page, /patchLikedZeroFloor/);", "assert.doesNotMatch(page, /patchLikedZeroFloor/);", '091 v90 no floor helper')
v90 = v90.replace('PASS 090: live heart/count move together, liked cards never show zero, stale hydration/account signals cannot roll back a newer local pending heart, and click path adds no server request.', 'PASS 090/091: live heart/count remain local-first, stale hydration/account signals cannot roll back a newer local pending heart, canonical caches are no longer overwritten by optimistic counts, and click path adds no server request.')
v90_path.write_text(v90)

Path('scripts/verify-091-like-count-state-machine.mjs').write_text(r'''import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));
assert.equal(String(version.version), '091');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const like = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const liked = readFileSync('src/services/exploreLikedTracksService.ts', 'utf8');
const displaySource = readFileSync('src/services/exploreLikeDisplayStateService.ts', 'utf8');
assert.match(displaySource, /SORIDRAW_EXPLORE_SHARED_DISPLAY_COUNT_091_20260915/);
assert.doesNotMatch(displaySource, /fetch\(|updateDoc\(|setDoc\(|firestore/i);
assert.match(page, /getExploreLikeDisplayCount091\(user\.uid, track\.id, track\.likeCount\)/);
assert.match(page, /rememberExploreLikedTrack\(user\.uid, canonicalTrack/);
assert.doesNotMatch(page, /patchLikedZeroFloor/);
assert.doesNotMatch(page, /updateTrackLikeCount090/);
assert.match(liked, /patchExploreLikedTrackCachedCount091/);
assert.match(like, /displayLikeCount,/);
assert.match(like, /importExploreLikeDisplaySignal091/);
assert.match(like, /acceptExploreLikeDisplayTransition091/);
const display = await import('../src/services/exploreLikeDisplayStateService.ts');
const uid = 'u-test';
const id = 'track-a';
display.resetExploreLikeDisplayState091ForTests();
display.seedExploreLikeCanonicalCounts091(uid, [{ trackId: id, likeCount: 0 }]);
assert.equal(display.getExploreLikeDisplayCount091(uid, id, 0), 0);
assert.equal(display.beginExploreLikeDisplayTransition091(uid, id, 'owner', false, true, 0), 1);
for (const raw of [0, 0, 1, 2]) assert.equal(display.getExploreLikeDisplayCount091(uid, id, raw), 1);
assert.equal(display.acceptExploreLikeDisplayTransition091(uid, id, true), 1);
display.updateExploreLikeCanonicalCounts091(uid, [{ trackId: id, likeCount: 0 }], false);
assert.equal(display.getExploreLikeDisplayCount091(uid, id, 0), 1);
display.updateExploreLikeCanonicalCounts091(uid, [{ trackId: id, likeCount: 1 }], true);
assert.equal(display.getExploreLikeDisplayCount091(uid, id, 9), 1);
assert.equal(display.beginExploreLikeDisplayTransition091(uid, id, 'owner', true, false, 1), 0);
for (const raw of [0, 1, 2, 3]) assert.equal(display.getExploreLikeDisplayCount091(uid, id, raw), 0);
assert.equal(display.acceptExploreLikeDisplayTransition091(uid, id, false), 0);
display.updateExploreLikeCanonicalCounts091(uid, [{ trackId: id, likeCount: 0 }], true);
assert.equal(display.getExploreLikeDisplayCount091(uid, id, 5), 0);
assert.equal(display.beginExploreLikeDisplayTransition091(uid, id, 'owner', false, true, 0), 1);
assert.equal(display.beginExploreLikeDisplayTransition091(uid, id, 'owner', true, false, 1), 0);
assert.equal(display.getExploreLikeDisplayCount091(uid, id, 3), 0);
display.importExploreLikeDisplaySignal091(uid, id, 'owner', true, 2, false);
for (const raw of [0, 1, 3, 7]) assert.equal(display.getExploreLikeDisplayCount091(uid, id, raw), 2);
console.log('PASS 091: all Explore surfaces share one display-count state, optimistic values never become canonical cache baselines, accepted transitions survive until aggregate confirmation, rapid toggles return to baseline, and the display ledger performs no server I/O.');
''')

version_path = Path('public/app-version.json')
version = json.loads(version_path.read_text())
version['version'] = '091'
version_path.write_text(json.dumps(version, ensure_ascii=False, indent=2) + '\n')

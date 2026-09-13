from pathlib import Path

ROOT = Path('.')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 anchor, got {count}')
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# 1. Personal like overlay + combined Social Snapshot read.
# ---------------------------------------------------------------------------
like_path = ROOT / 'src/services/exploreLikeService.ts'
like = like_path.read_text(encoding='utf-8')
if 'SORIDRAW_EXPLORE_SOCIAL_SNAPSHOT_075_20260913' not in like:
    like = replace_once(
        like,
        "// SORIDRAW_EXPLORE_LIKE_LOCAL_VISIBLE_COUNT_074_20260912\n",
        "// SORIDRAW_EXPLORE_LIKE_LOCAL_VISIBLE_COUNT_074_20260912\n// SORIDRAW_EXPLORE_SOCIAL_SNAPSHOT_075_20260913\n",
        'like marker',
    )
    like = replace_once(
        like,
        "} from '../lib/soridrawPersistentCache';\n",
        "} from '../lib/soridrawPersistentCache';\nimport {\n  getExplorePersonalSocialSnapshot,\n  patchExplorePersonalSocialLike,\n} from './exploreSocialSnapshotService';\n",
        'like social snapshot import',
    )
    like = replace_once(
        like,
        "      likeCount: clampLikeCount(result.likeCount),\n      updatedAt: now,\n",
        "      likeCount: clampLikeCount(result.likeCount),\n      ...(result.displayLikeCount === undefined ? {} : { displayLikeCount: clampLikeCount(result.displayLikeCount) }),\n      updatedAt: now,\n",
        'persist display count',
    )
    like = replace_once(
        like,
        "    cache[result.trackId] = {\n      trackId: result.trackId,\n      ownerUid: result.ownerUid,\n      liked: result.liked,\n      likeCount: clampLikeCount(result.likeCount),\n      ...(result.displayLikeCount === undefined ? {} : { displayLikeCount: clampLikeCount(result.displayLikeCount) }),\n      updatedAt: now,\n      expiresAt,\n    };\n",
        "    cache[result.trackId] = {\n      trackId: result.trackId,\n      ownerUid: result.ownerUid,\n      liked: result.liked,\n      likeCount: clampLikeCount(result.likeCount),\n      ...(result.displayLikeCount === undefined ? {} : { displayLikeCount: clampLikeCount(result.displayLikeCount) }),\n      updatedAt: now,\n      expiresAt,\n    };\n    patchExplorePersonalSocialLike(uid, result.trackId, result.liked);\n",
        'cross-device personal social patch',
    )
    old_missing = """  const cache = getLikedStateCache(user.uid);\n  const missing = normalized.filter((trackId) => !cache.has(trackId));\n  if (missing.length) {\n    const query = new URLSearchParams({ trackIds: missing.join(',') });\n    const payload = await requestExploreLike(user, `/v1/me/likes?${query.toString()}`);\n    const likedIds = new Set(\n      Array.isArray(payload?.data?.likedTrackIds)\n        ? payload.data.likedTrackIds.map((trackId: unknown) => String(trackId || '').trim()).filter(Boolean)\n        : [],\n    );\n    missing.forEach((trackId) => cache.set(trackId, likedIds.has(trackId)));\n    persistLikedStateCache(user.uid, cache);\n  }\n"""
    new_missing = """  const cache = getLikedStateCache(user.uid);\n  const missing = normalized.filter((trackId) => !cache.has(trackId));\n  if (missing.length) {\n    let resolved = false;\n    try {\n      const snapshot = await getExplorePersonalSocialSnapshot(user);\n      const likedIds = new Set(snapshot.likedTrackIds);\n      missing.forEach((trackId) => cache.set(trackId, likedIds.has(trackId)));\n      resolved = true;\n    } catch (snapshotError) {\n      console.warn('[Explore like] Social Snapshot unavailable; using targeted likes recovery.', snapshotError);\n    }\n    if (!resolved) {\n      const query = new URLSearchParams({ trackIds: missing.join(',') });\n      const payload = await requestExploreLike(user, `/v1/me/likes?${query.toString()}`);\n      const likedIds = new Set(\n        Array.isArray(payload?.data?.likedTrackIds)\n          ? payload.data.likedTrackIds.map((trackId: unknown) => String(trackId || '').trim()).filter(Boolean)\n          : [],\n      );\n      missing.forEach((trackId) => cache.set(trackId, likedIds.has(trackId)));\n    }\n    persistLikedStateCache(user.uid, cache);\n  }\n"""
    like = replace_once(like, old_missing, new_missing, 'like social snapshot hydration')
    display_helper = """
export const getExploreLikeDisplayCounts = (
  user: User,
  trackIds: string[],
): Record<string, number> => {
  const ids = new Set(trackIds.map((trackId) => String(trackId || '').trim()).filter(Boolean));
  const outbox = readLikeOutbox(user.uid);
  const account = readAccountPatchCache(user.uid);
  const result: Record<string, number> = {};
  ids.forEach((trackId) => {
    const pending = outbox[trackId];
    if (pending) {
      result[trackId] = clampLikeCount(pending.optimisticLikeCount);
      return;
    }
    const patch = account[trackId];
    if (patch?.displayLikeCount !== undefined) {
      result[trackId] = clampLikeCount(patch.displayLikeCount);
    }
  });
  return result;
};

"""
    like = replace_once(
        like,
        "export const setExploreTrackLike = async (\n",
        display_helper + "export const setExploreTrackLike = async (\n",
        'display overlay helper',
    )
    like = replace_once(
        like,
        "  if (!normalizedTrackId) throw new Error('Explore 곡 ID를 확인하지 못했습니다.');\n\n  const outbox = readLikeOutbox(user.uid);\n",
        "  if (!normalizedTrackId) throw new Error('Explore 곡 ID를 확인하지 못했습니다.');\n  patchExplorePersonalSocialLike(user.uid, normalizedTrackId, liked);\n\n  const outbox = readLikeOutbox(user.uid);\n",
        'optimistic social snapshot like patch',
    )
    like_path.write_text(like, encoding='utf-8')


# ---------------------------------------------------------------------------
# 2. Follow state uses the same UID-scoped Social Snapshot first.
# ---------------------------------------------------------------------------
social_path = ROOT / 'src/services/exploreSocialService.ts'
social = social_path.read_text(encoding='utf-8')
if 'SORIDRAW_EXPLORE_SOCIAL_SNAPSHOT_075_20260913' not in social:
    social = replace_once(
        social,
        "import { readSoridrawPersistentCache, writeSoridrawPersistentCache } from '../lib/soridrawPersistentCache';\n",
        "import { readSoridrawPersistentCache, writeSoridrawPersistentCache } from '../lib/soridrawPersistentCache';\nimport {\n  getExplorePersonalSocialSnapshot,\n  patchExplorePersonalSocialFollow,\n} from './exploreSocialSnapshotService';\n",
        'follow social snapshot import',
    )
    social = replace_once(
        social,
        "// SORIDRAW_EXPLORE_PROFILE_FOLLOW_COST_1010_20260904\n",
        "// SORIDRAW_EXPLORE_PROFILE_FOLLOW_COST_1010_20260904\n// SORIDRAW_EXPLORE_SOCIAL_SNAPSHOT_075_20260913\n",
        'follow marker',
    )
    old_task = """  const task = (async () => {\n    const payload = await requestAuthed(user, EXPLORE_FOLLOW_BUNDLE_DIAGNOSTIC_PATH);\n    const rawUids = Array.isArray(payload?.data?.followingUids) ? payload.data.followingUids : [];\n    const states: Record<string, boolean> = rawUids.reduce((acc: Record<string, boolean>, value: unknown) => {\n      const uid = String(value || '').trim();\n      if (uid) acc[uid] = true;\n      return acc;\n    }, {} as Record<string, boolean>);\n    const next: ExploreFollowCacheData = { complete: true, states };\n    writeExploreFollowCache(user.uid, next);\n    return next;\n  })().finally(() => {\n"""
    new_task = """  const task = (async () => {\n    let rawUids: unknown[] = [];\n    try {\n      const snapshot = await getExplorePersonalSocialSnapshot(user);\n      rawUids = snapshot.followingUids;\n    } catch (snapshotError) {\n      console.warn('[Explore follow] Social Snapshot unavailable; using following bundle recovery.', snapshotError);\n      const payload = await requestAuthed(user, EXPLORE_FOLLOW_BUNDLE_DIAGNOSTIC_PATH);\n      rawUids = Array.isArray(payload?.data?.followingUids) ? payload.data.followingUids : [];\n    }\n    const states: Record<string, boolean> = rawUids.reduce((acc: Record<string, boolean>, value: unknown) => {\n      const uid = String(value || '').trim();\n      if (uid) acc[uid] = true;\n      return acc;\n    }, {} as Record<string, boolean>);\n    const next: ExploreFollowCacheData = { complete: true, states };\n    writeExploreFollowCache(user.uid, next);\n    return next;\n  })().finally(() => {\n"""
    social = replace_once(social, old_task, new_task, 'follow social snapshot load')
    social = replace_once(
        social,
        "  rememberExploreFollowState(user.uid, normalizedUid, result.isFollowing);\n  return result;\n};\n\nexport const updateExplorePublicProfile",
        "  rememberExploreFollowState(user.uid, normalizedUid, result.isFollowing);\n  patchExplorePersonalSocialFollow(user.uid, normalizedUid, result.isFollowing);\n  return result;\n};\n\nexport const updateExplorePublicProfile",
        'follow snapshot mutation patch',
    )
    social_path.write_text(social, encoding='utf-8')


# ---------------------------------------------------------------------------
# 3. Loaded Feed snapshots mutate only the changed track; never clear all Feed.
# ---------------------------------------------------------------------------
feed_path = ROOT / 'src/services/exploreSessionCache.ts'
feed = feed_path.read_text(encoding='utf-8')
if 'SORIDRAW_EXPLORE_TARGETED_PUBLICATION_CACHE_075_20260913' not in feed:
    helper = r'''
// SORIDRAW_EXPLORE_TARGETED_PUBLICATION_CACHE_075_20260913
const rewriteLoadedFeedRows075 = (
  mutator: (url: string, rows: Array<Record<string, unknown>>) => Array<Record<string, unknown>> | null,
) => {
  [...exploreFeedMemoryCache.entries()].forEach(([url, memory]) => {
    if (!isFeedRequest(url)) return;
    const nextRows = mutator(url, cloneRows(memory.rows));
    if (!nextRows) return;
    const previous = readFeedEnvelope(url);
    writeExploreFeedSessionCache(
      url,
      nextRows,
      previous?.syncCursor ?? null,
      normalizeRevision(previous?.serverRevision),
    );
  });
};

export const patchExploreFeedSessionCachesRow = (
  trackId: string,
  patch: Record<string, unknown>,
) => {
  const normalizedId = String(trackId || '').trim();
  if (!normalizedId) return;
  rewriteLoadedFeedRows075((_url, rows) => {
    let changed = false;
    const next = rows.map((row) => {
      const rowId = String(row.id || row.trackId || '').trim();
      if (rowId !== normalizedId) return row;
      changed = true;
      return { ...row, ...patch };
    });
    return changed ? next : null;
  });
};

export const upsertExploreFeedSessionCacheRow = (
  trackId: string,
  row: Record<string, unknown>,
) => {
  const normalizedId = String(trackId || '').trim();
  if (!normalizedId) return;
  rewriteLoadedFeedRows075((url, rows) => {
    const index = rows.findIndex((item) => String(item.id || item.trackId || '').trim() === normalizedId);
    if (index >= 0) {
      const next = [...rows];
      next[index] = { ...next[index], ...row };
      return next;
    }
    try {
      const parsed = new URL(url, window.location.origin);
      if (parsed.searchParams.get('sort') !== 'latest') return null;
    } catch {
      return null;
    }
    const limit = Math.max(1, rows.length || 40);
    return [{ ...row }, ...rows].slice(0, limit);
  });
};

export const removeExploreFeedSessionCacheRow = (trackId: string) => {
  const normalizedId = String(trackId || '').trim();
  if (!normalizedId) return;
  rewriteLoadedFeedRows075((_url, rows) => {
    const next = rows.filter((row) => String(row.id || row.trackId || '').trim() !== normalizedId);
    return next.length === rows.length ? null : next;
  });
};

'''
    feed = replace_once(
        feed,
        "export const invalidateExploreFeedSessionCache = () => {\n",
        helper + "export const invalidateExploreFeedSessionCache = () => {\n",
        'feed targeted helpers',
    )
    feed_path.write_text(feed, encoding='utf-8')


# ---------------------------------------------------------------------------
# 4. Public profile first-view snapshot mutates only the changed public track.
# ---------------------------------------------------------------------------
profile_path = ROOT / 'src/services/exploreProfileFirstViewService.ts'
profile = profile_path.read_text(encoding='utf-8')
if 'SORIDRAW_EXPLORE_TARGETED_PUBLICATION_PROFILE_075_20260913' not in profile:
    helper = r'''
// SORIDRAW_EXPLORE_TARGETED_PUBLICATION_PROFILE_075_20260913
const publicProfileTrackId075 = (row: Record<string, unknown>) => String(row?.id || row?.trackId || '').trim();
const publicProfileTrackPublishedAt075 = (row: Record<string, unknown>) => Number(row?.publishedAt || row?.published_at || 0);
const publicProfileTrackPinned075 = (row: Record<string, unknown>) => Boolean(row?.profilePinned || row?.profile_pinned);

const sortPublicProfileTracks075 = (rows: Array<Record<string, unknown>>) => [...rows].sort((a, b) => {
  const pinned = Number(publicProfileTrackPinned075(b)) - Number(publicProfileTrackPinned075(a));
  if (pinned) return pinned;
  const published = publicProfileTrackPublishedAt075(b) - publicProfileTrackPublishedAt075(a);
  if (published) return published;
  return publicProfileTrackId075(b).localeCompare(publicProfileTrackId075(a));
});

export const upsertExplorePublicProfileFirstViewTrack = (
  profileRef: string,
  row: Record<string, unknown>,
) => {
  const cached = readCache(profileRef);
  const trackId = publicProfileTrackId075(row);
  if (!cached || !trackId) return;
  const existing = cached.tracks.find((track) => publicProfileTrackId075(track) === trackId);
  const tracks = sortPublicProfileTracks075([
    ...cached.tracks.filter((track) => publicProfileTrackId075(track) !== trackId),
    { ...(existing || {}), ...row },
  ]).slice(0, PROFILE_FIRST_VIEW_LIMIT);
  writeCache(cached.profile.uid || profileRef, {
    ...cached,
    profile: {
      ...cached.profile,
      trackCount: Math.max(0, cached.profile.trackCount + (existing ? 0 : 1)),
    },
    tracks,
  });
};

export const removeExplorePublicProfileFirstViewTrack = (
  profileRef: string,
  trackId: string,
) => {
  const cached = readCache(profileRef);
  const normalizedId = String(trackId || '').trim();
  if (!cached || !normalizedId) return;
  const tracks = cached.tracks.filter((track) => publicProfileTrackId075(track) !== normalizedId);
  if (tracks.length === cached.tracks.length) return;
  writeCache(cached.profile.uid || profileRef, {
    ...cached,
    profile: {
      ...cached.profile,
      trackCount: Math.max(0, cached.profile.trackCount - 1),
    },
    tracks,
  });
};

'''
    profile = replace_once(
        profile,
        "export const invalidateExplorePublicProfileFirstView = (profileRef: string) => {\n",
        helper + "export const invalidateExplorePublicProfileFirstView = (profileRef: string) => {\n",
        'profile targeted helpers',
    )
    profile_path.write_text(profile, encoding='utf-8')


# ---------------------------------------------------------------------------
# 5. Music Note publication/private/options stop clearing whole Feed/Profile cache.
# ---------------------------------------------------------------------------
pub_path = ROOT / 'src/services/explorePublicationService.ts'
pub = pub_path.read_text(encoding='utf-8')
if 'SORIDRAW_EXPLORE_TARGETED_PUBLICATION_CACHE_075_20260913' not in pub:
    pub = replace_once(
        pub,
        "import { invalidateExploreFeedSessionCache } from './exploreSessionCache';\n",
        "import {\n  invalidateExploreFeedSessionCache,\n  patchExploreFeedSessionCachesRow,\n  removeExploreFeedSessionCacheRow,\n  upsertExploreFeedSessionCacheRow,\n} from './exploreSessionCache';\n",
        'publication feed imports',
    )
    pub = replace_once(
        pub,
        "import { invalidateExplorePublicProfileFirstView } from './exploreProfileFirstViewService';\n",
        "import {\n  invalidateExplorePublicProfileFirstView,\n  patchExplorePublicProfileFirstViewTrack,\n  removeExplorePublicProfileFirstViewTrack,\n  upsertExplorePublicProfileFirstViewTrack,\n} from './exploreProfileFirstViewService';\n\n// SORIDRAW_EXPLORE_TARGETED_PUBLICATION_CACHE_075_20260913\n",
        'publication profile imports',
    )
    old_publish_tail = """  patchPublicationStateBySourceId(user.uid, normalizedSourceId, nextState);\n  invalidateExploreFeedSessionCache();\n  invalidateExplorePublicProfileFirstView(user.uid);\n  return nextState;\n};\n"""
    new_publish_tail = """  patchPublicationStateBySourceId(user.uid, normalizedSourceId, nextState);\n  const snapshotItem = payload?.data?.snapshotItem;\n  if (snapshotItem && typeof snapshotItem === 'object' && !Array.isArray(snapshotItem)) {\n    upsertExploreFeedSessionCacheRow(trackId, snapshotItem as Record<string, unknown>);\n    upsertExplorePublicProfileFirstViewTrack(user.uid, snapshotItem as Record<string, unknown>);\n  } else {\n    // Backward-compatible fallback while older Workers are still active.\n    invalidateExploreFeedSessionCache();\n    invalidateExplorePublicProfileFirstView(user.uid);\n  }\n  return nextState;\n};\n"""
    pub = replace_once(pub, old_publish_tail, new_publish_tail, 'publication targeted publish cache')
    old_visibility_tail = """  patchPublicationStateByTrackId(user.uid, resolvedTrackId, (state) => ({ ...state, status }));\n  invalidateExploreFeedSessionCache();\n  invalidateExplorePublicProfileFirstView(user.uid);\n  return {\n"""
    new_visibility_tail = """  patchPublicationStateByTrackId(user.uid, resolvedTrackId, (state) => ({ ...state, status }));\n  if (status === 'private') {\n    removeExploreFeedSessionCacheRow(resolvedTrackId);\n    removeExplorePublicProfileFirstViewTrack(user.uid, resolvedTrackId);\n  } else {\n    const snapshotItem = payload?.data?.snapshotItem;\n    if (snapshotItem && typeof snapshotItem === 'object' && !Array.isArray(snapshotItem)) {\n      upsertExploreFeedSessionCacheRow(resolvedTrackId, snapshotItem as Record<string, unknown>);\n      upsertExplorePublicProfileFirstViewTrack(user.uid, snapshotItem as Record<string, unknown>);\n    } else {\n      invalidateExploreFeedSessionCache();\n      invalidateExplorePublicProfileFirstView(user.uid);\n    }\n  }\n  return {\n"""
    pub = replace_once(pub, old_visibility_tail, new_visibility_tail, 'publication targeted visibility cache')
    old_options_tail = """  patchPublicationStateByTrackId(user.uid, normalizedTrackId, (state) => ({ ...state, ...nextOptions }));\n  invalidateExploreFeedSessionCache();\n  invalidateExplorePublicProfileFirstView(user.uid);\n  return nextOptions;\n};\n"""
    new_options_tail = """  patchPublicationStateByTrackId(user.uid, normalizedTrackId, (state) => ({ ...state, ...nextOptions }));\n  patchExploreFeedSessionCachesRow(normalizedTrackId, nextOptions);\n  patchExplorePublicProfileFirstViewTrack(user.uid, normalizedTrackId, nextOptions);\n  return nextOptions;\n};\n"""
    pub = replace_once(pub, old_options_tail, new_options_tail, 'publication targeted options cache')
    pub_path.write_text(pub, encoding='utf-8')


# ---------------------------------------------------------------------------
# 6. Explore UI keeps optimistic counts UID-scoped, never in shared public cache.
# ---------------------------------------------------------------------------
page_path = ROOT / 'src/pages/ExplorePage.tsx'
page = page_path.read_text(encoding='utf-8')
if 'SORIDRAW_EXPLORE_UID_SCOPED_LIKE_OVERLAY_075_20260913' not in page:
    page = replace_once(
        page,
        "  patchExploreFeedSessionCacheRow,\n",
        "",
        'remove public optimistic feed patch import',
    )
    page = replace_once(
        page,
        "  getExploreLikedTrackIds,\n",
        "  getExploreLikedTrackIds,\n  getExploreLikeDisplayCounts,\n",
        'like display overlay import',
    )
    page = replace_once(
        page,
        "// SORIDRAW_EXPLORE_LIKE_FRESH_BOOTSTRAP_RECOVERY_073_20260912\n// SORIDRAW_EXPLORE_LIKE_LOCAL_VISIBLE_COUNT_074_20260912\n",
        "// SORIDRAW_EXPLORE_LIKE_FRESH_BOOTSTRAP_RECOVERY_073_20260912\n// SORIDRAW_EXPLORE_LIKE_LOCAL_VISIBLE_COUNT_074_20260912\n// SORIDRAW_EXPLORE_UID_SCOPED_LIKE_OVERLAY_075_20260913\n",
        'page 075 marker',
    )
    old_hydration = """        setLikedTrackIds((prev) => {\n          const next = { ...prev };\n          ids.forEach((id) => { next[id] = false; });\n          likedIds.forEach((id) => { next[id] = true; });\n          return next;\n        });\n"""
    new_hydration = """        const likedSet = new Set(likedIds);\n        setLikedTrackIds((prev) => {\n          const next = { ...prev };\n          ids.forEach((id) => { next[id] = false; });\n          likedIds.forEach((id) => { next[id] = true; });\n          return next;\n        });\n        const displayCounts = getExploreLikeDisplayCounts(user, ids);\n        const applyPersonalOverlay = (list: ExploreTrack[]) => list.map((track) => {\n          const displayCount = displayCounts[track.id];\n          if (displayCount !== undefined) return { ...track, likeCount: displayCount };\n          if (likedSet.has(track.id) && track.likeCount === 0) return { ...track, likeCount: 1 };\n          return track;\n        });\n        setTracks(applyPersonalOverlay);\n        setProfileTracks(applyPersonalOverlay);\n"""
    page = replace_once(page, old_hydration, new_hydration, 'UID scoped like hydration overlay')
    old_floor_loop = """    for (const track of selfLikedZeroTracks) {\n      patchExploreFeedSessionCacheRow(requestUrl, track.id, { likeCount: 1 });\n      if (track.ownerUid) patchExplorePublicProfileFirstViewTrack(track.ownerUid, track.id, { likeCount: 1 });\n    }\n"""
    page = replace_once(page, old_floor_loop, "", 'remove stale-floor public cache contamination')
    old_signal = """        const nextCount = safeCount(displayLikeCount);\n        updateTrackLikeCount(trackId, nextCount);\n        patchExploreFeedSessionCacheRow(requestUrl, trackId, { likeCount: nextCount });\n        const ownerUid = String(detail.ownerUid || '').trim();\n        if (ownerUid) patchExplorePublicProfileFirstViewTrack(ownerUid, trackId, { likeCount: nextCount });\n"""
    new_signal = """        const nextCount = safeCount(displayLikeCount);\n        updateTrackLikeCount(trackId, nextCount);\n"""
    page = replace_once(page, old_signal, new_signal, 'same-account UID overlay only')
    old_toggle = """      updateTrackLikeCount(track.id, result.likeCount);\n      patchExploreFeedSessionCacheRow(requestUrl, track.id, { likeCount: result.likeCount });\n      if (track.ownerUid) patchExplorePublicProfileFirstViewTrack(track.ownerUid, track.id, { likeCount: result.likeCount });\n"""
    new_toggle = """      updateTrackLikeCount(track.id, result.likeCount);\n"""
    page = replace_once(page, old_toggle, new_toggle, 'clicker UID overlay only')
    page_path.write_text(page, encoding='utf-8')

print('APPLY_075_SOCIAL_SNAPSHOT_COST=PASS')

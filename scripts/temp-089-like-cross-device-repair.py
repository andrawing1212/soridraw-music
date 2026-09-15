from pathlib import Path
import json


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)


like_path = Path('src/services/exploreLikeService.ts')
like = like_path.read_text()
like = replace_once(
    like,
    '// SORIDRAW_EXPLORE_CROSS_DEVICE_CANONICAL_DISPLAY_089_20260914\n',
    '// SORIDRAW_EXPLORE_CROSS_DEVICE_CANONICAL_DISPLAY_089_20260914\n// SORIDRAW_EXPLORE_LIKE_LIVE_DISPLAY_090_20260915\n',
    '090 service marker',
)

old_signal = '''  rememberAccountSyncResults(uid, signal.results);\n  for (const result of signal.results) {\n    cache.set(result.trackId, result.liked);\n    patchExploreLikedTrackMembership(uid, result.trackId, result.liked);\n    dispatchLikeSync({\n      uid: user.uid,\n      trackId: result.trackId,\n      ownerUid: result.ownerUid,\n      liked: result.liked,\n      likeCount: result.likeCount,\n      ...(result.displayLikeCount === undefined ? {} : { displayLikeCount: result.displayLikeCount }),\n    });\n  }'''
new_signal = '''  // 090: a local pending click is newer UI intent than an account signal that\n  // arrives from another device. Keep the pending heart until this device's own\n  // batch is confirmed; otherwise a remote signal can visibly roll the heart back.\n  const pendingOutbox = readLikeOutbox(uid);\n  const effectiveResults = signal.results.map((result) => {\n    const pending = pendingOutbox[result.trackId];\n    return pending ? { ...result, liked: pending.desiredLiked } : result;\n  });\n  rememberAccountSyncResults(uid, effectiveResults);\n  for (const result of effectiveResults) {\n    cache.set(result.trackId, result.liked);\n    patchExploreLikedTrackMembership(uid, result.trackId, result.liked);\n    dispatchLikeSync({\n      uid: user.uid,\n      trackId: result.trackId,\n      ownerUid: result.ownerUid,\n      liked: result.liked,\n      likeCount: result.likeCount,\n      ...(result.displayLikeCount === undefined ? {} : { displayLikeCount: result.displayLikeCount }),\n    });\n  }'''
like = replace_once(like, old_signal, new_signal, 'pending wins account signal')

old_optimistic = '''  const previousVisibleLiked = !liked;\n  const baselineLiked = inflight?.desiredLiked ?? existing?.baseLiked ?? previousVisibleLiked;\n  const baselineLikeCount = inflight?.optimisticLikeCount ?? existing?.baseLikeCount ?? clampLikeCount(currentLikeCount);\n  // 089: numeric likes are shared public state. Never manufacture a per-device\n  // +/- value from a possibly stale heart; only the heart is optimistic locally.\n  const optimisticLikeCount = clampLikeCount(currentLikeCount);'''
new_optimistic = '''  const previousVisibleLiked = !liked;\n  const baselineLiked = inflight?.desiredLiked ?? existing?.baseLiked ?? previousVisibleLiked;\n  const baselineLikeCount = inflight?.optimisticLikeCount ?? existing?.baseLikeCount ?? clampLikeCount(currentLikeCount);\n  // 090: move the number only for this device's concrete pending transition.\n  // The delta is anchored to one stable baseline, so rapid like/unlike returns\n  // to the baseline instead of stacking +1/-1 from stale cross-device hearts.\n  const optimisticLikeCount = clampLikeCount(\n    baselineLikeCount + Number(liked) - Number(baselineLiked),\n  );'''
like = replace_once(like, old_optimistic, new_optimistic, 'bounded optimistic count')
like_path.write_text(like)

page_path = Path('src/pages/ExplorePage.tsx')
page = page_path.read_text()
page = replace_once(
    page,
    '// SORIDRAW_EXPLORE_CROSS_DEVICE_CANONICAL_DISPLAY_089_20260914\n',
    '// SORIDRAW_EXPLORE_CROSS_DEVICE_CANONICAL_DISPLAY_089_20260914\n// SORIDRAW_EXPLORE_LIKE_LIVE_DISPLAY_090_20260915\n',
    '090 page marker',
)

page = replace_once(
    page,
    '  const likeCountRepairKeyRef072 = useRef(\'\');\n',
    '  const likeCountRepairKeyRef072 = useRef(\'\');\n  const likeInteractionVersionRef090 = useRef(0);\n',
    'interaction version ref',
)

page = replace_once(
    page,
    '        const normalizedLikedRows = normalizedRows;\n',
    '''        const normalizedLikedRows = normalizedRows.map((track) => (\n          effectiveLikedSet.has(track.id) && track.likeCount === 0\n            ? { ...track, likeCount: 1 }\n            : track\n        ));\n''',
    'liked tab zero floor',
)
page = replace_once(
    page,
    '            merged.set(track.id, track);\n',
    '            merged.set(track.id, track.likeCount === 0 ? { ...track, likeCount: 1 } : track);\n',
    'same-session liked zero floor',
)

old_hydration_start = '''    let cancelled = false;\n    getExploreLikedTrackIds(user, ids)\n      .then((likedIds) => {\n        if (cancelled) return;'''
new_hydration_start = '''    let cancelled = false;\n    const interactionVersion = likeInteractionVersionRef090.current;\n    getExploreLikedTrackIds(user, ids)\n      .then((likedIds) => {\n        if (cancelled) return;\n        if (interactionVersion !== likeInteractionVersionRef090.current) {\n          likeHydrationKeyRef.current = '';\n          setLikeAccountSyncSignal((value) => value + 1);\n          return;\n        }'''
page = replace_once(page, old_hydration_start, new_hydration_start, 'stale hydration guard')

old_floor = '''  useEffect(() => {\n    if (!user?.uid || profileUid || !isExploreFeedRequest(requestUrl) || !tracks.length) return;\n    const selfLikedZeroTracks = tracks\n      .filter((track) => track.likeCount === 0 && likedTrackIds[track.id] === true);\n    if (!selfLikedZeroTracks.length) return;\n    // 074: a signed-in user who has this track liked must see at least 1\n    // immediately. This is a local-only display floor and causes no server read.\n    // The scheduled aggregate/fresh refresh still replaces it with canonical data.\n    const ids = new Set(selfLikedZeroTracks.map((track) => track.id));\n    setTracks((previous) => previous.map((track) => ids.has(track.id) ? { ...track, likeCount: 1 } : track));\n  }, [user?.uid, profileUid, requestUrl, tracks, likedTrackIds]);'''
new_floor = '''  useEffect(() => {\n    if (!user?.uid) return;\n    // 090: liked membership itself proves the shared count cannot be zero.\n    // Apply only the safe floor 0 -> 1 on every local card source, with no fetch.\n    const patchLikedZeroFloor = (list: ExploreTrack[]) => {\n      let changed = false;\n      const next = list.map((track) => {\n        if (track.likeCount !== 0 || likedTrackIds[track.id] !== true) return track;\n        changed = true;\n        return { ...track, likeCount: 1 };\n      });\n      return changed ? next : list;\n    };\n    setTracks(patchLikedZeroFloor);\n    setProfileTracks(patchLikedZeroFloor);\n    setProfileLikedTracks(patchLikedZeroFloor);\n  }, [user?.uid, likedTrackIds]);'''
page = replace_once(page, old_floor, new_floor, 'all-card liked zero floor')

helper_anchor = '''  // SORIDRAW_EXPLORE_LIKE_W1_DELAYED_COUNT_069_20260912\n  useEffect(() => {'''
helper = '''  const updateTrackLikeCount090 = (trackId: string, likeCount: number) => {\n    const patch = (list: ExploreTrack[]) => {\n      let changed = false;\n      const next = list.map((track) => {\n        if (track.id !== trackId || track.likeCount === likeCount) return track;\n        changed = true;\n        return { ...track, likeCount };\n      });\n      return changed ? next : list;\n    };\n    setTracks(patch);\n    setProfileTracks(patch);\n    setProfileLikedTracks(patch);\n  };\n\n  // SORIDRAW_EXPLORE_LIKE_W1_DELAYED_COUNT_069_20260912\n  useEffect(() => {'''
page = replace_once(page, helper_anchor, helper, 'count patch helper')

old_toggle = '''    const currentLiked = Boolean(likedTrackIds[track.id]);\n    setLikeBusyTrackId(track.id);\n    try {\n      const result = await setExploreTrackLike(user, track.id, !currentLiked, track.likeCount, track.ownerUid);\n      // 074: heart and the clicker's visible number move immediately. Canonical\n      // server count is still confirmed only by the existing deferred aggregate.\n      setLikedTrackIds((prev) => ({ ...prev, [track.id]: result.liked }));\n      rememberExploreLikedTrack(user.uid, track as unknown as Record<string, unknown>, result.liked);\n      setProfileLikedTracks((previous) => {\n        if (!result.liked) return previous.filter((item) => item.id !== track.id);\n        return previous.some((item) => item.id === track.id) ? previous : [track, ...previous];\n      });'''
new_toggle = '''    const currentLiked = Boolean(likedTrackIds[track.id]);\n    likeInteractionVersionRef090.current += 1;\n    setLikeBusyTrackId(track.id);\n    try {\n      const result = await setExploreTrackLike(user, track.id, !currentLiked, track.likeCount, track.ownerUid);\n      const optimisticTrack = { ...track, likeCount: result.likeCount };\n      // 090: heart and count move together from one pending transition. The\n      // shared aggregate still replaces the temporary number on its normal cycle.\n      setLikedTrackIds((prev) => ({ ...prev, [track.id]: result.liked }));\n      updateTrackLikeCount090(track.id, result.likeCount);\n      rememberExploreLikedTrack(user.uid, optimisticTrack as unknown as Record<string, unknown>, result.liked);\n      setProfileLikedTracks((previous) => {\n        if (!result.liked) return previous.filter((item) => item.id !== track.id);\n        const rest = previous.filter((item) => item.id !== track.id);\n        return [optimisticTrack, ...rest];\n      });'''
page = replace_once(page, old_toggle, new_toggle, 'toggle immediate count')
page_path.write_text(page)

v87_path = Path('scripts/verify-087-liked-card-consistency.mjs')
v87 = v87_path.read_text()
v87 = replace_once(
    v87,
    "assert.doesNotMatch(page, /effectiveLikedSet\\.has\\(track\\.id\\) && track\\.likeCount === 0/);",
    "assert.match(page, /effectiveLikedSet\\.has\\(track\\.id\\) && track\\.likeCount === 0/);",
    'v87 floor restored',
)
v87 = replace_once(
    v87,
    "assert.doesNotMatch(page, /setProfileLikedTracks\\(applyPersonalOverlay\\)/);",
    "assert.doesNotMatch(page, /setProfileLikedTracks\\(applyPersonalOverlay\\)/);",
    'v87 unchanged overlay guard',
)
v87 = v87.replace(
    'liked-card membership is repaired locally without inventing a per-device numeric count or adding server reads.',
    'liked-card membership is repaired locally, a liked card cannot display zero, and no new server reads are added.',
)
v87_path.write_text(v87)

v88_path = Path('scripts/verify-088-same-session-liked-heart.mjs')
v88 = v88_path.read_text()
v88 = replace_once(
    v88,
    "assert.match(page, /const normalizedLikedRows = normalizedRows;/);",
    "assert.match(page, /const normalizedLikedRows = normalizedRows\\.map/);",
    'v88 liked rows floor',
)
v88 = replace_once(
    v88,
    "assert.match(page, /merged\\.set\\(track\\.id, track\\);/);",
    "assert.match(page, /merged\\.set\\(track\\.id, track\\.likeCount === 0 \\? \\{ \\.\\.\\.track, likeCount: 1 \\} : track\\);/);",
    'v88 merged floor',
)
v88_path.write_text(v88)

v89_path = Path('scripts/verify-089-like-cross-device-consistency.mjs')
v89 = v89_path.read_text()
v89 = replace_once(v89, "assert.equal(String(version.version), '089');", "assert.ok(Number(version.version) >= 89, `expected app version 089+, got ${version.version}`);", 'v89 version')
v89 = replace_once(
    v89,
    "assert.match(like, /const optimisticLikeCount = clampLikeCount\\(currentLikeCount\\);/);",
    "assert.match(like, /baselineLikeCount \\+ Number\\(liked\\) - Number\\(baselineLiked\\)/);",
    'v89 bounded optimistic count',
)
v89 = replace_once(
    v89,
    "assert.doesNotMatch(page, /track\\.likeCount === 0\\s*\\? \\{ \\.\\.\\.track, likeCount: 1 \\}/);",
    "assert.match(page, /track\\.likeCount === 0 \\? \\{ \\.\\.\\.track, likeCount: 1 \\} : track/);",
    'v89 safe floor',
)
v89 = replace_once(
    v89,
    "assert.doesNotMatch(page, /updateTrackLikeCount/);",
    "assert.match(page, /updateTrackLikeCount090/);",
    'v89 local count helper',
)
v89 = v89.replace(
    "PASS 089: shared numeric count is never locally incremented; heart remains optimistic, pending changes auto-flush within 5s, persisted pending changes resume, and stale 088 per-device caches are schema-invalidated once.",
    "PASS 089/090: cross-device state stays batch-based; numeric optimism is limited to the current pending transition, no account-patch numeric overlay is restored, and pending changes auto-flush within 5s.",
)
v89_path.write_text(v89)

verifier090 = r'''import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const like = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));
assert.equal(String(version.version), '090');
assert.match(like, /SORIDRAW_EXPLORE_LIKE_LIVE_DISPLAY_090_20260915/);
assert.match(page, /SORIDRAW_EXPLORE_LIKE_LIVE_DISPLAY_090_20260915/);
assert.match(like, /const pendingOutbox = readLikeOutbox\(uid\)/);
assert.match(like, /pending \? \{ \.\.\.result, liked: pending\.desiredLiked \} : result/);
assert.match(like, /baselineLikeCount \+ Number\(liked\) - Number\(baselineLiked\)/);
assert.doesNotMatch(like, /clampLikeCount\(currentLikeCount\) \+ \(liked \? 1 : -1\)/);
assert.match(page, /const optimisticTrack = \{ \.\.\.track, likeCount: result\.likeCount \}/);
assert.match(page, /updateTrackLikeCount090\(track\.id, result\.likeCount\)/);
assert.match(page, /rememberExploreLikedTrack\(user\.uid, optimisticTrack/);
assert.match(page, /effectiveLikedSet\.has\(track\.id\) && track\.likeCount === 0/);
assert.match(page, /patchLikedZeroFloor/);
assert.match(page, /likeInteractionVersionRef090/);
assert.match(page, /interactionVersion !== likeInteractionVersionRef090\.current/);
const setLikeStart = like.indexOf('export const setExploreTrackLike = async');
const setLikeBody = like.slice(setLikeStart, like.indexOf('\n};', setLikeStart) + 3);
assert.doesNotMatch(setLikeBody, /requestExploreLike\(/, '090 click path must remain local/batched');
console.log('PASS 090: live heart/count move together, liked cards never show zero, stale hydration/account signals cannot roll back a newer local pending heart, and click path adds no server request.');
'''
Path('scripts/verify-090-like-live-display.mjs').write_text(verifier090)
Path('public/app-version.json').write_text(json.dumps({'version': '090'}, ensure_ascii=False, indent=2) + '\n')

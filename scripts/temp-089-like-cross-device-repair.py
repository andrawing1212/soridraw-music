from pathlib import Path
import json


def replace_once(text, old, new, label):
    if text.count(old) != 1:
        raise SystemExit(f'{label}: expected 1 match, got {text.count(old)}')
    return text.replace(old, new, 1)


like_path = Path('src/services/exploreLikeService.ts')
like = like_path.read_text()
like = replace_once(
    like,
    '// SORIDRAW_EXPLORE_SAME_SESSION_PENDING_LIKE_088_20260914\n',
    '// SORIDRAW_EXPLORE_SAME_SESSION_PENDING_LIKE_088_20260914\n// SORIDRAW_EXPLORE_CROSS_DEVICE_CANONICAL_DISPLAY_089_20260914\n',
    '089 marker',
)
like = replace_once(like, 'const EXPLORE_LIKE_CACHE_SCHEMA_VERSION = 1;', 'const EXPLORE_LIKE_CACHE_SCHEMA_VERSION = 2;', 'liked state schema')
like = replace_once(like, 'const EXPLORE_LIKE_ACCOUNT_PATCH_SCHEMA_VERSION = 1;', 'const EXPLORE_LIKE_ACCOUNT_PATCH_SCHEMA_VERSION = 2;', 'account patch schema')
like = replace_once(like, 'const EXPLORE_LIKE_BATCH_WINDOW_PREVIEW_MS = 60_000;', 'const EXPLORE_LIKE_BATCH_WINDOW_PREVIEW_MS = 5_000;', 'preview batch window')
like = replace_once(like, 'const EXPLORE_LIKE_BATCH_WINDOW_DEFAULT_MS = 4 * 60_000;', 'const EXPLORE_LIKE_BATCH_WINDOW_DEFAULT_MS = 5_000;', 'default batch window')

like = replace_once(
    like,
    '      let visibleLiked = pending.desiredLiked;\n      let visibleLikeCount = pending.optimisticLikeCount;\n      let ownerUid = pending.ownerUid;',
    '      let visibleLiked = pending.desiredLiked;\n      let ownerUid = pending.ownerUid;',
    'flush visible count declaration',
)
like = replace_once(
    like,
    '        visibleLiked = latest.desiredLiked;\n        visibleLikeCount = latest.optimisticLikeCount;',
    '        visibleLiked = latest.desiredLiked;',
    'flush visible count reassignment',
)
like = replace_once(
    like,
    '      const visibleResult = {\n        trackId: result.trackId,\n        liked: visibleLiked,\n        likeCount: result.likeCount,\n        displayLikeCount: visibleLikeCount,\n      };',
    '      const visibleResult = {\n        trackId: result.trackId,\n        liked: visibleLiked,\n        likeCount: result.likeCount,\n      };',
    'flush display count removal',
)

old_resume = '''const resumePendingLikes = (user: User) => {\n  const outbox = readLikeOutbox(user.uid);\n  if (!Object.keys(outbox).length) {\n    clearPendingLikeTimer(user.uid);\n    return;\n  }\n\n};'''
new_resume = '''const resumePendingLikes = (user: User) => {\n  const outbox = readLikeOutbox(user.uid);\n  if (!Object.keys(outbox).length) {\n    clearPendingLikeTimer(user.uid);\n    return;\n  }\n  schedulePendingLikes(user);\n};'''
like = replace_once(like, old_resume, new_resume, 'resume pending scheduler')

like = replace_once(
    like,
    '  if (!normalized.length) return [];\n\n  const cache = getLikedStateCache(user.uid);',
    '  if (!normalized.length) return [];\n  resumePendingLikes(user);\n\n  const cache = getLikedStateCache(user.uid);',
    'hydrate resume pending',
)

start = like.index('export const getExploreLikeDisplayCounts = (')
end = like.index('export const setExploreTrackLike = async (', start)
replacement = '''export const getExploreLikeDisplayCounts = (\n  _user: User,\n  _trackIds: string[],\n): Record<string, number> => ({});\n\n'''
like = like[:start] + replacement + like[end:]

old_optimistic = '''  // 074: public canonical count is still server-aggregated, but the person who\n  // clicked sees the expected +/- immediately. This is local display state only.\n  const optimisticLikeCount = clampLikeCount(\n    clampLikeCount(currentLikeCount) + (liked ? 1 : -1),\n  );'''
new_optimistic = '''  // 089: numeric likes are shared public state. Never manufacture a per-device\n  // +/- value from a possibly stale heart; only the heart is optimistic locally.\n  const optimisticLikeCount = clampLikeCount(currentLikeCount);'''
like = replace_once(like, old_optimistic, new_optimistic, 'optimistic numeric removal')

tail_old = '''  persistLikeOutbox(user.uid, outbox);\n\n  return { trackId: normalizedTrackId, liked, likeCount: optimisticLikeCount };\n};'''
tail_new = '''  persistLikeOutbox(user.uid, outbox);\n  // 089: a real like change must leave this device promptly even if the user\n  // stays on Explore. The existing page-exit flush remains the final fallback.\n  schedulePendingLikes(user);\n\n  return { trackId: normalizedTrackId, liked, likeCount: optimisticLikeCount };\n};'''
like = replace_once(like, tail_old, tail_new, 'click scheduler')
like_path.write_text(like)

page_path = Path('src/pages/ExplorePage.tsx')
page = page_path.read_text()
page = replace_once(
    page,
    '// SORIDRAW_EXPLORE_UID_SCOPED_SYNC_EVENT_075_20260913\n',
    '// SORIDRAW_EXPLORE_UID_SCOPED_SYNC_EVENT_075_20260913\n// SORIDRAW_EXPLORE_CROSS_DEVICE_CANONICAL_DISPLAY_089_20260914\n',
    'page 089 marker',
)
page = replace_once(page, '  getExploreLikeDisplayCounts,\n', '', 'display count import')
old_rows = '''        const normalizedLikedRows = normalizedRows.map((track) => (\n          effectiveLikedSet.has(track.id) && track.likeCount === 0\n            ? { ...track, likeCount: 1 }\n            : track\n        ));'''
page = replace_once(page, old_rows, '        const normalizedLikedRows = normalizedRows;', 'liked zero floor')
page = replace_once(
    page,
    '            merged.set(track.id, track.likeCount === 0 ? { ...track, likeCount: 1 } : track);',
    '            merged.set(track.id, track);',
    'merged zero floor',
)

overlay_old = '''        const displayCounts = getExploreLikeDisplayCounts(user, ids);\n        const applyPersonalOverlay = (list: ExploreTrack[]) => list.map((track) => {\n          const displayCount = displayCounts[track.id];\n          if (displayCount !== undefined) return { ...track, likeCount: displayCount };\n          if (likedSet.has(track.id) && track.likeCount === 0) return { ...track, likeCount: 1 };\n          return track;\n        });\n        setTracks(applyPersonalOverlay);\n        setProfileTracks(applyPersonalOverlay);\n        setProfileLikedTracks(applyPersonalOverlay);'''
page = replace_once(
    page,
    overlay_old,
    '        // 089: heart membership is personal; numeric likeCount stays on the shared public feed/profile value.',
    'personal numeric overlay',
)

update_fn = '''  const updateTrackLikeCount = (trackId: string, likeCount: number) => {\n    const patch = (list: ExploreTrack[]) => list.map((track) => track.id === trackId ? { ...track, likeCount } : track);\n    setTracks(patch);\n    setProfileTracks(patch);\n    setProfileLikedTracks(patch);\n  };\n\n'''
page = replace_once(page, update_fn, '', 'updateTrackLikeCount helper')
signal_overlay = '''      // 074 same-account display: carry only the local optimistic number.\n      // Legacy signals do not include displayLikeCount, so they stay heart-only.\n      const displayLikeCount = Number(detail.displayLikeCount);\n      if (Number.isFinite(displayLikeCount)) {\n        const nextCount = safeCount(displayLikeCount);\n        updateTrackLikeCount(trackId, nextCount);\n      }\n'''
page = replace_once(page, signal_overlay, '', 'signal numeric overlay')
page = replace_once(page, '      updateTrackLikeCount(track.id, result.likeCount);\n', '', 'toggle numeric overlay')
page_path.write_text(page)

v87_path = Path('scripts/verify-087-liked-card-consistency.mjs')
v87 = v87_path.read_text()
v87 = replace_once(
    v87,
    "assert.match(page, /effectiveLikedSet\\.has\\(track\\.id\\) && track\\.likeCount === 0/);",
    "assert.doesNotMatch(page, /effectiveLikedSet\\.has\\(track\\.id\\) && track\\.likeCount === 0/);",
    'v87 no local count floor',
)
v87 = v87.replace(
    'liked-tab zero count gets a local floor, and liked-card overlay is applied without new server reads.',
    'liked-card membership is repaired locally without inventing a per-device numeric count or adding server reads.',
)
v87_path.write_text(v87)

v88_path = Path('scripts/verify-088-same-session-liked-heart.mjs')
v88 = v88_path.read_text()
v88 = replace_once(
    v88,
    "assert.equal(String(version.version), '088');",
    "assert.ok(Number(version.version) >= 88, `expected app version 088+, got ${version.version}`);",
    'v88 version',
)
v88 = replace_once(
    v88,
    "assert.match(page, /merged\\.set\\(track\\.id, track\\.likeCount === 0 \\? \\{ \\.\\.\\.track, likeCount: 1 \\} : track\\)/);",
    "assert.match(page, /merged\\.set\\(track\\.id, track\\);/);",
    'v88 merged card',
)
v88_path.write_text(v88)

verifier = r'''import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const like = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));
assert.equal(String(version.version), '089');
assert.match(like, /SORIDRAW_EXPLORE_CROSS_DEVICE_CANONICAL_DISPLAY_089_20260914/);
assert.match(page, /SORIDRAW_EXPLORE_CROSS_DEVICE_CANONICAL_DISPLAY_089_20260914/);
assert.match(like, /EXPLORE_LIKE_CACHE_SCHEMA_VERSION = 2/);
assert.match(like, /EXPLORE_LIKE_ACCOUNT_PATCH_SCHEMA_VERSION = 2/);
assert.match(like, /EXPLORE_LIKE_BATCH_WINDOW_PREVIEW_MS = 5_000/);
assert.match(like, /EXPLORE_LIKE_BATCH_WINDOW_DEFAULT_MS = 5_000/);
assert.match(like, /persistLikeOutbox\(user\.uid, outbox\);[\s\S]{0,220}schedulePendingLikes\(user\);/);
assert.match(like, /const resumePendingLikes = \(user: User\) => \{[\s\S]{0,260}schedulePendingLikes\(user\);/);
assert.match(like, /if \(!normalized\.length\) return \[\];\s*resumePendingLikes\(user\);/);
assert.match(like, /const optimisticLikeCount = clampLikeCount\(currentLikeCount\);/);
assert.doesNotMatch(like, /currentLikeCount\) \+ \(liked \? 1 : -1\)/);
assert.match(like, /export const getExploreLikeDisplayCounts = \([\s\S]{0,160}=> \(\{\}\);/);
assert.doesNotMatch(page, /getExploreLikeDisplayCounts/);
assert.doesNotMatch(page, /displayCount !== undefined/);
assert.doesNotMatch(page, /track\.likeCount === 0\s*\? \{ \.\.\.track, likeCount: 1 \}/);
assert.doesNotMatch(page, /updateTrackLikeCount/);
assert.match(page, /setLikedTrackIds\(\(prev\) => \(\{ \.\.\.prev, \[trackId\]: detail\.liked as boolean \}\)\)/);
console.log('PASS 089: shared numeric count is never locally incremented; heart remains optimistic, pending changes auto-flush within 5s, persisted pending changes resume, and stale 088 per-device caches are schema-invalidated once.');
'''
Path('scripts/verify-089-like-cross-device-consistency.mjs').write_text(verifier)

Path('public/app-version.json').write_text(json.dumps({'version': '089'}, ensure_ascii=False, indent=2) + '\n')

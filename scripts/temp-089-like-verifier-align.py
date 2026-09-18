from pathlib import Path


def once(text, old, new, label):
    if text.count(old) != 1:
        raise SystemExit(f'{label}: expected 1 match, got {text.count(old)}')
    return text.replace(old, new, 1)


p87 = Path('scripts/verify-087-liked-card-consistency.mjs')
s87 = p87.read_text()
s87 = once(
    s87,
    "assert.match(page, /setProfileLikedTracks\\(applyPersonalOverlay\\)/);",
    "assert.doesNotMatch(page, /setProfileLikedTracks\\(applyPersonalOverlay\\)/);",
    '087 overlay',
)
p87.write_text(s87)

p88 = Path('scripts/verify-088-same-session-liked-heart.mjs')
s88 = p88.read_text()
s88 = once(
    s88,
    "assert.match(page, /const normalizedLikedRows = normalizedRows\\.map/);",
    "assert.match(page, /const normalizedLikedRows = normalizedRows;/);",
    '088 normalized rows',
)
p88.write_text(s88)

pc = Path('scripts/verify-explore-like-cost-optimization.mjs')
c = pc.read_text()
c = once(
    c,
    '// PREVIEW is intentionally shortened to one minute for fast iteration.\n// TEST/PRODUCTION retain the four-minute default until separately approved.',
    '// 089 correctness contract: actual like changes still batch, but flush within five seconds\n// so same-account devices converge promptly without per-click server writes.',
    'cost comment',
)
c = once(
    c,
    "assert.match(service, /const EXPLORE_LIKE_BATCH_WINDOW_PREVIEW_MS = 60_000;/);\nassert.match(service, /const EXPLORE_LIKE_BATCH_WINDOW_DEFAULT_MS = 4 \\* 60_000;/);",
    "assert.match(service, /const EXPLORE_LIKE_BATCH_WINDOW_PREVIEW_MS = 5_000;/);\nassert.match(service, /const EXPLORE_LIKE_BATCH_WINDOW_DEFAULT_MS = 5_000;/);",
    'cost windows',
)
old_same = '''const sameSession088 = service.includes('SORIDRAW_EXPLORE_SAME_SESSION_PENDING_LIKE_088_20260914');
if (sameSession088) {
  assert.doesNotMatch(service, /replayAccountSyncPatches\(user\.uid, normalized\)/);
  assert.doesNotMatch(service, /const replayAccountSyncPatches =/);
  assert.match(service, /rememberAccountSyncResults\(uid, accountReplayResults\)/);
  const displayCountsFunction = functionText(service, 'export const getExploreLikeDisplayCounts =');
  assert.match(displayCountsFunction, /readAccountPatchCache\(user\.uid\)/);
} else {
  assert.match(service, /replayAccountSyncPatches\(user\.uid, normalized\)/);
}
const queueFunction = functionText(service, 'export const setExploreTrackLike = async');
assert.doesNotMatch(queueFunction, /schedulePendingLikes\(user\)/, '081 UI queue must remain local-only');
assert.doesNotMatch(queueFunction, /requestExploreLike\(/, 'UI queue function must not call the server immediately');'''
new_same = '''const sameSession088 = service.includes('SORIDRAW_EXPLORE_SAME_SESSION_PENDING_LIKE_088_20260914');
const crossDevice089 = service.includes('SORIDRAW_EXPLORE_CROSS_DEVICE_CANONICAL_DISPLAY_089_20260914');
if (sameSession088) {
  assert.doesNotMatch(service, /replayAccountSyncPatches\(user\.uid, normalized\)/);
  assert.doesNotMatch(service, /const replayAccountSyncPatches =/);
  assert.match(service, /rememberAccountSyncResults\(uid, accountReplayResults\)/);
  const displayCountsFunction = functionText(service, 'export const getExploreLikeDisplayCounts =');
  if (crossDevice089) {
    assert.doesNotMatch(displayCountsFunction, /readAccountPatchCache\(user\.uid\)/);
    assert.match(displayCountsFunction, /=> \(\{\}/);
  } else {
    assert.match(displayCountsFunction, /readAccountPatchCache\(user\.uid\)/);
  }
} else {
  assert.match(service, /replayAccountSyncPatches\(user\.uid, normalized\)/);
}
const queueFunction = functionText(service, 'export const setExploreTrackLike = async');
if (crossDevice089) {
  assert.match(queueFunction, /schedulePendingLikes\(user\)/, '089 actual changes must start one bounded batch timer');
} else {
  assert.doesNotMatch(queueFunction, /schedulePendingLikes\(user\)/, '081 UI queue must remain local-only');
}
assert.doesNotMatch(queueFunction, /requestExploreLike\(/, 'UI queue function must not call the server immediately');'''
c = once(c, old_same, new_same, 'cost same-session block')
c = once(
    c,
    "console.log('PASS client: durable like outbox stays local until 081 page-exit sync; same-account visible count replay preserved');",
    "console.log('PASS client: durable like outbox remains batched; 089 starts one 5s timer for actual changes, keeps heart local-first, and removes per-device numeric count fabrication');",
    'cost pass message',
)
pc.write_text(c)

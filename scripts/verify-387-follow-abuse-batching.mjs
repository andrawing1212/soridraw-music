import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const batch = readFileSync('src/services/exploreFollowBatchService380.ts', 'utf8');
const social = readFileSync('src/services/exploreSocialService.ts', 'utf8');
const followPatch = readFileSync('cloudflare/explore-worker/patches/097-follow-abuse-guard.mjs', 'utf8');
const like = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const likePatch = readFileSync('cloudflare/explore-worker/patches/054-explore-like-edge-rate-limit.mjs', 'utf8');
const wrangler = JSON.parse(readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc', 'utf8'));
const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));

assert.ok(manifest.patches.includes('097-follow-abuse-guard.mjs'), '097 release patch provenance missing');

// app380 local-first final-state batching.
assert.match(batch, /EXPLORE_FOLLOW_IDLE_FLUSH_MS_380 = 30_000/);
assert.match(batch, /entry\.desiredFollowing === entry\.baseFollowing/);
assert.match(batch, /No Worker request, R2 write, D1 read or D1 write is needed/);
assert.match(batch, /soridraw:explore:follow-outbox:380:/);
assert.match(batch, /readPendingExploreFollowIntents380/);
assert.match(batch, /code === 'RATE_LIMITED'/);
assert.match(batch, /retryAfterMs380/);
assert.match(batch, /persistEntry380\(current\)/);
assert.match(batch, /existing\.desiredFollowing = request\.desiredFollowing === true/);

const toggleStart = page.indexOf('  const toggleFollow = () =>');
const toggleEnd = page.indexOf('\n\n  const closeMoreSheet', toggleStart);
assert.ok(toggleStart >= 0 && toggleEnd > toggleStart);
const toggle = page.slice(toggleStart, toggleEnd);
assert.match(toggle, /patchExploreFollowLocalState377\([\s\S]*?deferTargetFollowers: true/);
assert.match(toggle, /queueExploreFollowFinalState380/);
assert.ok(
  toggle.indexOf('patchExploreFollowLocalState377(') < toggle.indexOf('queueExploreFollowFinalState380('),
  'local state must paint before final-state queue',
);
const beforeQueue = toggle.slice(0, toggle.indexOf('queueExploreFollowFinalState380('));
assert.doesNotMatch(
  beforeQueue,
  /patchExplorePublicProfileFirstViewProfile\(targetUid/,
  'public target counter must remain canonical during the local-only aggregation window',
);
assert.match(toggle, /Other devices\/users see only the final accepted state/);
const publishIndex = toggle.indexOf('publishExploreFollowSync377(viewerUid');
const settledIndex = toggle.indexOf('onSettled:');
assert.ok(publishIndex > settledIndex, 'cross-device signal must publish only after final settlement');

assert.match(page, /readPendingExploreFollowIntents380\(viewerUid380\)/);
assert.match(page, /EXPLORE_FOLLOW_IDLE_FLUSH_MS_380 - Math\.max/);
assert.match(social, /deferTargetFollowers\?: boolean/);
assert.match(social, /if \(options\.deferTargetFollowers !== true\)/);
assert.match(social, /retryAfterMs/);

// Server guard: native burst limiter + R2 account/day cap + progressive same-pair cooldown.
// It must remain D1/RATE_DB-free so abuse rejection itself cannot create D1 cost.
for (const token of [
  'SORIDRAW_FOLLOW_ABUSE_GUARD_380_20261007',
  'const windowLimit = 30',
  'const dayLimit = 120',
  'pairCooldowns = [2 * 60 * 1000, 10 * 60 * 1000, 60 * 60 * 1000]',
  "key: 'follow:' + normalizedUid",
  'nextAllowedAt > now',
  'lastOperationId',
  "'Retry-After'",
]) {
  assert.ok(followPatch.includes(token), 'follow guard missing: ' + token);
}
const newLimiterStart = followPatch.indexOf("const newLimiter = [");
const newLimiterEnd = followPatch.indexOf("source = source.slice(0, oldLimiter.start)", newLimiterStart);
assert.ok(newLimiterStart >= 0 && newLimiterEnd > newLimiterStart);
const newLimiterSource = followPatch.slice(newLimiterStart, newLimiterEnd);
assert.doesNotMatch(newLimiterSource, /env\.DB|RATE_DB/);
assert.match(followPatch, /payload\?\.followOperationId/);

// Likes already have their own cost defenses: 30s local final-state batching,
// stable outbox/operation ordering, same-state no-op elimination, and an edge
// rate limiter that avoids D1/RATE_DB writes. Do not silently claim a progressive
// same-track cooldown: that is not present in the current like path.
assert.match(like, /EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 30_000/);
assert.match(like, /desiredLiked === pending\.baseLiked/);
assert.match(like, /operationId/);
assert.match(likePatch, /enforceExploreLikeBatchEdgeRateLimit054/);
assert.match(likePatch, /\.limit\(\{ key: 'like:' \+ normalizedUid \}\)/);
const edgeHelperStart = likePatch.indexOf('const edgeHelper =');
const edgeHelperEnd = likePatch.indexOf("if (!has054)", edgeHelperStart);
assert.ok(edgeHelperStart >= 0 && edgeHelperEnd > edgeHelperStart);
const edgeHelper = likePatch.slice(edgeHelperStart, edgeHelperEnd);
assert.doesNotMatch(edgeHelper, /env\.DB|RATE_DB|api_rate_limits/);
const rate = (wrangler.ratelimits || []).find((row) => row?.name === 'LIKE_RATE_LIMITER');
assert.equal(Number(rate?.simple?.limit), 60);
assert.equal(Number(rate?.simple?.period), 60);
assert.doesNotMatch(likePatch, /pairCooldowns|same-track|dayLimit/);

const generatedPath = String(process.env.SORIDRAW_GENERATED_WORKER || '').trim();
if (generatedPath) {
  const worker = readFileSync(generatedPath, 'utf8');
  assert.match(worker, /SORIDRAW_FOLLOW_ABUSE_GUARD_380_20261007/);
  const fn = (name) => {
    const start = worker.indexOf('async function ' + name + '(');
    assert.ok(start >= 0, 'generated function missing: ' + name);
    const next = worker.indexOf('\nasync function ', start + 20);
    return worker.slice(start, next > start ? next : worker.length);
  };
  const limiter = fn('enforceFollowEdgeRateLimit355');
  assert.doesNotMatch(limiter, /env\.DB|RATE_DB/);
  assert.match(limiter, /windowLimit = 30/);
  assert.match(limiter, /dayLimit = 120/);
  assert.match(limiter, /pairCooldowns/);
  const overlay = fn('handleFollowOverlay354');
  assert.ok(
    overlay.indexOf('try { payload = await request.json(); }')
      < overlay.indexOf('enforceFollowEdgeRateLimit355('),
    'generated overlay must parse stable operation id before abuse guard',
  );
}

console.log('APP380_FOLLOW_LOCAL_FIRST_30S_FINAL_STATE=PASS');
console.log('APP380_FOLLOW_RETURN_TO_BASE_SERVER_W0=PASS');
console.log('APP380_FOLLOW_PENDING_RELOAD_RECOVERY=PASS');
console.log('APP380_PUBLIC_TARGET_FINAL_STATE_ONLY=PASS');
console.log('APP380_FOLLOW_SERVER_PROGRESSIVE_PAIR_COOLDOWN=PASS');
console.log('APP380_FOLLOW_ACCOUNT_WINDOW_DAY_CAP=PASS');
console.log('APP380_FOLLOW_ABUSE_GUARD_D1_RATE_DB_ZERO=PASS');
console.log('LIKE_EXISTING_30S_FINAL_STATE_BATCH=PASS');
console.log('LIKE_EXISTING_EDGE_RATE_LIMIT_D1_RATE_DB_ZERO=PASS');
console.log('LIKE_PROGRESSIVE_SAME_TRACK_COOLDOWN=NOT_PRESENT');

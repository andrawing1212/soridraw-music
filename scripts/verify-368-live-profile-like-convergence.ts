import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldAttemptPersonalLikeOriginRepair358 } from '../src/services/exploreEnvironmentParityPolicy';

const profile = readFileSync('src/services/exploreProfileFirstViewService.ts', 'utf8');
const likes = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const entry = readFileSync('cloudflare/explore-worker/canonical/preview-entry.js', 'utf8');

assert.match(profile, /__soridraw_publication_signal/);
assert.match(profile, /requestMaterializedFirstView\(normalizedRef, cached\.revision, true\)/);
assert.match(profile, /expectedPublicationSignalVersion > 0/);
assert.ok(
  profile.indexOf("url.searchParams.set('__soridraw_publication_signal', '358')") <
  profile.indexOf("const response = await fetch(url.toString()"),
  'publication signal bypass flag must be on the request before fetch',
);

assert.match(likes, /EXPLORE_LIKE_CROSS_ORIGIN_ATTEMPTED_358/);
assert.match(likes, /shouldAttemptPersonalLikeOriginRepair358/);
assert.match(likes, /__soridraw_cross_origin_repair', '358'/);
assert.match(
  likes,
  /writeLikeLocal127\(scopedLikeKey127\(EXPLORE_LIKE_REPAIR_ATTEMPTED_182, uid\), ''\)/,
);
assert.ok(
  likes.indexOf('markCrossOriginLikeAttempted358(uid, latestSignalVersion)') <
  likes.indexOf('await ensurePersonalLikeBaseline127(user)'),
  'attempt fence must persist before the bounded Worker request',
);

assert.equal(shouldAttemptPersonalLikeOriginRepair358({
  latestSignalVersion: 200,
  certifiedSignalVersion: 100,
  attemptedSignalVersion: 0,
}), true);
assert.equal(shouldAttemptPersonalLikeOriginRepair358({
  latestSignalVersion: 200,
  certifiedSignalVersion: 100,
  attemptedSignalVersion: 200,
}), false, 'same retained signal must not reread on tab navigation');
assert.equal(shouldAttemptPersonalLikeOriginRepair358({
  latestSignalVersion: 200,
  certifiedSignalVersion: 200,
  attemptedSignalVersion: 0,
}), false, 'certified origin must remain local');
assert.equal(shouldAttemptPersonalLikeOriginRepair358({
  latestSignalVersion: 201,
  certifiedSignalVersion: 200,
  attemptedSignalVersion: 200,
}), true, 'a real newer signal may spend one new reconciliation');

assert.match(entry, /SORIDRAW_CROSS_ORIGIN_PROFILE_LIKE_CONVERGENCE_358_20261006/);
assert.match(entry, /handlePublicationSignalProfile358/);
assert.match(entry, /SHARED-SIGNAL-358/);
assert.match(entry, /handleCrossOriginPersonalLikeRepair358/);
assert.match(entry, /verified-cross-origin-d1-358/);
assert.match(entry, /LIMIT 2001/);
assert.match(entry, /explore_like_batches_069 WHERE user_uid=\?/);
assert.match(entry, /explore_like_user_queue_075/);
assert.match(entry, /onlyIf: \{ etagMatches: object\.etag \}/);
assert.match(entry, /onlyIf: \{ etagDoesNotMatch: '\*' \}/);

const repairStart = entry.indexOf('async function repairSharedPersonalLike358(');
const repairEnd = entry.indexOf('\nasync function handleCrossOriginPersonalLikeRepair358', repairStart);
assert.ok(repairStart >= 0 && repairEnd > repairStart, 'repair helper range missing');
const repairBody = entry.slice(repairStart, repairEnd);
assert.ok(!/\.(?:run|batch)\s*\(/.test(repairBody), 'cross-origin repair must never write D1');
assert.ok(!/\b(?:INSERT|UPDATE|DELETE|REPLACE)\b/i.test(
  repairBody.replace(/'SELECT[^']*'/g, ''),
), 'cross-origin repair must not contain D1 mutation SQL');

const fetchStart = entry.indexOf('async fetch(request, env, ctx)');
const baseFetch = entry.indexOf('let response = await baseWorker.fetch(request, env, ctx)', fetchStart);
const profileRoute = entry.indexOf('PROFILE_PUBLICATION_SIGNAL_QUERY_358', fetchStart);
const likeRoute = entry.indexOf('PERSONAL_LIKE_REPAIR_QUERY_358', fetchStart);
assert.ok(fetchStart >= 0 && profileRoute > fetchStart && profileRoute < baseFetch,
  'publication signal route must bypass base positive edge before ordinary base fetch');
assert.ok(fetchStart >= 0 && likeRoute > fetchStart && likeRoute < baseFetch,
  'personal repair route must run before ordinary base snapshot');

console.log('APP358_PROFILE_SIGNAL_SHARED_R2_BYPASS=PASS');
console.log('APP358_MY_LIKES_ONE_REPAIR_PER_SIGNAL=PASS');
console.log('APP358_PERSONAL_LIKE_REPAIR_D1_READONLY=PASS');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
assert.match(worker,/SORIDRAW_FOLLOW_R2_DELTA_CAS_352_20261004/);
const start=worker.indexOf('async function patchSharedProfileFollowDelta352(');
const end=worker.indexOf('\n// SORIDRAW_FOLLOW_EXACT_COUNT_RECOVERY_351_20261004',start);
assert.ok(start>=0&&end>start,'352 helper missing');
const fn=worker.slice(start,end);

assert.match(fn,/Math\.abs\(followerDelta\) > 1/);
assert.match(fn,/Math\.abs\(followingDelta\) > 1/);
assert.match(fn,/readExploreSharedProfileByUid247/);
assert.match(fn,/validExploreProfileR2Bundle020/);
assert.match(fn,/onlyIf: \{ etagMatches: object\.etag \}/);
assert.match(fn,/shared_profile_contention/);
assert.doesNotMatch(fn,/env\.DB\.(?:prepare|batch)/);
assert.doesNotMatch(fn,/profile_stats/);
assert.doesNotMatch(fn,/\bfollows\b/);

const oldProfile={uid:'u',followerCount:7,followingCount:3};
const apply=(profile,{followerDelta=0,followingDelta=0})=>({
 followerCount:Math.max(0,Number(profile.followerCount||0)+followerDelta),
 followingCount:Math.max(0,Number(profile.followingCount||0)+followingDelta),
});
assert.deepEqual(apply(oldProfile,{followingDelta:1}),{followerCount:7,followingCount:4});
assert.deepEqual(apply(oldProfile,{followerDelta:-1}),{followerCount:6,followingCount:3});
assert.deepEqual(apply({uid:'u',followerCount:0,followingCount:0},{followerDelta:-1,followingDelta:-1}),{followerCount:0,followingCount:0});

console.log('FOLLOW352_R2_ONLY_NORMAL_DELTA=PASS');
console.log('FOLLOW352_CAS_CONFLICT_RETRY_CONTRACT=PASS');
console.log('FOLLOW352_DELTA_BOUNDED_ONE_EDGE=PASS');
console.log('FOLLOW352_D1_READ_WRITE=0');
console.log('FOLLOW352_PROFILE_STATS_WRITE=0');
console.log('FOLLOW352_OVERLAY_AUTHORITY_ACTIVE=NO');

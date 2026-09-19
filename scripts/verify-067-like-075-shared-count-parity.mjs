import { readFileSync } from 'node:fs';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER;
if (!workerPath) throw new Error('SORIDRAW_GENERATED_WORKER is required');

const worker = readFileSync(workerPath, 'utf8');
const fail = (message) => { throw new Error('[067] ' + message); };
const assert = (condition, message) => { if (!condition) fail(message); };

const start = worker.indexOf('async function processExploreLikeUserQueueWave075(');
const end = worker.indexOf('// SORIDRAW_LIKED_TRACK_PUBLIC_PROFILE_JOIN_056_20260915', start);
assert(start >= 0 && end > start, '075 function boundary missing');
const wave = worker.slice(start, end);

assert(wave.includes('SORIDRAW_LIKE_075_SHARED_COUNT_PARITY_067_20260919'), '067 marker missing from active 075 path');
assert(wave.includes('patchExploreFeedR2Like044(env, trackId, likeCount)'), 'local feed patch missing');
assert(wave.includes('patchExploreProfileR2Like044(env, ownerUid, trackId, likeCount)'), 'local profile patch missing');
assert(wave.includes('patchSharedFeedLikeCounts065(env, sharedRows067)'), 'shared feed/card patch missing');

const localAt = wave.indexOf('patchExploreFeedR2Like044(env, trackId, likeCount)');
const sharedAt = wave.indexOf('patchSharedFeedLikeCounts065(env, sharedRows067)');
const returnAt = wave.lastIndexOf('return {');
assert(localAt >= 0 && sharedAt > localAt && returnAt > sharedAt, 'shared patch ordering is wrong');

const markerAt = wave.indexOf('SORIDRAW_LIKE_075_SHARED_COUNT_PARITY_067_20260919');
const added = wave.slice(markerAt, returnAt);
assert(!/env\.DB|\.prepare\s*\(|\.batch\s*\(/.test(added), '067 adds D1 work');
assert(!added.includes('mirrorExploreSharedFeeds059'), '067 performs whole-feed mirror/rebuild');

const helperStart = worker.indexOf('async function patchSharedFeedLikeCounts065(');
const helperEnd = worker.indexOf('async function processExploreLikeBatches035Core065', helperStart);
assert(helperStart >= 0 && helperEnd > helperStart, '065 shared helper missing');
const helper = worker.slice(helperStart, helperEnd);
assert(helper.includes("for (const sort of ['latest', 'popular'])"), 'shared helper does not patch both latest and popular');
assert(helper.includes('patchSharedTrackCard062(env, row.trackId, { likeCount: row.likeCount })'), 'shared track-card patch missing');
assert(!/env\.DB|\.prepare\s*\(/.test(helper), 'shared helper unexpectedly accesses D1');

const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));
assert(manifest.patches.includes('067-like-075-shared-count-parity.mjs'), '067 release patch missing from manifest');

console.log('LIKE_075_SHARED_COUNT_PARITY_067=PASS');
console.log('ACTIVE_PATH=075');
console.log('SHARED_LATEST_PATCH=TARGETED');
console.log('SHARED_POPULAR_PATCH=TARGETED');
console.log('SHARED_TRACK_CARD_PATCH=TARGETED');
console.log('EXTRA_D1_READ_WRITE=0');
console.log('WHOLE_FEED_REBUILD=false');

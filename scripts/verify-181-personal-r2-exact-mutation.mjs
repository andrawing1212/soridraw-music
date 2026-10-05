import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// App181: a 5->10 accepted same-UID batch must not leave an exact personal
// catalog at exactLikeCount156=5. A legacy partial catalog stays partial.
const worker = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');
const start = worker.indexOf('async function syncExploreLikeR2AfterBatch074(');
const end = worker.indexOf('\n}', start);
assert.ok(start >= 0 && end > start, 'personal R2 writer missing');
const source = worker.slice(start, end + 2);
assert.match(source, /SORIDRAW_PERSONAL_LIKE_EXACT_COUNT_COHERENCE_181_20260924/);
assert.match(source, /previousExact \? \{ exactLikeCount156: liked.size \}/);
assert.doesNotMatch(source, /likesComplete\s*:\s*true/);

const ctx = {
  console, Date, Map, Set, Number, String, Object, Array, JSON,
  EXPLORE_LIKE_R2_TRACK_ORDER_LIMIT_074: 128,
  exploreSharedLikesKey061: uid => 'private/' + uid,
  compareLikeOrder074: (a, b) =>
    a.at !== b.at ? (a.at > b.at ? 1 : -1) :
      String(a.batchId).localeCompare(String(b.batchId)),
};
vm.runInNewContext(source + '\nthis.sync = syncExploreLikeR2AfterBatch074;', ctx, { timeout: 1000 });
let etagSequence = 0;
const bucketFrom = initial => {
  let data = structuredClone(initial);
  let etag = 'etag-' + (++etagSequence);
  let writes = 0;
  return {
    read: () => structuredClone(data),
    writes: () => writes,
    get: async () => ({
      etag,
      text: async () => JSON.stringify(data),
    }),
    put: async (_key, serialized, options) => {
      assert.equal(options.onlyIf.etagMatches, etag);
      data = JSON.parse(serialized);
      etag = 'etag-' + (++etagSequence);
      writes += 1;
      return { etag };
    },
  };
};
const original = {
  schemaVersion: 1, uid: 'A', likedTrackIds: ['1', '2', '3', '4', '5'],
  canonicalComplete156: true, canonicalSource156: 'canonical-exact-baseline',
  exactLikeCount156: 5,
};
const bucket = bucketFrom(original);
const env = { PROFILE_MEDIA: bucket };
const additions = [6, 7, 8, 9, 10].map(i => ({trackId:String(i),liked:true}));
const accepted = await ctx.sync(env, 'A', additions, 1000, 'accepted-1');
assert.equal(accepted.ok, true);
assert.deepEqual(bucket.read().likedTrackIds.sort(), Array.from({length:10},(_,i)=>String(i+1)).sort());
assert.equal(bucket.read().exactLikeCount156, 10, 'accepted 5->10 retains exact metadata');
assert.equal(bucket.read().canonicalComplete156, true);
assert.equal(bucket.writes(), 1);
const removals = [6, 7, 8, 9, 10].map(i => ({trackId:String(i),liked:false}));
const removed = await ctx.sync(env, 'A', removals, 2000, 'accepted-2');
assert.equal(removed.ok, true);
assert.equal(bucket.read().likedTrackIds.length, 5);
assert.equal(bucket.read().exactLikeCount156, 5);
assert.equal(bucket.writes(), 2);
const partial = bucketFrom({
  ...original, canonicalComplete156: false,
  exactLikeCount156: null,
});
const partialResult = await ctx.sync({PROFILE_MEDIA:partial}, 'A', additions, 1000, 'accepted-1');
assert.equal(partialResult.ok, true);
assert.equal(partial.read().canonicalComplete156, false, 'do not promote partial history');
assert.equal(partial.read().exactLikeCount156, null);
const corrupted = bucketFrom({ ...original, exactLikeCount156: 4 });
await ctx.sync({PROFILE_MEDIA:corrupted}, 'A', additions, 1000, 'accepted-1');
assert.equal(corrupted.read().canonicalComplete156, true);
assert.equal(corrupted.read().exactLikeCount156, 4, 'invalid historical exact state must not be upgraded');
const replay = await ctx.sync(env, 'A', additions, 1000, 'accepted-1');
assert.equal(replay.ok, false);
assert.equal(replay.repairNeeded, true);
assert.equal(bucket.read().exactLikeCount156, 5, 'older ACK must not overwrite newer exact state');
console.log('APP181_PERSONAL_R2_ACCEPTED_5_TO_10_TO_5=PASS');
console.log('APP181_PARTIAL_CATALOG_NEVER_PROMOTED=PASS');
console.log('APP181_STALE_ACK_CANNOT_REWIND_COUNT=PASS');
console.log('APP181_EXTRA_D1_READ_WRITE=0');

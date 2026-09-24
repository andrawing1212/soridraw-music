import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');
const normalizeStart = source.indexOf('function normalizeSharedLikeRows065(');
const normalizeEnd = source.indexOf('\n}', normalizeStart) + 2;
const retryStart = source.indexOf('// SORIDRAW_PUBLIC_LIKE_DURABLE_RETRY_190_20260924');
const retryEnd = source.indexOf('\n__name(processExploreLikeBatches035', retryStart);
assert.ok(normalizeStart >= 0 && retryStart >= 0 && retryEnd > retryStart, 'production retry runtime missing');
const runtime = source.slice(normalizeStart, normalizeEnd) + '\n' + source.slice(retryStart, retryEnd);

class Bucket {
  constructor() { this.values = new Map(); this.version = 0; }
  async get(key) {
    const entry = this.values.get(key);
    return entry ? { etag: entry.etag, text: async () => entry.text } : null;
  }
  async put(key, text, options = {}) {
    const old = this.values.get(key);
    const only = options.onlyIf || {};
    if (only.etagMatches && old?.etag !== only.etagMatches) return null;
    if (only.etagDoesNotMatch === '*' && old) return null;
    const entry = { text, etag: `e${++this.version}` };
    this.values.set(key, entry);
    return entry;
  }
  async delete(key) { this.values.delete(key); }
}

let changes = [];
let failures = 0;
let canonicalLikeCount = 0;
let sharedLikeCount = 0;
let profileLikeCount = 0;
const api = new Function('processExploreLikeBatches035Core065', 'patchSharedFeedLikeCounts065', 'patchExploreVisibleProfiles056',
  runtime + '\nreturn { processExploreLikeBatches035, EXPLORE_PUBLIC_LIKE_RETRY_KEY_190 };')(
  async () => changes.length ? { changedTracks: 1, publicProjectionDetail: { changedItems: changes } } : { skipped: true, reason: 'idle' },
  async (_env, rows) => {
    if (failures > 0) { failures -= 1; throw new Error('synthetic R2 outage'); }
    sharedLikeCount = rows.at(-1)?.likeCount;
    return { rows: rows.length, changedFeeds: 2 };
  },
  async (_env, rows) => { profileLikeCount = rows.at(-1)?.likeCount; return 1; },
);
const bucket = new Bucket();
const env = { PROFILE_MEDIA: bucket, DB: new Proxy({}, { get() { throw new Error('D1 must stay R0 in retry publication'); } }) };

changes = [{ trackId: 'synthetic-issue-112', ownerUid: 'owner-a', likeCount: 1 }];
canonicalLikeCount = 1;
failures = 3;
const failed = await api.processExploreLikeBatches035(env, 1);
assert.equal(failed.sharedLikeRetry190.deferred, true);
assert.ok(await bucket.get(api.EXPLORE_PUBLIC_LIKE_RETRY_KEY_190), 'canonical=1/shared=0 failure must remain durable');
assert.equal(canonicalLikeCount, 1);
assert.equal(sharedLikeCount, 0, 'synthetic outage must reproduce canonical=1/shared=0');

changes = [];
failures = 0;
const retried = await api.processExploreLikeBatches035(env, 2);
assert.equal(retried.sharedLikeRetry190.drained, true, 'idle follow-up must converge the saved changed row');
assert.equal(await bucket.get(api.EXPLORE_PUBLIC_LIKE_RETRY_KEY_190), null);
assert.equal(sharedLikeCount, 1, 'idle retry must publish the canonical final count');
assert.equal(profileLikeCount, 1, 'idle retry must patch the public profile projection');

changes = [{ trackId: 'synthetic-issue-112', ownerUid: 'owner-a', likeCount: 0 }];
canonicalLikeCount = 0;
const unlike = await api.processExploreLikeBatches035(env, 3);
assert.equal(unlike.sharedLikeRetry190.drained, true, 'unlike must use the same changed-only path');
assert.equal(await bucket.get(api.EXPLORE_PUBLIC_LIKE_RETRY_KEY_190), null);
assert.equal(sharedLikeCount, 0);
assert.equal(profileLikeCount, 0);

assert.doesNotMatch(runtime, /env\?*\.DB|env\.DB|\.prepare\s*\(|\.batch\s*\(/);
assert.match(runtime, /EXPLORE_PUBLIC_LIKE_RETRY_LIMIT_190 = 3/);
console.log('ISSUE112_CANONICAL_1_SHARED_0_FAILURE_REPRODUCED=PASS');
console.log('ISSUE112_IDLE_DURABLE_RETRY_CONVERGENCE=PASS');
console.log('ISSUE112_LIKE_UNLIKE_CHANGED_ONLY=PASS');
console.log('ISSUE112_RETRY_D1_R0=PASS');

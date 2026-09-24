import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

// Invoke the real request implementation: this verifies the three diagnostic
// classes without ever calling the live Worker or touching a user's account.
const likeSource = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const followSource = readFileSync('src/services/exploreSocialSnapshotService.ts', 'utf8');
const start = likeSource.indexOf('const requestPersonalLikeBaseline127 = async (');
const end = likeSource.indexOf('// One-time per user migration', start);
assert.ok(start > 0 && end > start, 'production personal snapshot request missing');
const compiled = (await transform(likeSource.slice(start, end), {
  loader: 'ts', format: 'cjs', target: 'es2022',
})).code;

const run = async (repair, settlement, status = 200) => {
  const records = [];
  const calls = [];
  const fakeResponse = {
    ok: status === 200, status,
    json: async () => ({ ok: true, data: {
      likedTrackIds: ['track-1'], likesComplete: true,
      exactLikeCount: 1, freshCanonicalSettlement: true,
    } }),
  };
  const context = {
    EXPLORE_API_BASE: 'https://preview.invalid',
    buildAuthHeaders: async () => ({}),
    recordCloudflareResponse: (...args) => records.push(args),
    fetch: async (url, opts) => { calls.push({ url, opts }); return fakeResponse; },
  };
  const maker = new Function(...Object.keys(context),
    compiled + '\nreturn requestPersonalLikeBaseline127;');
  const request = maker(...Object.values(context));
  if (status === 200) await request({ uid: 'test-uid' }, repair, settlement);
  else await assert.rejects(request({ uid: 'test-uid' }, repair, settlement), /unavailable/);
  assert.equal(calls.length, 1, 'no extra network requests');
  assert.equal(records.length, 1, 'one metric record for exactly one request');
  assert.equal(records[0][1], '/v1/me/social-snapshot', 'cost path key unchanged');
  assert.equal(calls[0].opts.method, 'GET', 'read-only request preserved');
  assert.equal(records[0][2].outcome.includes('test-uid'), false, 'never expose UID');
  return { url: calls[0].url, reason: records[0][2].outcome };
};

const recovery = await run(true, false);
assert.ok(recovery.url.endsWith('?__soridraw_personal_repair=182'));
assert.equal(recovery.reason, 'FULL 200 · PERSONAL REPAIR 182');
const settlement = await run(false, true);
assert.ok(settlement.url.endsWith('?__soridraw_personal_settlement=189'));
assert.equal(settlement.reason, 'FULL 200 · PERSONAL SETTLEMENT 189');
const healthy = await run(false, false);
assert.ok(healthy.url.endsWith('/v1/me/social-snapshot'));
assert.equal(healthy.reason, 'FULL 200 · PERSONAL BASELINE');
assert.equal((await run(true, false, 503)).reason, 'HTTP 503 · PERSONAL REPAIR 182');
assert.match(followSource, /recordCloudflareResponse\(response, SOCIAL_SNAPSHOT_PATH, \{[\s\S]*?SOCIAL CACHE MISS/);
assert.match(followSource, /if \(cached\) \{[\s\S]*?recordCloudflareLocalCacheHit\(SOCIAL_SNAPSHOT_PATH/);
console.log('APP198_PERSONAL_182_189_AND_BASELINE_DIAGNOSTIC=PASS');
console.log('APP198_FOLLOW_CACHE_MISS_DISTINCT_AND_LOCAL_HIT_PROTECTED=PASS');
console.log('APP198_NO_EXTRA_REQUEST_OR_PERSONAL_IDENTIFIER=PASS');

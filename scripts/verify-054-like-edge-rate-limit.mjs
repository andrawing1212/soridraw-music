import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const patchPath = 'cloudflare/explore-worker/patches/054-explore-like-edge-rate-limit.mjs';
const manifestPath = 'cloudflare/explore-worker/release-patches.json';
const wranglerPath = 'cloudflare/explore-worker/canonical/wrangler.preview.jsonc';
const patch = readFileSync(patchPath, 'utf8');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const wrangler = JSON.parse(readFileSync(wranglerPath, 'utf8'));

assert.match(patch, /SORIDRAW_EXPLORE_LIKE_EDGE_RATE_LIMIT_054_20260915/);
assert.match(patch, /enforceExploreLikeBatchEdgeRateLimit054/);
assert.match(patch, /env\?\.LIKE_RATE_LIMITER/);
assert.match(patch, /\.limit\(\{ key: 'like:' \+ normalizedUid \}\)/);
assert.match(patch, /enforceExploreLikeBatchEdgeRateLimit054\(env, authContext\.uid\)/);
assert.match(patch, /finalBatch\.includes\('enforceExploreLikeBatchRateLimit034\('/);

const edgeHelperStart = patch.indexOf('async function enforceExploreLikeBatchEdgeRateLimit054');
const edgeHelperEnd = patch.indexOf('`;', edgeHelperStart);
assert.ok(edgeHelperStart >= 0 && edgeHelperEnd > edgeHelperStart, '054 edge helper source missing');
const edgeHelper = patch.slice(edgeHelperStart, edgeHelperEnd);
for (const forbidden of ['api_rate_limits', 'exploreRateDb031(', 'RATE_DB', 'env.DB', 'env?.DB']) {
  assert.ok(!edgeHelper.includes(forbidden), `054 edge helper must not use D1: ${forbidden}`);
}

assert.ok(Array.isArray(manifest.patches));
const p053 = manifest.patches.indexOf('053-liked-track-schema-repair.mjs');
const p054 = manifest.patches.indexOf('054-explore-like-edge-rate-limit.mjs');
const p043 = manifest.patches.indexOf('043-publication-targeted-r2-hotpath.mjs');
assert.ok(p053 >= 0 && p054 === p053 + 1 && p043 === p054 + 1, '054 must run after 053 and before publication patches');
assert.equal(manifest.patches.at(-1), '051-publication-write-returning.mjs', 'protected publication patch 051 must remain final');

const limiter = Array.isArray(wrangler.ratelimits)
  ? wrangler.ratelimits.find((row) => row?.name === 'LIKE_RATE_LIMITER')
  : null;
assert.ok(limiter, 'PREVIEW wrangler must bind LIKE_RATE_LIMITER');
assert.equal(String(limiter.namespace_id), '91054');
assert.equal(Number(limiter.simple?.limit), 60);
assert.equal(Number(limiter.simple?.period), 60);

const generatedPath = process.env.SORIDRAW_GENERATED_WORKER;
if (generatedPath) {
  const worker = readFileSync(generatedPath, 'utf8');
  assert.match(worker, /SORIDRAW_EXPLORE_LIKE_EDGE_RATE_LIMIT_054_20260915/);
  const handlerStart = worker.indexOf('async function handleLikeBatch034(');
  assert.ok(handlerStart >= 0, 'generated Worker missing handleLikeBatch034');
  const handlerRegion = worker.slice(handlerStart, handlerStart + 9000);
  assert.match(handlerRegion, /enforceExploreLikeBatchEdgeRateLimit054\(env, authContext\.uid\)/);
  assert.doesNotMatch(handlerRegion, /enforceExploreLikeBatchRateLimit034\(/);
  assert.doesNotMatch(handlerRegion, /api_rate_limits/);
  assert.match(handlerRegion, /enqueueExploreLikeBatch035\(/, 'normal changed-state batch must still enqueue one durable mutation batch');
  assert.match(handlerRegion, /effectiveMutations/, 'same-state NOOP filtering must remain');

  const edgeStart = worker.indexOf('async function enforceExploreLikeBatchEdgeRateLimit054(');
  assert.ok(edgeStart >= 0, 'generated Worker missing edge limiter helper');
  const edgeRegion = worker.slice(edgeStart, edgeStart + 1800);
  assert.match(edgeRegion, /LIKE_RATE_LIMITER/);
  assert.match(edgeRegion, /\.limit\(\{ key: 'like:' \+ normalizedUid \}\)/);
  assert.doesNotMatch(edgeRegion, /api_rate_limits|RATE_DB|exploreRateDb031|\.DB\.prepare/);
}

console.log('VERIFY_054_LIKE_EDGE_RATE_LIMIT=PASS');
console.log('NORMAL_LIKE_BATCH_EXPECTED_D1_WRITE_ROWS=1');
console.log('NORMAL_LIKE_BATCH_RATE_LIMIT_D1_WRITE_ROWS=0');
console.log('ABUSE_GUARD=CLOUDFLARE_RATE_LIMIT_BINDING');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Test the actual PREVIEW Worker helper and reply wrapper with real Request/
// Response semantics. Do not mock the decision logic being tested.
const source = readFileSync('cloudflare/explore-worker/canonical/preview-entry.js', 'utf8');
const marker = 'SORIDRAW_BOUND_CANONICAL_LIKE_PROOF_417_20261009';
assert.ok(source.includes(marker), '417 verified canonical protocol is missing');
const getRange = (from, to) => {
  const first = source.indexOf(from);
  const last = source.indexOf(to, first + from.length);
  assert.ok(first >= 0 && last > first, '417 source range missing: ' + from);
  return source.slice(first, last);
};
const helper = getRange(
  'async function verifyQueuedLikeCanonical417(',
  'async function ensureQueuedLikeBatchScheduled103(',
);
const wrapper = getRange(
  'async function ensureQueuedLikeBatchScheduled103(',
  '// SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_ACTIVE_RECOVERY_194_20260924',
);
assert.match(wrapper, /const canonicalProof = await verifyQueuedLikeCanonical417/);
assert.match(wrapper, /canonicalD1: 'settled'/);
assert.match(wrapper, /X-SORIDRAW-D1-Read-Queries/);
assert.match(wrapper, /schedule\?\.newlyScheduled === true && schedule\?\.settled === true/);
assert.match(source, /ensureQueuedLikeBatchScheduled103\(request, env, response, ctx\)/);
const service = readFileSync('src/services/exploreLikeService.ts', 'utf8');
assert.match(service, /payload\?\.data\?\.canonicalD1 === 'settled'/);
assert.match(service, /delete snapshotPending127\[pending\.trackId\]/);

const makeProof = new Function('baseWorker', helper + '\nreturn verifyQueuedLikeCanonical417;');
const makeWrapper = new Function(
  'scheduleExploreLikeAggregate103',
  'verifyQueuedLikeCanonical417',
  'EXPLORE_LIKE_BATCH_ROUTE_103',
  wrapper + '\nreturn ensureQueuedLikeBatchScheduled103;',
);

const verifyScenario = async ({ liked, canonicalIds, schedule, ready = true, responseStatus = 200, many = false }) => {
  const results = many
    ? Array.from({ length: 21 }, (_, i) => ({ trackId: 'song-' + i, liked, status: 'legacy-queued' }))
    : [{ trackId: 'song-A', liked, status: 'legacy-queued' }];
  let queryCount = 0;
  const backend = {
    fetch: async (request) => {
      queryCount++;
      assert.equal(new URL(request.url).pathname, '/v1/me/likes-confirmed');
      assert.equal(request.headers.get('Authorization'), 'Bearer fake-test-token');
      return new Response(JSON.stringify({
        ok: responseStatus === 200,
        data: { likedTrackIds: canonicalIds },
      }), {
        status: responseStatus,
        headers: { 'X-SORIDRAW-D1-Read': '2', 'X-SORIDRAW-D1-Read-Queries': '1' },
      });
    },
  };
  const actualProof = makeProof(backend);
  const run = makeWrapper(async () => schedule, actualProof, '/v1/me/likes/batch');
  const request = new Request('https://preview.soridraw.com/v1/me/likes/batch', {
    method: 'POST',
    headers: { Authorization: 'Bearer fake-test-token' },
  });
  const payload = {
    ok: true, data: {
      queued: true, canonicalD1: 'queued',
      personalLikeSnapshot: ready ? 'changed-track-r2' : 'repair-needed',
      results,
    },
  };
  const reply = new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'X-SORIDRAW-D1-Write': '1', 'X-SORIDRAW-D1-Write-Queries': '1' },
  });
  const response = await run(request, {}, reply, {});
  const result = await response.json();
  return {
    settled: result.data.canonicalD1 === 'settled',
    proof: result.data.canonicalProof,
    queryCount,
    readCount: Number(response.headers.get('X-SORIDRAW-D1-Read') || 0),
    readQueries: Number(response.headers.get('X-SORIDRAW-D1-Read-Queries') || 0),
    writes: Number(response.headers.get('X-SORIDRAW-D1-Write') || 0),
  };
};

for (const [label, args] of [
  ['LIKE', { liked: true, canonicalIds: ['song-A'] }],
  ['UNLIKE', { liked: false, canonicalIds: [] }],
]) {
  const result = await verifyScenario({
    ...args, schedule: { newlyScheduled: true, settled: true },
  });
  assert.equal(result.settled, true, label + ' exact canonical proof');
  assert.equal(result.proof, 'bounded-membership-after-queue-417');
  assert.equal(result.queryCount, 1, label + ' bounded changed-track read');
  assert.equal(result.readCount, 2, label + ' must report real D1 rows');
  assert.equal(result.readQueries, 1, label + ' must report real D1 query');
  assert.equal(result.writes, 1, label + ' existing W1 intake must remain');
}
for (const [label, args] of [
  ['MISMATCH', { liked: true, canonicalIds: [] }],
  ['QUEUE_RUNNING', { liked: true, canonicalIds: ['song-A'], schedule: { newlyScheduled: true, settled: false } }],
  ['JOINED_WINDOW', { liked: true, canonicalIds: ['song-A'], schedule: { newlyScheduled: false, settled: true } }],
  ['D1_PENDING', { liked: true, canonicalIds: ['song-A'], responseStatus: 409 }],
  ['CACHE_PARTIAL', { liked: true, canonicalIds: ['song-A'], ready: false }],
  ['TOO_MANY_IDS', { liked: true, canonicalIds: [], many: true }],
]) {
  const result = await verifyScenario({
    ...args,
    schedule: args.schedule || { newlyScheduled: true, settled: true },
  });
  assert.equal(result.settled, false, label + ' cannot claim canonical authority');
  assert.equal(result.proof, undefined, label + ' cannot fabricate receipt');
  assert.equal(result.writes, 1, label + ' queued intake preserved');
  if (['QUEUE_RUNNING', 'JOINED_WINDOW', 'CACHE_PARTIAL', 'TOO_MANY_IDS'].includes(label)) {
    assert.equal(result.queryCount, 0, label + ' unnecessary canonical query');
  }
}
console.log('417_QUEUED_LIKE_UNLIKE_CANONICAL_PROOF=PASS');
console.log('417_UNCERTAIN_R2_AND_QUEUE_FAIL_CLOSED=PASS');
console.log('417_PHYSICAL_D1_DIAGNOSTICS_VISIBLE=PASS');

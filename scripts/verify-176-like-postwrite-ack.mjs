import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER || 'cloudflare/explore-worker/canonical/preview-worker.js';
const worker = readFileSync(workerPath, 'utf8');
const client = readFileSync('src/services/exploreLikeService.ts', 'utf8');

function functionRange(source, name) {
  const start = source.indexOf('async function ' + name + '(');
  assert.ok(start >= 0, name + ' missing');
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i], next = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && next === '/') { comment = ''; i += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && next === '/') { comment = 'line'; i += 1; continue; }
    if (c === '/' && next === '*') { comment = 'block'; i += 1; continue; }
    if ('"\'\`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(name + ' unterminated');
}

const batch = functionRange(worker, 'handleLikeBatch034');
const legacy = batch.slice(batch.indexOf('SORIDRAW_LEGACY_LIKE_DIRECT_NORMALIZE_185_20260922'));
assert.ok(legacy.includes('SORIDRAW_LEGACY_LIKE_POSTWRITE_ACK_186_20260922'));
assert.ok(legacy.includes("canonicalD1: 'settled'"));
assert.ok(legacy.includes('personalLikeSnapshot: personalLikeSnapshot185'));
assert.ok(legacy.includes("personalLikeProtocol: 'legacy-direct-186-postwrite-ack'"));
assert.ok(legacy.includes('syncExploreLikeR2AfterBatch074('), 'changed-track R2 catalog update missing');
assert.ok(legacy.includes("personalLikeSnapshot185 = 'repair-needed'"), 'repair-needed state missing');
assert.ok(legacy.includes("if (exactFinalized185) personalLikeSnapshot185 = 'settled'"), 'exact incremental catalog settlement missing');
assert.ok(!legacy.includes("throwApi('LIKE_PUBLICATION_RETRY_REQUIRED'"), 'post-write publication still produces retry HTTP');
assert.ok(!legacy.includes('SELECT l.track_id FROM likes l JOIN tracks t'), 'mutation hotpath still full-scans personal likes');
assert.ok(!legacy.includes('rebuildExploreLikeR2Bundle(env, authContext.uid)'), 'mutation hotpath still synchronously rebuilds full personal catalog');
assert.ok(!legacy.includes('enqueueExploreLikeBatch035(env, authContext.uid'), 'legacy deferred intake returned');

assert.match(
  client,
  /const canonicalLikeSettled127 =\s*\n\s*payload\?\.data\?\.canonicalD1 === 'settled' \|\|\s*\n\s*canBroadcastExploreLikeSnapshot127/,
  'client must treat canonical D1 ACK as final even if derived R2 publication needs repair',
);
assert.ok(client.includes('await publishConfirmedLikeSignal127(uid, acceptedForSignal127);'),
  'successful canonical batch must notify other signed-in devices');
assert.ok(client.includes("databaseRef(realtimeDb, `userSync/${uid}/exploreLike`)"),
  'account-scoped RTDB changed-track signal missing');

console.log('APP136_CANONICAL_D1_ACK_SURVIVES_R2_FAILURE=PASS');
console.log('APP136_LIKE_MUTATION_FULL_PERSONAL_SCAN=0');
console.log('APP136_CROSS_DEVICE_CHANGED_TRACK_SIGNAL_AFTER_CANONICAL_ACK=PASS');

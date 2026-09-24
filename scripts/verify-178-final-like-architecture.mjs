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
    const c = source[i], n = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && n === '/') { comment = ''; i += 1; } continue; }
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = ''; continue; }
    if (c === '/' && n === '/') { comment = 'line'; i += 1; continue; }
    if (c === '/' && n === '*') { comment = 'block'; i += 1; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(name + ' unterminated');
}

const batch = functionRange(worker, 'handleLikeBatch034');
assert.match(batch, /SORIDRAW_FINAL_LIKE_W1_HYBRID_188_20260922/);
assert.match(batch, /enqueueExploreLikeBatch035\(env, authContext\.uid, mutations, receivedAt\)/);
assert.match(batch, /canonicalD1: 'queued'/);
assert.match(batch, /personalLikeProtocol: 'w1-queue-changed-track-188'/);
assert.match(batch, /syncExploreLikeR2AfterBatch074\(/);
assert.doesNotMatch(batch, /adjustExploreLikeCounterDelta\(/);
assert.doesNotMatch(batch, /getPublicTrackForWrite\(/);
assert.doesNotMatch(batch, /patchSharedFeedLikeCounts065\(/);
assert.doesNotMatch(batch, /queue: 'direct-legacy-185'/);
assert.doesNotMatch(batch, /readLikeCutoverState162\(/);

const enqueue = functionRange(worker, 'enqueueExploreLikeBatch035');
assert.match(enqueue, /INSERT OR IGNORE INTO explore_like_batches_069/);
assert.doesNotMatch(enqueue, /FROM likes/);
assert.doesNotMatch(enqueue, /JOIN likes/);

assert.match(client, /const EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 30_000/);
assert.match(client, /await publishConfirmedLikeSignal127\(uid, acceptedForSignal127\)/);
assert.match(client, /const baselineReady127 = baselineCompleted127\.has\(user\.uid\)/);
assert.match(client, /const missing = baselineReady127 \? \[\] : normalized\.filter/);
assert.match(client, /return !cache\.has\(trackId\);/);
assert.match(client, /Page\/profile navigation itself must never create a server read\/write/);

console.log('FINAL_LIKE_W1_QUEUE_INTAKE=PASS');
console.log('FINAL_LIKE_INTERACTIVE_DIRECT_D1_SETTLEMENT=0');
console.log('FINAL_LIKE_NORMAL_LOCAL_CATALOG_REENTRY_D1_MEMBERSHIP=0_CONTRACT');
console.log('FINAL_LIKE_CHANGED_TRACK_ACCOUNT_SIGNAL=PASS');

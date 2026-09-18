import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER || 'cloudflare/explore-worker/canonical/preview-worker.js';
const worker = readFileSync(workerPath, 'utf8');
const migration069 = readFileSync('cloudflare/explore-worker/migrations/20260912_01_explore_like_w1_queue.sql', 'utf8');
const migration075 = readFileSync('cloudflare/explore-worker/migrations/20260913_01_explore_like_user_queue.sql', 'utf8');
const wrangler = readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc', 'utf8');

const functionText = (source, name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  assert.ok(start >= 0, `missing function: ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let comment = '';
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i];
    const n = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && n === '/') { comment = ''; i += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && n === '/') { comment = 'line'; i += 1; continue; }
    if (c === '/' && n === '*') { comment = 'block'; i += 1; continue; }
    if ('"\'`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated function: ${name}`);
};

assert.match(worker, /SORIDRAW_EXPLORE_LIKE_EDGE_RATE_LIMIT_054_20260915/);
assert.match(worker, /SORIDRAW_EXPLORE_LIKE_INTAKE_W1_HOTPATH_055_20260915/);
assert.match(wrangler, /LIKE_RATE_LIMITER/);

const handler = functionText(worker, 'handleLikeBatch034');
assert.match(handler, /enforceExploreLikeBatchEdgeRateLimit054\(env, authContext\.uid\)/, 'edge limiter must remain');
assert.match(handler, /enqueueExploreLikeBatch035\(env, authContext\.uid, effectiveMutations, receivedAt\)/, 'new intake must use W1 queue');
assert.doesNotMatch(handler, /enqueueExploreLikeUserQueue075\(/, 'new intake must not use indexed 075 queue');
assert.doesNotMatch(handler, /readExploreLikeBatchStates035\(/, 'warm intake must not restore D1 canonical reads');
assert.match(handler, /syncExploreLikeR2AfterBatch034\(env, authContext\.uid, results\)/, 'R2 account state sync must remain');

const enqueue = functionText(worker, 'enqueueExploreLikeBatch035');
assert.match(enqueue, /INSERT OR IGNORE INTO explore_like_batches_069/);
assert.match(migration069, /CREATE TABLE IF NOT EXISTS explore_like_batches_069/);
assert.match(migration069, /WITHOUT ROWID/);
assert.doesNotMatch(migration069, /CREATE\s+(?:UNIQUE\s+)?INDEX/i, '069 W1 queue must have no secondary index');

// Keep old 075 rows readable/drainable, but do not route new hot-path intake there.
assert.match(migration075, /idx_explore_like_user_queue_075_updated/);
const aggregate = functionText(worker, 'processExploreLikeBatches035');
assert.match(aggregate, /hasExploreLikeUserQueuePending075/);
assert.match(aggregate, /processExploreLikeUserQueueWave075/);

const limiter = functionText(worker, 'enforceExploreLikeBatchEdgeRateLimit054');
assert.match(limiter, /LIKE_RATE_LIMITER/);
assert.doesNotMatch(limiter, /api_rate_limits/i, 'normal abuse guard must not write D1 api_rate_limits');
assert.doesNotMatch(limiter, /\.DB\.prepare|RATE_DB|exploreRateDb031/, 'edge limiter must remain D1-free');

console.log('VERIFY_055_LIKE_INTAKE_W1=PASS');
console.log('WARM_NORMAL_LIKE_EXPECTED_D1_READ_ROWS=0');
console.log('WARM_NORMAL_LIKE_EXPECTED_D1_WRITE_ROWS=1');
console.log('NEW_INTAKE_QUEUE=explore_like_batches_069');
console.log('LEGACY_075_DRAIN_COMPAT=true');

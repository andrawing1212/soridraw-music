import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_LIKE_INTAKE_W1_HOTPATH_055_20260915';
if (source.includes(marker)) {
  console.log('[055] Explore like W1 intake hotpath already applied.');
  process.exit(0);
}

for (const required of [
  'SORIDRAW_LOCAL_FIRST_COST_HOTPATH_044_20260913',
  'SORIDRAW_EXPLORE_LIKE_EDGE_RATE_LIMIT_054_20260915',
  'enqueueExploreLikeBatch035',
  'enqueueExploreLikeUserQueue075',
  'handleLikeBatch034',
  'processExploreLikeBatches035',
  'hasExploreLikeUserQueuePending075',
  'processExploreLikeUserQueueWave075',
]) {
  if (!source.includes(required)) throw new Error(`[055] required runtime missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[055] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[055] function body missing: ${name}`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let comment = '';
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (comment === 'line') { if (char === '\n') comment = ''; continue; }
    if (comment === 'block') { if (char === '*' && next === '/') { comment = ''; index += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') { comment = 'line'; index += 1; continue; }
    if (char === '/' && next === '*') { comment = 'block'; index += 1; continue; }
    if ('"\'`'.includes(char)) { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return { start, end: index + 1, text: source.slice(start, index + 1) };
  }
  throw new Error(`[055] unterminated function: ${name}`);
};

const range = functionRange('handleLikeBatch034');
const handler = range.text;
const oldBlock = `  let queued = { batchId: '', inserted: false, queue: 'none' };
  if (effectiveMutations.length) {
    try {
      queued = await enqueueExploreLikeUserQueue075(env, authContext.uid, effectiveMutations, receivedAt);
    } catch (error) {
      const message = String(error?.message || error || '');
      if (!/no such table:\\s*explore_like_user_queue_075/i.test(message)) throw error;
      queued = await enqueueExploreLikeBatch035(env, authContext.uid, effectiveMutations, receivedAt);
    }
  }`;
const newBlock = `  // ${marker}
  // New intake uses the single-B-tree 069 queue: one warm batch => D1 R0/W1.
  // The 075 processor remains enabled below to drain already-queued legacy rows.
  let queued = { batchId: '', inserted: false, queue: 'none' };
  if (effectiveMutations.length) {
    queued = await enqueueExploreLikeBatch035(env, authContext.uid, effectiveMutations, receivedAt);
  }`;

if (!handler.includes(oldBlock)) {
  throw new Error('[055] expected 044 user-075 intake block missing; refusing unsafe rewrite');
}
const nextHandler = handler.replace(oldBlock, newBlock);
source = source.slice(0, range.start) + nextHandler + source.slice(range.end);

const finalHandler = functionRange('handleLikeBatch034').text;
if (!finalHandler.includes(marker)) throw new Error('[055] final marker missing');
if (!finalHandler.includes('await enqueueExploreLikeBatch035(env, authContext.uid, effectiveMutations, receivedAt)')) {
  throw new Error('[055] W1 069 enqueue not wired');
}
if (finalHandler.includes('enqueueExploreLikeUserQueue075(')) {
  throw new Error('[055] user-075 intake still active on hot path');
}
if (finalHandler.includes('readExploreLikeBatchStates035(')) {
  throw new Error('[055] canonical D1 intake read unexpectedly restored');
}
if (!finalHandler.includes('enforceExploreLikeBatchEdgeRateLimit054(env, authContext.uid)')) {
  throw new Error('[055] edge abuse guard missing');
}
if (!finalHandler.includes('syncExploreLikeR2AfterBatch034(env, authContext.uid, results)')) {
  throw new Error('[055] personal R2 sync missing');
}

const enqueue = functionRange('enqueueExploreLikeBatch035').text;
if (!enqueue.includes('INSERT OR IGNORE INTO explore_like_batches_069')) {
  throw new Error('[055] 069 single-B-tree queue missing');
}
const aggregate = functionRange('processExploreLikeBatches035').text;
for (const required of ['hasExploreLikeUserQueuePending075', 'processExploreLikeUserQueueWave075']) {
  if (!aggregate.includes(required)) throw new Error(`[055] legacy 075 drain compatibility missing: ${required}`);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[055] New likes use the 069 WITHOUT ROWID W1 queue; existing 075 rows remain drain-compatible.');

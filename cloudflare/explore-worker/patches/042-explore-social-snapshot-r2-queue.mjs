import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_SOCIAL_SNAPSHOT_R2_QUEUE_042_20260913';
if (source.includes(marker)) {
  console.log('[042] Explore social snapshot / R2 like queue already applied.');
  process.exit(0);
}

for (const required of [
  'SORIDRAW_EXPLORE_LIKE_REVERSAL_ORDER_041_20260912',
  'exploreLikeW1Batch040',
  'exploreCacheBucket031',
  'readExploreLikeR2Bundle',
  'rebuildExploreLikeR2Bundle',
  'readExploreFollowingR2Bundle',
  'rebuildExploreFollowingR2Bundle',
  'acquireExploreLikeProcessor035',
  'releaseExploreLikeProcessor035',
]) {
  if (!source.includes(required)) throw new Error(`[042] required runtime missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[042] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[042] function body missing: ${name}`);
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
  throw new Error(`[042] unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

const runtime = readFileSync(new URL('../runtime/social-snapshot-042.js', import.meta.url), 'utf8').trim();
const helperAt = functionRange('handleLikeBatch034').start;
source = source.slice(0, helperAt) + runtime + '\n\n' + source.slice(helperAt);

replaceFunction('enqueueExploreLikeBatch035', `async function enqueueExploreLikeBatch035(env, uid, mutations, now) {
  const next = await exploreLikeW1Batch040(uid, mutations, now);
  const bucket = exploreCacheBucket031(env);
  if (!bucket) throw new Error('Explore R2 queue binding is unavailable');
  const row = {
    schemaVersion: 1,
    batchId: next.batchId,
    userUid: String(uid || ''),
    createdAt: next.batchAt,
    mutationCount: next.payload.length,
    mutations: next.payload,
  };
  await bucket.put(exploreLikeR2QueueKey042(next.batchId), JSON.stringify(row), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: { createdAt: String(next.batchAt), mutationCount: String(next.payload.length) },
  });
  return { batchId: next.batchId, inserted: true, queue: 'r2-042' };
}`);

replaceFunction('processExploreLikeBatches035', `async function processExploreLikeBatches035(env, scheduledTime = Date.now()) {
  if (!env?.DB) return { skipped: true, reason: 'binding' };
  const now = Math.max(0, Number(scheduledTime || Date.now()));

  // R2 is checked before touching D1. With no actual likes pending, the 10-minute
  // scheduler performs zero D1 reads and zero D1 writes.
  let pending = await readExploreLikeR2QueueWave042(env, now);
  if (!pending.length) {
    const idle = { waves: 0, processedBatches: 0, insertedLikes: 0, deletedLikes: 0, changedTracks: 0, queue: 'r2-042', d1Idle: true };
    console.log('[SORIDRAW 042] like aggregate idle', JSON.stringify(idle));
    return idle;
  }

  const owner = 'like042_' + now + '_' + crypto.randomUUID();
  const acquired = await acquireExploreLikeProcessor035(env, owner, now);
  if (!acquired) return { skipped: true, reason: 'lease', queue: 'r2-042' };
  const totals = { waves: 0, processedBatches: 0, insertedLikes: 0, deletedLikes: 0, changedTracks: 0, queue: 'r2-042', d1Idle: false };
  try {
    for (let wave = 0; wave < EXPLORE_LIKE_AGGREGATE_MAX_WAVES_035; wave += 1) {
      if (!pending.length) break;
      const current = await processExploreLikeR2QueueWave042(env, pending, Date.now());
      totals.waves += 1;
      totals.processedBatches += current.processedBatches;
      totals.insertedLikes += current.insertedLikes;
      totals.deletedLikes += current.deletedLikes;
      totals.changedTracks += current.positiveTracks + current.negativeTracks;
      if (wave + 1 < EXPLORE_LIKE_AGGREGATE_MAX_WAVES_035) {
        pending = await readExploreLikeR2QueueWave042(env, now);
      }
    }
    console.log('[SORIDRAW 042] like aggregate', JSON.stringify(totals));
    return totals;
  } finally {
    await releaseExploreLikeProcessor035(env, owner).catch(() => {});
  }
}`);

const routeAnchor = `    if (url.pathname === "/v1/me/following-bundle" && request.method === "GET") {
      return await handleMyFollowingR2Bundle(request, env, cors);
    }`;
if (!source.includes(routeAnchor)) throw new Error('[042] following-bundle route anchor missing');
source = source.replace(routeAnchor, `    if (url.pathname === "/v1/me/social-snapshot" && request.method === "GET") {
      return await handleMySocialSnapshot042(request, env, cors);
    }
${routeAnchor}`, 1);

for (const required of [
  marker,
  "EXPLORE_LIKE_R2_QUEUE_PREFIX_042 = 'internal/explore/like-queue-v2/'",
  "queue: 'r2-042'",
  'readExploreLikeR2QueueWave042',
  'processExploreLikeR2QueueWave042',
  'handleMySocialSnapshot042',
  'url.pathname === "/v1/me/social-snapshot"',
  "source: 'r2-social-042'",
  'd1Idle: true',
]) {
  if (!source.includes(required)) throw new Error(`[042] verification missing: ${required}`);
}
if (functionRange('enqueueExploreLikeBatch035').text.includes('INSERT OR IGNORE INTO explore_like_batches_069')) {
  throw new Error('[042] D1 like intake queue write still active');
}
if (functionRange('processExploreLikeBatches035').text.includes('hasExploreLikeQueue069040')) {
  throw new Error('[042] scheduled aggregate still probes D1 queue on idle path');
}

writeFileSync(workerPath, source, 'utf8');
console.log('[042] R2 transient like queue + unified personal social snapshot prepared.');

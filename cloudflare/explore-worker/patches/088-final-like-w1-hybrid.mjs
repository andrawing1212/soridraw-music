import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!dir) throw new Error('[088/188] Worker directory missing');
const workerPath = join(dir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');
const marker = 'SORIDRAW_FINAL_LIKE_W1_HYBRID_188_20260922';
if (source.includes(marker)) { console.log('[088/188] already applied'); process.exit(0); }

function functionRange(name) {
  const start = source.indexOf('async function ' + name + '(');
  if (start < 0) throw new Error('[088/188] function missing: ' + name);
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
    if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error('[088/188] unterminated function: ' + name);
}

const range = functionRange('handleLikeBatch034');
const cutoverStart = range.text.indexOf('  const cutover172 = await readLikeCutoverState162(env);');
if (cutoverStart < 0) throw new Error('[088/188] app137 cutover block missing');

const prefix = range.text.slice(0, cutoverStart);
const replacement = [
  '  // ' + marker,
  '  // Final contract: 30s client batch -> one durable 069 queue row.',
  '  // No per-track likes/track_stats direct settlement on the interactive request.',
  '  // Personal R2 is changed-track best-effort only; it may never force a D1 scan or replay.',
  '  await assertLegacyLikeIntakeOpen165(env);',
  '  const results = mutations.map((mutation) => ({',
  '    trackId: mutation.trackId,',
  '    liked: mutation.liked,',
  "    status: 'legacy-queued',",
  '  }));',
  "  let queued = { batchId: '', inserted: false, queue: 'none' };",
  '  if (mutations.length) {',
  '    queued = await enqueueExploreLikeBatch035(env, authContext.uid, mutations, receivedAt);',
  '  }',
  "  let personalR2 = { ok: false, repairNeeded: true, reason: 'not-attempted' };",
  '  if (mutations.length && queued.batchId) {',
  '    try {',
  '      personalR2 = await syncExploreLikeR2AfterBatch074(env, authContext.uid, results, receivedAt, queued.batchId);',
  '    } catch (error) {',
  "      console.warn('[188] queued like accepted; personal R2 delta deferred:', String(error?.message || error || 'unknown'));",
  '    }',
  '  }',
  '  return json({',
  '    ok: true,',
  '    data: {',
  '      results,',
  '      queued: Boolean(mutations.length),',
  '      batchId: queued.batchId || null,',
  "      queue: queued.queue || '069',",
  "      canonicalD1: 'queued',",
  "      personalLikeSnapshot: personalR2?.ok ? 'changed-track-r2' : 'repair-needed',",
  "      personalLikeProtocol: 'w1-queue-changed-track-188',",
  "      publicLikePublication: 'background-targeted-aggregate',",
  '    },',
  '  }, 200, cors);',
  '}',
].join('\n');

const next = prefix + replacement;
for (const required of [marker, 'enqueueExploreLikeBatch035(env, authContext.uid, mutations, receivedAt)', "queue: queued.queue || '069'", "canonicalD1: 'queued'", "personalLikeProtocol: 'w1-queue-changed-track-188'", 'syncExploreLikeR2AfterBatch074(']) {
  if (!next.includes(required)) throw new Error('[088/188] required contract missing: ' + required);
}
for (const forbidden of ['adjustExploreLikeCounterDelta(env,', 'getPublicTrackForWrite(env, mutation.trackId)', 'patchSharedFeedLikeCounts065(env, sharedRows185)', "queue: 'direct-legacy-185'", "canonicalD1: 'settled'", 'readLikeCutoverState162(env)']) {
  if (next.includes(forbidden)) throw new Error('[088/188] direct-settlement residue remains: ' + forbidden);
}

source = source.slice(0, range.start) + next + source.slice(range.end);
writeFileSync(workerPath, source, 'utf8');
console.log('[088/188] final like contract materialized: W1 069 intake + changed-track R2 only.');

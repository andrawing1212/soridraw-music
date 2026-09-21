import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required');
const path = join(remoteDir, 'worker.js');
let source = readFileSync(path, 'utf8');
const marker = 'SORIDRAW_BATCH_LIKE_FINAL_CUTOVER_FREEZE_169_20260921';
if (source.includes(marker)) {
  console.log('[081/169] batch final cutover freeze already applied.');
  process.exit(0);
}
for (const needed of [
  'SORIDRAW_DIRECT_LIKE_ATOMIC_D1_BATCH_168_20260921',
  'SORIDRAW_LIKE_LEGACY_INTAKE_DRAIN_BARRIER_165_20260921',
  'assertLegacyLikeWriterOpen163',
]) {
  if (!source.includes(needed)) throw new Error('[081/169] required predecessor missing: ' + needed);
}
const start = source.indexOf('async function handleLikeBatch034(');
const end = source.indexOf('\n}', start);
if (start < 0 || end <= start) throw new Error('[081/169] batch handler missing');
const body = source.slice(start, end + 2);
const anchor = '  await assertLegacyLikeIntakeOpen165(env);\n';
if (body.split(anchor).length !== 2) throw new Error('[081/169] batch intake anchor changed');
if (!body.includes('enqueueExploreLikeBatch035(')) throw new Error('[081/169] batch intake owner changed');
const patched = body.replace(anchor,
  anchor + '  // ' + marker + '\n' +
  "  await assertLegacyLikeWriterOpen163(env, 'batch-like-intake');\n");
if (patched.indexOf("assertLegacyLikeWriterOpen163(env, 'batch-like-intake')") >
    patched.indexOf('enqueueExploreLikeBatch035(')) {
  throw new Error('[081/169] final marker guard must precede queue write');
}
source = source.slice(0, start) + patched + source.slice(end + 2);
writeFileSync(path, source, 'utf8');
console.log('[081/169] Batch cannot enqueue legacy work after final 162 overlay cutover; shared D1 fence still required for in-flight requests.');

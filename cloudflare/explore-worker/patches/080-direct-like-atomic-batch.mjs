import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required');
const path = join(remoteDir, 'worker.js');
let source = readFileSync(path, 'utf8');
const marker = 'SORIDRAW_DIRECT_LIKE_ATOMIC_D1_BATCH_168_20260921';
if (source.includes(marker)) {
  console.log('[080/168] direct atomic D1 batch already applied.');
  process.exit(0);
}
for (const needed of [
  'SORIDRAW_LIKE_LEGACY_INTAKE_DRAIN_BARRIER_165_20260921',
  'SORIDRAW_LIKE_CUTOVER_PRECONDITION_PROOF_164_20260921',
  'adjustExploreLikeCounterDelta',
  'handleLikeD1Core',
]) {
  if (!source.includes(needed)) throw new Error('[080/168] required predecessor missing: ' + needed);
}
const start = source.indexOf('async function adjustExploreLikeCounterDelta(');
const end = source.indexOf('\n}', start);
if (start < 0 || end <= start) throw new Error('[080/168] direct adjustment function missing');
const previous = source.slice(start, end + 2);
for (const needed of ['const mutation = shouldLike ?', 'INSERT OR IGNORE INTO likes',
  'DELETE FROM likes', 'INSERT INTO track_stats', 'RETURNING like_count']) {
  if (!previous.includes(needed)) throw new Error('[080/168] legacy function shape changed: ' + needed);
}
if (previous.includes('env.DB.batch(')) throw new Error('[080/168] unexpected preexisting direct batch');
const fragment = readFileSync(new URL('../runtime/like-direct-atomic-168.txt', import.meta.url), 'utf8');
if (!fragment.includes(marker) || !fragment.includes('WHERE changes() = 1') ||
    !fragment.includes('env.DB.batch([') ||
    fragment.indexOf('async function adjustExploreLikeCounterDelta(') < 0) {
  throw new Error('[080/168] unreviewed atomic candidate');
}
const replacement = fragment.slice(fragment.indexOf('async function adjustExploreLikeCounterDelta(')).trim();
source = source.slice(0, start) + fragment.slice(0, fragment.indexOf('async function adjustExploreLikeCounterDelta(')) +
  replacement + source.slice(end + 2);
const directStart = source.indexOf('async function handleLikeD1Core(');
const directEnd = source.indexOf('\n}', directStart);
const direct = source.slice(directStart, directEnd + 2);
for (const needed of [
  'await assertLegacyLikeIntakeOpen165(env);',
  "await assertLegacyLikeWriterOpen163(env, 'direct-like');",
  'await adjustExploreLikeCounterDelta(env, trackId, authContext.uid, shouldLike, now);'
]) {
  if (!direct.includes(needed)) throw new Error('[080/168] direct guard or adjustment missing: ' + needed);
}
writeFileSync(path, source, 'utf8');
console.log('[080/168] Direct legacy relation and count execute inside a single D1 batch; final 157 cutover remains blocked.');

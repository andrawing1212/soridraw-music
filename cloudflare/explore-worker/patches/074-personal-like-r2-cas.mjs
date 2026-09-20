import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// SORIDRAW_PERSONAL_LIKE_R2_CAS_074_20260920
// The shared user likes bundle is the membership read model for all app
// generations. Serialize *competing new Worker writers* with R2 conditional PUT;
// use server receipt order per track, never an independent device clock.
const dir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!dir) throw new Error('[074] Worker directory missing');
const path = join(dir, 'worker.js');
let source = readFileSync(path, 'utf8');
const marker = 'SORIDRAW_PERSONAL_LIKE_R2_CAS_074_20260920';
if (source.includes(marker)) { console.log('[074] already applied'); process.exit(0); }
for (const prerequisite of [
  'SORIDRAW_SERVER_ORDER_LIKE_QUEUE_073_20260920',
  'SORIDRAW_PERSONAL_LIKE_R2_REVISION_072_20260920',
  'async function syncExploreLikeR2AfterBatch034(env, uid, results) {',
  'await syncExploreLikeR2AfterBatch034(env, authContext.uid, results);',
  'exploreSharedLikesKey061',
]) if (!source.includes(prerequisite)) throw new Error('[074] missing prerequisite ' + prerequisite);

const anchor = 'async function syncExploreLikeR2AfterBatch034(env, uid, results) {';
const helper = 
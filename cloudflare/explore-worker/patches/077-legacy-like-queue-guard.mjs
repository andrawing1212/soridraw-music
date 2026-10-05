import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
// SORIDRAW_LEGACY_LIKE_QUEUE_GUARD_077_20260920
// Older 069/066/035 queues have no per-UID lookup index. Do not scan a growing
// legacy table by user_uid. For this EXCEPTION-ONLY canonical confirmation,
// conservatively withhold confirmation while ANY legacy queue is nonempty.
// This intentionally delays repair during a mixed-version rollout. Do not
// reuse on page entry and do not claim a cross-Worker atomic fence.
const dir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!dir) throw Error('[077] Worker candidate directory missing');
const path = join(dir,'worker.js');
let source = readFileSync(path,'utf8');
const marker = 'SORIDRAW_LEGACY_LIKE_QUEUE_GUARD_077_20260920';
if (source.includes(marker)) { console.log('[077] already applied'); process.exit(0); }
const anchor = 'async function handleMyLikeConfirmed075(request, url, env, cors) {';
const confirm = '  return await handleMyLikeStatesD1Core(request, url, env, cors);';
if (source.split(anchor).length !== 2) throw Error('[077] handler missing');
const start = source.indexOf(anchor);
const end = source.indexOf('\n}',start);
if (end <= start) throw Error('[077] handler bounds missing');
const handler = source.slice(start,end+2);
if (!handler.includes('SORIDRAW_LIKE_CANONICAL_SETTLEMENT_GATE_076_20260920') && !handler.includes('explore_like_user_queue_075 q')) throw Error('[077] 076 gate missing');
if (handler.split(confirm).length !== 2) throw Error('[077] canonical call ambiguous');
const helper = [
  '// '+marker,
  'async function requireLegacyLikeQueuesSettled077(env) {',
  '  // Primary-key/rowid first-entry probe, max one row per queue. There is',
  '  // intentionally NO WHERE user_uid (legacy tables lack that index).',
  "  for (const table of ['explore_like_batches_069', 'explore_like_batches_066', 'explore_like_batches_035']) {",
  '    let pending;',
  '    try {',
  '      pending = await env.DB.prepare(`SELECT 1 AS pending FROM ${table} LIMIT 1`).first();',
  '    } catch (error) {',
  "      console.warn('[077] Legacy like queue check unavailable:',table,String(error?.message||error));",
  "      throwApi('LEGACY_LIKE_SETTLEMENT_UNAVAILABLE', '기존 좋아요 저장 상태를 확인할 수 없습니다.', 503);",
  '    }',
  '    if (pending) {',
  "      throwApi('LEGACY_LIKE_STILL_PROCESSING', '기존 좋아요 저장 처리가 끝나기를 기다리고 있습니다.', 409);",
  '    }',
  '  }',
  '}',
  '',
].join('\n');
const modified = handler.replace(confirm,
  '  // A pending legacy queue cannot be attributed cheaply to this UID.\n'+
  '  await requireLegacyLikeQueuesSettled077(env);\n'+confirm);
source = source.slice(0,start)+helper+modified+source.slice(end+2);
if (!source.includes(marker) || source.split('await requireLegacyLikeQueuesSettled077(env);').length !== 2) throw Error('[077] output invalid');
writeFileSync(path,source,'utf8');
console.log('[077] legacy queue first-entry checks (<=3 D1 rows), no per-UID scan; pending->409/error->503.');

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
// SORIDRAW_LIKE_CANONICAL_SETTLEMENT_GATE_076_20260920
// Exceptional 075 canonical lookup must not mistake a pending 075 queue ACK
// for the final D1 membership. Only check the caller's indexed UID row.
const dir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!dir) throw Error('[076] Worker candidate directory missing');
const path = join(dir, 'worker.js');
let source = readFileSync(path, 'utf8');
const marker = 'SORIDRAW_LIKE_CANONICAL_SETTLEMENT_GATE_076_20260920';
if (source.includes(marker)) { console.log('[076] already applied'); process.exit(0); }
for (const key of [
  'SORIDRAW_LIKE_TARGETED_CANONICAL_READ_075_20260920',
  'async function handleMyLikeConfirmed075(request, url, env, cors) {',
  'async function handleMyLikeStatesD1Core(request, url, env, cors) {',
  'explore_like_user_queue_state_075',
]) if (!source.includes(key)) throw Error('[076] missing '+key);
const start = source.indexOf('async function handleMyLikeConfirmed075(');
const end = source.indexOf('\n}', start);
if (start < 0 || end < 0) throw Error('[076] handler bounds missing');
const block = source.slice(start,end+2);
const anchor = '  return await handleMyLikeStatesD1Core(request, url, env, cors);';
if (block.split(anchor).length !== 2) throw Error('[076] handler changed');
const code = [
  '  // Only the authenticated user UID row: no global queue/Feed scan.',
  '  const authContext = await requireExploreAuth(request);',
  '  let pending;',
  '  try {',
  '    pending = await env.DB.prepare(`',
  '      SELECT 1 AS pending',
  '      FROM explore_like_user_queue_075 q',
  '      JOIN explore_like_user_queue_state_075 s ON s.id = 1',
  '      WHERE q.user_uid = ?',
  '        AND (q.updated_at > s.processed_at',
  '          OR (q.updated_at = s.processed_at AND q.user_uid > s.processed_uid))',
  '      LIMIT 1',
  '    `).bind(authContext.uid).first();',
  '  } catch (error) {',
  "    console.warn('[076] Pending like queue check unavailable:', String(error?.message || error));",
  "    throwApi('PERSONAL_LIKE_SETTLEMENT_UNAVAILABLE', '좋아요 저장 완료 여부를 확인할 수 없습니다.', 503);",
  '  }',
  '  if (pending) {',
  "    throwApi('PERSONAL_LIKE_STILL_PROCESSING', '좋아요 저장을 처리 중입니다. 잠시 후 다시 확인해주세요.', 409);",
  '  }',
  '  // Older 069 queues and a concurrent incoming request are not covered.',
  anchor,
].join('\n');
source = source.slice(0,start)+block.replace(anchor,code)+source.slice(end+2);
source = source.replace('// SORIDRAW_LIKE_TARGETED_CANONICAL_READ_075_20260920',
  '// SORIDRAW_LIKE_TARGETED_CANONICAL_READ_075_20260920\n// '+marker);
if (!source.includes(marker)) throw Error('[076] insertion not found');
writeFileSync(path,source,'utf8');
console.log('[076] pending UID queue -> 409; queue check error -> 503; otherwise canonical read-only.');

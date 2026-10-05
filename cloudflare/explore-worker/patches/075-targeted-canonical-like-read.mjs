import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// SORIDRAW_LIKE_TARGETED_CANONICAL_READ_075_20260920
// Read-only recovery primitive. A legacy Worker can overwrite the shared R2
// personal list and discard 074 CAS metadata; this endpoint deliberately reads
// the D1 canonical membership for a *bounded* set of explicitly requested IDs.
// Never run it on a normal page entry or app update. It does not repair the R2
// bundle itself, and must not be represented as completion of legacy coexistence.
const dir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!dir) throw new Error('[075] Worker directory missing');
const path = join(dir, 'worker.js');
let source = readFileSync(path, 'utf8');
const marker = 'SORIDRAW_LIKE_TARGETED_CANONICAL_READ_075_20260920';
if (source.includes(marker)) { console.log('[075] already applied'); process.exit(0); }
for (const required of [
  'SORIDRAW_PERSONAL_LIKE_R2_CAS_074_20260920',
  'async function handleMyLikeStatesD1Core(request, url, env, cors) {',
  'if (url.pathname === "/v1/me/likes" && request.method === "GET") {',
]) if (!source.includes(required)) throw new Error('[075] missing prerequisite: ' + required);
const anchor='async function handleMyLikeStatesD1Core(request, url, env, cors) {';
const helper=[
  '// '+marker,
  'async function handleMyLikeConfirmed075(request, url, env, cors) {',
  '  // Before a full R2 repair, verify only the changed/requested IDs. Auth is',
  '  // enforced in the existing D1 Core. Do not silently truncate larger input.',
  '  const raw = String(url.searchParams.get("trackIds") || "");',
  '  const ids = [...new Set(raw.split(",").map((id) => id.trim()).filter(Boolean))];',
  '  if (!ids.length || ids.length > 20 || ids.some((id) => id.length > 512)) {',
  "    throwApi('INVALID_CONFIRMATION_IDS', '확인할 곡은 최대 20개까지 지정할 수 있습니다.', 400);",
  '  }',
  '  // This canonical read is intentionally NOT routed through the R2-first',
  '  // handleMyLikeStates. No server write and no public Edge caching.',
  '  return await handleMyLikeStatesD1Core(request, url, env, cors);',
  '}',
  '',
].join('\n');
if(source.split(anchor).length!==2)throw Error('[075] ambiguous canonical helper');
source=source.replace(anchor,helper+anchor);
const route='    if (url.pathname === "/v1/me/likes" && request.method === "GET") {';
if(source.split(route).length!==2)throw Error('[075] ambiguous like route');
source=source.replace(route,
  '    if (url.pathname === "/v1/me/likes-confirmed" && request.method === "GET") {\n' +
  '      return await handleMyLikeConfirmed075(request, url, env, cors);\n' +
  '    }\n'+route);
if(source.split(marker).length!==2)throw Error('[075] incorrect insertion');
writeFileSync(path,source,'utf8');
console.log('[075] UID-authenticated maximum 20 track D1 read-only recovery route; unused on routine entry.');

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Authenticated account-private revision used to reconcile writes from older
// app versions. No D1 read or user data migration on a warm check.
const dir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!dir) throw new Error('[072] Worker directory missing');
const path = join(dir, 'worker.js');
let source = readFileSync(path, 'utf8');
const marker = 'SORIDRAW_PERSONAL_LIKE_R2_REVISION_072_20260920';
if (source.includes(marker)) { console.log('[072] already applied'); process.exit(0); }

for (const prerequisite of [
  'SORIDRAW_PUBLICATION_CANONICAL_LIKE_PARITY_071_20260920',
  'requireExploreAuth',
  'exploreLikeR2Key',
  'async function handleMyLikedTracks052(request, env, cors) {',
  'if (url.pathname === "/v1/me/liked-tracks" && request.method === "POST") {',
]) if (!source.includes(prerequisite)) throw new Error('[072] missing prerequisite: ' + prerequisite);

const functionAnchor = 'async function handleMyLikedTracks052(request, env, cors) {';
const handler = [
  '// ' + marker,
  'async function handleMyLikeRevision072(request, env, cors) {',
  '  const authContext = await requireExploreAuth(request);',
  '  const bucket = env?.PROFILE_MEDIA;',
  "  if (!bucket) throwApi('PERSONAL_LIKE_R2_UNAVAILABLE', '좋아요 변경 확인을 잠시 할 수 없습니다.', 503);",
  '  // Exactly one UID-scoped R2 HEAD; no D1, shared edge cache or full list.',
  '  const head = await bucket.head(exploreLikeR2Key(authContext.uid));',
  "  if (!head) throwApi('PERSONAL_LIKE_R2_UNAVAILABLE', '개인 좋아요 캐시가 준비되지 않았습니다.', 503);",
  '  const revision = String(',
  '    head.httpEtag || head.etag ||',
  '    head.customMetadata?.updatedAt ||',
  "    (head.uploaded && typeof head.uploaded.getTime === 'function' ? head.uploaded.getTime() : '') ||",
  "    ''",
  '  ).trim();',
  "  if (!revision) throwApi('PERSONAL_LIKE_REVISION_MISSING', '좋아요 변경 번호를 확인하지 못했습니다.', 503);",
  "  return json({ ok: true, data: { revision, source: 'account-r2-head-072' } }, 200, cors);",
  '}',
  '',
].join('\n');

const anchorCount = source.split(functionAnchor).length - 1;
if (anchorCount !== 1) throw new Error('[072] ambiguous handler: ' + anchorCount);
source = source.replace(functionAnchor, handler + functionAnchor);
const routeAnchor = '    if (url.pathname === "/v1/me/liked-tracks" && request.method === "POST") {';
const routeCount = source.split(routeAnchor).length - 1;
if (routeCount !== 1) throw new Error('[072] ambiguous route: ' + routeCount);
source = source.replace(routeAnchor,
  '    if (url.pathname === "/v1/me/likes-revision" && request.method === "GET") {\n' +
  '      return await handleMyLikeRevision072(request, env, cors);\n' +
  '    }\n' + routeAnchor);
if (!source.includes('await bucket.head(exploreLikeR2Key(authContext.uid))')) throw new Error('[072] R2 HEAD missing');
if (handler.includes('caches.default') || handler.includes('env.DB')) throw new Error('[072] private revision must use only R2');
writeFileSync(path, source, 'utf8');
console.log('[072] one private R2 HEAD/revision; D1 R0/W0 and no schema/data writes.');
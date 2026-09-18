import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');
const marker = 'SORIDRAW_EXPLORE_FEED_EDGE_CACHE_002';
const alreadyApplied = source.includes(marker)
  || (source.includes('handleFeedWithEdgeCache') && source.includes('X-SORIDRAW-Edge-Cache'));

if (alreadyApplied) {
  console.log('[SORIDRAW Worker] Explore feed edge cache already applied (source or compiled runtime).');
  process.exit(0);
}

const feedAnchor = 'async function handleFeed(url, env, cors) {';
if (!source.includes(feedAnchor)) throw new Error('002 feed anchor missing');

const helpers = `// SORIDRAW_EXPLORE_FEED_EDGE_CACHE_002
var EXPLORE_FEED_EDGE_TTL_SECONDS = 30;
function getExploreFeedEdgeCacheKey(url, origin) {
  const keyUrl = new URL(url.toString());
  keyUrl.searchParams.set("__soridraw_edge_origin", origin || "none");
  return new Request(keyUrl.toString(), { method: "GET" });
}
function withExploreEdgeCacheHeader(response, status) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", \`public, max-age=0, s-maxage=\${EXPLORE_FEED_EDGE_TTL_SECONDS}\`);
  headers.set("X-SORIDRAW-Edge-Cache", status);
  const expose = new Set(String(headers.get("Access-Control-Expose-Headers") || "").split(",").map((item) => item.trim()).filter(Boolean));
  expose.add("X-SORIDRAW-Edge-Cache");
  headers.set("Access-Control-Expose-Headers", Array.from(expose).join(", "));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
async function handleFeedWithEdgeCache(request, url, env, cors) {
  const cache = caches.default;
  const origin = request.headers.get("Origin") || "";
  const key = getExploreFeedEdgeCacheKey(url, origin);
  const cached = await cache.match(key);
  if (cached) return withExploreEdgeCacheHeader(cached, "HIT");
  const live = await handleFeed(url, env, cors);
  if (!live.ok) return live;
  const cacheable = withExploreEdgeCacheHeader(live, "MISS");
  await cache.put(key, cacheable.clone());
  return cacheable;
}
async function invalidateExploreFeedEdgeCache(request) {
  const cache = caches.default;
  const base = new URL(request.url).origin;
  const origins = ["", ...ALLOWED_ORIGINS];
  const paths = [
    "/v1/feed?sort=latest&limit=40",
    "/v1/feed?sort=popular&limit=40"
  ];
  await Promise.all(origins.flatMap((origin) => paths.map((path) => cache.delete(getExploreFeedEdgeCacheKey(new URL(path, base), origin)))));
}

`;
source = source.replace(feedAnchor, helpers + feedAnchor);

const replaceRequired = (pattern, replacement, label) => {
  if (!pattern.test(source)) throw new Error(`002 ${label} anchor missing`);
  source = source.replace(pattern, replacement);
};

const replaceOptional = (pattern, replacement, label) => {
  if (!pattern.test(source)) {
    console.log(`[SORIDRAW Worker] ${label} router variant not patched; 30s TTL remains the freshness guard.`);
    return false;
  }
  source = source.replace(pattern, replacement);
  console.log(`[SORIDRAW Worker] ${label} invalidates hot feed cache.`);
  return true;
};

replaceRequired(
  /return\s+await\s+handleFeed\(\s*url\s*,\s*env\s*,\s*cors\s*\);/,
  'return await handleFeedWithEdgeCache(request, url, env, cors);',
  'feed',
);

let invalidationCount = 0;
invalidationCount += Number(replaceOptional(
  /return\s+await\s+handlePublication\(\s*request\s*,\s*env\s*,\s*cors\s*\);/,
  'const response = await handlePublication(request, env, cors);\n      if (response.ok) await invalidateExploreFeedEdgeCache(request);\n      return response;',
  'publication',
));
invalidationCount += Number(replaceOptional(
  /return\s+await\s+handlePublicationOptions\(\s*request\s*,\s*env\s*,\s*cors\s*,\s*decodeURIComponent\(segments\[2\]\)\s*\);/,
  'const response = await handlePublicationOptions(\n        request,\n        env,\n        cors,\n        decodeURIComponent(segments[2])\n      );\n      if (response.ok) await invalidateExploreFeedEdgeCache(request);\n      return response;',
  'publication-options',
));
invalidationCount += Number(replaceOptional(
  /return\s+await\s+handleVisibility\(\s*request\s*,\s*env\s*,\s*cors\s*,\s*decodeURIComponent\(segments\[2\]\)\s*\);/,
  'const response = await handleVisibility(\n        request,\n        env,\n        cors,\n        decodeURIComponent(segments[2])\n      );\n      if (response.ok) await invalidateExploreFeedEdgeCache(request);\n      return response;',
  'visibility',
));
invalidationCount += Number(replaceOptional(
  /return\s+await\s+handleLike\(\s*request\s*,\s*env\s*,\s*cors\s*,\s*decodeURIComponent\(segments\[2\]\)\s*,\s*request\.method\s*===\s*"PUT"\s*\);/,
  'const response = await handleLike(\n        request,\n        env,\n        cors,\n        decodeURIComponent(segments[2]),\n        request.method === "PUT"\n      );\n      if (response.ok) await invalidateExploreFeedEdgeCache(request);\n      return response;',
  'like',
));

if (!source.includes('handleFeedWithEdgeCache(request, url, env, cors)')) throw new Error('002 feed wrapper verification failed');

writeFileSync(workerPath, source, 'utf8');
console.log(`[SORIDRAW Worker] Explore feed edge cache 30s applied; mutation invalidations=${invalidationCount}.`);

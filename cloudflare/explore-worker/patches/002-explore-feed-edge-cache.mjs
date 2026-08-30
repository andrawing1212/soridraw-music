import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');
const marker = 'SORIDRAW_EXPLORE_FEED_EDGE_CACHE_002';

if (source.includes(marker)) {
  console.log('[SORIDRAW Worker] Explore feed edge cache already applied.');
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

const replacements = [
  [
    'if (url.pathname === "/v1/publications" && request.method === "POST") {\n      return await handlePublication(request, env, cors);\n    }',
    'if (url.pathname === "/v1/publications" && request.method === "POST") {\n      const response = await handlePublication(request, env, cors);\n      if (response.ok) await invalidateExploreFeedEdgeCache(request);\n      return response;\n    }',
  ],
  [
    'if (url.pathname === "/v1/feed" && request.method === "GET") {\n      return await handleFeed(url, env, cors);\n    }',
    'if (url.pathname === "/v1/feed" && request.method === "GET") {\n      return await handleFeedWithEdgeCache(request, url, env, cors);\n    }',
  ],
  [
    'if (request.method === "PATCH" && segments.length === 4 && segments[0] === "v1" && segments[1] === "tracks" && segments[3] === "publication-options") {\n      return await handlePublicationOptions(\n        request,\n        env,\n        cors,\n        decodeURIComponent(segments[2])\n      );\n    }',
    'if (request.method === "PATCH" && segments.length === 4 && segments[0] === "v1" && segments[1] === "tracks" && segments[3] === "publication-options") {\n      const response = await handlePublicationOptions(\n        request,\n        env,\n        cors,\n        decodeURIComponent(segments[2])\n      );\n      if (response.ok) await invalidateExploreFeedEdgeCache(request);\n      return response;\n    }',
  ],
  [
    'if (request.method === "PATCH" && segments.length === 4 && segments[0] === "v1" && segments[1] === "tracks" && segments[3] === "visibility") {\n      return await handleVisibility(\n        request,\n        env,\n        cors,\n        decodeURIComponent(segments[2])\n      );\n    }',
    'if (request.method === "PATCH" && segments.length === 4 && segments[0] === "v1" && segments[1] === "tracks" && segments[3] === "visibility") {\n      const response = await handleVisibility(\n        request,\n        env,\n        cors,\n        decodeURIComponent(segments[2])\n      );\n      if (response.ok) await invalidateExploreFeedEdgeCache(request);\n      return response;\n    }',
  ],
  [
    'if ((request.method === "PUT" || request.method === "DELETE") && segments.length === 4 && segments[0] === "v1" && segments[1] === "tracks" && segments[3] === "like") {\n      return await handleLike(\n        request,\n        env,\n        cors,\n        decodeURIComponent(segments[2]),\n        request.method === "PUT"\n      );\n    }',
    'if ((request.method === "PUT" || request.method === "DELETE") && segments.length === 4 && segments[0] === "v1" && segments[1] === "tracks" && segments[3] === "like") {\n      const response = await handleLike(\n        request,\n        env,\n        cors,\n        decodeURIComponent(segments[2]),\n        request.method === "PUT"\n      );\n      if (response.ok) await invalidateExploreFeedEdgeCache(request);\n      return response;\n    }',
  ],
];

for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`002 router anchor missing: ${before.slice(0, 100)}`);
  source = source.replace(before, after);
}

if (!source.includes('handleFeedWithEdgeCache(request, url, env, cors)')) throw new Error('002 feed wrapper verification failed');
if ((source.match(/invalidateExploreFeedEdgeCache\(request\)/g) || []).length < 5) throw new Error('002 mutation invalidation verification failed');

writeFileSync(workerPath, source, 'utf8');
console.log('[SORIDRAW Worker] Explore feed edge cache 30s + mutation invalidation applied.');

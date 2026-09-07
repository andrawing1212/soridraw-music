import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_FEED_REVISION_019_20260908';
if (source.includes(marker)) {
  console.log('[019] Explore feed revision endpoint already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[019] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[019] function body missing: ${name}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error(`[019] unterminated function: ${name}`);
};

for (const required of [
  'handleFeedWithEdgeCache',
  'getExploreFeedEdgeCacheKey',
  'exploreFeedR2Key',
  'invalidateExploreFeedEdgeCache',
  'PROFILE_MEDIA',
]) {
  if (!source.includes(required)) throw new Error(`[019] required current runtime missing: ${required}`);
}

const helperAnchor = 'async function handleFeedWithEdgeCache(';
if (!source.includes(helperAnchor)) throw new Error('[019] feed helper anchor missing');

const helpers = `// ${marker}
const EXPLORE_FEED_REVISION_EDGE_TTL_SECONDS_019 = 10;

function withExploreFeedRevisionCache019(response, status, revision) {
  const headers = new Headers(response.headers);
  const resolvedRevision = String(revision || headers.get('X-SORIDRAW-Feed-Revision') || 'missing');
  headers.set('Cache-Control', \`public, max-age=0, s-maxage=\${EXPLORE_FEED_REVISION_EDGE_TTL_SECONDS_019}\`);
  headers.set('X-SORIDRAW-Feed-Revision', resolvedRevision);
  headers.set('X-SORIDRAW-Revision-Cache', status);
  headers.set('X-SORIDRAW-D1-Read', '0');
  headers.set('X-SORIDRAW-D1-Write', '0');
  headers.set('X-SORIDRAW-R2-A', '0');
  headers.set('X-SORIDRAW-R2-B', status === 'HIT' ? '0' : '1');
  const expose = new Set(String(headers.get('Access-Control-Expose-Headers') || '').split(',').map((item) => item.trim()).filter(Boolean));
  for (const name of [
    'X-SORIDRAW-Feed-Revision',
    'X-SORIDRAW-Revision-Cache',
    'X-SORIDRAW-D1-Read',
    'X-SORIDRAW-D1-Write',
    'X-SORIDRAW-R2-A',
    'X-SORIDRAW-R2-B',
  ]) expose.add(name);
  headers.set('Access-Control-Expose-Headers', Array.from(expose).join(', '));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function handleExploreFeedRevision019(request, url, env, cors) {
  const sort = url.searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
  const cache = caches.default;
  const origin = request.headers.get('Origin') || '';
  const canonicalUrl = new URL('/v1/feed-revision', url.origin);
  canonicalUrl.searchParams.set('sort', sort);
  const key = getExploreFeedEdgeCacheKey(canonicalUrl, origin);
  const cached = await cache.match(key);
  if (cached) return withExploreFeedRevisionCache019(cached, 'HIT', null);

  const object = env?.PROFILE_MEDIA ? await env.PROFILE_MEDIA.head(exploreFeedR2Key(sort)) : null;
  const revision = String(
    object?.etag
      || object?.customMetadata?.updatedAt
      || (object?.uploaded ? new Date(object.uploaded).getTime() : '')
      || \`missing:\${sort}\`
  );
  const response = withExploreFeedRevisionCache019(
    json({ ok: true, data: { sort, revision } }, 200, cors),
    'MISS',
    revision,
  );
  await cache.put(key, response.clone());
  return response;
}

`;
source = source.replace(helperAnchor, helpers + helperAnchor);

// Keep the proven Stage3.1 invalidation path, then invalidate only the current-origin
// revision keys. Other regions are bounded by the 10s revision edge TTL.
const invalidation = functionRange('invalidateExploreFeedEdgeCache');
const coreName = 'invalidateExploreFeedEdgeCache019Core';
const renamed = invalidation.text.replace(
  /^(async\s+)?function\s+invalidateExploreFeedEdgeCache\(/,
  (full) => full.replace('invalidateExploreFeedEdgeCache(', `${coreName}(`),
);
if (renamed === invalidation.text) throw new Error('[019] could not wrap feed invalidation');
const wrapper = `async function invalidateExploreFeedEdgeCache(request) {
  await ${coreName}(request);
  try {
    const cache = caches.default;
    const base = new URL(request.url).origin;
    const origin = request.headers.get('Origin') || '';
    const revisionPaths = [
      '/v1/feed-revision?sort=latest',
      '/v1/feed-revision?sort=popular'
    ];
    await Promise.allSettled(
      revisionPaths.map((path) => cache.delete(getExploreFeedEdgeCacheKey(new URL(path, base), origin)))
    );
  } catch (error) {
    console.warn('[SORIDRAW 019] feed revision invalidation skipped:', String(error?.message || error || 'unknown'));
  }
}`;
source = source.slice(0, invalidation.start) + renamed + '\n\n' + wrapper + source.slice(invalidation.end);

const routeAnchor = '    if (url.pathname === "/v1/publications" && request.method === "POST") {';
if (!source.includes(routeAnchor)) throw new Error('[019] publication route anchor missing');
const route = `    if (url.pathname === "/v1/feed-revision" && request.method === "GET") {
      return await handleExploreFeedRevision019(request, url, env, cors);
    }
${routeAnchor}`;
source = source.replace(routeAnchor, route);

if (!source.includes(marker)) throw new Error('[019] marker missing after patch');
if (!source.includes('PROFILE_MEDIA.head(exploreFeedR2Key(sort))')) throw new Error('[019] revision path must use R2 metadata head only');
if (!source.includes('EXPLORE_FEED_REVISION_EDGE_TTL_SECONDS_019 = 10')) throw new Error('[019] 10s edge revision TTL missing');
if (!source.includes('url.pathname === "/v1/feed-revision"')) throw new Error('[019] revision route missing');
if (!source.includes('revisionPaths.map')) throw new Error('[019] revision cache invalidation missing');

writeFileSync(workerPath, source, 'utf8');
console.log('[019] Explore feed revision endpoint applied: edge-cached R2 HEAD metadata, no D1 read/write, current-origin invalidation on mutation.');

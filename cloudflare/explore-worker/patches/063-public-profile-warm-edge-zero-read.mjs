import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_PUBLIC_PROFILE_WARM_EDGE_ZERO_READ_063_20260917';
if (source.includes(marker)) {
  console.log('[063] public-profile warm Edge zero-read guard already applied.');
  process.exit(0);
}

for (const required of [
  'SORIDRAW_SHARED_PROFILE_R2_PARITY_060_20260917',
  'SORIDRAW_PUBLIC_PROFILE_NEGATIVE_CACHE_057_20260916',
  'handlePublicProfileFirstViewWithEdgeCache',
  'getExploreProfileNegativeCacheKey057',
  'getPublicProfileFirstViewEdgeCacheKey',
  'readPublicProfileFirstViewRevisionFromResponse',
  'makePublicProfileFirstViewNotModified',
  'withExploreZeroUsageOnEdgeHit',
  'withPublicProfileRevisionHeaders',
  'withPublicProfileFirstViewEdgeHeader',
]) {
  if (!source.includes(required)) throw new Error(`[063] required runtime missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[063] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[063] function body missing: ${name}`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let comment = '';
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (comment === 'line') { if (char === '\n') comment = ''; continue; }
    if (comment === 'block') { if (char === '*' && next === '/') { comment = ''; index += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') { comment = 'line'; index += 1; continue; }
    if (char === '/' && next === '*') { comment = 'block'; index += 1; continue; }
    if ('"\'`'.includes(char)) { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return { start, end: index + 1, text: source.slice(start, index + 1) };
  }
  throw new Error(`[063] unterminated function: ${name}`);
};

const range = functionRange('handlePublicProfileFirstViewWithEdgeCache');
const coreName = 'handlePublicProfileFirstViewWithEdgeCacheCore063';
const renamed = range.text.replace(
  /^async\s+function\s+handlePublicProfileFirstViewWithEdgeCache\(/,
  `async function ${coreName}(`,
);
if (renamed === range.text) throw new Error('[063] could not wrap public-profile handler');

const wrapper = `// ${marker}\nasync function handlePublicProfileFirstViewWithEdgeCache(request, profileRef, env, cors) {\n  const cache = caches.default;\n\n  // A cached negative result has precedence over a stale positive entry. Delegate\n  // only that case to the existing 057 guard, which serves the negative cache\n  // without opening D1.\n  try {\n    const negativeKey = getExploreProfileNegativeCacheKey057(request, profileRef);\n    if (await cache.match(negativeKey)) {\n      return await ${coreName}(request, profileRef, env, cors);\n    }\n  } catch {}\n\n  // HARD COST RULE: a positive Edge hit is already the validated first-view\n  // snapshot. Return it here instead of re-entering older wrapper layers that may\n  // inspect shared/materialized state. Warm revisit therefore performs D1 read 0.\n  try {\n    const requestUrl = new URL(request.url);\n    const knownRevision = String(requestUrl.searchParams.get('knownRevision') || '').trim();\n    const origin = request.headers.get('Origin') || '';\n    const key = getPublicProfileFirstViewEdgeCacheKey(request.url, profileRef, origin);\n    const cached = await cache.match(key);\n    if (cached) {\n      const cachedRevision = await readPublicProfileFirstViewRevisionFromResponse(cached);\n      if (knownRevision && cachedRevision && knownRevision === cachedRevision) {\n        return withExploreZeroUsageOnEdgeHit(\n          makePublicProfileFirstViewNotModified(cached, cachedRevision, 'HIT', 'NOT_MODIFIED_EDGE_063', cors),\n          'HIT'\n        );\n      }\n      return withExploreZeroUsageOnEdgeHit(\n        withPublicProfileRevisionHeaders(\n          withPublicProfileFirstViewEdgeHeader(cached, 'HIT'),\n          cachedRevision,\n          knownRevision ? 'UPDATED_EDGE_063' : 'FULL_EDGE_063'\n        ),\n        'HIT'\n      );\n    }\n  } catch {}\n\n  return await ${coreName}(request, profileRef, env, cors);\n}`;

source = source.slice(0, range.start) + renamed + '\n\n' + wrapper + source.slice(range.end);

const top = functionRange('handlePublicProfileFirstViewWithEdgeCache').text;
for (const required of [marker, coreName, 'withExploreZeroUsageOnEdgeHit', 'NOT_MODIFIED_EDGE_063', 'FULL_EDGE_063']) {
  if (!source.includes(required)) throw new Error(`[063] final runtime missing: ${required}`);
}
for (const forbidden of ['env.DB.prepare', 'readPublicProfileFirstViewRow', 'materializePublicProfileFirstView', 'readMaterializedSharedProfile060']) {
  if (top.includes(forbidden)) throw new Error(`[063] warm outer handler contains forbidden server-read path: ${forbidden}`);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[063] Positive public-profile Edge hits now return before shared/materialized/D1 wrapper layers; warm D1 read target is 0.');

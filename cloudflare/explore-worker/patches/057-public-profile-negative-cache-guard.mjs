import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_PUBLIC_PROFILE_NEGATIVE_CACHE_057_20260916';
if (source.includes(marker)) {
  console.log('[057] public-profile negative cache guard already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[057] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[057] function body missing: ${name}`);
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
  throw new Error(`[057] unterminated function: ${name}`);
};

for (const required of [
  'handlePublicProfileFirstViewWithEdgeCache',
  'getPublicProfileFirstViewEdgeCacheKey',
  'apiError',
]) {
  if (!source.includes(required)) throw new Error(`[057] prerequisite missing: ${required}`);
}

const current = functionRange('handlePublicProfileFirstViewWithEdgeCache');
const coreName = 'handlePublicProfileFirstViewWithEdgeCacheCore057';
const renamed = current.text.replace(
  /^async\s+function\s+handlePublicProfileFirstViewWithEdgeCache\(/,
  `async function ${coreName}(`,
);
if (renamed === current.text) throw new Error('[057] could not rename public-profile handler');

const helpers = `// ${marker}
const EXPLORE_PROFILE_NEGATIVE_TTL_SECONDS_057 = 60;
const EXPLORE_PROFILE_COLD_RATE_PREFIX_057 = 'profile-cold:';

function normalizeExploreProfileNegativeRef057(profileRef) {
  return String(profileRef || '').trim().replace(/^@+/, '');
}

function getExploreProfileNegativeCacheKey057(request, profileRef) {
  const requestUrl = new URL(request.url);
  const ref = normalizeExploreProfileNegativeRef057(profileRef);
  const origin = request.headers.get('Origin') || '';
  const keyUrl = new URL('/__soridraw/profile-negative-v1/' + encodeURIComponent(ref), requestUrl.origin);
  keyUrl.searchParams.set('__soridraw_edge_origin', origin || 'none');
  return new Request(keyUrl.toString(), { method: 'GET' });
}

function withExploreProfileProtectionHeaders057(response, status, zeroUsage) {
  const headers = new Headers(response.headers);
  headers.set('X-SORIDRAW-Profile-Negative-Cache', status);
  if (zeroUsage) {
    headers.set('X-SORIDRAW-D1-Read', '0');
    headers.set('X-SORIDRAW-D1-Write', '0');
    headers.set('X-SORIDRAW-D1-Read-Queries', '0');
    headers.set('X-SORIDRAW-D1-Write-Queries', '0');
    headers.set('X-SORIDRAW-D1-Other-Queries', '0');
    headers.set('X-SORIDRAW-R2-A', '0');
    headers.set('X-SORIDRAW-R2-B', '0');
  }
  const expose = new Set(String(headers.get('Access-Control-Expose-Headers') || '').split(',').map((item) => item.trim()).filter(Boolean));
  for (const name of [
    'X-SORIDRAW-Profile-Negative-Cache',
    'X-SORIDRAW-D1-Read',
    'X-SORIDRAW-D1-Write',
    'X-SORIDRAW-D1-Read-Queries',
    'X-SORIDRAW-D1-Write-Queries',
    'X-SORIDRAW-D1-Other-Queries',
    'X-SORIDRAW-R2-A',
    'X-SORIDRAW-R2-B',
  ]) expose.add(name);
  headers.set('Access-Control-Expose-Headers', Array.from(expose).join(', '));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function exploreProfileClientKey057(request) {
  const cfIp = String(request.headers.get('CF-Connecting-IP') || '').trim();
  if (cfIp) return cfIp.slice(0, 64);
  const forwarded = String(request.headers.get('X-Forwarded-For') || '').split(',')[0].trim();
  if (forwarded) return forwarded.slice(0, 64);
  return 'unknown';
}

async function enforceExploreProfileColdRateLimit057(request, env, cors) {
  const limiter = env?.LIKE_RATE_LIMITER;
  if (!limiter || typeof limiter.limit !== 'function') {
    console.warn('[SORIDRAW 057] LIKE_RATE_LIMITER unavailable; negative cache remains active but cold-ref rate bound is skipped.');
    return null;
  }
  const clientKey = exploreProfileClientKey057(request);
  const result = await limiter.limit({ key: EXPLORE_PROFILE_COLD_RATE_PREFIX_057 + clientKey });
  if (result?.success) return null;
  const blocked = apiError('RATE_LIMITED', '공개 프로필 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', 429, cors);
  const headers = new Headers(blocked.headers);
  headers.set('Retry-After', '60');
  const response = new Response(blocked.body, { status: blocked.status, statusText: blocked.statusText, headers });
  return withExploreProfileProtectionHeaders057(response, 'RATE_LIMIT', true);
}

async function isCacheableExploreProfileNotFound057(response) {
  if (!response || response.status !== 404) return false;
  try {
    const payload = await response.clone().json();
    const code = String(payload?.error?.code || payload?.code || '').trim();
    return code === 'NOT_FOUND';
  } catch {
    return false;
  }
}

async function cacheExploreProfileNotFound057(request, profileRef, response) {
  const cache = caches.default;
  const key = getExploreProfileNegativeCacheKey057(request, profileRef);
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'public, max-age=0, s-maxage=' + EXPLORE_PROFILE_NEGATIVE_TTL_SECONDS_057);
  headers.set('X-SORIDRAW-Profile-Negative-Cache', 'STORED');
  const stored = new Response(response.clone().body, { status: response.status, statusText: response.statusText, headers });
  await cache.put(key, stored);
}

async function handlePublicProfileFirstViewWithEdgeCache(request, profileRef, env, cors) {
  const cache = caches.default;
  const negativeKey = getExploreProfileNegativeCacheKey057(request, profileRef);
  const negative = await cache.match(negativeKey);
  if (negative) return withExploreProfileProtectionHeaders057(negative, 'HIT', true);

  // A normal warm valid profile already has the existing positive edge entry.
  // Do not spend abuse-limit budget on that path; the core keeps all revision/304 behavior.
  try {
    const origin = request.headers.get('Origin') || '';
    const positiveKey = getPublicProfileFirstViewEdgeCacheKey(request.url, profileRef, origin);
    if (await cache.match(positiveKey)) return await ${coreName}(request, profileRef, env, cors);
  } catch (error) {
    console.warn('[SORIDRAW 057] positive profile edge probe skipped:', String(error?.message || error || 'unknown'));
  }

  // Only cold/unresolved refs are rate bounded. The existing Cloudflare edge limiter
  // is reused with an independent key prefix, so likes and profile reads never share a counter.
  const blocked = await enforceExploreProfileColdRateLimit057(request, env, cors);
  if (blocked) return blocked;

  const response = await ${coreName}(request, profileRef, env, cors);
  if (await isCacheableExploreProfileNotFound057(response)) {
    try {
      await cacheExploreProfileNotFound057(request, profileRef, response);
    } catch (error) {
      console.warn('[SORIDRAW 057] negative profile cache write skipped:', String(error?.message || error || 'unknown'));
    }
    return withExploreProfileProtectionHeaders057(response, 'MISS', false);
  }
  return response;
}
`;

source = source.slice(0, current.start) + renamed + '\n\n' + helpers + source.slice(current.end);

const wrapper = functionRange('handlePublicProfileFirstViewWithEdgeCache').text;
const core = functionRange(coreName).text;
const limiter = functionRange('enforceExploreProfileColdRateLimit057').text;
if (!wrapper.includes("cache.match(negativeKey)")) throw new Error('[057] negative cache lookup missing');
if (!wrapper.includes("cache.match(positiveKey)")) throw new Error('[057] positive edge bypass missing');
if (!wrapper.includes('enforceExploreProfileColdRateLimit057(request, env, cors)')) throw new Error('[057] cold-ref rate guard missing');
if (!wrapper.includes(`await ${coreName}(request, profileRef, env, cors)`)) throw new Error('[057] core delegation missing');
if (!wrapper.includes('cacheExploreProfileNotFound057(request, profileRef, response)')) throw new Error('[057] 404 cache write missing');
if (wrapper.includes('env.DB.') || limiter.includes('env.DB.')) throw new Error('[057] edge guard must not use D1');
if (!limiter.includes("env?.LIKE_RATE_LIMITER") || !limiter.includes('EXPLORE_PROFILE_COLD_RATE_PREFIX_057 + clientKey')) {
  throw new Error('[057] Cloudflare rate limiter contract missing');
}
if (!core.includes('handlePublicProfileFirstViewWithEdgeCacheCore029') && !core.includes('handlePublicProfileFirstViewWithEdgeCacheCore')) {
  console.log('[057] note: current core naming differs, but handler was preserved byte-for-byte apart from rename.');
}

writeFileSync(workerPath, source, 'utf8');
console.log('[057] Public-profile invalid refs now use 60s negative edge cache and a bounded cold-ref edge rate guard; no D1 schema/data change.');

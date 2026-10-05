import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const MARKER = 'SORIDRAW_PUBLICATION_CANONICAL_LIKE_REQUEST_CACHE_365_20261006';
if (source.includes(MARKER)) {
  console.log('[095] publication canonical-like request cache already applied.');
  process.exit(0);
}
for (const required of [
  'SORIDRAW_PUBLICATION_CANONICAL_LIKE_PARITY_071_20260920',
  'async function readCanonicalPublicationLike071(env, trackId)',
  'syncExploreFeedR2Publication043',
  'patchExploreProfileR2Publication043',
]) {
  if (!source.includes(required)) throw new Error(`[095] prerequisite missing: ${required}`);
}

const before = `async function readCanonicalPublicationLike071(env, trackId) {
  const id = String(trackId || '').trim();
  if (!id || !env?.DB) throw new Error('[071] invalid canonical track');
  const row = await env.DB.prepare(
    "SELECT COALESCE(s.like_count,0) AS like_count FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id WHERE t.id=? AND t.is_public=1 AND t.status='published' LIMIT 1"
  ).bind(id).first();
  if (!row) throw new Error('[071] canonical public track unavailable');
  const count = Number(row.like_count);
  if (!Number.isFinite(count) || count < 0) throw new Error('[071] invalid canonical like count');
  return Math.floor(count);
}`;

const after = `// ${MARKER}
// createMeteredEnv() creates one env Proxy per Worker request, so this WeakMap
// is request-scoped in practice. Feed + profile publication parity can therefore
// share the exact same canonical like read without making a second D1 SELECT.
// No value is shared across requests, and failures are not cached.
const canonicalPublicationLikeRequestCache365 = new WeakMap();

async function readCanonicalPublicationLike071(env, trackId) {
  const id = String(trackId || '').trim();
  if (!id || !env?.DB) throw new Error('[071] invalid canonical track');

  let requestCache = canonicalPublicationLikeRequestCache365.get(env);
  if (!requestCache) {
    requestCache = new Map();
    canonicalPublicationLikeRequestCache365.set(env, requestCache);
  }
  if (requestCache.has(id)) return requestCache.get(id);

  const pending = (async () => {
    const row = await env.DB.prepare(
      "SELECT COALESCE(s.like_count,0) AS like_count FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id WHERE t.id=? AND t.is_public=1 AND t.status='published' LIMIT 1"
    ).bind(id).first();
    if (!row) throw new Error('[071] canonical public track unavailable');
    const count = Number(row.like_count);
    if (!Number.isFinite(count) || count < 0) throw new Error('[071] invalid canonical like count');
    return Math.floor(count);
  })();

  requestCache.set(id, pending);
  try {
    return await pending;
  } catch (error) {
    requestCache.delete(id);
    throw error;
  }
}`;

const count = source.split(before).length - 1;
if (count !== 1) throw new Error(`[095] canonical-like anchor count=${count}`);
source = source.replace(before, after);

writeFileSync(workerPath, source, 'utf8');
console.log('[095] publication feed/profile parity now shares one exact canonical like read per track per request.');

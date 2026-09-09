import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyCacheMutationSafety } from '../scripts/cache-mutation-safety.mjs';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_SHARED_CANONICAL_DATA_031_20260909';
if (source.includes(marker)) {
  writeFileSync(workerPath, applyCacheMutationSafety(source), 'utf8');
  console.log('[031] Shared canonical runtime retained; cache mutation safety upgraded.');
  process.exit(0);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[031] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[031] function body missing: ${name}`);
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
    else if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error(`[031] unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

const wrapFunction = (name, suffix, wrapperBuilder) => {
  const range = functionRange(name);
  const coreName = `${name}${suffix}`;
  const renamed = range.text.replace(
    new RegExp(`^(async\\s+)?function\\s+${name}\\(`),
    (full) => full.replace(`${name}(`, `${coreName}(`),
  );
  if (renamed === range.text) throw new Error(`[031] could not wrap ${name}`);
  source = source.slice(0, range.start) + renamed + '\n\n' + wrapperBuilder(coreName) + source.slice(range.end);
};

for (const required of [
  'readExploreR2Json',
  'writeExploreR2Json',
  'deleteExploreFeedR2Bundles',
  'buildExploreFeedR2Payload',
  'handleExploreFeedRevision019',
  'invalidateExploreFeedEdgeCache',
  'handlePublicProfileFirstViewWithEdgeCache',
  'invalidatePublicProfileFirstViewEdgeCache',
  'materializePublicProfileFirstView',
  'resolvePublicProfileRef',
  'enforceUserRateLimit',
  'fanoutExploreMirror020',
  'handleExploreMirrorRoute020',
  'handleExploreMirrorSyncRoute020',
]) {
  if (!source.includes(required)) throw new Error(`[031] required runtime behavior missing: ${required}`);
}

const helperAnchor = functionRange('readExploreR2Json').start;
const helpers = `// ${marker}
const EXPLORE_SHARED_DATA_SCHEMA_031 = 1;
const EXPLORE_SHARED_REVISION_EDGE_TTL_SECONDS_031 = 10;
const EXPLORE_SHARED_CACHE_STATE_KEY_031 = "internal/explore/shared-canonical-v1/state.json";
const EXPLORE_SHARED_PROFILE_REPAIR_QUERY_031 = "__soridraw_shared_profile";
const EXPLORE_SHARED_PROFILE_REPAIR_VERSION_031 = "51";

function exploreCacheBucket031(env) {
  return env?.EXPLORE_CACHE || env?.PROFILE_MEDIA || null;
}

function exploreRateDb031(env) {
  return env?.RATE_DB || env?.DB || null;
}

function sharedDataRevisionEdgeKey031(request) {
  const base = new URL(request.url);
  const url = new URL("/__soridraw_shared_data_revision_031", base.origin);
  return new Request(url.toString(), { method: "GET" });
}

async function clearSharedDataRevisionEdge031(request) {
  try { await caches.default.delete(sharedDataRevisionEdgeKey031(request)); } catch {}
}

async function readSharedDataRevision031(request, env) {
  const key = sharedDataRevisionEdgeKey031(request);
  try {
    const cached = await caches.default.match(key);
    if (cached) {
      const text = String(await cached.text()).trim();
      if (text) return text;
    }
  } catch {}

  let revision = "0";
  try {
    const row = await env.DB.prepare("SELECT revision FROM explore_shared_revision WHERE scope = 'global' LIMIT 1").first();
    revision = String(row?.revision || "0");
  } catch (error) {
    const message = String(error?.message || error || "");
    if (!message.includes("no such table") && !message.includes("explore_shared_revision")) throw error;
  }

  try {
    await caches.default.put(key, new Response(revision, {
      status: 200,
      headers: { "Cache-Control": \`public, max-age=0, s-maxage=\${EXPLORE_SHARED_REVISION_EDGE_TTL_SECONDS_031}\` }
    }));
  } catch {}
  return revision;
}

async function ensureExploreSharedFeedCache031(request, env) {
  if (!env?.DB || !exploreCacheBucket031(env)) return { checked: false, reason: "binding" };
  const revision = await readSharedDataRevision031(request, env);
  const state = await readExploreR2Json(env, EXPLORE_SHARED_CACHE_STATE_KEY_031).catch(() => null);
  if (Number(state?.schemaVersion || 0) === EXPLORE_SHARED_DATA_SCHEMA_031 && String(state?.revision || "") === revision) {
    return { checked: false, revision, source: "cache-state" };
  }

  const [latest, popular] = await Promise.all([
    buildExploreFeedR2Payload(env, "latest"),
    buildExploreFeedR2Payload(env, "popular")
  ]);
  await Promise.all([
    writeExploreR2Json(env, exploreFeedR2Key("latest"), latest),
    writeExploreR2Json(env, exploreFeedR2Key("popular"), popular),
    writeExploreR2Json(env, EXPLORE_SHARED_CACHE_STATE_KEY_031, {
      schemaVersion: EXPLORE_SHARED_DATA_SCHEMA_031,
      revision,
      rebuiltAt: Date.now()
    })
  ]);
  try { await invalidateExploreFeedEdgeCache(request); } catch {}
  return { checked: true, revision, rebuilt: true };
}

`;
source = source.slice(0, helperAnchor) + helpers + source.slice(helperAnchor);

replaceFunction('readExploreR2Json', `async function readExploreR2Json(env, key) {
  const bucket = exploreCacheBucket031(env);
  if (!bucket) return null;
  const object = await bucket.get(key);
  if (!object) return null;
  try {
    const text = await object.text();
    return JSON.parse(text);
  } catch (error) {
    console.warn('[SORIDRAW R2 bundle] invalid JSON:', key, String(error?.message || error || 'unknown'));
    return null;
  }
}`);

replaceFunction('writeExploreR2Json', `async function writeExploreR2Json(env, key, payload) {
  const bucket = exploreCacheBucket031(env);
  if (!bucket) throw new Error('Explore cache R2 binding is unavailable.');
  await bucket.put(key, JSON.stringify(payload), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: { soridrawBundle: '1', updatedAt: String(Date.now()) }
  });
}`);

replaceFunction('deleteExploreFeedR2Bundles', `async function deleteExploreFeedR2Bundles(env) {
  const bucket = exploreCacheBucket031(env);
  if (!bucket) return;
  await Promise.all([
    bucket.delete(exploreFeedR2Key('latest')),
    bucket.delete(exploreFeedR2Key('popular'))
  ]);
}`);

// The feed-revision endpoint still returns the proven per-environment R2 ETag,
// but first makes sure that R2 was rebuilt from the shared canonical D1 revision.
wrapFunction('handleExploreFeedRevision019', 'Core031', (coreName) => `async function handleExploreFeedRevision019(request, url, env, cors) {
  await ensureExploreSharedFeedCache031(request, env);
  return await ${coreName}(request, url, env, cors);
}`);

// Patch the old direct PROFILE_MEDIA.head call used by the 019 core so derived
// feed metadata always comes from the environment cache bucket, never shared media.
source = source.replaceAll(
  'env?.PROFILE_MEDIA ? await env.PROFILE_MEDIA.head(exploreFeedR2Key(sort)) : null',
  'exploreCacheBucket031(env) ? await exploreCacheBucket031(env).head(exploreFeedR2Key(sort)) : null',
);
source = source.replaceAll(
  'env.PROFILE_MEDIA.head(exploreFeedR2Key(sort))',
  'exploreCacheBucket031(env).head(exploreFeedR2Key(sort))',
);

wrapFunction('invalidateExploreFeedEdgeCache', 'Core031', (coreName) => `async function invalidateExploreFeedEdgeCache(request) {
  await ${coreName}(request);
  await clearSharedDataRevisionEdge031(request);
}`);

wrapFunction('invalidatePublicProfileFirstViewEdgeCache', 'Core031', (coreName) => `async function invalidatePublicProfileFirstViewEdgeCache(request, refs) {
  await ${coreName}(request, refs);
  await clearSharedDataRevisionEdge031(request);
}`);

// A schema-6 client makes this request once after upgrading. Re-materializing
// from the shared D1 removes old per-device/per-environment profile-count drift.
wrapFunction('handlePublicProfileFirstViewWithEdgeCache', 'Core031', (coreName) => `async function handlePublicProfileFirstViewWithEdgeCache(request, profileRef, env, cors) {
  const url = new URL(request.url);
  if (url.searchParams.get(EXPLORE_SHARED_PROFILE_REPAIR_QUERY_031) === EXPLORE_SHARED_PROFILE_REPAIR_VERSION_031) {
    try {
      const resolved = await resolvePublicProfileRef(env, String(profileRef || '').trim().replace(/^@+/, ''));
      if (resolved?.uid) {
        await materializePublicProfileFirstView(env, resolved.uid);
        await invalidatePublicProfileFirstViewEdgeCache(request, [resolved.uid, resolved.handle, profileRef].filter(Boolean));
      }
    } catch (error) {
      console.warn('[SORIDRAW 031] shared profile rematerialize skipped:', String(error?.message || error || 'unknown'));
    }
  }
  return await ${coreName}(request, profileRef, env, cors);
}`);

// Rate limits remain environment-local even though user/content tables are shared.
{
  const range = functionRange('enforceUserRateLimit');
  let next = range.text;
  next = next.replace('if (!env?.DB ||', 'if (!exploreRateDb031(env) ||');
  next = next.replaceAll('env.DB.prepare', 'exploreRateDb031(env).prepare');
  if (next === range.text || !next.includes('exploreRateDb031(env).prepare')) throw new Error('[031] rate DB isolation transform failed');
  source = source.slice(0, range.start) + next + source.slice(range.end);
}

// 020 copied production rows into PREVIEW/TEST D1. Once DB is physically shared,
// those writes are redundant and can re-introduce stale snapshots, so retire them.
replaceFunction('fanoutExploreMirror020', `async function fanoutExploreMirror020(env, changedTrackId, fullSnapshot) {
  return { skipped: true, sharedCanonicalData: true, changedTrackId: String(changedTrackId || ''), fullSnapshot: Boolean(fullSnapshot) };
}`);

replaceFunction('handleExploreMirrorRoute020', `async function handleExploreMirrorRoute020(request, env) {
  const token = exploreMirrorToken020(env);
  if (!token || request.headers.get('X-SORIDRAW-Explore-Mirror') !== token) return new Response('not found', { status: 404 });
  return Response.json({ ok: true, skipped: true, sharedCanonicalData: true }, { status: 200 });
}`);

replaceFunction('handleExploreMirrorSyncRoute020', `async function handleExploreMirrorSyncRoute020(request, env) {
  const token = exploreMirrorToken020(env);
  if (!token || request.headers.get('X-SORIDRAW-Explore-Mirror') !== token) return new Response('not found', { status: 404 });
  return Response.json({ ok: true, skipped: true, sharedCanonicalData: true }, { status: 200 });
}`);

for (const required of [
  marker,
  'EXPLORE_SHARED_CACHE_STATE_KEY_031',
  'explore_shared_revision',
  'exploreCacheBucket031',
  'exploreRateDb031',
  'ensureExploreSharedFeedCache031',
  'handleExploreFeedRevision019Core031',
  'handlePublicProfileFirstViewWithEdgeCacheCore031',
  'sharedCanonicalData: true',
]) {
  if (!source.includes(required)) throw new Error(`[031] final runtime missing: ${required}`);
}

writeFileSync(workerPath, applyCacheMutationSafety(source), 'utf8');
console.log('[031] Explore now supports one shared canonical D1/user-media source with environment-local derived cache/rate limits; old cross-environment DB mirroring is retired.');

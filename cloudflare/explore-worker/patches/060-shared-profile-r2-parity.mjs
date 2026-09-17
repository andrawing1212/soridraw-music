import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_SHARED_PROFILE_R2_PARITY_060_20260917';
if (source.includes(marker)) {
  console.log('[060] shared public-profile R2 parity already applied.');
  process.exit(0);
}

for (const required of [
  'SORIDRAW_PUBLIC_PROFILE_NEGATIVE_CACHE_057_20260916',
  'SORIDRAW_EXPLORE_PUBLIC_LIKE_PARITY_056_20260916',
  'handlePublicProfileFirstViewWithEdgeCache',
  'getExploreProfileNegativeCacheKey057',
  'getPublicProfileFirstViewEdgeCacheKey',
  'readPublicProfileFirstViewRow',
  'parseExploreProfileSnapshotRow',
  'readExploreProfileCanonicalR2Bundle020',
  'writeExploreProfileAlias020',
  'validExploreProfileR2Bundle020',
  'exploreProfileR2Key',
  'readExploreR2Json',
  'writeExploreR2Json',
  'patchExploreVisibleProfiles056',
  'patchExploreProfileR2Counters020',
  'patchExploreProfileR2Like020',
  'patchExploreProfileR2Mutation019',
  'refreshPublicProfileFirstViewProfile',
  'makePublicProfileFirstViewNotModified',
  'withPublicProfileRevisionHeaders',
  'withPublicProfileFirstViewEdgeHeader',
  'json',
]) {
  if (!source.includes(required)) throw new Error(`[060] required runtime missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[060] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[060] function body missing: ${name}`);
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
  throw new Error(`[060] unterminated function: ${name}`);
};

const wrapAsyncFunction = (name, suffix, wrapperBuilder) => {
  const range = functionRange(name);
  const coreName = `${name}${suffix}`;
  const renamed = range.text.replace(new RegExp(`^async\\s+function\\s+${name}\\(`), `async function ${coreName}(`);
  if (renamed === range.text) throw new Error(`[060] could not wrap ${name}`);
  source = source.slice(0, range.start) + renamed + '\n\n' + wrapperBuilder(coreName) + source.slice(range.end);
};

const helperAnchor = functionRange('handlePublicProfileFirstViewWithEdgeCache').start;
const helpers = `// ${marker}\nconst EXPLORE_SHARED_PROFILE_VERSION_060 = 113;\nconst exploreSharedProfileR2Key060 = (uid) => \`internal/explore/shared-profile-v113/\${encodeURIComponent(String(uid || '').trim())}.json\`;\nconst exploreSharedProfileAliasR2Key060 = (handle) => \`internal/explore/shared-profile-alias-v113/\${encodeURIComponent(String(handle || '').trim().replace(/^@+/, '').toLowerCase())}.json\`;\n\nfunction exploreSharedEnvironment060(env) {\n  return String(env?.SORIDRAW_ENVIRONMENT || env?.ENV_NAME || '').trim().toLowerCase();\n}\n\nasync function readSharedProfileJson060(env, key) {\n  const bucket = env?.PROFILE_MEDIA || null;\n  if (!bucket) return null;\n  const object = await bucket.get(key);\n  if (!object) return null;\n  try { return JSON.parse(await object.text()); } catch { return null; }\n}\n\nasync function readExploreSharedProfile060(env, profileRef) {\n  const normalized = String(profileRef || '').trim().replace(/^@+/, '');\n  if (!normalized) return null;\n  const alias = await readSharedProfileJson060(env, exploreSharedProfileAliasR2Key060(normalized));\n  const aliasUid = String(alias?.uid || '').trim();\n  if (aliasUid) {\n    const byAlias = await readSharedProfileJson060(env, exploreSharedProfileR2Key060(aliasUid));\n    if (validExploreProfileR2Bundle020(byAlias)) return byAlias;\n  }\n  const direct = await readSharedProfileJson060(env, exploreSharedProfileR2Key060(normalized));\n  return validExploreProfileR2Bundle020(direct) ? direct : null;\n}\n\nasync function writeExploreSharedProfile060(env, bundle) {\n  const bucket = env?.PROFILE_MEDIA || null;\n  if (!bucket || !validExploreProfileR2Bundle020(bundle)) return false;\n  const uid = String(bundle.uid || bundle.body?.data?.profile?.uid || '').trim();\n  if (!uid) return false;\n  const handle = String(bundle.handle || bundle.body?.data?.profile?.handle || '').trim().replace(/^@+/, '');\n  const now = Date.now();\n  await bucket.put(exploreSharedProfileR2Key060(uid), JSON.stringify(bundle), {\n    httpMetadata: { contentType: 'application/json; charset=utf-8' },\n    customMetadata: { soridrawSharedProfile: '113', mirroredAt: String(now) },\n  });\n  if (handle) {\n    await bucket.put(exploreSharedProfileAliasR2Key060(handle), JSON.stringify({ schemaVersion: 1, uid, handle, updatedAt: now }), {\n      httpMetadata: { contentType: 'application/json; charset=utf-8' },\n      customMetadata: { soridrawSharedProfileAlias: '113', mirroredAt: String(now) },\n    });\n  }\n  return true;\n}\n\nasync function mirrorExploreLocalProfile060(env, uid) {\n  const normalized = String(uid || '').trim();\n  if (!normalized) return false;\n  const bundle = await readExploreR2Json(env, exploreProfileR2Key(normalized));\n  return await writeExploreSharedProfile060(env, bundle);\n}\n\nasync function primeExploreLocalProfile060(env, uid) {\n  const normalized = String(uid || '').trim();\n  if (!normalized) return false;\n  const shared = await readExploreSharedProfile060(env, normalized);\n  if (!validExploreProfileR2Bundle020(shared)) return false;\n  await writeExploreR2Json(env, exploreProfileR2Key(normalized), shared);\n  await writeExploreProfileAlias020(env, shared.handle || shared.body?.data?.profile?.handle, normalized);\n  return true;\n}\n\nasync function seedSharedProfileFromPreviewLocal060(env, profileRef) {\n  if (exploreSharedEnvironment060(env) !== 'preview') return null;\n  const local = await readExploreProfileCanonicalR2Bundle020(env, profileRef);\n  if (!validExploreProfileR2Bundle020(local)) return null;\n  await writeExploreSharedProfile060(env, local);\n  return local;\n}\n\nasync function readMaterializedSharedProfile060(env, profileRef) {\n  const normalized = String(profileRef || '').trim().replace(/^@+/, '');\n  if (!normalized || !env?.DB) return null;\n  const row = await readPublicProfileFirstViewRow(env, normalized);\n  const bundle = parseExploreProfileSnapshotRow(row);\n  if (!validExploreProfileR2Bundle020(bundle)) return null;\n  await writeExploreSharedProfile060(env, bundle);\n  await writeExploreR2Json(env, exploreProfileR2Key(bundle.uid), bundle);\n  await writeExploreProfileAlias020(env, bundle.handle || bundle.body?.data?.profile?.handle, bundle.uid);\n  return bundle;\n}\n`;
source = source.slice(0, helperAnchor) + helpers + '\n' + source.slice(helperAnchor);

wrapAsyncFunction('handlePublicProfileFirstViewWithEdgeCache', 'Core060', (coreName) => `async function handlePublicProfileFirstViewWithEdgeCache(request, profileRef, env, cors) {\n  const cache = caches.default;\n  try {\n    const negativeKey = getExploreProfileNegativeCacheKey057(request, profileRef);\n    if (await cache.match(negativeKey)) return await ${coreName}(request, profileRef, env, cors);\n  } catch {}\n  try {\n    const origin = request.headers.get('Origin') || '';\n    const positiveKey = getPublicProfileFirstViewEdgeCacheKey(request.url, profileRef, origin);\n    if (await cache.match(positiveKey)) return await ${coreName}(request, profileRef, env, cors);\n  } catch {}\n\n  let bundle = await readExploreSharedProfile060(env, profileRef);\n  if (!bundle) bundle = await seedSharedProfileFromPreviewLocal060(env, profileRef);\n  if (!bundle) bundle = await readMaterializedSharedProfile060(env, profileRef);\n  if (!validExploreProfileR2Bundle020(bundle)) {\n    return await ${coreName}(request, profileRef, env, cors);\n  }\n\n  const requestUrl = new URL(request.url);\n  const knownRevision = String(requestUrl.searchParams.get('knownRevision') || '').trim();\n  const revision = String(bundle.revision || bundle.body?.data?.revision || '').trim();\n  if (knownRevision && revision && knownRevision === revision) {\n    return makePublicProfileFirstViewNotModified(null, revision, 'SHARED-R2-113', 'NOT_MODIFIED_SHARED_R2_113', cors);\n  }\n  const origin = request.headers.get('Origin') || '';\n  const key = getPublicProfileFirstViewEdgeCacheKey(request.url, profileRef, origin);\n  const response = withPublicProfileRevisionHeaders(\n    withPublicProfileFirstViewEdgeHeader(json(bundle.body, 200, cors), 'SHARED-R2-113'),\n    revision,\n    knownRevision ? 'UPDATED_SHARED_R2_113' : 'FULL_SHARED_R2_113'\n  );\n  try { await cache.put(key, response.clone()); } catch {}\n  return response;\n}`);

wrapAsyncFunction('patchExploreVisibleProfiles056', 'Core060', (coreName) => `async function patchExploreVisibleProfiles056(env, changedItems) {\n  const owners = [...new Set((changedItems || []).map((row) => String(row?.ownerUid || '').trim()).filter(Boolean))];\n  for (const uid of owners) await primeExploreLocalProfile060(env, uid).catch(() => false);\n  const result = await ${coreName}(env, changedItems);\n  for (const uid of owners) await mirrorExploreLocalProfile060(env, uid).catch(() => false);\n  return result;\n}`);

for (const name of [
  'patchExploreProfileR2Counters020',
  'patchExploreProfileR2Like020',
  'patchExploreProfileR2Mutation019',
  'refreshPublicProfileFirstViewProfile',
]) {
  wrapAsyncFunction(name, 'Core060', (coreName) => `async function ${name}(...args) {\n  const env = args[0];\n  const uid = String(args[1] || '').trim();\n  if (uid) await primeExploreLocalProfile060(env, uid).catch(() => false);\n  const result = await ${coreName}(...args);\n  if (uid) await mirrorExploreLocalProfile060(env, uid).catch(() => false);\n  return result;\n}`);
}

for (const required of [
  marker,
  'readExploreSharedProfile060',
  'writeExploreSharedProfile060',
  'primeExploreLocalProfile060',
  'seedSharedProfileFromPreviewLocal060',
  'readMaterializedSharedProfile060',
  'handlePublicProfileFirstViewWithEdgeCacheCore060',
  'patchExploreVisibleProfiles056Core060',
  'patchExploreProfileR2Counters020Core060',
  'patchExploreProfileR2Like020Core060',
  'patchExploreProfileR2Mutation019Core060',
  'refreshPublicProfileFirstViewProfileCore060',
]) {
  if (!source.includes(required)) throw new Error(`[060] final runtime missing: ${required}`);
}
const coldReader = functionRange('readMaterializedSharedProfile060').text;
if (!coldReader.includes('readPublicProfileFirstViewRow(env, normalized)')) throw new Error('[060] bounded materialized row reader missing');
for (const forbidden of ['materializePublicProfileFirstView', 'buildExploreFeedR2Payload', 'SELECT * FROM tracks', 'SELECT * FROM likes']) {
  if (coldReader.includes(forbidden)) throw new Error(`[060] cold profile reader must not use expensive fallback: ${forbidden}`);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[060] Public-profile reads now prefer shared R2, recover a missing shared profile from one materialized snapshot row, and only then fall back to the guarded legacy path.');

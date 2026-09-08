import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_PUBLIC_PROFILE_R2_MIRROR_PARITY_029_20260909';
if (source.includes(marker)) {
  console.log('[029] Explore public-profile R2 mirror parity already applied.');
  process.exit(0);
}

for (const required of [
  'applyExploreMirrorPayload020',
  'readExploreProfileR2Bundle',
  'readPublicProfileFirstViewRow',
  'parseExploreProfileSnapshotRow',
  'writeExploreR2Json',
  'exploreProfileR2Key',
  'invalidatePublicProfileFirstViewEdgeCache',
  'handlePublicProfileFirstViewWithEdgeCache',
]) {
  if (!source.includes(required)) throw new Error(`[029] prerequisite missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[029] function missing: ${name}`);
  const brace = source.indexOf('{', start);
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
  throw new Error(`[029] unterminated function: ${name}`);
};

const renameFunction = (name, suffix) => {
  const range = functionRange(name);
  const renamedName = `${name}${suffix}`;
  const renamed = range.text.replace(new RegExp(`^(async\\s+)?function\\s+${name}\\(`), (full) => full.replace(`${name}(`, `${renamedName}(`));
  if (renamed === range.text) throw new Error(`[029] could not rename ${name}`);
  source = source.slice(0, range.start) + renamed + source.slice(range.end);
  return renamedName;
};

const helperAnchor = functionRange('applyExploreMirrorPayload020').start;
const helpers = `// ${marker}\nconst EXPLORE_PUBLIC_PROFILE_PARITY_VERSION_029 = 48;\nconst EXPLORE_PUBLIC_PROFILE_PARITY_QUERY_029 = "__soridraw_profile_parity";\n\nfunction exploreProfileBase029(env) {\n  const name = exploreMirrorEnvironment020(env);\n  if (name === "preview") return "https://soridraw-explore-preview.andrawing1212.workers.dev";\n  if (name === "test") return "https://soridraw-explore-test.andrawing1212.workers.dev";\n  return "https://soridraw-explore-api.andrawing1212.workers.dev";\n}\n\nasync function writeExploreProfileParityBundle029(env, row) {\n  const bundle = parseExploreProfileSnapshotRow(row);\n  if (!bundle?.uid) return false;\n  await writeExploreR2Json(env, exploreProfileR2Key(bundle.uid), {\n    ...bundle,\n    profileParityVersion: EXPLORE_PUBLIC_PROFILE_PARITY_VERSION_029\n  });\n  return true;\n}\n\nasync function syncMirroredProfileR2029(request, env, payload) {\n  const firstViews = payload?.tables?.public_profile_first_views;\n  const rows = Array.isArray(firstViews?.rows) ? firstViews.rows : [];\n  if (!rows.length) return 0;\n  let written = 0;\n  const refs = [];\n  for (const row of rows) {\n    if (await writeExploreProfileParityBundle029(env, row)) written += 1;\n    if (row?.uid) refs.push(String(row.uid));\n    if (row?.handle) refs.push(String(row.handle));\n  }\n  if (refs.length) {\n    const base = exploreProfileBase029(env);\n    const cacheRequest = new Request(base + "/v1/profiles/__parity_invalidate__");\n    await invalidatePublicProfileFirstViewEdgeCache(cacheRequest, refs).catch(() => {});\n  }\n  return written;\n}\n\nasync function repairPublicProfileParityOnColdRead029(request, env, profileRef) {\n  const url = new URL(request.url);\n  if (url.searchParams.get(EXPLORE_PUBLIC_PROFILE_PARITY_QUERY_029) !== String(EXPLORE_PUBLIC_PROFILE_PARITY_VERSION_029)) return false;\n  const existing = await readExploreProfileR2Bundle(env, profileRef).catch(() => null);\n  if (Number(existing?.profileParityVersion || 0) >= EXPLORE_PUBLIC_PROFILE_PARITY_VERSION_029) return false;\n  const row = await readPublicProfileFirstViewRow(env, profileRef).catch(() => null);\n  if (!row?.uid) return false;\n  await writeExploreProfileParityBundle029(env, row);\n  const refs = [row.uid, row.handle].filter(Boolean);\n  const base = exploreProfileBase029(env);\n  const cacheRequest = new Request(base + "/v1/profiles/" + encodeURIComponent(String(row.uid)));\n  await invalidatePublicProfileFirstViewEdgeCache(cacheRequest, refs).catch(() => {});\n  return true;\n}\n\n`;
source = source.slice(0, helperAnchor) + helpers + source.slice(helperAnchor);

const mirrorCore = renameFunction('applyExploreMirrorPayload020', 'Core029');
const mirrorCoreRange = functionRange(mirrorCore);
const mirrorWrapper = `\n\nasync function applyExploreMirrorPayload020(request, env, payload) {\n  const applied = await ${mirrorCore}(request, env, payload);\n  const profileR2 = await syncMirroredProfileR2029(request, env, payload);\n  return { ...applied, profileR2 };\n}`;
source = source.slice(0, mirrorCoreRange.end) + mirrorWrapper + source.slice(mirrorCoreRange.end);

const profileCore = renameFunction('handlePublicProfileFirstViewWithEdgeCache', 'Core029');
const profileCoreRange = functionRange(profileCore);
const profileWrapper = `\n\nasync function handlePublicProfileFirstViewWithEdgeCache(request, profileRef, env, cors) {\n  await repairPublicProfileParityOnColdRead029(request, env, profileRef);\n  return await ${profileCore}(request, profileRef, env, cors);\n}`;
source = source.slice(0, profileCoreRange.end) + profileWrapper + source.slice(profileCoreRange.end);

for (const required of [
  marker,
  'profileParityVersion',
  'syncMirroredProfileR2029',
  'repairPublicProfileParityOnColdRead029',
  'applyExploreMirrorPayload020Core029',
  'handlePublicProfileFirstViewWithEdgeCacheCore029',
]) {
  if (!source.includes(required)) throw new Error(`[029] final runtime missing: ${required}`);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[029] mirrored public-profile D1 rows now refresh target Profile R2; one cold 048 read repairs legacy per-environment Profile R2 without recurring D1 reads.');

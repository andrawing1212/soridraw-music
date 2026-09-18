import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_SHARED_FEED_CATCHUP_CONVERGENCE_064_20260917';
if (source.includes(marker)) {
  console.log('[064] shared Feed catch-up convergence already applied.');
  process.exit(0);
}

for (const required of [
  'SORIDRAW_SHARED_FEED_R2_PARITY_059_20260917',
  'syncDerivedCache032',
  'exploreCacheBucket031',
  'exploreFeedR2Key',
  'exploreSharedFeedR2Key059',
]) {
  if (!source.includes(required)) throw new Error(`[064] required runtime missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[064] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[064] function body missing: ${name}`);
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
  throw new Error(`[064] unterminated function: ${name}`);
};

const syncRange = functionRange('syncDerivedCache032');
const coreName = 'syncDerivedCache032Core064';
const renamed = syncRange.text.replace(
  /^async\s+function\s+syncDerivedCache032\(/,
  `async function ${coreName}(`,
);
if (renamed === syncRange.text) throw new Error('[064] could not wrap syncDerivedCache032');

const helpers = `// ${marker}\nasync function mirrorExploreSharedFeedAfterDerivedSync064(env, sort) {\n  const normalizedSort = sort === 'popular' ? 'popular' : 'latest';\n  const shared = env?.PROFILE_MEDIA || null;\n  const local = exploreCacheBucket031(env);\n  if (!shared || !local) return { mirrored: false, skipped: true };\n  const localObject = await local.get(exploreFeedR2Key(normalizedSort));\n  if (!localObject) return { mirrored: false, missingLocal: true };\n  const localBody = await localObject.text();\n  if (!localBody) return { mirrored: false, missingLocalBody: true };\n  const sharedKey = exploreSharedFeedR2Key059(normalizedSort);\n  let sharedBody = '';\n  try {\n    const sharedObject = await shared.get(sharedKey);\n    if (sharedObject) sharedBody = await sharedObject.text();\n  } catch {}\n  if (sharedBody === localBody) return { mirrored: false, unchanged: true };\n  await shared.put(sharedKey, localBody, {\n    httpMetadata: { contentType: 'application/json; charset=utf-8' },\n    customMetadata: {\n      soridrawSharedFeed: '116',\n      sourceUpdatedAt: String(localObject.customMetadata?.updatedAt || Date.now()),\n      mirroredAt: String(Date.now()),\n      catchUp: '064',\n    },\n  });\n  return { mirrored: true, unchanged: false };\n}\n`;

const wrapper = `async function syncDerivedCache032(env, sort, uid = null, request = null) {\n  const result = await ${coreName}(env, sort, uid, request);\n  if (!uid) {\n    try {\n      const catchUp = await mirrorExploreSharedFeedAfterDerivedSync064(env, sort);\n      if (catchUp?.mirrored) console.log('[SORIDRAW 064] shared Feed catch-up mirrored', sort);\n    } catch (error) {\n      console.warn('[SORIDRAW 064] shared Feed catch-up deferred:', String(error?.message || error || 'unknown'));\n    }\n  }\n  return result;\n}`;

source = source.slice(0, syncRange.start)
  + helpers + '\n\n'
  + renamed + '\n\n'
  + wrapper
  + source.slice(syncRange.end);

const finalWrapper = functionRange('syncDerivedCache032').text;
for (const required of [marker, coreName, 'mirrorExploreSharedFeedAfterDerivedSync064']) {
  if (!source.includes(required)) throw new Error(`[064] final runtime missing: ${required}`);
}
if (!finalWrapper.includes(coreName) || !finalWrapper.includes('mirrorExploreSharedFeedAfterDerivedSync064')) {
  throw new Error('[064] derived catch-up wrapper missing');
}
if (helpers.includes('env.DB.') || helpers.includes('.prepare(')) {
  throw new Error('[064] shared Feed catch-up must not read D1 directly');
}

writeFileSync(workerPath, source, 'utf8');
console.log('[064] Derived Feed catch-up now mirrors only changed local snapshots into shared R2 without D1 reads.');

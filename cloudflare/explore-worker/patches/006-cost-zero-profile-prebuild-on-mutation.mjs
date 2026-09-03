import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_COST_ZERO_PROFILE_PREBUILD_ON_MUTATION_006';
if (source.includes(marker) || source.includes('refreshOrPrebuildPublicProfileFirstView')) {
  console.log('[SORIDRAW Worker] Cost-Zero selective profile mutation prebuild already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needle = `async function ${name}(`;
  const start = source.indexOf(needle);
  if (start < 0) throw new Error(`006 function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`006 function body missing: ${name}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return { start, end: index + 1, text: source.slice(start, index + 1) };
    }
  }
  throw new Error(`006 unterminated function: ${name}`);
};

const replaceFunctionText = (name, transform) => {
  const range = functionRange(name);
  const next = transform(range.text);
  if (!next || next === range.text) throw new Error(`006 ${name} transform made no change`);
  source = source.slice(0, range.start) + next + source.slice(range.end);
};

const helperAnchor = 'async function refreshPublicProfileFirstViewProfile(env, uid) {';
if (!source.includes(helperAnchor)) throw new Error('006 refresh helper anchor missing');
source = source.replace(helperAnchor, `// ${marker}\nasync function readOrMaterializePublicProfileFirstView(env, uid) {\n  let stored = parsePublicProfileFirstViewRow(await readPublicProfileFirstViewRow(env, uid));\n  if (stored) return { stored, created: false };\n  const materializedRow = await materializePublicProfileFirstView(env, uid);\n  stored = parsePublicProfileFirstViewRow(materializedRow);\n  return { stored, created: Boolean(stored) };\n}\n\nasync function refreshOrPrebuildPublicProfileFirstView(env, uid) {\n  const { stored, created } = await readOrMaterializePublicProfileFirstView(env, uid);\n  if (!stored) return [];\n  if (created) return [uid, stored.row.handle].filter(Boolean);\n  return await refreshPublicProfileFirstViewProfile(env, uid);\n}\n\nasync function refreshOrPrebuildPublicProfileTrackWindow(env, uid, trackCountDelta = 0) {\n  const { stored, created } = await readOrMaterializePublicProfileFirstView(env, uid);\n  if (!stored) return [];\n  if (created) return [uid, stored.row.handle].filter(Boolean);\n  return await refreshPublicProfileFirstViewTrackWindow(env, uid, trackCountDelta);\n}\n\n${helperAnchor}`);

const replaceCall = (functionName, from, to) => {
  replaceFunctionText(functionName, (text) => {
    if (!text.includes(from)) throw new Error(`006 ${functionName} call anchor missing`);
    return text.replace(from, to);
  });
};

// Low-frequency/public-content mutations only. Do NOT prebuild from follow/like
// paths: those social actions may be high-frequency and must stay lightweight.
replaceCall(
  'handleMyProfileUpdate',
  'const firstViewRefs = await refreshPublicProfileFirstViewProfile(env, authContext.uid);',
  'const firstViewRefs = await refreshOrPrebuildPublicProfileFirstView(env, authContext.uid);'
);
replaceCall(
  'handleProfileMediaUpload',
  'const firstViewRefs = await refreshPublicProfileFirstViewProfile(env, authContext.uid);',
  'const firstViewRefs = await refreshOrPrebuildPublicProfileFirstView(env, authContext.uid);'
);
replaceCall(
  'handlePublication',
  'const firstViewRefs = await refreshPublicProfileFirstViewTrackWindow(env, authContext.uid, wasPublishedForFirstView ? 0 : 1);',
  'const firstViewRefs = await refreshOrPrebuildPublicProfileTrackWindow(env, authContext.uid, wasPublishedForFirstView ? 0 : 1);'
);
replaceCall(
  'handleVisibility',
  'const firstViewRefs = await refreshPublicProfileFirstViewTrackWindow(env, authContext.uid, firstViewDelta);',
  'const firstViewRefs = await refreshOrPrebuildPublicProfileTrackWindow(env, authContext.uid, firstViewDelta);'
);

const required = [
  marker,
  'readOrMaterializePublicProfileFirstView',
  'refreshOrPrebuildPublicProfileFirstView',
  'refreshOrPrebuildPublicProfileTrackWindow',
  'materializePublicProfileFirstView(env, uid)',
];
for (const needle of required) {
  if (!source.includes(needle)) throw new Error(`006 verification failed: ${needle}`);
}

for (const name of ['handleMyProfileUpdate', 'handleProfileMediaUpload']) {
  const text = functionRange(name).text;
  if (!text.includes('refreshOrPrebuildPublicProfileFirstView')) throw new Error(`006 selective profile prebuild missing in ${name}`);
}
for (const name of ['handlePublication', 'handleVisibility']) {
  const text = functionRange(name).text;
  if (!text.includes('refreshOrPrebuildPublicProfileTrackWindow')) throw new Error(`006 selective track prebuild missing in ${name}`);
}
for (const name of ['handleFollow', 'handleLike']) {
  const text = functionRange(name).text;
  if (text.includes('refreshOrPrebuildPublicProfileFirstView') || text.includes('refreshOrPrebuildPublicProfileTrackWindow')) {
    throw new Error(`006 high-frequency social prebuild forbidden in ${name}`);
  }
}

writeFileSync(workerPath, source, 'utf8');
console.log('[SORIDRAW Worker] Cost-Zero selective profile snapshot prebuild prepared.');

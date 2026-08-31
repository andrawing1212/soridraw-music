import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_COST_ZERO_PROFILE_PREBUILD_ON_MUTATION_006';
if (source.includes(marker) || source.includes('prebuildPublicProfileFirstViewIfMissing')) {
  console.log('[SORIDRAW Worker] Cost-Zero profile mutation prebuild already applied.');
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
source = source.replace(helperAnchor, `// ${marker}\nasync function prebuildPublicProfileFirstViewIfMissing(env, uid, stored) {\n  if (stored) return stored;\n  const materializedRow = await materializePublicProfileFirstView(env, uid);\n  return parsePublicProfileFirstViewRow(materializedRow);\n}\n\n${helperAnchor}`);

for (const name of [
  'refreshPublicProfileFirstViewProfile',
  'refreshPublicProfileFirstViewTrackWindow',
  'patchPublicProfileFirstViewLikeCount',
]) {
  replaceFunctionText(name, (text) => {
    const pattern = /const\s+stored\s*=\s*parsePublicProfileFirstViewRow\(await\s+readPublicProfileFirstViewRow\(env,\s*uid\)\);\s*if\s*\(!stored\)\s*return\s*\[\];/;
    if (!pattern.test(text)) throw new Error(`006 missing empty-snapshot guard in ${name}`);
    return text.replace(pattern, `let stored = parsePublicProfileFirstViewRow(await readPublicProfileFirstViewRow(env, uid));\n    if (!stored) {\n      stored = await prebuildPublicProfileFirstViewIfMissing(env, uid, stored);\n      if (!stored) return [];\n      return [uid, stored.row.handle].filter(Boolean);\n    }`);
  });
}

const required = [
  marker,
  'prebuildPublicProfileFirstViewIfMissing',
  'materializePublicProfileFirstView(env, uid)',
];
for (const needle of required) {
  if (!source.includes(needle)) throw new Error(`006 verification failed: ${needle}`);
}
for (const name of [
  'refreshPublicProfileFirstViewProfile',
  'refreshPublicProfileFirstViewTrackWindow',
  'patchPublicProfileFirstViewLikeCount',
]) {
  const range = functionRange(name);
  const text = source.slice(range.start, range.end);
  if (!text.includes('prebuildPublicProfileFirstViewIfMissing')) {
    throw new Error(`006 prebuild call missing in ${name}`);
  }
}

writeFileSync(workerPath, source, 'utf8');
console.log('[SORIDRAW Worker] Cost-Zero profile snapshot prebuild-on-mutation prepared.');

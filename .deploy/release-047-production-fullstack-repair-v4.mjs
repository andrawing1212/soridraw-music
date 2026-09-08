import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const temp = String(process.env.RUNNER_TEMP || '').trim();
if (!temp) throw new Error('RUNNER_TEMP is required');
const sourcePath = join(temp, 'release-047-production-fullstack-repair.mjs');
const runtimePath = join(temp, 'release-047-production-fullstack-repair-v4-runtime.mjs');
let source = readFileSync(sourcePath, 'utf8');

const oldBlock = `for (const patch of PATCHES) {
  run(process.execPath, [patch], { cwd: ROOT, env: { ...process.env, SORIDRAW_REMOTE_WORKER_DIR: canonicalDir } });
}
run(process.execPath, ['--check', join(canonicalDir, 'worker.js')], { cwd: ROOT });`;

const newBlock = `const canonicalPath = join(canonicalDir, 'worker.js');
const semanticState = (candidate, tokens, label) => {
  const hits = tokens.filter((token) => candidate.includes(token));
  if (hits.length === 0) return 'none';
  if (hits.length === tokens.length) return 'all';
  throw new Error(label + ' partial executable runtime detected: ' + hits.join(', '));
};
const mirror020Tokens = [
  'EXPLORE_MIRROR_ROUTE_020',
  'EXPLORE_MIRROR_SYNC_ROUTE_020',
  'fanoutExploreMirror020',
  'X-SORIDRAW-Explore-Mirror',
  'applyExploreMirrorPayload020',
];
const mirror022Tokens = [
  'targetCount: settled.length',
  'failures.length',
  'mirror targets incomplete',
];
const mirror023Tokens = [
  'EXPLORE_MIRROR_PREVIEW',
  'EXPLORE_MIRROR_TEST',
  'service.fetch(request)',
];
let candidateSource = readFileSync(canonicalPath, 'utf8');
const state020 = semanticState(candidateSource, mirror020Tokens, 'mirror 020');
const state022 = semanticState(candidateSource, mirror022Tokens, 'mirror 022');
const state023 = semanticState(candidateSource, mirror023Tokens, 'mirror 023');

if (state020 === 'all') {
  if (state022 !== 'all' || state023 !== 'all') {
    throw new Error('existing mirror 020 runtime is not accompanied by complete 022/023 semantics; refusing unsafe partial patch replay');
  }
  console.log('EXPLORE_MIRROR_EXECUTABLE_RUNTIME_ALREADY_PRESENT=SKIP_PATCH_REPLAY');
} else {
  if (state022 !== 'none' || state023 !== 'none') {
    throw new Error('022/023 semantics exist without complete 020 runtime; refusing unsafe patch replay');
  }
  for (const patch of PATCHES) {
    run(process.execPath, [patch], { cwd: ROOT, env: { ...process.env, SORIDRAW_REMOTE_WORKER_DIR: canonicalDir } });
  }
  console.log('EXPLORE_MIRROR_EXECUTABLE_RUNTIME_APPLIED=PASS');
}
run(process.execPath, ['--check', canonicalPath], { cwd: ROOT });`;

if (!source.includes(oldBlock)) throw new Error('v4 transform anchor missing');
source = source.replace(oldBlock, newBlock);
writeFileSync(runtimePath, source, 'utf8');
console.log('EXPLORE_047_REPAIR_V4_CONTROLLER=PASS');
await import(`${pathToFileURL(runtimePath).href}?v=${Date.now()}`);

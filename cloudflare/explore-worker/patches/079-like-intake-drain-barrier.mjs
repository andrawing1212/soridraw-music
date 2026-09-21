import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker165 = 'SORIDRAW_LIKE_LEGACY_INTAKE_DRAIN_BARRIER_165_20260921';
if (source.includes(marker165)) {
  console.log('[079/165] legacy like intake drain barrier already applied.');
  process.exit(0);
}

for (const required of [
  'SORIDRAW_LIKE_CUTOVER_PRECONDITION_PROOF_164_20260921',
  'readLikeCutoverState162',
  'assertLegacyLikeWriterOpen163',
  'handleLikeD1Core',
  'handleLikeBatch034',
  'enforceExploreLikeBatchEdgeRateLimit054',
]) {
  if (!source.includes(required)) throw new Error('[079/165] required runtime missing: ' + required);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error('[079/165] function missing: ' + name);
  const brace = source.indexOf('{', start);
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
    if ('"\'\`'.includes(char)) { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) {
      return { start, end: index + 1, text: source.slice(start, index + 1) };
    }
  }
  throw new Error('[079/165] unterminated function: ' + name);
};

const replaceFunction = (name, text) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + text + source.slice(range.end);
};

const cutoverState = functionRange('readLikeCutoverState162');
const helpers = `

// ${marker165}
// Separate from the final 162 reader marker: readers remain on legacy while
// NEW legacy intake is paused. Scheduled legacy aggregation intentionally does
// not call this guard so already-queued 035/066/069/075 work can drain to zero.
const exploreLikeDrainKey165 = 'internal/explore/like-cutover-drain-v165/active.json';

async function readLikeDrainState165(env) {
  const bucket = env?.PROFILE_MEDIA || null;
  if (!bucket) throw new Error('[SORIDRAW 165] shared drain bucket unavailable');
  const object = await bucket.get(exploreLikeDrainKey165);
  if (!object) return { mode: 'open', drainToken: null };
  let value = null;
  try { value = JSON.parse(await object.text()); }
  catch { throw new Error('[SORIDRAW 165] drain manifest unreadable'); }
  const token = String(value?.drainToken || '').trim();
  const armed = Number(value?.schemaVersion) === 1 &&
    value?.phase === 'draining' &&
    value?.allEnvironmentIntakeReady === true &&
    value?.ownerProtocol === 'uid143-track147-158' &&
    token.length > 0 && token.length <= 128;
  if (!armed) throw new Error('[SORIDRAW 165] drain manifest present but not fully armed');
  return { mode: 'draining', drainToken: token };
}

async function assertLegacyLikeIntakeOpen165(env) {
  let state;
  try {
    state = await readLikeDrainState165(env);
  } catch (error) {
    console.warn('[SORIDRAW 165] drain state unavailable; fail closed:', String(error?.message || error || 'unknown'));
    throwApi(
      'LIKE_CUTOVER_STATE_UNAVAILABLE',
      '좋아요 전환 상태를 확인 중입니다. 잠시 후 다시 시도해 주세요.',
      503,
      { 'Retry-After': '30' },
    );
  }
  if (state?.mode === 'draining') {
    throwApi(
      'LIKE_CUTOVER_DRAINING',
      '좋아요 전환 준비 중입니다. 변경 내용은 기기에 보관되며 잠시 후 다시 동기화됩니다.',
      503,
      { 'Retry-After': '30' },
    );
  }
  if (!state || state.mode !== 'open') {
    throwApi(
      'LIKE_CUTOVER_STATE_UNAVAILABLE',
      '좋아요 전환 상태를 확인 중입니다. 잠시 후 다시 시도해 주세요.',
      503,
      { 'Retry-After': '30' },
    );
  }
  return state;
}
`;
source = source.slice(0, cutoverState.end) + helpers + source.slice(cutoverState.end);

{
  const range = functionRange('handleLikeD1Core');
  const anchor = '  await enforceExploreLikeBatchEdgeRateLimit054(env, authContext.uid);\n';
  if (range.text.split(anchor).length !== 2) throw new Error('[079/165] direct intake anchor changed');
  replaceFunction('handleLikeD1Core',
    range.text.replace(anchor, anchor + '  await assertLegacyLikeIntakeOpen165(env);\n'));
}

{
  const range = functionRange('handleLikeBatch034');
  const anchor = '  await enforceExploreLikeBatchEdgeRateLimit054(env, authContext.uid);\n';
  if (range.text.split(anchor).length !== 2) throw new Error('[079/165] batch intake anchor changed');
  replaceFunction('handleLikeBatch034',
    range.text.replace(anchor, anchor + '  await assertLegacyLikeIntakeOpen165(env);\n'));
}

const scheduled = functionRange('processExploreLikeBatches035Core056').text;
if (scheduled.includes('assertLegacyLikeIntakeOpen165')) {
  throw new Error('[079/165] scheduled drain path must stay open to empty legacy queues');
}

for (const required of [
  marker165,
  'exploreLikeDrainKey165',
  'readLikeDrainState165',
  'assertLegacyLikeIntakeOpen165',
  'LIKE_CUTOVER_DRAINING',
  "'Retry-After': '30'",
]) {
  if (!source.includes(required)) throw new Error('[079/165] final runtime missing: ' + required);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[079/165] New legacy like intake pauses on the shared drain marker; scheduled legacy queues remain drainable.');

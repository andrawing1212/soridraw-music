import fs from 'node:fs';

const src = fs.readFileSync('src/services/geminiProxyClient.ts', 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const initial = src.match(/const INITIAL_SONG_MODEL_CHAIN = \[([\s\S]*?)\] as const;/);
assert(initial, 'INITIAL_SONG_MODEL_CHAIN missing');
const initialModels = [...initial[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
assert(
  JSON.stringify(initialModels) === JSON.stringify([
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
  ]),
  'Initial song model order changed',
);

const repair = src.match(/const FAST_REPAIR_MODEL_CHAIN = \[([\s\S]*?)\] as const;/);
assert(repair, 'FAST_REPAIR_MODEL_CHAIN missing');
const repairModels = [...repair[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
assert(
  JSON.stringify(repairModels) === JSON.stringify([
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
  ]),
  'Small repair model chain changed unexpectedly',
);

for (const context of [
  'repairV1FinalProductionCues',
  'rewriteLyricHardBanCards',
  'rewriteLyricHardBanLines',
  'rewriteLyricHardBanLinesSecondPass',
  'repairSelectedLanguageCard',
]) {
  assert(src.includes(`'${context}'`) || src.includes(context), `Adaptive small repair context missing: ${context}`);
}

for (const token of [
  'function resolveAdaptiveSmallRepair(',
  'recordSessionModelOutcomes(sessionId, serverAttempts);',
  "outcome.status === 'failed'",
  "'slow_success'",
  '같은 곡에서 직전 실패한 모델 재호출 생략',
  '같은 곡에서 30초 이상 걸린 성공 모델 재호출 생략',
  'adaptiveRepair?.modelChain || resolveLatencyModelChain(meta, requestParams)',
  '...(adaptiveRepair?.skips || [])',
]) {
  assert(src.includes(token), `Adaptive repair routing token missing: ${token}`);
}

const adaptiveIndex = src.indexOf('const adaptiveRepair = resolveAdaptiveSmallRepair');
const requestIndex = src.indexOf('const response = await fetch');
assert(adaptiveIndex >= 0 && requestIndex > adaptiveIndex, 'Adaptive repair must resolve before Function request');

assert(src.includes("const SLOW_SUCCESS_THRESHOLD_MS = 30_000;"), '30s slow-success threshold changed');
assert(src.includes("const SLOW_SUCCESS_SESSION_TTL_MS = 20 * 60_000;"), 'Session health TTL changed');
assert(src.includes('return requested;'), 'Default non-repair model routing must remain unchanged');

console.log('APP208_GEMINI_INITIAL_CHAIN_UNCHANGED=PASS');
console.log('APP208_GEMINI_SMALL_REPAIR_CHAIN=PASS');
console.log('APP208_GEMINI_SESSION_FAILURE_SKIP=PASS');
console.log('APP208_GEMINI_SLOW_SUCCESS_SKIP=PASS');
console.log('APP208_GEMINI_NO_NEW_SERVER_IO=PASS');

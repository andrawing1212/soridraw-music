import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_LIKE_EDGE_RATE_LIMIT_054_20260915';
const marker160 = 'SORIDRAW_DIRECT_LIKE_EDGE_RATE_LIMIT_160_20260921';
const marker185 = 'SORIDRAW_LEGACY_LIKE_DIRECT_NORMALIZE_185_20260922';
const marker188 = 'SORIDRAW_FINAL_LIKE_W1_HYBRID_188_20260922';
const has054 = source.includes(marker);
const has160 = source.includes(marker160);
const has185 = source.includes(marker185);
const has188 = source.includes(marker188);
if (has054 && has160) {
  console.log('[054/160] Batch and direct Explore like edge rate limits already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[054] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[054] function body missing: ${name}`);
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
  throw new Error(`[054] unterminated function: ${name}`);
};

// The repository-owned canonical Worker is the already-built current runtime.
// Build-time patch markers can be removed by bundling, so guard on durable behavior
// that must exist in the 053 baseline rather than on a source comment marker.
const requiredRuntime = [
  'handleLikeBatch034',
  'handleLikeD1Core',
  'enforceUserRateLimit',
  'EXPLORE_LIKE_BATCH_MAX_034',
  'throwApi',
];
if (!has185 && !has188) {
  requiredRuntime.push(
    'enforceExploreLikeBatchRateLimit034',
    'readExploreLikeBatchStates035',
    'enqueueExploreLikeBatch035',
    'enqueueExploreLikeUserQueue075',
    'exploreLikeW1Batch040',
    'effectiveMutations',
  );
}
for (const required of requiredRuntime) {
  if (!source.includes(required)) throw new Error(`[054] required runtime behavior missing: ${required}`);
}

const edgeHelper = `// ${marker}\nasync function enforceExploreLikeBatchEdgeRateLimit054(env, uid) {\n  const normalizedUid = String(uid || '').trim();\n  if (!normalizedUid) throwApi('UNAUTHENTICATED', '로그인이 필요합니다.', 401);\n  const limiter = env?.LIKE_RATE_LIMITER;\n  if (!limiter || typeof limiter.limit !== 'function') {\n    console.error('[SORIDRAW 054] LIKE_RATE_LIMITER binding missing');\n    throwApi('RATE_LIMIT_UNAVAILABLE', '좋아요 보호 기능을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.', 503);\n  }\n  const result = await limiter.limit({ key: 'like:' + normalizedUid });\n  if (!result?.success) {\n    throwApi('RATE_LIMITED', '좋아요 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', 429, { 'Retry-After': '60' });\n  }\n}\n\n`;

if (!has054) {
  const batch = functionRange('handleLikeBatch034');
  const oldRateCall = 'await enforceExploreLikeBatchRateLimit034(env, authContext.uid, mutations.length);';
  if (!batch.text.includes(oldRateCall)) throw new Error('[054] D1 like rate-limit call missing from batch handler');
  const nextBatch = batch.text.replace(oldRateCall, 'await enforceExploreLikeBatchEdgeRateLimit054(env, authContext.uid);');
  source = source.slice(0, batch.start) + edgeHelper + nextBatch + source.slice(batch.end);
} else {
  const batch = functionRange('handleLikeBatch034').text;
  if (!batch.includes('enforceExploreLikeBatchEdgeRateLimit054(env, authContext.uid)')) {
    throw new Error('[054/160] 054 marker exists but batch edge limiter is missing');
  }
}

// 160: the legacy direct PUT/DELETE route used enforceUserRateLimit(), which
// writes RATE_DB on every click. Keep the old route compatible while removing
// that extra D1 write by using the same Cloudflare edge limiter as batch.
if (!has160) {
  const direct = functionRange('handleLikeD1Core');
  const directRateCall = 'await enforceUserRateLimit(env, authContext.uid, "like", RATE_LIMITS.like);';
  if (!direct.text.includes(directRateCall)) {
    throw new Error('[054/160] direct D1 like rate-limit call missing');
  }
  const nextDirect = direct.text.replace(
    directRateCall,
    '// ' + marker160 + '\n  await enforceExploreLikeBatchEdgeRateLimit054(env, authContext.uid);'
  );
  source = source.slice(0, direct.start) + nextDirect + source.slice(direct.end);
}

const finalBatch = functionRange('handleLikeBatch034').text;
const finalEdge = functionRange('enforceExploreLikeBatchEdgeRateLimit054').text;
const finalDirect = functionRange('handleLikeD1Core').text;
if (!source.includes(marker160) ||
    !finalDirect.includes('enforceExploreLikeBatchEdgeRateLimit054(env, authContext.uid)') ||
    finalDirect.includes('enforceUserRateLimit(')) {
  throw new Error('[054/160] direct like route did not retire D1 rate-limit write');
}
if (!finalBatch.includes('enforceExploreLikeBatchEdgeRateLimit054(env, authContext.uid)')) {
  throw new Error('[054] batch handler did not switch to edge rate limit');
}
if (finalBatch.includes('enforceExploreLikeBatchRateLimit034(')) {
  throw new Error('[054] D1 rate limit remained on normal batch path');
}
if (has188) {
  if (!finalBatch.includes('enqueueExploreLikeBatch035(env, authContext.uid, mutations, receivedAt)') ||
      finalBatch.includes('adjustExploreLikeCounterDelta(')) {
    throw new Error('[054/188] final W1 queued batch shape is invalid');
  }
} else if (!has185) {
  if (!finalBatch.includes('effectiveMutations')) {
    throw new Error('[054] protected like batching behavior missing: effectiveMutations');
  }
  const hasBatch035 = finalBatch.includes('enqueueExploreLikeBatch035');
  const hasQueue075 = finalBatch.includes('enqueueExploreLikeUserQueue075');
  if (!hasBatch035 && !hasQueue075) {
    throw new Error('[054] no supported like queue intake remains after edge-limit patch');
  }
  if (source.includes('SORIDRAW_EXPLORE_LIKE_INTAKE_W1_HOTPATH_055_20260915') && !hasBatch035) {
    throw new Error('[054] 055 W1 intake marker exists but batch handler no longer uses enqueueExploreLikeBatch035');
  }
} else {
  if (!finalBatch.includes('adjustExploreLikeCounterDelta(') ||
      finalBatch.includes('enqueueExploreLikeBatch035(')) {
    throw new Error('[054/185] direct-settled batch shape is invalid');
  }
}
for (const forbidden of ['api_rate_limits', 'exploreRateDb031(', '.DB.prepare', 'RATE_DB']) {
  if (finalEdge.includes(forbidden)) throw new Error(`[054] edge limiter unexpectedly uses D1: ${forbidden}`);
}
for (const required of ["env?.LIKE_RATE_LIMITER", ".limit({ key: 'like:' + normalizedUid })", "'RATE_LIMITED'", "'Retry-After': '60'"]) {
  if (!finalEdge.includes(required)) throw new Error(`[054] edge limiter missing: ${required}`);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[054/160] Batch and legacy direct like routes use Cloudflare Rate Limiting binding; D1 api_rate_limits write retired from both like hot paths.');

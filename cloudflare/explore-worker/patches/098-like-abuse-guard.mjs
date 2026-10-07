import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const path = join(remoteDir, 'worker.js');
let source = readFileSync(path, 'utf8');
const marker = 'SORIDRAW_LIKE_ABUSE_GUARD_380_20261008';
if (source.includes(marker)) {
  console.log('[098/380] Like abuse guard already applied.');
  process.exit(0);
}
const replaceOnce = (before, after) => {
  if (source.split(before).length !== 2) throw new Error('[098] Worker anchor drift: ' + before);
  source = source.replace(before, after);
};
replaceOnce('  const mutations = [...byTrack.values()];\n  await enforceExploreLikeBatchEdgeRateLimit054(env, authContext.uid);', `  const mutations = [...byTrack.values()];
  // ${marker}: validate before any D1; count unique final track intents, not HTTP batches.
  if (mutations.some(row => !/^[a-zA-Z0-9_-]{16,128}$/.test(row.operationId))) {
    throwApi('INVALID_SOCIAL_INTENT', '좋아요 요청 순서를 확인해 주세요.', 400);
  }
  await enforceExploreLikeBatchEdgeRateLimit054(env, authContext.uid);
  await consumeSocialAbuse380(env, authContext.uid, 'like', mutations.map(row => ({
    target: row.trackId, desired: row.liked, operationId: row.operationId,
  })));`);
// Current apps use the frozen W1 batch route. An old per-track direct writer
// must not bypass the normalized guard or create a W3+ mutation.
replaceOnce('  // SORIDRAW_DIRECT_LIKE_EDGE_RATE_LIMIT_160_20260921', `  throwApi('LIKE_CLIENT_REFRESH_REQUIRED', '좋아요 저장 방식을 업데이트했습니다. 새로고침 후 다시 시도해 주세요.', 409);
  // SORIDRAW_DIRECT_LIKE_EDGE_RATE_LIMIT_160_20260921`);
// Edge service errors also fail closed with a typed, deterministic 503.
replaceOnce("  const result = await limiter.limit({ key: 'like:' + normalizedUid });", `  let result;
  try { result = await limiter.limit({ key: 'like:' + normalizedUid }); }
  catch { socialAbuseUnavailable380(); }`);
replaceOnce("throwApi('RATE_LIMITED', '좋아요 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', 429, { 'Retry-After': '60' });", 'socialAbuseLimited380(60_000);');
if (!source.includes('SORIDRAW_SOCIAL_ABUSE_STATE_380_20261008')) {
  source += '\n' + readFileSync(new URL('../candidates/social-abuse-380.js', import.meta.url), 'utf8');
}
writeFileSync(path, source);
console.log('[098/380] Candidate-only normalized like abuse gate applied.');

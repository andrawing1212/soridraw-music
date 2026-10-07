import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_FOLLOW_ABUSE_GUARD_380_20261007';
if (source.includes(marker)) {
  console.log('[097/380] Follow abuse guard already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needles = ['async function ' + name + '(', 'function ' + name + '('];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error('[097] function missing: ' + name);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error('[097] body missing: ' + name);
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
    if (char === '"' || char === "'" || char.charCodeAt(0) === 96) { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return { start, end: index + 1, text: source.slice(start, index + 1) };
  }
  throw new Error('[097] unterminated function: ' + name);
};

const oldLimiter = functionRange('enforceFollowEdgeRateLimit355');
if (!oldLimiter.text.includes("key: 'follow:' + uid") ||
    !oldLimiter.text.includes('internal/explore/follow-rate-v355/') ||
    !oldLimiter.text.includes('RATE_LIMITS.follow')) {
  throw new Error('[097] existing follow limiter contract drifted');
}

const runtime = readFileSync(new URL('../candidates/social-abuse-380.js', import.meta.url), 'utf8');
const newLimiter = `async function enforceFollowEdgeRateLimit355(env, uid, targetUid, following, operationId) {
  // ${marker}
  const limiter = env?.LIKE_RATE_LIMITER;
  if (!limiter || typeof limiter.limit !== 'function') socialAbuseUnavailable380();
  let allowed;
  try { allowed = await limiter.limit({ key: 'follow:' + uid }); }
  catch { socialAbuseUnavailable380(); }
  if (!allowed?.success) socialAbuseLimited380(60_000);
  await consumeSocialAbuse380(env, uid, 'follow', [{ target: targetUid, desired: following, operationId }]);
}`;

source = source.slice(0, oldLimiter.start) + newLimiter + source.slice(oldLimiter.end);

const overlay = functionRange('handleFollowOverlay354');
const oldSequence = [
  '  await enforceFollowEdgeRateLimit355(env, actor);',
  '  if (following) {',
  '    const row = await env.DB.prepare("SELECT uid FROM public_profiles WHERE uid = ? AND is_public = 1 LIMIT 1").bind(target).first();',
  '    if (!row) throwApi("NOT_FOUND", "공개 크리에이터를 찾을 수 없습니다.", 404);',
  '  }',
  '  // JSON uses the existing Content-Type CORS contract; no auth/CORS change.',
  '  let payload = null;',
  '  try { payload = await request.json(); } catch {}',
  '  const expected = payload?.followExpectedRevision;',
].join('\n');
const newSequence = [
  '  // Parse ordered identity before the abuse gate. Unordered negotiation has no R2 receipt.',
  '  let payload = null;',
  '  try { payload = await request.json(); } catch {}',
  '  const expected = payload?.followExpectedRevision;',
  '  if (typeof payload?.followOperationId !== "string" || !/^[a-zA-Z0-9_-]{16,128}$/.test(payload.followOperationId) ||',
  '      !Number.isSafeInteger(expected) || expected < 0) {',
  '    throwApi("FOLLOW_ORDER_REQUIRED", "팔로우 상태를 확인한 후 다시 시도해 주세요.", 409,',
  '      { "X-Soridraw-Follow-Protocol": "354" });',
  '  }',
  '  await enforceFollowEdgeRateLimit355(env, actor, target, following, payload.followOperationId);',
  '  if (following) {',
  '    const row = await env.DB.prepare("SELECT uid FROM public_profiles WHERE uid = ? AND is_public = 1 LIMIT 1").bind(target).first();',
  '    if (!row) throwApi("NOT_FOUND", "공개 크리에이터를 찾을 수 없습니다.", 404);',
  '  }',
].join('\n');
if (!overlay.text.includes(oldSequence)) throw new Error('[097] overlay limiter/body anchor missing');
const nextOverlay = overlay.text.replace(oldSequence, newSequence);
source = source.slice(0, overlay.start) + nextOverlay + source.slice(overlay.end);

const finalLimiter = functionRange('enforceFollowEdgeRateLimit355').text;
const finalOverlay = functionRange('handleFollowOverlay354').text;
for (const required of [marker, 'consumeSocialAbuse380', "key: 'follow:' + uid"]) {
  if (!finalLimiter.includes(required)) throw new Error('[097] limiter missing: ' + required);
}
if (finalLimiter.includes('env.DB') || finalLimiter.includes('RATE_DB')) {
  throw new Error('[097] abuse guard must remain D1/RATE_DB free');
}
if (!finalOverlay.includes('payload?.followOperationId') ||
    finalOverlay.indexOf('try { payload = await request.json(); }') > finalOverlay.indexOf('enforceFollowEdgeRateLimit355(')) {
  throw new Error('[097] ordered operation must be parsed before abuse guard');
}
if (finalOverlay.indexOf('FOLLOW_ORDER_REQUIRED') < 0 ||
    finalOverlay.indexOf('FOLLOW_ORDER_REQUIRED') > finalOverlay.indexOf('env.DB.prepare("SELECT uid FROM public_profiles')) {
  throw new Error('[097] unordered follow must fail before target D1 lookup');
}

if (!source.includes('SORIDRAW_SOCIAL_ABUSE_STATE_380_20261008')) source += '\n' + runtime;
writeFileSync(workerPath, source, 'utf8');
console.log('[097/380] Follow final-state abuse guard applied: native burst + R2 account/day + progressive pair cooldown, D1-free.');

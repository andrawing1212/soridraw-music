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

const newLimiter = [
  "async function enforceFollowEdgeRateLimit355(env, uid, targetUid = '', following = false, operationId = '') {",
  '  // ' + marker,
  "  const normalizedUid = String(uid || '').trim();",
  "  const normalizedTarget = String(targetUid || '').trim();",
  "  const normalizedOperationId = String(operationId || '').trim();",
  '  const limiter = env?.LIKE_RATE_LIMITER;',
  "  if (!normalizedUid || !limiter || typeof limiter.limit !== 'function' || !env?.PROFILE_MEDIA) {",
  "    throwApi('RATE_LIMIT_UNAVAILABLE', '팔로우 보호 기능을 확인하는 중입니다.', 503);",
  '  }',
  "  if (!(await limiter.limit({ key: 'follow:' + normalizedUid }))?.success) {",
  "    throwApi('RATE_LIMITED', '잠시 후 다시 시도해 주세요.', 429, { 'Retry-After': '60' });",
  '  }',
  '',
  '  // The first unordered protocol negotiation cannot mutate overlay authority.',
  '  // Do not spend a persistent R2 rate receipt until an ordered operation exists.',
  "  if (!normalizedTarget || !/^[a-zA-Z0-9_-]{16,128}$/.test(normalizedOperationId)) return;",
  '',
  '  const now = Date.now();',
  '  const tenMinuteMs = 10 * 60 * 1000;',
  '  const dayMs = 24 * 60 * 60 * 1000;',
  '  const windowLimit = 30;',
  '  const dayLimit = 120;',
  '  const pairCooldowns = [30 * 1000, 2 * 60 * 1000, 10 * 60 * 1000, 60 * 60 * 1000];',
  '  const pairQuietResetMs = 24 * 60 * 60 * 1000;',
  '  const pairMax = 32;',
  "  const key = 'internal/explore/follow-rate-v355/' + encodeURIComponent(normalizedUid) + '.json';",
  '  const windowStart = Math.floor(now / tenMinuteMs) * tenMinuteMs;',
  '  const dayStart = Math.floor(now / dayMs) * dayMs;',
  '',
  '  for (let attempt = 0; attempt < 6; attempt += 1) {',
  '    const object = await env.PROFILE_MEDIA.get(key);',
  '    let old = null;',
  '    if (object) {',
  '      try { old = JSON.parse(await object.text()); } catch {}',
  '      if (!old || !Number.isSafeInteger(old.windowStart) || !Number.isSafeInteger(old.count) ||',
  '          old.count < 1 || old.windowStart > windowStart) {',
  "        throwApi('RATE_LIMIT_UNAVAILABLE', '팔로우 보호 상태를 다시 확인해 주세요.', 503);",
  '      }',
  '    }',
  '',
  "    const rawPairs = old?.pairs && typeof old.pairs === 'object' && !Array.isArray(old.pairs) ? old.pairs : {};",
  '    const pairs = {};',
  '    for (const [pairUid, row] of Object.entries(rawPairs)) {',
  "      if (!row || typeof row !== 'object' || Array.isArray(row)) continue;",
  '      const updatedAt = Number(row.updatedAt || row.lastAcceptedAt || 0);',
  '      if (!Number.isSafeInteger(updatedAt) || updatedAt <= 0 || now - updatedAt > pairQuietResetMs) continue;',
  '      pairs[pairUid] = row;',
  '    }',
  '',
  '    const prior = pairs[normalizedTarget] || null;',
  "    if (prior && String(prior.lastOperationId || '') === normalizedOperationId &&",
  '        Boolean(prior.lastDesired) === Boolean(following)) {',
  '      // Lost-response retry: no second rate receipt and no cooldown penalty.',
  '      return;',
  '    }',
  '',
  '    const nextAllowedAt = Number(prior?.nextAllowedAt || 0);',
  '    if (Number.isSafeInteger(nextAllowedAt) && nextAllowedAt > now) {',
  '      const retrySeconds = Math.max(1, Math.ceil((nextAllowedAt - now) / 1000));',
  "      throwApi('RATE_LIMITED', '같은 계정의 팔로우 변경을 잠시 모아 반영하고 있습니다.', 429,",
  "        { 'Retry-After': String(Math.min(3600, retrySeconds)) });",
  '    }',
  '',
  '    const count = old?.windowStart === windowStart ? Number(old.count) + 1 : 1;',
  '    const oldDayStart = Number(old?.dayStart || 0);',
  '    const oldDayCount = Number(old?.dayCount || 0);',
  '    const dayCount = oldDayStart === dayStart && Number.isSafeInteger(oldDayCount) && oldDayCount >= 0',
  '      ? oldDayCount + 1 : 1;',
  '    if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(dayCount) || dayCount < 1) {',
  "      throwApi('RATE_LIMIT_UNAVAILABLE', '팔로우 보호 상태를 확인하는 중입니다.', 503);",
  '    }',
  '    if (count > windowLimit || dayCount > dayLimit) {',
  '      const retrySeconds = count > windowLimit',
  '        ? Math.max(60, Math.ceil((windowStart + tenMinuteMs - now) / 1000))',
  '        : Math.max(60, Math.ceil((dayStart + dayMs - now) / 1000));',
  "      throwApi('RATE_LIMITED', '팔로우 변경 요청이 많아 잠시 제한했습니다.', 429,",
  "        { 'Retry-After': String(Math.min(3600, retrySeconds)) });",
  '    }',
  '',
  '    const quiet = !prior || now - Number(prior.lastAcceptedAt || 0) >= pairQuietResetMs;',
  '    const desiredChanged = !prior || Boolean(prior.lastDesired) !== Boolean(following);',
  '    const rawLevel = Number(prior?.level);',
  '    const priorLevel = Number.isSafeInteger(rawLevel) ? Math.max(0, Math.min(3, rawLevel)) : 0;',
  '    const level = quiet ? 0 : desiredChanged ? Math.min(3, priorLevel + 1) : priorLevel;',
  '    const cooldownMs = pairCooldowns[level];',
  '    pairs[normalizedTarget] = {',
  '      lastAcceptedAt: now, updatedAt: now, lastDesired: Boolean(following),',
  '      lastOperationId: normalizedOperationId, level, nextAllowedAt: now + cooldownMs,',
  '    };',
  '',
  '    const boundedPairs = Object.fromEntries(',
  '      Object.entries(pairs)',
  '        .sort((a, b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0))',
  '        .slice(0, pairMax),',
  '    );',
  '    const nextState = { schemaVersion: 380, windowStart, count, dayStart, dayCount, pairs: boundedPairs, updatedAt: now };',
  '    const saved = await env.PROFILE_MEDIA.put(key, JSON.stringify(nextState), {',
  "      onlyIf: object ? { etagMatches: object.etag } : { etagDoesNotMatch: '*' },",
  "      httpMetadata: { contentType: 'application/json; charset=utf-8' },",
  '    });',
  '    if (saved) return;',
  '  }',
  "  throwApi('RATE_LIMIT_UNAVAILABLE', '팔로우 보호 상태를 다시 확인해 주세요.', 503);",
  '}',
].join('\n');

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
].join('\n');
const newSequence = [
  '  // Parse ordered identity before the abuse gate. Unordered negotiation has no R2 receipt.',
  '  let payload = null;',
  '  try { payload = await request.json(); } catch {}',
  '  await enforceFollowEdgeRateLimit355(env, actor, target, following, payload?.followOperationId);',
  '  const expected = payload?.followExpectedRevision;',
  '  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(payload?.followOperationId || "") ||',
  '      !Number.isSafeInteger(expected) || expected < 0) {',
  '    throwApi("FOLLOW_ORDER_REQUIRED", "팔로우 상태를 확인한 후 다시 시도해 주세요.", 409,',
  '      { "X-Soridraw-Follow-Protocol": "354" });',
  '  }',
  '  if (following) {',
  '    const row = await env.DB.prepare("SELECT uid FROM public_profiles WHERE uid = ? AND is_public = 1 LIMIT 1").bind(target).first();',
  '    if (!row) throwApi("NOT_FOUND", "공개 크리에이터를 찾을 수 없습니다.", 404);',
  '  }',
  '  const expected = payload?.followExpectedRevision;',
].join('\n');
if (!overlay.text.includes(oldSequence)) throw new Error('[097] overlay limiter/body anchor missing');
const nextOverlay = overlay.text.replace(oldSequence, newSequence);
source = source.slice(0, overlay.start) + nextOverlay + source.slice(overlay.end);

const finalLimiter = functionRange('enforceFollowEdgeRateLimit355').text;
const finalOverlay = functionRange('handleFollowOverlay354').text;
for (const required of [
  marker, 'const windowLimit = 30', 'const dayLimit = 120',
  'pairCooldowns = [30 * 1000, 2 * 60 * 1000, 10 * 60 * 1000, 60 * 60 * 1000]',
  "key: 'follow:' + normalizedUid", 'internal/explore/follow-rate-v355/',
  "String(prior.lastOperationId || '') === normalizedOperationId",
  'nextAllowedAt > now', "'Retry-After'",
]) {
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

writeFileSync(workerPath, source, 'utf8');
console.log('[097/380] Follow final-state abuse guard applied: native burst + R2 account/day + progressive pair cooldown, D1-free.');

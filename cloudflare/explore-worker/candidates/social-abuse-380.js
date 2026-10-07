// SORIDRAW_SOCIAL_ABUSE_STATE_380_20261008
// Operational receipts only. Never return membership/counts from this object.
function socialAbusePolicy380(domain) {
  if (domain === 'follow') return { windowLimit: 30, dayLimit: 120,
    cooldowns: [30_000, 120_000, 600_000, 3_600_000], quietMs: 86_400_000, pairMax: 120 };
  if (domain === 'like') return { windowLimit: 120, dayLimit: 600,
    cooldowns: [30_000, 60_000, 300_000, 1_800_000], quietMs: 21_600_000, pairMax: 600 };
  throwApi('RATE_LIMIT_UNAVAILABLE', '요청 보호 설정을 확인 중입니다.', 503);
}
function socialAbuseUnavailable380() {
  throwApi('RATE_LIMIT_UNAVAILABLE', '요청 보호 상태를 확인 중입니다.', 503,
    { 'Retry-After': '60', 'Access-Control-Expose-Headers': 'Retry-After' });
}
function socialAbuseLimited380(delayMs) {
  throwApi('RATE_LIMITED', '변경 요청을 잠시 모아 반영하고 있습니다. 나중에 다시 시도해 주세요.', 429,
    { 'Retry-After': String(Math.max(1, Math.ceil(delayMs / 1000))),
      'Access-Control-Expose-Headers': 'Retry-After' });
}
async function consumeSocialAbuse380(env, uid, domain, intents) {
  const policy = socialAbusePolicy380(domain);
  const environment = String(env?.SORIDRAW_ENVIRONMENT || env?.ENV_NAME || '').trim().toLowerCase();
  if (!['preview', 'test', 'production'].includes(environment) || !uid || !env?.PROFILE_MEDIA) {
    socialAbuseUnavailable380();
  }
  if (!Array.isArray(intents) || !intents.length || intents.length > 50 ||
      new Set(intents.map(row => row.target)).size !== intents.length ||
      intents.some(row => typeof row.target !== 'string' || !row.target || row.target.length > 512 ||
        typeof row.desired !== 'boolean' || typeof row.operationId !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(row.operationId))) {
    throwApi('INVALID_SOCIAL_INTENT', '변경 요청 순서를 확인해 주세요.', 400);
  }
  const key = 'internal/explore/abuse/' + environment + '/' + domain + '/' + encodeURIComponent(uid) + '.json';
  // Rolling timestamps enforce the limits across clock-window boundaries too.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const now = Date.now();
    let object, old;
    try {
      object = await env.PROFILE_MEDIA.get(key);
      old = object ? JSON.parse(await object.text()) : { schemaVersion: 380, events: [], pairs: [], operations: [] };
    } catch { socialAbuseUnavailable380(); }
    if (object && (typeof object.etag !== 'string' || !object.etag)) socialAbuseUnavailable380();
    const integer = n => Number.isSafeInteger(n) && n >= 0;
    if (old?.schemaVersion !== 380 || !Array.isArray(old.events) || old.events.length > policy.dayLimit ||
        old.events.some(n => !integer(n) || n > now) ||
        !Array.isArray(old.operations) || old.operations.length > policy.dayLimit ||
        old.operations.some(row => !row || typeof row.target !== 'string' || !row.target || row.target.length > 512 ||
          typeof row.desired !== 'boolean' || typeof row.operationId !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(row.operationId) ||
          !integer(row.at) || row.at > now) ||
        !Array.isArray(old.pairs) || old.pairs.length > policy.pairMax ||
        old.pairs.some(row => !row || typeof row.target !== 'string' || !row.target || row.target.length > 512 ||
          typeof row.desired !== 'boolean' || typeof row.operationId !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(row.operationId) ||
          !integer(row.at) || row.at > now || !integer(row.level) || row.level > 3 ||
          !integer(row.nextAllowedAt) || row.nextAllowedAt !== row.at + policy.cooldowns[row.level]) ||
        new Set(old.pairs.map(row => row.target)).size !== old.pairs.length) socialAbuseUnavailable380();
    const events = old.events.filter(at => now - at < 86_400_000).sort((a, b) => a - b);
    const pairs = new Map(old.pairs.filter(row => now - row.at < policy.quietMs).map(row => [row.target, row]));
    const operations = old.operations.filter(row => now - row.at < 86_400_000);
    const changes = [];
    let blockedUntil = 0;
    for (const intent of intents) {
      const replay = operations.find(row => row.operationId === intent.operationId);
      if (replay) {
        if (replay.target !== intent.target || replay.desired !== intent.desired) {
          throwApi('SOCIAL_OPERATION_CONFLICT', '요청 ID가 다른 변경에 사용되었습니다.', 409);
        }
        // An R2 reservation is not acceptance. Exact retries must reach the
        // atomic D1 receipt, including a crash between reservation and intake.
        continue;
      }
      const prior = pairs.get(intent.target);
      if (prior && prior.operationId === intent.operationId && prior.desired !== intent.desired) {
        throwApi('SOCIAL_OPERATION_CONFLICT', '요청 ID가 다른 변경에 사용되었습니다.', 409);
      }
      if (prior?.desired === intent.desired) {
        // Follow's canonical ordered protocol safely replays/settles W0 itself.
        // A fresh ID with the same desired state is not an exact retry.
        // Only durable D1 receipts may acknowledge a prior like acceptance.
        if (domain === 'like') blockedUntil = Math.max(blockedUntil, prior.at + policy.quietMs);
        continue;
      }
      if (prior && prior.nextAllowedAt > now) blockedUntil = Math.max(blockedUntil, prior.nextAllowedAt);
      const level = prior ? Math.min(3, prior.level + 1) : 0;
      changes.push({ ...intent, at: now, level, nextAllowedAt: now + policy.cooldowns[level] });
    }
    const recent = events.filter(at => now - at < 600_000);
    if (recent.length + changes.length > policy.windowLimit) {
      blockedUntil = Math.max(blockedUntil, recent[recent.length + changes.length - policy.windowLimit - 1] + 600_000);
    }
    if (events.length + changes.length > policy.dayLimit) {
      blockedUntil = Math.max(blockedUntil, events[events.length + changes.length - policy.dayLimit - 1] + 86_400_000);
    }
    if (blockedUntil > now) socialAbuseLimited380(blockedUntil - now);
    if (!changes.length) return;
    for (const row of changes) pairs.set(row.target, row);
    const next = { schemaVersion: 380, events: [...events, ...changes.map(() => now)],
      operations: [...operations, ...changes.map(({ target, desired, operationId, at }) => ({ target, desired, operationId, at }))],
      pairs: [...pairs.values()].sort((a, b) => b.at - a.at).slice(0, policy.pairMax) };
    let saved;
    try {
      saved = await env.PROFILE_MEDIA.put(key, JSON.stringify(next), {
        onlyIf: object ? { etagMatches: object.etag } : { etagDoesNotMatch: '*' },
        httpMetadata: { contentType: 'application/json; charset=utf-8' },
      });
    } catch { socialAbuseUnavailable380(); }
    if (saved) return;
  }
  socialAbuseUnavailable380();
}

const fs = require('node:fs');
const path = require('node:path');

const functionsRoot = path.resolve(__dirname, '..');
const securedPath = path.join(functionsRoot, 'src', 'securedIndex.ts');
let source = fs.readFileSync(securedPath, 'utf8');

function replaceOnce(label, before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`[849 latency patch] ${label} anchor mismatch: ${count}`);
  }
  source = source.replace(before, after);
}

replaceOnce(
  '3.7 wait ceiling',
  '  "gemini-3.7-flash": 55_000,',
  '  "gemini-3.7-flash": 25_000,',
);

replaceOnce(
  'adaptive busy cooldown helpers',
  `const GEMINI_BOUNDED_REPAIR_TIMEOUT_MS: Record<string, number> = {
  "gemini-3.5-flash": 15_000,
  "gemini-3.5-flash-lite": 12_000,
  "gemini-3.1-flash-lite": 10_000,
};

const getGeminiAttemptTimeoutMs = (`,
  `const GEMINI_BOUNDED_REPAIR_TIMEOUT_MS: Record<string, number> = {
  "gemini-3.5-flash": 15_000,
  "gemini-3.5-flash-lite": 12_000,
  "gemini-3.1-flash-lite": 10_000,
};

const GEMINI_37_BUSY_SKIP_MS = 10 * 60_000;
const GEMINI_36_BUSY_SKIP_MS = 5 * 60_000;
const GEMINI_SERVER_INFLIGHT_LEASE_MS = 70_000;
const GEMINI_SERVER_INFLIGHT_COORDINATED_MODELS = new Set([
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
]);

type GeminiServerInFlightEntry = {
  owner: string;
  expiresAt: number;
};

const geminiServerModelInFlight = new Map<string, GeminiServerInFlightEntry>();

const pruneGeminiServerModelInFlight = (): void => {
  const now = Date.now();
  for (const [key, entry] of geminiServerModelInFlight.entries()) {
    if (!entry || entry.expiresAt <= now) geminiServerModelInFlight.delete(key);
  }
};

const isGeminiServerModelInFlight = (uid: string, model: string): boolean => {
  if (!GEMINI_SERVER_INFLIGHT_COORDINATED_MODELS.has(model)) return false;
  pruneGeminiServerModelInFlight();
  return geminiServerModelInFlight.has(geminiServerCooldownKey(uid, model));
};

const acquireGeminiServerModelInFlight = (
  uid: string,
  model: string,
  sessionId: string,
  enabled: boolean,
): string | null => {
  if (!enabled || !GEMINI_SERVER_INFLIGHT_COORDINATED_MODELS.has(model)) return "";
  pruneGeminiServerModelInFlight();
  const key = geminiServerCooldownKey(uid, model);
  if (geminiServerModelInFlight.has(key)) return null;
  const owner = [sessionId, Date.now(), Math.random().toString(36).slice(2, 10)].join(":");
  geminiServerModelInFlight.set(key, {
    owner,
    expiresAt: Date.now() + GEMINI_SERVER_INFLIGHT_LEASE_MS,
  });
  return owner;
};

const releaseGeminiServerModelInFlight = (uid: string, model: string, owner: string): void => {
  if (!owner) return;
  const key = geminiServerCooldownKey(uid, model);
  const current = geminiServerModelInFlight.get(key);
  if (current?.owner === owner) geminiServerModelInFlight.delete(key);
};

const getGeminiPolicyBusyCooldownMs = (
  model: string,
  statusCode: number,
  isAttemptTimeout: boolean,
): number => {
  const isBusyFailure = isAttemptTimeout || statusCode === 429 || [500, 502, 503, 504].includes(statusCode);
  if (!isBusyFailure) return 0;
  if (model === "gemini-3.7-flash") return GEMINI_37_BUSY_SKIP_MS;
  if (model === "gemini-3.6-flash") return GEMINI_36_BUSY_SKIP_MS;
  return 0;
};

const setGeminiPolicyBusyCooldown = (
  uid: string,
  model: string,
  statusCode: number,
  reason: string,
  durationMs: number,
): GeminiServerCooldownEntry | null => {
  if (durationMs <= 0) return null;
  const key = geminiServerCooldownKey(uid, model);
  const existing = geminiServerModelCooldowns.get(key);
  const next: GeminiServerCooldownEntry = {
    until: Math.max(Number(existing?.until || 0), Date.now() + durationMs),
    reason: String(reason || existing?.reason || "temporary_model_cooldown").trim() || "temporary_model_cooldown",
    statusCode,
  };
  geminiServerModelCooldowns.set(key, next);
  pruneGeminiServerCooldowns();
  return next;
};

const getGeminiAttemptTimeoutMs = (`,
);

replaceOnce(
  'model-aware busy cooldown duration',
  '  const cooldownMs = isAttemptTimeout ? 0 : getGeminiServerCooldownMs(statusCode, retryAfterMs);',
  '  const policyCooldownMs = getGeminiPolicyBusyCooldownMs(model, statusCode, isAttemptTimeout);\n  const cooldownMs = policyCooldownMs || (isAttemptTimeout ? 0 : getGeminiServerCooldownMs(statusCode, retryAfterMs));',
);

replaceOnce(
  'server model-aware busy cooldown',
  `          const status = attemptRecord.statusCode || 500;
          const isPolicyTimeout = String(attemptRecord.code || "").trim() === "GEMINI_ATTEMPT_TIMEOUT";
          const serverCooldown = isGeminiServerFallbackStatus(status) && !isPolicyTimeout
            ? setGeminiServerModelCooldown(
                uid,
                attemptModel,
                status,
                Number(attemptRecord.retryAfterMs || 0),
                String(attemptRecord.cooldownReason || (status === 429 ? "quota_or_rate_limit" : status === 404 ? "model_not_found_or_rollout" : "model_unavailable_or_overloaded")),
              )
            : null;`,
  `          const status = attemptRecord.statusCode || 500;
          const isPolicyTimeout = String(attemptRecord.code || "").trim() === "GEMINI_ATTEMPT_TIMEOUT";
          const policyCooldownMs = getGeminiPolicyBusyCooldownMs(attemptModel, status, isPolicyTimeout);
          const cooldownReason = String(attemptRecord.cooldownReason || (status === 429 ? "quota_or_rate_limit" : status === 404 ? "model_not_found_or_rollout" : "model_unavailable_or_overloaded"));
          const serverCooldown = policyCooldownMs > 0
            ? setGeminiPolicyBusyCooldown(uid, attemptModel, status, cooldownReason, policyCooldownMs)
            : isGeminiServerFallbackStatus(status) && !isPolicyTimeout
              ? setGeminiServerModelCooldown(
                  uid,
                  attemptModel,
                  status,
                  Number(attemptRecord.retryAfterMs || 0),
                  cooldownReason,
                )
              : null;`,
);


replaceOnce(
  'server in-flight preflight skip',
  `      for (let index = 0; index < runtimeServerModelChain.length; index += 1) {
        const attemptModel = runtimeServerModelChain[index];
        if (index > 0) {`,
  `      for (let index = 0; index < runtimeServerModelChain.length; index += 1) {
        const attemptModel = runtimeServerModelChain[index];
        const coordinateInFlight = latencyPolicy === "bounded-v1"
          && runtimeServerModelChain.length > 1
          && GEMINI_SERVER_INFLIGHT_COORDINATED_MODELS.has(attemptModel);
        if (coordinateInFlight && isGeminiServerModelInFlight(uid, attemptModel)) {
          console.warn("[Gemini Server InFlight] skipping model already being probed by another request", {
            context,
            sessionId,
            model: attemptModel,
          });
          continue;
        }
        if (index > 0) {`,
);

replaceOnce(
  'server in-flight acquire and release',
  `        const attemptStartedAt = Date.now();
        const attemptTimeoutMs = getGeminiAttemptTimeoutMs(latencyPolicy, context, attemptModel);
        try {
          const response = await callGeminiGenerateContent(apiKey, attemptPayload, attemptTimeoutMs);`,
  `        const inFlightOwner = acquireGeminiServerModelInFlight(uid, attemptModel, sessionId, coordinateInFlight);
        if (inFlightOwner === null) {
          console.warn("[Gemini Server InFlight] model was claimed before upstream call; advancing", {
            context,
            sessionId,
            model: attemptModel,
          });
          continue;
        }
        const attemptStartedAt = Date.now();
        const attemptTimeoutMs = getGeminiAttemptTimeoutMs(latencyPolicy, context, attemptModel);
        try {
          let response;
          try {
            response = await callGeminiGenerateContent(apiKey, attemptPayload, attemptTimeoutMs);
          } finally {
            releaseGeminiServerModelInFlight(uid, attemptModel, inFlightOwner);
          }`,
);

fs.writeFileSync(securedPath, source, 'utf8');
console.log('Applied SORIDRAW 849 Gemini latency policy: adaptive busy cooldown + per-model in-flight coordination.');

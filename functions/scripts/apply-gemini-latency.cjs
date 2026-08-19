const fs = require('node:fs');
const path = require('node:path');

const functionsRoot = path.resolve(__dirname, '..');
const securedPath = path.join(functionsRoot, 'src', 'securedIndex.ts');
let source = fs.readFileSync(securedPath, 'utf8');

function replaceOnce(label, before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`[848 latency patch] ${label} anchor mismatch: ${count}`);
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

fs.writeFileSync(securedPath, source, 'utf8');
console.log('Applied SORIDRAW 848 Gemini latency policy: 3.7=25s/10m busy skip, 3.6=45s/5m busy skip.');

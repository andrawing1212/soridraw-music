const fs = require('node:fs');
const path = require('node:path');

const functionsRoot = path.resolve(__dirname, '..');
const securedPath = path.join(functionsRoot, 'src', 'securedIndex.ts');
let source = fs.readFileSync(securedPath, 'utf8');

function replaceOnce(label, before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`[847 latency patch] ${label} anchor mismatch: ${count}`);
  }
  source = source.replace(before, after);
}

replaceOnce(
  '3.7 wait ceiling',
  '  "gemini-3.7-flash": 55_000,',
  '  "gemini-3.7-flash": 25_000,',
);

replaceOnce(
  '3.7 timeout cooldown helper',
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

const GEMINI_37_TIMEOUT_SKIP_MS = 10 * 60_000;

const setGeminiPolicyTimeoutCooldown = (
  uid: string,
  model: string,
): GeminiServerCooldownEntry | null => {
  if (model !== "gemini-3.7-flash") return null;
  const key = geminiServerCooldownKey(uid, model);
  const existing = geminiServerModelCooldowns.get(key);
  const next: GeminiServerCooldownEntry = {
    until: Math.max(Number(existing?.until || 0), Date.now() + GEMINI_37_TIMEOUT_SKIP_MS),
    reason: "model_response_timeout",
    statusCode: 504,
  };
  geminiServerModelCooldowns.set(key, next);
  pruneGeminiServerCooldowns();
  return next;
};

const getGeminiAttemptTimeoutMs = (`,
);

replaceOnce(
  'timeout cooldown duration',
  '  const cooldownMs = isAttemptTimeout ? 0 : getGeminiServerCooldownMs(statusCode, retryAfterMs);',
  '  const cooldownMs = isAttemptTimeout && model === "gemini-3.7-flash" ? GEMINI_37_TIMEOUT_SKIP_MS : isAttemptTimeout ? 0 : getGeminiServerCooldownMs(statusCode, retryAfterMs);',
);

replaceOnce(
  'server timeout cooldown',
  `          const serverCooldown = isGeminiServerFallbackStatus(status) && !isPolicyTimeout
            ? setGeminiServerModelCooldown(`,
  `          const serverCooldown = isPolicyTimeout && attemptModel === "gemini-3.7-flash"
            ? setGeminiPolicyTimeoutCooldown(uid, attemptModel)
            : isGeminiServerFallbackStatus(status) && !isPolicyTimeout
              ? setGeminiServerModelCooldown(`,
);

fs.writeFileSync(securedPath, source, 'utf8');
console.log('Applied SORIDRAW 847 Gemini latency patch: 3.7=25s, timeout skip=10m.');

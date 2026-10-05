const fs = require('node:fs');
const path = require('node:path');

const functionsRoot = path.resolve(__dirname, '..');
const securedPath = path.join(functionsRoot, 'src', 'securedIndex.ts');
let source = fs.readFileSync(securedPath, 'utf8');

function replaceOnce(label, before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`[853 latency patch] ${label} anchor mismatch: ${count}`);
  }
  source = source.replace(before, after);
}

replaceOnce(
  '3.7 wait ceiling',
  '  "gemini-3.7-flash": 55_000,',
  '  "gemini-3.7-flash": 35_000,',
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

const GEMINI_38_BUSY_SKIP_MS = 45_000;
const GEMINI_37_BUSY_SKIP_MS = 45_000;
const GEMINI_36_BUSY_SKIP_MS = 5 * 60_000;
const GEMINI_RETRY_AFTER_SAFETY_MS = 1_500;
const GEMINI_RATE_LIMIT_NO_HINT_COOLDOWN_MS = 15_000;
const GEMINI_RATE_LIMIT_MAX_COOLDOWN_MS = 60_000;
const GEMINI_DAILY_QUOTA_MAX_COOLDOWN_MS = 26 * 60 * 60_000;

const getGeminiPacificTimeParts = (date: Date): Record<string, number> => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const out: Record<string, number> = {};
  for (const part of parts) {
    if (part.type === "literal") continue;
    const value = Number(part.value);
    if (Number.isFinite(value)) out[part.type] = value;
  }
  return out;
};

const getGeminiPacificOffsetMs = (date: Date): number => {
  const parts = getGeminiPacificTimeParts(date);
  const reconstructedUtc = Date.UTC(
    parts.year,
    Math.max(0, Number(parts.month || 1) - 1),
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return reconstructedUtc - date.getTime();
};

const getGeminiDailyQuotaCooldownMs = (): number => {
  const nowMs = Date.now();
  const now = new Date(nowMs);
  const parts = getGeminiPacificTimeParts(now);
  const nextLocalMidnightAsUtc = Date.UTC(
    parts.year,
    Math.max(0, Number(parts.month || 1) - 1),
    Number(parts.day || 1) + 1,
    0,
    0,
    0,
  );
  let candidateMs = nextLocalMidnightAsUtc - getGeminiPacificOffsetMs(new Date(nextLocalMidnightAsUtc));
  candidateMs = nextLocalMidnightAsUtc - getGeminiPacificOffsetMs(new Date(candidateMs));
  return Math.max(
    60_000,
    Math.min(GEMINI_DAILY_QUOTA_MAX_COOLDOWN_MS, candidateMs - nowMs + 60_000),
  );
};

const GEMINI_SERVER_INFLIGHT_LEASE_MS = 70_000;
const GEMINI_SERVER_INFLIGHT_COORDINATED_MODELS = new Set([
  "gemini-3.8-flash",
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
  retryAfterMs = 0,
): number => {
  if (statusCode === 429) {
    const retryMs = Math.max(0, Math.round(Number(retryAfterMs) || 0));
    if (retryMs > 0) {
      return Math.min(
        GEMINI_RATE_LIMIT_MAX_COOLDOWN_MS,
        Math.max(3_000, retryMs + GEMINI_RETRY_AFTER_SAFETY_MS),
      );
    }
    return GEMINI_RATE_LIMIT_NO_HINT_COOLDOWN_MS;
  }
  const isBusyFailure = isAttemptTimeout || [500, 502, 503, 504].includes(statusCode);
  if (!isBusyFailure) return 0;
  if (model === "gemini-3.8-flash") return GEMINI_38_BUSY_SKIP_MS;
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
  '  const policyCooldownMs = isDailyQuotaExhausted ? getGeminiDailyQuotaCooldownMs() : getGeminiPolicyBusyCooldownMs(model, statusCode, isAttemptTimeout, retryAfterMs);\n  const cooldownMs = policyCooldownMs || (isAttemptTimeout ? 0 : getGeminiServerCooldownMs(statusCode, retryAfterMs));',
);

replaceOnce(
  '850 thinking policy request flag',
  '    const latencyPolicy: GeminiLatencyPolicy = req.body?.latencyPolicy === "bounded-v1" ? "bounded-v1" : null;',
  '    const latencyPolicy: GeminiLatencyPolicy = req.body?.latencyPolicy === "bounded-v1" ? "bounded-v1" : null;\n    const thinkingPolicy = req.body?.thinkingPolicy === "initial-36-low-small-35-low-v2" ? "initial-36-low-small-35-low-v2" : req.body?.thinkingPolicy === "initial-36-low-v1" ? "initial-36-low-v1" : null;',
);

replaceOnce(
  '850 initial 3.6 low thinking',
  `        const attemptPayload = normalizeGeminiServerAttemptRequest(
          requestPayload,
          attemptModel,
          fallbackInstruction,
          index > 0 || attemptModel !== model,
        );`,
  `        const attemptPayload = normalizeGeminiServerAttemptRequest(
          requestPayload,
          attemptModel,
          fallbackInstruction,
          index > 0 || attemptModel !== model,
        );
        const isInitialSongContext = context === "generateSong"
          || context === "generateSongCompactFallback"
          || context.startsWith("languageMixLockedWholeRewrite")
          || context.startsWith("generateSong v2");
        const useInitialFlashLowThinking = thinkingPolicy === "initial-36-low-small-35-low-v2"
          && ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"].includes(attemptModel)
          && isInitialSongContext;
        const useLegacyInitial36LowThinking = thinkingPolicy === "initial-36-low-v1"
          && attemptModel === "gemini-3.6-flash"
          && isInitialSongContext;
        const isSmall35LowThinkingContext = context === "repairV1FinalProductionCues"
          || context === "rewriteLyricHardBanCards"
          || context === "rewriteLyricHardBanLines"
          || context === "rewriteLyricHardBanLinesSecondPass"
          || context === "repairSelectedLanguageCard";
        const useSmall35LowThinking = thinkingPolicy === "initial-36-low-small-35-low-v2"
          && attemptModel === "gemini-3.5-flash"
          && isSmall35LowThinkingContext;
        if (useInitialFlashLowThinking || useLegacyInitial36LowThinking || useSmall35LowThinking) {
          const existingConfig = attemptPayload?.config && typeof attemptPayload.config === "object"
            ? attemptPayload.config
            : {};
          const existingThinkingConfig = existingConfig?.thinkingConfig && typeof existingConfig.thinkingConfig === "object"
            ? existingConfig.thinkingConfig
            : {};
          attemptPayload.config = {
            ...existingConfig,
            thinkingConfig: {
              ...existingThinkingConfig,
              thinkingLevel: "low",
            },
          };
          console.info(useSmall35LowThinking
            ? "[Gemini 854 Thinking] small 3.5 correction request uses low thinking"
            : "[Gemini 143 Initial Thinking] initial Flash request uses low thinking", {
            context,
            sessionId,
            model: attemptModel,
          });
        }`,
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
          const cooldownReason = String(attemptRecord.cooldownReason || (status === 429 ? "quota_or_rate_limit" : status === 404 ? "model_not_found_or_rollout" : "model_unavailable_or_overloaded"));
          const policyCooldownMs = cooldownReason === "daily_quota_exhausted"
            ? getGeminiDailyQuotaCooldownMs()
            : getGeminiPolicyBusyCooldownMs(
                attemptModel,
                status,
                isPolicyTimeout,
                Number(attemptRecord.retryAfterMs || 0),
              );
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
  `      // Reserve cleanup headroom under the 330s Function hard limit.
      const geminiTotalDeadlineMs = Date.now() + 300_000;
      for (let index = 0; index < runtimeServerModelChain.length; index += 1) {
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
        const policyTimeoutMs = getGeminiAttemptTimeoutMs(latencyPolicy, context, attemptModel);
        const remainingBudgetMs = latencyPolicy === "bounded-v1"
          ? geminiTotalDeadlineMs - Date.now() - 10_000
          : policyTimeoutMs;
        if (latencyPolicy === "bounded-v1" && remainingBudgetMs < 10_000) {
          releaseGeminiServerModelInFlight(uid, attemptModel, inFlightOwner);
          const budgetError = new Error("Gemini total generation time budget exhausted");
          (budgetError as any).status = 504;
          (budgetError as any).code = "GEMINI_TOTAL_BUDGET";
          throw budgetError;
        }
        const attemptTimeoutMs = latencyPolicy === "bounded-v1"
          ? Math.max(1, Math.min(policyTimeoutMs || remainingBudgetMs, remainingBudgetMs))
          : policyTimeoutMs;
        try {
          let response;
          try {
            response = await callGeminiGenerateContent(apiKey, attemptPayload, attemptTimeoutMs);
          } finally {
            releaseGeminiServerModelInFlight(uid, attemptModel, inFlightOwner);
          }`,
);

fs.writeFileSync(securedPath, source, 'utf8');
console.log('Applied SORIDRAW Gemini policy: daily-quota skip + bounded fallback timing + low-thinking + Retry-After + in-flight.');

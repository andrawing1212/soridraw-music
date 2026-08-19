const fs = require('node:fs');
const path = require('node:path');

const functionsRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(functionsRoot, 'src', 'index.ts');
const outputPath = path.join(functionsRoot, 'src', 'securedIndex.ts');

let source = fs.readFileSync(sourcePath, 'utf8');

function patchFunctionAfterAuth(functionName) {
  const marker = `export const ${functionName} = onRequest(`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing function marker: ${functionName}`);

  const nextExport = source.indexOf('\nexport const ', start + marker.length);
  const end = nextExport < 0 ? source.length : nextExport;
  let segment = source.slice(start, end);
  const guard = `    if (!(await verifyAppCheckForRequest(req, res, "${functionName}"))) return;\n`;

  if (!segment.includes(guard)) {
    const anchor = '    const uid = await verifyAuth(req, res);\n    if (!uid) return;\n';
    const anchorCount = segment.split(anchor).length - 1;
    if (anchorCount !== 1) {
      throw new Error(`Auth anchor mismatch in ${functionName}: ${anchorCount}`);
    }
    segment = segment.replace(anchor, anchor + guard);
    source = source.slice(0, start) + segment + source.slice(end);
  }
}

[
  'saveSunoApiKey',
  'deleteSunoApiKey',
  'getSunoApiKeyStatus',
  'fetchSunoShareMetadata',
  'getSunoRemainingCredits',
  'getSunoRemainingCreditsAfterComplete',
  'createSunoTrack',
].forEach(patchFunctionAfterAuth);

const statusFunctionName = 'getSunoTrackStatus';
const statusMarker = `export const ${statusFunctionName} = onRequest(`;
const statusStart = source.indexOf(statusMarker);
if (statusStart < 0) throw new Error(`Missing function marker: ${statusFunctionName}`);

let statusSegment = source.slice(statusStart);
const statusGuard = '    if (!(await verifyAppCheckForRequest(req, res, "getSunoTrackStatus"))) return;\n\n';
if (!statusSegment.includes(statusGuard)) {
  const bodyAnchor = '    let body = req.body;\n';
  const anchorCount = statusSegment.split(bodyAnchor).length - 1;
  if (anchorCount !== 1) {
    throw new Error(`Body anchor mismatch in getSunoTrackStatus: ${anchorCount}`);
  }
  statusSegment = statusSegment.replace(bodyAnchor, statusGuard + bodyAnchor);
  source = source.slice(0, statusStart) + statusSegment;
}

[
  'saveSunoApiKey',
  'deleteSunoApiKey',
  'getSunoApiKeyStatus',
  'fetchSunoShareMetadata',
  'getSunoRemainingCredits',
  'getSunoRemainingCreditsAfterComplete',
  'createSunoTrack',
  'getSunoTrackStatus',
].forEach((functionName) => {
  const expected = `verifyAppCheckForRequest(req, res, "${functionName}")`;
  const count = source.split(expected).length - 1;
  if (count !== 1) {
    throw new Error(`Unexpected App Check guard count for ${functionName}: ${count}`);
  }
});

function replaceOnce(label, before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label} anchor mismatch: ${count}`);
  source = source.replace(before, after);
}

function replaceFirst(label, before, after) {
  const count = source.split(before).length - 1;
  if (count < 1) throw new Error(`${label} anchor missing`);
  source = source.replace(before, after);
}

function patchGeminiBoundedLatencyPolicy() {
  const helperAnchor = 'const callGeminiInteraction = async (apiKey: string, requestPayload: any): Promise<any> => {';
  const helperBlock = `type GeminiLatencyPolicy = "bounded-v1" | null;

const GEMINI_BOUNDED_ATTEMPT_TIMEOUT_MS: Record<string, number> = {
  "gemini-3.7-flash": 55_000,
  "gemini-3.6-flash": 45_000,
  "gemini-3.5-flash": 30_000,
  "gemini-3.5-flash-lite": 20_000,
  "gemini-3.1-flash-lite": 15_000,
};

const GEMINI_BOUNDED_REPAIR_TIMEOUT_MS: Record<string, number> = {
  "gemini-3.5-flash": 15_000,
  "gemini-3.5-flash-lite": 12_000,
  "gemini-3.1-flash-lite": 10_000,
};

const getGeminiAttemptTimeoutMs = (
  latencyPolicy: GeminiLatencyPolicy,
  context: string,
  model: string,
): number => {
  if (latencyPolicy !== "bounded-v1") return 0;
  const isFastRepair = String(context || "").trim() === "repairV1FinalProductionCues";
  const sourceMap = isFastRepair ? GEMINI_BOUNDED_REPAIR_TIMEOUT_MS : GEMINI_BOUNDED_ATTEMPT_TIMEOUT_MS;
  return Math.max(0, Math.round(Number(sourceMap[model] || 0)));
};

const callGeminiInteraction = async (apiKey: string, requestPayload: any, attemptTimeoutMs = 0): Promise<any> => {`;
  replaceOnce('Gemini latency helper', helperAnchor, helperBlock);

  replaceFirst(
    'Gemini interaction timeout signal',
    '      body: JSON.stringify(body),\n    },\n  );\n  const payload = await upstream.json().catch(() => null);',
    '      body: JSON.stringify(body),\n      ...(attemptTimeoutMs ? { signal: AbortSignal.timeout(attemptTimeoutMs) } : {}),\n    },\n  );\n  const payload = await upstream.json().catch(() => null);',
  );

  replaceOnce(
    'Gemini generateContent timeout signature',
    'const callGeminiGenerateContent = async (apiKey: string, requestPayload: any): Promise<any> => {\n  const model = String(requestPayload?.model || "").trim();\n  if (model === "gemini-3.7-flash") {\n    return callGeminiInteraction(apiKey, requestPayload);\n  }',
    'const callGeminiGenerateContent = async (apiKey: string, requestPayload: any, attemptTimeoutMs = 0): Promise<any> => {\n  const model = String(requestPayload?.model || "").trim();\n  if (model === "gemini-3.7-flash") {\n    return callGeminiInteraction(apiKey, requestPayload, attemptTimeoutMs);\n  }',
  );

  replaceOnce(
    'Gemini legacy timeout signal',
    '      body: JSON.stringify(body),\n    },\n  );\n  const payload = await upstream.json().catch(() => null);\n  if (!upstream.ok) {\n    const error = new Error(String(payload?.error?.message || `Gemini request failed (${upstream.status})`));',
    '      body: JSON.stringify(body),\n      ...(attemptTimeoutMs ? { signal: AbortSignal.timeout(attemptTimeoutMs) } : {}),\n    },\n  );\n  const payload = await upstream.json().catch(() => null);\n  if (!upstream.ok) {\n    const error = new Error(String(payload?.error?.message || `Gemini request failed (${upstream.status})`));',
  );

  replaceOnce(
    'Gemini timeout attempt record',
    '  const statusCode = extractGeminiErrorStatus(error);\n  const retryAfterMs = Math.max(0, Math.round(Number(anyError?.retryAfterMs) || 0));\n  const cooldownMs = getGeminiServerCooldownMs(statusCode, retryAfterMs);',
    '  const isAttemptTimeout = (anyError?.name === "TimeoutError" || anyError?.name === "AbortError") && /timeout|aborted/i.test(String(anyError?.message || ""));\n  const statusCode = isAttemptTimeout ? 504 : extractGeminiErrorStatus(error);\n  const retryAfterMs = Math.max(0, Math.round(Number(anyError?.retryAfterMs) || 0));\n  const cooldownMs = isAttemptTimeout ? 0 : getGeminiServerCooldownMs(statusCode, retryAfterMs);',
  );

  replaceOnce(
    'Gemini timeout attempt code',
    '    code: anyError?.code || statusCode,\n    ...(retryAfterMs > 0 ? { retryAfterMs } : {}),\n    ...(cooldownMs > 0 ? { cooldownMs } : {}),\n    ...(cooldownMs > 0 ? { cooldownReason: statusCode === 429 ? "quota_or_rate_limit" : statusCode === 404 ? "model_not_found_or_rollout" : "model_unavailable_or_overloaded" } : {}),',
    '    code: isAttemptTimeout ? "GEMINI_ATTEMPT_TIMEOUT" : anyError?.code || statusCode,\n    ...(retryAfterMs > 0 ? { retryAfterMs } : {}),\n    ...(cooldownMs > 0 ? { cooldownMs } : {}),\n    ...(isAttemptTimeout ? { cooldownReason: "model_response_timeout" } : cooldownMs > 0 ? { cooldownReason: statusCode === 429 ? "quota_or_rate_limit" : statusCode === 404 ? "model_not_found_or_rollout" : "model_unavailable_or_overloaded" } : {}),',
  );

  replaceOnce(
    'Gemini latency policy request',
    '    const modelChain = normalizeGeminiServerModelChain(model, req.body?.modelChain);\n    const fallbackInstruction = String(req.body?.fallbackInstruction || "").trim().slice(0, 5000);',
    '    const modelChain = normalizeGeminiServerModelChain(model, req.body?.modelChain);\n    const fallbackInstruction = String(req.body?.fallbackInstruction || "").trim().slice(0, 5000);\n    const latencyPolicy: GeminiLatencyPolicy = req.body?.latencyPolicy === "bounded-v1" ? "bounded-v1" : null;',
  );

  replaceOnce(
    'Gemini bounded attempt call',
    '        const attemptStartedAt = Date.now();\n        try {\n          const response = await callGeminiGenerateContent(apiKey, attemptPayload);',
    '        const attemptStartedAt = Date.now();\n        const attemptTimeoutMs = getGeminiAttemptTimeoutMs(latencyPolicy, context, attemptModel);\n        try {\n          const response = await callGeminiGenerateContent(apiKey, attemptPayload, attemptTimeoutMs);',
  );

  replaceOnce(
    'Gemini policy timeout cooldown isolation',
    '          const status = attemptRecord.statusCode || 500;\n          const serverCooldown = isGeminiServerFallbackStatus(status)\n            ? setGeminiServerModelCooldown(',
    '          const status = attemptRecord.statusCode || 500;\n          const isPolicyTimeout = String(attemptRecord.code || "").trim() === "GEMINI_ATTEMPT_TIMEOUT";\n          const serverCooldown = isGeminiServerFallbackStatus(status) && !isPolicyTimeout\n            ? setGeminiServerModelCooldown(',
  );

  replaceOnce(
    'Gemini timeout response code',
    '        code: isAuthKeyActivationError\n          ? "GEMINI_AUTH_KEY_NOT_READY"\n          : status === 404\n            ? "GEMINI_MODEL_NOT_FOUND"\n            : status === 429\n              ? "GEMINI_RATE_LIMITED"\n              : status >= 500\n                ? "GEMINI_UPSTREAM_UNAVAILABLE"\n                : "GEMINI_UPSTREAM_ERROR",',
    '        code: isAuthKeyActivationError\n          ? "GEMINI_AUTH_KEY_NOT_READY"\n          : String(requestError?.code || "").trim() === "GEMINI_ATTEMPT_TIMEOUT"\n            ? "GEMINI_ATTEMPT_TIMEOUT"\n            : status === 404\n              ? "GEMINI_MODEL_NOT_FOUND"\n              : status === 429\n                ? "GEMINI_RATE_LIMITED"\n                : status >= 500\n                  ? "GEMINI_UPSTREAM_UNAVAILABLE"\n                  : "GEMINI_UPSTREAM_ERROR",',
  );
}

patchGeminiBoundedLatencyPolicy();

const generatedHeader = [
  '// AUTO-GENERATED BY scripts/build-secured-index.cjs.',
  '// Do not edit this file directly; edit src/index.ts or the generator instead.',
  '',
].join('\n');

fs.writeFileSync(outputPath, generatedHeader + source, 'utf8');
console.log(`Generated ${path.relative(functionsRoot, outputPath)} with Music API App Check monitoring.`);

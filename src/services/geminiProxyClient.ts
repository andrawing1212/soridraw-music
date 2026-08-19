import type { GoogleGenAI } from '@google/genai';
import { auth, getFirebaseAppCheckToken } from '../firebase';
import { getGeminiModelCooldown } from './geminiModelPreferences';
import { recordGeminiAuditModelSkips } from './geminiAuditLog';

const CLOUD_FUNCTIONS_BASE_URL = 'https://us-central1-soridraw-app-866a5.cloudfunctions.net';
const GEMINI_LATENCY_POLICY = 'bounded-v1' as const;
const GEMINI_THINKING_POLICY = 'initial-36-low-v1' as const;
const FAST_REPAIR_CONTEXT = 'repairV1FinalProductionCues';
const INITIAL_SONG_MODEL_CHAIN = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
] as const;
const FAST_REPAIR_MODEL_CHAIN = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
] as const;
const SLOW_SUCCESS_THRESHOLD_MS = 30_000;
const SLOW_SUCCESS_SESSION_TTL_MS = 20 * 60_000;
const CLIENT_INFLIGHT_COORDINATED_MODELS = new Set([
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
]);
const clientModelInFlightCounts = new Map<string, number>();

type GeminiProxyModelSkip = {
  id: string;
  context: string;
  model: string;
  reason: 'cooldown' | 'in_flight' | 'slow_success' | 'other';
  detail?: string;
  remainingMs?: number;
  createdAtMs: number;
};

function createModelSkip(
  context: string,
  model: string,
  reason: GeminiProxyModelSkip['reason'],
  options?: { detail?: string; remainingMs?: number },
): GeminiProxyModelSkip {
  const createdAtMs = Date.now();
  return {
    id: `gemini-skip-${createdAtMs}-${Math.random().toString(36).slice(2, 9)}`,
    context: String(context || 'Gemini 호출').trim() || 'Gemini 호출',
    model: String(model || '').trim(),
    reason,
    detail: String(options?.detail || '').trim() || undefined,
    remainingMs: Number.isFinite(Number(options?.remainingMs))
      ? Math.max(0, Math.round(Number(options?.remainingMs)))
      : undefined,
    createdAtMs,
  };
}

function dedupeModelSkips(skips: GeminiProxyModelSkip[]): GeminiProxyModelSkip[] {
  const seen = new Set<string>();
  return skips.filter((skip) => {
    if (!skip.model) return false;
    const key = `${skip.context}|${skip.model}|${skip.reason}|${skip.detail || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isClientModelInFlight(model: string): boolean {
  const normalized = String(model || '').trim();
  if (!CLIENT_INFLIGHT_COORDINATED_MODELS.has(normalized)) return false;
  return Math.max(0, Number(clientModelInFlightCounts.get(normalized) || 0)) > 0;
}

function acquireClientModelInFlight(model: string): () => void {
  const normalized = String(model || '').trim();
  if (!CLIENT_INFLIGHT_COORDINATED_MODELS.has(normalized)) return () => {};
  clientModelInFlightCounts.set(normalized, Math.max(0, Number(clientModelInFlightCounts.get(normalized) || 0)) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = Math.max(0, Number(clientModelInFlightCounts.get(normalized) || 0) - 1);
    if (next > 0) clientModelInFlightCounts.set(normalized, next);
    else clientModelInFlightCounts.delete(normalized);
  };
}

function avoidConcurrentModelProbe(
  modelChain: string[],
  context: string,
): { modelChain: string[]; skips: GeminiProxyModelSkip[] } {
  if (modelChain.length <= 1) return { modelChain, skips: [] };
  const busyModels = modelChain.filter((model) => isClientModelInFlight(model));
  if (!busyModels.length) return { modelChain, skips: [] };
  const available = modelChain.filter((model) => !isClientModelInFlight(model));
  if (!available.length) return { modelChain, skips: [] };
  console.warn(
    `[SORIDRAW Gemini InFlight] ${context}: skipping model(s) already being probed ${busyModels.join(', ')}`,
  );
  return {
    modelChain: available,
    skips: busyModels.map((model) => createModelSkip(
      context,
      model,
      'in_flight',
      { detail: '다른 생성이 같은 모델을 현재 시험 중' },
    )),
  };
}

type SlowSuccessSession = {
  models: Set<string>;
  updatedAt: number;
};

const slowSuccessModelsBySession = new Map<string, SlowSuccessSession>();

function pruneSlowSuccessSessions(): void {
  const now = Date.now();
  for (const [sessionId, entry] of slowSuccessModelsBySession.entries()) {
    if (!entry || now - entry.updatedAt > SLOW_SUCCESS_SESSION_TTL_MS) {
      slowSuccessModelsBySession.delete(sessionId);
    }
  }
  if (slowSuccessModelsBySession.size <= 100) return;
  const oldest = Array.from(slowSuccessModelsBySession.entries())
    .sort((a, b) => a[1].updatedAt - b[1].updatedAt)
    .slice(0, slowSuccessModelsBySession.size - 100);
  oldest.forEach(([sessionId]) => slowSuccessModelsBySession.delete(sessionId));
}

function recordSlowSuccessModels(sessionId: string, attempts: any[]): void {
  if (!sessionId || !Array.isArray(attempts) || !attempts.length) return;
  const slowModels = attempts
    .filter((attempt) => attempt?.status === 'success' && Number(attempt?.durationMs || 0) >= SLOW_SUCCESS_THRESHOLD_MS)
    .map((attempt) => String(attempt?.model || '').trim())
    .filter(Boolean);
  if (!slowModels.length) return;
  const current = slowSuccessModelsBySession.get(sessionId) || { models: new Set<string>(), updatedAt: Date.now() };
  slowModels.forEach((model) => current.models.add(model));
  current.updatedAt = Date.now();
  slowSuccessModelsBySession.set(sessionId, current);
  pruneSlowSuccessSessions();
}

function getSlowSuccessModels(sessionId: string): Set<string> {
  if (!sessionId) return new Set<string>();
  pruneSlowSuccessSessions();
  return slowSuccessModelsBySession.get(sessionId)?.models || new Set<string>();
}

function normalizeProxyError(status: number, payload: any): Error {
  const code = String(payload?.code || payload?.errorCode || '').trim();
  const detail = String(payload?.error || payload?.message || `Gemini proxy request failed (${status})`).trim();
  const error = new Error([status ? `HTTP ${status}` : '', code, detail].filter(Boolean).join(' '));
  (error as any).status = status;
  (error as any).code = code || status;
  return error;
}

function normalizeModelRequest(params: any): any {
  if (!params || typeof params !== 'object') return params;
  const next = { ...params };
  const model = String(next.model || '').trim();
  if ((model === 'gemini-3.7-flash' || model === 'gemini-3.6-flash' || model === 'gemini-3.5-flash-lite') && next.config) {
    const config = { ...next.config };
    delete config.temperature;
    delete config.topP;
    delete config.topK;
    next.config = config;
  }
  return next;
}

function normalizeRequestedModelChain(meta: any, requestParams: any): string[] {
  const requested = Array.isArray(meta?.modelChain)
    ? meta.modelChain.map((item: unknown) => String(item || '').trim()).filter(Boolean).slice(0, 5)
    : [];
  const primaryModel = String(requestParams?.model || '').trim();
  const normalized = [primaryModel, ...requested]
    .filter((model, index, all) => Boolean(model) && all.indexOf(model) === index)
    .slice(0, 5);
  return normalized.length ? normalized : requested;
}

function isInitialSongGenerationContext(context: string): boolean {
  const clean = String(context || '').trim();
  return clean === 'generateSong'
    || clean === 'generateSongCompactFallback'
    || clean.startsWith('languageMixLockedWholeRewrite')
    || clean.startsWith('generateSong v2');
}

function getPreFilteredCooldownSkips(
  context: string,
  requested: string[],
): GeminiProxyModelSkip[] {
  const canonical = isInitialSongGenerationContext(context)
    ? [...INITIAL_SONG_MODEL_CHAIN]
    : context === FAST_REPAIR_CONTEXT
      ? [...FAST_REPAIR_MODEL_CHAIN]
      : [];
  if (!canonical.length) return [];
  return canonical
    .filter((model) => !requested.includes(model))
    .map((model) => ({ model, cooldown: getGeminiModelCooldown(model) }))
    .filter((item) => Boolean(item.cooldown))
    .map(({ model, cooldown }) => createModelSkip(
      context,
      model,
      'cooldown',
      {
        remainingMs: cooldown?.remainingMs,
        detail: String(cooldown?.reason || 'temporary_model_cooldown'),
      },
    ));
}

function resolveLatencyModelChain(meta: any, requestParams: any): string[] {
  const context = String(meta?.context || '').trim();
  const sessionId = String(meta?.sessionId || '').trim();
  const requested = normalizeRequestedModelChain(meta, requestParams);

  if (context === FAST_REPAIR_CONTEXT) {
    const fastBase = requested.length > 1
      ? [...FAST_REPAIR_MODEL_CHAIN]
      : [FAST_REPAIR_MODEL_CHAIN[0]];
    const slowModels = getSlowSuccessModels(sessionId);
    const filtered = fastBase.filter((model) => !slowModels.has(model));
    const resolved = filtered.length ? filtered : fastBase;
    if (slowModels.size && filtered.length) {
      console.warn(
        `[SORIDRAW Gemini Latency] ${context}: skipping same-song slow-success model(s) ${Array.from(slowModels).join(', ')}`,
      );
    }
    return resolved;
  }

  if (isInitialSongGenerationContext(context) && requested.length > 1) {
    const initialFastChain = INITIAL_SONG_MODEL_CHAIN.filter((model) => requested.includes(model));
    if (initialFastChain.length) return initialFastChain;
  }

  return requested;
}

function getServerCooldownSkips(
  payload: any,
  context: string,
  modelChain: string[],
  serverAttempts: any[],
): GeminiProxyModelSkip[] {
  const hints = Array.isArray(payload?.cooldowns) ? payload.cooldowns : [];
  if (!hints.length) return [];
  const attemptedModels = new Set(serverAttempts.map((attempt) => String(attempt?.model || '').trim()).filter(Boolean));
  return hints
    .map((hint: any) => ({
      model: String(hint?.model || '').trim(),
      remainingMs: Math.max(0, Math.round(Number(hint?.remainingMs) || 0)),
      reason: String(hint?.reason || 'temporary_model_cooldown').trim() || 'temporary_model_cooldown',
    }))
    .filter((hint) => Boolean(hint.model)
      && hint.remainingMs > 0
      && modelChain.includes(hint.model)
      && !attemptedModels.has(hint.model))
    .map((hint) => createModelSkip(
      context,
      hint.model,
      'cooldown',
      { remainingMs: hint.remainingMs, detail: hint.reason },
    ));
}

async function generateContentViaFirebase(params: any): Promise<any> {
  const user = auth.currentUser;
  if (!user?.uid) {
    throw new Error('로그인이 필요합니다.');
  }

  const idToken = await user.getIdToken();
  const appCheckToken = await getFirebaseAppCheckToken();
  const requestParams = normalizeModelRequest(params);
  const meta = requestParams?.__soridrawMeta || {};
  if (requestParams && typeof requestParams === 'object') {
    delete requestParams.__soridrawMeta;
  }

  const sessionId = String(meta.sessionId || '').trim();
  const context = String(meta.context || 'Gemini 호출').trim();
  const requestedModelChain = normalizeRequestedModelChain(meta, requestParams);
  const preFilteredCooldownSkips = getPreFilteredCooldownSkips(context, requestedModelChain);
  const resolvedModelChain = resolveLatencyModelChain(meta, requestParams);
  const concurrentResult = avoidConcurrentModelProbe(resolvedModelChain, context);
  const modelChain = concurrentResult.modelChain;
  const localModelSkips = dedupeModelSkips([
    ...preFilteredCooldownSkips,
    ...concurrentResult.skips,
  ]);
  if (localModelSkips.length) {
    recordGeminiAuditModelSkips({ sessionId, context, skips: localModelSkips });
  }
  if (modelChain.length && String(requestParams?.model || '').trim() !== modelChain[0]) {
    requestParams.model = modelChain[0];
  }
  const releaseClientInFlight = acquireClientModelInFlight(modelChain[0] || '');

  const response = await fetch(`${CLOUD_FUNCTIONS_BASE_URL}/generateGeminiContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
    },
    body: JSON.stringify({
      request: requestParams,
      sessionId,
      context,
      fallbackAttempt: Math.max(1, Math.round(Number(meta.fallbackAttempt) || 1)),
      modelChain: modelChain.length ? modelChain : undefined,
      fallbackInstruction: String(meta.fallbackInstruction || '').trim().slice(0, 5000) || undefined,
      latencyPolicy: GEMINI_LATENCY_POLICY,
      thinkingPolicy: GEMINI_THINKING_POLICY,
    }),
  }).finally(releaseClientInFlight);

  const appCheckStatus = response.headers.get('X-SORIDRAW-App-Check-Status') || 'not-reported';
  console.info(`[SORIDRAW App Check] server status: ${appCheckStatus}`);

  const payload = await response.json().catch(() => null);
  const serverAttempts = Array.isArray(payload?.attempts) ? payload.attempts : [];
  const modelSkips = dedupeModelSkips([
    ...localModelSkips,
    ...getServerCooldownSkips(payload, context, modelChain, serverAttempts),
  ]);
  if (modelSkips.length) {
    recordGeminiAuditModelSkips({ sessionId, context, skips: modelSkips });
  }
  recordSlowSuccessModels(sessionId, serverAttempts);
  if (!response.ok || !payload?.ok) {
    const error = normalizeProxyError(response.status, payload);
    (error as any).serverAttempts = serverAttempts;
    (error as any).serverCooldowns = Array.isArray(payload?.cooldowns) ? payload.cooldowns : [];
    (error as any).__soridrawModelSkips = modelSkips;
    throw error;
  }

  return {
    text: typeof payload.text === 'string' ? payload.text : '',
    usageMetadata: payload.usageMetadata || undefined,
    modelVersion: payload.modelVersion || undefined,
    responseId: payload.responseId || undefined,
    promptFeedback: payload.promptFeedback || undefined,
    __soridrawServerAttempts: serverAttempts,
    __soridrawServerCooldowns: Array.isArray(payload.cooldowns) ? payload.cooldowns : [],
    __soridrawServerUsedModel: String(payload.usedModel || payload.modelVersion || '').trim() || undefined,
    __soridrawModelSkips: modelSkips,
  };
}

export function createGeminiServerProxy(): GoogleGenAI {
  return {
    models: {
      generateContent: generateContentViaFirebase,
    },
  } as unknown as GoogleGenAI;
}

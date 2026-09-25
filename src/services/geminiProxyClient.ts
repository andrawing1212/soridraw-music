import type { GoogleGenAI } from '@google/genai';
import { auth, getFirebaseAppCheckToken } from '../firebase';
import { getGeminiModelCooldown } from './geminiModelPreferences';
import { recordGeminiAuditModelSkips } from './geminiAuditLog';

const CLOUD_FUNCTIONS_BASE_URL = 'https://us-central1-soridraw-app-866a5.cloudfunctions.net';
const DEFAULT_GEMINI_FUNCTION_NAME = 'generateGeminiContent';
const PREVIEW_GEMINI_FUNCTION_NAME = 'generateGeminiContentPreview';

function resolveGeminiFunctionName(): string {
  if (typeof window === 'undefined') return DEFAULT_GEMINI_FUNCTION_NAME;
  const host = String(window.location?.hostname || '').toLowerCase();
  return host === 'preview.soridraw.com'
    || host === 'soridraw-preview.web.app'
    || host === 'soridraw-preview.firebaseapp.com'
    ? PREVIEW_GEMINI_FUNCTION_NAME
    : DEFAULT_GEMINI_FUNCTION_NAME;
}
const GEMINI_LATENCY_POLICY = 'bounded-v1' as const;
const GEMINI_THINKING_POLICY = 'initial-36-low-small-35-low-v2' as const;
const FAST_REPAIR_CONTEXT = 'repairV1FinalProductionCues';
const SMALL_REPAIR_CONTEXTS = new Set([
  FAST_REPAIR_CONTEXT,
  'rewriteLyricHardBanCards',
  'rewriteLyricHardBanLines',
  'rewriteLyricHardBanLinesSecondPass',
  'repairSelectedLanguageCard',
]);
const SORIDRAW_887_LATENCY_FASTPATH = true;
const SORIDRAW_888_SPLIT_LANGUAGE_MIX_ROUTE = true;
const INITIAL_SONG_MODEL_CHAIN = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
] as const;
const LANGUAGE_MIX_MODEL_CHAIN = [
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
  'gemini-3.8-flash',
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

type SessionModelOutcome = {
  status: 'success' | 'failed';
  durationMs: number;
  updatedAt: number;
};

type SessionModelHealth = {
  outcomes: Map<string, SessionModelOutcome>;
  lastSuccessfulModel?: string;
  updatedAt: number;
};

const slowSuccessModelsBySession = new Map<string, SlowSuccessSession>();
const sessionModelHealthBySession = new Map<string, SessionModelHealth>();

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

function pruneSessionModelHealth(): void {
  const now = Date.now();
  for (const [sessionId, entry] of sessionModelHealthBySession.entries()) {
    if (!entry || now - entry.updatedAt > SLOW_SUCCESS_SESSION_TTL_MS) {
      sessionModelHealthBySession.delete(sessionId);
    }
  }
  if (sessionModelHealthBySession.size <= 100) return;
  const oldest = Array.from(sessionModelHealthBySession.entries())
    .sort((a, b) => a[1].updatedAt - b[1].updatedAt)
    .slice(0, sessionModelHealthBySession.size - 100);
  oldest.forEach(([sessionId]) => sessionModelHealthBySession.delete(sessionId));
}

function recordSessionModelOutcomes(sessionId: string, attempts: any[]): void {
  if (!sessionId || !Array.isArray(attempts) || !attempts.length) return;
  pruneSessionModelHealth();
  const current = sessionModelHealthBySession.get(sessionId) || {
    outcomes: new Map<string, SessionModelOutcome>(),
    updatedAt: Date.now(),
  };
  attempts.forEach((attempt) => {
    const model = String(attempt?.model || '').trim();
    if (!model) return;
    const status = attempt?.status === 'success' ? 'success' : 'failed';
    const durationMs = Math.max(0, Math.round(Number(attempt?.durationMs || 0)));
    current.outcomes.set(model, { status, durationMs, updatedAt: Date.now() });
    if (status === 'success') current.lastSuccessfulModel = model;
  });
  current.updatedAt = Date.now();
  sessionModelHealthBySession.set(sessionId, current);
  pruneSessionModelHealth();
}

function getSessionModelHealth(sessionId: string): SessionModelHealth | null {
  if (!sessionId) return null;
  pruneSessionModelHealth();
  return sessionModelHealthBySession.get(sessionId) || null;
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
  if ((model === 'gemini-3.8-flash' || model === 'gemini-3.7-flash' || model === 'gemini-3.6-flash' || model === 'gemini-3.5-flash-lite') && next.config) {
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

function isLanguageMixWholeRewriteContext(context: string): boolean {
  return String(context || '').trim().startsWith('languageMixLockedWholeRewrite');
}

function isInitialSongGenerationContext(context: string): boolean {
  const clean = String(context || '').trim();
  return clean === 'generateSong'
    || clean === 'generateSongCompactFallback'
    || clean.startsWith('generateSong v2');
}

function isSmallRepairContext(context: string): boolean {
  return SMALL_REPAIR_CONTEXTS.has(String(context || '').trim());
}

function resolveAdaptiveSmallRepair(
  context: string,
  sessionId: string,
  requested: string[],
): { modelChain: string[]; skips: GeminiProxyModelSkip[] } | null {
  if (!isSmallRepairContext(context)) return null;

  const base = requested.length > 1
    ? FAST_REPAIR_MODEL_CHAIN.filter((model) => requested.includes(model))
    : [FAST_REPAIR_MODEL_CHAIN[0]].filter((model) => requested.length === 0 || requested.includes(model));
  if (!base.length) return null;

  const health = getSessionModelHealth(sessionId);
  const slowModels = getSlowSuccessModels(sessionId);
  const failedModels = new Set(
    Array.from(health?.outcomes.entries() || [])
      .filter(([, outcome]) => outcome.status === 'failed')
      .map(([model]) => model),
  );

  let healthy = base.filter((model) => !failedModels.has(model) && !slowModels.has(model));
  if (!healthy.length) healthy = base.filter((model) => !failedModels.has(model));
  if (!healthy.length) healthy = [...base];

  const preferred = String(health?.lastSuccessfulModel || '').trim();
  if (preferred && healthy.includes(preferred) && !slowModels.has(preferred)) {
    healthy = [preferred, ...healthy.filter((model) => model !== preferred)];
  }

  const selected = new Set(healthy);
  const skips = base
    .filter((model) => !selected.has(model))
    .map((model) => {
      if (failedModels.has(model)) {
        return createModelSkip(
          context,
          model,
          'other',
          { detail: '같은 곡에서 직전 실패한 모델 재호출 생략' },
        );
      }
      return createModelSkip(
        context,
        model,
        'slow_success',
        { detail: '같은 곡에서 30초 이상 걸린 성공 모델 재호출 생략' },
      );
    });

  if (skips.length) {
    console.warn(
      `[SORIDRAW Gemini Adaptive Repair] ${context}: ${skips.map((skip) => `${skip.model}(${skip.reason})`).join(', ')}`,
    );
  }

  return { modelChain: healthy, skips };
}

function getPreFilteredCooldownSkips(
  context: string,
  requested: string[],
): GeminiProxyModelSkip[] {
  const canonical = isLanguageMixWholeRewriteContext(context)
    ? [...LANGUAGE_MIX_MODEL_CHAIN]
    : isInitialSongGenerationContext(context)
      ? [...INITIAL_SONG_MODEL_CHAIN]
      : isSmallRepairContext(context)
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

  if (isLanguageMixWholeRewriteContext(context) && requested.length > 1) {
    const languageMixChain = LANGUAGE_MIX_MODEL_CHAIN.filter((model) => requested.includes(model));
    if (languageMixChain.length) return languageMixChain;
  }

  if (isInitialSongGenerationContext(context) && requested.length > 1) {
    // App142: the proxy owns the verified five-model production chain.
    // Older callers may not know newly released stable models yet, so build the
    // chain here while still honoring the existing per-model cooldown cache.
    const initialFastChain = INITIAL_SONG_MODEL_CHAIN.filter((model) => !getGeminiModelCooldown(model));
    return initialFastChain.length ? initialFastChain : [...INITIAL_SONG_MODEL_CHAIN];
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

const SORIDRAW_877_DEDICATED_JAPANESE_AUDIT_SLOT = true;

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
  const serverSessionId = String(meta.serverSessionId || sessionId).trim();
  const context = String(meta.context || 'Gemini 호출').trim();
  const requestedModelChain = normalizeRequestedModelChain(meta, requestParams);
  const preFilteredCooldownSkips = getPreFilteredCooldownSkips(context, requestedModelChain);
  const adaptiveRepair = resolveAdaptiveSmallRepair(context, sessionId, requestedModelChain);
  const resolvedModelChain = adaptiveRepair?.modelChain || resolveLatencyModelChain(meta, requestParams);
  const concurrentResult = avoidConcurrentModelProbe(resolvedModelChain, context);
  const modelChain = concurrentResult.modelChain;
  const localModelSkips = dedupeModelSkips([
    ...preFilteredCooldownSkips,
    ...(adaptiveRepair?.skips || []),
    ...concurrentResult.skips,
  ]);
  if (localModelSkips.length) {
    recordGeminiAuditModelSkips({ sessionId, context, skips: localModelSkips });
  }
  if (modelChain.length && String(requestParams?.model || '').trim() !== modelChain[0]) {
    requestParams.model = modelChain[0];
  }
  const releaseClientInFlight = acquireClientModelInFlight(modelChain[0] || '');

  const response = await fetch(`${CLOUD_FUNCTIONS_BASE_URL}/${resolveGeminiFunctionName()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
    },
    body: JSON.stringify({
      request: requestParams,
      sessionId: serverSessionId,
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
  recordSessionModelOutcomes(sessionId, serverAttempts);
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

export type GeminiModelAvailabilityResult = {
  complete: boolean;
  models: Array<{ model: string; listed: boolean | null }>;
};

export async function readPreviewGeminiModelAvailability(): Promise<GeminiModelAvailabilityResult> {
  if (resolveGeminiFunctionName() !== PREVIEW_GEMINI_FUNCTION_NAME) {
    throw new Error('모델 목록 검사는 PREVIEW에서만 사용할 수 있습니다.');
  }
  const user = auth.currentUser;
  if (!user?.uid) throw new Error('로그인이 필요합니다.');
  const idToken = await user.getIdToken();
  const appCheckToken = await getFirebaseAppCheckToken();
  const response = await fetch(`${CLOUD_FUNCTIONS_BASE_URL}/${PREVIEW_GEMINI_FUNCTION_NAME}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
    },
    body: JSON.stringify({ diagnostic: 'model-availability' }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok || !Array.isArray(payload.models)) {
    throw new Error(`모델 목록 확인 실패: ${String(payload?.code || response.status)}`);
  }
  return {
    complete: Boolean(payload.complete),
    models: payload.models.map((item: any) => ({
      model: String(item?.model || ''),
      listed: typeof item?.listed === 'boolean' ? item.listed : null,
    })).filter((item: { model: string }) => Boolean(item.model)),
  };
}

export function createGeminiServerProxy(): GoogleGenAI {
  return {
    models: {
      generateContent: generateContentViaFirebase,
    },
  } as unknown as GoogleGenAI;
}

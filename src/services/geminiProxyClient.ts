import type { GoogleGenAI } from '@google/genai';
import { auth, getFirebaseAppCheckToken } from '../firebase';

const CLOUD_FUNCTIONS_BASE_URL = 'https://us-central1-soridraw-app-866a5.cloudfunctions.net';
const GEMINI_LATENCY_POLICY = 'bounded-v1' as const;
const FAST_REPAIR_CONTEXT = 'repairV1FinalProductionCues';
const FAST_REPAIR_MODEL_CHAIN = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
] as const;
const SLOW_SUCCESS_THRESHOLD_MS = 30_000;
const SLOW_SUCCESS_SESSION_TTL_MS = 20 * 60_000;

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

function resolveLatencyModelChain(meta: any, requestParams: any): string[] {
  const context = String(meta?.context || '').trim();
  const sessionId = String(meta?.sessionId || '').trim();
  const requested = normalizeRequestedModelChain(meta, requestParams);
  if (context !== FAST_REPAIR_CONTEXT) return requested;

  // Respect the user's auto-fallback choice. A one-model incoming chain means
  // the repair also stays single-model, but it starts on the latency-oriented 3.5 model.
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
  const modelChain = resolveLatencyModelChain(meta, requestParams);
  if (context === FAST_REPAIR_CONTEXT && modelChain.length) {
    requestParams.model = modelChain[0];
  }

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
      // 846 preview opts in explicitly. The shared Function keeps 845/main behavior
      // unchanged for clients that do not send this policy flag.
      latencyPolicy: GEMINI_LATENCY_POLICY,
    }),
  });

  const appCheckStatus = response.headers.get('X-SORIDRAW-App-Check-Status') || 'not-reported';
  console.info(`[SORIDRAW App Check] server status: ${appCheckStatus}`);

  const payload = await response.json().catch(() => null);
  const serverAttempts = Array.isArray(payload?.attempts) ? payload.attempts : [];
  recordSlowSuccessModels(sessionId, serverAttempts);
  if (!response.ok || !payload?.ok) {
    const error = normalizeProxyError(response.status, payload);
    (error as any).serverAttempts = serverAttempts;
    (error as any).serverCooldowns = Array.isArray(payload?.cooldowns) ? payload.cooldowns : [];
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
  };
}

export function createGeminiServerProxy(): GoogleGenAI {
  return {
    models: {
      generateContent: generateContentViaFirebase,
    },
  } as unknown as GoogleGenAI;
}

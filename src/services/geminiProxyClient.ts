import type { GoogleGenAI } from '@google/genai';
import { auth, getFirebaseAppCheckToken } from '../firebase';

const CLOUD_FUNCTIONS_BASE_URL = 'https://us-central1-soridraw-app-866a5.cloudfunctions.net';

function normalizeProxyError(status: number, payload: any): Error {
  const code = String(payload?.code || payload?.errorCode || '').trim();
  const detail = String(payload?.error || payload?.message || `Gemini proxy request failed (${status})`).trim();
  const error = new Error([status ? `HTTP ${status}` : '', code, detail].filter(Boolean).join(' '));
  (error as any).status = status;
  (error as any).code = code || status;
  return error;
}

async function generateContentViaFirebase(params: any): Promise<any> {
  const user = auth.currentUser;
  if (!user?.uid) {
    throw new Error('로그인이 필요합니다.');
  }

  const idToken = await user.getIdToken();
  const appCheckToken = await getFirebaseAppCheckToken();
  const requestParams = params && typeof params === 'object' ? { ...params } : params;
  const meta = requestParams?.__soridrawMeta || {};
  if (requestParams && typeof requestParams === 'object') {
    delete requestParams.__soridrawMeta;
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
      sessionId: String(meta.sessionId || '').trim(),
      context: String(meta.context || 'Gemini 호출').trim(),
      fallbackAttempt: Math.max(1, Math.round(Number(meta.fallbackAttempt) || 1)),
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw normalizeProxyError(response.status, payload);
  }

  return {
    text: typeof payload.text === 'string' ? payload.text : '',
    usageMetadata: payload.usageMetadata || undefined,
    modelVersion: payload.modelVersion || undefined,
    responseId: payload.responseId || undefined,
    promptFeedback: payload.promptFeedback || undefined,
  };
}

export function createGeminiServerProxy(): GoogleGenAI {
  return {
    models: {
      generateContent: generateContentViaFirebase,
    },
  } as unknown as GoogleGenAI;
}

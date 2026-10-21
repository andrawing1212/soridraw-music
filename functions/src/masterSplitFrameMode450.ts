import { HttpsError, onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

// Reuse Firebase Remote Config's EXISTING realtime channel. The Admin SDK
// preserves the template ETag: publishTemplate without force rejects races.
// No shared RTDB Rules write, new RTDB instance, or extra browser socket.
const PARAMS = {
  preview: 'soridraw_split_frame_preview_v1',
  test: 'soridraw_split_frame_test_v1',
  production: 'soridraw_split_frame_production_v1',
} as const;
const ORIGINS: Record<string, keyof typeof PARAMS> = {
  'https://preview.soridraw.com': 'preview',
  'https://test.soridraw.com': 'test',
  'https://soridraw.com': 'production',
  'https://www.soridraw.com': 'production',
};
const MODES = ['pure-pane', 'local-responsive', 'pure-pane-hybrid'] as const;
const validMode = (value: unknown): value is typeof MODES[number] =>
  value === 'pure-pane' || value === 'local-responsive' || value === 'pure-pane-hybrid';
const normalizeRecord = (raw: unknown): { mode: typeof MODES[number]; revision: number } => {
  try {
    const value = JSON.parse(String(raw || '{}'));
    if (validMode(value?.mode) && Number.isSafeInteger(value.revision) && value.revision >= 0) {
      return { mode: value.mode, revision: value.revision };
    }
  } catch { /* Parameter not provisioned: app448 safe Hybrid default. */ }
  return { mode: 'pure-pane-hybrid', revision: 0 };
};

export const masterSetSplitFrameMode = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '관리자 로그인이 필요합니다.');
  const snap = await admin.firestore().collection('users').doc(uid).get();
  if (snap.data()?.staffRole !== 'master') {
    throw new HttpsError('permission-denied', '마스터 권한이 필요합니다.');
  }
  const origin = String(request.rawRequest.headers.origin || '').replace(/\/$/, '');
  const environment = ORIGINS[origin];
  if (!environment || request.data?.environment !== environment) {
    throw new HttpsError('permission-denied', '현재 서비스와 설정 대상이 다릅니다.');
  }
  // Same built artifact for PREVIEW → TEST → PRODUCTION. Default permits
  // ONLY preview, and each later environment needs explicit trusted release
  // configuration. The browser cannot expand this server allowlist.
  const approved = String(process.env.SORIDRAW_SPLIT_FRAME_ENABLED_ENVIRONMENTS || 'preview')
    .split(',').map((item) => item.trim());
  if (!approved.includes(environment)) {
    throw new HttpsError('failed-precondition', '이 환경의 설정 적용은 아직 승인되지 않았습니다.');
  }
  // The same strictly Master-only callable supports a READ action when
  // the control mounts. It retrieves authoritative mode/revision directly,
  // instead of trusting a browser's old Remote Config bootstrap/cache.
  const action: unknown = request.data?.action;
  if (action !== undefined && action !== 'read' && action !== 'apply') {
    throw new HttpsError('invalid-argument', '요청한 설정 동작이 올바르지 않습니다.');
  }
  const readOnly = action === 'read';
  const mode: unknown = request.data?.mode;
  const expectedRevision: unknown = request.data?.expectedRevision;
  if (!readOnly && (!validMode(mode) || !Number.isSafeInteger(expectedRevision) ||
      (expectedRevision as number) < 0)) {
    throw new HttpsError('invalid-argument', '설정값 또는 확인 번호가 잘못됐습니다.');
  }

  const remote = admin.remoteConfig();
  const template = await remote.getTemplate();
  const key = PARAMS[environment];
  const currentParam = template.parameters?.[key];
  // A global Master setting must never silently overwrite a personalized
  // or conditionally targeted parameter that may have been added elsewhere.
  if (currentParam?.conditionalValues && Object.keys(currentParam.conditionalValues).length > 0) {
    throw new HttpsError('failed-precondition', '조건별 원격 설정이 존재해 전체 적용을 중단했습니다.');
  }
  const defaultValue = currentParam?.defaultValue;
  if (currentParam && (!defaultValue || !('value' in defaultValue))) {
    throw new HttpsError('failed-precondition', '설정 상태를 확인할 수 없어 전체 적용을 중단했습니다.');
  }
  const previous = normalizeRecord(defaultValue && 'value' in defaultValue ? defaultValue.value : undefined);
  if (currentParam && JSON.stringify(previous) !== String(defaultValue && 'value' in defaultValue ? defaultValue.value : '')) {
    throw new HttpsError('failed-precondition', '기존 분할바 설정이 올바르지 않아 덮어쓰지 않았습니다.');
  }
  if (readOnly) {
    return { ok: true, environment, mode: previous.mode, revision: previous.revision };
  }
  if (previous.revision !== expectedRevision) {
    throw new HttpsError('aborted', '다른 마스터의 변경이 먼저 적용됐습니다. 최신 상태에서 다시 선택해주세요.');
  }
  const revision = previous.revision + 1;
  const value = JSON.stringify({ mode, revision });
  template.parameters[key] = {
    ...(template.parameters[key] || {}),
    defaultValue: { value },
    description: 'SORIDRAW app450 split-frame mode; environment-scoped operational signal',
  };
  try {
    // NEVER force publish; exact ETag from getTemplate is required.
    await remote.publishTemplate(template);
  } catch (error) {
    // Concurrent Remote Config template writers yield an ETag conflict.
    // Never retry from a stale Master selection or overwrite other params.
    throw new HttpsError('aborted', '설정이 동시에 변경됐거나 전송에 실패했습니다. 다시 확인해주세요.');
  }
  return { ok: true, environment, mode, revision };
});

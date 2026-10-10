import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const update = read('src/services/appUpdateNotice.ts');
const overlayWrapper = read('src/components/CacheDiagnosticsOverlay.tsx');
const overlay = read('src/components/CacheDiagnosticsOverlayImpl.tsx');
const pageSync = read('src/lib/pageSyncCoordinator.ts');

const requireText = (source, token, label) => {
  if (!source.includes(token)) throw new Error(label + ' missing: ' + token);
};

requireText(update, 'SORIDRAW_CACHE_LIVE_UPDATE_RESET_217_20260928', 'update reset marker');
for (const token of [
  'soridraw_cloudflare_diagnostics_v1',
  'soridraw_firestore_sdk_actual_v1',
  'soridraw_page_sync_diagnostics_v1',
  'soridraw_cache_diagnostics_state_v1_',
  'soridraw_catalog_runtime_diagnostics_v1_',
]) requireText(update, token, 'diagnostic-only update reset');
requireText(update, 'resetRuntimeDiagnosticsAfterUpgrade();', 'upgrade reset call');
if (update.includes('localStorage.clear(')) throw new Error('update reset must not clear product localStorage');
if (update.includes('sessionStorage.clear(')) throw new Error('update reset must not clear unrelated sessionStorage');

requireText(pageSync, 'export const resetPageSyncDiagnostics', 'page sync reset export');
requireText(overlayWrapper, "lazy(() => import('./CacheDiagnosticsOverlayImpl'))", 'Master lazy overlay entry');
requireText(overlayWrapper, 'if (!isAdmin) return null;', 'non-Admin must not load diagnostics');
requireText(overlay, 'resetPageSyncDiagnostics();', 'manual reset page sync');
requireText(overlay, '이번 실행 진단', 'run scope label');
requireText(overlay, '업데이트 적용 시 자동 초기화', 'upgrade reset label');
requireText(overlay, 'CLOUDFLARE 요청 상세 · 이번 실행', 'Cloudflare run label');
requireText(overlay, "if (path === '/v1/me/social-snapshot') return '개인 소셜 스냅샷';", 'social snapshot label');
requireText(overlay, "title=\"이번 실행 진단값만 0으로 초기화\"", 'manual reset title');
requireText(overlay, '실제 서버 지표 · 오늘 / 최근 {CLOUD_WINDOW_MINUTES}분', 'server scope label');

console.log('217_CACHE_LIVE_UPDATE_RESET=PASS diagnostic_session_only=true');
console.log('217_CACHE_LIVE_MANUAL_RESET=PASS page_sync=true');
console.log('217_CACHE_LIVE_SCOPE_LABELS=PASS current_run_vs_server=true');

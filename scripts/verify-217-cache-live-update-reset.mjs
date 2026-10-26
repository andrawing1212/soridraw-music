import fs from 'node:fs';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

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

/* app504: exercise read-only manual storage audit with private values present.
   No key/value/UID may be emitted; no writes/clears/network/auto-persist. */
const auditSource504 = read('src/lib/browserStorageCapacityAudit504.ts');
const auditContext504 = { module: { exports: {} }, exports: null, navigator: null, window: null };
auditContext504.exports = auditContext504.module.exports;
const protectedPrivateValue504 = 'PRIVATE_UID_TOKEN_LYRICS_MUST_NOT_APPEAR';
const existingRecords504 = new Map([
  ['soridraw_studio_heart_pending_v1_PRIVATE_UID', protectedPrivateValue504],
  ['soridraw_cache_envelope_v1:public:feed', 'cache contents, not logged'],
  ['pendingAppliedKeywordsBackup', 'song draft - preserve'],
  ['unrelated-setting', 'safe-private-settings'],
]);
let storageWrites504 = 0;
const readOnlyStorage504 = (map) => ({
  get length() { return map.size; },
  key: (index) => Array.from(map.keys())[index] ?? null,
  getItem: (key) => map.get(key) ?? null,
  setItem: () => { storageWrites504 += 1; throw new Error('WRITE_FORBIDDEN'); },
  removeItem: () => { storageWrites504 += 1; throw new Error('DELETE_FORBIDDEN'); },
  clear: () => { storageWrites504 += 1; throw new Error('CLEAR_FORBIDDEN'); },
});
let persistenceRequests504 = 0;
auditContext504.window = {
  localStorage: readOnlyStorage504(existingRecords504),
  sessionStorage: readOnlyStorage504(new Map([['pendingAppliedKeywords', 'tab-only']])),
};
auditContext504.navigator = {
  storage: {
    estimate: async () => ({ usage: 8_000_000, quota: 40_000_000 }),
    persisted: async () => false,
    persist: async () => { persistenceRequests504 += 1; return true; },
  },
};
const auditCompiled504 = ts.transpileModule(auditSource504, {
  fileName: 'browserStorageCapacityAudit504.ts',
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
runInNewContext(auditCompiled504, auditContext504);
const report504 = await auditContext504.module.exports.inspectBrowserStorageCapacity504();
const printed504 = JSON.stringify(report504);
assert.equal(report504.local.items, 4);
assert.equal(report504.session.items, 1);
assert.equal(report504.browserUsageBytes, 8_000_000);
assert.equal(report504.browserQuotaBytes, 40_000_000);
assert.equal(report504.persisted, false);
assert.equal(report504.local.buckets.some((bucket) => bucket.label === '보존 주의: 저장 대기·초안'), true);
assert.equal(printed504.includes(protectedPrivateValue504), false);
assert.equal(printed504.includes('PRIVATE_UID'), false);
assert.equal(printed504.includes('pendingAppliedKeywordsBackup'), false);
assert.equal(storageWrites504, 0);
assert.equal(persistenceRequests504, 0);
assert.equal(existingRecords504.get('pendingAppliedKeywordsBackup'), 'song draft - preserve');
assert.equal(overlay.includes("void inspectStorage504();"), true);
assert.equal(overlay.includes("onClick={() => { void inspectStorage504(); }}"), true);
assert.equal(overlay.includes("if (!canUseDiagnostics || !enabled) return null;"), true);
assert.equal(overlay.includes("setStorageAudit504(await inspectBrowserStorageCapacity504())"), true);
console.log('APP504_MANUAL_ONLY_LOCAL_STORAGE_SIZES_NO_CONTENT=PASS');
console.log('APP504_PROTECTED_PENDING_DRAFTS_UNTOUCHED_R0_W0=PASS');

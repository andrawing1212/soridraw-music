import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import * as ts from 'typescript';
import {
  readStudioHeartPendingIntent,
  listStudioHeartPendingIntents,
  removeStudioHeartPendingIntent,
  writeStudioHeartPendingIntent,
  writeStudioHeartPendingIntentChecked,
  isStudioHeartOptimisticFavorite,
  type StudioHeartPendingIntent,
} from '../src/lib/studioHeartBatch';

// Two independent browsers sharing the same UID, but not browser storage.
// This is a controlled local-only simulation, not a live Firestore acceptance test.
const pcValues = new Map<string, string>();
const mobileValues = new Map<string, string>();
let activeDevice: 'pc' | 'mobile' = 'pc';
let pcQuotaFull = false;
let mobileQuotaFull = false;
const quota = Object.assign(new Error('quota exceeded'), { name: 'QuotaExceededError' });
const activeValues = () => activeDevice === 'pc' ? pcValues : mobileValues;
const storageMock = {
  getItem: (key: string) => activeValues().get(key) ?? null,
  setItem: (key: string, value: string) => {
    if (activeDevice === 'pc' ? pcQuotaFull : mobileQuotaFull) throw quota;
    activeValues().set(key, value);
  },
  removeItem: (key: string) => activeValues().delete(key),
};
const savedGlobal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storageMock });

const makeIntent = (documentId: string, desiredSaved = true, time = Date.now()): StudioHeartPendingIntent => ({
  schemaVersion: 1,
  uid: 'app501-test-account',
  documentId,
  identityKey: 'recent-id:' + documentId,
  baselineSaved: false,
  desiredSaved,
  baselineFavorite: null,
  song: { title: 'A preserved recent song', id: documentId },
  updatedAtMs: time,
  signalVersion: 0,
  pendingRemotePreviewVersion: 0,
  retryCount: 0,
});

try {
  const healthy = makeIntent('healthy');
  assert.equal(writeStudioHeartPendingIntentChecked(healthy), 'stored');
  assert.equal(readStudioHeartPendingIntent(healthy.uid, healthy.documentId)?.desiredSaved, true);
  console.log('APP501_HEALTHY_STUDIO_HEART_BATCH_STILL_DURABLE=PASS');

  pcQuotaFull = true;
  const firstSave = makeIntent('storage-full-new');
  assert.equal(writeStudioHeartPendingIntentChecked(firstSave), 'blocked-empty',
    'quota blocked a first save, so App must use its direct one-row canonical save path');
  assert.equal(readStudioHeartPendingIntent(firstSave.uid, firstSave.documentId), null);
  console.log('APP501_QUOTA_BLOCKED_NEW_SAVE_CANNOT_CLAIM_PENDING_SUCCESS=PASS');

  const changedHealthy = makeIntent('healthy', false, healthy.updatedAtMs + 1);
  assert.equal(writeStudioHeartPendingIntentChecked(changedHealthy), 'blocked-existing',
    'a failed replacement cannot compete with its earlier pending canonical timer');
  assert.equal(readStudioHeartPendingIntent(healthy.uid, healthy.documentId)?.desiredSaved, true,
    'original queued mutation must remain durable');
  console.log('APP501_QUOTA_BLOCKED_OLD_PENDING_PRESERVED=PASS');

  pcQuotaFull = false;
  assert.equal(writeStudioHeartPendingIntentChecked(changedHealthy), 'stored');
  assert.equal(readStudioHeartPendingIntent(healthy.uid, healthy.documentId)?.desiredSaved, false);
  console.log('APP501_RECOVERED_STORAGE_PRESERVES_30S_BATCH=PASS');

  // P1 regression: 21st new song cannot silently evict the oldest of 20.
  activeDevice = 'pc';
  const capacityUid = 'app501-capacity-uid';
  const capacitySongs = Array.from({ length: 20 }, (_, i) => ({ ...makeIntent('cap-' + i, true, healthy.updatedAtMs + 100 + i), uid: capacityUid }));
  for (const intent of capacitySongs) assert.equal(writeStudioHeartPendingIntentChecked(intent), 'stored');
  const capacityKey = 'soridraw_studio_heart_pending_v1_' + capacityUid;
  const fullBytes = pcValues.get(capacityKey);
  assert.ok(fullBytes);
  const song21 = { ...makeIntent('cap-21', true, healthy.updatedAtMs + 200), uid: capacityUid };
  assert.equal(writeStudioHeartPendingIntentChecked(song21), 'blocked-capacity');
  assert.equal(pcValues.get(capacityKey), fullBytes, 'no queued song may be evicted');
  assert.equal(listStudioHeartPendingIntents(capacityUid).length, 20);
  for (const intent of capacitySongs) assert.equal(readStudioHeartPendingIntent(capacityUid, intent.documentId)?.desiredSaved, true);
  writeStudioHeartPendingIntent(song21);
  assert.equal(pcValues.get(capacityKey), fullBytes, 'unchecked writer must not truncate full outbox');
  console.log('APP501_CAPACITY_20_TO_21_NO_EVICTION=PASS');

  // Editing an existing queued song at capacity retains the other 19.
  const replacement = { ...capacitySongs[0], desiredSaved: false, updatedAtMs: healthy.updatedAtMs + 201 };
  assert.equal(writeStudioHeartPendingIntentChecked(replacement), 'stored');
  assert.equal(readStudioHeartPendingIntent(capacityUid, replacement.documentId)?.desiredSaved, false);
  assert.equal(listStudioHeartPendingIntents(capacityUid).length, 20);
  for (const intent of capacitySongs.slice(1)) assert.equal(readStudioHeartPendingIntent(capacityUid, intent.documentId)?.desiredSaved, true);
  console.log('APP501_CAPACITY_EXISTING_SONG_CAN_CHANGE=PASS');

  // Once an existing pending song has settled, the next new song fits.
  removeStudioHeartPendingIntent(capacityUid, capacitySongs[19].documentId);
  assert.equal(writeStudioHeartPendingIntentChecked(song21), 'stored');
  assert.equal(readStudioHeartPendingIntent(capacityUid, song21.documentId)?.desiredSaved, true);
  assert.equal(listStudioHeartPendingIntents(capacityUid).length, 20);
  console.log('APP501_CAPACITY_REOPENS_AFTER_SETTLEMENT=PASS');

  // If an older browser already has >20 records, never silently clip it.
  const legacyUid = 'app501-legacy-over-capacity';
  const legacyKey = 'soridraw_studio_heart_pending_v1_' + legacyUid;
  const legacyItems = Array.from({ length: 22 }, (_, i) => ({ ...makeIntent('legacy-' + i, true, healthy.updatedAtMs + 500 + i), uid: legacyUid }));
  const legacyRaw = Object.fromEntries(legacyItems.map((item) => [item.documentId, item]));
  pcValues.set(legacyKey, JSON.stringify(legacyRaw));
  assert.equal(listStudioHeartPendingIntents(legacyUid).length, 22);
  const legacy23 = { ...makeIntent('legacy-23', true, healthy.updatedAtMs + 600), uid: legacyUid };
  assert.equal(writeStudioHeartPendingIntentChecked(legacy23), 'blocked-capacity');
  writeStudioHeartPendingIntent(legacy23);
  assert.equal(pcValues.get(legacyKey), JSON.stringify(legacyRaw));
  console.log('APP501_LEGACY_OVER_CAPACITY_NO_TRUNCATION=PASS');
  // Independent audit P1: the legacy 22-item queue must drain after a
  // successful canonical commit. Declining to remove a settled song creates
  // a replay on browser restart and can double-apply the operation.
  const legacyUpdate = {
    ...legacyItems[0],
    retryCount: 1,
    updatedAtMs: healthy.updatedAtMs + 700,
  };
  assert.equal(writeStudioHeartPendingIntentChecked(legacyUpdate), 'stored',
    'existing song retry metadata must remain writable at 22');
  assert.equal(readStudioHeartPendingIntent(legacyUid, legacyUpdate.documentId)?.retryCount, 1);
  assert.equal(listStudioHeartPendingIntents(legacyUid).length, 22);
  for (const other of legacyItems.slice(1)) {
    assert.equal(readStudioHeartPendingIntent(legacyUid, other.documentId)?.desiredSaved, true);
  }
  console.log('APP501_LEGACY_OVERSIZED_EXISTING_UPDATE=PASS');

  // Canonical settlement #1: 22 -> 21. Store must really lose the completed
  // document while retaining the other 21, including after a simulated reload.
  removeStudioHeartPendingIntent(legacyUid, legacyItems[0].documentId);
  assert.equal(listStudioHeartPendingIntents(legacyUid).length, 21);
  assert.equal(readStudioHeartPendingIntent(legacyUid, legacyItems[0].documentId), null);
  assert.equal(Object.keys(JSON.parse(pcValues.get(legacyKey)!)).length, 21);
  for (const item of legacyItems.slice(1)) {
    assert.equal(readStudioHeartPendingIntent(legacyUid, item.documentId)?.desiredSaved, true);
  }
  // A new 22nd item still may not enter before the queue reaches capacity.
  assert.equal(writeStudioHeartPendingIntentChecked(legacy23), 'blocked-capacity');
  console.log('APP501_LEGACY_DRAIN_22_TO_21=PASS');

  // Canonical settlement #2: 21 -> 20 (exact full-capacity boundary).
  removeStudioHeartPendingIntent(legacyUid, legacyItems[1].documentId);
  assert.equal(listStudioHeartPendingIntents(legacyUid).length, 20);
  assert.equal(readStudioHeartPendingIntent(legacyUid, legacyItems[1].documentId), null);
  assert.equal(Object.keys(JSON.parse(pcValues.get(legacyKey)!)).length, 20);
  for (const item of legacyItems.slice(2)) {
    assert.equal(readStudioHeartPendingIntent(legacyUid, item.documentId)?.desiredSaved, true);
  }
  assert.equal(writeStudioHeartPendingIntentChecked(legacy23), 'blocked-capacity');
  console.log('APP501_LEGACY_DRAIN_21_TO_20=PASS');

  // Once one more song settles there is room for the next fresh intent.
  removeStudioHeartPendingIntent(legacyUid, legacyItems[2].documentId);
  assert.equal(listStudioHeartPendingIntents(legacyUid).length, 19);
  assert.equal(writeStudioHeartPendingIntentChecked(legacy23), 'stored');
  assert.equal(listStudioHeartPendingIntents(legacyUid).length, 20);
  assert.equal(readStudioHeartPendingIntent(legacyUid, legacy23.documentId)?.desiredSaved, true);
  for (const item of legacyItems.slice(3)) {
    assert.equal(readStudioHeartPendingIntent(legacyUid, item.documentId)?.desiredSaved, true);
  }
  console.log('APP501_LEGACY_DRAIN_REOPENS_AT_19=PASS');

  // A: PC save (mobile observes only). B: mobile save (PC observes only).
  // C: mobile save while PC is closed. Each song must have its own durable
  // pending slot; the remote RTDB preview must never be mistaken for this slot.
  const A = makeIntent('three-A-from-pc', true, healthy.updatedAtMs + 5);
  const B = makeIntent('three-B-from-mobile', true, healthy.updatedAtMs + 6);
  const C = makeIntent('three-C-mobile-offline-pc', true, healthy.updatedAtMs + 7);
  activeDevice = 'pc';
  assert.equal(writeStudioHeartPendingIntentChecked(A), 'stored');
  activeDevice = 'mobile';
  assert.equal(readStudioHeartPendingIntent(A.uid, A.documentId), null, 'PC browser pending cannot materialize as mobile canonical');
  assert.equal(writeStudioHeartPendingIntentChecked(B), 'stored');
  assert.equal(writeStudioHeartPendingIntentChecked(C), 'stored');
  assert.equal(readStudioHeartPendingIntent(B.uid, B.documentId)?.desiredSaved, true);
  assert.equal(readStudioHeartPendingIntent(C.uid, C.documentId)?.desiredSaved, true);
  activeDevice = 'pc';
  assert.equal(readStudioHeartPendingIntent(A.uid, A.documentId)?.desiredSaved, true);
  assert.equal(readStudioHeartPendingIntent(B.uid, B.documentId), null, 'RTDB preview is not a PC pending intent');
  activeDevice = 'mobile';
  console.log('APP501_THREE_SONG_PC_MOBILE_SEPARATE_PENDING_AND_OFFLINE_PEER=PASS');

  // Same UID, mobile-only storage rejection: app500 falsely acknowledged and
  // broadcast this path; app501 must direct-save one canonical row instead.
  mobileQuotaFull = true;
  const blockedMobile = makeIntent('mobile-quota-new-song', true, healthy.updatedAtMs + 8);
  assert.equal(writeStudioHeartPendingIntentChecked(blockedMobile), 'blocked-empty');
  assert.equal(readStudioHeartPendingIntent(blockedMobile.uid, blockedMobile.documentId), null);
  assert.equal(readStudioHeartPendingIntent(B.uid, B.documentId)?.desiredSaved, true,
    'quota failure on another song must not remove an already pending song');
  mobileQuotaFull = false;
  assert.equal(writeStudioHeartPendingIntentChecked(blockedMobile), 'stored');
  assert.equal(readStudioHeartPendingIntent(blockedMobile.uid, blockedMobile.documentId)?.desiredSaved, true);
  console.log('APP501_MOBILE_QUOTA_RECOVERY_INDEPENDENT_OF_PC_AND_EXISTING_SONGS=PASS');

  // A failed replacement with identical millisecond/state but changed content
  // must not be accepted solely because its older metadata matches.
  activeDevice = 'pc';
  const sameTimestampChangedSong = {
    ...A,
    song: { ...A.song, title: 'changed after the original save attempt' },
  };
  pcQuotaFull = true;
  assert.equal(writeStudioHeartPendingIntentChecked(sameTimestampChangedSong), 'blocked-existing');
  assert.equal(readStudioHeartPendingIntent(A.uid, A.documentId)?.song.title, A.song.title);
  pcQuotaFull = false;
  assert.equal(writeStudioHeartPendingIntentChecked(sameTimestampChangedSong), 'stored');
  assert.equal(readStudioHeartPendingIntent(A.uid, A.documentId)?.song.title, sameTimestampChangedSong.song.title);
  console.log('APP501_SAME_MILLISECOND_REJECTED_WRITE_CANNOT_LOOK_DURABLE=PASS');

  // Simulate a reload by replacing storage's JS reference but keeping persisted
  // bytes. Browser persistence is per-device; the canonical server is external.
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { ...storageMock },
  });
  activeDevice = 'mobile';
  assert.equal(readStudioHeartPendingIntent(B.uid, B.documentId)?.desiredSaved, true);
  assert.equal(readStudioHeartPendingIntent(C.uid, C.documentId)?.desiredSaved, true);
  activeDevice = 'pc';
  assert.equal(readStudioHeartPendingIntent(A.uid, A.documentId)?.song.title, sameTimestampChangedSong.song.title);
  console.log('APP501_THREE_SONG_PENDING_SURVIVES_SIMULATED_BROWSER_RELOAD=PASS');

  // A full Catalog must not adopt a newer PC-only RTDB phantom as real.
  const simulatedCatalog = [{ id: 'A' }, { id: 'C' }];
  const localItems = [
    { id: 'B', updatedAtMs: 9999, __studioHeartRemotePreviewLocal: true },
    { id: 'D', updatedAtMs: 9999, __studioHeartPendingLocal: true },
    { id: 'E', updatedAtMs: 9999 },
  ];
  const trueNewer = localItems.filter((item) => !isStudioHeartOptimisticFavorite(item) && item.updatedAtMs > 1000);
  assert.deepEqual([...simulatedCatalog, ...trueNewer].map((i) => i.id), ['A', 'C', 'E']);
  console.log('APP501_CATALOG_PHANTOM_NOT_CANONICAL=PASS');
  const app = readFileSync('src/App.tsx','utf8');
  const queue = app.slice(app.indexOf('const queueStudioHeartPendingIntent ='),app.indexOf('  useEffect(() => {',app.indexOf('const queueStudioHeartPendingIntent =')));
  assert.ok(queue.includes("const durableIntentResult = writeStudioHeartPendingIntentChecked(intent);"));
  assert.match(queue,/durableIntentResult === 'blocked-existing'[\s\S]*?throw new Error\('STUDIO_HEART_PENDING_STORAGE_BLOCKED_WITH_EXISTING'\)/);
  assert.match(queue,/durableIntentResult === 'blocked-empty'[\s\S]*?blocked-capacity'[\s\S]*?return false;/);
  assert.ok(queue.indexOf('durableIntentResult ===') < queue.indexOf('scheduleStudioHeartPendingIntent(safeDocumentId)'),
    'only an independently verified durable write may enter the 30-second queue');
  assert.ok(queue.indexOf('durableIntentResult ===') < queue.indexOf('publishMusicNoteHeartPreviewDelta('),
    'never broadcast saved membership without either a durable queue or canonical write');
  const heartStart = app.indexOf('const handleToggleCurrentStudioFavorite =');
  assert.ok(heartStart >= 0);
  const heart = app.slice(heartStart, heartStart + 24000);
  assert.match(heart,/if \(queueStudioHeartPendingIntent\([\s\S]*?\)\) \{[\s\S]*?return;/,
    'successful batch alone may short-circuit, quota-blocked fresh saves must continue to direct favorite path');
  assert.ok(heart.includes("await toggleFavorite(heartSnapshot as SongResult"),
    'existing one-song canonical saving path must remain as the fallback');
  assert.ok(app.includes("브라우저 저장 공간이 부족하여 이번 하트 변경을 저장하지 못했습니다."),
    'conflicting pending failure must be disclosed rather than returning a false saved toast');
  const remotePreview = app.slice(app.indexOf('const applyRemoteStudioHeartPreview ='), app.indexOf('const clearRemoteStudioHeartPreviewFromCanonical ='));
  assert.ok(remotePreview.includes('writeFavoritesCache(safeUid, visible, { publishDerived: false })'));
  const hydrate = app.slice(app.indexOf("unsubMusicNoteBundle = subscribeListBundle('musicNote'"), app.indexOf('const loadMoreFavorites ='));
  assert.ok(hydrate.includes('isStudioHeartOptimisticFavorite(favorite)'));
  assert.ok(hydrate.includes('writeFavoritesCache(currentUser.uid, authoritative, { publishDerived: false })'));
  const refresh = app.slice(app.indexOf('const refreshFavoritesFromServerFirstPage ='), app.indexOf('const refreshFavoritesFromServerFirstPage =') + 5000);
  assert.ok(refresh.includes('isStudioHeartOptimisticFavorite(favorite)'));
  assert.ok(refresh.includes('writeFavoritesCache(uid, merged, { publishDerived: false })'));
  assert.ok(!refresh.includes('favoritesStore.setFavorites(merged)'));
  const diagnostic = readFileSync('src/lib/studioHeartSingleDocDiagnostic.ts', 'utf8');
  const diagnosticUi = readFileSync('src/components/StudioHeartSingleDocDiagnostic.tsx', 'utf8');
  const diagnosticPanel = readFileSync('src/components/CacheDiagnosticsOverlayImpl.tsx', 'utf8');
  assert.ok(diagnostic.includes("where(firestoreDocumentId(), '==', documentId)"),
    'Firestore query must bind the exact document ID');
  assert.ok(diagnostic.includes("where('uid', '==', uid)"),
    'Firestore query must filter by the signed-in account for rules-compatible missing detection');
  assert.ok(diagnostic.includes('limit(1)'),
    'no user favorites collection scan is allowed');
  assert.equal((diagnostic.match(/getDocsFromServer\(/g) || []).length, 1,
    'one explicit server-only bounded query per click');
  assert.ok(!diagnostic.includes('getDocFromServer('),
    'owner-only direct document reads cannot reliably distinguish missing from permission denied');
  assert.ok(diagnostic.includes('if (auth.currentUser?.uid !== uid)'));
  assert.ok(diagnostic.includes("readCatalogSnapshotFromLocalCache('musicNote', uid)"));
  assert.ok(diagnostic.includes('candidates.size === 1'),
    'duplicate-title local rows must require explicit exact document ID');
  assert.ok(!/\b(?:setDoc|updateDoc|deleteDoc|addDoc|writeBatch|getDocs)\s*\(/.test(diagnostic),
    'diagnostic must not write, backfill or change canonical data');
  assert.ok(!diagnostic.includes('getDocs('),
    'automatic cache-fallback reads are not server authority');
  assert.ok(diagnosticUi.includes('onClick={() => void inspect()}'));
  assert.ok(diagnosticUi.includes('!uid || !documentId.trim() || busy || alreadyRead'));
  assert.ok(diagnosticPanel.includes('<StudioHeartSingleDocDiagnostic />'));

  // Independent Work P2: exercise the actual React component in an isolated
  // hook/JSX runtime, with deferred server responses. A response for A must
  // never appear under a newly entered B ID or after an account switch.
  const compiledDiagnosticUi = ts.transpileModule(diagnosticUi, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: 'StudioHeartSingleDocDiagnostic.tsx',
  }).outputText;
  const mockAuth: { currentUser: { uid: string } | null } = { currentUser: { uid: 'owner-A' } };
  const authListeners = new Set<(user: { uid: string } | null) => void>();
  const hookValues: any[] = [];
  let hookIndex = 0;
  const cleanups: Array<() => void> = [];
  const inFlightReads: Array<{
    uid: string;
    documentId: string;
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }> = [];
  const mockReact = {
    useState: (initial: any) => {
      const slot = hookIndex++;
      if (!(slot in hookValues)) hookValues[slot] = initial;
      return [hookValues[slot], (next: any) => {
        hookValues[slot] = typeof next === 'function' ? next(hookValues[slot]) : next;
      }];
    },
    useRef: (initial: any) => {
      const slot = hookIndex++;
      if (!(slot in hookValues)) hookValues[slot] = { current: initial };
      return hookValues[slot];
    },
    useEffect: (effect: () => (() => void) | void) => {
      const slot = hookIndex++;
      if (slot in hookValues) return;
      hookValues[slot] = true;
      const cleanup = effect();
      if (cleanup) cleanups.push(cleanup);
    },
  };
  const jsx = (type: any, props: any) => ({ type, props: props || {} });
  const cjsModule: { exports: any } = { exports: {} };
  runInNewContext(compiledDiagnosticUi, {
    exports: cjsModule.exports,
    module: cjsModule,
    require: (name: string) => {
      if (name === 'react') return mockReact;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'firebase/auth') return {
        onAuthStateChanged: (_auth: unknown, listener: (user: { uid: string } | null) => void) => {
          authListeners.add(listener);
          listener(mockAuth.currentUser);
          return () => { authListeners.delete(listener); };
        },
      };
      if (name === '../firebase') return { auth: mockAuth };
      if (name === '../lib/studioHeartSingleDocDiagnostic') return {
        findSingleLocalFavoriteDocumentId: () => null,
        inspectExactStudioHeartDocument: (uid: string, documentId: string) => new Promise(
          (resolve, reject) => { inFlightReads.push({ uid, documentId, resolve, reject }); },
        ),
      };
      throw new Error('unexpected component import: ' + name);
    },
  });
  const Component = cjsModule.exports.default as () => any;
  const renderDiagnostic = (): any => {
    hookIndex = 0;
    return Component();
  };
  const findUi = (node: any, predicate: (n: any) => boolean): any => {
    if (Array.isArray(node)) {
      for (const child of node) {
        const match = findUi(child, predicate);
        if (match) return match;
      }
      return null;
    }
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    return findUi(node.props?.children, predicate);
  };
  const getDocInput = (tree: any) => findUi(tree, (n) => n.type === 'input' && n.props?.id === 'studio-heart-exact-doc-id');
  const getTitleInput = (tree: any) => findUi(tree, (n) => n.type === 'input' && n.props?.['aria-label'] === '현재 기기에 있는 곡의 정확한 제목');
  const getReadButton = (tree: any) => findUi(tree, (n) => n.type === 'button' && /서버 저장문서 1건 확인|확인 중/.test(JSON.stringify(n.props?.children)));
  const getLocalButton = (tree: any) => findUi(tree, (n) => n.type === 'button' && JSON.stringify(n.props?.children).includes('이 브라우저에서 문서 찾기'));
  const hasServerReport = (tree: any) => JSON.stringify(tree).includes('이 계정의 서버 저장문서 존재');
  const makeReport = (documentPresent: boolean) => ({
    documentPresent,
    ownerMatchesSignedInUser: documentPresent ? true : null,
    serverActive: documentPresent ? true : null,
    deviceMusicNoteRow: false,
    deviceRowIsOptimistic: false,
    devicePendingIntent: false,
    devicePendingDesiredSaved: null,
    deviceRecentHeartAuthority: null,
    deviceCatalogCached: false,
    deviceCatalogContainsDocument: null,
  });
  let uiTree = renderDiagnostic();
  getDocInput(uiTree).props.onChange({ target: { value: 'A' } });
  uiTree = renderDiagnostic();
  getReadButton(uiTree).props.onClick();
  assert.equal(inFlightReads.length, 1);
  assert.equal(inFlightReads[0].documentId, 'A');
  assert.equal(inFlightReads[0].uid, 'owner-A');
  uiTree = renderDiagnostic();
  assert.equal(getDocInput(uiTree).props.disabled, true, 'document ID locked during remote read');
  assert.equal(getTitleInput(uiTree).props.disabled, true, 'local title locked during remote read');
  assert.equal(getLocalButton(uiTree).props.disabled, true, 'local lookup locked during remote read');
  getReadButton(uiTree).props.onClick();
  assert.equal(inFlightReads.length, 1, 'concurrent clicks cannot issue extra Firestore queries');

  // A queued input event may have started before React paints disabled=true.
  // The component still has to discard A when its displayed target becomes B.
  getDocInput(uiTree).props.onChange({ target: { value: 'B' } });
  inFlightReads[0].resolve(makeReport(true));
  // VM-transpiled async handlers complete on the next event-loop turn;
  // a single Promise.resolve() tick can inspect UI before React state settles.
  await new Promise<void>((resolve) => setImmediate(resolve));
  uiTree = renderDiagnostic();
  assert.equal(getDocInput(uiTree).props.value, 'B');
  assert.equal(hasServerReport(uiTree), false, 'A response must not appear below B document input');
  assert.ok(!JSON.stringify(uiTree).includes('서버 원본 1건만 읽었습니다.'));
  assert.equal(inFlightReads.length, 1, 'B has not been queried automatically');
  console.log('APP502_UI_RACE_A_RESPONSE_DISCARDED_AFTER_B_INPUT=PASS');

  // A valid B request can complete, then any new input invalidates its report.
  getReadButton(uiTree).props.onClick();
  assert.equal(inFlightReads.length, 2);
  assert.equal(inFlightReads[1].documentId, 'B');
  inFlightReads[1].resolve(makeReport(true));
  // VM-transpiled async handlers complete on the next event-loop turn;
  // a single Promise.resolve() tick can inspect UI before React state settles.
  await new Promise<void>((resolve) => setImmediate(resolve));
  uiTree = renderDiagnostic();
  assert.equal(hasServerReport(uiTree), true);
  getTitleInput(uiTree).props.onChange({ target: { value: 'changed title' } });
  uiTree = renderDiagnostic();
  assert.equal(hasServerReport(uiTree), false, 'changing the local title clears the old server result');

  // Account switch invalidates C, even if an older C response arrives while a
  // new account's D request is active. Old finally cannot unlock the new read.
  getDocInput(uiTree).props.onChange({ target: { value: 'C' } });
  uiTree = renderDiagnostic();
  getReadButton(uiTree).props.onClick();
  assert.equal(inFlightReads.length, 3);
  assert.equal(inFlightReads[2].uid, 'owner-A');
  mockAuth.currentUser = { uid: 'owner-B' };
  for (const listener of authListeners) listener(mockAuth.currentUser);
  uiTree = renderDiagnostic();
  assert.equal(hasServerReport(uiTree), false);
  getDocInput(uiTree).props.onChange({ target: { value: 'D' } });
  uiTree = renderDiagnostic();
  getReadButton(uiTree).props.onClick();
  assert.equal(inFlightReads.length, 4);
  assert.equal(inFlightReads[3].uid, 'owner-B');
  inFlightReads[2].resolve(makeReport(true));
  // VM-transpiled async handlers complete on the next event-loop turn;
  // a single Promise.resolve() tick can inspect UI before React state settles.
  await new Promise<void>((resolve) => setImmediate(resolve));
  uiTree = renderDiagnostic();
  assert.equal(hasServerReport(uiTree), false, 'old UID response must not show under a new UID');
  assert.equal(getDocInput(uiTree).props.disabled, true, 'old request finally cannot unlock newer request');
  inFlightReads[3].resolve(makeReport(false));
  // VM-transpiled async handlers complete on the next event-loop turn;
  // a single Promise.resolve() tick can inspect UI before React state settles.
  await new Promise<void>((resolve) => setImmediate(resolve));
  uiTree = renderDiagnostic();
  assert.equal(hasServerReport(uiTree), true, 'the newest UID/ID request may render');
  assert.ok(JSON.stringify(uiTree).includes('아니요'));
  for (const cleanup of cleanups) cleanup();
  console.log('APP502_UI_RACE_UID_AND_REQUEST_SEQUENCE_ISOLATED=PASS');

  console.log('APP502_EXACT_SINGLE_DOC_READ_ONLY_MANUAL_DIAGNOSTIC=PASS');
  console.log('APP501_COLD_CATALOG_READ_NO_PHANTOM_PUBLISH=PASS');
  console.log('APP501_APP_RECENT_TO_MUSIC_NOTE_FALLBACK_CONTRACT=PASS');
  console.log('SORIDRAW_APP501_STUDIO_HEART_QUOTA_SAFE=PASS');
} finally {
  if (savedGlobal) Object.defineProperty(globalThis,'localStorage',savedGlobal);
  else delete (globalThis as any).localStorage;
}

// The targeted source-quality workflow already runs this app501/502 verifier.
// Explicitly include the separate app503 Explore/GlobalPlayer *executable*
// quota-full handoff regression in the same pinned CI gate. The broader
// release-system audit may also call verify-201, but cannot substitute here.
execFileSync(process.execPath, ['scripts/verify-201-explore-track-action-sheet.mjs'], {
  stdio: 'inherit',
});
console.log('APP505_QUOTA_HANDOFF_EXECUTABLE_CI_GATE=PASS');

// app508: all quota safety regressions must execute together on one tree.
for (const verifier of [
  'scripts/verify-506-folder-quota-safe-settlement.mjs',
  'scripts/verify-507-library-revision-quota-safe.mjs',
]) {
  execFileSync(process.execPath, [verifier], { stdio: 'inherit' });
}
console.log('APP508_ALL_QUOTA_EXECUTABLE_CI_GATE=PASS');

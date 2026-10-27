import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const compile = path => ts.transpileModule(readFileSync(path, 'utf8'), {
  fileName: path,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const engineCode = compile('src/lib/userDataEngine.ts');
const repairCode = compile('src/lib/musicNoteSingleDocCatalogRepair516.ts');
const diagnosticCode = compile('src/lib/studioHeartSingleDocDiagnostic.ts');
const uiCode = readFileSync('src/components/StudioHeartSingleDocDiagnostic.tsx', 'utf8');
const active = item => Boolean(item) && item.favoriteRemoved !== true && item.saved !== false
  && item.hidden !== true && item.favoriteHidden !== true && !item.deletedAt && !item.trashedAt;
const uid = 'one-user';
const songId = 'exact-firestore-document';
const favorite = { uid, title: 'The preserved track', createdAtMs: 42, saved: true, firestoreId: 'legacy-alias' };
const base = () => ({
  schemaVersion: 4, authority: 'server', kind: 'musicNote', revision: 100,
  items: [{ id: 'untouched', firestoreId: 'untouched', title: 'Other original', saved: true, createdAtMs: 90 }],
  itemCount: 1, complete: true, generatedAtMs: 100,
});
const copy = value => JSON.parse(JSON.stringify(value));
const makeEnvironment = ({ serverBase = base(), canonical = favorite, pending = false, failRead = false, failPost = false, onGet = null, onPost = null } = {}) => {
  const stats = { workerGets: 0, workerPosts: 0, docReads: 0, otherQueries: 0, canonicalWrites: 0, broadcast: 0 };
  let remote = copy(serverBase);
  let actualCanonical = canonical ? copy(canonical) : null;
  let signal = { version: 10, operation: 'save', documentIds: [] };
  const auth = { currentUser: { uid, getIdToken: async () => 'mock-user-token' } };
  const mockFetch = async (_url, opts) => {
    if (opts?.method === 'GET') {
      stats.workerGets++;
      if (onGet) onGet({ setCanonical: v => { actualCanonical = v ? copy(v) : null; }, setSignal: v => { signal = copy(v); } });
      if (failRead) return { status: 503, ok: false, text: async () => 'offline' };
      return { status: 200, ok: true, json: async () => copy(remote) };
    }
    if (opts?.method !== 'POST' || !_url.endsWith('/v1/catalog/musicNote/delta')) {
      stats.otherQueries++; throw new Error('unexpected full-scan or request');
    }
    stats.workerPosts++;
    if (onPost) onPost({ setCanonical: v => { actualCanonical = v ? copy(v) : null; }, setSignal: v => { signal = copy(v); } });
    if (failPost) return { status: 409, ok: false, json: async () => ({ revision: 777, itemCount: remote.itemCount }) };
    const d = JSON.parse(opts.body);
    assert.equal(d.baseRevision, remote.revision);
    assert.deepEqual(d.deletedIds, [], 'never infer deletion from missing local rows');
    assert.equal(d.upserts.length, 1, 'one exact upsert only');
    assert.equal(d.upserts[0].id, songId, 'real document ID over legacy alias');
    assert.equal(d.upserts[0].firestoreId, songId);
    assert.ok(!('lyrics' in d.upserts[0]), 'no full private song payload in R2 summary');
    const rows = new Map(remote.items.map(item => [item.id, item]));
    rows.set(songId, copy(d.upserts[0]));
    remote = { ...remote, items: [...rows.values()].sort((a,b) => b.createdAtMs - a.createdAtMs),
      itemCount: rows.size, revision: d.revision, generatedAtMs: Date.now() };
    return { status: 200, ok: true, json: async () => ({ revision: remote.revision, itemCount: remote.itemCount }) };
  };
  const engineMocks = name => {
    if (name === '../firebase') return { auth, getFirebaseAppCheckToken: async () => 'app-check-token' };
    if (name === './musicNoteSavedState') return { isMusicNoteItemRemoved: item => !active(item) };
    if (name === './userProfileCache') return { readUserProfileCache: () => ({}) };
    if (name === './firestoreMeasured') return {
      clearAdaptiveListIndexDirtyRevision: () => {}, readAdaptiveListIndexDirtyRevision: () => 0,
    };
    if (name === './catalogRuntimeDiagnostics') return { markCatalogRuntimeDiagnostic: () => {} };
    if (name === './catalogWarmCachePolicy') return {
      canUseWarmCatalogWithoutRemote: () => false, readCatalogProfileRevision: () => 0,
    };
    throw new Error('unexpected engine module ' + name);
  };
  const engine = {};
  runInNewContext(engineCode, { exports: engine, require: engineMocks, window: { location: { hostname: 'preview.soridraw.com' } },
    fetch: mockFetch, crypto: { randomUUID: () => 'fixed-mutation-id' }, TextEncoder, setTimeout,
    console: { warn: () => {} },
  });
  const repairMocks = name => {
    if (name === '../firebase') return { auth, db: {}, realtimeDb: {} };
    if (name === 'firebase/database') return {
      ref: (_db, path) => path,
      get: async () => ({ val: () => copy(signal) }),
    };
    if (name === './firestoreMeasured') return {
      collection: () => 'favorites',
      documentId: () => '__name__',
      query: (...args) => args,
      where: (...args) => args,
      limit: () => 1,
    };
    if (name === 'firebase/firestore') return { getDocsFromServer: async () => {
      stats.docReads++;
      if (!actualCanonical) return { size: 0, docs: [] };
      return { size: 1, docs: [{ id: songId, data: () => copy(actualCanonical) }] };
    } };
    if (name === './cacheDiagnostics') return { markFirestoreActualRead: () => {} };
    if (name === './studioHeartBatch') return { readStudioHeartPendingIntent: () => pending ? { desiredSaved: true } : null };
    if (name === './musicNoteSavedState') return { isMusicNoteItemRemoved: item => !active(item) };
    if (name === './userDataEngine') return engine;
    if (name === '../services/userDomainSyncService') return { publishMusicNoteSaveStateDelta: async (u, id, item) => {
      assert.equal(u, uid); assert.equal(id, songId); assert.equal(item.id, songId);
      stats.broadcast++;
    } };
    throw new Error('unexpected repair module ' + name);
  };
  const repair = {};
  runInNewContext(repairCode, { exports: repair, require: repairMocks });
  return { auth, stats, repair: repair.repairSingleExactMusicNoteCatalog516, engine, getRemote: () => copy(remote),
    setCanonical: v => { actualCanonical = v ? copy(v) : null; },
    setSignal: v => { signal = copy(v); } };
};

{
  const x = makeEnvironment();
  assert.equal(await x.repair(uid, songId), 'repaired');
  assert.ok(x.stats.docReads >= 3, 'must re-read canonical before shared write and RTDB signal');
  assert.equal(x.stats.workerPosts, 1);
  assert.equal(x.stats.broadcast, 1);
  assert.deepEqual(x.getRemote().items.map(item => item.id), ['untouched', songId]);
  assert.equal(await x.repair(uid, songId), 'already-present');
  assert.equal(x.stats.workerPosts, 1, 'no repeat R2 write on an already repaired song');
  assert.equal(x.stats.broadcast, 2, 'a missed RTDB message can be replayed');
  console.log('APP516_ONE_CANONICAL_R1_ONE_R2_UPSERT_IDEMPOTENT=PASS');
}
{
  const x = makeEnvironment({ serverBase: { ...base(), items: [
    { id: songId, firestoreId: 'legacy-alias', createdAtMs: 100, title: 'Saved', saved: true },
  ], itemCount: 1 } });
  assert.equal(await x.repair(uid, songId), 'already-present');
  assert.equal(x.stats.workerPosts, 0, 'a legacy firestoreId alias must not invent a duplicate row');
  console.log('APP516_EXISTING_EXACT_ID_NO_R2_WRITE=PASS');
}
{
  const x = makeEnvironment({ serverBase: { ...base(), items: [
    { id: 'another-record', firestoreId: songId, createdAtMs: 100, saved: true },
  ], itemCount: 1 } });
  await assert.rejects(() => x.repair(uid, songId), /CATALOG_RECOVERY_UNCONFIRMED/);
  assert.equal(x.stats.workerPosts, 0, 'a legacy alias collision must stop without duplication');
  console.log('APP516_ALIAS_COLLISION_STOPS_NO_DATA_CHANGE=PASS');
}
{
  const x = makeEnvironment({ serverBase: { ...base(), items: [
    { id: songId, firestoreId: songId, createdAtMs: 100, saved: false },
  ], itemCount: 1 } });
  assert.equal(await x.repair(uid, songId), 'repaired');
  assert.equal(x.stats.workerPosts, 1);
  assert.equal(x.getRemote().itemCount, 1, 'reactivation must not increase count');
  console.log('APP516_STALE_R2_TOMBSTONE_ONE_ACTIVE_UPSERT=PASS');
}
for (const options of [
  { canonical: { ...favorite, saved: false }, label: 'removed' },
  { canonical: null, label: 'absent' },
  { pending: true, label: 'pending' },
]) {
  const x = makeEnvironment(options);
  await assert.rejects(() => x.repair(uid, songId));
  assert.equal(x.stats.workerPosts, 0);
  assert.equal(x.stats.broadcast, 0);
  if (options.label === 'pending') assert.equal(x.stats.docReads, 0);
}
console.log('APP516_REMOVED_MISSING_PENDING_NEVER_REPAIR=PASS');
{
  const x = makeEnvironment({ failRead: true });
  await assert.rejects(() => x.repair(uid, songId), /CATALOG_RECOVERY_UNCONFIRMED/);
  assert.equal(x.stats.workerPosts, 0); assert.equal(x.stats.broadcast, 0);
  console.log('APP516_R2_ERROR_NO_UPSERT_NO_FALSE_SIGNAL=PASS');
}
{
  const x = makeEnvironment({ failPost: true });
  await assert.rejects(() => x.repair(uid, songId), /CATALOG_RECOVERY_UNCONFIRMED/);
  assert.equal(x.stats.workerPosts, 1); assert.equal(x.stats.broadcast, 0);
  console.log('APP516_R2_CONFLICT_NO_FALSE_SYNC=PASS');
}
{
  const x = makeEnvironment();
  x.auth.currentUser.uid = 'different-user';
  await assert.rejects(() => x.repair(uid, songId), /INVALID_OWNER_OR_ID/);
  assert.equal(x.stats.docReads + x.stats.workerGets + x.stats.workerPosts + x.stats.broadcast, 0);
  console.log('APP516_AUTH_CHANGED_ZERO_IO=PASS');
}
{
  // P1 independent-audit reproduction: PC A first reads an active document,
  // mobile B unsaves while A fetches R2. A must never put the old save back.
  const x = makeEnvironment({ onGet: ({ setCanonical, setSignal }) => {
    setCanonical({ ...favorite, saved: false });
    setSignal({ version: 11, operation: 'heart-preview-unsave', documentIds: [songId] });
  } });
  await assert.rejects(() => x.repair(uid, songId), /CATALOG_RECOVERY_UNCONFIRMED/);
  assert.equal(x.stats.workerPosts, 0, 'latest unsave must stop stale R2 upsert');
  assert.equal(x.stats.broadcast, 0, 'latest unsave must not send stale save signal');
  console.log('APP516_AUDIT_P1_CROSS_DEVICE_UNSAVE_AFTER_INITIAL_READ_ABORT=PASS');
}
{
  // B can commit an unsave without an observed RTDB event. Canonical re-read
  // must independently reject the stale first read.
  const x = makeEnvironment({ onGet: ({ setCanonical }) => setCanonical({ ...favorite, saved: false }) });
  await assert.rejects(() => x.repair(uid, songId), /CATALOG_RECOVERY_UNCONFIRMED/);
  assert.equal(x.stats.workerPosts, 0);
  assert.equal(x.stats.broadcast, 0);
  console.log('APP516_AUDIT_P1_COMMITTED_UNSAVE_WITHOUT_RTD_BROADCAST_ABORT=PASS');
}
{
  // Even when canonical is unchanged, a new remote heart-preview during R2
  // inspection invalidates the source-of-truth fence.
  const x = makeEnvironment({ onGet: ({ setSignal }) => setSignal({
    version: 12, operation: 'heart-preview-unsave', documentIds: [songId],
  }) });
  await assert.rejects(() => x.repair(uid, songId));
  assert.equal(x.stats.workerPosts, 0);
  assert.equal(x.stats.broadcast, 0);
  console.log('APP516_AUDIT_P1_REMOTE_PENDING_UNSAVE_FENCE_ABORT=PASS');
}
{
  // P2 audit: unrelated local revision 200 must survive an older R2 revision
  // 100 even if a repair cannot be completed. Exactly no local replacement.
  const x = makeEnvironment({ failPost: true });
  const newest = { ...base(), revision: 200, items: [
    { id: 'local-latest-unrelated', firestoreId: 'local-latest-unrelated', saved: true, createdAtMs: 900 },
  ], itemCount: 1 };
  await x.engine.writeCatalogSnapshotToLocalCache('musicNote', uid, newest);
  await assert.rejects(() => x.repair(uid, songId), /CATALOG_RECOVERY_UNCONFIRMED/);
  const persisted = await x.engine.readCatalogSnapshotFromLocalCache('musicNote', uid);
  assert.equal(persisted.revision, 200);
  assert.deepEqual(persisted.items.map(item => item.id), ['local-latest-unrelated']);
  assert.equal(x.stats.workerPosts, 0, 'stale R2 cannot be used as base');
  console.log('APP516_AUDIT_P2_STALE_R2_MUST_NOT_CLOBBER_NEWER_CACHE=PASS');
}
{
  const x = makeEnvironment({ failPost: true });
  const local = base();
  await x.engine.writeCatalogSnapshotToLocalCache('musicNote', uid, local);
  await assert.rejects(() => x.repair(uid, songId), /CATALOG_RECOVERY_UNCONFIRMED/);
  const after = await x.engine.readCatalogSnapshotFromLocalCache('musicNote', uid);
  assert.equal(after.revision, 100);
  assert.deepEqual(after.items.map(item=>item.id), ['untouched']);
  console.log('APP516_AUDIT_P2_FAILED_POST_PRESERVES_ALL_CACHED_ROWS=PASS');
}

{
  const diagMocks = name => {
    if (name === '../firebase') return { auth: {} };
    if (name === './firestoreMeasured') return {};
    if (name === 'firebase/firestore') return {};
    if (name === './cacheDiagnostics') return {};
    if (name === '../hooks/useFavoritesStore') return { favoritesStore: {} };
    if (name === './studioHeartBatch') return {};
    if (name === './userDataEngine') return {};
    if (name === './musicNoteSavedState') return { isMusicNoteItemRemoved: item => !active(item) };
    throw new Error('unexpected diagnostic module ' + name);
  };
  const d = {};
  runInNewContext(diagnosticCode, { exports: d, require: diagMocks });
  assert.equal(d.catalogContainsExactFavoriteDocument516([{ id: songId, firestoreId: 'wrong-legacy', saved: true }], songId), true);
  assert.equal(d.catalogContainsExactFavoriteDocument516([{ id: 'other', firestoreId: songId, saved: true }], songId), false);
  assert.equal(d.catalogContainsExactFavoriteDocument516([{ id: songId, saved: false }], songId), false);
  console.log('APP516_CANONICAL_ID_NOT_LEGACY_ALIAS_DIAGNOSTIC=PASS');
}
assert.match(uiCode, /report\.documentPresent/);
assert.match(uiCode, /report\.ownerMatchesSignedInUser/);
assert.match(uiCode, /report\.serverActive/);
assert.match(uiCode, /report\.devicePendingIntent/);
assert.match(uiCode, /onClick=\{\(\) => void repair\(\)\}/);
assert.match(uiCode, /const repair = async \(\) =>/);
assert.doesNotMatch(uiCode, /setInterval\(/);
console.log('APP516_MANUAL_ADMIN_ONLY_NO_PAGE_ENTRY_IO=PASS');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Runs real service code and extracted page functions in isolated device VMs.
// No Firebase credentials, user data, browser profile, or network are used.
const sourceRoot = process.argv.find(arg => arg.startsWith('--source-dir='))?.slice('--source-dir='.length) || '.';
const read = path => readFileSync(`${sourceRoot}/${path}`, 'utf8');
const page = read('src/pages/FavoritesPage.tsx');
const transpile = code => ts.transpileModule(code, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
function declaration(name) {
  const tree = ts.createSourceFile('page.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) found = node.getText(tree);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(found, name);
  return `const ${found};`;
}
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const copy = x => JSON.parse(JSON.stringify(x));
const uid = 'fixture-owner';
const folders = name => [{ id: 'default', title: 'My Note', isDefault: true }, { id: 'folder-a', title: name }];
function bus() {
  const listeners = new Map();
  const values = new Map();
  const held = [];
  let mode = 'online';
  let writes = 0;
  return {
    held, values, get writes() { return writes; }, setMode: value => { mode = value; },
    sdk: {
      ref: (_db, path) => path,
      onValue: (path, listener) => {
        const list = listeners.get(path) || [];
        list.push(listener); listeners.set(path, list);
        if (values.has(path)) listener({ val: () => values.get(path) });
        return () => list.splice(list.indexOf(listener), 1);
      },
      set: () => { throw new Error('unexpected RTDB set'); },
      runTransaction: async (path, update) => {
        writes++;
        if (mode === 'denied') throw Object.assign(new Error('permission denied'), { code: 'permission-denied' });
        const value = update(values.get(path));
        if (mode === 'aborted') return { committed: false, snapshot: { val: () => value } };
        values.set(path, value);
        for (const listener of listeners.get(path) || []) listener({ val: () => copy(value) });
        if (mode === 'hold') await new Promise(resolve => held.push(resolve));
        return { committed: true, snapshot: { val: () => value } };
      },
    },
  };
}
function device(transport, { quota = false, server = 'online', clock = 100_000, canonical = { data: {} } } = {}) {
  let now = clock;
  const records = new Map([['original-song-cache', 'protected-prompt-lyrics-heart-bytes']]);
  const timers = new Map(); const events = new Map(); const writes = []; const held = []; const readsHeld = [];
  let nextTimer = 0; let holdRead = false; let attempts = 0; let reads = 0;
  const storage = {
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => { if (quota) throw new Error('QuotaExceededError'); records.set(key, value); },
    removeItem: key => { assert.ok(key.startsWith('soridraw.musicNote.folderStructureBatch.v1.')); records.delete(key); },
  };
  const window = {
    localStorage: storage,
    setTimeout: (fn, ms) => { timers.set(++nextTimer, { fn, at: now + ms }); return nextTimer; },
    clearTimeout: id => timers.delete(id),
    addEventListener: (name, fn) => { const set = events.get(name) || new Set(); set.add(fn); events.set(name, set); },
    dispatchEvent: event => { for (const fn of events.get(event.type) || []) fn(event); return true; },
  };
  const boundary = { runV1MutationBoundary: (_context, promise) => promise, addV1MutationPostSuccessHook: () => {} };
  const measured = {
    doc: (_db, ...parts) => parts.join('/'),
    setDoc: () => { throw new Error('unguarded Music Note structure write'); },
    runTransaction: async (_db, update) => {
      attempts++;
      if (server === 'denied' || server === 'offline') throw Object.assign(new Error(server), {
        code: server === 'denied' ? 'permission-denied' : 'unavailable',
      });
      if (server === 'hold') await new Promise(resolve => held.push(resolve));
      const staged = [];
      const transaction = {
        get: async path => {
          assert.equal(path, `user_structures/${uid}`);
          reads++;
          return { data: () => copy(canonical.data) };
        },
        set: (path, value, options) => {
          assert.equal(path, `user_structures/${uid}`);
          assert.equal(options?.merge, true);
          staged.push(copy(value));
        },
      };
      const result = await update(transaction);
      for (const value of staged) {
        canonical.data = {
          ...canonical.data, ...value,
          ...(value.musicNoteFolders ? {
            musicNoteFolders: { ...(canonical.data.musicNoteFolders || {}), ...value.musicNoteFolders },
          } : {}),
        };
        writes.push(copy(value));
      }
      return result;
    },
    getDocFromServer: async () => {
      reads++;
      if (holdRead) await new Promise(resolve => readsHeld.push(resolve));
      const remote = Object.keys(canonical.data).length
        ? canonical.data : { musicNoteFolders: { myNote: folders('old-server') }, musicNoteStructureVersion: 1 };
      return { exists: () => true, data: () => copy(remote) };
    },
  };
  const globals = {
    window, localStorage: storage, console: { warn() {} }, queueMicrotask,
    Date: class extends Date { static now() { return now; } },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
  };
  const load = (path, require) => {
    const exports = {};
    runInNewContext(transpile(read(path)), { ...globals, exports, require });
    return exports;
  };
  let sync;
  const batch = load('src/services/musicNoteFolderStructureBatch.ts', name => {
    if (name.endsWith('firestoreMeasured')) return measured;
    if (name.endsWith('userDomainSyncService')) return {
      publishMusicNoteStructureDelta: (who, structure) => sync.publishMusicNoteStructureDelta(who, structure),
    };
    if (name.endsWith('firebase')) return { db: {} };
    if (name.endsWith('v1MutationBoundary')) return boundary;
    throw new Error(name);
  });
  sync = load('src/services/userDomainSyncService.ts', name => {
    if (name === 'firebase/auth') return { onAuthStateChanged: (_auth, fn) => fn({ uid }) };
    if (name === 'firebase/database') return transport.sdk;
    if (name.endsWith('firebase')) return { auth: { currentUser: { uid } }, realtimeDb: {} };
    if (name.endsWith('v1MutationBoundary')) return boundary;
    if (name.endsWith('userDataEngine')) return { projectCatalogItemForSync: () => { throw new Error('song projection forbidden'); } };
    if (name.endsWith('musicNoteCompactMediaSync452')) return {};
    throw new Error(name);
  });
  const helperCode = page.slice(page.indexOf('type MusicNoteStructureSharedSession'), page.indexOf('const SORIDRAW_MUSIC_NOTE_STRUCTURE_SIGNAL_1056'));
  const pageExports = {};
  runInNewContext(transpile(helperCode + '\n' + declaration('applyStructurePayload') + '\n' + declaration('persistMusicNoteFolders') + `
    exports.publish = publishMusicNoteStructureSession;
    exports.subscribe = subscribeMusicNoteStructureDocument;
    exports.persist = persistMusicNoteFolders;
    exports.receive = applyStructurePayload;
    exports.session = () => musicNoteStructureSharedSessions.get(uid);
    exports.nextVersion = () => getNextMusicNoteStructureVersion(uid);
  `), {
    ...globals, ...batch, ...sync, ...boundary, ...measured, exports: pageExports, uid, user: { uid }, db: {},
    readUserProfileCache: () => null, USER_PROFILE_CACHE_EVENT: 'profile',
    normalizeMusicNoteFolders: list => list, DEFAULT_MY_NOTE_FOLDERS: [], DEFAULT_SHARED_NOTE_FOLDERS: [],
  });
  window.addEventListener(sync.MUSIC_NOTE_SYNC_EVENT, event => {
    if (event.detail.operation === 'structure-update') pageExports.receive(event.detail.itemJson, event.detail.version);
  });
  return {
    batch, sync, page: pageExports, records, writes, held, readsHeld, window,
    get attempts() { return attempts; }, get reads() { return reads; },
    setServer: value => { server = value; }, setQuota: value => { quota = value; },
    holdRead: () => { holdRead = true; },
    async advance(ms) {
      const target = now + ms;
      for (;;) {
        const next = [...timers].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at; timers.delete(next[0]); next[1].fn(); await tick();
      }
      now = target; await tick();
    },
  };
}

// Actual quota + UI/session merge: editing another mode must retain the first.
{
  const d = device(bus(), { quota: true });
  d.page.publish(uid, { musicNoteFolders: { myNote: folders('kept') }, musicNoteStructureVersion: 20 }, 20);
  d.page.publish(uid, { musicNoteFolders: { sharedNote: folders('shared') }, musicNoteStructureVersion: 21 }, 21);
  assert.equal(d.page.session().data.musicNoteFolders.myNote?.[1].title, 'kept', 'quota must merge memory, not stale disk');
  console.log('APP514_QUOTA_SESSION_PRESERVES_OTHER_MODE=PASS');
}

// Full page queue -> real RTDB publisher -> second page receiver -> canonical ACK.
{
  const wire = bus(); const a = device(wire, { quota: true }); const b = device(wire);
  const visible = [];
  b.page.publish(uid, { musicNoteFolders: { myNote: folders('old') } }, 1);
  b.page.subscribe(uid, data => visible.push(copy(data)));
  await a.page.persist('myNote', folders('renamed'));
  assert.equal(b.page.session().data.musicNoteFolders.myNote[1].title, 'renamed');
  assert.ok(visible.some(x => x.musicNoteFolders.myNote[1].title === 'renamed'));
  assert.equal(b.reads, 0); assert.equal(b.attempts, 0);
  assert.equal(a.batch.getMusicNoteFolderSaveStatus(uid).state, 'unsaved');
  await a.advance(0);
  assert.equal(a.writes.length, 1);
  assert.equal(a.batch.getMusicNoteFolderSaveStatus(uid).state, 'server-confirmed');
  // Reorder through the same real persistence and receiver functions.
  await a.page.persist('myNote', [...folders('renamed'), { id: 'folder-b', title: 'B' }].reverse());
  assert.equal(b.page.session().data.musicNoteFolders.myNote[0].id, 'folder-b');
  await a.advance(5000);
  assert.equal(a.writes.length, 2);
  assert.equal(a.records.get('original-song-cache'), 'protected-prompt-lyrics-heart-bytes');
  console.log('APP514_QUOTA_RENAME_MOVE_RTDB_TWO_DEVICES_R0_W1_PER_SETTLEMENT=PASS');
}

// A late RTDB ACK must never restore an old rename over a newer edit.
{
  const wire = bus(); wire.setMode('hold'); const d = device(wire, { quota: true });
  const first = d.page.persist('myNote', folders('old'));
  await tick();
  const second = d.page.persist('myNote', folders('new'));
  await tick();
  wire.held[1](); await second;
  wire.held[0](); await first;
  assert.equal(d.batch.getPendingMusicNoteFolderStructureBatch(uid).myNote.folders[1].title, 'new');
  assert.equal(d.page.session().data.musicNoteFolders.myNote[1].title, 'new');
  await d.advance(0);
  assert.equal(d.writes.at(-1).musicNoteFolders.myNote[1].title, 'new');
  console.log('APP514_OUT_OF_ORDER_RTDB_ACK_PRESERVES_LATEST_EDIT=PASS');
}

// Canonical old ACK, including equal-version replacement, cannot clear new content.
{
  const d = device(bus(), { quota: true, server: 'hold' });
  d.batch.queueMusicNoteFolderStructureBatch(uid, 'myNote', folders('old'), 1);
  await d.advance(0);
  d.batch.queueMusicNoteFolderStructureBatch(uid, 'myNote', folders('new'), 1);
  d.held.shift()(); await tick();
  assert.equal(d.batch.getPendingMusicNoteFolderStructureBatch(uid).myNote.folders[1].title, 'new');
  d.setServer('online'); await d.advance(5000);
  assert.equal(d.writes.at(-1).musicNoteFolders.myNote[1].title, 'new');
  console.log('APP514_OLD_CANONICAL_ACK_CONTENT_IDENTITY_GUARD=PASS');
}

for (const failure of ['offline', 'denied', 'hold']) {
  const d = device(bus(), { quota: true, server: failure });
  d.batch.queueMusicNoteFolderStructureBatch(uid, 'myNote', folders(failure), 1);
  await d.advance(15_000);
  assert.equal(d.batch.getMusicNoteFolderSaveStatus(uid).state, failure === 'hold' ? 'unconfirmed' : 'failed');
  let guarded = false;
  d.window.dispatchEvent({ type: 'beforeunload', preventDefault() { guarded = true; } });
  assert.ok(guarded, 'memory-only pending warns on supported tab close');
  assert.ok(d.batch.getPendingMusicNoteFolderStructureBatch(uid));
  assert.equal(d.writes.length, 0);
  await d.advance(600_000);
  assert.equal(d.attempts, failure === 'offline' ? 3 : 1, 'bounded attempts / no parallel retry for unknown ACK');
  if (failure === 'hold') { d.held.shift()(); await tick(); }
  else { d.setServer('online'); d.batch.retryMusicNoteFolderStructureBatch(uid); await d.advance(5000); }
  assert.equal(d.batch.getMusicNoteFolderSaveStatus(uid).state, 'server-confirmed');
  console.log(`APP514_QUOTA_${failure.toUpperCase()}_NO_FALSE_ACK_BOUNDED_RECONNECT=PASS`);
}

// RTDB failure cannot turn into a successful cross-device claim; Firestore is independent.
for (const failure of ['denied', 'aborted']) {
  const wire = bus(); wire.setMode(failure); const d = device(wire, { quota: true });
  await d.page.persist('myNote', folders('server-only'));
  assert.equal(d.batch.getMusicNoteFolderSaveStatus(uid).delivery, 'failed');
  await d.advance(0);
  assert.equal(d.batch.getMusicNoteFolderSaveStatus(uid).state, 'server-confirmed');
  assert.equal(d.batch.getMusicNoteFolderSaveStatus(uid).delivery, 'failed');
}
{
  const wire = bus(); const d = device(wire);
  await assert.rejects(d.sync.publishMusicNoteStructureDelta(uid, { musicNoteFolders: { myNote: folders('x'.repeat(25_000)) } }));
  assert.equal(wire.writes, 0, 'oversized folders must not send empty success envelopes');
  console.log('APP514_RTDB_DENIED_ABORTED_OVERSIZED_DISTINCT_FROM_CANONICAL=PASS');
}

// Healthy persistence stays 60s; warm subscribe does not add server reads.
{
  const d = device(bus());
  await d.page.persist('myNote', folders('healthy'));
  d.batch.retryMusicNoteFolderStructureBatch(uid); // ordinary reconnect
  await d.advance(59_999); assert.equal(d.attempts, 0);
  await d.advance(1); assert.equal(d.writes.length, 1);
  assert.equal(d.reads, 1, 'one transaction read only when canonical changes');
  d.page.subscribe(uid, () => {}); assert.equal(d.reads, 1);
  await d.advance(600_000); assert.equal(d.writes.length, 1);
  console.log('APP514_HEALTHY_60S_W1_IDLE_AND_WARM_R0=PASS');
}

// P1: a delayed v100000 flush must not overwrite a newer v100001
// canonical version, and its rejection must preserve the pending edit.
{
  const canonical = { data: {} };
  const a = device(bus(), { server: 'hold', canonical });
  const b = device(bus(), { canonical });
  a.batch.queueMusicNoteFolderStructureBatch(uid, 'myNote', folders('stale-device-a'), 100_000);
  await a.advance(60_000);
  assert.equal(a.attempts, 1);
  b.batch.queueMusicNoteFolderStructureBatch(uid, 'myNote', folders('newer-device-b'), 100_001);
  await b.advance(60_000);
  assert.equal(canonical.data.musicNoteStructureVersion, 100_001);
  assert.equal(canonical.data.musicNoteFolders.myNote[1].title, 'newer-device-b');
  a.held.shift()(); await tick();
  assert.equal(canonical.data.musicNoteStructureVersion, 100_001, 'late write cannot downgrade version');
  assert.equal(canonical.data.musicNoteFolders.myNote[1].title, 'newer-device-b', 'late write cannot replace folders');
  assert.equal(a.writes.length, 0);
  assert.equal(a.batch.getMusicNoteFolderSaveStatus(uid).state, 'failed');
  assert.ok(a.batch.getPendingMusicNoteFolderStructureBatch(uid), 'stale unsaved edit stays available');
  await a.advance(600_000);
  assert.equal(a.attempts, 1, 'version conflict is not automatically retried');
  console.log('APP514_P1_STALE_A_V100000_CANNOT_OVERWRITE_B_V100001=PASS');
}

// Rejected old Firestore update sends one conflict-only RTDB signal. A warm
// receiving device must re-read canonical rather than keep an uncommitted UI.
{
  const canonical = { data: {} };
  const wire = bus();
  const a = device(wire, { server: 'hold', canonical });
  const b = device(bus(), { canonical });
  const c = device(wire, { canonical });
  c.page.publish(uid, { musicNoteFolders: { myNote: folders('baseline') }, musicNoteStructureVersion: 1 }, 1);
  c.page.subscribe(uid, () => {});
  await a.page.persist('myNote', folders('old-preview'));
  assert.equal(c.page.session().data.musicNoteFolders.myNote[1].title, 'old-preview');
  assert.equal(c.reads, 0);
  await a.advance(60_000);
  b.batch.queueMusicNoteFolderStructureBatch(uid, 'myNote', folders('new-canonical'), 100_001);
  await b.advance(60_000);
  assert.equal(canonical.data.musicNoteFolders.myNote[1].title, 'new-canonical');
  a.held.shift()(); await tick();
  assert.equal(a.batch.getMusicNoteFolderSaveStatus(uid).state, 'failed');
  assert.equal(c.reads, 1, 'only actual stale conflict causes canonical refresh');
  assert.equal(c.page.session().data.musicNoteFolders.myNote[1].title, 'new-canonical');
  assert.equal(c.batch.getObservedMusicNoteStructureVersion(uid), 0, 'receivers do not forge commit ACK');
  assert.equal(a.batch.getObservedMusicNoteStructureVersion(uid), 100_001);
  console.log('APP514_P1_RTDB_REJECTED_PREVIEW_REFRESHES_WARM_RECEIVER_R1=PASS');
}

// A slow device clock cannot permanently strand a legitimate next edit:
 // a rejected write learns the canonical version without overwriting it.
{
  const canonical = { data: { musicNoteStructureVersion: 100_001, musicNoteFolders: { myNote: folders('newest-server') } } };
  const d = device(bus(), { quota: true, canonical, clock: 50_000 });
  await d.page.persist('myNote', folders('slow-clock-draft'));
  await d.advance(0);
  assert.equal(d.batch.getMusicNoteFolderSaveStatus(uid).state, 'failed');
  assert.equal(canonical.data.musicNoteFolders.myNote[1].title, 'newest-server');
  assert.ok(d.page.nextVersion(uid) >= 100_002, 'next human edit starts above observed server version');
  assert.ok(d.batch.getPendingMusicNoteFolderStructureBatch(uid), 'rejected draft is not deleted');
  console.log('APP514_P1_SLOW_CLOCK_LEARNS_CANONICAL_WATERMARK_WITHOUT_OVERWRITE=PASS');
}

// A newer RTDB transport revision wins despite a sender's lower device clock;
// duplicate/older delivery cannot overwrite it. No canonical IO on receiver.
{
  const d = device(bus());
  d.page.publish(uid, { musicNoteFolders: { myNote: folders('fast-clock') }, musicNoteStructureVersion: 900_000 }, 900_000);
  const payload = (title, version) => JSON.stringify({ __musicNoteStructureSync: true, data: {
    musicNoteFolders: { myNote: folders(title) }, musicNoteStructureVersion: version,
  } });
  d.page.receive(payload('slow-clock-newer', 10), 1000);
  d.page.receive(payload('stale', 9), 999);
  assert.equal(d.page.session().data.musicNoteFolders.myNote[1].title, 'slow-clock-newer');
  assert.equal(d.reads, 0); assert.equal(d.attempts, 0);
  console.log('APP514_RTDB_TRANSPORT_ORDER_INDEPENDENT_OF_DEVICE_CLOCK=PASS');
}

// A compact durable pending edit can survive while the larger display cache
// stays old: reopening must render the pending edit without a server read.
{
  const d = device(bus());
  d.records.set(`soridraw_music_note_structure_cache_v1_${uid}`, JSON.stringify({
    schemaVersion: 1, version: 1, verified: true, data: { musicNoteFolders: { myNote: folders('old') } },
  }));
  d.records.set(`soridraw.musicNote.folderStructureBatch.v1.${uid}`, JSON.stringify({
    updatedAtMs: 100_000, myNote: { version: 2, updatedAtMs: 100_000, folders: folders('pending-reload') },
  }));
  d.page.subscribe(uid, () => {});
  assert.equal(d.page.session().data.musicNoteFolders.myNote[1].title, 'pending-reload');
  assert.equal(d.reads, 0); assert.equal(d.attempts, 0);
  console.log('APP514_PENDING_RELOAD_OVER_STALE_VERIFIED_CACHE_R0_W0=PASS');
}

// Cold server read begun before a newer live edit may not roll that edit back.
{
  const d = device(bus(), { quota: true }); d.holdRead();
  d.page.subscribe(uid, () => {});
  await d.page.persist('myNote', folders('new-during-read'));
  d.readsHeld.shift()(); await tick();
  assert.equal(d.page.session().data.musicNoteFolders.myNote[1].title, 'new-during-read');
  console.log('APP514_STALE_HYDRATION_CANNOT_OVERWRITE_EDIT=PASS');
}

// Authenticated exact-ID+UID diagnostic: existing/missing/removed/failed server
// result and three disagreeing browser caches remain read-only.
for (const serverState of ['exists', 'missing', 'removed', 'denied']) {
  for (const localState of ['pc-original', 'mobile-heart-only', 'other-pc']) {
    const local = new Map([['soridraw_recent_heart_authority_v1_fixture-owner', JSON.stringify([
      { favoriteId: 'exact-document', saved: localState !== 'other-pc', version: 1 },
    ])]]);
    const original = JSON.stringify([...local]); let reads = 0;
    const exports = {};
    const auth = { currentUser: { uid } };
    runInNewContext(transpile(read('src/lib/studioHeartSingleDocDiagnostic.ts')), {
      exports, localStorage: { getItem: key => local.get(key) || null },
      require: name => {
        if (name.endsWith('firebase')) return { auth, db: {} };
        if (name.endsWith('firestoreMeasured')) return {
          collection: (_db, path) => path, documentId: () => '__name__', where: (...a) => a,
          limit: n => n, query: (...parts) => parts,
        };
        if (name === 'firebase/firestore') return { getDocsFromServer: async parts => {
          assert.equal(JSON.stringify(parts), JSON.stringify(['favorites', ['__name__', '==', 'exact-document'], ['uid', '==', uid], 1]));
          reads++;
          if (serverState === 'denied') throw new Error('permission denied');
          const exists = serverState !== 'missing';
          return { size: exists ? 1 : 0, docs: exists ? [{ data: () => ({ uid, favoriteRemoved: serverState === 'removed' }) }] : [] };
        } };
        if (name.endsWith('cacheDiagnostics')) return { markFirestoreActualRead: () => {} };
        if (name.endsWith('useFavoritesStore')) return { favoritesStore: { getFavorites: () => localState === 'pc-original'
          ? [{ id: 'exact-document', __studioHeartRemotePreviewLocal: true }] : [] } };
        if (name.endsWith('studioHeartBatch')) return { readStudioHeartPendingIntent: () => null };
        if (name.endsWith('userDataEngine')) return { readCatalogSnapshotFromLocalCache: async () => ({ items: [] }) };
        if (name.endsWith('musicNoteSavedState')) return { isMusicNoteItemRemoved: x => x.favoriteRemoved === true };
        throw new Error('unexpected dependency / mutation ' + name);
      },
    });
    assert.equal(reads, 0);
    if (serverState === 'denied') await assert.rejects(exports.inspectExactStudioHeartDocument(uid, 'exact-document'));
    else {
      const report = await exports.inspectExactStudioHeartDocument(uid, 'exact-document');
      assert.equal(report.documentPresent, serverState !== 'missing');
      assert.equal(report.serverActive, serverState === 'missing' ? null : serverState !== 'removed');
      assert.equal(report.deviceMusicNoteRow, localState === 'pc-original');
      assert.equal(report.deviceRecentHeartAuthority, localState !== 'other-pc');
    }
    assert.equal(reads, 1); assert.equal(JSON.stringify([...local]), original);
  }
}
console.log('APP514_EXACT_FAVORITE_EXISTS_MISSING_REMOVED_DENIED_THREE_DEVICES_READ_ONLY=PASS');

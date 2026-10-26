import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync('src/services/musicNoteFolderStructureBatch.ts', 'utf8');
const page = readFileSync('src/pages/FavoritesPage.tsx', 'utf8');
assert.match(page, /MUSIC_NOTE_FOLDER_QUOTA_RISK_EVENT/);
assert.match(page, /기기 저장공간 부족: 폴더 변경을 서버에 즉시 저장 중입니다/);
assert.match(page, /showFavoriteToast\('[^']+', 10000\)/);
assert.match(source, /const MUSIC_NOTE_FOLDER_BATCH_MS = 60_000/);
assert.match(source, /schedule\(key, durable \? MUSIC_NOTE_FOLDER_BATCH_MS : 0\)/);

const records = new Map();
const timers = [];
const fired = [];
const canonical = [];
let quota = false;
let silentReject = false;
let failServer = false;
const key = 'soridraw.musicNote.folderStructureBatch.v1.user-a';
const storage = {
  getItem: (k) => records.get(k) ?? null,
  setItem: (k, v) => {
    if (quota) throw Object.assign(new Error('quota full'), { name: 'QuotaExceededError' });
    if (!silentReject) records.set(k, v);
  },
  removeItem: (k) => records.delete(k),
};
const mockedWindow = {
  setTimeout: (fn, ms) => {
    const task = { fn, ms, active: true };
    timers.push(task);
    return timers.length;
  },
  clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].active = false; },
  dispatchEvent: (ev) => { fired.push(ev); return true; },
};
const mockRequire = (id) => {
  if (id.endsWith('firestoreMeasured')) return {
    doc: (_db, collection, uid) => ({ collection, uid }),
    setDoc: async (ref, value) => {
      if (failServer) throw new Error('offline');
      canonical.push({ ref, value: JSON.parse(JSON.stringify(value)) });
    },
  };
  if (id.endsWith('firebase')) return { db: {} };
  if (id.endsWith('v1MutationBoundary')) return { runV1MutationBoundary: (_operation, promise) => promise };
  throw new Error('unapproved dependency ' + id);
};
const exportsObj = {};
const context = {
  exports: exportsObj,
  require: mockRequire,
  localStorage: storage,
  window: mockedWindow,
  CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
  Map, Date, console: { warn: () => {} },
};
runInNewContext(ts.transpileModule(source, {
  fileName: 'musicNoteFolderStructureBatch.ts',
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, context);
const api = exportsObj;
const lastActive = () => [...timers].reverse().find((x) => x.active);
const runNext = async () => {
  const task = lastActive();
  assert.ok(task, 'a pending timer must exist');
  task.active = false;
  task.fn();
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
};
const folder = (title) => [{ id: 'folder-a', title }];

api.queueMusicNoteFolderStructureBatch('user-a', 'myNote', folder('healthy'), 1);
assert.equal(lastActive().ms, 60_000, 'healthy write must preserve 60s batch');
assert.equal(fired.length, 0);
assert.ok(records.get(key)?.includes('healthy'));
assert.equal(canonical.length, 0, 'healthy queue must not issue immediate canonical write');
console.log('APP506_HEALTHY_60SEC_NO_EXTRA_WRITE=PASS');

quota = true;
const old = records.get(key);
api.queueMusicNoteFolderStructureBatch('user-a', 'myNote', folder('quota-newer'), 2);
assert.equal(lastActive().ms, 0, 'quota fallbacks are urgent, not a 60s wait');
assert.equal(fired.length, 1, 'quota warning only on undurable pending');
assert.equal(fired[0].detail.uid, 'user-a');
assert.equal(api.getPendingMusicNoteFolderStructureBatch('user-a').myNote.folders[0].title, 'quota-newer');
assert.equal(records.get(key), old, 'failed local persist must not overwrite older durable pending');
await runNext();
assert.equal(canonical.at(-1).value.musicNoteStructureVersion, 2);
assert.equal(canonical.at(-1).value.musicNoteFolders.myNote[0].title, 'quota-newer');
assert.equal(api.getPendingMusicNoteFolderStructureBatch('user-a'), null);
assert.equal(records.has(key), false, 'commit must retire older persisted pending');
console.log('APP506_QUOTA_IMMEDIATE_CANONICAL_NO_OLD_STALE_PENDING=PASS');

quota = false;
silentReject = true;
api.queueMusicNoteFolderStructureBatch('user-a', 'myNote', folder('silent-refusal'), 3);
assert.equal(lastActive().ms, 0, 'silent storage refusal must also fail readback');
assert.equal(fired.length, 2);
await runNext();
assert.equal(canonical.at(-1).value.musicNoteStructureVersion, 3);
console.log('APP506_LOCAL_READBACK_VERIFIED=PASS');

silentReject = false;
quota = true;
failServer = true;
api.queueMusicNoteFolderStructureBatch('user-a', 'sharedNote', folder('offline-survivor'), 4);
assert.equal(lastActive().ms, 0);
await runNext();
assert.equal(api.getPendingMusicNoteFolderStructureBatch('user-a').sharedNote.folders[0].title, 'offline-survivor');
assert.equal(lastActive().ms, 60_000, 'offline error must not enter an unbounded zero-delay retry');
failServer = false;
await runNext();
assert.equal(canonical.at(-1).value.musicNoteStructureVersion, 4);
assert.equal(api.getPendingMusicNoteFolderStructureBatch('user-a'), null);
console.log('APP506_OFFLINE_MEMORY_RETRY_BOUNDED_UNTIL_SERVER_ACK=PASS');

// Offline + both browser storage and network blocked remains unable to
// guarantee survival of full tab termination; never overclaim durability.
assert.equal(page.includes("window.addEventListener(MUSIC_NOTE_FOLDER_QUOTA_RISK_EVENT"), true);
console.log('APP506_NO_CACHE_PURGE_USER_WARNING=PASS');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync('src/services/musicNoteFolderStructureBatch.ts', 'utf8');
const page = readFileSync('src/pages/FavoritesPage.tsx', 'utf8');
assert.match(page, /MUSIC_NOTE_FOLDER_SAVE_STATUS_EVENT/);
assert.match(page, /폴더 변경의 서버 저장을 확인했습니다/);
assert.match(page, /폴더 변경의 서버 저장에 실패했습니다/);
assert.match(source, /const MUSIC_NOTE_FOLDER_BATCH_MS = 60_000/);
assert.match(source, /schedule\(key, durable \? MUSIC_NOTE_FOLDER_BATCH_MS : emergencyDelay510\(key\)\)/);
assert.match(source, /MUSIC_NOTE_QUOTA_EMERGENCY_COOLDOWN_MS = 5_000/);

const records = new Map();
const timers = [];
const fired = [];
const canonical = [];
let quota = false;
let silentReject = false;
let failServer = false;
let holdServer = false;
const heldServerResolutions = [];
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
  dispatchEvent: (ev) => { if (ev.type.includes('quota-risk')) fired.push(ev); return true; },
};
const mockRequire = (id) => {
  if (id.endsWith('firestoreMeasured')) return {
    doc: (_db, ...parts) => parts.join('/'),
    setDoc: () => { throw new Error('unguarded canonical structure write'); },
    runTransaction: async (_db, update) => {
      if (failServer) throw new Error('offline');
      if (holdServer) await new Promise(resolve => heldServerResolutions.push(resolve));
      const staged = [];
      const transaction = {
        get: async path => ({
          // app515 tests the isolated V2 path rather than the parent. Only
          // the first V2 write needs a legacy bootstrap read.
          exists: () => path.endsWith('/folder_state/v2') && canonical.length > 0,
          data: () => canonical.at(-1)?.value || {},
        }),
        set: (ref, value, options) => {
          assert.equal(options?.merge, true);
          staged.push({ ref, value: JSON.parse(JSON.stringify(value)) });
        },
      };
      await update(transaction);
      canonical.push(...staged);
    },
  };
  if (id.endsWith('userDomainSyncService')) return { publishMusicNoteStructureDelta: async () => 0 };
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
assert.ok(lastActive().ms <= 5_000, 'silent refusal uses the bounded quota cooldown');
assert.equal(fired.length, 2);
await runNext();
assert.equal(canonical.at(-1).value.musicNoteStructureVersion, 3);
console.log('APP506_LOCAL_READBACK_VERIFIED=PASS');

silentReject = false;
quota = true;
failServer = true;
api.queueMusicNoteFolderStructureBatch('user-a', 'sharedNote', folder('offline-survivor'), 4);
assert.ok(lastActive().ms <= 5_000);
await runNext();
assert.equal(api.getPendingMusicNoteFolderStructureBatch('user-a').sharedNote.folders[0].title, 'offline-survivor');
assert.equal(lastActive().ms, 60_000, 'offline error must not enter an unbounded zero-delay retry');
failServer = false;
await runNext();
assert.equal(canonical.at(-1).value.musicNoteStructureVersion, 4);
assert.equal(api.getPendingMusicNoteFolderStructureBatch('user-a'), null);
console.log('APP506_OFFLINE_MEMORY_RETRY_BOUNDED_UNTIL_SERVER_ACK=PASS');

// One old in-flight canonical response must not clear a newer same-UID edit.
// A second quota-failed click is kept in memory while the prior request awaits.
holdServer = true;
api.queueMusicNoteFolderStructureBatch('user-a', 'myNote', folder('slow-v5'), 5);
await runNext();
assert.equal(heldServerResolutions.length, 1);
api.queueMusicNoteFolderStructureBatch('user-a', 'myNote', folder('latest-v6'), 6);
assert.equal(api.getPendingMusicNoteFolderStructureBatch('user-a').myNote.version, 6);
await runNext(); // Existing in-flight request must be reused, no concurrent write.
assert.equal(heldServerResolutions.length, 1);
holdServer = false;
heldServerResolutions.shift()();
await new Promise(resolve => setImmediate(resolve));
await new Promise(resolve => setImmediate(resolve));
assert.equal(api.getPendingMusicNoteFolderStructureBatch('user-a').myNote.version, 6,
  'old ACK must not clear a newer edit');
assert.ok(lastActive().ms <= 5_000, 'newest edit stays scheduled after old ACK');
await runNext();
assert.equal(canonical.at(-1).value.musicNoteStructureVersion, 6);
assert.equal(canonical.at(-1).value.musicNoteFolders.myNote[0].title, 'latest-v6');
assert.equal(api.getPendingMusicNoteFolderStructureBatch('user-a'), null);
console.log('APP506_OLD_INFLIGHT_ACK_CANNOT_ERASE_LATEST_QUOTA_EDIT=PASS');

// Offline + both browser storage and network blocked remains unable to
// guarantee survival of full tab termination; never overclaim durability.
assert.equal(page.includes("window.addEventListener(MUSIC_NOTE_FOLDER_SAVE_STATUS_EVENT"), true);
console.log('APP506_NO_CACHE_PURGE_USER_WARNING=PASS');

// app510 positive regression: persistent quota across five edits no longer
// forces five canonical writes. First urgent write remains; subsequent clicks
// within the cooldown collapse to one latest per-UID final state.
const writesBeforeBurst510 = canonical.length;
api.queueMusicNoteFolderStructureBatch('user-a', 'myNote', folder('burst-7'), 7);
assert.ok(lastActive().ms <= 5_000);
await runNext();
for (let revision510 = 8; revision510 <= 11; revision510 += 1) {
  api.queueMusicNoteFolderStructureBatch(
    'user-a', 'myNote', folder('burst-' + revision510), revision510,
  );
  assert.ok(lastActive().ms > 0 && lastActive().ms <= 5_000,
    'quota burst after ACK must be postponed within the five-second ceiling');
}
assert.equal(canonical.length - writesBeforeBurst510, 1,
  'no repeated canonical writes until the short cooldown is flushed');
await runNext();
assert.equal(canonical.length - writesBeforeBurst510, 2);
assert.equal(canonical.at(-1).value.musicNoteStructureVersion, 11);
assert.equal(canonical.at(-1).value.musicNoteFolders.myNote[0].title, 'burst-11');
assert.equal(api.getPendingMusicNoteFolderStructureBatch('user-a'), null);
console.log('APP510_QUOTA_FIVE_EDITS_COALESCED_W2=PASS');

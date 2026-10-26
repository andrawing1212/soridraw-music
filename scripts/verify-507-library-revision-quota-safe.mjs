import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync('src/services/libraryPlaylistRevisionBatch.ts', 'utf8');
assert.match(source, /const LIBRARY_PLAYLIST_REVISION_BATCH_MS = 60_000/);
assert.match(source, /durable \? LIBRARY_PLAYLIST_REVISION_BATCH_MS : 0/);

const compiled = ts.transpileModule(source, {
  fileName: 'libraryPlaylistRevisionBatch.ts',
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const setup = (sharedServer509 = null) => {
  const local = new Map();
  const timers = [];
  const updates = [];
  const standaloneServer510 = { version: 0, writes: [] };
  const waiters = [];
  const state = { quota: false, silent: false, offline: false, firestoreFails: false, hold: false, reads: 0, transactionReads: 0, remoteVersion: 0 };
  const store = {
    getItem: (key) => local.get(key) ?? null,
    setItem: (key, value) => {
      if (state.quota) throw Object.assign(new Error('quota exceeded'), { name: 'QuotaExceededError' });
      if (!state.silent) local.set(key, value);
    },
    removeItem: (key) => { local.delete(key); },
  };
  const browser = {
    setTimeout: (fn, ms) => { const task = { fn, ms, active: true }; timers.push(task); return timers.length; },
    clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].active = false; },
  };
  const exports = {};
  const requireMock = (id) => {
    if (id === 'firebase/database') return {
      get: async () => {
        state.reads++;
        if (state.offline) throw new Error('offline');
        return { val: () => ({ syncVersion: state.remoteVersion }) };
      },
      ref: (_db, path) => path,
    };
    if (id.endsWith('/firestoreMeasured')) return {
      doc: (_db, collection, uid) => ({ collection, uid }),
      // Firestore transaction mock: transaction reads a server snapshot,
      // submits conditionally, then retries if another context changed it.
      runTransaction: async (_db, mutate) => {
        if (state.firestoreFails) throw new Error('server rejected');
        const backend = sharedServer509 || standaloneServer510;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const observed = backend.version;
          let write = null;
          const tx = {
            get: async () => {
              state.transactionReads += 1;
              return { exists: () => true, data: () => ({ syncVersions: { playlists: observed } }) };
            },
            update: (document, payload) => { write = { document, payload }; },
          };
          const result = await mutate(tx);
          if (state.hold) await new Promise((resolve) => waiters.push(resolve));
          if (backend.version !== observed) continue; // optimistic conflict retry
          if (write) {
            const next = write.payload['syncVersions.playlists'];
            backend.version = next;
            backend.writes.push(next);
            updates.push(write);
          }
          return result;
        }
        throw new Error('ABORTED transaction conflict retry budget');
      },
    };
    if (id.endsWith('/firebase')) return { db: {}, realtimeDb: {} };
    if (id.endsWith('/userProfileCache')) return { readUserProfileCache: () => ({ syncVersions: { playlists: 0 } }) };
    throw new Error('unexpected dependency ' + id);
  };
  runInNewContext(compiled, { exports, require: requireMock, localStorage: store, window: browser, console: { warn: () => {} }, Map, Set, Date });
  const key = 'soridraw.library.playlistRevisionBatch.v1.user-a';
  const activeTimer = () => [...timers].reverse().find(t => t.active);
  const pulse = async () => {
    const t = activeTimer();
    assert.ok(t, 'active timer must be scheduled');
    t.active = false;
    t.fn();
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
  };
  const settle = () => { while (waiters.length) waiters.shift()(); };
  return { api: exports, local, state, updates, waiters, key, activeTimer, pulse, settle };
};

// Existing +60s batching and no eager IO on normal queue must remain.
{
  const x = setup();
  x.api.queueLibraryPlaylistRevisionBatch('user-a', 11);
  assert.equal(x.activeTimer().ms, 60_000);
  assert.equal(x.updates.length, 0);
  assert.equal(x.state.reads, 0);
  assert.equal(x.api.getPendingLibraryPlaylistRevisionBatch('user-a').latestVersion, 11);
  await x.pulse();
  assert.equal(x.updates.length, 1);
  assert.equal(x.state.transactionReads, 1, 'only the 60s settlement performs R1 transaction read');
  assert.equal(x.updates[0].payload['syncVersions.playlists'], 11);
  assert.equal(x.api.getPendingLibraryPlaylistRevisionBatch('user-a'), null);
  console.log('APP507_LIBRARY_HEALTHY_60SEC_NO_EXTRA_IO=PASS');
}

// Quota may not silently strand the compatibility revision for a full minute.
{
  const x = setup();
  x.api.queueLibraryPlaylistRevisionBatch('user-a', 11);
  const previous = x.local.get(x.key);
  x.state.quota = true;
  x.api.queueLibraryPlaylistRevisionBatch('user-a', 12);
  assert.equal(x.local.get(x.key), previous, 'previous durable pending must be untouched');
  assert.equal(x.activeTimer().ms, 0, 'quota has to settle urgently');
  await x.pulse();
  assert.equal(x.updates.length, 1);
  assert.equal(x.updates[0].payload['syncVersions.playlists'], 12);
  assert.equal(x.local.has(x.key), false, 'old persisted marker cleared after server ACK');
  console.log('APP507_LIBRARY_QUOTA_URGENT_MONOTONIC_SETTLEMENT=PASS');
}

// A browser that silently refuses storage writes must fail readback, too.
{
  const x = setup();
  x.state.silent = true;
  x.api.queueLibraryPlaylistRevisionBatch('user-a', 20);
  assert.equal(x.activeTimer().ms, 0);
  await x.pulse();
  assert.equal(x.updates[0].payload['syncVersions.playlists'], 20);
  console.log('APP507_LIBRARY_SILENT_WRITE_FAILURE_READBACK=PASS');
}

// RTDB is offline: avoid false compatibility progress and infinite polling.
{
  const x = setup();
  x.state.quota = true;
  x.state.offline = true;
  x.api.queueLibraryPlaylistRevisionBatch('user-a', 25);
  await x.pulse();
  assert.equal(x.updates.length, 0);
  assert.equal(x.api.getPendingLibraryPlaylistRevisionBatch('user-a').latestVersion, 25);
  assert.equal(x.activeTimer().ms, 60_000, 'one bounded recovery retry');
  await x.pulse();
  assert.equal(x.state.reads, 2);
  assert.equal(x.activeTimer(), undefined, 'must not poll endlessly on offline');
  x.state.offline = false;
  x.api.resumeLibraryPlaylistRevisionBatch('user-a');
  assert.equal(x.activeTimer().ms <= 60_000, true);
  await x.pulse();
  assert.equal(x.updates.at(-1).payload['syncVersions.playlists'], 25);
  console.log('APP507_LIBRARY_OFFLINE_BOUNDED_RETRY_AND_RESUME=PASS');
}

// A late ACK for version A cannot clear a newer quota-failed version B.
{
  const x = setup();
  x.state.hold = true;
  x.api.queueLibraryPlaylistRevisionBatch('user-a', 30);
  const p = x.api.flushLibraryPlaylistRevisionBatch('user-a');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(x.waiters.length, 1);
  x.state.quota = true;
  x.api.queueLibraryPlaylistRevisionBatch('user-a', 31);
  assert.equal(x.activeTimer().ms, 0);
  x.state.hold = false;
  x.settle();
  await p;
  assert.equal(x.api.getPendingLibraryPlaylistRevisionBatch('user-a').latestVersion, 31);
  await x.pulse();
  assert.deepEqual(x.updates.map(v=>v.payload['syncVersions.playlists']), [30, 31]);
  assert.equal(x.api.getPendingLibraryPlaylistRevisionBatch('user-a'), null);
  console.log('APP507_LIBRARY_OLD_ACK_CANNOT_DROP_NEW_QUOTA_VERSION=PASS');
}

// Account restarts cannot magically recover an unsaved memory-only marker.
// Underlying Library playlist originals are separately canonical and are not
// changed, overwritten or deleted by this service.
{
  const x = setup();
  x.state.quota = true;
  x.state.offline = true;
  x.api.queueLibraryPlaylistRevisionBatch('user-a', 41);
  assert.equal(x.local.has(x.key), false);
  assert.equal(x.updates.length, 0);
  console.log('APP507_LIBRARY_DOUBLE_FAILURE_CRASH_DURABILITY_REMAINS_UNVERIFIED=PASS');
}

// app510: simultaneous modern browser sessions with the same UID cannot
// downgrade the stored compatibility version. A transaction whose read
// becomes stale is re-run against the latest server revision.
{
  const sharedServer510 = { version: 0, writes: [] };
  const oldSession510 = setup(sharedServer510);
  const newSession510 = setup(sharedServer510);
  oldSession510.state.hold = true;
  oldSession510.api.queueLibraryPlaylistRevisionBatch('user-a', 50);
  const oldPromise510 = oldSession510.api.flushLibraryPlaylistRevisionBatch('user-a');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(oldSession510.waiters.length, 1);
  newSession510.state.remoteVersion = 51;
  newSession510.api.queueLibraryPlaylistRevisionBatch('user-a', 51);
  await newSession510.pulse();
  assert.equal(sharedServer510.version, 51);
  oldSession510.state.hold = false;
  oldSession510.settle();
  await oldPromise510;
  assert.deepEqual(sharedServer510.writes, [51],
    'an older transaction must retry and skip write after newer commit');
  assert.equal(sharedServer510.version, 51);
  assert.ok(oldSession510.state.transactionReads >= 2, 'transaction conflict is retried');
  console.log('APP510_CROSS_SESSION_NEW_CLIENT_MONOTONIC_REVISION=PASS');
}
// New code can prevent downgrades by other transactional clients, but an
// obsolete cached app with unconditional updateDoc may still overwrite it.
// No unverified claim that this changes the behavior of already-open tabs.
console.log('APP510_LEGACY_ABSOLUTE_WRITER_MIGRATION_RISK_DOCUMENTED=PASS');

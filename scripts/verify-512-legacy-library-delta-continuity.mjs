import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Execute the actual source function in isolation. No Firestore or RTDB
// requests are permitted; server writes/reads in this fixture must throw.
const src = readFileSync('src/services/playlistService.ts', 'utf8');
assert.match(src, /isLegacyRevisionRegression512/);
assert.match(src, /listSnapshot\.version !== signal\.previousSyncVersion/);
assert.match(src, /Math\.max\(signal\.syncVersion, listSnapshot\.version\)/);
const js = ts.transpileModule(src, {
  fileName: 'src/services/playlistService.ts',
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

const run = async ({ listVersion, itemVersion = listVersion, operation, previousSyncVersion,
  syncVersion, payload, initialTitle = 'before', initialItems = [], incomingVersion = 3 }) => {
  const lists = { version: listVersion, items: [
    { id: 'folder-a', title: initialTitle, type: 'normal', order: 1, itemsRevision: itemVersion },
  ] };
  const items = new Map([['folder-a', { version: itemVersion, items: initialItems }]]);
  let reads = 0;
  let writes = 0;
  const copy = x => JSON.parse(JSON.stringify(x));
  const forbidden = () => { reads++; throw new Error('unexpected canonical/network call'); };
  const exportsObj = {};
  const cache = {
    readLibraryPlaylistListCache: async () => copy(lists),
    writeLibraryPlaylistListCache: async (_uid, value, version) => {
      lists.items = copy(value);
      lists.version = version;
    },
    readLibraryPlaylistItemsCache: async (_uid, playlistId) => {
      const entry = items.get(playlistId);
      return entry ? copy(entry) : null;
    },
    writeLibraryPlaylistItemsCache: async (_uid, playlistId, value, version) => {
      items.set(playlistId, { version, items: copy(value) });
    },
    deleteLibraryPlaylistItemsCache: async (_uid, playlistId) => {
      items.delete(playlistId);
    },
    nextLibraryPlaylistSyncVersion: forbidden,
    patchLibraryPlaylistItemsCache: forbidden,
    patchLibraryPlaylistListCache: forbidden,
    writeLibraryPlaylistListCacheOnly: forbidden,
  };
  const requireMock = name => {
    if (name === '../firebase') return { db: {}, realtimeDb: {} };
    if (name === 'firebase/database') return { ref: forbidden, runTransaction: forbidden, onValue: forbidden };
    if (name === '../lib/firestoreMeasured') return {
      doc: forbidden, collection: forbidden, writeBatch: forbidden, serverTimestamp: forbidden,
      getDocs: forbidden, query: forbidden, where: forbidden, orderBy: forbidden, limit: forbidden,
    };
    if (name === '../lib/userProfileCache') return { readUserProfileCache: () => ({}) };
    if (name === '../lib/libraryPlaylistCache') return cache;
    if (name === './libraryPlaylistRevisionBatch') return {
      noteLibraryPlaylistRevisionSignal: () => {},
      markLibraryPlaylistRevisionCommitted: () => {},
      queueLibraryPlaylistRevisionBatch: () => {},
    };
    if (name === './v1UserDataReadAdapter') return { v1UserDataReadAdapter: {} };
    throw new Error('unexpected dependency: ' + name);
  };
  const localStorage = {
    getItem: k => k === 'soridraw_library_playlist_sync_device_v1' ? 'new-device' : null,
    setItem: () => { writes++; throw new Error('unexpected localStorage write'); },
    removeItem: () => { writes++; throw new Error('unexpected localStorage removal'); },
  };
  runInNewContext(js, {
    exports: exportsObj, require: requireMock, window: { localStorage }, localStorage,
    Map, Set, Date, Number, JSON, console: { warn: () => {}, error: () => {} },
  });
  const signal = {
    version: incomingVersion, at: 100, originDeviceId: 'legacy-device',
    operation, previousSyncVersion, syncVersion,
    payloadJson: JSON.stringify(payload), truncated: false,
  };
  const applied = await exportsObj.applyLibraryPlaylistSyncSignalToCache('user-a', signal);
  assert.equal(reads, 0, 'no network or additional canonical DB reads');
  assert.equal(writes, 0, 'no localStorage writes or destructive cache operations');
  return { applied, lists, items };
};

const item = id => ({ id, title: id, order: 1 });
const legacyRename = { operation: 'playlist-rename', previousSyncVersion: 51,
  syncVersion: 50, payload: { playlistId: 'folder-a', title: 'legacy-new-title' } };

// Actual legacy RTDB transaction can record previous sync 51 followed by
// sync 50. A contiguous receiving device must apply the latest user edit.
{
  const x = await run({ listVersion: 51, ...legacyRename });
  assert.equal(x.applied, true);
  assert.equal(x.lists.items[0].title, 'legacy-new-title');
  assert.equal(x.lists.version, 51, 'never lower cache watermark to legacy value');
  console.log('APP512_CONTIGUOUS_LEGACY_RENAME_DELTA_APPLIED_WITHOUT_REVISION_DECREASE=PASS');
}

// Preserve original app293 continuity fence: a missed older delta cannot be
// replayed on top of an incomplete local state.
{
  const x = await run({ listVersion: 49, ...legacyRename });
  assert.equal(x.applied, false);
  assert.equal(x.lists.items[0].title, 'before');
  console.log('APP512_LEGACY_GAP_FAILS_CLOSED_NO_PARTIAL_REPLAY=PASS');
}

// Newer local cache must not be overwritten by a remote stale patch.
{
  const x = await run({ listVersion: 52, ...legacyRename, initialTitle: 'newer-local' });
  assert.equal(x.applied, false);
  assert.equal(x.lists.items[0].title, 'newer-local');
  console.log('APP512_NEWER_LOCAL_CACHE_PROTECTED=PASS');
}

// A normal increasing delta still works, including version advancement.
{
  const x = await run({ listVersion: 51, operation: 'playlist-rename',
    previousSyncVersion: 51, syncVersion: 52, payload: { playlistId: 'folder-a', title: 'normal-newer' } });
  assert.equal(x.applied, true);
  assert.equal(x.lists.items[0].title, 'normal-newer');
  assert.equal(x.lists.version, 52);
  console.log('APP512_NORMAL_DELTA_AND_REVISION_ADVANCEMENT_UNCHANGED=PASS');
}

// The legacy payload can also describe a canonical item deletion.
{
  const x = await run({ listVersion: 51, itemVersion: 51,
    operation: 'item-delete', previousSyncVersion: 51, syncVersion: 50,
    payload: { playlistId: 'folder-a', itemId: 'item-1' },
    initialItems: [item('item-1'), item('item-2')] });
  assert.equal(x.applied, true);
  assert.deepEqual(x.items.get('folder-a').items.map(v => v.id), ['item-2']);
  assert.equal(x.items.get('folder-a').version, 51);
  assert.equal(x.lists.version, 51);
  console.log('APP512_CONTIGUOUS_LEGACY_ITEM_DELETE_APPLIED_NO_FULL_QUERY=PASS');
}

// A legacy item add is applied to the warm item cache without replaying
// an entire Firestore playlist scan and without downgrading list/item clocks.
{
  const x = await run({ listVersion: 51, itemVersion: 51,
    operation: 'item-add', previousSyncVersion: 51, syncVersion: 50,
    payload: { playlistId: 'folder-a', item: item('item-2') },
    initialItems: [item('item-1')] });
  assert.equal(x.applied, true);
  assert.deepEqual(x.items.get('folder-a').items.map(v => v.id), ['item-1', 'item-2']);
  assert.equal(x.lists.version, 51);
  assert.equal(x.items.get('folder-a').version, 51);
  console.log('APP512_CONTIGUOUS_LEGACY_ITEM_ADD_APPLIED_NO_FULL_QUERY=PASS');
}

console.log('APP512_LEGACY_DELTA_EXECUTABLE_REGRESSION_SUITE=PASS');

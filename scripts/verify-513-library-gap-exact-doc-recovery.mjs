import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync('src/services/playlistService.ts', 'utf8');
const page = readFileSync('src/pages/SunoLibraryPage.tsx', 'utf8');
assert.match(page, /if \(applied\) \{/);
assert.match(page, /recoverLibraryPlaylistGapExactDocument513\(uid, signal\)/);
assert.match(source, /getDocFromServer\(reference\)/);
assert.match(source, /exactGapRecoverySeenPrefix513/);
assert.ok(!source.includes('getDocs(itemsRef); // app513'), 'no full query added');
const compiled = ts.transpileModule(source, {
  fileName: 'playlistService.ts',
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
let counter = 0;
const setup = ({ canonical = null, beforeItems = [], hasItemCache = true,
  failure = false, afterRead = null } = {}) => {
  const copies = x => JSON.parse(JSON.stringify(x));
  const lists = { version: 49, items: [{ id: 'folder-a', title: 'before', order: 1, type: 'normal' }] };
  const cachedItems = new Map();
  if (hasItemCache) cachedItems.set('folder-a', { version: 49, items: beforeItems });
  const local = new Map([['soridraw_library_playlist_sync_device_v1','receiver']]);
  const docs = new Map();
  if (canonical) docs.set(canonical.path, canonical.data);
  const stats = { exact: 0, query: 0, serverWrite: 0, localWrites: 0 };
  let reject = failure;
  const cache = {
    readLibraryPlaylistListCache: async () => copies(lists),
    readLibraryPlaylistItemsCache: async (_uid, id) =>
      cachedItems.has(id) ? copies(cachedItems.get(id)) : null,
    patchLibraryPlaylistItemsCache: async (_uid, id, updater, version) => {
      const prev = cachedItems.get(id);
      if (!prev) return null;
      const next = updater(copies(prev.items));
      cachedItems.set(id, { version: version ?? prev.version, items: copies(next) });
      return next;
    },
    patchLibraryPlaylistListCache: async (_uid, updater, version) => {
      const next = updater(copies(lists.items));
      lists.items = copies(next);
      lists.version = version ?? lists.version;
      return next;
    },
    deleteLibraryPlaylistItemsCache: async (_uid, id) => { cachedItems.delete(id); },
  };
  const forbids = () => { stats.query++; throw new Error('unapproved full query or write'); };
  const exports = {};
  const requireMock = name => {
    if (name === '../firebase') return { db: {}, realtimeDb: {} };
    if (name === 'firebase/database') return { ref: forbids, onValue: forbids, runTransaction: forbids };
    if (name === '../lib/firestoreMeasured') return {
      doc: (_db, ...segments) => segments.join('/'),
      getDocFromServer: async path => {
        stats.exact++;
        if (reject) throw new Error('offline');
        if (afterRead) await afterRead(cachedItems, lists);
        const data = docs.get(path);
        return { exists: () => data !== undefined, data: () => copies(data) };
      },
      getDocs: forbids, collection: forbids, query: forbids, where: forbids, orderBy: forbids,
      limit: forbids, writeBatch: forbids, serverTimestamp: forbids,
    };
    if (name === '../lib/userProfileCache') return { readUserProfileCache: () => ({}) };
    if (name === '../lib/libraryPlaylistCache') return cache;
    if (name === './libraryPlaylistRevisionBatch') return {
      noteLibraryPlaylistRevisionSignal: () => {},
      markLibraryPlaylistRevisionCommitted: () => {},
      queueLibraryPlaylistRevisionBatch: () => {},
    };
    if (name === './v1UserDataReadAdapter') return { v1UserDataReadAdapter: {} };
    throw new Error('unexpected dependency ' + name);
  };
  const storage = {
    getItem: key => local.get(key) ?? null,
    setItem: (key, value) => { stats.localWrites++; local.set(key, value); },
    removeItem: forbids,
  };
  runInNewContext(compiled, {
    exports, require: requireMock,
    localStorage: storage, window: { localStorage: storage },
    JSON, Map, Set, Date, Number, console: { warn: () => {} },
  });
  return {
    api: exports, lists, cachedItems, local, stats,
    recover: async (operation, payload, signalVersion = ++counter) => (
      exports.recoverLibraryPlaylistGapExactDocument513('user-a', {
        version: signalVersion, originDeviceId: 'other-device',
        operation, syncVersion: 50, previousSyncVersion: 51,
        payloadJson: JSON.stringify(payload), truncated: false,
      })
    ),
    setOffline: next => { reject = next; },
  };
};
const item = id => ({ id, title: id, order: 1 });

// Missed RTDB item-add: canonical commit already occurred before publish;
// a single exact document returns current truth, without full-list query.
{
  const x = setup({ canonical: {
    path: 'user_playlists/user-a/lists/folder-a/items/item-2',
    data: item('item-2'),
  }, beforeItems: [item('item-1')] });
  const packet = { playlistId: 'folder-a', item: item('item-2') };
  assert.equal(await x.recover('item-add', packet, 10001), true);
  assert.deepEqual(x.cachedItems.get('folder-a').items.map(x => x.id), ['item-1', 'item-2']);
  assert.equal(x.cachedItems.get('folder-a').version, 49);
  assert.equal(x.lists.version, 49, 'one recovered item is not full gap convergence');
  assert.equal(x.stats.exact, 1);
  assert.equal(await x.recover('item-add', packet, 10001), true);
  assert.equal(x.stats.exact, 1, 'same event on page revisit must not read again');
  assert.equal(x.stats.query, 0);
  console.log('APP513_GAP_ITEM_ADD_EXACT_R1_DEDUPED=PASS');
}
{
  const x = setup({ beforeItems: [item('item-1'), item('item-2')] });
  assert.equal(await x.recover('item-delete', { playlistId: 'folder-a', itemId: 'item-1' }), true);
  assert.deepEqual(x.cachedItems.get('folder-a').items.map(x => x.id), ['item-2']);
  assert.equal(x.stats.exact, 1);
  assert.equal(x.stats.query, 0);
  console.log('APP513_GAP_ITEM_DELETE_CONFIRMED_ABSENT_R1=PASS');
}
{
  const x = setup();
  assert.equal(await x.recover('playlist-delete', { playlistId: 'folder-a' }), true);
  assert.deepEqual(x.lists.items, []);
  assert.equal(x.stats.exact, 1);
  console.log('APP513_GAP_FOLDER_DELETE_CONFIRMED_ABSENT_R1=PASS');
}
{
  const x = setup({ beforeItems: [item('item-1')], hasItemCache: false });
  assert.equal(await x.recover('item-add', { playlistId: 'folder-a', item: item('item-2') }), false);
  assert.equal(await x.recover('playlist-rename', { playlistId: 'folder-a', title: 'pending' }), false);
  assert.equal(await x.recover('item-delete', { playlistId: '../wrong', itemId: 'item-1' }), false);
  assert.equal(x.stats.exact, 0);
  console.log('APP513_NO_FULL_SCAN_ON_COLD_GAP_OR_UNCOMMITTED_RENAME=PASS');
}
{
  const x = setup({ beforeItems: [item('item-1')] });
  x.setOffline(true);
  assert.equal(await x.recover('item-delete', { playlistId: 'folder-a', itemId: 'item-1' }, 10008), false);
  assert.deepEqual(x.cachedItems.get('folder-a').items.map(x=>x.id), ['item-1']);
  x.setOffline(false);
  assert.equal(await x.recover('item-delete', { playlistId: 'folder-a', itemId: 'item-1' }, 10008), true);
  assert.equal(x.stats.exact, 2, 'failed read does not falsely suppress retry');
  console.log('APP513_OFFLINE_FAILS_CLOSED_NO_FALSE_ACK=PASS');
}
{
  const x = setup({ beforeItems: [item('item-1')], afterRead: async cache => {
    cache.set('folder-a', { version: 50, items: [item('item-1'), item('item-3')] });
  } });
  assert.equal(await x.recover('item-delete', { playlistId: 'folder-a', itemId: 'item-1' }), false);
  assert.deepEqual(x.cachedItems.get('folder-a').items.map(x=>x.id), ['item-1', 'item-3']);
  console.log('APP513_NEWER_CACHE_WHILE_FETCH_INFLIGHT_NOT_OVERWRITTEN=PASS');
}
// P1 adversarial case: while an exact item-add read is in flight, a newer
// device deletes the parent folder locally without advancing a derived
// revision (possible under legacy version regressions). Do not recreate an
// orphan item cache or mark this RTDB event as successfully repaired.
{
  const x = setup({
    canonical: {
      path: 'user_playlists/user-a/lists/folder-a/items/item-2',
      data: item('item-2'),
    },
    beforeItems: [item('item-1')],
    afterRead: async (_cache, lists) => {
      lists.items = []; // concurrent canonical folder deletion, same version 49
    },
  });
  assert.equal(await x.recover('item-add', {
    playlistId: 'folder-a', item: item('item-2'),
  }, 10019), false);
  assert.deepEqual(x.lists.items, []);
  assert.deepEqual(x.cachedItems.get('folder-a').items.map(v => v.id), ['item-1']);
  assert.equal(x.stats.exact, 1);
  console.log('APP513_PARENT_FOLDER_DELETED_DURING_READ_NO_ORPHAN_REPAIR=PASS');
}
// Same numeric revision is not proof that the folder metadata is identical.
// Never replay item deletion on a renamed parent with a missing-version bug.
{
  const x = setup({
    beforeItems: [item('item-1')],
    afterRead: async (_cache, lists) => {
      lists.items[0].title = 'concurrent-rename';
    },
  });
  assert.equal(await x.recover('item-delete', {
    playlistId: 'folder-a', itemId: 'item-1',
  }, 10020), false);
  assert.deepEqual(x.cachedItems.get('folder-a').items.map(v => v.id), ['item-1']);
  console.log('APP513_SAME_VERSION_CHANGED_PARENT_FAILS_CLOSED=PASS');
}
console.log('APP513_EXACT_GAP_SOURCE_RUNTIME_GATE=PASS');

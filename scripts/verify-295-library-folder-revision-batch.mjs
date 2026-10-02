import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const service = read('src/services/playlistService.ts');
const batcher = read('src/services/libraryPlaylistRevisionBatch.ts');
const page = read('src/pages/SunoLibraryPage.tsx');
const version = JSON.parse(read('public/app-version.json'));

const block = (startNeedle, endNeedle) => {
  const start = service.indexOf(startNeedle);
  const end = service.indexOf(endNeedle, start);
  assert.ok(start >= 0 && end > start, `missing block: ${startNeedle}`);
  return service.slice(start, end);
};

const create = block('export const createPlaylist = async', 'export const renamePlaylist = async');
const rename = block('export const renamePlaylist = async', 'export const addPlaylistItem = async');
const addItem = block('export const addPlaylistItem = async', 'export const deletePlaylistItem = async');

assert.ok(Number(version.version) >= 295, 'app295 regression must remain enabled in later builds');

assert.ok(create.includes('queueLibraryPlaylistRevisionBatch(uid, syncVersion)'),
  'create must queue the UID compatibility revision batch');
assert.ok(!create.includes("batch.update(doc(db, 'users', uid), { 'syncVersions.playlists': syncVersion })"),
  'create must not write users.syncVersions.playlists immediately');
assert.ok(
  rename.includes('queueLibraryPlaylistRevisionBatch(uid, syncVersion)')
    || rename.includes('queueLibraryPlaylistRenameBatch(uid, playlistId, title, syncVersion)'),
  'rename must stay delayed/batched instead of writing users revision immediately',
);
assert.ok(!rename.includes("batch.update(doc(db, 'users', uid), { 'syncVersions.playlists': syncVersion })"),
  'rename must not write users.syncVersions.playlists immediately');

assert.ok(create.includes('writeLibraryPlaylistItemsCache(uid, newDocRef.id, [], syncVersion)'),
  'app294 new-folder empty-cache R0 path must remain protected');
assert.ok(!create.includes('getDocs('), 'create must stay Firestore-read free');

assert.ok(/const LIBRARY_PLAYLIST_REVISION_BATCH_MS = (?:30_000|60_000);/.test(batcher));
assert.ok(batcher.includes("soridraw.library.playlistRevisionBatch.v1"));
assert.ok(batcher.includes('const pendingMemory = new Map<string, PendingPlaylistRevision>()'));
assert.ok(batcher.includes('pendingMemory.set(safeUid, value)'),
  'batch must keep an in-memory fallback when localStorage is unavailable');
assert.ok(batcher.includes("updateDoc(doc(db, 'users', safeUid)"));
assert.ok(batcher.includes("'syncVersions.playlists': targetVersion"));
assert.ok(batcher.includes('latestSharedSignalVersionByUid'));
assert.ok(batcher.includes('noteLibraryPlaylistRevisionSignal'));
assert.ok(batcher.includes("get(ref(realtimeDb, `userSync/${uid}/libraryPlaylist`))"),
  'flush must fall back to the latest shared RTDB signal as a monotonic cross-device floor');
assert.ok(batcher.includes('if (sharedSignalVersion < pending.latestVersion)'),
  'normal active-session flushes should reuse the already observed RTDB signal without another read');
assert.ok(batcher.includes('latest.latestVersion <= targetVersion'),
  'newer queued work must survive an older in-flight flush');
assert.ok(batcher.includes('resumeLibraryPlaylistRevisionBatch'));

assert.ok(addItem.includes("batch.update(doc(db, 'users', uid), { 'syncVersions.playlists': syncVersion })"),
  'item mutation compatibility revision must remain immediate in app295');
assert.ok(addItem.includes('markLibraryPlaylistRevisionCommitted(uid, syncVersion)'),
  'an immediate newer item mutation must retire an older pending folder revision');

assert.ok(page.includes('resumeLibraryPlaylistRevisionBatch(uid)'));
assert.ok(page.includes('noteLibraryPlaylistRevisionSignal(uid, signal.syncVersion)'));
assert.ok(page.includes("['item-add', 'item-delete', 'item-move', 'item-color', 'item-swap', 'playlist-delete'].includes(signal.operation)"));
assert.ok(page.includes('markLibraryPlaylistRevisionCommitted(uid, remoteVersion)'));
assert.ok(page.includes("window.addEventListener('pagehide', flushOnPageHide)"));
assert.ok(page.includes('markLibraryPlaylistRevisionCommitted(user.uid, syncVersion)'),
  'playlist reorder immediate revision must cancel older pending folder batches');

console.log('APP295_LIBRARY_FOLDER_REVISION_BATCH=PASS');
console.log('APP295_LIBRARY_FOLDER_CREATE_RENAME_IMMEDIATE_W1=PASS');
console.log('APP295_LIBRARY_FOLDER_COMPAT_REVISION_UID_BATCHED_W1=PASS');
console.log('APP295_LIBRARY_APP294_NEW_FOLDER_R0_REGRESSION=PASS');

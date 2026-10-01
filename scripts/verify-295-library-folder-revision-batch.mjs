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

assert.equal(Number(version.version), 295);

for (const [name, body] of [['create', create], ['rename', rename]]) {
  assert.ok(body.includes('queueLibraryPlaylistRevisionBatch(uid, syncVersion)'), `${name} must queue the UID revision batch`);
  assert.ok(!body.includes("batch.update(doc(db, 'users', uid), { 'syncVersions.playlists': syncVersion })"),
    `${name} must not write users.syncVersions.playlists immediately`);
}

assert.ok(create.includes('writeLibraryPlaylistItemsCache(uid, newDocRef.id, [], syncVersion)'),
  'app294 new-folder empty-cache R0 path must remain protected');
assert.ok(!create.includes('getDocs('), 'create must stay Firestore-read free');

assert.ok(batcher.includes('const LIBRARY_PLAYLIST_REVISION_BATCH_MS = 30_000'));
assert.ok(batcher.includes("soridraw.library.playlistRevisionBatch.v1"));
assert.ok(batcher.includes("updateDoc(doc(db, 'users', safeUid)"));
assert.ok(batcher.includes("'syncVersions.playlists': targetVersion"));
assert.ok(batcher.includes("get(ref(realtimeDb, `userSync/${uid}/libraryPlaylist`))"),
  'flush must use latest shared RTDB signal as a monotonic cross-device floor');
assert.ok(batcher.includes('latest.latestVersion <= targetVersion'),
  'newer queued work must survive an older in-flight flush');
assert.ok(batcher.includes('resumeLibraryPlaylistRevisionBatch'));

assert.ok(addItem.includes("batch.update(doc(db, 'users', uid), { 'syncVersions.playlists': syncVersion })"),
  'item mutation compatibility revision must remain immediate in app295');
assert.ok(addItem.includes('markLibraryPlaylistRevisionCommitted(uid, syncVersion)'),
  'an immediate newer item mutation must retire an older pending folder revision');

assert.ok(page.includes('resumeLibraryPlaylistRevisionBatch(uid)'));
assert.ok(page.includes("document.addEventListener('visibilitychange', flushWhenHidden)"));
assert.ok(page.includes("window.addEventListener('pagehide', flushOnPageHide)"));
assert.ok(page.includes('markLibraryPlaylistRevisionCommitted(user.uid, syncVersion)'),
  'playlist reorder immediate revision must cancel older pending folder batches');

console.log('APP295_LIBRARY_FOLDER_REVISION_BATCH=PASS');
console.log('APP295_LIBRARY_FOLDER_CREATE_RENAME_IMMEDIATE_W1=PASS');
console.log('APP295_LIBRARY_FOLDER_COMPAT_REVISION_UID_30S_W1=PASS');
console.log('APP295_LIBRARY_APP294_NEW_FOLDER_R0_REGRESSION=PASS');

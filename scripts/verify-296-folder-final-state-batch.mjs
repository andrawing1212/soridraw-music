import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const favorites = read('src/pages/FavoritesPage.tsx');
const musicBatch = read('src/services/musicNoteFolderStructureBatch.ts');
const sync = read('src/services/userDomainSyncService.ts');
const libraryBatch = read('src/services/libraryPlaylistRevisionBatch.ts');
const libraryPage = read('src/pages/SunoLibraryPage.tsx');
const playlistService = read('src/services/playlistService.ts');
const version = JSON.parse(read('public/app-version.json'));

assert.equal(Number(version.version), 296);

// Music Note My/Shared folder metadata: immediate local/RTDB, delayed canonical.
assert.ok(musicBatch.includes('const MUSIC_NOTE_FOLDER_BATCH_MS = 60_000'));
assert.ok(musicBatch.includes("soridraw.musicNote.folderStructureBatch.v1"));
assert.ok(musicBatch.includes("setDoc(doc(db, 'user_structures', key), structurePatch, { merge: true })"));
assert.ok(musicBatch.includes("operation: 'structure-update'"));
assert.ok(musicBatch.includes('memoryPending = new Map'));
assert.ok(musicBatch.includes('localStorage.setItem'));
assert.ok(musicBatch.includes('latest.myNote.version <= capturedMy.version'));
assert.ok(musicBatch.includes('latest.sharedNote.version <= capturedShared.version'));

const persistStart = favorites.indexOf('const persistMusicNoteFolders = async');
const persistEnd = favorites.indexOf('const openMusicNoteFolderPicker', persistStart);
assert.ok(persistStart >= 0 && persistEnd > persistStart);
const persist = favorites.slice(persistStart, persistEnd);
assert.ok(persist.includes('publishMusicNoteStructureSession(user.uid, structureSyncPatch'));
assert.ok(persist.includes('publishMusicNoteStructureDelta(user.uid, structureSyncPatch)'));
assert.ok(persist.includes('queueMusicNoteFolderStructureBatch(user.uid, mode, folderItems, structureVersion)'));
assert.ok(persist.includes('queueMusicNoteFolderStructureBatch(user.uid, mode, folderItems, finalVersion)'));
assert.ok(persist.includes('if (options.immediate)'));
assert.ok(favorites.includes("persistMusicNoteFolders(mode, nextFolders, { immediate: true })"),
  'folder delete must remain immediate because song membership changes are canonical');
assert.ok(favorites.includes('resumeMusicNoteFolderStructureBatch(uid)'));
assert.ok(favorites.includes("window.addEventListener('pagehide', flushOnPageHide)"));
assert.ok(sync.includes('export const publishMusicNoteStructureDelta = async'));
assert.ok(sync.includes('): Promise<number> =>'));

// Library My/Shared compatibility revision now shares the same 60-second policy.
assert.ok(libraryBatch.includes('const LIBRARY_PLAYLIST_REVISION_BATCH_MS = 60_000'));
assert.ok(libraryPage.includes('resumeLibraryPlaylistRevisionBatch(uid)'));
assert.ok(libraryPage.includes("window.addEventListener('pagehide', flushOnPageHide)"));
assert.ok(!libraryPage.includes("document.addEventListener('visibilitychange', flushWhenHidden)"),
  'ordinary tab hiding must not collapse the requested 60-second quiet window');
assert.ok(!libraryPage.includes('Route navigation keeps the durable batch safe and asks it to settle'),
  'ordinary SPA route navigation must not force an early compatibility revision write');

// app294/app295 protections remain.
const createStart = playlistService.indexOf('export const createPlaylist = async');
const renameStart = playlistService.indexOf('export const renamePlaylist = async', createStart);
const create = playlistService.slice(createStart, renameStart);
assert.ok(create.includes('writeLibraryPlaylistItemsCache(uid, newDocRef.id, [], syncVersion)'));
assert.ok(!create.includes('getDocs('));
assert.ok(create.includes('queueLibraryPlaylistRevisionBatch(uid, syncVersion)'));

console.log('APP296_MUSIC_NOTE_FOLDER_60S_FINAL_STATE_BATCH=PASS');
console.log('APP296_MUSIC_NOTE_FOLDER_IMMEDIATE_RTDB=PASS');
console.log('APP296_MUSIC_NOTE_FOLDER_DELETE_IMMEDIATE=PASS');
console.log('APP296_LIBRARY_REVISION_60S_BATCH=PASS');
console.log('APP296_APP294_NEW_FOLDER_R0_REGRESSION=PASS');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const app = read('src/App.tsx');
const music = read('src/pages/FavoritesPage.tsx');
const library = read('src/pages/SunoLibraryPage.tsx');
const musicBatch = read('src/services/musicNoteFolderStructureBatch.ts');
const libraryRevision = read('src/services/libraryPlaylistRevisionBatch.ts');
const playlists = read('src/services/playlistService.ts');

const segment = (source, before, after) => {
  const start = source.indexOf(before);
  const end = source.indexOf(after, start + before.length);
  assert.ok(start >= 0 && end > start, `Missing segment: ${before}`);
  return source.slice(start, end);
};

// Stage414 scoped verification: static source guards, NOT real mobile-OS delivery proof.
const recent = segment(app, 'const recentSongTextFlushInFlightRef', 'const persistRegeneratedCurrentSong');
assert.match(recent, /recentSongTextFlushInFlightRef\.current\) return/);
assert.match(recent, /recentSongTextFlushInFlightRef\.current = task/);
assert.match(recent, /recentSongTextWritePendingRef\.current !== pending/);
assert.match(recent, /clearRecentSongTextPendingMarker\(pending\.uid\)/);
assert.doesNotMatch(recent, /document\.addEventListener\('visibilitychange'/);
assert.match(recent, /window\.addEventListener\('pagehide', flushOnPendingPageExit\)/);
assert.match(recent, /recentSongTextWritePendingRef\.current\?\.uid !== uid/);
assert.match(recent, /RECENT_SONG_TEXT_BATCH_MS/);
assert.match(app, /const RECENT_SONG_TEXT_BATCH_MS = 150_000/);

const detail = segment(music, 'const musicNoteExitFlushInFlightRef', 'const [favoriteContextMenuPosition');
assert.match(detail, /if \(existing\) return existing/);
assert.match(detail, /flushAllMusicNoteLocalChangesForPageExit\(\)/);
assert.match(detail, /flush: flushMusicNoteLocalPendingSingleFlight/);
assert.doesNotMatch(detail, /document\.addEventListener\('visibilitychange'/);
assert.match(detail, /window\.addEventListener\('pagehide', flushOnPageHide\)/);
assert.match(detail, /window\.removeEventListener\('pagehide', flushOnPageHide\)/);
assert.match(detail, /flushSoridrawPageSync\(activeUser, 'music-note-exit'\)/);
assert.match(music, /const drafts = await listMusicNoteDetailDrafts\(uid\)/);

assert.match(musicBatch, /const MUSIC_NOTE_FOLDER_BATCH_MS = 60_000/);
assert.match(musicBatch, /if \(!pending\) return/);
assert.match(musicBatch, /const existing = inflight\.get\(key\)/);
const folderSegment = segment(music, "resumeMusicNoteFolderStructureBatch(uid);", "const persistMusicNoteFolders = async");
assert.doesNotMatch(folderSegment, /document\.addEventListener\('visibilitychange'/);
assert.match(folderSegment, /window\.addEventListener\('pagehide', flushOnPageHide\)/);
assert.match(music, /persistMusicNoteFolders\(mode, nextFolders, \{ immediate: true \}\)/);

assert.match(playlists, /const LIBRARY_PLAYLIST_RENAME_BATCH_MS = 60_000/);
assert.match(playlists, /const LIBRARY_PLAYLIST_ORDER_BATCH_MS = 60_000/);
assert.match(libraryRevision, /const LIBRARY_PLAYLIST_REVISION_BATCH_MS = 60_000/);
const libraryExit = segment(library, 'const flushOnPageHide = () => {', 'const playlistLiveModeActive =');
assert.doesNotMatch(libraryExit, /document\.addEventListener\('visibilitychange'/);
assert.match(libraryExit, /window\.addEventListener\('pagehide', flushOnPageHide\)/);
const folderFlush = libraryExit;
assert.ok(folderFlush.indexOf('flushLibraryPlaylistRenameBatch(uid)') < folderFlush.indexOf('flushLibraryPlaylistOrderBatch(uid)'));
assert.ok(folderFlush.indexOf('flushLibraryPlaylistOrderBatch(uid)') < folderFlush.indexOf('flushLibraryPlaylistRevisionBatch(uid)'));
assert.match(libraryExit, /window\.removeEventListener\('pagehide', flushOnPageHide\)/);

// Protected paths are intentionally still independent of this lifecycle patch.
assert.match(app, /const STUDIO_HEART_BATCH_MS = 30_000/);
assert.ok(read('src/services/exploreLikeService.ts').includes('EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 5_000'));

console.log('STAGE414_RECENT_PENDING_PAGEHIDE_SINGLE_FLIGHT_STATIC=PASS');
console.log('STAGE414_MUSIC_NOTE_DETAIL_AND_FOLDER_60S_BACKGROUND_COST_PROTECTION=PASS');
console.log('STAGE414_LIBRARY_FOLDER_60S_BACKGROUND_COST_PROTECTION=PASS');
console.log('STAGE414_EXPLORE_AND_STUDIO_TIMING_PRESERVED_STATIC=PASS');
console.log('STAGE414_STUDIO_HEART_AND_FAVORITE_COUNT_EXIT=NOT_IMPLEMENTED');
console.log('STAGE414_OS_CLOSE_DELIVERY_AND_FIRESTORE_BILLING=NOT_TESTED');

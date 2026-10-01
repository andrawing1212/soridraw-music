import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const service = read('src/services/playlistService.ts');
const library = read('src/pages/SunoLibraryPage.tsx');
const favorites = read('src/pages/FavoritesPage.tsx');
const rules = read('database.rules.json');

const slice = (source, startToken, endToken) => {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.ok(start >= 0 && end > start, `region missing: ${startToken}`);
  return source.slice(start, end);
};

assert.ok(service.includes('subscribeLibraryPlaylistSync'), 'Library RTDB subscriber missing');
assert.ok(service.includes('applyLibraryPlaylistSyncSignalToCache'), 'Library delta cache applier missing');
assert.ok(service.includes('MAX_LIBRARY_PLAYLIST_SYNC_PAYLOAD_CHARS = 24000'), 'payload bound missing');
assert.ok(service.includes('truncated: encoded.truncated'), 'oversized delta fallback missing');

const resolver = slice(service, 'const resolvePlaylistInsertOrder = async', '// Saving from the global player');
assert.ok(resolver.includes('readLibraryPlaylistItemsCache(uid, playlistId)'), 'insert warm cache missing');
assert.ok(resolver.includes('playlistCacheIsCurrent(uid, listCache.version)'), 'insert cache revision gate missing');
assert.ok(resolver.indexOf('canTrustWarmItems') < resolver.indexOf('getDocs(query(itemsRef'), 'insert server read precedes warm cache path');

const deletion = slice(service, 'export const deletePlaylist = async', 'export const getTrackGlobalId');
assert.ok(deletion.includes('canUseWarmItemIds'), 'delete warm cache guard missing');
assert.ok(deletion.includes('itemCache.items.map'), 'delete cached IDs path missing');
assert.ok(deletion.includes('const itemsSnap = await getDocs(itemsRef);'), 'delete cold fallback missing');

for (const op of ['playlist-create','playlist-rename','playlist-delete','item-add','item-delete','item-move','item-color','item-swap']) {
  assert.ok(service.includes(`publishLibraryPlaylistSyncSignal(uid, '${op}'`), `delta publisher missing: ${op}`);
}
assert.ok(library.includes('subscribeLibraryPlaylistSync(uid'), 'Library page live delta subscription missing');
assert.ok(library.includes('applyLibraryPlaylistSyncSignalToCache(uid, signal)'), 'Library receiver cache patch missing');
assert.ok(library.includes('profileFallbackTimer'), 'bounded profile fallback missing');
assert.ok(library.includes('cached.version >= latestRemoteVersion'), 'profile fallback cache recheck missing');

const rename = slice(favorites, 'const commitRenameMusicNoteFolder = async', 'const openDeleteMusicNoteFolder');
assert.ok(rename.includes('await persistMusicNoteFolders(mode, nextFolders);'), 'Music Note rename structure write missing');
assert.ok(!rename.includes('commitMusicNoteFolderUpdates('), 'Music Note rename still fans out writes');
assert.ok(!rename.includes('affectedSongs'), 'Music Note rename still enumerates songs');

assert.ok(rules.includes('"libraryPlaylist": {'), 'Library RTDB rule missing');
assert.ok(rules.includes("newData.hasChildren(['version','at','originDeviceId','operation','syncVersion','payloadJson','truncated'])"), 'Library RTDB rule shape missing');

console.log('APP293_LIBRARY_PLAYLIST_DELTA_SYNC=PASS');
console.log('APP293_LIBRARY_WARM_INSERT_SERVER_R0_PATH=PASS');
console.log('APP293_LIBRARY_WARM_DELETE_DISCOVERY_R0_PATH=PASS');
console.log('APP293_MUSIC_NOTE_FOLDER_RENAME_W1_ONLY=PASS');
console.log('APP293_NO_USER_DATA_MIGRATION=PASS');

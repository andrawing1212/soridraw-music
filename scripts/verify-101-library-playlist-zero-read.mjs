import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const library = read('src/pages/SunoLibraryPage.tsx');
const service = read('src/services/playlistService.ts');
const cache = read('src/lib/libraryPlaylistCache.ts');
const rules = read('firestore.rules');

const playlistEntryStart = library.indexOf("const playlistLiveModeActive =");
const playlistEntryEnd = library.indexOf('const handleRemoveFromPlaylist', playlistEntryStart);
assert.ok(playlistEntryStart >= 0 && playlistEntryEnd > playlistEntryStart, 'playlist entry region missing');
const playlistEntry = library.slice(playlistEntryStart, playlistEntryEnd);

assert.ok(cache.includes("const DB_NAME = 'soridraw_library_playlist_cache'"), 'durable playlist cache missing');
assert.ok(cache.includes('indexedDB.open'), 'playlist cache is not durable IndexedDB');
assert.ok(cache.includes("scope: 'lists' | 'items'"), 'list/item cache scopes missing');
assert.ok(library.includes('readLibraryPlaylistListCache(uid)'), 'playlist list cache is not used');
assert.ok(library.includes('readLibraryPlaylistItemsCache(uid, playlistId)'), 'playlist item cache is not used');
assert.ok(library.includes("markCacheDiagnostic('library', 'CACHE', 0)"), 'zero-read diagnostic missing');

assert.ok(!playlistEntry.includes('onSnapshot('), 'playlist entry still attaches a Firestore listener');
assert.ok(!playlistEntry.includes('fetchTrackLikes('), 'playlist entry still fetches per-track likes');
assert.ok(!playlistEntry.includes('fetchSharedTracksStatus('), 'playlist entry still fetches per-track share status');
assert.ok(!playlistEntry.includes("getDoc(doc(db, 'suno_shares'"), 'playlist entry still fetches share documents');
assert.ok(!service.includes('export const fetchTrackLikes'), 'retired per-track like fan-out remains exported');
assert.ok(!service.includes('export const fetchSharedTracksStatus'), 'retired share-status fan-out remains exported');

assert.ok(service.includes("'syncVersions.playlists': syncVersion"), 'playlist cross-device version signal missing');
assert.ok(service.includes('itemsRevision: syncVersion'), 'per-playlist item revision missing');
assert.ok(service.includes('transaction.get(likeRef)'), 'like mutation does not verify canonical membership');
assert.ok(service.includes('transaction.get(countRef)'), 'like mutation does not verify canonical count');
assert.ok(service.includes('currentlyLiked === desiredLiked'), 'stale like cache does not preserve the clicked intent');

assert.ok(rules.includes("'musicNoteStructure', 'playlists'"), 'playlists sync version rule field missing');
assert.ok(rules.includes("request.resource.data.syncVersions.playlists is int"), 'playlists sync version type guard missing');
assert.ok(
  rules.includes('allow update: if (isOwner(uid) && isValidSelfUpdate()) || isMaster() || validUserManagerUpdate();'),
  'ordinary user self-update does not short-circuit before admin dependent reads',
);

const playlistRulesStart = rules.indexOf('match /user_playlists/{uid}/lists/{playlistId}');
const playlistRulesEnd = rules.indexOf('// App Settings', playlistRulesStart);
const playlistRules = rules.slice(playlistRulesStart, playlistRulesEnd);
assert.ok(playlistRules.includes('allow read, write: if isOwner(uid) || isAdmin();'), 'playlist owner-first authorization changed');

const likeRulesStart = rules.indexOf('// Playlist Likes');
const likeRulesEnd = rules.indexOf('// 3. Default Deny', likeRulesStart);
const likeRules = rules.slice(likeRulesStart, likeRulesEnd);
assert.ok(likeRules.includes('allow read: if isAuthenticated();'), 'playlist like read rule changed');
assert.ok(!likeRules.includes('allow read: if isAdmin()'), 'playlist like reads unexpectedly invoke admin document lookup');

const shareRulesStart = rules.indexOf('match /suno_shares/{shareId}');
const shareRulesEnd = rules.indexOf('// Music Note Shares', shareRulesStart);
const shareRules = rules.slice(shareRulesStart, shareRulesEnd);
assert.ok(shareRules.includes('resource.data.isPublic == true ||\n                   isOwner(resource.data.ownerUid) ||\n                   isAdmin()'), 'share rule no longer short-circuits public/owner before admin lookup');

console.log('VERIFY_101_LIBRARY_PLAYLIST_ZERO_READ=PASS');

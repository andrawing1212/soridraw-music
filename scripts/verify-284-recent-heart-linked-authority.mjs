import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const version = JSON.parse(fs.readFileSync('public/app-version.json', 'utf8'));

assert.ok(Number(version.version) >= 284, 'app version must be 284 or newer');

const favoritedStart = app.indexOf('  const isSongFavorited = useCallback');
const favoritedEnd = app.indexOf('  const getFavoriteTitleFingerprint', favoritedStart);
assert.ok(favoritedStart >= 0 && favoritedEnd > favoritedStart, 'isSongFavorited block missing');
const favorited = app.slice(favoritedStart, favoritedEnd);
assert.match(favorited, /const linkedFavoriteId = String\(\(song as any\)\?\.favoriteFirestoreId/);
assert.match(favorited, /if \(linkedFavoriteId\) return statusMap\.has\(linkedFavoriteId\)/);
const linkedAuthorityPos = favorited.indexOf('if (linkedFavoriteId) return statusMap.has(linkedFavoriteId)');
const generationFallbackPos = favorited.indexOf('const recentSongSyncKey = buildRecentSongSyncKey(song)');
assert.ok(linkedAuthorityPos >= 0 && generationFallbackPos > linkedAuthorityPos,
  'explicit favorite link must outrank generation/recent-key fallback');

const toggleStart = app.indexOf('  const toggleFavorite = async');
const toggleEnd = app.indexOf('  const updateFavorite = async', toggleStart);
assert.ok(toggleStart >= 0 && toggleEnd > toggleStart, 'toggleFavorite block missing');
const toggle = app.slice(toggleStart, toggleEnd);

const localStart = toggle.indexOf('const findLocalExistingFavorite = () =>');
const serverStart = toggle.indexOf('const findServerMatchingFavorites = async', localStart);
assert.ok(localStart >= 0 && serverStart > localStart, 'local favorite resolver missing');
const local = toggle.slice(localStart, serverStart);
assert.match(local, /if \(linkedFavoriteId\) \{[\s\S]*?return exactLinkedFavorite \|\| null;[\s\S]*?\}/);
assert.ok(local.indexOf('return exactLinkedFavorite || null') < local.indexOf('findBestMatchingFavorite'),
  'linked favorite miss must not fall through to a stale duplicate');

assert.match(toggle, /unlikedAt: null/);
assert.match(toggle, /unsavedAt: null/);
assert.match(toggle, /deletedAt: null/);
assert.match(toggle, /trashedAt: null/);

assert.match(toggle, /const linkedFavoriteAuthorityId = String\(\(song as any\)\?\.favoriteFirestoreId/);
assert.match(toggle, /const favoriteDocRef = linkedFavoriteAuthorityId[\s\S]*?doc\(db, 'favorites', linkedFavoriteAuthorityId\)/);
assert.ok(
  toggle.indexOf("doc(db, 'favorites', linkedFavoriteAuthorityId)") <
  toggle.indexOf("buildRecentFavoriteDocumentId(user.uid, deterministicRecentIdentity)"),
  'existing explicit link must outrank deterministic new-doc resolution',
);

const fastStart = app.indexOf('  const syncMusicNoteIncrementalFromRemoteVersion = useCallback');
const fastEnd = app.indexOf('// Signals without exact ids are legacy/bulk fallback only.', fastStart);
assert.ok(fastStart >= 0 && fastEnd > fastStart, 'Music Note exact changed-item fast path missing');
assert.doesNotMatch(app.slice(fastStart, fastEnd), /getDoc\(|getDocs\(/,
  'remote changed-item receive must remain Firestore R0');

console.log('APP284_EXACT_LINK_HEART_AUTHORITY=PASS');
console.log('APP284_STALE_DUPLICATE_CANNOT_RELIGHT=PASS');
console.log('APP284_EMPTY_HEART_RESTORES_EXACT_LINK_W1=PASS');
console.log('APP284_SOFT_REMOVE_RESIDUE_CLEARED_ON_SAVE=PASS');
console.log('APP284_REMOTE_RECEIVER_FIRESTORE_R0=PASS');

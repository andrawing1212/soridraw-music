import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const version = JSON.parse(fs.readFileSync('public/app-version.json', 'utf8'));

assert.ok(Number(version.version) >= 280, 'app version must be 280 or newer');

assert.match(app, /const forgetFavoriteDeletedTombstones = \(uid: string, ids: string\[\]\) =>/);
assert.match(app, /rememberFavoriteDeletedTombstones\(user\.uid, unsaveCatalogRemovalIds\)/);
assert.match(app, /forgetFavoriteDeletedTombstones\(user\.uid, \[existingFav\.id\]\)/);
assert.match(app, /forgetFavoriteDeletedTombstones\(user\.uid, \[createdFavoriteDocRef\.id\]\)/);

const cacheStart = app.indexOf('  const writeFavoritesCache = (');
const cacheEnd = app.indexOf('  const patchFavoriteCacheImmediately', cacheStart);
assert.ok(cacheStart >= 0 && cacheEnd > cacheStart, 'writeFavoritesCache block missing');
const cacheBlock = app.slice(cacheStart, cacheEnd);
assert.match(cacheBlock, /deletedIds: Array\.from\(getFavoriteDeletedTombstoneIds\(uid\)\)/);

const bundleMarker = "const localDeletedIds = getFavoriteDeletedTombstoneIds(currentUser.uid);";
assert.ok(app.includes(bundleMarker), 'catalog hydration tombstone filter missing');
assert.match(app, /!localDeletedIds\.has\(favoriteId\)/);

const remoteStart = app.indexOf('  const syncMusicNoteIncrementalFromRemoteVersion = useCallback');
const remoteFastEnd = app.indexOf('// Signals without exact ids are legacy/bulk fallback only.', remoteStart);
assert.ok(remoteStart >= 0 && remoteFastEnd > remoteStart, 'remote Music Note fast path missing');
const remoteFast = app.slice(remoteStart, remoteFastEnd);
assert.match(remoteFast, /if \(isRemovalOperation\) \{\s*rememberFavoriteDeletedTombstones\(uid, exactDocumentIds\)/);
assert.match(remoteFast, /normalizedOperation === 'save'/);
assert.match(remoteFast, /forgetFavoriteDeletedTombstones\(uid, exactDocumentIds\)/);
assert.doesNotMatch(remoteFast, /getDoc\(|getDocs\(/);

const toggleStart = app.indexOf('  const toggleFavorite = async (song: SongResult');
const toggleEnd = app.indexOf('  const updateFavorite = async', toggleStart);
assert.ok(toggleStart >= 0 && toggleEnd > toggleStart, 'toggleFavorite block missing');
const toggle = app.slice(toggleStart, toggleEnd);
assert.match(toggle, /operation: 'unsave'/);
assert.match(toggle, /favoriteRemoved: true/);
assert.match(toggle, /saved: false/);
assert.match(toggle, /rememberFavoriteDeletedTombstones\(user\.uid, unsaveCatalogRemovalIds\)/);

// app286 adds one mutually-exclusive exact-id UNSAVE branch for the case where
// the UI knows the canonical favorite id but this device's active cache row is
// missing. It is still a single W1 at runtime and adds no Firestore read.
const unsaveAnchor = toggle.indexOf('const unsavedAt = Date.now()');
const saveAnchor = toggle.indexOf('const createdAtMs = Date.now()', unsaveAnchor);
const unsave = toggle.slice(unsaveAnchor, saveAnchor);
assert.equal((unsave.match(/updateDoc\(/g) || []).length, 3, 'expected two existing unsave branches plus app286 exact-id branch');
assert.match(unsave, /if \(intendedAction === 'unsave'\)/);
assert.match(unsave, /updateDoc\(doc\(db, 'favorites', exactFavoriteId\), exactUnsaveUpdates\)/);
assert.equal((unsave.match(/getDoc\(/g) || []).length, 0);
assert.equal((unsave.match(/getDocs\(/g) || []).length, 0);

const legacyStart = app.indexOf('  const applyFavoriteSyncSignal = (uid: string, signal: any) => {');
const legacyEnd = app.indexOf("  const SUNO_LIBRARY_SIGNAL_KEY", legacyStart);
assert.ok(legacyStart >= 0 && legacyEnd > legacyStart, 'legacy sync block missing');
const legacy = app.slice(legacyStart, legacyEnd);
assert.match(legacy, /Soft unsave must suppress the stale full Catalog row on reload/);
assert.match(legacy, /rememberFavoriteDeletedTombstones\(uid, removedFavoriteIds\)/);
assert.match(legacy, /forgetFavoriteDeletedTombstones\(uid, \[savedFavoriteId\]\)/);

console.log('APP280_UNSAVE_CATALOG_TOMBSTONE=PASS');
console.log('APP280_REENTRY_NO_RESURRECTION_GUARD=PASS');
console.log('APP280_REMOTE_DEVICE_NO_RESURRECTION_GUARD=PASS');
console.log('APP280_SAVE_RESTORE_REVIVES_EXACT_ID=PASS');
console.log('APP280_NO_EXTRA_FIRESTORE_IO=PASS');

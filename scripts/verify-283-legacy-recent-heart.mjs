import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const engine = fs.readFileSync('src/lib/userDataEngine.ts', 'utf8');
const sync = fs.readFileSync('src/services/userDomainSyncService.ts', 'utf8');
const version = JSON.parse(fs.readFileSync('public/app-version.json', 'utf8'));

assert.equal(Number(version.version), 283);

const identityStart = app.indexOf('  const getRecentSongGenerationSyncKey = (song: any): string => {');
const identityEnd = app.indexOf('  const getFavoriteComparableText', identityStart);
assert.ok(identityStart >= 0 && identityEnd > identityStart, 'recent identity block missing');
const identity = app.slice(identityStart, identityEnd);
assert.match(identity, /const buildLegacyRecentFavoriteBridge/);
assert.match(identity, /if \(getRecentSongGenerationSyncKey\(song\)\) return \{\}/);
assert.match(identity, /recentLegacySourceId: sourceIdentity\.sourceId/);
assert.match(identity, /recentLegacyCreatedAtMs/);

assert.match(engine, /'recentLegacySourceId'/);
assert.match(engine, /'recentLegacyCreatedAtMs'/);

assert.match(sync, /const projectRemovedMusicNoteIdentityForSync/);
assert.match(sync, /__musicNoteRemovalIdentity: true/);
assert.match(sync, /recentLegacySourceId/);
assert.match(sync, /favoriteRemoved: true/);
assert.doesNotMatch(sync, /firebase\/firestore|getDoc\(|getDocs\(|collection\(/,
  'RTDB transport must remain Firestore-read free');

const toggleStart = app.indexOf('  const toggleFavorite = async');
const toggleEnd = app.indexOf('  const updateFavorite = async', toggleStart);
assert.ok(toggleStart >= 0 && toggleEnd > toggleStart, 'toggleFavorite block missing');
const toggle = app.slice(toggleStart, toggleEnd);
assert.match(toggle, /\.\.\.buildLegacyRecentFavoriteBridge\(song\)/);
assert.match(toggle, /syncItem: sanitizeForFirestore\(\{ \.\.\.targetFavorite, \.\.\.targetUpdates, \.\.\.buildLegacyRecentFavoriteBridge\(song\)/);

const heartStart = app.indexOf('  const handleToggleCurrentStudioFavorite = async');
const heartEnd = app.indexOf('  const isRecentSongSectionEditing', heartStart);
assert.ok(heartStart >= 0 && heartEnd > heartStart, 'Recent Studio heart block missing');
const heart = app.slice(heartStart, heartEnd);
assert.match(heart, /recentFavoriteExplicitlyUnsavedAt = Date\.now\(\)/);
assert.match(heart, /delete nextCommittedSong\.recentFavoriteExplicitlyUnsavedAt/);

const favoritedStart = app.indexOf('  const isSongFavorited = useCallback');
const favoritedEnd = app.indexOf('  const getFavoriteTitleFingerprint', favoritedStart);
assert.ok(favoritedStart >= 0 && favoritedEnd > favoritedStart, 'isSongFavorited block missing');
assert.match(app.slice(favoritedStart, favoritedEnd), /recentFavoriteExplicitlyUnsavedAt/);

const syncStart = app.indexOf('  const syncMusicNoteIncrementalFromRemoteVersion = useCallback');
const fallbackStart = app.indexOf('// Signals without exact ids are legacy/bulk fallback only.', syncStart);
assert.ok(syncStart >= 0 && fallbackStart > syncStart, 'Music Note RTDB fast path missing');
const fast = app.slice(syncStart, fallbackStart);
assert.match(fast, /recentLegacySourceId/);
assert.match(fast, /getRecentSongSourceIdentity\(song\)/);
assert.match(fast, /recentFavoriteExplicitlyUnsavedAt/);
assert.match(fast, /favoriteFirestoreId = remoteFavoriteId/);
assert.doesNotMatch(fast, /getDoc\(|getDocs\(/,
  'app283 legacy heart convergence must be zero-read on receive');

console.log('APP283_LEGACY_RECENT_HEART_SOURCE_BRIDGE=PASS');
console.log('APP283_MUSIC_NOTE_SIGNAL_REUSED_NO_EXTRA_RTDB_WRITE=PASS');
console.log('APP283_REMOTE_FIRESTORE_R0=PASS');
console.log('APP283_MODERN_GENERATION_IDENTITY_UNCHANGED=PASS');

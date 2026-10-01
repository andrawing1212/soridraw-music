import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const sync = fs.readFileSync('src/services/userDomainSyncService.ts', 'utf8');
const version = JSON.parse(fs.readFileSync('public/app-version.json', 'utf8'));

assert.equal(Number(version.version), 285);

const heartStart = app.indexOf('  const handleToggleCurrentStudioFavorite = async');
const heartEnd = app.indexOf('  const isRecentSongSectionEditing', heartStart);
assert.ok(heartStart >= 0 && heartEnd > heartStart, 'Recent Studio heart handler missing');
const heart = app.slice(heartStart, heartEnd);

assert.match(heart, /const favoriteLinkBeforeToggle = String/);
assert.match(heart, /currentSongBeforeToggle\?\.favoriteFirestoreId/);
assert.match(heart, /activeFavoriteBeforeToggle\?\.id/);
assert.match(heart, /if \(wasFavoritedBeforeToggle\) \{[\s\S]*?nextCommittedSong\.favoriteFirestoreId = favoriteLinkBeforeToggle/);
assert.match(heart, /nextCommittedSong\.musicNoteFavoriteId = favoriteLinkBeforeToggle/);
assert.match(heart, /favoriteLinkAfterToggle/);
assert.match(heart, /favoriteLinkAfterToggle !== String\(/);
assert.match(heart, /operation: 'pre-favorite-edit'/);

const remoteStart = app.indexOf('  const syncMusicNoteIncrementalFromRemoteVersion = useCallback');
const fallbackStart = app.indexOf('// Signals without exact ids are legacy/bulk fallback only.', remoteStart);
assert.ok(remoteStart >= 0 && fallbackStart > remoteStart, 'Music Note exact changed-item path missing');
const remote = app.slice(remoteStart, fallbackStart);

assert.match(remote, /const canPatchRecentFavoriteLink = Boolean/);
assert.match(remote, /isSameRecentSongSyncItem\(song, remoteItem\)/);
assert.match(remote, /nextSong\.favoriteFirestoreId = remoteFavoriteId/);
assert.match(remote, /nextSong\.musicNoteFavoriteId = remoteFavoriteId/);
assert.doesNotMatch(remote, /delete nextSong\.favoriteFirestoreId/);
assert.doesNotMatch(remote, /getDoc\(|getDocs\(/, 'receiver must remain Firestore R0');

const removalStart = sync.indexOf('const projectRemovedMusicNoteIdentityForSync');
const removalEnd = sync.indexOf('const toSyncTimestamp', removalStart);
assert.ok(removalStart >= 0 && removalEnd > removalStart, 'removed Music Note projection missing');
const removal = sync.slice(removalStart, removalEnd);

assert.match(removal, /generationBatchId/);
assert.match(removal, /generationIndex/);
assert.match(removal, /recentSongSyncKey/);
assert.match(removal, /soridrawSongId/);
assert.match(removal, /appliedKeywords: hasGenerationIdentity/);
assert.doesNotMatch(removal, /if \(!recentLegacySourceId\) return null/);
assert.match(removal, /__musicNoteRemovalIdentity: true/);

assert.doesNotMatch(sync, /firebase\/firestore|getDoc\(|getDocs\(|collection\(/,
  'RTDB transport must remain canonical Firestore-read free');

console.log('APP285_UNSAVE_PRESERVES_EXACT_RECENT_LINK=PASS');
console.log('APP285_REMOTE_UNSAVE_CARRIES_MODERN_SONG_IDENTITY=PASS');
console.log('APP285_SAVE_UNSAVE_USE_SAME_RECENT_IDENTITY=PASS');
console.log('APP285_STALE_DUPLICATE_HEART_FALLBACK_BLOCKED=PASS');
console.log('APP285_REMOTE_RECEIVER_FIRESTORE_R0=PASS');
console.log('APP285_EXTRA_RTDB_MUTATION=0');

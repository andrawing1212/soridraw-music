import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isMusicNoteItemRemoved } from '../src/lib/musicNoteSavedState';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const store = fs.readFileSync('src/hooks/useFavoritesStore.ts', 'utf8');
const engine = fs.readFileSync('src/lib/userDataEngine.ts', 'utf8');
const bundle = fs.readFileSync('src/lib/listBundleCache.ts', 'utf8');
const version = JSON.parse(fs.readFileSync('public/app-version.json', 'utf8'));

assert.ok(Number(version.version) >= 286, 'app version must be 286 or newer');

// Current explicit state must beat old historical removal timestamps.
assert.equal(isMusicNoteItemRemoved({
  saved: true,
  favoriteRemoved: false,
  unlikedAt: 1700000000000,
  unsavedAt: 1700000000000,
}), false);
assert.equal(isMusicNoteItemRemoved({
  saved: false,
  favoriteRemoved: true,
  favoriteRemovedAt: 1700000000000,
}), true);
assert.equal(isMusicNoteItemRemoved({
  unlikedAt: 1700000000000,
}), true);

assert.match(store, /isMusicNoteItemRemoved/);
assert.match(engine, /isMusicNoteItemRemoved/);
assert.match(bundle, /isMusicNoteItemRemoved/);

const heartStateStart = app.indexOf('  const isSongFavorited = useCallback');
const heartStateEnd = app.indexOf('  const getFavoriteTitleFingerprint', heartStateStart);
assert.ok(heartStateStart >= 0 && heartStateEnd > heartStateStart);
const heartState = app.slice(heartStateStart, heartStateEnd);
assert.match(heartState, /const recentHeartAuthority = readRecentHeartAuthority\(song\)/);
assert.ok(
  heartState.indexOf('if (recentHeartAuthority) return recentHeartAuthority.saved') <
  heartState.indexOf('recentFavoriteDetachedAt'),
  'latest per-song authority must outrank stale local detached/unsaved markers',
);

const remoteStart = app.indexOf('  const syncMusicNoteIncrementalFromRemoteVersion = useCallback');
const remoteEnd = app.indexOf('// Signals without exact ids are legacy/bulk fallback only.', remoteStart);
assert.ok(remoteStart >= 0 && remoteEnd > remoteStart);
const remote = app.slice(remoteStart, remoteEnd);
assert.match(remote, /rememberRecentHeartAuthority\([\s\S]*?remoteItem[\s\S]*?remoteHeartSaved[\s\S]*?remoteFavoriteId[\s\S]*?remoteVersion/);
assert.ok(
  remote.indexOf('rememberRecentHeartAuthority(') <
  remote.indexOf('const targetIndex = currentHistory.findIndex'),
  'remote heart state must update before stale Recent row matching',
);
assert.match(remote, /localFavoriteId && localFavoriteId === remoteFavoriteId/);
assert.doesNotMatch(remote, /getDoc\(|getDocs\(/, 'remote exact signal path must remain Firestore R0');

const toggleStart = app.indexOf('  const toggleFavorite = async');
const toggleEnd = app.indexOf('  const updateFavorite = async', toggleStart);
assert.ok(toggleStart >= 0 && toggleEnd > toggleStart);
const toggle = app.slice(toggleStart, toggleEnd);
assert.match(toggle, /intendedAction\?: 'save' \| 'unsave'/);
assert.match(toggle, /intendedAction === 'save' && !isFavoriteHidden\(existingFav\)/);
assert.match(toggle, /intendedAction === 'unsave' && isFavoriteHidden\(existingFav\)/);
assert.match(toggle, /if \(intendedAction === 'unsave'\) \{[\s\S]*?updateDoc\(doc\(db, 'favorites', exactFavoriteId\)/);
assert.ok(
  toggle.indexOf("if (intendedAction === 'unsave')") <
  toggle.indexOf('const createdAtMs = Date.now()'),
  'UNSAVE must terminate before save/create path',
);

const studioStart = app.indexOf('  const handleToggleCurrentStudioFavorite = async');
const studioEnd = app.indexOf('  const isRecentSongSectionEditing', studioStart);
assert.ok(studioStart >= 0 && studioEnd > studioStart);
const studio = app.slice(studioStart, studioEnd);
assert.match(studio, /const intendedFavoriteAction: 'save' \| 'unsave' = wasFavoritedBeforeToggle \? 'unsave' : 'save'/);
assert.match(studio, /authorityBeforeToggle\?\.favoriteId/);
assert.match(studio, /intendedAction: intendedFavoriteAction/);
assert.match(studio, /rememberRecentHeartAuthority\(/);

console.log('APP286_SHARED_SAVED_STATE_AUTHORITY=PASS');
console.log('APP286_REMOTE_HEART_AUTHORITY_BEFORE_CACHE_MATCH=PASS');
console.log('APP286_UI_DIRECTION_EQUALS_MUTATION_DIRECTION=PASS');
console.log('APP286_STALE_CACHE_UNSAVE_EXACT_W1=PASS');
console.log('APP286_REMOTE_RECEIVER_FIRESTORE_R0=PASS');
console.log('APP286_DUPLICATE_ROW_CANNOT_REVERSE_HEART_DIRECTION=PASS');

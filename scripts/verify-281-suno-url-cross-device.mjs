import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const page = fs.readFileSync('src/pages/FavoritesPage.tsx', 'utf8');
const sync = fs.readFileSync('src/services/userDomainSyncService.ts', 'utf8');
const boundary = fs.readFileSync('src/data/v1MutationBoundary.ts', 'utf8');
const engine = fs.readFileSync('src/lib/userDataEngine.ts', 'utf8');
const version = JSON.parse(fs.readFileSync('public/app-version.json', 'utf8'));

assert.ok(Number(version.version) >= 281, 'app version must be 281 or newer');

assert.match(boundary, /'suno-media-preview'/);
assert.match(sync, /export const publishMusicNoteSunoMediaDelta/);
assert.match(sync, /operation: 'suno-media-preview'/);
assert.match(sync, /documentIds: \[safeDocumentId\]/);
assert.match(sync, /syncItem,/);
assert.doesNotMatch(sync, /firebase\/firestore|getDoc\(|getDocs\(/);

for (const key of [
  "'sunoLinks'", "'mainSunoIndex'", "'sunoShareUrl'", "'sunoCoverUrl'",
  "'sunoDurationSeconds'", "'sunoCoverFetchedAt'",
]) {
  assert.ok(engine.includes(key), `Music Note catalog projector missing ${key}`);
}

assert.match(page, /publishMusicNoteSunoMediaDelta/);
assert.match(page, /const publishFavoriteSunoMediaDraft = async/);
assert.match(page, /await publishMusicNoteSunoMediaDelta\(user\.uid, safeSongId,/);

const saveStart = page.indexOf('  const saveFavoriteSunoShareUrls = async');
const removeStart = page.indexOf('  const removeFavoriteSunoShareUrl = async', saveStart);
assert.ok(saveStart >= 0 && removeStart > saveStart, 'Suno URL save block missing');
const saveBlock = page.slice(saveStart, removeStart);
assert.match(saveBlock, /if \(source === 'detail'\) \{\s*queueFavoriteDetailPatch\(song\.id, updates\);\s*await publishFavoriteSunoMediaDraft\(song\.id, updates\);/);
assert.match(saveBlock, /else \{\s*await updateFavorite\(song\.id, updates\);/);

const removeEnd = page.indexOf('  const COLOR_SYNC_USAGE_KEY', removeStart);
const removeBlock = page.slice(removeStart, removeEnd);
assert.match(removeBlock, /if \(source === 'detail'\) \{\s*queueFavoriteDetailPatch\(song\.id, updates\);\s*await publishFavoriteSunoMediaDraft\(song\.id, updates\);/);

const queueStart = page.indexOf('  const queueFavoriteDetailPatch = (');
const queueEnd = page.indexOf('  const flushAllMusicNoteLocalChangesForPageExit', queueStart);
assert.ok(queueStart >= 0 && queueEnd > queueStart, 'detail draft queue missing');
const queueBlock = page.slice(queueStart, queueEnd);
assert.match(queueBlock, /writeMusicNoteDetailDraft/);
assert.doesNotMatch(queueBlock, /updateDoc\(|setDoc\(/);

assert.match(page, /Cross-device Suno media can arrive while this exact Detail & Edit panel is/);
assert.match(page, /const editorHasUnsavedUrlInput =/);
assert.match(page, /const nextState = buildFavoriteSunoEditorState\(latestSong\)/);
assert.match(page, /setDetailSunoUrlInputs\(nextState\.inputs\)/);

const receiveStart = app.indexOf('// app277 — normal changed-item UI state rides the tiny RTDB signal.');
const receiveEnd = app.indexOf('// Signals without exact ids are legacy/bulk fallback only.', receiveStart);
assert.ok(receiveStart >= 0 && receiveEnd > receiveStart, 'zero-read Music Note receive block missing');
const receive = app.slice(receiveStart, receiveEnd);
assert.match(receive, /const remoteItems: any\[\]/);
assert.match(receive, /publishDerived: false/);
assert.doesNotMatch(receive, /getDoc\(|getDocs\(|query\(|collection\(/);

console.log('APP281_SUNO_URL_RTDB_PREVIEW_SYNC=PASS');
console.log('APP281_REMOTE_LIST_THUMBNAIL_ZERO_FIRESTORE_READ=PASS');
console.log('APP281_OPEN_DETAIL_SUNO_MEDIA_REFRESH=PASS');
console.log('APP281_DETAIL_FIRESTORE_BATCHING_PRESERVED=PASS');

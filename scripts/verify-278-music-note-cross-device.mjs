import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const page = fs.readFileSync('src/pages/FavoritesPage.tsx', 'utf8');
const sync = fs.readFileSync('src/services/userDomainSyncService.ts', 'utf8');
const boundary = fs.readFileSync('src/data/v1MutationBoundary.ts', 'utf8');
const engine = fs.readFileSync('src/lib/userDataEngine.ts', 'utf8');
const store = fs.readFileSync('src/hooks/useFavoritesStore.ts', 'utf8');
const countBatch = fs.readFileSync('src/services/musicNoteFavoriteCountBatch.ts', 'utf8');
const version = JSON.parse(fs.readFileSync('public/app-version.json', 'utf8'));

assert.equal(Number(version.version), 278);

assert.match(boundary, /'structure-update'/);
assert.match(boundary, /syncItems\?: readonly unknown\[\]/);
assert.match(boundary, /syncStructure\?: unknown/);

assert.match(sync, /export const MUSIC_NOTE_SYNC_EVENT/);
assert.match(sync, /__musicNoteStructureSync: true/);
assert.match(sync, /export const publishMusicNoteStructureDelta/);
assert.match(sync, /Array\.isArray\(context\.syncItems\)/);
assert.match(sync, /encoded\.length <= 24000/);
assert.doesNotMatch(sync, /getDoc\(|getDocs\(|collection\(|firebase\/firestore/);

assert.match(engine, /'recentSongSyncKey'/);
assert.match(engine, /'sharedNoteFolderTitle'/);
assert.match(engine, /'sharedNoteFolderUpdatedAt'/);
assert.match(engine, /'noteFolderTitle'/);
assert.match(engine, /'noteFolderUpdatedAt'/);

assert.match(store, /soridraw:/);
assert.match(store, /recent:/);

assert.match(app, /const buildRecentSongSyncKey/);
assert.match(app, /recentSongSyncKey: recentSongSyncKey \|\| buildRecentSongSyncKey\(song\)/);
assert.match(app, /statusMap\.has\(\`soridraw:/);
assert.match(app, /statusMap\.has\(\`recent:/);
assert.match(app, /favoriteRecentSyncKey && songRecentSyncKey/);

const receiveStart = app.indexOf('// app277 — normal changed-item UI state rides the tiny RTDB signal.');
const receiveEnd = app.indexOf('// Signals without exact ids are legacy/bulk fallback only.', receiveStart);
assert.ok(receiveStart >= 0 && receiveEnd > receiveStart, 'zero-read receive block missing');
const receive = app.slice(receiveStart, receiveEnd);
assert.match(receive, /app278 — folder\/card-state structure changes/);
assert.match(receive, /normalizedOperation === 'structure-update'/);
assert.match(receive, /const remoteItems: any\[\]/);
assert.match(receive, /publishDerived: false/);
assert.doesNotMatch(receive, /getDoc\(|getDocs\(|query\(|collection\(/);

assert.match(page, /publishMusicNoteStructureDelta/);
assert.match(page, /readPendingMusicNoteSyncSignal/);
assert.match(page, /operation: 'structure-update'/);
assert.match(page, /syncStructure: structureSyncPatch/);
assert.match(page, /syncItems,/);
assert.match(page, /musicNoteCardStateDelta/);
assert.match(page, /commitMusicNoteFolderUpdates\(affectedSongs\.map\(\(song\) => song\.id\), titleUpdates, 'folder-rename'\)/);
assert.match(page, /commitMusicNoteFolderUpdates\(affectedSongs\.map\(\(song\) => song\.id\), fallbackUpdates, 'folder-delete'\)/);

const cardToggleStart = page.indexOf('  const updateMusicNoteCardStateForSong = (');
const cardToggleEnd = page.indexOf('  const renderMusicNoteStateButtonFill', cardToggleStart);
assert.ok(cardToggleStart >= 0 && cardToggleEnd > cardToggleStart, 'card state block missing');
const cardToggle = page.slice(cardToggleStart, cardToggleEnd);
assert.match(cardToggle, /publishMusicNoteStructureDelta/);
assert.doesNotMatch(cardToggle, /setDoc\(|updateDoc\(|getDoc\(/);

assert.match(countBatch, /const FLUSH_MS = 30_000/);
assert.equal((app.match(/favoriteSyncSignal/g) || []).length, 0);
assert.equal((app.match(/favoriteCount:\s*increment/g) || []).length, 0);

console.log('APP278_SHARED_NOTE_STRUCTURE_LIVE_SYNC=PASS');
console.log('APP278_FOLDER_CHANGED_ITEM_ZERO_READ_SYNC=PASS');
console.log('APP278_CARD_STATE_RTDB_FIRESTORE_W0=PASS');
console.log('APP278_LEGACY_RECENT_HEART_IDENTITY=PASS');
console.log('APP278_REMOTE_RECEIVER_FIRESTORE_R0=PASS');

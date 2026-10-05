import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const sync = fs.readFileSync('src/services/userDomainSyncService.ts', 'utf8');
const boundary = fs.readFileSync('src/data/v1MutationBoundary.ts', 'utf8');
const musicNote = fs.readFileSync('src/pages/FavoritesPage.tsx', 'utf8');

assert.match(app, /const RECENT_SONG_TEXT_BATCH_MS = 150_000;/);
assert.match(app, /RECENT_SONG_TEXT_PENDING_STORAGE_BASE = 'soridraw_recent_text_pending_v2'/);
assert.match(app, /publishRecentSongEditPreviewDelta\(uid, syncItem\)/);
assert.match(app, /window\.setTimeout\(\(\) => \{\s*recentSongTextWriteTimerRef\.current = null;\s*void flushRecentSongTextWrite\(\);\s*\}, RECENT_SONG_TEXT_BATCH_MS\)/s);
assert.match(app, /hasRecentSongTextPendingMarker\(user\.uid\)/);
const restoreStart = app.indexOf("    const marker = readRecentSongTextPendingMarker(uid);");
const restoreEnd = app.indexOf("  const persistRegeneratedCurrentSong = async", restoreStart);
assert.ok(restoreStart >= 0 && restoreEnd > restoreStart);
const restoreBlock = app.slice(restoreStart, restoreEnd);
assert.doesNotMatch(restoreBlock, /location\.pathname/, 'pending Recent edit timer must survive route navigation');
assert.match(app, /const isEditPreview = String\(detail\.operation \|\| ''\) === 'edit-preview';/);
assert.match(app, /const localPending = recentSongTextWritePendingRef\.current;/);
assert.match(app, /isSameRecentSongSyncItem\(localPending\.syncItem, incoming\)/);
assert.match(app, /if \(isEditPreview\) \{[\s\S]*?must never fall[\s\S]*?return;[\s\S]*?\}/);

const editStart = app.indexOf('  const saveRecentSongEdit = async');
const editEnd = app.indexOf('  const handleRecentSongTitleInputKeyDown', editStart);
assert.ok(editStart >= 0 && editEnd > editStart);
const editBlock = app.slice(editStart, editEnd);
assert.match(editBlock, /queueRecentSongTextWrite\(user\.uid, nextHistory, 'edit'/);
assert.doesNotMatch(editBlock, /await flushRecentSongTextWrite\(\)/);
assert.doesNotMatch(editBlock, /setDoc\(|updateDoc\(/);

assert.match(sync, /export const publishRecentSongEditPreviewDelta = async/);
assert.match(sync, /operation: 'edit-preview'/);
assert.match(sync, /__recentSongEditPreview: true/);
assert.match(sync, /if \(source\.__recentSongEditPreview === true\)/);
assert.match(boundary, /\| 'edit-preview'/);

// Preserve the already-working Music Note detail batch path: field saves queue a local
// draft and do not directly write favorites.
const detailStart = musicNote.indexOf('  const commitFavoriteDraftIfNeeded = async');
const detailEnd = musicNote.indexOf('  const handleSave = async', detailStart);
assert.ok(detailStart >= 0 && detailEnd > detailStart);
const detailBlock = musicNote.slice(detailStart, detailEnd);
assert.match(detailBlock, /queueFavoriteDetailPatch\(payload\.targetSongId, payload\.updates\)/);
assert.doesNotMatch(detailBlock, /await updateFavorite\(/);

console.log('APP290_RECENT_EDIT_IMMEDIATE_FIRESTORE_W0=PASS');
console.log('APP292_RECENT_EDIT_TRAILING_BATCH_150S=PASS');
console.log('APP290_RECENT_EDIT_LIVE_PREVIEW_RTDB=PASS');
console.log('APP290_RECENT_EDIT_DURABLE_PENDING_MARKER=PASS');
console.log('APP290_RECENT_EDIT_LOCAL_DRAFT_FENCE=PASS');
console.log('APP290_RECENT_EDIT_PREVIEW_RECEIVER_FIRESTORE_R0=PASS');
console.log('APP290_MUSIC_NOTE_DETAIL_BATCH_PRESERVED=PASS');

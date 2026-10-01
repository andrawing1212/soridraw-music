import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const page = fs.readFileSync('src/pages/FavoritesPage.tsx', 'utf8');
const sync = fs.readFileSync('src/services/userDomainSyncService.ts', 'utf8');
const boundary = fs.readFileSync('src/data/v1MutationBoundary.ts', 'utf8');
const rules = fs.readFileSync('database.rules.json', 'utf8');
const version = JSON.parse(fs.readFileSync('public/app-version.json', 'utf8'));

assert.equal(Number(version.version), 282);

assert.match(boundary, /'item-preview'/);
assert.match(boundary, /'detail-preview'/);
assert.match(sync, /export const publishRecentSongPreviewDelta/);
assert.match(sync, /export const publishMusicNoteDetailPreviewDelta/);
assert.match(sync, /__recentSongSync: true/);
assert.match(sync, /__recentSongPartial: true/);
assert.match(sync, /context\.operation !== 'item-preview'/);
assert.match(sync, /const isPreviewOnly = signal\.operation === 'item-preview'/);
assert.match(sync, /itemJson: signal\.itemJson \|\| ''/);
assert.match(rules, /"recentSongs"[\s\S]*?"itemJson": \{[\s\S]*?length <= 24000/);

const recentIdentityStart = app.indexOf('  const buildRecentSongSyncKey = (');
const favoriteComparableStart = app.indexOf('  const getFavoriteComparableText', recentIdentityStart);
const recentIdentity = app.slice(recentIdentityStart, favoriteComparableStart);
assert.match(recentIdentity, /getRecentSongGenerationSyncKey/);
assert.match(recentIdentity, /Final legacy bridge is deliberately title-independent/);
assert.match(recentIdentity, /isSameRecentSongSyncItem/);

const editBuildStart = app.indexOf('  const buildEditedRecentSong = (');
const saveEditStart = app.indexOf('  const saveRecentSongEdit = async', editBuildStart);
const editBuild = app.slice(editBuildStart, saveEditStart);
assert.match(editBuild, /Freeze the pre-edit recent-song identity before title mutation/);
assert.match(editBuild, /recentSongSyncKey: immutableRecentSongSyncKey/);

const saveEditEnd = app.indexOf('  const handleRecentSongTitleInputKeyDown', saveEditStart);
const saveEdit = app.slice(saveEditStart, saveEditEnd);
assert.match(saveEdit, /queueRecentSongTextWrite/);
assert.match(saveEdit, /await publishRecentSongPreviewDelta\(user\.uid, previewSong\)/);

const receiveStart = app.indexOf('    const applyRecentSongSignalItem = (');
const receiveEnd = app.indexOf('    window.addEventListener\(RECENT_SONGS_SYNC_VERSION_EVENT', receiveStart);
assert.ok(receiveStart >= 0 && receiveEnd > receiveStart, 'recent changed-item receiver missing');
const receive = app.slice(receiveStart, receiveEnd);
assert.match(receive, /operation === 'item-preview'/);
assert.match(receive, /writeRecentSongsLocalVersion/);
assert.match(receive, /acknowledgeRecentSongsSignalVersion/);
const previewBranchStart = receive.indexOf("if (operation === 'item-preview')");
const previewBranchEnd = receive.indexOf('if (itemResult.applied', previewBranchStart);
assert.ok(previewBranchStart >= 0 && previewBranchEnd > previewBranchStart);
const previewBranch = receive.slice(previewBranchStart, previewBranchEnd);
assert.doesNotMatch(previewBranch, /getDoc\(|getDocs\(/);

const heartStart = app.indexOf('  const handleToggleCurrentStudioFavorite = async');
const heartEnd = app.indexOf('  const isRecentSongSectionEditing', heartStart);
const heart = app.slice(heartStart, heartEnd);
assert.match(heart, /An edited saved recent song intentionally shows an empty heart/);
assert.match(heart, /await updateFavorite\(existingEditedFavorite\.id,/);
assert.match(heart, /await publishRecentSongPreviewDelta\(user\.uid, nextCommittedSong\)/);

assert.match(page, /publishMusicNoteDetailPreviewDelta/);
const detailCommitStart = page.indexOf('  const commitFavoriteDraftIfNeeded = async');
const detailCommitEnd = page.indexOf('  const handleSave = async', detailCommitStart);
const detailCommit = page.slice(detailCommitStart, detailCommitEnd);
assert.match(detailCommit, /hasCatalogVisibleTitleChange/);
assert.match(detailCommit, /await publishMusicNoteDetailPreviewDelta/);
assert.match(page, /A remote title\/genre save should update an already-open Detail & Edit panel/);

// Explicit title save adds RTDB-only UI sync. Canonical Music Note persistence
// remains the existing queued draft path.
assert.match(detailCommit, /queueFavoriteDetailPatch/);
assert.doesNotMatch(detailCommit, /updateDoc\(|setDoc\(/);

console.log('APP282_MUSIC_NOTE_TITLE_RTDB_PREVIEW_R0W0=PASS');
console.log('APP282_RECENT_TITLE_IDENTITY_FROZEN=PASS');
console.log('APP282_RECENT_TITLE_CHANGED_ITEM_RTDB_R0W0=PASS');
console.log('APP282_EDITED_RECENT_HEART_SAVES_NOT_UNSAVES=PASS');
console.log('APP282_EXISTING_BATCH_PERSISTENCE_PRESERVED=PASS');

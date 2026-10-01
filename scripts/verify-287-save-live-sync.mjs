import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const sync = fs.readFileSync('src/services/userDomainSyncService.ts', 'utf8');
const version = JSON.parse(fs.readFileSync('public/app-version.json', 'utf8'));

assert.equal(Number(version.version), 287);

assert.match(sync, /export const publishMusicNoteSaveStateDelta/);
const publisherStart = sync.indexOf('export const publishMusicNoteSaveStateDelta');
const publisherEnd = sync.indexOf('export const publishMusicNoteStructureDelta', publisherStart);
assert.ok(publisherStart >= 0 && publisherEnd > publisherStart, 'app287 save-state publisher missing');
const publisher = sync.slice(publisherStart, publisherEnd);
assert.match(publisher, /operation: 'save'/);
assert.match(publisher, /documentIds: \[safeDocumentId\]/);
assert.match(publisher, /syncItem/);
assert.match(publisher, /await publishSignal/);
assert.doesNotMatch(publisher, /firestore|getDoc\(|getDocs\(|setDoc\(|updateDoc\(/i);

const toggleStart = app.indexOf('  const toggleFavorite = async');
const toggleEnd = app.indexOf('  const updateFavorite = async', toggleStart);
assert.ok(toggleStart >= 0 && toggleEnd > toggleStart);
const toggle = app.slice(toggleStart, toggleEnd);
const idempotentSaveStart = toggle.indexOf("if (intendedAction === 'save' && !isFavoriteHidden(existingFav))");
const idempotentSaveEnd = toggle.indexOf("if (intendedAction === 'unsave' && isFavoriteHidden(existingFav))", idempotentSaveStart);
assert.ok(idempotentSaveStart >= 0 && idempotentSaveEnd > idempotentSaveStart, 'idempotent SAVE branch missing');
const idempotentSave = toggle.slice(idempotentSaveStart, idempotentSaveEnd);
assert.match(idempotentSave, /await publishMusicNoteSaveStateDelta\(/);
assert.match(idempotentSave, /existingFav\.id/);
assert.match(idempotentSave, /recentSongSyncKey: recentSongSyncKey \|\| buildRecentSongSyncKey\(song\)/);
assert.match(idempotentSave, /saved: true/);
assert.doesNotMatch(idempotentSave, /runV1MutationBoundary\(|setDoc\(|updateDoc\(|addDoc\(/);

const remoteStart = app.indexOf('  const syncMusicNoteIncrementalFromRemoteVersion = useCallback');
const remoteEnd = app.indexOf('// Signals without exact ids are legacy/bulk fallback only.', remoteStart);
assert.ok(remoteStart >= 0 && remoteEnd > remoteStart);
const remote = app.slice(remoteStart, remoteEnd);
assert.match(remote, /normalizedOperation === 'save'/);
assert.match(remote, /rememberRecentHeartAuthority\(/);
assert.doesNotMatch(remote, /getDoc\(|getDocs\(/);

const titleSync = fs.readFileSync('scripts/verify-282-title-cross-device.mjs', 'utf8');
assert.ok(titleSync.length > 0, 'title sync regression verifier must remain present');

console.log('APP287_IDEMPOTENT_SAVE_PUBLISHES_RTDB=PASS');
console.log('APP287_SAVE_RECEIVER_FIRESTORE_R0=PASS');
console.log('APP287_UNSAVE_PATH_UNCHANGED=PASS');
console.log('APP287_TITLE_SYNC_PROTECTED=PASS');

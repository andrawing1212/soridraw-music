import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const sync = fs.readFileSync('src/services/userDomainSyncService.ts', 'utf8');
const version = JSON.parse(fs.readFileSync('public/app-version.json', 'utf8'));

assert.equal(Number(version.version), 289);
assert.match(sync, /const MAX_SYNC_ITEM_JSON_CHARS = 24000/);
assert.match(sync, /const projectMusicNoteItemForSignal = \(/);
assert.match(sync, /JSON\.stringify\(projected\)\.length <= MAX_SYNC_ITEM_JSON_CHARS/);
assert.match(sync, /__musicNoteCompactActiveSync: true/);
assert.match(sync, /return projectMusicNoteItemForSignal\(rawItem, preferredId\)/);

const compactStart = sync.indexOf('const projectMusicNoteItemForSignal = (');
const compactEnd = sync.indexOf('const projectRecentSongForSync = (', compactStart);
assert.ok(compactStart >= 0 && compactEnd > compactStart);
const compactBlock = sync.slice(compactStart, compactEnd);
assert.match(compactBlock, /generationBatchId/);
assert.match(compactBlock, /generationIndex/);
assert.doesNotMatch(compactBlock, /runTransaction\(|getDoc\(|getDocs\(/);

const exactStart = app.indexOf('    const exactDocumentIds = [...new Set(');
const fallbackStart = app.indexOf('// Signals without exact ids are legacy/bulk fallback only.', exactStart);
assert.ok(exactStart >= 0 && fallbackStart > exactStart);
const exactReceive = app.slice(exactStart, fallbackStart);
assert.match(exactReceive, /__musicNoteCompactActiveSync === true && previousItem/);
assert.match(exactReceive, /previousById/);
assert.match(exactReceive, /rememberRecentHeartAuthority\(/);
assert.doesNotMatch(exactReceive, /getDoc\(|getDocs\(|query\(|collection\(/);

const removalStart = sync.indexOf('const projectRemovedMusicNoteIdentityForSync = (');
const removalEnd = sync.indexOf('const toSyncTimestamp = (', removalStart);
assert.ok(removalStart >= 0 && removalEnd > removalStart);
const removalBlock = sync.slice(removalStart, removalEnd);
assert.match(removalBlock, /favoriteRemoved: true/);
assert.match(removalBlock, /saved: false/);

const publishStart = sync.indexOf('const publishSignal = async');
const publishEnd = sync.indexOf('export const publishMusicNoteSaveStateDelta', publishStart);
const publishBlock = sync.slice(publishStart, publishEnd);
assert.match(publishBlock, /runTransaction\(signalRef/);
assert.equal((publishBlock.match(/runTransaction\(signalRef/g) || []).length, 1);

console.log('APP289_OVERSIZED_SAVE_COMPACT_PAYLOAD=PASS');
console.log('APP289_COMPACT_RECEIVER_PRESERVES_EXISTING_KEYWORDS=PASS');
console.log('APP289_EXACT_RECEIVER_FIRESTORE_R0=PASS');
console.log('APP289_UNSAVE_COMPACT_REMOVAL_UNCHANGED=PASS');
console.log('APP289_EXTRA_RTDB_MUTATION_ZERO=PASS');

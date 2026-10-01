import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const sync = fs.readFileSync('src/services/userDomainSyncService.ts', 'utf8');

const applyStart = app.indexOf('    const applyRecentSongSignalItem =');
const applyEnd = app.indexOf('    const handleRecentSongsVersionSignal =', applyStart);
assert.ok(applyStart >= 0 && applyEnd > applyStart);
const applyBlock = app.slice(applyStart, applyEnd);

assert.match(applyBlock, /incoming\.__recentSongEditPreview === true/);
assert.match(applyBlock, /const nextLyricsByLanguage: Record<string, string>/);
assert.match(applyBlock, /nextLyricsByLanguage\.ko = incoming\.lyrics\.korean/);
assert.match(applyBlock, /nextLyricsByLanguage\[secondaryLanguage\] = incoming\.lyrics\.english/);
assert.match(applyBlock, /lyricsByLanguage: nextLyricsByLanguage/);
assert.doesNotMatch(applyBlock, /\b(?:getDoc|getDocs|setDoc|updateDoc|addDoc|deleteDoc)\s*\(/);

const previewStart = sync.indexOf('export const publishRecentSongEditPreviewDelta = async');
const previewEnd = sync.indexOf('export const publishMusicNoteSaveStateDelta', previewStart);
assert.ok(previewStart >= 0 && previewEnd > previewStart);
const previewBlock = sync.slice(previewStart, previewEnd);
assert.match(previewBlock, /operation: 'edit-preview'/);
assert.match(previewBlock, /publishSignal/);
assert.doesNotMatch(previewBlock, /\b(?:getDoc|getDocs|setDoc|updateDoc|addDoc|deleteDoc)\s*\(/);

console.log('APP291_RECENT_LYRICS_PREVIEW_LOCAL_LANGUAGE_MAP=PASS');
console.log('APP291_RECENT_LYRICS_PREVIEW_EXTRA_RTDB_WRITE_ZERO=PASS');
console.log('APP291_RECENT_LYRICS_PREVIEW_FIRESTORE_R0_W0=PASS');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildStudioHeartPreviewItem } from '../src/lib/studioHeartPreviewPayload.js';

const service = readFileSync('src/services/userDomainSyncService.ts', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
// Reproduce the existing Catalog active-only gate: a preview or tombstone
// must be rejected by the normal Catalog projector.
const projectActive = (row, id) => {
  if (row.__studioHeartRemotePreview || row.favoriteRemoved || row.__studioHeartPendingLocal) return null;
  const { title, koreanTitle, englishTitle, genre, appliedKeywords,
    soridrawSongId, recentSongSyncKey } = row;
  return { __catalogSummary: true, id, firestoreId: id, title,
    koreanTitle, englishTitle, genre, appliedKeywords, soridrawSongId, recentSongSyncKey };
};
const song = {
  title: '저승사자와 처녀귀신', koreanTitle: '저승사자와 처녀귀신',
  genre: 'Classic City Pop',
  prompt: '[Genre] Classic City Pop\n[Vocals] duet',
  lyrics: { korean: '한 걸음만 더 기다려\n아직 할 말이 남았어', english: '' },
  userInput: '저승사자와 귀신의 대화',
  situationSummary: '밤의 이별',
  appliedKeywords: { generationBatchId: 'batch-1', generationIndex: 2,
    genres: ['City Pop'], titlesByLanguage: { ko: '저승사자와 처녀귀신' },
    lyricsByLanguage: { ko: '한 걸음만 더 기다려' } },
  recentSongSyncKey: 'recent-1', soridrawSongId: 'song-1',
};
const id = 'favorite-1';
assert.equal(projectActive({ ...song, __studioHeartRemotePreview: true }, id), null);
const save = buildStudioHeartPreviewItem({
  ...song, saved: true, __studioHeartRemotePreview: true,
}, id, projectActive);
assert.ok(save);
assert.equal(save.title, song.title);
assert.equal(save.genre, song.genre);
assert.equal(save.prompt, song.prompt);
assert.deepEqual(save.lyrics, song.lyrics);
assert.deepEqual(save.appliedKeywords, song.appliedKeywords);
assert.equal(save.userInput, song.userInput);
assert.equal(save.situationSummary, song.situationSummary);
assert.equal(save.__catalogSummary, false);
assert.equal(save.__studioHeartRemotePreview, true);
assert.equal(save.favoriteRemoved, false);
assert.equal(save.__studioHeartDetailPartial, undefined);

const unsave = buildStudioHeartPreviewItem({
  ...song, saved: false, favoriteRemoved: true,
  __studioHeartRemotePreview: true, favoriteRemovedAt: 1234,
}, id, projectActive);
assert.ok(unsave);
assert.equal(unsave.title, song.title);
assert.equal(unsave.saved, false);
assert.equal(unsave.favoriteRemoved, true);
assert.equal(unsave.favoriteRemovedAt, 1234);
assert.equal(unsave.prompt, song.prompt);
assert.equal(unsave.lyrics.korean, song.lyrics.korean);

const onlyLanguageTitle = buildStudioHeartPreviewItem({
  ...song, title: '', koreanTitle: '',
}, id, projectActive);
assert.equal(onlyLanguageTitle.title, song.title);

const huge = buildStudioHeartPreviewItem({
  ...song, lyrics: { korean: '가'.repeat(30000) },
}, id, projectActive);
assert.ok(huge);
assert.ok(JSON.stringify(huge).length <= 24000);
assert.equal(huge.title, song.title);
assert.equal(huge.__studioHeartDetailPartial, true);
assert.equal(huge.__studioHeartRemotePreview, true);

// The actual RTDB producer passes the untouched Studio song through ONE
// bounded projector. It must not re-project a marker as a removed Catalog row.
assert.match(service, /if \(source\.__studioHeartRemotePreview === true\)/);
assert.match(service, /buildStudioHeartPreviewItem\(source, id, projectMusicNoteItemForSignal, MAX_SYNC_ITEM_JSON_CHARS\)/);
assert.match(service, /const projected = \{\s*\.\.\.source,\s*id: safeDocumentId,\s*firestoreId: safeDocumentId,/);
assert.match(service, /operation: desiredSaved \? 'heart-preview-save' : 'heart-preview-unsave'/);
assert.match(service, /syncItem: item,/);
// No timing or canonical boundary change: every same-song click reschedules
// the same 30-second timer and net-zero settles without a Firestore write.
assert.match(app, /const STUDIO_HEART_BATCH_MS = 30_000/);
assert.match(app, /scheduleStudioHeartPendingIntent\(safeDocumentId\)/);
assert.match(app, /if \(intent.desiredSaved === intent.baselineSaved\)/);
assert.match(app, /applyRemoteStudioHeartPreview\(/);
console.log('STUDIO_HEART_FULL_TITLE_DETAIL_BOTH_DIRECTIONS=PASS');
console.log('STUDIO_HEART_30S_CANONICAL_AND_R0_RECEIVER_CONTRACT=PASS');

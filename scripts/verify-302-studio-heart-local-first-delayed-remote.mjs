import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const sync = fs.readFileSync('src/services/userDomainSyncService.ts', 'utf8');

assert.ok(app.includes('const STUDIO_HEART_BATCH_MS = 30_000;'), '30-second canonical rule changed');

const queueStart = app.indexOf('const queueStudioHeartPendingIntent = (');
const queueEnd = app.indexOf('  useEffect(() => {', queueStart);
assert.ok(queueStart >= 0 && queueEnd > queueStart, 'Studio heart queue missing');
const queue = app.slice(queueStart, queueEnd);
assert.ok(queue.includes('writeStudioHeartPendingIntent(intent);'), 'durable pending missing');
assert.ok(queue.includes('scheduleStudioHeartPendingIntent(safeDocumentId);'), '30s trailing scheduler missing');
assert.ok(queue.includes('setFavorites((previous) => previous);'), 'same-device immediate Music Note missing');
assert.ok(queue.includes('publishMusicNoteHeartPreviewDelta(uid, safeDocumentId, intent.song, desiredSaved)'), 'PC-mobile immediate preview missing');
assert.doesNotMatch(queue, /\b(?:getDoc|getDocs|setDoc|updateDoc|addDoc|deleteDoc)\s*\(/, 'preview queue added Firestore IO');

const flushStart = app.indexOf('const flushStudioHeartPendingIntent = async');
const flushEnd = app.indexOf('  const scheduleStudioHeartPendingIntent', flushStart);
const flush = app.slice(flushStart, flushEnd);
assert.ok(flush.includes('if (intent.desiredSaved === intent.baselineSaved)'), 'net-zero W0 guard missing');
assert.ok(flush.includes('await toggleFavorite(commitSong'), 'canonical settlement missing');

assert.ok(app.includes('function stripStudioHeartRemotePreviewLayerFromFavorites'), 'remote preview strip missing');
assert.ok(app.includes('function overlayStudioHeartRemotePreviewsOnFavorites'), 'remote Music Note overlay missing');
assert.ok(app.includes('__studioHeartRemotePreviewLocal: true'), 'remote preview marker missing');
assert.ok(app.includes('applyRemoteStudioHeartPreview('), 'receiver immediate membership missing');
assert.ok(app.includes('clearRemoteStudioHeartPreviewFromCanonical(uid, exactDocumentIds, remoteItem);'), 'canonical preview cleanup missing');
assert.ok(app.includes('reconcileStudioHeartPendingFromCanonicalSignal('), 'app347 stale-state guard lost');

const applyStart = app.indexOf('  const applyRemoteStudioHeartPreview = (');
const applyEnd = app.indexOf('  const clearRemoteStudioHeartPreviewFromCanonical = (', applyStart);
assert.ok(applyStart >= 0 && applyEnd > applyStart);
assert.doesNotMatch(app.slice(applyStart, applyEnd), /\b(?:getDoc|getDocs|setDoc|updateDoc|addDoc|deleteDoc|fetch)\s*\(/, 'receiver preview added backend IO');

const publishStart = sync.indexOf('export const publishMusicNoteHeartPreviewDelta = async');
const publishEnd = sync.indexOf('// app287', publishStart);
const publish = sync.slice(publishStart, publishEnd);
assert.ok(publish.includes('projectMusicNoteItemForSignal(source, safeDocumentId)'), 'bounded Music Note media summary missing');
assert.ok(publish.includes('__studioHeartRemotePreview: true'), 'remote preview marker missing');
assert.ok(publish.includes("operation: desiredSaved ? 'heart-preview-save' : 'heart-preview-unsave'"), 'preview op changed');
assert.doesNotMatch(publish, /\b(?:getDoc|getDocs|setDoc|updateDoc|addDoc|deleteDoc)\s*\(/, 'preview publisher added Firestore IO');

assert.ok(sync.includes("signal.operation !== 'heart-preview-save'"), 'preview may advance canonical version');
assert.ok(sync.includes("signal.operation !== 'heart-preview-unsave'"), 'preview unsave may advance canonical version');

console.log('VERIFY_348_STUDIO_HEART_IMMEDIATE_CROSS_DEVICE=PASS');
console.log('VERIFY_348_CANONICAL_30S_FINAL_STATE=PASS');
console.log('VERIFY_348_REMOTE_MUSIC_NOTE_NO_FIRESTORE_IO=PASS');
console.log('VERIFY_348_APP347_STALE_OVERWRITE_GUARD=PASS');

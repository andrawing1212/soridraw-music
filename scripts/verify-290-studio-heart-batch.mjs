import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const sync = fs.readFileSync('src/services/userDomainSyncService.ts', 'utf8');
const batch = fs.readFileSync('src/lib/studioHeartBatch.ts', 'utf8');

assert.match(app, /const STUDIO_HEART_BATCH_MS = 30_000;/);
assert.match(app, /const STUDIO_HEART_RETRY_MS = 60_000;/);
assert.match(app, /queueStudioHeartPendingIntent/);
assert.match(app, /flushStudioHeartPendingIntent/);
assert.match(app, /listStudioHeartPendingIntents\(uid\)/);
assert.match(app, /canonicalBaseline: \{/);
assert.match(app, /if \(intent\.desiredSaved === intent\.baselineSaved\) \{\s*removeStudioHeartPendingIntent/s);
assert.match(app, /publishMusicNoteHeartPreviewDelta\(uid, safeDocumentId, intent\.song, desiredSaved\)/);
assert.match(app, /normalizedOperation === 'heart-preview-save'/);
assert.match(app, /normalizedOperation === 'heart-preview-unsave'/);
assert.match(app, /writeMusicNoteSyncVersion\(MUSIC_NOTE_RTDB_ACK_VERSION_STORAGE_BASE, uid, remoteVersion\);/);

const queueStart = app.indexOf('  const queueStudioHeartPendingIntent = (');
const queueEnd = app.indexOf('\n\n  useEffect(() => {', queueStart);
assert.ok(queueStart >= 0 && queueEnd > queueStart);
const queueBlock = app.slice(queueStart, queueEnd);
assert.doesNotMatch(queueBlock, /setDoc\(|updateDoc\(|addDoc\(|deleteDoc\(|getDoc\(|getDocs\(/);

const handlerStart = app.indexOf('  const handleToggleCurrentStudioFavorite = async');
const handlerEnd = app.indexOf('\n\n  const isRecentSongSectionEditing', handlerStart);
assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
const handlerBlock = app.slice(handlerStart, handlerEnd);
assert.match(handlerBlock, /batchDocumentId/);
assert.match(handlerBlock, /queueStudioHeartPendingIntent\(/);
assert.match(handlerBlock, /return;/);

const publishStart = sync.indexOf('export const publishMusicNoteHeartPreviewDelta = async');
const publishEnd = sync.indexOf('// app287', publishStart);
assert.ok(publishStart >= 0 && publishEnd > publishStart);
const publishBlock = sync.slice(publishStart, publishEnd);
assert.match(publishBlock, /operation: desiredSaved \? 'heart-preview-save' : 'heart-preview-unsave'/);
assert.match(publishBlock, /return publishSignal/);
assert.doesNotMatch(publishBlock, /\b(?:getDoc|getDocs|setDoc|updateDoc|addDoc|deleteDoc)\s*\(/);

const dispatchStart = sync.indexOf('const dispatchSignal =');
const dispatchEnd = sync.indexOf('let activeUid', dispatchStart);
const dispatchBlock = sync.slice(dispatchStart, dispatchEnd);
assert.match(dispatchBlock, /signal\.operation !== 'heart-preview-save'/);
assert.match(dispatchBlock, /signal\.operation !== 'heart-preview-unsave'/);

assert.match(batch, /soridraw_studio_heart_pending_v1/);
assert.match(batch, /baselineSaved: boolean/);
assert.match(batch, /desiredSaved: boolean/);
assert.match(batch, /signalVersion: number/);
assert.match(batch, /pendingRemotePreviewVersion: number/);

console.log('APP290_STUDIO_HEART_LOCAL_FIRST_PREVIEW=PASS');
console.log('APP290_STUDIO_HEART_CANONICAL_30S_BATCH=PASS');
console.log('APP290_STUDIO_HEART_NET_ZERO_W0_GUARD=PASS');
console.log('APP290_STUDIO_HEART_DURABLE_OUTBOX=PASS');
console.log('APP290_STUDIO_HEART_PREVIEW_NO_FIRESTORE_IO=PASS');

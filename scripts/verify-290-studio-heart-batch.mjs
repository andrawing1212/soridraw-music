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
assert.match(app, /suppressSuccessToast: true/);
assert.match(app, /const batchBlockedByLock = Boolean\(baselineFavorite\?\.isLocked\)/);
assert.match(app, /if \(previousRetryCount < 2\)/);
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
assert.match(publishBlock, /const identityOnly: Record<string, unknown> = \{/);
assert.match(publishBlock, /generationBatchId/);
assert.match(publishBlock, /generationIndex/);
assert.doesNotMatch(publishBlock, /\.\.\.\(syncItem as Record<string, unknown>\)/);
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


// A complete Catalog can be empty (revision 0) on a new account. The first
// Studio SAVE still needs its existing deterministic ID and immediate RTDB
// preview; an unverified/outdated Catalog must never mint a duplicate row.
const firstSaveGate = handlerBlock.match(/const canDeriveFirstSaveId = Boolean\(([\s\S]*?)\);/)?.[1];
assert.ok(firstSaveGate, 'deterministic first-save gate must remain in Studio');
const canFirstSave = new Function('stableBatchIdentity','remoteMusicNoteVersion','localMusicNoteVersion',
  'musicNoteFullCatalogReadyUids','hasMusicNotePayloadCache','user',
  'return Boolean('+firstSaveGate+');');
const fullCatalog = { has: uid => uid === 'owner-A' };
const noCatalog = { has: () => false };
const owner = { uid: 'owner-A' };
assert.equal(canFirstSave('new-song',0,0,fullCatalog,()=>false,owner),true,
  'a verified complete empty Catalog may publish a first-save preview');
assert.equal(canFirstSave('new-song',0,0,noCatalog,()=>true,owner),false,
  'unverified empty local cache must not create a guessed favorite');
assert.equal(canFirstSave('new-song',100,101,noCatalog,()=>true,owner),true,
  'legacy warm synced account retains prior deterministic preview');
assert.equal(canFirstSave('new-song',102,101,fullCatalog,()=>true,owner),false,
  'a newer remote mutation must prevent speculative first-save ID');
assert.equal(canFirstSave('',0,0,fullCatalog,()=>true,owner),false,
  'missing stable song identity must never create guessed favorite');
console.log('APP_RECENT_HEART_FIRST_SAVE_EMPTY_VERIFIED_CATALOG_IMMEDIATE_R0=PASS');


// Preview receipt is not canonical settlement. A later device's preview
// must not delete this device's durable pending heart without Firestore proof.
const previewReceiptBlock=app.slice(
  app.indexOf('  const rememberStudioHeartPreviewVersion = ('),
  app.indexOf('  const persistRecentHeartAuthority =',app.indexOf('  const rememberStudioHeartPreviewVersion = (')),
);
const flushBlock=app.slice(
  app.indexOf('  const flushStudioHeartPendingIntent = async'),
  app.indexOf('  const scheduleStudioHeartPendingIntent =',app.indexOf('  const flushStudioHeartPendingIntent = async')),
);
assert.doesNotMatch(previewReceiptBlock,/removeStudioHeartIntentLocal\(/,
  'RTDB-only preview must never delete an uncommitted favorite outbox');
assert.doesNotMatch(flushBlock,/removeStudioHeartPendingIntent\(uid, safeDocumentId\)/,
  'newer uncommitted RTDB preview must never discard a local pending outbox');
assert.match(flushBlock,/intent\.pendingRemotePreviewVersion > intent\.signalVersion/);
assert.match(flushBlock,/return;/);
assert.match(flushBlock,/await toggleFavorite\(commitSong,/,
  'ordinary +30s canonical commit path must be preserved');
assert.match(queueBlock,/publishMusicNoteHeartPreviewDelta\(uid, safeDocumentId, intent\.song, desiredSaved\)/);
console.log('APP_HEART_PREVIEW_CANNOT_ERASE_UNCOMMITTED_OUTBOX=PASS');

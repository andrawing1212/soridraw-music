import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const sync = fs.readFileSync('src/services/userDomainSyncService.ts', 'utf8');

assert.ok(app.includes('const STUDIO_HEART_BATCH_MS = 30_000;'), '30-second Studio heart rule changed');

const queueStart = app.indexOf('const queueStudioHeartPendingIntent = (');
const queueEnd = app.indexOf('  useEffect(() => {', queueStart);
assert.ok(queueStart >= 0 && queueEnd > queueStart, 'Studio heart queue missing');
const queue = app.slice(queueStart, queueEnd);

assert.ok(queue.includes('writeStudioHeartPendingIntent(intent);'), 'durable pending intent missing');
assert.ok(queue.includes('scheduleStudioHeartPendingIntent(safeDocumentId);'), '30-second trailing scheduler missing');
assert.ok(queue.includes('setFavorites((previous) => previous);'), 'initiating-device Music Note optimistic refresh missing');
assert.ok(!queue.includes('publishMusicNoteHeartPreviewDelta'), 'pre-canonical RTDB heart preview still published');

const flushStart = app.indexOf('const flushStudioHeartPendingIntent = async');
const flushEnd = app.indexOf('  const scheduleStudioHeartPendingIntent', flushStart);
const flush = app.slice(flushStart, flushEnd);
assert.ok(flush.includes('if (intent.desiredSaved === intent.baselineSaved)'), 'net-zero final-state W0 guard missing');
assert.ok(flush.includes('await toggleFavorite(commitSong'), 'canonical favorite settlement missing');
assert.ok(flush.includes("intendedAction: intent.desiredSaved ? 'save' : 'unsave'"), 'final click does not control canonical intent');

assert.ok(app.includes('function overlayStudioHeartPendingIntentsOnFavorites'), 'local Music Note pending overlay missing');
assert.ok(app.includes('__studioHeartPendingLocal: true'), 'pending local marker missing');
assert.ok(app.includes("if (favorite?.__studioHeartPendingLocal === true) return false;"), 'server merge can mistake pending row for canonical newer data');

const importRegion = app.slice(0, app.indexOf('const SORIDRAW_EXPLORE_8C_THEME_STATUS_FINAL_951'));
assert.ok(!importRegion.includes('publishMusicNoteHeartPreviewDelta'), 'App still imports pre-canonical heart preview publisher');

assert.ok(sync.includes('addV1MutationPostSuccessHook(async (context, result) => {'), 'post-canonical mutation signal hook missing');
assert.ok(sync.includes('await publishSignal(context, result);'), 'canonical mutation does not publish normal RTDB signal');

console.log('VERIFY_302_STUDIO_HEART_LOCAL_FIRST_DELAYED_REMOTE=PASS');

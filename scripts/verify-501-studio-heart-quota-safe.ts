import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  readStudioHeartPendingIntent,
  writeStudioHeartPendingIntent,
  writeStudioHeartPendingIntentChecked,
  type StudioHeartPendingIntent,
} from '../src/lib/studioHeartBatch';

const values = new Map<string, string>();
let quotaFull = false;
const quota = Object.assign(new Error('quota exceeded'), { name: 'QuotaExceededError' });
const storageMock = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => {
    if (quotaFull) throw quota;
    values.set(key, value);
  },
  removeItem: (key: string) => values.delete(key),
};
const savedGlobal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storageMock });

const makeIntent = (documentId: string, desiredSaved = true, time = Date.now()): StudioHeartPendingIntent => ({
  schemaVersion: 1,
  uid: 'app501-test-account',
  documentId,
  identityKey: 'recent-id:' + documentId,
  baselineSaved: false,
  desiredSaved,
  baselineFavorite: null,
  song: { title: 'A preserved recent song', id: documentId },
  updatedAtMs: time,
  signalVersion: 0,
  pendingRemotePreviewVersion: 0,
  retryCount: 0,
});

try {
  const healthy = makeIntent('healthy');
  assert.equal(writeStudioHeartPendingIntentChecked(healthy), 'stored');
  assert.equal(readStudioHeartPendingIntent(healthy.uid, healthy.documentId)?.desiredSaved, true);
  console.log('APP501_HEALTHY_STUDIO_HEART_BATCH_STILL_DURABLE=PASS');

  quotaFull = true;
  const firstSave = makeIntent('storage-full-new');
  assert.equal(writeStudioHeartPendingIntentChecked(firstSave), 'blocked-empty',
    'quota blocked a first save, so App must use its direct one-row canonical save path');
  assert.equal(readStudioHeartPendingIntent(firstSave.uid, firstSave.documentId), null);
  console.log('APP501_QUOTA_BLOCKED_NEW_SAVE_CANNOT_CLAIM_PENDING_SUCCESS=PASS');

  const changedHealthy = makeIntent('healthy', false, healthy.updatedAtMs + 1);
  assert.equal(writeStudioHeartPendingIntentChecked(changedHealthy), 'blocked-existing',
    'a failed replacement cannot compete with its earlier pending canonical timer');
  assert.equal(readStudioHeartPendingIntent(healthy.uid, healthy.documentId)?.desiredSaved, true,
    'original queued mutation must remain durable');
  console.log('APP501_QUOTA_BLOCKED_OLD_PENDING_PRESERVED=PASS');

  quotaFull = false;
  assert.equal(writeStudioHeartPendingIntentChecked(changedHealthy), 'stored');
  assert.equal(readStudioHeartPendingIntent(healthy.uid, healthy.documentId)?.desiredSaved, false);
  console.log('APP501_RECOVERED_STORAGE_PRESERVES_30S_BATCH=PASS');

  const app = readFileSync('src/App.tsx','utf8');
  const queue = app.slice(app.indexOf('const queueStudioHeartPendingIntent ='),app.indexOf('  useEffect(() => {',app.indexOf('const queueStudioHeartPendingIntent =')));
  assert.ok(queue.includes("const durableIntentResult = writeStudioHeartPendingIntentChecked(intent);"));
  assert.match(queue,/durableIntentResult === 'blocked-existing'[\s\S]*?throw new Error\('STUDIO_HEART_PENDING_STORAGE_BLOCKED_WITH_EXISTING'\)/);
  assert.match(queue,/durableIntentResult === 'blocked-empty'[\s\S]*?return false;/);
  assert.ok(queue.indexOf('durableIntentResult ===') < queue.indexOf('scheduleStudioHeartPendingIntent(safeDocumentId)'),
    'only an independently verified durable write may enter the 30-second queue');
  assert.ok(queue.indexOf('durableIntentResult ===') < queue.indexOf('publishMusicNoteHeartPreviewDelta('),
    'never broadcast saved membership without either a durable queue or canonical write');
  const heart = app.slice(app.indexOf('const handleToggleCurrentStudioFavorite ='),app.indexOf('  const ',app.indexOf('const handleToggleCurrentStudioFavorite =')+60));
  assert.match(heart,/if \(queueStudioHeartPendingIntent\([\s\S]*?\)\) \{[\s\S]*?return;/,
    'successful batch alone may short-circuit, quota-blocked fresh saves must continue to direct favorite path');
  assert.ok(heart.includes("await toggleFavorite(heartSnapshot as SongResult"),
    'existing one-song canonical saving path must remain as the fallback');
  assert.ok(app.includes("브라우저 저장 공간이 부족하여 이번 하트 변경을 저장하지 못했습니다."),
    'conflicting pending failure must be disclosed rather than returning a false saved toast');
  console.log('APP501_APP_RECENT_TO_MUSIC_NOTE_FALLBACK_CONTRACT=PASS');
  console.log('SORIDRAW_APP501_STUDIO_HEART_QUOTA_SAFE=PASS');
} finally {
  if (savedGlobal) Object.defineProperty(globalThis,'localStorage',savedGlobal);
  else delete (globalThis as any).localStorage;
}

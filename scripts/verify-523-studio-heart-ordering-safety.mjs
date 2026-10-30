import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const helperSource = readFileSync('src/lib/studioHeartCanonical523.ts', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const batch = readFileSync('src/lib/studioHeartBatch.ts', 'utf8');
const signal = readFileSync('src/services/userDomainSyncService.ts', 'utf8');

assert.match(app, /const STUDIO_HEART_BATCH_MS = 1_000/);
assert.match(app, /commitStudioHeartCanonical523\(\{/);
assert.match(app, /previewVersion: intent\.signalVersion/);
assert.match(app, /studioHeartCommitInFlightRef\.current\.has/);
assert.match(app, /baselineSaved: studioHeartCommitInFlightRef\.current\.has/);
assert.doesNotMatch(app.slice(app.indexOf("const flushStudioHeartPendingIntent = async"), app.indexOf("const scheduleStudioHeartPendingIntent =", app.indexOf("const flushStudioHeartPendingIntent = async"))),
  /updateStudioHeartPendingIntent\(uid, safeDocumentId/);
assert.match(app, /latestRemotePreview523\.version > canonicalPreviewVersion523/);
assert.match(app, /canonicalPreviewVersion < pending\.signalVersion/);
assert.match(signal, /projected\.studioHeartPreviewVersion = canonicalVersion/);
assert.match(signal, /studioHeartPreviewVersion: canonicalVersion/);
assert.match(signal, /studioHeartPreviewVersion: Math\.floor\(Number\(source\.studioHeartPreviewVersion\)\)/);
assert.match(batch, /writeStudioHeartPendingIntentChecked/);

const rows = new Map();
const versions = new Map();
let readCount = 0;
let writeCount = 0;
let pauseOlder = false;
let releaseOlder = () => {};
let olderBlocked = Promise.resolve();
let didPauseOlder = false;
const clone = x => x == null ? x : JSON.parse(JSON.stringify(x));
const firestore = {
  doc: (_db, col, id) => ({ key: col + '/' + id }),
  serverTimestamp: () => ({ server: true }),
  runTransaction: async (_db, callback) => {
    for (let attempt = 0; attempt < 7; attempt++) {
      const baseVersions = new Map();
      const writes = [];
      const tx = {
        get: async ref => {
          readCount++;
          const value = clone(rows.get(ref.key));
          baseVersions.set(ref.key, versions.get(ref.key) || 0);
          return { exists: () => value !== undefined, data: () => value };
        },
        set: (ref, patch, opts) => {
          assert.equal(opts.merge, true);
          writes.push({ key: ref.key, patch: clone(patch) });
        },
      };
      const result = await callback(tx);
      if (pauseOlder && !didPauseOlder && writes.some(x => x.patch.studioHeartPreviewVersion === 101)) {
        didPauseOlder = true;
        await olderBlocked;
      }
      if ([...baseVersions].some(([key, rev]) => (versions.get(key) || 0) !== rev)) continue;
      for (const write of writes) {
        rows.set(write.key, { ...(rows.get(write.key) || {}), ...write.patch });
        versions.set(write.key, (versions.get(write.key) || 0) + 1);
        writeCount++;
      }
      return result;
    }
    throw Error('TRANSACTION_RETRIES_EXHAUSTED');
  },
};
const compiled = ts.transpileModule(helperSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const exports = {};
vm.runInNewContext(compiled, {
  exports,
  require: name => name === 'firebase/firestore' ? firestore
    : name === '../firebase' ? { db: {} } : {},
  Number, Math, Date, Error, Promise,
}, { filename: 'studioHeartCanonical523.ts' });
const commit = exports.commitStudioHeartCanonical523;
assert.equal(typeof commit, 'function');
const args = (version, saved, id = 'song-1') => ({
  uid: 'user-1', documentId: id, previewVersion: version,
  desiredSaved: saved,
  creationPayload: { uid: 'user-1', title: 'untouched title',
    prompt: 'untouched prompt', lyrics: { ko: 'untouched lyrics' }, sunoCoverUrl: 'old-cover',
    createdAtMs: 55 },
});
await assert.rejects(commit(args(0, true)), /STUDIO_HEART_PREVIEW_ORDER_NOT_READY/);
assert.equal(readCount, 0);
assert.equal(writeCount, 0);
console.log('APP523_UNORDERED_PREVIEW_FAIL_CLOSED_R0W0=PASS');

// Newer UNSAVE commits before older SAVE: older request MUST NOT revive the song.
await commit(args(202, false));
const afterNewer = clone(rows.get('favorites/song-1'));
assert.equal(afterNewer.favoriteRemoved, true);
const written = writeCount;
const stale = await commit(args(101, true));
assert.equal(stale.outcome, 'superseded');
assert.equal(writeCount, written);
assert.equal(rows.get('favorites/song-1').saved, false);
console.log('APP523_NEWER_UNSAVE_TOMBSTONE_BLOCKS_OLD_SAVE=PASS');

// Firestore transaction retry handles an older SAVE that started first
// but finishes after a newer UNSAVE on a different device.
rows.delete('favorites/race');
versions.delete('favorites/race');
pauseOlder = true;
didPauseOlder = false;
olderBlocked = new Promise(resolve => { releaseOlder = resolve; });
const early = commit(args(101, true, 'race'));
for (let i = 0; i < 100 && !didPauseOlder; i++) await new Promise(resolve => setImmediate(resolve));
assert.equal(didPauseOlder, true);
await commit(args(202, false, 'race'));
releaseOlder();
const oldResult = await early;
assert.equal(oldResult.outcome, 'superseded');
assert.equal(rows.get('favorites/race').saved, false);
assert.equal(rows.get('favorites/race').studioHeartPreviewVersion, 202);
pauseOlder = false;
console.log('APP523_TWO_DEVICE_INVERTED_ACK_TRANSACTION_RETRY=PASS');

// Preserve old song metadata/media and creation timestamp on re-save.
// No fresh snapshot or old pending row may clobber the user's original.
rows.set('favorites/existing', {
  uid: 'user-1', saved: false, favoriteRemoved: true,
  title: 'original title', lyrics: { ko: 'original lyric' },
  prompt: 'original prompt', sunoCoverUrl: 'original-cover',
  createdAtMs: 77, studioHeartPreviewVersion: 10,
});
versions.set('favorites/existing', 1);
const restored = await commit(args(300, true, 'existing'));
assert.equal(restored.outcome, 'written');
assert.equal(rows.get('favorites/existing').title, 'original title');
assert.equal(rows.get('favorites/existing').lyrics.ko, 'original lyric');
assert.equal(rows.get('favorites/existing').prompt, 'original prompt');
assert.equal(rows.get('favorites/existing').sunoCoverUrl, 'original-cover');
assert.equal(rows.get('favorites/existing').createdAtMs, 77);
assert.equal(rows.get('favorites/existing').favoriteRemoved, false);
console.log('APP523_ORIGINAL_CONTENT_AND_MEDIA_PRESERVED=PASS');

// If a local pending entry is written during an in-flight commit, its
// baseline is forced opposite to the newest click *before* checked storage.
// No finalizer attempts a quota-unsafe rewrite or mistaken net-zero.
const queue = app.slice(app.indexOf('  const queueStudioHeartPendingIntent = ('),
  app.indexOf('  useEffect(() => {', app.indexOf('  const queueStudioHeartPendingIntent = (')));
assert.match(queue, /writeStudioHeartPendingIntentChecked\(intent\)/);
assert.match(queue, /baselineSaved: studioHeartCommitInFlightRef\.current\.has/);
assert.match(queue, /\? !desiredSaved : \(existing \? existing\.baselineSaved : baselineSaved\)/);
console.log('APP523_INFLIGHT_CLICK_DURABLE_BEFORE_ACK_NO_QUOTA_REBASE=PASS');

assert.equal(writeCount > 0, true);
console.log('APP523_EXACT_DOCUMENT_NO_COLLECTION_SCAN=PASS');

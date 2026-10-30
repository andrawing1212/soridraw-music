import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const app = readFileSync('src/App.tsx', 'utf8');
const fromTo = (from, to) => {
  const start = app.indexOf(from);
  const end = app.indexOf(to, start);
  assert.ok(start >= 0 && end > start, 'missing block: ' + from);
  return app.slice(start, end);
};
assert.match(app, /const STUDIO_HEART_BATCH_MS = 1_000;/);
assert.doesNotMatch(app, /const STUDIO_HEART_BATCH_MS = 30_000;/);
assert.doesNotMatch(app, /supersedeStudioHeartIntentFromRemotePreview/);
const receiver = fromTo("if (isHeartPreview) {", "if (remoteItem || removed || isRemovalOperation) {");
assert.match(receiver, /applyRemoteStudioHeartPreview/);
assert.doesNotMatch(receiver, /removeStudioHeartPendingIntent|removeStudioHeartIntentLocal/);
const flushSource = fromTo('  const flushStudioHeartPendingIntent = async', '  const scheduleStudioHeartPendingIntent = (');
assert.doesNotMatch(flushSource, /if \(intent\.signalVersion <= 0 && intent\.pendingRemotePreviewVersion > 0\)/);
assert.match(flushSource, /studioHeartCommitInFlightRef\.current\.has\(commitKey\)/);
assert.match(flushSource, /commitStudioHeartCanonical523\(/);
assert.doesNotMatch(flushSource, /baselineSaved: committed \?/);

const source = [
  'const STUDIO_HEART_BATCH_MS = 1_000;',
  'const STUDIO_HEART_RETRY_MS = 60_000;',
  fromTo('  const rememberStudioHeartPreviewVersion = (', '  const persistRecentHeartAuthority = ('),
  flushSource,
  fromTo('  const scheduleStudioHeartPendingIntent = (', '  const queueStudioHeartPendingIntent = ('),
  fromTo('  const queueStudioHeartPendingIntent = (', '  useEffect(() => {'),
  'globalThis.testApi = {rememberStudioHeartPreviewVersion,flushStudioHeartPendingIntent,scheduleStudioHeartPendingIntent,queueStudioHeartPendingIntent};',
].join('\n');
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  reportDiagnostics: true,
});
assert.equal((js.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);

const uid = 'owner-one';
let clock = 10_000;
let seq = 0;
const timers = new Map();
const handles = new Map();
const pending = new Map();
const calls = [];
let canonicalSaved = false;
let holdNext = null;
let failNext = false;
const ref = { current: new Map() };
const timerRef = { current: handles };
const cleanTimer = id => {
  const timer = handles.get(id);
  if (timer !== undefined) timers.delete(timer);
  handles.delete(id);
};
const updateIntent = (_uid, id, updater) => {
  const old = pending.get(id);
  if (!old) return null;
  const next = updater(old);
  if (!next) { pending.delete(id); return null; }
  pending.set(id, next);
  return next;
};
const ctx = {
  console, Math, Promise, Number, String,
  Date: { now: () => clock },
  user: { uid },
  studioHeartCommitInFlightRef: ref,
  studioHeartIntentTimersRef: timerRef,
  clearStudioHeartIntentTimer: cleanTimer,
  readStudioHeartPendingIntent: (_uid, id) => pending.get(id) || null,
  updateStudioHeartPendingIntent: updateIntent,
  removeStudioHeartIntentLocal: (_uid, id) => pending.delete(id),
  removeStudioHeartPendingIntent: (_uid, id) => pending.delete(id),
  writeStudioHeartPendingIntent: item => { pending.set(item.documentId, item); return item; },
  writeStudioHeartPendingIntentChecked: item => { pending.set(item.documentId, item); return 'stored'; },
  normalizeFavoriteTitleFields: x => x,
  buildRecentSongSyncKey: x => x.id,
  getLiveSoridrawSongId: x => x.id,
  rememberRecentHeartAuthority: () => {},
  setFavorites: () => {},
  publishMusicNoteHeartPreviewDelta: async () => 50,
  window: {
    setTimeout: (fn, delay) => {
      const n = ++seq;
      timers.set(n, { fn, delay });
      return n;
    },
    clearTimeout: n => timers.delete(n),
  },
  commitStudioHeartCanonical523: async (opts) => {
    calls.push(opts.desiredSaved ? 'save' : 'unsave');
    if (holdNext) {
      const waiting = holdNext;
      holdNext = null;
      await waiting;
    }
    if (failNext) {
      failNext = false;
      throw Error('offline');
    }
    canonicalSaved = opts.desiredSaved;
    return { outcome: 'written', membershipChanged: true, saved: canonicalSaved };
  },
  sanitizeForFirestore: x => x,
  getLiveSoridrawSongId: x => x.id,
  buildLegacyRecentFavoriteBridge: () => ({}),
  getResolvedGenre: () => 'folk',
  buildFavoriteIdentityKey: x => x.id,
  buildFavoriteSearchTokens: () => [],
  serverTimestamp: () => 0,
  runV1MutationBoundary: async (_context, write) => await write,
  forgetFavoriteDeletedTombstones: () => {},
  rememberFavoriteDeletedTombstones: () => {},
  queueMusicNoteFavoriteCountDelta: () => {},
};
vm.runInNewContext(js.outputText, ctx, { filename: 'app522-studio-heart-extracted.ts' });
const api = ctx.testApi;
assert.ok(api && typeof api.flushStudioHeartPendingIntent === 'function');
const song = id => ({ id, title: 'test-' + id });
const queue = (id, desiredSaved, baselineSaved = false) =>
  api.queueStudioHeartPendingIntent(song(id), id, desiredSaved, baselineSaved, null);
const nextDelay = id => {
  const handle = handles.get(id);
  return timers.get(handle)?.delay;
};

// One second per-song debounce; canonical W1 after successful settlement.
assert.equal(queue('A', true), true);
assert.equal(nextDelay('A'), 1_000);
assert.equal(calls.length, 0, 'RTDB preview must not write Firestore');
await api.flushStudioHeartPendingIntent('A');
assert.deepEqual(calls, ['save']);
assert.equal(pending.has('A'), false);
assert.equal(canonicalSaved, true);
console.log('APP522_1S_CANONICAL_EXACT_SONG_W1=PASS');

// Save->unsave inside one second stays W0, not two writes.
clock += 10;
queue('B', true);
clock += 10;
queue('B', false);
assert.equal(nextDelay('B'), 1_000);
await api.flushStudioHeartPendingIntent('B');
assert.deepEqual(calls, ['save']);
assert.equal(pending.has('B'), false);
console.log('APP522_NET_ZERO_NO_CANONICAL_WRITE=PASS');

// RTDB preview can be newer than own preview, but is never a canonical ACK.
// Legacy persisted pendingRemotePreviewVersion must not suppress settlement.
clock += 10;
queue('C', true);
const beforeC = pending.get('C');
pending.set('C', { ...beforeC, signalVersion: 0, pendingRemotePreviewVersion: 700 });
api.rememberStudioHeartPreviewVersion(uid, 'C', 60, true, beforeC.updatedAtMs);
assert.equal(pending.has('C'), true);
assert.equal(pending.get('C').signalVersion, 60);
await api.flushStudioHeartPendingIntent('C');
assert.deepEqual(calls, ['save', 'save']);
assert.equal(pending.has('C'), false);
console.log('APP522_UNCONFIRMED_RTDB_CANNOT_DROP_PENDING=PASS');

// If a new click occurs while an older canonical write is in flight, serialize
// and rebase it on the committed result. Save->unsave must not become false W0.
clock += 10;
queue('D', true);
let release;
holdNext = new Promise(resolve => { release = resolve; });
const first = api.flushStudioHeartPendingIntent('D');
assert.equal(ref.current.size, 1);
clock += 10;
queue('D', false);
await api.flushStudioHeartPendingIntent('D');
assert.equal(calls.filter(x => x === 'unsave').length, 0);
release();
await first;
assert.equal(ref.current.size, 0);
assert.equal(pending.get('D').baselineSaved, true, 'new click must be rebased after first commit');
await api.flushStudioHeartPendingIntent('D');
assert.deepEqual(calls.slice(-2), ['save', 'unsave']);
assert.equal(canonicalSaved, false);
assert.equal(pending.has('D'), false);
console.log('APP522_INFLIGHT_ORDER_NEWEST_CLICK_WINS=PASS');

// Network failure retains the exact pending action and bounded old retry.
// A failed commit must not erase the record or misreport success.
clock += 10;
queue('E', true);
failNext = true;
await api.flushStudioHeartPendingIntent('E');
assert.equal(pending.has('E'), true);
assert.equal(pending.get('E').retryCount, 1);
assert.equal(nextDelay('E'), 60_000);
console.log('APP522_FAILURE_PRESERVES_DURABLE_PENDING_AND_RETRY=PASS');

// A late RTDB click-order ACK must replace a deferred 60s timer, without
// issuing extra canonical writes before the one-second retry.
clock += 20;
pending.set('F', {
  ...pending.get('E'),
  documentId: 'F', identityKey: 'F', desiredSaved: true,
  baselineSaved: false, song: { id: 'F', title: 'F' },
  signalVersion: 0, pendingRemotePreviewVersion: 0,
  retryCount: 0, updatedAtMs: clock,
});
api.scheduleStudioHeartPendingIntent('F');
failNext = true;
await api.flushStudioHeartPendingIntent('F');
assert.equal(nextDelay('F'), 60_000);
const expectedAckTime = pending.get('F').updatedAtMs;
clock += 1_500;
api.rememberStudioHeartPreviewVersion(uid, 'F', 999, true, expectedAckTime);
assert.equal(pending.get('F').signalVersion, 999);
assert.equal(nextDelay('F'), 1_000);
console.log('APP524_LATE_RTDB_ACK_RESCHEDULES_1S_NOT_60S=PASS');

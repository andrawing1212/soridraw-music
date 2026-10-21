import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { gitBlob } from './prepare-450-backend-release.mjs';

assert.equal(process.argv.slice(2).length, 2, 'GUEST_PR380_ROOT FUNCTION_PR381_ROOT required');
const [guestRoot, functionRoot] = process.argv.slice(2).map(p => resolve(p));
function loadTS(file, mocks, globals = {}) {
  const source = readFileSync(file, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => {
    assert.ok(Object.hasOwn(mocks, name), 'Unexpected import ' + name); return mocks[name];
  }, ...globals }, { filename: file });
  return exports;
}
const handlerFile = join(functionRoot, 'functions/src/masterSplitFrameMode450.ts');
assert.equal(gitBlob(readFileSync(handlerFile)), '9081be5aecd8b8f91b6414137836a627b7105d90');
let reads = 0, writes = 0, current = null;
const pending = [];
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
const admin = {
  firestore: () => ({ collection: (collection) => { assert.equal(collection, 'users'); return { doc: uid => ({
    get: async () => { reads++; return { data: () => ({ staffRole: uid.startsWith('master') ? 'master' : 'admin' }) }; },
  }) }; } }),
  database: () => ({ ref: path => { assert.equal(path, 'publicSync/splitFrameModes/preview'); return {
    set: mode => { writes++; return new Promise(resolve => pending.push(() => { current = mode; resolve(); })); },
  }; } }),
};
const fn = loadTS(handlerFile, {
  'firebase-admin': admin,
  'firebase-functions/v2/https': { HttpsError, onCall: (options, handler) => { assert.equal(options.region, 'us-central1'); return handler; } },
}, { process: { env: {} } }).masterSetSplitFrameMode;
const req = (uid, mode = 'pure-pane', environment = 'preview', origin = 'https://preview.soridraw.com') => ({
  auth: uid ? { uid } : null, data: { mode, environment }, rawRequest: { headers: { origin } },
});
await assert.rejects(fn(req(null)), e => e.code === 'unauthenticated'); assert.equal(reads, 0);
await assert.rejects(fn(req('admin')), e => e.code === 'permission-denied'); assert.equal(reads, 1); assert.equal(writes, 0);
for (const env of ['test', 'production']) {
  await assert.rejects(fn(req('masterA', 'pure-pane', env, env === 'test' ? 'https://test.soridraw.com' : 'https://soridraw.com')),
    e => e.code === 'failed-precondition');
}
await assert.rejects(fn(req('masterA', 'bad-mode')), e => e.code === 'invalid-argument');
await assert.rejects(fn(req('masterA', 'pure-pane', 'test')), e => e.code === 'permission-denied');
assert.equal(writes, 0);
console.log('PASS actual PR381 handler with mocked SDK: guest/Admin denied; default TEST/PRODUCTION writes denied');
const a = fn(req('masterA', 'pure-pane')), b = fn(req('masterB', 'local-responsive'));
await new Promise(setImmediate);
assert.equal(pending.length, 2); assert.equal(writes, 2);
pending[1](); await b; assert.equal(current, 'local-responsive');
pending[0](); const aAck = await a; assert.equal(current, 'pure-pane');
assert.equal(aAck.mode, 'pure-pane');
console.log('PASS two Master calls: one scalar write each; last server write wins, not client click timestamp');

const events = () => { const listeners = new Map(); return {
  addEventListener: (event, fn) => { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(fn); },
  removeEventListener: (event, fn) => listeners.get(event)?.delete(fn),
  emit: event => listeners.get(event)?.forEach(fn => fn()),
}; };
const window = { ...events(), location: { hostname: 'preview.soridraw.com' } };
const document = { ...events(), visibilityState: 'visible' };
const policy = loadTS(join(guestRoot, 'src/constants/splitFrameGlobal.ts'), {}, { window });
const streams = []; let cancellations = 0;
const serviceFile = join(guestRoot, 'src/services/navigationVisibilitySyncService.ts');
assert.equal(gitBlob(readFileSync(serviceFile)), 'ff682c1cade0e1ccf7fd09495c1c671e2a67204d');
const svc = loadTS(serviceFile, {
  'firebase/database': { ref: (_, path) => path, onValue: (path, value, error) => {
    streams.push({ path, value, error }); return () => { cancellations++; };
  } },
  '../firebase': { realtimeDb: {} }, '../constants/splitFrameGlobal': policy,
  '../constants/navigationVisibility': { normalizeNavigationVisibilitySettings: x => x },
}, { window, document });
let delivered;
const stopLocal = svc.subscribeSplitFrameMode(mode => { delivered = mode; });
const stopGuest = svc.subscribeSplitFrameRealtime();
const stopSignedIn = svc.subscribeNavigationVisibilitySync(() => {});
const frame = () => streams.filter(s => s.path.includes('splitFrameModes'));
assert.equal(frame().length, 1); assert.equal(svc.isSplitFrameServerReady(), false);
frame()[0].value({ val: () => 'pure-pane' }); assert.equal(delivered, 'pure-pane');
frame()[0].value({ val: () => 'local-responsive' }); assert.equal(delivered, 'local-responsive');
// A delayed callable ACK is intentionally not delivered to this transport.
assert.equal(aAck.mode, 'pure-pane'); assert.equal(svc.readCurrentSplitFrameMode(), 'local-responsive');
stopGuest(); assert.equal(cancellations, 0);
frame()[0].error(Error('permission cancelled')); assert.equal(svc.isSplitFrameServerReady(), false);
window.emit('online'); assert.equal(frame().length, 2);
assert.equal(svc.isSplitFrameServerReady(), false);
frame()[1].value({ val: () => 'local-responsive' }); assert.equal(svc.isSplitFrameServerReady(), true);
window.emit('online'); document.emit('visibilitychange'); assert.equal(frame().length, 2);
console.log('PASS actual PR379 service with mocked transport: guest/auth share one stream, cancellation blocks readiness, event recovery without polling');
// Record the real remaining limitation instead of pretending ordinary socket
// disconnection invokes onValue's permission-cancellation callback.
window.emit('offline');
if (svc.isSplitFrameServerReady()) {
  console.log('LIMITATION ordinary offline event leaves serverReady=true; no .info/connected listener. Physical recovery NOT proven');
}
stopSignedIn(); stopLocal(); assert.equal(svc.isSplitFrameServerReady(), false);
window.emit('online'); assert.equal(frame().length, 2);
window.location.hostname = 'unknown.invalid'; svc.subscribeSplitFrameRealtime(); assert.equal(frame().length, 2);
console.log('PASS last unsubscribe stops transport/retry; unknown host starts no listener');
console.log('450_RUNTIME_FIXTURES=PASS; PHYSICAL_OFFLINE_AND_STALE_INTENT=UNVERIFIED');

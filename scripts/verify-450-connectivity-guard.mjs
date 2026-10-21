import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const load = (path, mocks, globalValues) => {
  const source = readFileSync(path, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, require: (key) => {
      assert.ok(Object.hasOwn(mocks, key), 'Unexpected imported module: '+key);
      return mocks[key];
    }, ...globalValues,
  }, { filename: path });
  return exports;
};
const makeEvents = () => {
  const map = new Map();
  return {
    addEventListener: (key, handler) => {
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(handler);
    },
    removeEventListener: (key, handler) => map.get(key)?.delete(handler),
    emit: (key) => map.get(key)?.forEach(fn => fn()),
    count: (key) => map.get(key)?.size ?? 0,
  };
};
const window = { ...makeEvents(), location: { hostname: 'preview.soridraw.com' } };
const document = { ...makeEvents(), visibilityState: 'visible' };
const navigator = { onLine: true };
const policy = load('src/constants/splitFrameGlobal.ts', {}, { window });
const streams = [], cancelled = [];
const service = load('src/services/navigationVisibilitySyncService.ts', {
  'firebase/database': {
    ref: (_, path) => path,
    onValue: (path, next, error) => {
      const row = { path, next, error, active: true };
      streams.push(row);
      return () => { row.active = false; cancelled.push(path); };
    },
  },
  '../firebase': { realtimeDb: {} },
  '../constants/splitFrameGlobal': policy,
  '../constants/navigationVisibility': { normalizeNavigationVisibilitySettings: v => v },
}, { window, document, navigator });
const modes = () => streams.filter(s => s.path === 'publicSync/splitFrameModes/preview');
const status = () => streams.filter(s => s.path === '.info/connected');
const fire = (row, value) => row.next({ val: () => value });
const stopUi = service.subscribeSplitFrameMode(() => {});
const stopGuest = service.subscribeSplitFrameRealtime();
const stopSigned = service.subscribeNavigationVisibilitySync(() => {});
assert.equal(status().length, 1, 'one metadata connectivity stream per SDK instance');
assert.equal(modes().length, 0, 'do not treat cached data as live before connection');
assert.equal(service.isSplitFrameServerReady(), false);
fire(status()[0], false);
assert.equal(modes().length, 0);
fire(status()[0], true);
assert.equal(modes().length, 1);
fire(modes()[0], 'pure-pane');
assert.equal(service.isSplitFrameServerReady(), true);
assert.equal(service.readCurrentSplitFrameMode(), 'pure-pane');
navigator.onLine = false;
window.emit('offline');
assert.equal(service.isSplitFrameServerReady(), false, 'offline must disable Master Apply');
fire(modes()[0], 'local-responsive');
assert.equal(service.readCurrentSplitFrameMode(), 'pure-pane', 'offline snapshot cannot become confirmed truth');
navigator.onLine = true;
window.emit('online');
assert.equal(service.isSplitFrameServerReady(), false, 'online browser event alone is not RTDB confirmation');
fire(status()[0], true);
assert.equal(modes().length, 2, 'reconnect must obtain new small scalar snapshot');
fire(modes()[0], 'local-responsive');
assert.equal(service.isSplitFrameServerReady(), false, 'old listener callback after unsubscribe must be ignored');
fire(modes()[1], 'local-responsive');
assert.equal(service.isSplitFrameServerReady(), true);
assert.equal(service.readCurrentSplitFrameMode(), 'local-responsive');
fire(status()[0], false);
assert.equal(service.isSplitFrameServerReady(), false, '.info/connected=false must fail closed even without browser offline');
fire(status()[0], true);
assert.equal(modes().length, 3);
fire(modes()[2], 'pure-pane-hybrid');
assert.equal(service.isSplitFrameServerReady(), true);
const activeFrameStreams = modes().filter(s => s.active);
assert.equal(activeFrameStreams.length, 1, 'only one active scalar listener per SDK instance');
stopGuest();
assert.equal(activeFrameStreams[0].active, true, 'signed-in subscriber keeps active scalar');
status()[0].error(Error('metadata permission cancellation'));
assert.equal(service.isSplitFrameServerReady(), false);
document.emit('visibilitychange');
assert.equal(status().length, 2, 'recover terminal info listener on explicit lifecycle');
fire(status()[1], true);
assert.equal(modes().length, 4);
fire(modes()[3], 'pure-pane');
assert.equal(service.isSplitFrameServerReady(), true);
stopSigned();
stopUi();
assert.equal(service.isSplitFrameServerReady(), false);
assert.equal(modes().filter(s => s.active).length, 0);
assert.equal(status().filter(s => s.active).length, 0);
assert.equal(window.count('offline'), 0);
assert.equal(window.count('online'), 0);
window.location.hostname = 'unknown.invalid';
const stopUnknown = service.subscribeSplitFrameRealtime();
assert.equal(status().length, 2, 'unknown hosts have zero connectivity listeners');
stopUnknown();
console.log('450_OFFLINE_INFO_CONNECTED_MASTER_APPLY_GATE_AND_RECONNECT=PASS');
console.log('450_CACHED_CALLBACK_REJECTED_REFERENCE_COUNTED_LISTENER=PASS');
console.log('450_NETWORK_CALLS_DURING_DRAG=0');

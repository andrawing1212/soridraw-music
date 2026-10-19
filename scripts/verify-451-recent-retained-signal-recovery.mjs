import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync('src/lib/recentSongsSyncGate.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const sandbox = { exports: {} };
vm.runInNewContext(compiled.outputText, sandbox);
const { canAcknowledgeRecentSongsInlineSignal: canAck, needsRecentSongsServerRead: needsRead } = sandbox.exports;
assert.equal(typeof canAck, 'function');

const live = { itemApplied: true, itemPartial: false, signalVersion: 110, initialRetained: false };
assert.equal(canAck(live), true, 'active subscribed exact-item edit keeps read-zero path');
assert.equal(canAck({ ...live, initialRetained: true }), false,
  'last retained item must not ACK missed closed-device mutations');
assert.equal(canAck({ ...live, itemPartial: true }), false,
  'partial updates are not complete aggregate snapshots');
assert.equal(canAck({ ...live, itemApplied: false }), false,
  'unknown changed item cannot certify complete membership');
assert.equal(needsRead({
  hasLocalCache: true, profileVersion: 10, localDocumentVersion: 10,
  pendingSignalVersion: 110, acknowledgedSignalVersion: 100,
}), true, 'retained advanced signal requires bounded canonical catch-up');
assert.equal(needsRead({
  hasLocalCache: true, profileVersion: 10, localDocumentVersion: 10,
  pendingSignalVersion: 110, acknowledgedSignalVersion: 110,
}), false, 'healthy unchanged app reopen adds no reads');

const rtdb = fs.readFileSync('src/services/userDomainSyncService.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
assert.match(rtdb, /let firstRecentSnapshot = true/);
assert.match(rtdb, /const initialRetained = firstRecentSnapshot/);
assert.match(rtdb, /dispatchSignal\(safeUid, 'recentSongs', signal, initialRetained\)/);
assert.match(rtdb, /originDeviceId === getDeviceId\('recentSongs'\) && !initialRetained/);
assert.match(rtdb, /itemJson: signal.itemJson \|\| '',\s*initialRetained/);
assert.match(app, /canAcknowledgeRecentSongsInlineSignal\(\{[\s\S]{0,230}initialRetained: detail.initialRetained === true/);
assert.match(app, /hasUnconfirmedSongMissingFromServer\(user.uid, firestoreSongs\)/);
assert.match(app, /recentReadMutationEpoch !== readRecentSongsMutationEpoch\(user.uid\)/);
assert.doesNotMatch(app, /localStorage.clear\(\)|indexedDB.deleteDatabase/);
console.log('APP435_RECENT_RETAINED_SINGLE_ITEM_GAP_REQUIRES_CATCHUP=PASS');
console.log('APP435_RECENT_HEALTHY_WARM_CACHE_ZERO_READ=PASS');
console.log('APP435_RECENT_PENDING_DATA_PRESERVED=PASS');

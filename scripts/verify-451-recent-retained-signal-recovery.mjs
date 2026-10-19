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
const { canAcknowledgeRecentSongsInlineSignal: canAck, needsRecentSongsServerRead: needsRead,
  needsRecentSongsRetainedDraftGapRead460: needsGap } = sandbox.exports;
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

// Offline fixture: B becomes canonical version 11 while this phone is
// closed; A emits a later edit-preview and overwrites the single retained
// RTDB node. Phone's cached profile/document are still at version 10.
// The unseen retained signal forces exactly one settled aggregate gap read,
// without ACKing A's unsettled edit or reading on live preview changes.
const baseline = {
  hasLocalCache:true, profileVersion:10, localDocumentVersion:10,
  pendingSignalVersion:0, acknowledgedSignalVersion:0,
};
assert.equal(needsRead(baseline),false,'stale profile alone cannot detect offline B');
assert.equal(needsGap(4000,0),true,'unseen A retained preview reveals potential missing B');
assert.equal(needsRead(baseline) || needsGap(4000,0),true,
 'offline A retained event triggers one safe canonical B recovery');
assert.equal(needsGap(4000,4000),false,'verified same retained draft costs R0 on reload');
assert.equal(needsRead(baseline) || needsGap(4000,4000),false,
 'unchanged warm revisit requires no Firestore read');
assert.equal(needsGap(4001,4000),true,'a newly retained signal can trigger a new bounded check');
// Once the aggregate containing settled B N+1 is verified, the canonical
// document revision can advance even while A is still a separate text draft.
// Otherwise each route revisit sees stale local N and repeatedly reads B.
const recoveredBWhileADraftPending = {
  ...baseline, profileVersion:11, localDocumentVersion:11,
};
assert.equal(needsRead(recoveredBWhileADraftPending) || needsGap(4000,4000), false,
 'verified B revision plus separate unsettled A draft must reopen at R0');
assert.equal(needsRead({ ...recoveredBWhileADraftPending, profileVersion:12 }), true,
 'genuinely newer canonical B2 revision must still trigger catch-up');
assert.equal(needsGap(0,0),false,'no retained signal means no read');
assert.equal(canAck({ itemApplied:true,itemPartial:false,signalVersion:4000,initialRetained:true }),
 false,'retained draft may never ACK complete song history');

const rtdb = fs.readFileSync('src/services/userDomainSyncService.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
assert.match(rtdb, /let firstRecentSnapshot = true/);
assert.match(rtdb, /const initialRetained = firstRecentSnapshot/);
assert.match(rtdb, /dispatchSignal\(safeUid, 'recentSongs', signal, initialRetained\)/);
assert.match(rtdb, /originDeviceId === getDeviceId\('recentSongs'\) && !initialRetained/);
assert.match(rtdb, /itemJson: signal.itemJson \|\| '',\s*initialRetained/);
assert.match(app, /canAcknowledgeRecentSongsInlineSignal\(\{[\s\S]{0,230}initialRetained: detail.initialRetained === true/);
assert.match(rtdb, /if \(initialRetained\) rememberRecentSongsRetainedDraftGap460\(uid, signal\.version\)/);
assert.match(app, /const unverifiedRetainedGap = needsRecentSongsRetainedDraftGapRead460\(/);
assert.match(app, /const needsServerRead = unverifiedRetainedGap \|\| needsRecentSongsServerRead\(/);
assert.match(app, /if \(cachedSuccessfully && retainedGapAtRead > 0\) \{\s*verifyRecentSongsRetainedDraftGap460\(user\.uid, retainedGapAtRead\)/);
const versionGuardSource = app.match(/if \(cachedSuccessfully && documentVersion > 0\) \{[\s\S]{0,700}writeRecentSongsLocalVersion\(user\.uid, documentVersion\);[\s\S]{0,15}\}/)?.[0];
assert.ok(versionGuardSource, 'must persist recovered B before recording canonical version');
const versionWrite = new Function('cachedSuccessfully','documentVersion','user',
  'writeRecentSongsLocalVersion',versionGuardSource);
const recorded = [];
const capture = (uid,version) => recorded.push([uid,version]);
versionWrite(false,11,{uid:'phone'},capture);
assert.equal(recorded.length,0,'device cache write failure must not ACK version 11');
versionWrite(true,11,{uid:'phone'},capture);
assert.equal(recorded.length,1,'durable recovered B records version 11 once');
assert.equal(recorded[0][1],11);
versionWrite(true,0,{uid:'phone'},capture);
assert.equal(recorded.length,1,'unknown/absent canonical revision must not advance');
assert.equal(needsRead({...baseline,profileVersion:11,localDocumentVersion:10})
  || needsGap(4000,0),true,'failed durable write retains recovery opportunity');
assert.equal(needsRead({...baseline,profileVersion:11,localDocumentVersion:11})
  || needsGap(4000,4000),false,'persisted B and verified retained gap reopen with R0');
assert.match(app, /if \(cachedSuccessfully && readSignalVersion > 0\) \{/,
 'confirmed signal pending at this read can ACK independently of an unrelated draft');
assert.match(app, /if \(detail\.initialRetained === true[\s\S]{0,300}runRecentSongsServerSyncIfNeeded\(\)/);
assert.ok(app.includes('if (isEditPreview) {'), 'preview-only consumer remains active');

assert.match(app, /hasUnconfirmedSongMissingFromServer\(user.uid, firestoreSongs\)/);
assert.match(app, /recentReadMutationEpoch !== readRecentSongsMutationEpoch\(user.uid\)/);
assert.doesNotMatch(app, /localStorage.clear\(\)|indexedDB.deleteDatabase/);
// Preview-only RTDB events cannot certify Firestore content even on their
// originating device. First retained draft is a bounded gap-recovery signal.
assert.ok(rtdb.includes("if (initialRetained) rememberRecentSongsRetainedDraftGap460(uid, signal.version);"),
 'initial retained draft carries bounded one-time recovery marker, not a canonical ACK');
assert.match(app, /if \(isEditPreview\) \{[\s\S]{0,1200}needsRecentSongsRetainedDraftGapRead460\([\s\S]{0,220}runRecentSongsServerSyncIfNeeded\(\);[\s\S]{0,100}return;/);
console.log('APP460_RET_INITIAL_DRAFT_A_RECOVERS_SETTLED_B_ONCE=PASS');
console.log('APP435_RECENT_PREVIEW_NOT_CANONICAL_ACK=PASS');
console.log('APP435_RECENT_RETAINED_SINGLE_ITEM_GAP_REQUIRES_CATCHUP=PASS');
console.log('APP435_RECENT_HEALTHY_WARM_CACHE_ZERO_READ=PASS');
console.log('APP435_RECENT_PENDING_DATA_PRESERVED=PASS');

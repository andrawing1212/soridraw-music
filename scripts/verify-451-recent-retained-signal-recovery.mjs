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

const live = { itemApplied: true, itemPersisted: true, itemPartial: false, signalVersion: 110, initialRetained: false };
assert.equal(canAck(live), true, 'active subscribed exact-item edit keeps read-zero path');
assert.equal(canAck({...live,itemPersisted:false}),false,
 'visible inline change cannot ACK if its local cache write failed');
assert.equal(canAck({...live,itemPersisted:true}),true,
 'durable changed-item cache still acknowledges without aggregate read');
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
assert.match(app,/const cachedSuccessfully = saveRecentSongsCache\(user\.uid, \{\s*history: nextHistory,/,
 'live changed-row receiver must inspect local cache persistence result');
assert.match(app,/return \{ applied: true, cachedSuccessfully, partial: incoming\.__recentSongPartial === true \};/,
 'live UI can update immediately while exposing a separate durable cache bit');
assert.match(app,/itemPersisted: itemResult\.cachedSuccessfully,/,
 'inline gate must use the real cache persistence result');
const buildAppliedResult=app.match(/return \{ applied: true, cachedSuccessfully, partial: incoming\.__recentSongPartial === true \};/)?.[0];
assert.ok(buildAppliedResult);
const returnInline=new Function('cachedSuccessfully','incoming',buildAppliedResult);
const failedVisible=returnInline(false,{__recentSongPartial:false});
const durableVisible=returnInline(true,{__recentSongPartial:false});
assert.equal(failedVisible.applied,true,'incoming text remains immediately visible');
assert.equal(failedVisible.cachedSuccessfully,false,'a failed disk write must not be disguised as an ACK');
assert.equal(canAck({...live,itemApplied:failedVisible.applied,itemPersisted:failedVisible.cachedSuccessfully}),false,
 'failed saved-title scenario: disk OLD, received NEW, no local version/ACK advance');
assert.equal(canAck({...live,itemApplied:durableVisible.applied,itemPersisted:durableVisible.cachedSuccessfully}),true,
 'when disk NEW is durable, the same RTDB event may ACK without an aggregate read');
const afterFailedStore={hasLocalCache:true,profileVersion:11,localDocumentVersion:10,
 pendingSignalVersion:11,acknowledgedSignalVersion:10};
assert.equal(needsRead(afterFailedStore),true,
 'after failed inline cache write, a future app restart must still fetch version 11');

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

// app436 executable bounded recovery: NEVER recreate a deleted/ambiguous
// local-only track, yet allow one provably newer generated row to fill 9 -> 10.
const recoverySource436 = fs.readFileSync('src/lib/recentUnconfirmedRecovery436.ts', 'utf8');
const recoveryCompiled436 = ts.transpileModule(recoverySource436, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const recoverySandbox436 = { exports: {} };
vm.runInNewContext(recoveryCompiled436.outputText, recoverySandbox436);
const plan436 = recoverySandbox436.exports.planRecentUnconfirmedRecovery436;
assert.equal(typeof plan436, 'function');
const sid436 = item => item?.soridrawSongId || null;
const remote436 = Array.from({length:9},(_,i)=>({soridrawSongId:'sid-'+i, title:'old-'+i, createdAt:100+i}));
const new436 = {soridrawSongId:'sid-new',title:'new-only-local',createdAt:250};
const full436 = [new436,...remote436];
const planned436 = plan436(remote436,full436,['sid-new'],200,sid436);
assert.ok(planned436,'9 canonical + one known new generated item should be recoverable');
assert.equal(planned436.songs.length,10);
assert.equal(planned436.recovered.length,1);
assert.equal(planned436.songs[0].soridrawSongId,'sid-new');
assert.equal(plan436(remote436,full436,[],200,sid436),null,
  'a cache-only song without generation-time marker is NOT proof of authorization');
assert.equal(plan436(remote436,full436,['sid-new'],300,sid436),null,
  'newer canonical revision might represent deliberate delete: never resurrect');
assert.equal(plan436(remote436,remote436,['sid-new'],200,sid436),null,
  'marker without the actual local only-copy is not eligible');
assert.equal(plan436([...remote436,new436],full436,['sid-new'],200,sid436),null,
  'server already contains exact generated song: no second write');
assert.equal(plan436(remote436,[{...new436,createdAt:0},...remote436],['sid-new'],200,sid436),null,
  'missing generated timestamp is not trusted');
assert.equal(plan436([...remote436,{soridrawSongId:'extra',createdAt:150}],
 full436,['sid-new'],200,sid436),null,'never evict the tenth canonical row');
assert.equal(plan436(remote436,[{...new436,soridrawSongId:'wrong'},...remote436],
 ['sid-new'],200,sid436),null,'mismatched UID-local identity is not sufficient');
assert.equal(plan436(remote436,full436,['sid-new'],0,sid436),null,
  'absent canonical revision is not deletion-safe');
assert.match(app,/if \(!unconfirmedIds\.length\) return;/,
  'healthy Studio cache must not start a transaction');
assert.match(app,/recentUnconfirmedRecoveryAttemptedUids436\.add\(uid\)/,
  'pending-only recovery must be bounded once per session');
assert.match(app,/planRecentUnconfirmedRecovery436\(/);
assert.match(app,/transaction\.set\(recentRef, sanitizeForFirestore\(/,
  'a verified plan must be atomically committed');
assert.match(app,/acknowledgeRecentGeneratedSongs\(uid, recovered\.songs\)/,
  'only a committed recovery can remove local pending marker');
assert.doesNotMatch(recoverySource436,/localStorage\.clear|indexedDB\.deleteDatabase|collection\(/);

// If phone repairs the 10th row while PC is waiting out its 150s title edit,
// PC's later canonical write must preserve the newly recovered row and never
// roll back the target's confirmed heart/lock/media fields.
const textPatch436 = recoverySandbox436.exports.patchExactRecentTextRow436;
assert.equal(typeof textPatch436, 'function');
const canonicalTen436 = full436.map((song,i) => i === 1
  ? {...song,title:'old-title',updatedAtMs:200,liked:true,isPublic:true,
     isLocked:true,coverUrl:'new-cover',appliedKeywords:{genre:['pop'],editedInStudioAt:200}}
  : song);
const stalePCEdit436 = {...canonicalTen436[1],title:'PC edited title',updatedAtMs:260,
  liked:false,isPublic:false,isLocked:false,coverUrl:'old-cover',
  appliedKeywords:{genre:['wrong-stale'],editedInStudioAt:260,lyricsByLanguage:{ko:'new lyrics'}}};
const patched436 = textPatch436(canonicalTen436,stalePCEdit436,sid436);
assert.equal(patched436.length,10,'9-row PC text snapshot cannot evict mobile recovered tenth');
assert.equal(patched436[0].soridrawSongId,'sid-new','recovered only-copy must remain');
assert.equal(patched436[1].title,'PC edited title');
assert.equal(patched436[1].liked,true,'older PC heart must not overwrite canonical membership');
assert.equal(patched436[1].isPublic,true,'older PC publication state must not override canonical');
assert.equal(patched436[1].isLocked,true,'older PC lock must not override canonical');
assert.equal(patched436[1].coverUrl,'new-cover','older PC media must not override canonical');
assert.equal(patched436[1].appliedKeywords.genre[0],'pop','old PC generation recipe must not override canonical');
assert.equal(patched436[1].appliedKeywords.lyricsByLanguage.ko,'new lyrics',
  'text language patch stays scoped to edited song');
assert.equal(textPatch436(canonicalTen436,{...stalePCEdit436,updatedAtMs:100,
  appliedKeywords:{...stalePCEdit436.appliedKeywords,editedInStudioAt:100}},sid436),null,
 'stale edit must not outrank a newer canonical revision');
assert.equal(textPatch436(canonicalTen436,{...stalePCEdit436,soridrawSongId:'missing'},sid436),null,
 'unknown exact song cannot recreate deleted rows');
assert.equal(textPatch436([canonicalTen436[1],canonicalTen436[1]],stalePCEdit436,sid436),null,
 'duplicate canonical identity fails closed');
assert.match(app, /persistRecentSongsDocument\(ref, pending\.songs, pending\.mutationEpoch, pending\.syncItem\)/);
assert.match(app, /const merged = patchExactRecentTextRow436\(/);
console.log('APP436_STALE_150S_PC_EDIT_CANNOT_ERASE_RECOVERED_TENTH=PASS');
console.log('APP436_TEXT_PATCH_PRESERVES_PUBLIC_HEART_LOCK_MEDIA=PASS');

console.log('APP436_RECENT_ONLY_COPY_REPAIR_9_TO_10_EXECUTABLE=PASS');
console.log('APP436_RECENT_DELETE_OR_STALE_MARKER_NEVER_RESURRECTS=PASS');
console.log('APP436_HEALTHY_STUDIO_REVISIT_EXTRA_FIRESTORE_READ_ZERO=PASS');

console.log('APP460_RET_INITIAL_DRAFT_A_RECOVERS_SETTLED_B_ONCE=PASS');
console.log('APP435_RECENT_PREVIEW_NOT_CANONICAL_ACK=PASS');
console.log('APP435_RECENT_RETAINED_SINGLE_ITEM_GAP_REQUIRES_CATCHUP=PASS');
console.log('APP435_RECENT_HEALTHY_WARM_CACHE_ZERO_READ=PASS');
console.log('APP435_RECENT_PENDING_DATA_PRESERVED=PASS');

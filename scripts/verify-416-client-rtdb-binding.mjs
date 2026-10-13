import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reserveExploreLikeDeviceSequence416 as allocate} from
  '../src/services/exploreLikeDeviceSequence416.mjs';
const uid='account', id='00000000-0000-4000-8000-000000000014';
const map=new Map(),storage={getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v)};
let queue=Promise.resolve(),ids=0;
const locks={request:(_name,_opts,fn)=>{
  const step=queue.then(fn);queue=step.then(()=>{},()=>{});return step;
}};
const values=await Promise.all(Array.from({length:80},()=>allocate(uid,storage,locks,()=>{ids++;return id;})));
assert.equal(ids,1);
assert.equal(new Set(values.map(v=>v.deviceSequence)).size,80);
assert.deepEqual(values.map(x=>x.deviceSequence).sort((a,b)=>a-b),Array.from({length:80},(_,i)=>i+1));
assert.equal((await allocate(uid,storage,locks,()=>id)).deviceSequence,81);
await assert.rejects(allocate(uid,storage,null,()=>id),/416_DEVICE_SEQUENCE_UNAVAILABLE/);
const appVersion=Number(JSON.parse(readFileSync('public/app-version.json','utf8')).version);
const stage416ClientActive=appVersion>=400&&appVersion<408;
const source=readFileSync('src/services/exploreLikeService.ts','utf8');
if(stage416ClientActive) assert.match(source,/STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE = true/);
else assert.match(source,/STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE = false/);
assert.match(source,/STAGE416_SHARED_RTDB_BATCH_ACTIVE &&/);
assert.match(source,/reserveAndPersistExploreLikeDeviceSequence416\(/,
  'device sequence and outbox persistence must stay inside one origin-wide lock');
assert.match(source,/persistLikeOutbox\(uid, latest416\);/);
assert.match(source,/await drainStage416PrivateRegistrations416\(uid, operationId416\)/,
  'initial registration must use the ordered durable drain');
assert.match(source,/await drainStage416PrivateRegistrations416\(uid\)/,
  'restart recovery must reuse the same ordered drain');
assert.match(source,/privateDeviceSequence416: token.deviceSequence/);
console.log('STAGE416_MULTI_TAB_UID_DEVICE_SEQUENCE_80=PASS');
// Execute the real (dormant) Callable retry function in isolation. An
// expired server window must not lose a click or issue a NEW operation ID.
const ts=(await import('typescript')).default;
const vm=(await import('node:vm')).default;
const transport=readFileSync('src/services/exploreLikePrivateRtdbTransport416.ts','utf8');
const compiled=ts.transpileModule(transport,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;
const module416={exports:{}};let callableCalls416=0,transportDiagnostics416=[];
vm.runInNewContext(compiled,{module:module416,exports:module416.exports,
  require:moduleId=>moduleId==='../firebase'?{functions:{},httpsCallable:()=>async click=>{
    callableCalls416++;
    assert.equal(click.operationId,id);
    return {data:{ok:true,accepted:true,version:12,count:3}};
  }}:moduleId==='./exploreLikePrivateDiagnostic416'?{
    recordStage416PrivateAcceptanceReply416:(...args)=>transportDiagnostics416.push(['reply',...args]),
    recordStage416PrivateAcceptanceError416:(...args)=>transportDiagnostics416.push(['error',...args]),
  }:(()=>{throw Error('unexpected import '+moduleId)})(),
  Number,Date,Error,Promise,setTimeout}, {timeout:2500});
const {retryPrivateClickAfterPriorSeal416:retry416,
  publishPrivateRtdbBatchClick416:publish416}=module416.exports;
const releaseProbe=await publish416('account',{trackId:'song',liked:true,
  operationId:id,deviceId:id,deviceSequence:1});
if(stage416ClientActive){
  assert.equal(releaseProbe?.version,12,'active Stage416 uses exact server receipt version');
  assert.equal(releaseProbe?.count,3,'active Stage416 uses exact server receipt count');
  assert.equal(callableCalls416,1,'active Stage416 performs one Callable registration');
  assert.equal(transportDiagnostics416.length,1,'diagnostic observes existing Callable reply only');
  assert.equal(transportDiagnostics416[0][0],'reply');
  assert.equal(transportDiagnostics416[0][1],'account');
  assert.equal(transportDiagnostics416[0][2],id);
}else{
  assert.equal(releaseProbe,null,'inactive Stage416 never calls Firebase Callable');
  assert.equal(callableCalls416,0);
  assert.equal(transportDiagnostics416.length,0,'rollback adds no Stage416 server diagnostic traffic');
}
let attempts=0,waits=[],sameOp=id;
const accepted=await retry416(async()=>{
  attempts++;
  assert.equal(sameOp,id,'same operationId after prior window rejection');
  return attempts<3?{ok:true,accepted:false,reason:'PRIOR_WINDOW_NEEDS_SEAL'}
    :{ok:true,accepted:true,version:12,count:3};
},()=>true,async ms=>{waits.push(ms)});
assert.equal(accepted.version,12);
assert.equal(accepted.count,3);
assert.equal(attempts,3);
assert.deepEqual(waits,[2_000,5_000]);
let current=true;attempts=0;
const superseded=await retry416(async()=>{
  attempts++;return {ok:true,accepted:false,reason:'PRIOR_WINDOW_NEEDS_SEAL'};
},()=>current,async()=>{current=false});
assert.equal(superseded,null);
assert.equal(attempts,1,'new local click stops old HTTP retry');
attempts=0;waits=[];
await assert.rejects(retry416(async()=>{
  attempts++;return {ok:true,accepted:false,reason:'PRIOR_WINDOW_NEEDS_SEAL'};
},()=>true,async ms=>{waits.push(ms)}),/PRIOR_WINDOW_NEEDS_SEAL/);
assert.equal(attempts,4,'bounded 4 calls including first click');
assert.deepEqual(waits,[2_000,5_000,10_000]);
attempts=0;
await assert.rejects(retry416(async()=>{
  attempts++;return {ok:true,accepted:false,reason:'STALE_OR_DUPLICATE'};
},()=>true,async()=>{}),/STALE_OR_DUPLICATE/);
assert.equal(attempts,1,'ambiguous stale receipt never treated as accepted');
assert.match(source,/row\.privateDeviceSequence416 === saved\.privateDeviceSequence416/,
  'ordered drain must keep exact durable device sequence authority');
assert(source.includes('privateServerRegistered416:true'));
assert(source.includes('inFlightRecovery416.has(uid)'));
assert(source.includes('budget.count>=3'));
assert(source.includes("window.addEventListener('online'"));
assert(source.includes('onAuthStateChanged(auth,user=>'));
assert.match(source,/row\.privateDeviceSequence416\s*===\s*saved\.privateDeviceSequence416/);
const {parsePrivateFinalReceipt416:parseFinal,
  selectExactFinalizedPrivateLikes416:exactFinal}=await import(
  '../src/services/exploreLikePrivateFinalReceipt416.mjs');
const opFinal='00000000-0000-4000-8000-000000000014';
const acceptedFinal=parseFinal({version:9,canonicalD1:'settled',
  personalLikeSnapshot:'changed-track-r2',rows:[{
    trackId:'song-a',operationId:opFinal,ownerUid:'owner-a',liked:true,likeCount:2,
  }]});
assert(acceptedFinal);
const final80=parseFinal({version:10,canonicalD1:'settled',
  personalLikeSnapshot:'changed-track-r2',rows:Array.from({length:80},(_,i)=>({
    trackId:'split-'+i,operationId:'00000000-0000-4000-8000-'+
      String(i+1).padStart(12,'0'),ownerUid:'owner',liked:i%2===0,likeCount:i,
  }))});
assert.equal(final80?.rows.length,80,'50+30 canonical receipt must remain exact');
assert.equal(parseFinal({...final80,version:11,
  canonicalD1:'settled',personalLikeSnapshot:'changed-track-r2',
  rows:[...final80.rows,...final80.rows,...final80.rows,...final80.rows]}),null,
  'unbounded server receipt is never trusted');
assert.equal(exactFinal({'song-a':{operationId:opFinal,desiredLiked:true}},
  acceptedFinal).length,1);
assert.equal(exactFinal({'song-a':{operationId:opFinal,desiredLiked:false}},
  acceptedFinal).length,0,'newer unlike remains pending');
assert.equal(exactFinal({'song-a':{operationId:id,desiredLiked:true}},
  acceptedFinal).length,1);
assert.equal(exactFinal({'song-a':{operationId:
  '00000000-0000-4000-8000-000000000099',desiredLiked:true}},
  acceptedFinal).length,0,'different operation cannot clear');
for(const invalid of [
 {version:9,canonicalD1:'queued',personalLikeSnapshot:'changed-track-r2',
   rows:acceptedFinal.rows},
 {version:9,canonicalD1:'settled',personalLikeSnapshot:'repair-needed',
   rows:acceptedFinal.rows},
 {version:9,canonicalD1:'settled',personalLikeSnapshot:'changed-track-r2',
   rows:[...acceptedFinal.rows,...acceptedFinal.rows]},
])assert.equal(parseFinal(invalid),null,'unsafe final receipt rejected');
assert(source.includes('privateLikeFinal416/'));
assert(source.includes('persistLikeOutbox(uid,outbox);'));
assert(source.includes('repaint.forEach(dispatchLikeSync)'));
assert(source.includes("soridraw:private-like-await-final-416"));
if(appVersion>=401){
  assert(source.includes('shouldFinalReceiptSupersedeLocal401(current,receipt.version,row)'));
  assert(source.includes('if(current&&!exactCurrent416&&!supersededCurrent416)continue;'));
}else{
  assert(source.includes('if(current&&!exactIds.has(row.trackId))continue;'));
}
console.log('STAGE416_EXACT_D1_AND_R2_PROVEN_FINAL_RECEIPT_ONLY=PASS');
console.log('STAGE416_PENDING_NEWER_CLICK_NOT_CLEARED=PASS');
console.log('STAGE416_RESTART_EXACT_OPERATION_PENDING_ONLY=PASS');
console.log('STAGE416_PRIOR_WINDOW_EXACT_CLICK_BOUNDED_RETRY=PASS');
console.log('STAGE416_SUPERSEDED_AND_AMBIGUOUS_CLICK_FAIL_CLOSED=PASS');
console.log(stage416ClientActive
  ? 'STAGE416_APP400_TO_407_CLIENT_SERVER_REGISTRATION_ACTIVE=PASS'
  : appVersion>=408
    ? 'APP408_STAGE416_CLIENT_OFF_LEGACY_CANONICAL_SYNC_RESTORED=PASS'
    : 'STAGE416_CLIENT_INTEGRATION_OFF_NO_APP399_CHANGE=PASS');

const diagnosticSource=readFileSync('src/services/exploreLikePrivateDiagnostic416.ts','utf8');
assert.doesNotMatch(diagnosticSource,/httpsCallable|databaseRef|runTransaction|\bfetch\s*\(/,
  'local acceptance diagnostic must add no server IO');
assert.match(diagnosticSource,/readCacheDiagnosticsEnabled\(uid\)/);
assert.match(diagnosticSource,/operationToken/);
assert.doesNotMatch(diagnosticSource,/trackId\s*:/,
  'diagnostic state must not persist raw track identifiers');
const diagnosticCompiled=ts.transpileModule(diagnosticSource,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;
const diagnosticModule={exports:{}};
const diagnosticStore=new Map();
let diagnosticEnabled=true,diagnosticEvents=0;
class DiagnosticEvent416{constructor(type,init){this.type=type;this.detail=init?.detail;}}
vm.runInNewContext(diagnosticCompiled,{
  module:diagnosticModule,exports:diagnosticModule.exports,
  require:moduleId=>moduleId==='../lib/cacheDiagnostics'?{
    readCacheDiagnosticsEnabled:()=>diagnosticEnabled,
  }:(()=>{throw Error('unexpected diagnostic import '+moduleId)})(),
  sessionStorage:{
    getItem:key=>diagnosticStore.has(key)?diagnosticStore.get(key):null,
    setItem:(key,value)=>diagnosticStore.set(key,value),
  },
  window:{dispatchEvent:()=>{diagnosticEvents++;}},
  CustomEvent:DiagnosticEvent416,JSON,String,Number,Date,Set,Math,Error,Object,Array,
},{timeout:1500});
const diag=diagnosticModule.exports;
diag.recordStage416PrivateAcceptanceReply416('private-uid',opFinal,'initial',{
  ok:true,accepted:false,reason:'PRIOR_WINDOW_NEEDS_SEAL',
});
let diagState=diag.readStage416PrivateAcceptanceDiagnostic416('private-uid');
assert.equal(diagState.serverAccepted,false);
assert.equal(diagState.reason,'PRIOR_WINDOW_NEEDS_SEAL');
assert.equal(diagState.attempt,1);
assert.equal(diagState.outboxRegistered,false);
diag.recordStage416PrivateAcceptanceReply416('private-uid',opFinal,'recovery',{
  ok:true,accepted:true,reason:'ACCEPTED',version:12,count:1,
});
diag.markStage416PrivateAcceptanceRegistered416('private-uid',opFinal,'recovery',12);
diagState=diag.readStage416PrivateAcceptanceDiagnostic416('private-uid');
assert.equal(diagState.phase,'registered');
assert.equal(diagState.serverAccepted,true);
assert.equal(diagState.receiptValid,true);
assert.equal(diagState.version,12);
assert.equal(diagState.outboxRegistered,true);
assert.equal(diagState.attempt,2);
const serializedDiagnostic=[...diagnosticStore.values()].join('');
assert(!serializedDiagnostic.includes('private-uid'),'raw UID must not persist in diagnostic');
assert(!serializedDiagnostic.includes(opFinal),'raw operationId must not persist in diagnostic');
diagnosticEnabled=false;
assert.equal(diag.readStage416PrivateAcceptanceDiagnostic416('private-uid'),null,
  'diagnostic is default-off/gated by existing cache diagnostic toggle');
assert(diagnosticEvents>=3);
const panel416=readFileSync('src/components/Stage416LikeBatchMasterPanel.tsx','utf8');
assert.match(panel416,/Stage416 서버 접수 진단/);
assert.match(panel416,/readStage416PrivateAcceptanceDiagnostic416/);
assert.match(source,/markStage416PrivateAcceptanceRegistered416[\s\S]*?'initial'/);
assert.match(source,/stillCurrent,'recovery'/);
assert.match(source,/markStage416PrivateAcceptanceRegistered416[\s\S]*?'recovery'/);
console.log('STAGE416_PRIVATE_ACCEPTANCE_LOCAL_DIAGNOSTIC_NO_SERVER_IO=PASS');
console.log('STAGE416_PRIVATE_ACCEPTANCE_DIAGNOSTIC_NO_RAW_IDS=PASS');

if(appVersion>=408){
  assert.match(source,/const STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE = false/);
  assert.match(source,/publishExploreLikeIntent416\(uid,/,
    'same-account immediate hint remains available while canonical path rolls back');
  assert.match(source,/if \(!\(STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE && STAGE416_SHARED_RTDB_BATCH_ACTIVE\)\) \{[\s\S]*?schedulePendingFlush\(user\)/,
    'legacy canonical scheduler must resume when Stage416 is off');
  assert.match(source,/const eligibleGuardedMutation420 = \(entry: ExploreLikePendingMutation\): boolean =>[\s\S]*?!EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE/,
    'old Stage416 outbox metadata must not block legacy canonical settlement');
  console.log('APP408_EXISTING_STAGE416_OUTBOX_LEGACY_SETTLEMENT_ELIGIBLE=PASS');
}

if(appVersion>=409){
  assert.match(source,/hasRecoverablePending409 = Object\.values\(readLikeOutbox\(user\.uid\)\)/,
    'startup recovery must inspect only the durable local outbox');
  assert.match(source,/hasRecoverablePending409\) schedulePendingFlush\(user\)/,
    'eligible pending click settles without waiting for Explore card hydration');
  const recoveryMarker=appVersion>=412?'// app412: Auth-ready recovery':'// app409:';
  const recoveryStart=source.indexOf(recoveryMarker);
  assert.ok(recoveryStart>=0,'startup recovery marker missing');
  const startupRecovery=source.slice(recoveryStart,recoveryStart+1400);
  assert.doesNotMatch(startupRecovery,/requestExploreLike|fetch\(|httpsCallable|setRealtimeValue/,
    'empty startup recovery must add no direct server request');
  assert.match(startupRecovery,/\(pending\.retryCount \|\| 0\) === 0/,
    'ambiguous failed writes must not be replayed automatically');
  if(appVersion>=412){
    assert.match(startupRecovery,/pending\.explicitReplayEligible412 === true/,
      'historical unmarked outbox must not auto-replay after Auth readiness');
    assert.match(source,/explicitReplayEligible412: true/,
      'a new explicit click must mark its durable outbox row replay-eligible');
    console.log('APP412_STALE_OUTBOX_STARTUP_QUARANTINE=PASS');
  }else{
    console.log('APP409_STARTUP_EXISTING_PENDING_ONLY_NO_IDLE_IO=PASS');
  }
}

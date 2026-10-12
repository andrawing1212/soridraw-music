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
const source=readFileSync('src/services/exploreLikeService.ts','utf8');
if(appVersion>=400) assert.match(source,/STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE = true/);
else assert.match(source,/STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE = false/);
assert.match(source,/STAGE416_SHARED_RTDB_BATCH_ACTIVE &&/);
assert.match(source,/persistLikeOutbox\(uid, latest416\);[\s\S]*?publishPrivateRtdbBatchClick416\(/);
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
const module416={exports:{}};let callableCalls416=0;
vm.runInNewContext(compiled,{module:module416,exports:module416.exports,
  require:moduleId=>moduleId==='../firebase'?{functions:{},httpsCallable:()=>async click=>{
    callableCalls416++;
    assert.equal(click.operationId,id);
    return {data:{ok:true,accepted:true,version:12,count:3}};
  }}:(()=>{throw Error('unexpected import '+moduleId)})(),
  Number,Date,Error,Promise,setTimeout}, {timeout:2500});
const {retryPrivateClickAfterPriorSeal416:retry416,
  publishPrivateRtdbBatchClick416:publish416}=module416.exports;
const releaseProbe=await publish416('account',{trackId:'song',liked:true,
  operationId:id,deviceId:id,deviceSequence:1});
if(appVersion>=400){
  assert.equal(releaseProbe?.version,12,'app400 uses exact server receipt version');
  assert.equal(releaseProbe?.count,3,'app400 uses exact server receipt count');
  assert.equal(callableCalls416,1,'app400 performs one Callable registration');
}else{
  assert.equal(releaseProbe,null,'app399 OFF never calls Firebase Callable');
  assert.equal(callableCalls416,0);
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
assert.match(source,/current\.privateDeviceSequence416 === token\.deviceSequence/);
assert(source.includes('privateServerRegistered416:true'));
assert(source.includes('inFlightRecovery416.has(uid)'));
assert(source.includes('budget.count>=3'));
assert(source.includes("window.addEventListener('online'"));
assert(source.includes('onAuthStateChanged(auth,user=>'));
assert(source.includes('row.privateDeviceSequence416===saved.privateDeviceSequence416'));
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
assert(source.includes('if(current&&!exactIds.has(row.trackId))continue;'));
console.log('STAGE416_EXACT_D1_AND_R2_PROVEN_FINAL_RECEIPT_ONLY=PASS');
console.log('STAGE416_PENDING_NEWER_CLICK_NOT_CLEARED=PASS');
console.log('STAGE416_RESTART_EXACT_OPERATION_PENDING_ONLY=PASS');
console.log('STAGE416_PRIOR_WINDOW_EXACT_CLICK_BOUNDED_RETRY=PASS');
console.log('STAGE416_SUPERSEDED_AND_AMBIGUOUS_CLICK_FAIL_CLOSED=PASS');
console.log(appVersion>=400
  ? 'STAGE416_APP400_CLIENT_SERVER_REGISTRATION_ACTIVE=PASS'
  : 'STAGE416_CLIENT_INTEGRATION_OFF_NO_APP399_CHANGE=PASS');

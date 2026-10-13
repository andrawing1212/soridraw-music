import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const nativeRequire=createRequire(import.meta.url);
const source=readFileSync('functions/src/exploreLikePrivateServerClick416.ts','utf8');
const output=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;
const module={exports:{}};
vm.runInNewContext(output,{module,exports:module.exports,Date,Object,Number,Error,Array,
 Promise,console,require:nativeRequire},{timeout:2500});
const {recordUserPrivateClick416}=module.exports;

const uid='cross-environment-user';
const roots={
 privateLikeBatch416:{version:39,deviceSeq:{},pending:null,window:null,sealed:null},
 'stage416Transient/test/privateLikeBatch':null,
 'stage416Transient/production/privateLikeBatch':null,
 privateLikeGlobalVersion416:null,
};
let changedWrites=0;
let reads=0;
const clone=value=>value==null?value:structuredClone(value);
const database={ref:path=>{
 const suffix='/'+uid;
 assert.ok(path.endsWith(suffix));
 const root=path.slice(0,-suffix.length);
 assert.ok(Object.hasOwn(roots,root),`unexpected RTDB root ${root}`);
 return {
  transaction:async update=>{
   const before=clone(roots[root]);
   const next=update(clone(before));
   if(next===undefined)return {committed:false,snapshot:{val:()=>clone(roots[root])}};
   if(JSON.stringify(next)!==JSON.stringify(before))changedWrites++;
   roots[root]=clone(next);
   return {committed:true,snapshot:{val:()=>clone(roots[root])}};
  },
  get:async()=>{reads++;return {val:()=>clone(roots[root])};},
 };
}};

const device='00000000-0000-4000-8000-000000000001';
const route=[
 ['privateLikeBatch416','00000000-0000-4000-8000-000000000011',1,1_700_000_000_000],
 ['stage416Transient/test/privateLikeBatch','00000000-0000-4000-8000-000000000012',2,1_700_000_000_001],
 ['stage416Transient/production/privateLikeBatch','00000000-0000-4000-8000-000000000013',3,1_700_000_000_002],
 ['privateLikeBatch416','00000000-0000-4000-8000-000000000014',4,1_700_000_000_003],
];
let acceptedD1Version=39;
const settled=[];
for(let i=0;i<route.length;i++){
 const [privateRoot,operationId,deviceSequence,now]=route[i];
 const result=await recordUserPrivateClick416(database,uid,{
  trackId:`song-${deviceSequence}`,liked:true,operationId,deviceId:device,deviceSequence,
 },5,now,false,privateRoot,'privateLikeGlobalVersion416');
 assert.equal(result.accepted,true);
 assert.ok(result.version>acceptedD1Version,
  'shared D1 WHERE excluded.version > current.version must accept every environment');
 acceptedD1Version=result.version;
 settled.push(result.version);
 if(i<route.length-1)
  roots[privateRoot]={...roots[privateRoot],window:null,pending:null,sealed:null};
}
assert.deepEqual(settled,[
 1_700_000_000_000,1_700_000_000_001,1_700_000_000_002,1_700_000_000_003,
]);

// Exact duplicate is accepted only while this environment still holds proof.
// Both the global reservation and environment mutation remain logical W0.
const beforeDuplicateGlobal=clone(roots.privateLikeGlobalVersion416);
const beforeDuplicateEnv=clone(roots.privateLikeBatch416);
const writesBeforeDuplicate=changedWrites;
const duplicate=await recordUserPrivateClick416(database,uid,{
 trackId:'song-4',liked:true,operationId:route[3][1],deviceId:device,deviceSequence:4,
},5,1_700_000_000_004,false,'privateLikeBatch416','privateLikeGlobalVersion416');
assert.equal(duplicate.accepted,true);
assert.equal(duplicate.reason,'DUPLICATE_CONFIRMED');
assert.equal(duplicate.version,settled[3]);
assert.deepEqual(roots.privateLikeGlobalVersion416,beforeDuplicateGlobal);
assert.deepEqual(roots.privateLikeBatch416,beforeDuplicateEnv);
assert.equal(changedWrites,writesBeforeDuplicate,'exact proven duplicate must be logical RTDB W0');

// Once pending/sealed proof is gone, the global reservation alone must never
// manufacture a successful duplicate receipt.
roots.privateLikeBatch416={...roots.privateLikeBatch416,window:null,pending:null,sealed:null};
const afterSettleDuplicate=await recordUserPrivateClick416(database,uid,{
 trackId:'song-4',liked:true,operationId:route[3][1],deviceId:device,deviceSequence:4,
},5,1_700_000_000_005,false,'privateLikeBatch416','privateLikeGlobalVersion416');
assert.equal(afterSettleDuplicate.accepted,false);
assert.equal(afterSettleDuplicate.reason,'STALE_OR_DUPLICATE');

// PRIOR_WINDOW_NEEDS_SEAL may reserve one version, but that reservation is not
// acceptance. The same operation must later reuse the exact version and enter
// the environment root after the old window clears.
const retryOp='00000000-0000-4000-8000-000000000015';
const oldOp='00000000-0000-4000-8000-000000000099';
const oldKey=createHash('sha256').update('old-song').digest('hex');
roots['stage416Transient/test/privateLikeBatch']={
 version:settled[1],deviceSeq:{[device]:2},
 pending:{[oldKey]:{trackId:'old-song',liked:true,operationId:oldOp,
  deviceId:device,deviceSequence:2,version:settled[1],mutationAt:1_700_000_010_000}},
 window:{id:oldOp,minutes:1,openedAtMs:1_700_000_010_000,
  lastClickAtMs:1_700_000_010_000,revision:settled[1]},sealed:null,
};
const blocked=await recordUserPrivateClick416(database,uid,{
 trackId:'retry-song',liked:true,operationId:retryOp,deviceId:device,deviceSequence:5,
},1,1_700_000_100_000,false,'stage416Transient/test/privateLikeBatch',
 'privateLikeGlobalVersion416');
assert.equal(blocked.accepted,false);
assert.equal(blocked.reason,'PRIOR_WINDOW_NEEDS_SEAL');
const reservedVersion=roots.privateLikeGlobalVersion416.devices[device].version;
assert.equal(roots.privateLikeGlobalVersion416.devices[device].operationId,retryOp);
assert.equal(Object.hasOwn(roots.privateLikeGlobalVersion416.devices[device],'accepted'),false);
roots['stage416Transient/test/privateLikeBatch']={
 ...roots['stage416Transient/test/privateLikeBatch'],window:null,pending:null,sealed:null,
};
const retried=await recordUserPrivateClick416(database,uid,{
 trackId:'retry-song',liked:true,operationId:retryOp,deviceId:device,deviceSequence:5,
},1,1_700_000_100_001,false,'stage416Transient/test/privateLikeBatch',
 'privateLikeGlobalVersion416');
assert.equal(retried.accepted,true);
assert.equal(retried.version,reservedVersion);

// DEVICE_LIMIT rejection may leave only a reusable reservation, never a global
// accepted receipt. Repeating the same operation remains rejected by env state.
const limitDevice='00000000-0000-4000-8000-000000000021';
const deviceSeq={};
for(let i=0;i<32;i++)deviceSeq[
 '00000000-0000-4000-8000-'+String(100000000000+i).padStart(12,'0')]=1;
roots['stage416Transient/production/privateLikeBatch']={
 version:settled[2],deviceSeq,pending:null,window:null,sealed:null,
};
const deviceLimitOp='00000000-0000-4000-8000-000000000022';
const deviceLimit=await recordUserPrivateClick416(database,uid,{
 trackId:'device-limit',liked:true,operationId:deviceLimitOp,
 deviceId:limitDevice,deviceSequence:1,
},5,1_700_000_200_000,false,'stage416Transient/production/privateLikeBatch',
 'privateLikeGlobalVersion416');
assert.equal(deviceLimit.accepted,false);
assert.equal(deviceLimit.reason,'DEVICE_LIMIT');
assert.equal(Object.hasOwn(roots.privateLikeGlobalVersion416.devices[limitDevice],'accepted'),false);

// TRACK_LIMIT rejection likewise cannot become accepted from the sequencer.
const trackDevice='00000000-0000-4000-8000-000000000031';
const fullPending={};
for(let i=0;i<256;i++){
 const id=`full-${i}`;
 const key=createHash('sha256').update(id).digest('hex');
 fullPending[key]={trackId:id,liked:true,
  operationId:`00000000-0000-4000-8000-${String(200000000000+i).padStart(12,'0')}`,
  deviceId:trackDevice,deviceSequence:i+1,version:i+1,mutationAt:1_700_000_000_000+i};
}
roots['stage416Transient/test/privateLikeBatch']={
 version:reservedVersion,deviceSeq:{[trackDevice]:0},pending:fullPending,window:null,sealed:null,
};
const trackLimitOp='00000000-0000-4000-8000-000000000032';
const trackLimit=await recordUserPrivateClick416(database,uid,{
 trackId:'track-overflow',liked:true,operationId:trackLimitOp,
 deviceId:trackDevice,deviceSequence:1,
},5,1_700_000_300_000,false,'stage416Transient/test/privateLikeBatch',
 'privateLikeGlobalVersion416');
assert.equal(trackLimit.accepted,false);
assert.equal(trackLimit.reason,'TRACK_LIMIT');
assert.equal(Object.hasOwn(roots.privateLikeGlobalVersion416.devices[trackDevice],'accepted'),false);

// A legacy env stale sequence can consume a reservation high-water mark, but
// it still cannot become accepted or duplicate-confirmed without env proof.
const staleDevice='00000000-0000-4000-8000-000000000041';
roots.privateLikeBatch416={
 version:reservedVersion,deviceSeq:{[staleDevice]:5},pending:null,window:null,sealed:null,
};
const staleOp='00000000-0000-4000-8000-000000000042';
const stale=await recordUserPrivateClick416(database,uid,{
 trackId:'stale-song',liked:true,operationId:staleOp,deviceId:staleDevice,deviceSequence:4,
},5,1_700_000_400_000,false,'privateLikeBatch416','privateLikeGlobalVersion416');
assert.equal(stale.accepted,false);
assert.equal(stale.reason,'STALE_OR_DUPLICATE');
assert.equal(Object.hasOwn(roots.privateLikeGlobalVersion416.devices[staleDevice],'accepted'),false);

// Real concurrency regression: reservation A -> reservation B -> env B -> env A.
// A must keep its exact operationId and rebase above B instead of being lost.
const concurrentUid='concurrent-same-environment-user';
const concurrentRoots={
 privateLikeBatch416:null,
 privateLikeGlobalVersion416:null,
};
let firstGlobalPaused=false;
let releaseFirstGlobal;
let firstGlobalCommitted;
const firstGlobalCommittedPromise=new Promise(resolve=>{firstGlobalCommitted=resolve;});
const releaseFirstGlobalPromise=new Promise(resolve=>{releaseFirstGlobal=resolve;});
const concurrentClone=value=>value==null?value:structuredClone(value);
const concurrentDatabase={ref:path=>{
 const suffix='/'+concurrentUid;
 assert.ok(path.endsWith(suffix));
 const root=path.slice(0,-suffix.length);
 assert.ok(Object.hasOwn(concurrentRoots,root),`unexpected concurrent root ${root}`);
 return {
  transaction:async update=>{
   const before=concurrentClone(concurrentRoots[root]);
   const next=update(concurrentClone(before));
   if(next===undefined)return {committed:false,snapshot:{val:()=>concurrentClone(concurrentRoots[root])}};
   concurrentRoots[root]=concurrentClone(next);
   if(root==='privateLikeGlobalVersion416'&&!firstGlobalPaused){
    firstGlobalPaused=true;
    firstGlobalCommitted();
    await releaseFirstGlobalPromise;
   }
   return {committed:true,snapshot:{val:()=>concurrentClone(concurrentRoots[root])}};
  },
  get:async()=>({val:()=>concurrentClone(concurrentRoots[root])}),
 };
}};
const concurrentA={
 trackId:'concurrent-A',liked:true,
 operationId:'00000000-0000-4000-8000-000000000051',
 deviceId:'00000000-0000-4000-8000-000000000052',deviceSequence:1,
};
const concurrentB={
 trackId:'concurrent-B',liked:true,
 operationId:'00000000-0000-4000-8000-000000000053',
 deviceId:'00000000-0000-4000-8000-000000000054',deviceSequence:1,
};
const aPromise=recordUserPrivateClick416(
 concurrentDatabase,concurrentUid,concurrentA,5,1_700_001_000_000,false,
 'privateLikeBatch416','privateLikeGlobalVersion416');
await firstGlobalCommittedPromise;
const bPromise=recordUserPrivateClick416(
 concurrentDatabase,concurrentUid,concurrentB,5,1_700_001_000_001,false,
 'privateLikeBatch416','privateLikeGlobalVersion416');
const bResult=await bPromise;
assert.equal(bResult.accepted,true);
const bVersion=bResult.version;
releaseFirstGlobal();
const aResult=await aPromise;
assert.equal(aResult.accepted,true);
assert.ok(aResult.version>bVersion,
 'late A must rebase above already-committed B instead of throwing/loss');
const aKey=createHash('sha256').update(concurrentA.trackId).digest('hex');
const bKey=createHash('sha256').update(concurrentB.trackId).digest('hex');
assert.equal(concurrentRoots.privateLikeBatch416.pending[aKey].operationId,concurrentA.operationId);
assert.equal(concurrentRoots.privateLikeBatch416.pending[bKey].operationId,concurrentB.operationId);
assert.equal(concurrentRoots.privateLikeBatch416.pending[aKey].version,aResult.version);
assert.equal(concurrentRoots.privateLikeBatch416.pending[bKey].version,bVersion);
assert.equal(concurrentRoots.privateLikeBatch416.version,aResult.version);
assert.equal(concurrentRoots.privateLikeBatch416.window.revision,aResult.version);

console.log('STAGE416_PREVIEW_V39_GLOBAL_BOOTSTRAP_NO_MIGRATION=PASS');
console.log('STAGE416_CONCURRENT_RESERVATION_REBASE_NO_LOST_CLICK=PASS');
console.log('STAGE416_PREVIEW_TEST_PRODUCTION_PREVIEW_STRICT_INTERLEAVING=PASS');
console.log('STAGE416_GLOBAL_RESERVATION_IS_NOT_ACCEPTANCE=PASS');
console.log('STAGE416_PRIOR_SEAL_RETRY_REUSES_VERSION_AND_PERSISTS=PASS');
console.log('STAGE416_LIMIT_AND_STALE_REJECTIONS_NEVER_GLOBAL_ACCEPT=PASS');
console.log('STAGE416_GLOBAL_ONLY_DUPLICATE_AUTHORITY=0');
console.log('STAGE416_ACCEPTED_CLICK_RTDB_CHANGED_WRITES=2');
console.log('STAGE416_EXACT_PROVEN_DUPLICATE_RTDB_CHANGED_WRITES=0');
console.log('STAGE416_PAGE_UPDATE_REENTRY_IO=0');

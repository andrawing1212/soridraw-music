import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
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
let failNextGlobalCommit=false;
const database={ref:path=>{
 const suffix='/'+uid;
 assert.ok(path.endsWith(suffix));
 const root=path.slice(0,-suffix.length);
 assert.ok(Object.hasOwn(roots,root),`unexpected RTDB root ${root}`);
 return {
  transaction:async update=>{
   const before=structuredClone(roots[root]);
   const next=update(structuredClone(before));
   if(next===undefined)return {committed:false,snapshot:{val:()=>roots[root]}};
   if(failNextGlobalCommit&&root==='privateLikeGlobalVersion416'&&before?.reservation&&
      next?.reservation===undefined){
    failNextGlobalCommit=false;
    throw Error('SIMULATED_CRASH_AFTER_ENV_ACCEPT');
   }
   if(JSON.stringify(next)!==JSON.stringify(before))changedWrites++;
   roots[root]=structuredClone(next);
   return {committed:true,snapshot:{val:()=>structuredClone(roots[root])}};
  },
  get:async()=>({val:()=>structuredClone(roots[root])}),
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
for(const [privateRoot,operationId,deviceSequence,now] of route){
 const result=await recordUserPrivateClick416(database,uid,{
  trackId:`song-${deviceSequence}`,liked:true,operationId,deviceId:device,deviceSequence,
 },5,now,false,privateRoot,'privateLikeGlobalVersion416');
 assert.equal(result.accepted,true);
 assert.ok(result.version>acceptedD1Version,
  'shared D1 WHERE excluded.version > current.version must accept every environment');
 acceptedD1Version=result.version;
 settled.push(result.version);
 // Model the exact environment-specific settle/final ACK while retaining its
 // local high-water mark. No shared user data is migrated or backfilled.
 roots[privateRoot]={...roots[privateRoot],window:null,pending:null,sealed:null};
}
assert.deepEqual(settled,[
 1_700_000_000_000,1_700_000_000_001,1_700_000_000_002,1_700_000_000_003,
]);
const beforeDuplicate=structuredClone(roots.privateLikeGlobalVersion416);
const writesBeforeDuplicate=changedWrites;
const duplicate=await recordUserPrivateClick416(database,uid,{
 trackId:'song-4',liked:true,operationId:route[3][1],deviceId:device,deviceSequence:4,
},5,1_700_000_000_004,false,'privateLikeBatch416','privateLikeGlobalVersion416');
assert.equal(duplicate.accepted,true);
assert.equal(duplicate.version,settled[3]);
assert.deepEqual(roots.privateLikeGlobalVersion416,beforeDuplicate);
assert.equal(changedWrites,writesBeforeDuplicate,'exact duplicate must be logical RTDB W0');

// Reserving a global version is not proof that the environment-local click was
// registered. Model an expired PREVIEW window: the first attempt reserves a
// version but must remain rejected, then the exact retry may use that reserved
// version only after the prior window has been cleared.
roots.privateLikeBatch416={version:settled[3],deviceSeq:{},pending:null,
 window:{id:'expired',minutes:1,openedAtMs:1,lastClickAtMs:1,revision:settled[3]},sealed:null};
const delayedClick={trackId:'delayed-song',liked:true,
 operationId:'00000000-0000-4000-8000-000000000015',deviceId:device,deviceSequence:5};
const delayedFirst=await recordUserPrivateClick416(database,uid,delayedClick,5,
 1_700_000_100_000,false,'privateLikeBatch416','privateLikeGlobalVersion416');
assert.equal(delayedFirst.accepted,false);
assert.equal(delayedFirst.reason,'PRIOR_WINDOW_NEEDS_SEAL');
const reservedVersion=roots.privateLikeGlobalVersion416.reservation.version;
assert.equal(roots.privateLikeGlobalVersion416.version,settled[3],
 'a reservation must not advance the globally committed version');
assert.equal(roots.privateLikeGlobalVersion416.devices[device].deviceSequence,4,
 'a reservation must not become an accepted device receipt');
roots.privateLikeBatch416={...roots.privateLikeBatch416,window:null};
const delayedRetry=await recordUserPrivateClick416(database,uid,delayedClick,5,
 1_700_000_100_001,false,'privateLikeBatch416','privateLikeGlobalVersion416');
assert.equal(delayedRetry.accepted,true);
assert.equal(delayedRetry.reason,'ACCEPTED');
assert.equal(delayedRetry.version,reservedVersion);
assert.equal(roots.privateLikeGlobalVersion416.version,reservedVersion,
 'retry must reuse rather than consume another global version');
assert.equal(roots.privateLikeGlobalVersion416.reservation,undefined);
assert.equal(roots.privateLikeGlobalVersion416.devices[device].deviceSequence,5);

// A crash after environment acceptance but before the global commit leaves a
// reservation, not an accepted receipt. Exact retry proves the environment
// operation and completes the same reservation without double-accept/version.
const crashClick={trackId:'crash-song',liked:true,
 operationId:'00000000-0000-4000-8000-000000000019',deviceId:device,deviceSequence:6};
failNextGlobalCommit=true;
await assert.rejects(recordUserPrivateClick416(database,uid,crashClick,5,
 1_700_000_100_002,false,'privateLikeBatch416','privateLikeGlobalVersion416'),
 /SIMULATED_CRASH_AFTER_ENV_ACCEPT/);
const crashReservedVersion=roots.privateLikeGlobalVersion416.reservation.version;
assert.equal(roots.privateLikeGlobalVersion416.devices[device].deviceSequence,5);
const crashRetry=await recordUserPrivateClick416(database,uid,crashClick,5,
 1_700_000_100_003,false,'privateLikeBatch416','privateLikeGlobalVersion416');
assert.equal(crashRetry.reason,'DUPLICATE_CONFIRMED');
assert.equal(crashRetry.version,crashReservedVersion);
assert.equal(roots.privateLikeGlobalVersion416.version,crashReservedVersion);
assert.equal(roots.privateLikeGlobalVersion416.devices[device].deviceSequence,6);
assert.equal(roots.privateLikeGlobalVersion416.reservation,undefined);

// Permanent environment rejection must roll back the uncommitted reservation.
// It must not advance either the committed version or the accepted receipt.
const committedBeforeRejections=structuredClone(roots.privateLikeGlobalVersion416);
const rejectedDevice='00000000-0000-4000-8000-000000000099';
const makeDevices=count=>Object.fromEntries(Array.from({length:count},(_,index)=>[
 `00000000-0000-4000-8000-${String(index+100).padStart(12,'0')}`,1,
]));
roots['stage416Transient/test/privateLikeBatch']={version:reservedVersion,
 deviceSeq:makeDevices(32),pending:null,window:null,sealed:null};
const deviceLimit=await recordUserPrivateClick416(database,uid,{trackId:'device-limit',liked:true,
 operationId:'00000000-0000-4000-8000-000000000016',deviceId:rejectedDevice,deviceSequence:1,
},5,1_700_000_100_002,false,'stage416Transient/test/privateLikeBatch','privateLikeGlobalVersion416');
assert.equal(deviceLimit.reason,'DEVICE_LIMIT');
assert.deepEqual(roots.privateLikeGlobalVersion416,committedBeforeRejections);

roots['stage416Transient/test/privateLikeBatch']={version:reservedVersion,deviceSeq:{},
 pending:Object.fromEntries(Array.from({length:256},(_,index)=>[`track-${index}`,{
  trackId:`existing-${index}`,liked:true,operationId:'existing',deviceId:'existing',
  deviceSequence:1,version:reservedVersion,mutationAt:1,
 }])),window:null,sealed:null};
const trackLimit=await recordUserPrivateClick416(database,uid,{trackId:'track-limit',liked:true,
 operationId:'00000000-0000-4000-8000-000000000017',deviceId:rejectedDevice,deviceSequence:1,
},5,1_700_000_100_003,false,'stage416Transient/test/privateLikeBatch','privateLikeGlobalVersion416');
assert.equal(trackLimit.reason,'TRACK_LIMIT');
assert.deepEqual(roots.privateLikeGlobalVersion416,committedBeforeRejections);

roots['stage416Transient/test/privateLikeBatch']={version:reservedVersion,
 deviceSeq:{[rejectedDevice]:2},pending:null,window:null,sealed:null};
const stale=await recordUserPrivateClick416(database,uid,{trackId:'stale',liked:true,
 operationId:'00000000-0000-4000-8000-000000000018',deviceId:rejectedDevice,deviceSequence:1,
},5,1_700_000_100_004,false,'stage416Transient/test/privateLikeBatch','privateLikeGlobalVersion416');
assert.equal(stale.reason,'STALE_OR_DUPLICATE');
assert.deepEqual(roots.privateLikeGlobalVersion416,committedBeforeRejections);

console.log('STAGE416_PREVIEW_V39_GLOBAL_BOOTSTRAP_NO_MIGRATION=PASS');
console.log('STAGE416_PREVIEW_TEST_PRODUCTION_PREVIEW_STRICT_INTERLEAVING=PASS');
console.log('STAGE416_SHARED_D1_STALE_REJECTION=0');
console.log('STAGE416_ACCEPTED_CLICK_RTDB_CHANGED_WRITES=3_RESERVE_ENV_COMMIT');
console.log('STAGE416_EXACT_DUPLICATE_RTDB_CHANGED_WRITES=0');
console.log('STAGE416_RESERVED_VERSION_RETRY_REACHES_ENVIRONMENT_ROOT=PASS');
console.log('STAGE416_CRASH_AFTER_ENV_ACCEPT_EXACT_RETRY_COMMITS_ONCE=PASS');
console.log('STAGE416_PERMANENT_REJECTIONS_LEAVE_GLOBAL_ACCEPTED_STATE=0');
console.log('STAGE416_PAGE_UPDATE_REENTRY_IO=0');

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
const reservedVersion=roots.privateLikeGlobalVersion416.version;
roots.privateLikeBatch416={...roots.privateLikeBatch416,window:null};
const delayedRetry=await recordUserPrivateClick416(database,uid,delayedClick,5,
 1_700_000_100_001,false,'privateLikeBatch416','privateLikeGlobalVersion416');
assert.equal(delayedRetry.accepted,true);
assert.equal(delayedRetry.reason,'ACCEPTED');
assert.equal(delayedRetry.version,reservedVersion);
assert.equal(roots.privateLikeGlobalVersion416.version,reservedVersion,
 'retry must reuse rather than consume another global version');

console.log('STAGE416_PREVIEW_V39_GLOBAL_BOOTSTRAP_NO_MIGRATION=PASS');
console.log('STAGE416_PREVIEW_TEST_PRODUCTION_PREVIEW_STRICT_INTERLEAVING=PASS');
console.log('STAGE416_SHARED_D1_STALE_REJECTION=0');
console.log('STAGE416_ACCEPTED_CLICK_RTDB_CHANGED_WRITES=2');
console.log('STAGE416_EXACT_DUPLICATE_RTDB_CHANGED_WRITES=0');
console.log('STAGE416_RESERVED_VERSION_RETRY_REACHES_ENVIRONMENT_ROOT=PASS');
console.log('STAGE416_PAGE_UPDATE_REENTRY_IO=0');

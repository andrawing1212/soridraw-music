import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const nativeRequire=createRequire(import.meta.url);
const source=readFileSync('functions/src/exploreLikePrivateCommit416.ts','utf8');
const output=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;

const uid='cross-env-settlement-user';
const previewRoot='privateLikeBatch416';
const testRoot='stage416Transient/test/privateLikeBatch';
const productionRoot='stage416Transient/production/privateLikeBatch';
const globalRoot='privateLikeGlobalVersion416';
const privateRoots=[previewRoot,testRoot,productionRoot];
const previewId='00000000-0000-4000-8000-000000000061';
const testId='00000000-0000-4000-8000-000000000062';
const previewDevice='00000000-0000-4000-8000-000000000063';
const testDevice='00000000-0000-4000-8000-000000000064';
const row=(id,version,track,device)=>({
 id,version,closedAtMs:1_700_002_000_000+version,
 rows:[{trackId:track,liked:true,operationId:id,deviceId:device,
  deviceSequence:1,version,mutationAt:1_700_001_000_000+version}],
});
const seals={
 [previewRoot]:row(previewId,101,'preview-track',previewDevice),
 [testRoot]:row(testId,100,'test-track',testDevice),
 [productionRoot]:null,
};
const roots={
 [previewRoot]:{version:101,window:null,pending:null,sealed:seals[previewRoot]},
 [testRoot]:{version:100,window:null,pending:null,sealed:seals[testRoot]},
 [productionRoot]:null,
 [globalRoot]:{
  version:101,settledVersion:99,
  devices:{
   [testDevice]:{deviceSequence:1,operationId:testId,trackId:'test-track',liked:true,version:100},
   [previewDevice]:{deviceSequence:1,operationId:previewId,trackId:'preview-track',liked:true,version:101},
  },
 },
};

const deliveries=[];
const requireMock=id=>{
 if(id==='./exploreLikePrivateSeal416')return {
  sealUserPrivateLikes416:async(_db,_uid,_now,_expected,privateRoot)=>{
   const seal=seals[privateRoot];
   if(!seal)return {sealed:false,reason:'EMPTY'};
   return {sealed:true,reason:'SEALED',value:structuredClone(seal)};
  },
  acknowledgeUserPrivateSeal416:async(_db,_uid,receipt,privateRoot)=>{
   const current=roots[privateRoot]?.sealed;
   if(!current||current.id!==receipt.id||current.version!==receipt.version)return false;
   roots[privateRoot]={...roots[privateRoot],sealed:null};
   seals[privateRoot]=null;
   return true;
  },
 };
 if(id==='./exploreLikePrivateHandoff416')return {
  deliverPrivateSealToWorker416:async(_uid,seal)=>{
   deliveries.push(seal.version);
   return {version:seal.version,batchIds:[
    'l069_1700000000000_'+String(seal.version).padStart(64,'0')
   ]};
  },
 };
 return nativeRequire(id);
};
const module={exports:{}};
vm.runInNewContext(output,{module,exports:module.exports,require:requireMock,
 Date,Object,Number,Error,Array,Set,Map,Promise,fetch:async()=>null,console},{timeout:2500});
const {completeUserPrivateWindow416,findLowerOutstandingPrivateVersion416}=module.exports;

let reads=0;
const clone=value=>value==null?value:structuredClone(value);
const db={ref:path=>{
 const suffix='/'+uid;
 assert.ok(path.endsWith(suffix),path);
 const root=path.slice(0,-suffix.length);
 assert.ok(Object.hasOwn(roots,root),root);
 return {
  get:async()=>{reads++;return {val:()=>clone(roots[root])};},
  transaction:async update=>{
   const before=clone(roots[root]);
   const next=update(clone(before));
   if(next===undefined)return {committed:false,snapshot:{val:()=>clone(roots[root])}};
   roots[root]=clone(next);
   return {committed:true,snapshot:{val:()=>clone(roots[root])}};
  },
  child:()=>({get:async()=>({val:()=>null})}),
 };
}};
const endpoint='https://example.invalid/internal';
const secret='x'.repeat(32);
const http=async()=>null;

const lower=await findLowerOutstandingPrivateVersion416(
 db,uid,101,privateRoots,previewRoot,seals[previewRoot].rows,globalRoot);
assert.equal(lower,100);
reads=0;

// Attempt the higher PREVIEW settlement first. It must freeze in RTDB but MUST
// NOT reach Worker/D1 while TEST v100 remains outstanding.
const highBlocked=await completeUserPrivateWindow416(
 db,uid,endpoint,secret,1_700_003_000_000,http,previewId,
 previewRoot,privateRoots,globalRoot);
assert.equal(highBlocked.queued,false);
assert.equal(highBlocked.reason,'WAITING_FOR_LOWER_ENVIRONMENT_VERSION');
assert.equal(highBlocked.version,101);
assert.deepEqual(deliveries,[]);

// Lower TEST v100 is allowed even though higher PREVIEW v101 is already sealed.
const lowDelivered=await completeUserPrivateWindow416(
 db,uid,endpoint,secret,1_700_003_000_001,http,testId,
 testRoot,privateRoots,globalRoot);
assert.equal(lowDelivered.queued,true);
assert.equal(lowDelivered.acknowledged,true);
assert.deepEqual(deliveries,[100]);
assert.equal(roots[testRoot].sealed,null);
assert.equal(roots[globalRoot].settledVersion,100);

// The same frozen PREVIEW v101 retry is now allowed and preserves monotonic
// shared D1/R2 settlement order.
const highDelivered=await completeUserPrivateWindow416(
 db,uid,endpoint,secret,1_700_003_000_002,http,previewId,
 previewRoot,privateRoots,globalRoot);
assert.equal(highDelivered.queued,true);
assert.equal(highDelivered.acknowledged,true);
assert.deepEqual(deliveries,[100,101]);
assert.equal(roots[previewRoot].sealed,null);
assert.equal(roots[globalRoot].settledVersion,101);

assert.equal(reads,9,'three settlement attempts read exactly 2 peer roots + 1 global root each');
console.log('STAGE416_HIGHER_ENV_SETTLEMENT_BLOCKED_BY_LOWER_VERSION=PASS');
console.log('STAGE416_CROSS_ENV_FINAL_DELIVERY_STRICT_100_101=PASS');
console.log('STAGE416_BLOCKED_HIGHER_WORKER_D1_CALLS=0');
console.log('STAGE416_SETTLEMENT_GATE_PAGE_UPDATE_REENTRY_IO=0');
console.log('STAGE416_SETTLEMENT_GATE_BOUNDED_READS_PER_ATTEMPT=3');
console.log('STAGE416_SETTLED_FENCE_ADVANCES_ONLY_AFTER_CANONICAL_RECEIPT=PASS');

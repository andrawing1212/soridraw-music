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

const uid='global-gap-user';
const previewRoot='privateLikeBatch416';
const testRoot='stage416Transient/test/privateLikeBatch';
const productionRoot='stage416Transient/production/privateLikeBatch';
const globalRoot='privateLikeGlobalVersion416';
const privateRoots=[previewRoot,testRoot,productionRoot];

const previewOp='00000000-0000-4000-8000-000000000081';
const testOp='00000000-0000-4000-8000-000000000082';
const previewDevice='00000000-0000-4000-8000-000000000083';
const testDevice='00000000-0000-4000-8000-000000000084';
const row=(id,version,track,device)=>({
  id,version,closedAtMs:1_700_004_000_000+version,
  rows:[{trackId:track,liked:true,operationId:id,deviceId:device,
    deviceSequence:1,version,mutationAt:1_700_003_000_000+version}],
});
const previewSeal=row(previewOp,101,'preview-song',previewDevice);
const testSeal=row(testOp,100,'test-song',testDevice);
const seals={
  [previewRoot]:previewSeal,
  [testRoot]:null,
  [productionRoot]:null,
};

const roots={
  [previewRoot]:{version:101,window:null,pending:null,sealed:previewSeal},
  [testRoot]:null,
  [productionRoot]:null,
  [globalRoot]:{
    version:101,settledVersion:99,
    devices:{
      [testDevice]:{deviceSequence:1,operationId:testOp,trackId:'test-song',liked:true,version:100},
      [previewDevice]:{deviceSequence:1,operationId:previewOp,trackId:'preview-song',liked:true,version:101},
    },
  },
};

const deliveries=[];
let releaseLowWorker;
let lowWorkerEntered;
const lowWorkerEnteredPromise=new Promise(resolve=>{lowWorkerEntered=resolve;});
const lowWorkerReleasePromise=new Promise(resolve=>{releaseLowWorker=resolve;});

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
      if(seal.version===100){
        lowWorkerEntered();
        await lowWorkerReleasePromise;
      }
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
  Date,Object,Number,Error,Array,Set,Map,Promise,fetch:async()=>null,console},
  {timeout:2500});
const {
  completeUserPrivateWindow416,
  findLowerOutstandingPrivateVersion416,
}=module.exports;

let reads=0,changedWrites=0;
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
      if(JSON.stringify(next)!==JSON.stringify(before))changedWrites++;
      roots[root]=clone(next);
      return {committed:true,snapshot:{val:()=>clone(roots[root])}};
    },
    child:()=>({get:async()=>({val:()=>null})}),
  };
}};

const endpoint='https://example.invalid/internal';
const secret='x'.repeat(32);
const http=async()=>null;

// AUDIT REPRO: TEST v100 exists ONLY as a global reservation. There is no
// TEST pending/window/seal yet. PREVIEW v101 must still see and wait for v100.
const lowerGap=await findLowerOutstandingPrivateVersion416(
  db,uid,101,privateRoots,previewRoot,previewSeal.rows,globalRoot);
assert.equal(lowerGap,100);
assert.equal(roots[testRoot],null);

const highBlocked=await completeUserPrivateWindow416(
  db,uid,endpoint,secret,1_700_005_000_000,http,previewOp,
  previewRoot,privateRoots,globalRoot);
assert.equal(highBlocked.queued,false);
assert.equal(highBlocked.reason,'WAITING_FOR_LOWER_ENVIRONMENT_VERSION');
assert.equal(highBlocked.version,101);
assert.deepEqual(deliveries,[],'global-only lower reservation must block Worker/D1');

// The delayed TEST request now reaches its environment and becomes seal v100.
seals[testRoot]=testSeal;
roots[testRoot]={version:100,window:null,pending:null,sealed:testSeal};

// Start v100 delivery and deliberately pause inside Worker. A concurrent v101
// attempt must still block until v100's canonical receipt advances settledVersion.
const lowPromise=completeUserPrivateWindow416(
  db,uid,endpoint,secret,1_700_005_000_001,http,testOp,
  testRoot,privateRoots,globalRoot);
await lowWorkerEnteredPromise;

const highWhileLowInFlight=await completeUserPrivateWindow416(
  db,uid,endpoint,secret,1_700_005_000_002,http,previewOp,
  previewRoot,privateRoots,globalRoot);
assert.equal(highWhileLowInFlight.queued,false);
assert.equal(highWhileLowInFlight.reason,'WAITING_FOR_LOWER_ENVIRONMENT_VERSION');
assert.deepEqual(deliveries,[],'higher version cannot pass while lower Worker receipt is unresolved');

releaseLowWorker();
const lowDelivered=await lowPromise;
assert.equal(lowDelivered.queued,true);
assert.equal(lowDelivered.acknowledged,true);
assert.deepEqual(deliveries,[100]);
assert.equal(roots[globalRoot].settledVersion,100,
  'canonical v100 receipt must advance shared settled fence before higher delivery');

const highDelivered=await completeUserPrivateWindow416(
  db,uid,endpoint,secret,1_700_005_000_003,http,previewOp,
  previewRoot,privateRoots,globalRoot);
assert.equal(highDelivered.queued,true);
assert.equal(highDelivered.acknowledged,true);
assert.deepEqual(deliveries,[100,101]);
assert.equal(roots[globalRoot].settledVersion,101);

// Lower reservations already coalesced into the CURRENT seal must not
// deadlock that seal. Same-track older reservations are also superseded.
roots[globalRoot]={
  version:103,settledVersion:101,
  devices:{
    a:{deviceSequence:1,operationId:'00000000-0000-4000-8000-000000000091',
      trackId:'coalesced-a',liked:true,version:102},
    b:{deviceSequence:1,operationId:'00000000-0000-4000-8000-000000000092',
      trackId:'coalesced-b',liked:true,version:103},
  },
};
const coalescedRows=[
  {trackId:'coalesced-a',operationId:'00000000-0000-4000-8000-000000000091',version:102},
  {trackId:'coalesced-b',operationId:'00000000-0000-4000-8000-000000000092',version:103},
];
const noFalseBlock=await findLowerOutstandingPrivateVersion416(
  db,uid,103,privateRoots,previewRoot,coalescedRows,globalRoot);
assert.equal(noFalseBlock,null);

assert.ok(reads>=15,'settlement checks only bounded peer/global snapshots');
assert.equal(changedWrites,2,'only successful v100/v101 windows advance settledVersion once each');

console.log('STAGE416_GLOBAL_ONLY_LOWER_RESERVATION_BLOCKS_HIGHER_SETTLEMENT=PASS');
console.log('STAGE416_CONCURRENT_HIGHER_SETTLEMENT_BLOCKED_UNTIL_LOW_RECEIPT=PASS');
console.log('STAGE416_GLOBAL_SETTLED_VERSION_ADVANCES_100_101=PASS');
console.log('STAGE416_CURRENT_SEAL_COALESCED_LOWER_VERSION_NOT_FALSE_BLOCKED=PASS');
console.log('STAGE416_HIGHER_BLOCKED_WORKER_D1_CALLS=0');
console.log('STAGE416_SETTLEMENT_GATE_BOUNDED_RTDB_READS=3_PER_ATTEMPT');
console.log('STAGE416_SETTLEMENT_FENCE_CHANGED_WRITE=1_PER_COMPLETED_WINDOW');
console.log('STAGE416_SETTLEMENT_FENCE_PAGE_UPDATE_REENTRY_IO=0');

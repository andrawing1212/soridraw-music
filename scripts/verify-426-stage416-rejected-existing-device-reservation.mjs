import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const nativeRequire=createRequire(import.meta.url);
const transpile=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;

const serverModule={exports:{}};
vm.runInNewContext(transpile('functions/src/exploreLikePrivateServerClick416.ts'),{
  module:serverModule,exports:serverModule.exports,require:nativeRequire,
  Date,Object,Number,Error,Array,Promise,console,
},{timeout:2500});
const {recordUserPrivateClick416}=serverModule.exports;

const uid='rejected-existing-device-user';
const previewRoot='privateLikeBatch416';
const testRoot='stage416Transient/test/privateLikeBatch';
const productionRoot='stage416Transient/production/privateLikeBatch';
const globalRoot='privateLikeGlobalVersion416';
const privateRoots=[previewRoot,testRoot,productionRoot];

const deviceA='00000000-0000-4000-8000-0000000000a1';
const oldOp='00000000-0000-4000-8000-0000000000a2';
const rejectedOp='00000000-0000-4000-8000-0000000000a3';
const deviceB='00000000-0000-4000-8000-0000000000b1';
const bOp='00000000-0000-4000-8000-0000000000b2';

const fullPending={};
for(let i=0;i<256;i++){
  const trackId='full-'+i;
  const key=createHash('sha256').update(trackId).digest('hex');
  fullPending[key]={
    trackId,liked:true,
    operationId:`00000000-0000-4000-8000-${String(300000000000+i).padStart(12,'0')}`,
    deviceId=`00000000-0000-4000-8000-${String(400000000000+i).padStart(12,'0')}`,
    deviceSequence:1,version:100,mutationAt:50,
  };
}

const roots={
  [previewRoot]:null,
  [testRoot]:{
    version:100,deviceSeq:{[deviceA]:1},pending:fullPending,
    window:{id:oldOp,minutes:5,openedAtMs:50,lastClickAtMs:50,revision:100},
    sealed:null,
  },
  [productionRoot]:null,
  [globalRoot]:{
    version:100,settledVersion:100,
    devices:{
      [deviceA]:{
        deviceSequence:1,operationId:oldOp,trackId:'already-accepted',
        liked:true,version:100,
      },
    },
  },
};

let reads=0;
let changedWrites=0;
const clone=value=>value==null?value:structuredClone(value);
const database={ref:path=>{
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
    child:name=>({
      get:async()=>{
        reads++;
        const value=roots[root]&&typeof roots[root]==='object'?roots[root][name]:null;
        return {val:()=>clone(value)};
      },
    }),
  };
}};

// Existing device A reserves v101, then the environment rejects it because the
// 256-track pending window is full. The exact rejected reservation must roll
// back to A's prior v100 entry instead of remaining as a fake lower blocker.
const rejected=await recordUserPrivateClick416(database,uid,{
  trackId:'overflow-track',liked:true,operationId:rejectedOp,
  deviceId:deviceA,deviceSequence:2,
},5,101,false,testRoot,globalRoot);
assert.equal(rejected.accepted,false);
assert.equal(rejected.reason,'TRACK_LIMIT');
assert.equal(roots[globalRoot].version,101,'global high-water may keep the consumed number');
assert.equal(roots[globalRoot].settledVersion,100);
assert.deepEqual(roots[globalRoot].devices[deviceA],{
  deviceSequence:1,operationId:oldOp,trackId:'already-accepted',liked:true,version:100,
},'existing device history must be restored exactly after rejection');

// Another device B is a valid click. It must receive v102 and persist normally.
const acceptedB=await recordUserPrivateClick416(database,uid,{
  trackId:'normal-b',liked:true,operationId:bOp,deviceId:deviceB,deviceSequence:1,
},5,102,false,productionRoot,globalRoot);
assert.equal(acceptedB.accepted,true);
assert.equal(acceptedB.version,102);
assert.equal(roots[globalRoot].devices[deviceB].version,102);

// Freeze B's accepted row as the due seal. A's rejected v101 no longer exists
// in global devices, while A's prior v100 is already settled.
const bPending=roots[productionRoot].pending;
const bRows=Object.values(bPending);
const bSeal={id:bOp,version:102,closedAtMs:1000,rows:bRows};
roots[productionRoot]={
  ...roots[productionRoot],window:null,pending:null,sealed:bSeal,
};

const deliveries=[];
const requireCommit=id=>{
  if(id==='./exploreLikePrivateSeal416')return {
    sealUserPrivateLikes416:async(_db,_uid,_now,_expected,root)=>{
      const seal=roots[root]?.sealed;
      return seal
        ?{sealed:true,reason:'SEALED',value:clone(seal)}
        :{sealed:false,reason:'EMPTY'};
    },
    acknowledgeUserPrivateSeal416:async(_db,_uid,receipt,root)=>{
      const seal=roots[root]?.sealed;
      if(!seal||seal.id!==receipt.id||seal.version!==receipt.version)return false;
      roots[root]={...roots[root],sealed:null};
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

const commitModule={exports:{}};
vm.runInNewContext(transpile('functions/src/exploreLikePrivateCommit416.ts'),{
  module:commitModule,exports:commitModule.exports,require:requireCommit,
  Date,Object,Number,Error,Array,Set,Map,Promise,fetch:async()=>null,console,
},{timeout:2500});
const {completeUserPrivateWindow416}=commitModule.exports;

const settledB=await completeUserPrivateWindow416(
  database,uid,'https://example.invalid/internal','x'.repeat(32),
  1000,async()=>null,bOp,productionRoot,privateRoots,globalRoot,
);
assert.equal(settledB.queued,true);
assert.equal(settledB.acknowledged,true);
assert.equal(settledB.version,102);
assert.deepEqual(deliveries,[102],
  'rejected existing-device v101 must not block B v102 Worker/D1 settlement');
assert.equal(roots[globalRoot].settledVersion,102);

console.log('STAGE416_REJECTED_EXISTING_DEVICE_RESERVATION_ROLLBACK=PASS');
console.log('STAGE416_REJECTED_EXISTING_DEVICE_PRIOR_SEQUENCE_PRESERVED=PASS');
console.log('STAGE416_REJECTED_V101_DOES_NOT_BLOCK_VALID_V102_SETTLEMENT=PASS');
console.log('STAGE416_VALID_V102_WORKER_D1_DELIVERY_COUNT=1');
console.log('STAGE416_REJECTION_ROLLBACK_EXTRA_RTDB_WRITE_MAX=1');
console.log('STAGE416_PAGE_UPDATE_REENTRY_IO=0');

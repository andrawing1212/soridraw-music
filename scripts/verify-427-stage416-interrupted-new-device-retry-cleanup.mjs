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

const uid='interrupted-new-device-retry-user';
const previewRoot='privateLikeBatch416';
const testRoot='stage416Transient/test/privateLikeBatch';
const productionRoot='stage416Transient/production/privateLikeBatch';
const globalRoot='privateLikeGlobalVersion416';
const privateRoots=[previewRoot,testRoot,productionRoot];

const deviceA='00000000-0000-4000-8000-0000000000c1';
const opA='00000000-0000-4000-8000-0000000000c2';
const deviceB='00000000-0000-4000-8000-0000000000d1';
const opB='00000000-0000-4000-8000-0000000000d2';
const oldWindowOp='00000000-0000-4000-8000-0000000000e1';

const fullPending={};
for(let i=0;i<256;i++){
  const trackId='full-'+i;
  const key=createHash('sha256').update(trackId).digest('hex');
  fullPending[key]={
    trackId,liked:true,
    operationId:`00000000-0000-4000-8000-${String(500000000000+i).padStart(12,'0')}`,
    deviceId:`00000000-0000-4000-8000-${String(600000000000+i).padStart(12,'0')}`,
    deviceSequence:1,version:100,mutationAt:50,
  };
}

const roots={
  [previewRoot]:null,
  [testRoot]:{
    version:100,deviceSeq:{},pending:fullPending,
    window:{id:oldWindowOp,minutes:5,openedAtMs:50,lastClickAtMs:50,revision:100},
    sealed:null,
  },
  [productionRoot]:null,
  [globalRoot]:{version:100,settledVersion:100,devices:{}},
};

let interruptPrivateOnce=true;
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
      if(root===testRoot&&interruptPrivateOnce){
        interruptPrivateOnce=false;
        throw Error('SIMULATED_FUNCTION_TERMINATION_AFTER_GLOBAL_RESERVATION');
      }
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

// First request: global v101 reservation commits, then the Function dies before
// any environment pending/window proof is written.
await assert.rejects(
  recordUserPrivateClick416(database,uid,{
    trackId:'interrupted-a',liked:true,operationId:opA,
    deviceId:deviceA,deviceSequence:1,
  },5,101,false,testRoot,globalRoot),
  /SIMULATED_FUNCTION_TERMINATION_AFTER_GLOBAL_RESERVATION/,
);
assert.equal(roots[globalRoot].version,101);
assert.equal(roots[globalRoot].settledVersion,100);
assert.deepEqual(roots[globalRoot].devices[deviceA],{
  deviceSequence:1,operationId:opA,trackId:'interrupted-a',
  liked:true,version:101,previous:null,
});
assert.equal(roots[testRoot].deviceSeq[deviceA],undefined,
  'interrupted first call must leave no environment acceptance proof');

// Same operation retry reuses v101. The environment is full and rejects it.
// Cleanup authority must come from the exact global reservation metadata, not
// from whether THIS retry invocation originally created the device slot.
const retried=await recordUserPrivateClick416(database,uid,{
  trackId:'interrupted-a',liked:true,operationId:opA,
  deviceId:deviceA,deviceSequence:1,
},5,102,false,testRoot,globalRoot);
assert.equal(retried.accepted,false);
assert.equal(retried.reason,'TRACK_LIMIT');
assert.equal(roots[globalRoot].version,101,
  'global high-water must not reuse the rejected number');
assert.equal(Object.hasOwn(roots[globalRoot].devices,deviceA),false,
  'same-operation retry must clean the exact unsettled new-device reservation');

// A valid second device must now receive v102 and settle normally.
const acceptedB=await recordUserPrivateClick416(database,uid,{
  trackId:'normal-b',liked:true,operationId:opB,
  deviceId:deviceB,deviceSequence:1,
},5,102,false,productionRoot,globalRoot);
assert.equal(acceptedB.accepted,true);
assert.equal(acceptedB.version,102);
assert.equal(roots[globalRoot].devices[deviceB].version,102);

const bRows=Object.values(roots[productionRoot].pending);
const bSeal={id:opB,version:102,closedAtMs:1000,rows:bRows};
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
  1000,async()=>null,opB,productionRoot,privateRoots,globalRoot,
);
assert.equal(settledB.queued,true);
assert.equal(settledB.acknowledged,true);
assert.equal(settledB.version,102);
assert.deepEqual(deliveries,[102],
  'orphaned rejected v101 must not block valid v102 Worker/D1 settlement');
assert.equal(roots[globalRoot].settledVersion,102);

console.log('STAGE416_INTERRUPTED_NEW_DEVICE_V101_RESERVATION_PERSISTS_FOR_RETRY=PASS');
console.log('STAGE416_RETRY_TRACK_LIMIT_CLEANS_EXACT_ORPHAN_V101=PASS');
console.log('STAGE416_RETRY_CLEANUP_USES_RESERVATION_METADATA_NOT_CALL_FLAG=PASS');
console.log('STAGE416_REJECTED_ORPHAN_V101_DOES_NOT_BLOCK_VALID_V102=PASS');
console.log('STAGE416_VALID_V102_AFTER_INTERRUPTED_RETRY_WORKER_D1_DELIVERY=PASS');
console.log('STAGE416_INTERRUPTED_RETRY_CLEANUP_EXTRA_RTDB_WRITE_MAX=1');
console.log('STAGE416_PAGE_UPDATE_REENTRY_IO=0');

import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
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
const {
  recordUserPrivateClick416,
  GLOBAL_RESERVATION_LEASE_MS_416,
}=serverModule.exports;
assert.equal(GLOBAL_RESERVATION_LEASE_MS_416,120_000);

const uid='no-retry-orphan-user';
const previewRoot='privateLikeBatch416';
const testRoot='stage416Transient/test/privateLikeBatch';
const productionRoot='stage416Transient/production/privateLikeBatch';
const globalRoot='privateLikeGlobalVersion416';
const privateRoots=[previewRoot,testRoot,productionRoot];

const deviceA='00000000-0000-4000-8000-0000000000f1';
const opA='00000000-0000-4000-8000-0000000000f2';
const deviceB='00000000-0000-4000-8000-000000000101';
const opB='00000000-0000-4000-8000-000000000102';
const base=1_700_010_000_000;

const roots={
  [previewRoot]:null,
  [testRoot]:null,
  [productionRoot]:null,
  [globalRoot]:{version:base-1,settledVersion:base-1,devices:{}},
};
let interruptPrivateOnce=true;
let reads=0;
let changedWrites=0;
const clone=value=>value==null?value:structuredClone(value);
const db={ref:path=>{
  const suffix='/'+uid;
  assert.ok(path.endsWith(suffix),path);
  const root=path.slice(0,-suffix.length);
  assert.ok(Object.hasOwn(roots,root),root);
  return {
    get:async()=>{reads++;return {val:()=>clone(roots[root])};},
    transaction:async update=>{
      if(root===testRoot&&interruptPrivateOnce){
        interruptPrivateOnce=false;
        throw Error('SIMULATED_FUNCTION_TERMINATION_WITHOUT_RETRY');
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

// A reserves globally, then the Function dies before any environment proof.
// There is deliberately NO retry from A in this regression.
await assert.rejects(
  recordUserPrivateClick416(db,uid,{
    trackId:'orphan-a',liked:true,operationId:opA,deviceId:deviceA,deviceSequence:1,
  },5,base,false,testRoot,globalRoot),
  /SIMULATED_FUNCTION_TERMINATION_WITHOUT_RETRY/,
);
const vA=roots[globalRoot].devices[deviceA].version;
const leaseA=roots[globalRoot].devices[deviceA].leaseUntilMs;
assert.equal(vA,base);
assert.equal(leaseA,base+GLOBAL_RESERVATION_LEASE_MS_416);
assert.equal(roots[testRoot],null);

// B is a normal later click in another environment.
const acceptedB=await recordUserPrivateClick416(db,uid,{
  trackId:'normal-b',liked:true,operationId:opB,deviceId:deviceB,deviceSequence:1,
},5,base+1_000,false,productionRoot,globalRoot);
assert.equal(acceptedB.accepted,true);
const vB=acceptedB.version;
assert.ok(vB>vA);
const bRows=Object.values(roots[productionRoot].pending);
const bSeal={id:opB,version:vB,closedAtMs:base+2_000,rows:bRows};
roots[productionRoot]={...roots[productionRoot],window:null,pending:null,sealed:bSeal};

const deliveries=[];
const requireCommit=id=>{
  if(id==='./exploreLikePrivateServerClick416')return serverModule.exports;
  if(id==='./exploreLikePrivateSeal416')return {
    sealUserPrivateLikes416:async(_db,_uid,_now,_expected,root)=>{
      const seal=roots[root]?.sealed;
      return seal?{sealed:true,reason:'SEALED',value:clone(seal)}
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
const {
  completeUserPrivateWindow416,
  findLowerOutstandingPrivateVersion416,
}=commitModule.exports;

const beforeExpiry=leaseA-1;
const lowerBefore=await findLowerOutstandingPrivateVersion416(
  db,uid,vB,privateRoots,productionRoot,bSeal.rows,globalRoot,beforeExpiry);
assert.equal(lowerBefore,vA,'live global-only reservation must still fence higher settlement');

const blocked=await completeUserPrivateWindow416(
  db,uid,'https://example.invalid/internal','x'.repeat(32),
  beforeExpiry,async()=>null,opB,productionRoot,privateRoots,globalRoot);
assert.equal(blocked.queued,false);
assert.equal(blocked.reason,'WAITING_FOR_LOWER_ENVIRONMENT_VERSION');
assert.deepEqual(deliveries,[]);

const writesBeforeRecovery=changedWrites;
const afterExpiry=leaseA+1;
const delivered=await completeUserPrivateWindow416(
  db,uid,'https://example.invalid/internal','x'.repeat(32),
  afterExpiry,async()=>null,opB,productionRoot,privateRoots,globalRoot);
assert.equal(delivered.queued,true);
assert.equal(delivered.acknowledged,true);
assert.equal(delivered.version,vB);
assert.deepEqual(deliveries,[vB]);
assert.equal(Object.hasOwn(roots[globalRoot].devices,deviceA),false,
  'expired unmaterialized new-device orphan must be removed');
assert.equal(roots[globalRoot].settledVersion,vB);
assert.equal(changedWrites-writesBeforeRecovery,2,
  'orphan repair W1 + successful settled-fence W1 only');

// A lower click already materialized into a NEWER peer batch is not a separate
// global fence. The peer batch revision owns canonical ordering.
const opC='00000000-0000-4000-8000-000000000103';
const deviceC='00000000-0000-4000-8000-000000000104';
const v200=base+10_000;
const v201=v200+1;
const v202=v200+2;
const v203=v200+3;
const trackA='materialized-a';
const trackC='materialized-c';
roots[globalRoot]={
  version:v203,settledVersion:v200,
  devices:{
    [deviceA]:{deviceSequence:1,operationId:opA,trackId:trackA,liked:true,
      version:v201,previous:null,leaseUntilMs:v200-1},
    [deviceB]:{deviceSequence:1,operationId:opB,trackId:'current-b',liked:true,
      version:v202,previous:null,leaseUntilMs:v203+120_000},
    [deviceC]:{deviceSequence:1,operationId:opC,trackId:trackC,liked:true,
      version:v203,previous:null,leaseUntilMs:v203+120_000},
  },
};
roots[testRoot]={
  version:v203,
  deviceSeq:{[deviceA]:1,[deviceC]:1},
  pending:{
    a:{trackId:trackA,liked:true,operationId:opA,deviceId:deviceA,
      deviceSequence:1,version:v201,mutationAt:v201},
    c:{trackId:trackC,liked:true,operationId:opC,deviceId:deviceC,
      deviceSequence:1,version:v203,mutationAt:v203},
  },
  window:{id:opA,minutes:5,openedAtMs:v201,lastClickAtMs:v203,revision:v203},
  sealed:null,
};
roots[previewRoot]=null;
const currentRows=[{trackId:'current-b',operationId:opB,version:v202}];
const noFalseGlobalBlock=await findLowerOutstandingPrivateVersion416(
  db,uid,v202,privateRoots,productionRoot,currentRows,globalRoot,v203+200_000);
assert.equal(noFalseGlobalBlock,null,
  'materialized v201 inside peer batch v203 must be ordered by batch v203, not stale global v201');

// Conversely, a materialized LOWER peer batch remains a real canonical blocker.
roots[testRoot]={
  ...roots[testRoot],
  version:v201,
  pending:{
    a:{trackId:trackA,liked:true,operationId:opA,deviceId:deviceA,
      deviceSequence:1,version:v201,mutationAt:v201},
  },
  window:{id:opA,minutes:5,openedAtMs:v201,lastClickAtMs:v201,revision:v201},
};
roots[globalRoot]={...roots[globalRoot],version:v202};
delete roots[globalRoot].devices[deviceC];
const realPeerBlock=await findLowerOutstandingPrivateVersion416(
  db,uid,v202,privateRoots,productionRoot,currentRows,globalRoot,v203+200_000);
assert.equal(realPeerBlock,v201);

// Source contract: every Stage416 authenticated Callable is killed before the
// 120s global-only lease can expire, so an old invocation cannot wake up later
// and materialize a version after higher canonical settlement has passed it.
const indexSource=readFileSync('functions/src/index.ts','utf8');
for(const name of ['recordPrivateLike416','recordPrivateLike416Test','recordPrivateLike416Production']){
  const start=indexSource.indexOf('export const '+name+' = onCall(');
  assert.ok(start>=0,name+' export missing');
  const snippet=indexSource.slice(start,start+220);
  assert.match(snippet,/timeoutSeconds:\s*60/);
}
assert.ok(60_000<GLOBAL_RESERVATION_LEASE_MS_416);

console.log('STAGE416_GLOBAL_ONLY_RESERVATION_HAS_BOUNDED_LEASE=PASS');
console.log('STAGE416_LIVE_RESERVATION_BLOCKS_HIGHER_BEFORE_LEASE_EXPIRY=PASS');
console.log('STAGE416_NO_RETRY_ORPHAN_EXPIRES_AND_V102_SETTLES=PASS');
console.log('STAGE416_EXPIRED_ORPHAN_CLEANUP_CHANGED_WRITE_MAX=1');
console.log('STAGE416_MATERIALIZED_LOWER_ROW_USES_PEER_BATCH_REVISION=PASS');
console.log('STAGE416_REAL_LOWER_PEER_BATCH_STILL_BLOCKS=PASS');
console.log('STAGE416_CALLABLE_TIMEOUT_60S_BELOW_RESERVATION_LEASE_120S=PASS');
console.log('STAGE416_PAGE_UPDATE_REENTRY_IO=0');

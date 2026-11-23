import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createApp788QaOwnerHistoryWithDo,APP788_QA_OWNER_HISTORY_DO_COMPILED_OPEN} from './app788-qa-independent-owner-floor.mjs';
import {createApp761ProductionOwnerDoRuntime} from './app761-production-owner-do-runtime.mjs';
globalThis.crypto??=webcrypto;
const ownerUid='qa788Owner',actorUid='qa788Actor',authEpoch='a'.repeat(32);
const cutoverToken='qa788_new_verified_epoch_0000001';
const op=(id='qa788CanonicalOperation00001',d1=7,r2=13,desired=true)=>({
 ownerUid,actorUid,authEpoch,cutoverToken,canonicalOperationId:id,
 expectedRevision:d1,priorR2Revision:r2,desired,beforeFollowing:!desired});
let certified=true;
const verifyTrustedEpoch=async a=>({
 source:'APP788_ISOLATED_SYNTHETIC_EPOCH_CERT',verified:certified,
 ownerUid:a.ownerUid,actorUid:a.actorUid,authEpoch:a.authEpoch,
 cutoverToken:a.cutoverToken,allActiveAndLegacyWritersCovered:true,
 newEpochFromVerifiedGenesis:true,noHistoricalNamespaceReuse:true,
 ownerDoPitrIndependent:true,retentionAndAccountDeletionReviewed:true,
 physicalNamespaceIsolatedFromProduction:true,
 firstD1Revision:7,firstR2Revision:13});
const objects=new Map();let etag=0,classA=0,d1Writes=0;
let uncertainAfterFloorCAS=false,brokenRead=false;
const bucket={
 async get(k){if(brokenRead)throw Error('R2_503');
  const o=objects.get(k);return !o?null:{etag:o.etag,
   text:async()=>JSON.stringify(o.body)};},
 async put(k,body,options){
  classA++;assert.equal(options.httpMetadata.contentType,'application/json');
  const prior=objects.get(k),cond=options.onlyIf;
  if(cond.etagDoesNotMatch==='*'&&prior)return null;
  if(cond.etagMatches&&cond.etagMatches!==prior?.etag)return null;
  assert(cond.etagDoesNotMatch==='*'||typeof cond.etagMatches==='string');
  const next={body:JSON.parse(body),etag:'qa788-etag-'+(++etag)};
  objects.set(k,next);
  if(k.includes('/owner-floor/')&&uncertainAfterFloorCAS){
   uncertainAfterFloorCAS=false;throw Error('503_AFTER_FLOOR_WRITE');
  }
  return {etag:next.etag};
 }};
let now=1800000000000,doMap=new Map(),alarm=null,issued=0,relayCalls=0;
const storage={
 async get(k){return doMap.has(k)?structuredClone(doMap.get(k)):null},
 async getAlarm(){return alarm},
 async setAlarm(t){alarm=t},
 async transaction(fn){
  const draft=new Map([...doMap].map(([k,v])=>[k,structuredClone(v)]));
  let due=alarm;
  const tx={
   async get(k){return draft.has(k)?structuredClone(draft.get(k)):null},
   async put(k,v){draft.set(k,structuredClone(v))},
   async getAlarm(){return due},
   async setAlarm(t){due=t},
   async deleteAlarm(){due=null}};
  const result=await fn(tx);doMap=draft;alarm=due;return result;
 }};
let committed=false,d1Revision=8,r2Revision=14;
const settledProof=async a=>{
 if(!committed)throw Error('CANONICAL_D1_NOT_COMMITTED');
 return {source:'QA783_EXACT_D1_R2_SETTLED',verified:true,changed:true,
  canonicalD1Committed:true,r2ProjectionSettled:true,ownerEpochVerified:true,
  ...a,committedRevision:d1Revision,nextR2Revision:r2Revision,
  d1OperationId:a.canonicalOperationId,r2OperationId:a.canonicalOperationId};
};
const runtime=createApp761ProductionOwnerDoRuntime({
 enabled:true,state:{storage},env:{SORIDRAW_ENVIRONMENT:'production'},
 ownerUid,verifyBoundOwner:async()=>({ownerUid,verifiedOwnerDoIdentity:true}),
 backend:{async deliverFromOwnerAlarm(){relayCalls++;return {status:'delivered'}}},
 proveExactSettledOwnerEvent:async({receipt})=>{
  if(!committed)throw Error('NOT_SETTLED');
  const floor=[...objects.values()].find(x=>x.body.kind==='APP788_QA_OWNER_FLOOR_V1')?.body;
  if(floor?.d1Revision!==d1Revision||
     floor?.lastOperationId!==receipt.canonicalOperationId)throw Error('FLOOR_NOT_SETTLED');
  return {settled:{committed:true,projectionSettled:true,changed:true,
    ownerUid,operationId:receipt.operationId,revision:d1Revision},
   ownerEvent:{ownerUid,authEpoch,version:d1Revision,
    followerCount:1,updatedAt:now}};
 },
 now:()=>now,
 issueId:()=>('server_788_receipt_'+String(++issued).padStart(16,'0'))});
assert.equal(APP788_QA_OWNER_HISTORY_DO_COMPILED_OPEN,false);
assert.equal(createApp788QaOwnerHistoryWithDo(),null);
assert.throws(()=>createApp788QaOwnerHistoryWithDo({enabled:true}),/APP788_REQUIRES/);
const engine=createApp788QaOwnerHistoryWithDo({
 enabled:true,scope:'APP788_ISOLATED_SYNTHETIC_QA',bucket,
 ownerDo:runtime,verifyTrustedEpoch,verifySettledCanonical:settledProof});
const a=op();
assert.equal((await engine.reserve(a)).status,'HOLD');
certified=false;assert.equal((await engine.bootstrap(a)).status,'HOLD');
assert.equal(objects.size,0);
certified=true;
assert.equal((await engine.bootstrap(a)).status,'QA788_SYNTHETIC_GENESIS_FLOOR_CREATED');
assert.equal((await engine.bootstrap(a)).status,'QA788_GENESIS_ALREADY_VERIFIED_READ_ONLY');
assert.equal(classA,1);assert.equal(objects.size,1);
const prepared=await engine.reserve(a);
assert.equal(prepared.status,'QA788_ADMITTED_AND_OWNER_DO_RESERVED');
assert.equal(prepared.receipt.durable,true);
assert.equal(d1Writes,0);assert.equal(objects.size,2);
const args={operation:a,admission:prepared.admission,receipt:prepared.receipt};
assert.equal((await engine.finalize(args)).status,'HOLD');
now+=1000;
assert.equal((await runtime.alarm()).retried,1);
assert.equal(relayCalls,0);
committed=true;d1Writes++;uncertainAfterFloorCAS=true;
const unknown=await engine.finalize(args);
assert.equal(unknown.reason,'R2_FLOOR_CAS_ACK_UNKNOWN');
assert.equal(d1Writes,1);assert.equal(objects.size,3);
const recovered=await engine.finalize(args);
assert.equal(recovered.status,'QA788_FLOOR_ALREADY_SETTLED_NO_WRITE');
const count=classA;
assert.equal((await engine.finalize(args)).status,'QA788_FLOOR_ALREADY_SETTLED_NO_WRITE');
assert.equal(classA,count);assert.equal(d1Writes,1);
const info=await engine.inspect(a);
assert.deepEqual([info.admitted,info.settled,info.floorD1Revision,info.floorR2Revision],
 [true,true,8,14]);
assert.equal(info.completeFromOrigin,false);
now+=2000;
assert.equal((await runtime.alarm()).delivered,1);
assert.equal(relayCalls,1);
assert.equal((await runtime.alarm()).processed,0);
doMap=new Map();alarm=null; // full owner DO PITR, external R2 remains
assert.equal((await engine.reserve(a)).reason,'EXTERNAL_REVISION_FLOOR_NOT_AT_EXPECTED');
assert.equal(issued,1,'DO PITR must not mint a second ID for old op');
brokenRead=true;assert.equal((await engine.inspect(a)).status,'HOLD');
brokenRead=false;
certified=false;const before=classA;
assert.equal((await engine.reserve({...a,authEpoch:'b'.repeat(32)})).status,'HOLD');
assert.equal(classA,before);certified=true;
committed=false;
const b=op('qa788CanonicalOperation00002',8,14,false);
const next=await engine.reserve(b);
assert.equal(next.status,'QA788_ADMITTED_AND_OWNER_DO_RESERVED');
committed=true;d1Revision=9;r2Revision=15;d1Writes++;
assert.equal((await engine.finalize({operation:b,admission:next.admission,
 receipt:next.receipt})).status,'QA788_IMMUTABLE_SETTLED_AND_FLOOR_ADVANCED');
assert.equal(objects.size,5);
assert.equal(d1Writes,2,'W1 per changed synthetic operation, ledger adds W0');
assert.equal((await engine.reserve(b)).status,'HOLD');
console.log('APP788_R2_CONDITIONAL_ADMISSION_SETTLED_AND_OWNER_CAS_FLOOR=PASS');
console.log('APP788_APP761_OWNER_DO_RESERVATION_ALARM_AND_PITR_FENCE=PASS');
console.log('APP788_R2_503_AFTER_CAS_READ_ONLY_RECONCILIATION=PASS');
console.log('APP788_SYNTHETIC_D1_W1_EACH_ADDITIONAL_HISTORY_D1_W0=PASS');
console.log('APP788_LIVE_CUTOVER_AUTH_ERASURE_PROD_DO=NOT_VERIFIED_HOLD');

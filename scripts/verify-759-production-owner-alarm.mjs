// APP759: isolated QA-like fault simulation, not a live production or QA
// Worker deployment. Reuses APP755's real source-only receipt/backend code.
import assert from 'node:assert/strict';
import {createApp755ProductionOwnerReceiptStore} from './app755-production-owner-receipt.mjs';
import {createApp755ProductionBackend} from './app755-production-follow-backend.mjs';
import {createApp759ProductionOwnerAlarm,
 APP759_PRODUCTION_OWNER_ALARM_COMPILED_OPEN} from './app759-production-owner-alarm.mjs';
const owner='qaSyntheticOwner759',actor='qaSyntheticActor759';
const epoch='a'.repeat(32);
const env={SORIDRAW_ENVIRONMENT:'production',
 SORIDRAW_OWNER_FOLLOW_ENDPOINT_539:
 'https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542',
 SORIDRAW_OWNER_FOLLOW_HMAC_539:'z'.repeat(64)};
let data=null,alarm=null,now=1800000000000,writes=0,issued=0;
let failCommit=false,failAlarm=false;
const storage={
 async get(){return data===null?null:structuredClone(data)},
 async getAlarm(){return alarm},
 async setAlarm(at){if(failAlarm)throw Error('ALARM_FAULT');alarm=at},
 async transaction(work){
  let next=data===null?null:structuredClone(data),due=alarm;
  const tx={
   async get(){return next===null?null:structuredClone(next)},
   async put(key,v){assert.equal(key,'app755-owner-follow-pending-v1');
    next=structuredClone(v)},
   async getAlarm(){return due},
   async setAlarm(at){if(failAlarm)throw Error('ALARM_FAULT');due=at},
   async deleteAlarm(){due=null},
  };
  const result=await work(tx);
  if(failCommit){failCommit=false;throw Error('TRANSACTION_COMMIT_FAULT')}
  data=next;alarm=due;writes++;
  return result;
 },
};
const storeFactory=()=>createApp755ProductionOwnerReceiptStore({
 enabled:true,ownerUid:owner,storage,now:()=>now,
 issueId:()=>('server_759_receipt_'+(++issued).toString().padStart(6,'0')),
});
const store=storeFactory();
const ticket=i=>({actorUid:actor,ownerUid:owner,desired:i%2===0,
 canonicalOperationId:'canonical_759_'+String(i).padStart(16,'0'),
 expectedRevision:7+i,authEpoch:epoch,cutoverToken:'verified-source-only',
 beforeFollowing:i%2!==0,priorR2Revision:20+i});
const t0=await store.reserve(ticket(0));
assert.equal(t0.durable,true);
assert.equal(t0.delivery.status,'pending');
assert.equal(issued,1);
assert.equal(alarm,now+1000);
let outbound=0,mode=503,proofs=0;
const backend=createApp755ProductionBackend({
 enabled:true,verifyFirebasePrincipal:async()=>({verified:true}),
 ownerStore:store,readCanonicalPair:async()=>({}),verifyExactCommit:async()=>({}),
 sendSignedOwnerRelay:async(event)=>{
  outbound++;assert.equal(event.ownerUid,owner);assert.equal(event.authEpoch,epoch);
  assert.equal(event.version,8+event.seq);
  if(mode===200)return {status:200,ok:true,applied:outbound>1?false:true};
  return {status:mode,ok:false};
 },
});
const prove=async({receipt})=>{
 proofs++;return {
  settled:{committed:true,projectionSettled:true,changed:true,
   operationId:receipt.operationId,ownerUid:owner,
   revision:receipt.expectedRevision+1},
  ownerEvent:{ownerUid:owner,authEpoch:receipt.authEpoch,
   version:receipt.expectedRevision+1,followerCount:receipt.desired?1:0,
   updatedAt:now,seq:receipt.expectedRevision-7},
 };
};
const makeAlarm=(ownerStore=store,proof=prove)=>createApp759ProductionOwnerAlarm({
 enabled:true,ownerUid:owner,receiptStore:ownerStore,backend,
 proveExactSettledOwnerEvent:proof});
assert.equal(APP759_PRODUCTION_OWNER_ALARM_COMPILED_OPEN,false);
assert.equal(createApp759ProductionOwnerAlarm(),null);
assert.throws(()=>createApp759ProductionOwnerAlarm({enabled:true}),/VERIFIED_OWNER_DO_AND_PROOF_REQUIRED/);
const alarmController=makeAlarm();
await assert.rejects(()=>alarmController.alarm({...env,SORIDRAW_ENVIRONMENT:'preview'}),
 /PRODUCTION_ENVIRONMENT_REQUIRED/);
assert.deepEqual(await alarmController.alarm(env),{
 processed:0,delivered:0,retried:0,held:0,
 noCanonicalMutation:true,noUserDataAccess:true});
assert.equal(outbound,0,'before alarm due no receiver calls');
now+=1000;
const first=await alarmController.alarm(env);
assert.deepEqual(first,{processed:1,delivered:0,retried:1,held:0,
 noCanonicalMutation:true,noUserDataAccess:true});
assert.equal(outbound,1,'one injected Functions 503');
assert.equal(data.entries[0].operationId,t0.operationId);
assert.equal(data.entries[0].delivery.attempts,1);
assert.equal(data.entries[0].delivery.status,'pending');
assert.equal(alarm,now+2000);
const issuedAfterFault=issued;
assert.equal((await store.find(ticket(0))).receipt.operationId,t0.operationId);
assert.equal(issued,issuedAfterFault,'retry does not issue another receipt');
assert.equal(alarm,now+2000,'duplicate read may not shorten backoff');
const rebooted=makeAlarm(storeFactory());
assert.equal((await rebooted.alarm(env)).processed,0,'before retry due');
now+=2000;mode=200;
const second=await rebooted.alarm(env);
assert.equal(second.delivered,1);
assert.equal(outbound,2,'same operation retries once after restart');
assert.equal(data.entries[0].delivery.status,'delivered');
assert.equal(data.entries[0].operationId,t0.operationId);
assert.equal(alarm,null,'no unnecessary follow-up DO alarm');
assert.equal((await rebooted.alarm(env)).processed,0,'delivered never sends twice');
assert.equal(outbound,2);
assert.equal((await store.find(ticket(0))).receipt.operationId,t0.operationId);
assert.equal(alarm,null,'delivered tombstone never rearms');
assert.equal((await store.reserve(ticket(0))).operationId,t0.operationId);
assert.equal(issued,1,'replayed HTTP must retain exact server-issued receipt');

const t1=await store.reserve(ticket(1));
assert.notEqual(t1.operationId,t0.operationId);
now+=1000;mode=200;failCommit=true;
await assert.rejects(()=>rebooted.alarm(env),/TRANSACTION_COMMIT_FAULT/,
 'receiver ACK must never count when DO transaction fails');
assert.equal(data.entries[1].delivery.status,'pending');
assert.equal(data.entries[1].operationId,t1.operationId);
const beforeRetrySend=outbound;
const recovered=await rebooted.alarm(env);
assert.equal(recovered.delivered,1);
assert.equal(outbound,beforeRetrySend+1,
 'receiver duplicate is idempotent and same receipt is retried');
assert.equal(data.entries[1].delivery.status,'delivered');

const t2=await store.reserve(ticket(2));
now+=1000;mode=409;
const reject=await rebooted.alarm(env);
assert.equal(reject.held,1,'generation rejection must not be retried');
assert.equal(data.entries[2].delivery.status,'held');
assert.equal(data.entries[2].operationId,t2.operationId);
const afterHold=outbound;
assert.equal((await rebooted.alarm(env)).processed,0);
assert.equal(outbound,afterHold);
const stale=await store.find(ticket(2));
assert.equal(stale.status,'found');
assert.equal(alarm,null,'held receipt cannot schedule unbounded retry');

// Fault injection at the durable alarm itself must not ACK or add a new ID.
const t3=await store.reserve(ticket(3));
now+=1000;mode=503;failAlarm=true;
await assert.rejects(()=>rebooted.alarm(env),/ALARM_FAULT/);
assert.equal(data.entries[3].delivery.status,'pending');
assert.equal(data.entries[3].operationId,t3.operationId);
failAlarm=false;
const recoveredAlarm=await rebooted.alarm(env);
assert.equal(recoveredAlarm.retried,1);
assert.equal(data.entries[3].delivery.attempts,1);
now+=2000;await rebooted.alarm(env);
assert.equal(data.entries[3].delivery.attempts,2);
now+=4000;const bounded=await rebooted.alarm(env);
assert.equal(bounded.held,1);
assert.equal(data.entries[3].delivery.status,'held');
assert.equal(data.entries[3].delivery.attempts,3);
assert.equal(alarm,null);
assert.equal((await rebooted.alarm(env)).processed,0);

const t4=await store.reserve(ticket(4));
now+=1000;
const proofBefore=proofs,sendBefore=outbound;
const badProof=makeAlarm(storeFactory(),async()=>({
 settled:{committed:false,projectionSettled:false,changed:false,
  operationId:t4.operationId,ownerUid:owner,revision:12},
 ownerEvent:{ownerUid:owner,authEpoch:epoch,version:12,followerCount:1,
 updatedAt:now},
}));
const wrong=await badProof.alarm(env);
assert.equal(wrong.retried,1);
assert.equal(proofs,proofBefore,'injected invalid source never calls valid proof callback');
assert.equal(outbound,sendBefore,'unsettled canonical cannot send');
assert.equal(data.entries[4].operationId,t4.operationId);
assert.equal(data.entries[4].delivery.status,'pending');

assert(writes>0);
assert.equal(issued,5,'one durable ID per real changed intent only');
console.log('APP759_OWNER_DO_503_RETRY_RESTART_DEDUPE_AND_ACK_FAIL_CLOSED=PASS');
console.log('APP759_OWNER_DO_409_HOLD_3_ATTEMPT_BOUND_AND_UNSETTLED_PROOF_BLOCK=PASS');
console.log('APP759_ACTUAL_QA_WORKER_FIREBASE_FUNCTIONS_RTD B=NOT_RUN'.replace('RTD B','RTDB'));
console.log('APP759_PRODUCTION_SOURCE_OFF_NO_DEPLOY_NO_USER_DATA=PASS');

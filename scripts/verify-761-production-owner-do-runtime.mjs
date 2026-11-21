// APP761: source-only DO owner identity + APP755/759 composition.
import assert from 'node:assert/strict';
import {createApp761ProductionOwnerDoRuntime,
 APP761_PRODUCTION_OWNER_DO_RUNTIME_COMPILED_OPEN}
 from './app761-production-owner-do-runtime.mjs';
const owner='qaApp761Owner',actor='qaApp761Actor';
let now=1800000000000,stored=null,alarmDue=null,transactions=0,reads=0;
const storage={
 async get(){reads++;return stored===null?null:structuredClone(stored)},
 async getAlarm(){return alarmDue},
 async setAlarm(at){alarmDue=at},
 async transaction(fn){
  let draft=stored===null?null:structuredClone(stored),alarm=alarmDue;
  const tx={
   async get(){reads++;return draft===null?null:structuredClone(draft)},
   async put(key,value){assert.equal(key,'app755-owner-follow-pending-v1');
     draft=structuredClone(value)},
   async getAlarm(){return alarm},
   async setAlarm(at){alarm=at},
   async deleteAlarm(){alarm=null},
  };
  const result=await fn(tx);
  stored=draft;alarmDue=alarm;transactions++;return result;
 },
};
const env={SORIDRAW_ENVIRONMENT:'production'};
let trusted=true,identityChecks=0,relayCount=0;
const verifier=async({state,ownerUid})=>{
 identityChecks++;assert.equal(state.storage,storage);
 return {ownerUid,verifiedOwnerDoIdentity:trusted};
};
let relayStatus='relay-failed';
const backend={async deliverFromOwnerAlarm({reservation,settled,ownerEvent}){
 relayCount++;
 assert.equal(reservation.ownerUid,owner);
 assert.equal(settled.operationId,reservation.operationId);
 assert.equal(ownerEvent.ownerUid,owner);
 return {status:relayStatus};
}};
const proof=async({receipt})=>({
 settled:{committed:true,projectionSettled:true,changed:true,
   ownerUid:owner,operationId:receipt.operationId,revision:receipt.expectedRevision+1},
 ownerEvent:{ownerUid:owner,authEpoch:receipt.authEpoch,
  version:receipt.expectedRevision+1,followerCount:1,updatedAt:now},
});
let ids=0;
const params={enabled:true,state:{storage},env,ownerUid:owner,
 verifyBoundOwner:verifier,backend,proveExactSettledOwnerEvent:proof,
 now:()=>now,issueId:()=>('owner_761_verified_receipt_'+(++ids))};
assert.equal(APP761_PRODUCTION_OWNER_DO_RUNTIME_COMPILED_OPEN,false);
const initialReads=reads;
assert.equal(createApp761ProductionOwnerDoRuntime({
 state:{get storage(){throw Error('DO_TOUCH_ON_OFF')}},env,
}),null,'OFF must never access external runtime');
assert.equal(reads,initialReads,'OFF must perform zero DO reads');
assert.throws(()=>createApp761ProductionOwnerDoRuntime({...params,env:{
 SORIDRAW_ENVIRONMENT:'preview'}}),/TRUSTED_OWNER_BINDING_AND_RELAY_REQUIRED/);
assert.throws(()=>createApp761ProductionOwnerDoRuntime({...params,verifyBoundOwner:null}),
 /TRUSTED_OWNER_BINDING_AND_RELAY_REQUIRED/);
assert.throws(()=>createApp761ProductionOwnerDoRuntime({...params,backend:null}),
 /TRUSTED_OWNER_BINDING_AND_RELAY_REQUIRED/);
const runtime=createApp761ProductionOwnerDoRuntime(params);
const ticket={actorUid:actor,ownerUid:owner,desired:true,
 canonicalOperationId:'canonical_app761_verified_receipt',expectedRevision:7,
 authEpoch:'a'.repeat(32),cutoverToken:'source-only-verified',
 beforeFollowing:false,priorR2Revision:13};
trusted=false;
const noReadsBefore=reads,noTransactionBefore=transactions;
await assert.rejects(()=>runtime.find(ticket),/OWNER_BINDING_UNVERIFIED/);
await assert.rejects(()=>runtime.reserve(ticket),/OWNER_BINDING_UNVERIFIED/);
await assert.rejects(()=>runtime.alarm(),/OWNER_BINDING_UNVERIFIED/);
assert.equal(reads,noReadsBefore);
assert.equal(transactions,noTransactionBefore);
assert.equal(relayCount,0);
trusted=true;
const result=await runtime.reserve(ticket);
assert.equal(result.durable,true);
assert.equal(result.ownerDoAlarmScheduled,true);
assert.equal(result.delivery.status,'pending');
assert.equal(ids,1);
assert.equal(transactions,1);
assert.equal(alarmDue,now+1000);
assert.equal((await runtime.find(ticket)).status,'found');
assert.equal((await runtime.reserve(ticket)).operationId,result.operationId);
assert.equal(ids,1,'duplicate uses one durable ID');
await assert.rejects(()=>runtime.reserve({...ticket,ownerUid:'anotherOwner'}),
 /OWNER_SCOPE_OR_INPUT/);
assert.equal((await runtime.alarm()).processed,0,'not due, no receiver');
assert.equal(relayCount,0);
now+=1000;
const failed=await runtime.alarm();
assert.equal(failed.retried,1);
assert.equal(stored.entries[0].delivery.status,'pending');
assert.equal(stored.entries[0].operationId,result.operationId);
assert.equal(relayCount,1);
assert.equal(alarmDue,now+2000);
trusted=false;
now+=2000;
const beforeDenied=transactions;
await assert.rejects(()=>runtime.alarm(),/OWNER_BINDING_UNVERIFIED/);
assert.equal(transactions,beforeDenied);
assert.equal(relayCount,1,'identity mismatch blocks a queued alarm');
trusted=true;
relayStatus='delivered';
const recovered=await runtime.alarm();
assert.equal(recovered.delivered,1);
assert.equal(relayCount,2);
assert.equal(stored.entries[0].delivery.status,'delivered');
assert.equal(alarmDue,null);
assert.equal((await runtime.alarm()).processed,0);
assert.equal((await runtime.find(ticket)).receipt.operationId,result.operationId);
assert.equal((await runtime.reserve(ticket)).operationId,result.operationId);
assert.equal(ids,1);
assert.equal(relayCount,2,'delivered ack never triggers another send');
assert(identityChecks>=5);
console.log('APP761_PRODUCTION_OWNER_DO_TRUST_BOUND_RESERVATION_ALARM_OFF_SOURCE=PASS');
console.log('APP761_RECEIPT_503_RETRY_RESTART_DUPLICATE_SCOPE_REGRESSION=PASS');
console.log('APP761_LIVE_PROD_DO_CLASS_BINDING_FUNCTIONS_AUTH=UNCONNECTED_HOLD');
console.log('APP761_BACKEND_MUTATIONS=0; QA_REPEATED=0; PRODUCTION_DEPLOY=0');

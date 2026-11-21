import assert from 'node:assert/strict';
import {createApp755ProductionOwnerReceiptStore,APP755_PRODUCTION_OWNER_RECEIPT_COMPILED_OPEN}
 from './app755-production-owner-receipt.mjs';
import {createApp755ProductionBackend,APP755_PRODUCTION_BACKEND_COMPILED_OPEN}
 from './app755-production-follow-backend.mjs';
import {composeApp753ProductionFollow} from './app753-production-follow-composition.mjs';
const owner='ownerSynthetic755',actor='actorSynthetic755';
const canonical='canonical_354_operation_755';
const env={SORIDRAW_ENVIRONMENT:'production',
 SORIDRAW_OWNER_FOLLOW_ENDPOINT_539:
 'https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542',
 SORIDRAW_OWNER_FOLLOW_HMAC_539:'s'.repeat(64)};
const input={actorUid:actor,ownerUid:owner,desired:true,
 canonicalOperationId:canonical,expectedRevision:7,
 authEpoch:'a'.repeat(32),cutoverToken:'server-cutover',
 beforeFollowing:false,priorR2Revision:13};
let state=null,alarm=null,failAlarm=false,reads=0,writes=0,alarms=0;
const storage={
 async get(){reads++;return state===null?null:structuredClone(state)},
 async getAlarm(){return alarm},
 async setAlarm(at){if(failAlarm)throw Error('INJECTED_ALARM_FAILURE');
   alarm=at;alarms++;},
 async transaction(fn){
  let staged=state===null?null:structuredClone(state),stagedAlarm=alarm;
  const tx={
   async get(){reads++;return staged===null?null:structuredClone(staged)},
   async put(key,value){assert.equal(key,'app755-owner-follow-pending-v1');
     staged=structuredClone(value);},
   async getAlarm(){return stagedAlarm},
   async setAlarm(at){if(failAlarm)throw Error('INJECTED_ALARM_FAILURE');
     stagedAlarm=at;},
  };
  const result=await fn(tx);state=staged;alarm=stagedAlarm;writes++;
  return result;
 },
};
let generated=0;
const now=()=>1800000000000;
const issueId=()=>{generated++;return 'owner_755_server_receipt_'+generated.toString().padStart(8,'0')};
assert.equal(APP755_PRODUCTION_OWNER_RECEIPT_COMPILED_OPEN,false);
assert.equal(APP755_PRODUCTION_BACKEND_COMPILED_OPEN,false);
assert.strictEqual(createApp755ProductionOwnerReceiptStore({storage,ownerUid:owner}),null);
assert.strictEqual(createApp755ProductionBackend(),null);
assert.throws(()=>createApp755ProductionOwnerReceiptStore({
 enabled:true,storage:{},ownerUid:owner}),/OWNER_STORAGE_UNVERIFIED/);
const store=createApp755ProductionOwnerReceiptStore({enabled:true,storage,ownerUid:owner,now,issueId});
let result=await store.find(input);
assert.equal(result.status,'absent');
assert.equal(result.authoritative,true);
assert.equal(writes,0,'read-only new DO cannot create storage');
failAlarm=true;
assert.equal((await store.reserve(input)).durable,false);
assert.equal(state,null,'failed transaction must not commit receipt without alarm');
failAlarm=false;
const ticket=await store.reserve(input);
assert.equal(ticket.durable,true);
assert.equal(ticket.ownerDoAlarmScheduled,true);
assert.notEqual(ticket.operationId,canonical);
assert.equal(state.entries.length,1);
assert.equal(writes,1);
assert.equal(alarm,now()+1000);
assert.equal((await store.find(input)).receipt.operationId,ticket.operationId);
const issuedAfterCommit=generated;
const same=await store.reserve(input);
assert.equal(same.operationId,ticket.operationId,'duplicate must not allocate server receipt');
assert.equal(generated,issuedAfterCommit,
 'rolled-back issuance is not persisted; duplicate must mint zero additional IDs');
assert.equal(state.entries.length,1);
assert.equal((await store.find({...input,desired:false})).status,'unknown');
await assert.rejects(()=>store.reserve({...input,ownerUid:'wrongOwner'}),/OWNER_SCOPE_OR_INPUT/);
await assert.rejects(()=>store.reserve({...input,authEpoch:'not-an-epoch'}),
 /TRUSTED_CANONICAL_PREFLIGHT_MISSING/);
alarm=null;failAlarm=true;
assert.equal((await store.find(input)).status,'unknown',
 'existing receipt without alarm is NOT confirmed');
failAlarm=false;
assert.equal((await store.find(input)).status,'found',
 'explicit retry may safely rearm same receipt without new canonical mutation');
assert.equal(state.entries.length,1);
const corrupt=state;state={version:1,ownerUid:owner,entries:[{bad:'state'}]};
assert.equal((await store.find(input)).status,'unknown','corrupt DO state is never authoritative absence');
state=corrupt;

// Compose real existing APP743/729 using the new DO receipt and an injected
// pinned canonical provider. This is SYNTHETIC and never a real PRODUCTION release.
let preflights=0,proofs=0,canonicalCalls=0,sends=0,duplicateAck=false,noOp=false;
const principal=async()=>({verifiedAuth:true,verifiedAppCheck:true,
 firebaseProjectId:'soridraw-app-866a5',uid:actor});
const readPair=async a=>{preflights++;assert.equal(a.expectedRevision,7);
 assert.equal(a.canonicalOperationId,canonical);
 return {canonicalVerified:true,actorUid:actor,ownerUid:owner,revision:7,
   following:noOp,authEpoch:'a'.repeat(32),cutoverToken:'server-cutover',
   priorR2Revision:13};};
const proof=async a=>{proofs++;assert.equal(a.reservation.operationId,state.entries[0].operationId);
 return {committed:true,projectionSettled:true,changed:true,ownerUid:owner,
   operationId:a.reservation.operationId,canonicalOperationId:canonical,revision:8};};
let transportStatus=503;
const send=async (event,opts)=>{
 sends++;assert.equal(opts.endpoint,env.SORIDRAW_OWNER_FOLLOW_ENDPOINT_539);
 assert.equal(opts.secret,env.SORIDRAW_OWNER_FOLLOW_HMAC_539);
 assert.equal(event.version,8);
 return {ok:transportStatus===200,status:transportStatus,applied:transportStatus===200};
};
const backend=createApp755ProductionBackend({enabled:true,verifyFirebasePrincipal:principal,
 ownerStore:store,readCanonicalPair:readPair,verifyExactCommit:proof,
 sendSignedOwnerRelay:send});
const base={scheduled(){return 'unchanged'},alarm(){return 'unchanged'},
 async fetch(request){
  canonicalCalls++;
  const body=await request.clone().json();
  assert.equal(body.followOperationId,canonical);
  assert.equal(body.followExpectedRevision,7);
  return Response.json({ok:true,data:{uid:owner,following:true,
    duplicate:duplicateAck,revision:8}},{
    headers:{'X-Soridraw-Follow-Protocol':'354'}});
 }};
const evidence={scope:'REVIEWED_PRODUCTION_RUNTIME_ONLY',verifiedByIndependentQa:true,
 evidenceSha256:'b'.repeat(64),previewSha:'c'.repeat(40),
 firebaseAuthAppCheckVerified:true,ownerOnlyRulesVerified:true,
 durableAlarmReplayVerified:true,canonicalSettledRevisionVerified:true,
 productionFunctionTargetVerified:true};
const worker=composeApp753ProductionFollow(base,{enabled:true,evidence,dependencies:backend});
assert.strictEqual(worker.scheduled,base.scheduled);
assert.strictEqual(worker.alarm,base.alarm);
const request=()=>new Request('https://soridraw.com/v1/profiles/'+owner+'/follow',
 {method:'PUT',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({followOperationId:canonical,followExpectedRevision:7})});
const response=await worker.fetch(request(),env,{});
assert.equal(response.status,200);
assert.equal(preflights,0,'existing DO receipt replay never re-reads canonical pair');
assert.equal(canonicalCalls,1);
assert.equal(proofs,1);
assert.equal(sends,0,'HTTP request must NOT send signed Functions before alarm');

// Atomic new-operation path starts from empty storage, not from a synthetic
// existing receipt. This exercises find -> canonical -> durable reserve.
state=null;alarm=null;preflights=0;proofs=0;canonicalCalls=0;
const idsBeforeNew=generated;
const next=await worker.fetch(request(),env,{});
assert.equal(next.status,200);
assert.equal(preflights,1);
assert.equal(canonicalCalls,1);
assert.equal(state.entries.length,1);
assert.equal(generated,idsBeforeNew+1,'new operation gets exactly one new server receipt');
assert.equal(sends,0);
const fresh=state.entries[0];
const settled={committed:true,projectionSettled:true,changed:true,
 operationId:fresh.operationId,ownerUid:owner,revision:8};
const event={ownerUid:owner,authEpoch:fresh.authEpoch,version:8,
 followerCount:1,updatedAt:now()};
const beforeSend=await backend.deliverFromOwnerAlarm({env,reservation:fresh,settled,ownerEvent:event});
assert.equal(beforeSend.status,'relay-failed');
transportStatus=200;
const delivered=await backend.deliverFromOwnerAlarm({env,reservation:fresh,settled,ownerEvent:event});
assert.deepEqual(delivered,{status:'delivered',applied:true});
assert.equal(sends,2);
await assert.rejects(()=>backend.deliverFromOwnerAlarm({
 env:{...env,SORIDRAW_OWNER_FOLLOW_ENDPOINT_539:
  'https://asia-northeast3-soridraw-app.cloudfunctions.net/publishExploreOwnerFollower542'},
 reservation:fresh,settled,ownerEvent:event}),/SIGNED_RECEIVER_UNVERIFIED/);
await assert.rejects(()=>backend.deliverFromOwnerAlarm({
 env,reservation:fresh,settled:{...settled,revision:9},ownerEvent:event}),
 /OWNER_ALARM_EXACT_RECEIPT_UNVERIFIED/);
duplicateAck=true;const beforeProof=proofs;
assert.equal((await worker.fetch(request(),env,{})).status,200);
assert.equal(proofs,beforeProof,'duplicate canonical ACK cannot queue another signal');
duplicateAck=false;
state=null;alarm=null;noOp=true;const priorWrites=writes;
assert.equal((await worker.fetch(request(),env,{})).status,503);
assert.equal(writes,priorWrites,'no-op cannot reserve DO alarm');
noOp=false;
console.log('APP755_DO_STORAGE_TRANSACTION_ALARM_IDEMPOTENCY_AND_FAILURE=PASS');
console.log('APP755_APP743_REAL_BRIDGE_ORDERED_CANONICAL_RECEIPT=PASS');
console.log('APP755_SIGNED_FUNCTIONS_542_ALARM_ONLY_RETRY_AND_SCOPE=PASS');
console.log('APP755_ACTIVE_PRODUCTION_DO_AND_RECEIVER=UNCONNECTED_HOLD');
console.log('APP755_SHARED_D1_R2_RTDB_WORKER_WRITES=0; LIVE_DEPLOY=NOT_RUN');

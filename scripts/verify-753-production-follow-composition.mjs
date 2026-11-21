import assert from 'node:assert/strict';
import {APP753_PRODUCTION_FOLLOW_COMPILED_OPEN,
 composeApp753ProductionFollow} from './app753-production-follow-composition.mjs';
import {APP729_PRODUCTION_OWNER_FOLLOW_COMPILED_OPEN}
 from './app729-production-follow-adapter.mjs';
import {APP743_PRODUCTION_FOLLOW_COMPILED_OPEN}
 from './app743-production-follow-bridge.mjs';
const actor='actorSyntheticA',owner='ownerSyntheticB';
const id='durable_server_receipt_0007',client='canonical_client_354_0007';
const env={SORIDRAW_ENVIRONMENT:'production'};
const evidence={scope:'REVIEWED_PRODUCTION_RUNTIME_ONLY',
 verifiedByIndependentQa:true,evidenceSha256:'a'.repeat(64),
 previewSha:'b'.repeat(40),firebaseAuthAppCheckVerified:true,
 ownerOnlyRulesVerified:true,durableAlarmReplayVerified:true,
 canonicalSettledRevisionVerified:true,productionFunctionTargetVerified:true};
const ticket={durable:true,ownerDoAlarmScheduled:true,actorUid:actor,ownerUid:owner,
 desired:true,expectedRevision:7,operationId:id,canonicalOperationId:client,
 authEpoch:'c'.repeat(32),cutoverToken:'verified-synthetic'};
const calls={principal:0,receipt:0,pair:0,reserve:0,commit:0,canonical:0};
const dependencies={
 async verifyFirebasePrincipal(){calls.principal++;return{
   verifiedAuth:true,verifiedAppCheck:true,firebaseProjectId:'soridraw-app-866a5',
   uid:actor,
 };},
 async findDurableReceipt({actorUid,ownerUid,desired,
     canonicalOperationId,expectedRevision}){
   calls.receipt++;
   return {status:'absent',authoritative:true,actorUid,ownerUid,desired,
     canonicalOperationId,expectedRevision};
 },
 async readCanonicalPair(){calls.pair++;return{
    canonicalVerified:true,actorUid:actor,ownerUid:owner,revision:7,following:false,
 };},
 async reserveOwnerDurableAlarm(){calls.reserve++;return ticket;},
 async verifyCanonicalCommit({canonicalOperationId,canonicalAck}){
   calls.commit++;assert.equal(canonicalOperationId,client);
   assert.equal(canonicalAck.revision,8);
   return {committed:true,projectionSettled:true,changed:true,ownerUid:owner,
     operationId:id,canonicalOperationId:client,revision:8};
 },
};
const worker={marker:'original',scheduled(){return 'unchanged'},alarm(){return 'unchanged'},
 async fetch(request){
  calls.canonical++;
  const body=await request.clone().json();
  assert.equal(body.followOperationId,client);
  assert.equal(body.followExpectedRevision,7);
  return Response.json({ok:true,data:{
    uid:owner,following:true,duplicate:false,revision:8,
  }},{headers:{'X-Soridraw-Follow-Protocol':'354'}});
 }};
const request=()=>new Request('https://soridraw.com/v1/profiles/'+owner+'/follow',{
 method:'PUT',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({followOperationId:client,followExpectedRevision:7}),
});
assert.equal(APP753_PRODUCTION_FOLLOW_COMPILED_OPEN,false);
assert.equal(APP729_PRODUCTION_OWNER_FOLLOW_COMPILED_OPEN,false);
assert.equal(APP743_PRODUCTION_FOLLOW_COMPILED_OPEN,false);
assert.strictEqual(composeApp753ProductionFollow(worker),worker);
assert.strictEqual(composeApp753ProductionFollow(worker,{enabled:false,
 evidence:{nonsense:true},dependencies:undefined}),worker);
assert.strictEqual(composeApp753ProductionFollow(worker,{enabled:false,
 dependencies:new Proxy({}, {get(){throw Error('OFF_TOUCHED_DEPENDENCIES')}})}),worker);
assert.throws(()=>composeApp753ProductionFollow(null),/CANONICAL_WORKER_MISSING/);
assert.throws(()=>composeApp753ProductionFollow(worker,{enabled:'true'}),/COMPILE_GATE_INVALID/);
assert.throws(()=>composeApp753ProductionFollow(worker,{enabled:true}),
 /PRODUCTION_DEPENDENCIES_UNVERIFIED/);
assert.throws(()=>composeApp753ProductionFollow(worker,{enabled:true,
 evidence,dependencies:{verifyFirebasePrincipal:()=>{}}}),
 /PRODUCTION_DEPENDENCIES_UNVERIFIED/);
assert.throws(()=>composeApp753ProductionFollow(worker,{enabled:true,
 dependencies,evidence:{...evidence,verifiedByIndependentQa:false}}),
 /APP743_HOLD_PRODUCTION_EVIDENCE_MISSING/);
assert.deepEqual(calls,{principal:0,receipt:0,pair:0,reserve:0,commit:0,canonical:0},
 'OFF and rejected ON must do zero server calls');
const connected=composeApp753ProductionFollow(worker,{enabled:true,evidence,dependencies});
assert.notStrictEqual(connected,worker);
assert.strictEqual(connected.scheduled,worker.scheduled);
assert.strictEqual(connected.alarm,worker.alarm);
assert.equal(connected.marker,worker.marker);
const r=await connected.fetch(request(),env,{});
assert.equal(r.status,200);
assert.equal((await r.json()).data.revision,8);
assert.deepEqual(calls,{principal:1,receipt:1,pair:1,reserve:1,commit:1,canonical:1});
const old={...calls};
const denied=await connected.fetch(request(),{SORIDRAW_ENVIRONMENT:'preview'},{});
assert.equal(denied.status,503);
assert.deepEqual(calls,old);
console.log('APP753_PRODUCTION_SOURCE_ONLY_REAL_BRIDGE_COMPOSITION_SYNTHETIC=PASS');
console.log('APP753_OFF_CANONICAL_WORKER_IDENTITY_AND_ZERO_SERVER_CALLS=PASS');
console.log('APP753_PRODUCTION_AUTH_DO_FUNCTIONS_RTDB_DEPENDENCIES=NOT_CONNECTED');
console.log('APP753_PREVIEW_PROD_TEST_BACKEND_MUTATIONS=0; DEPLOY=NOT_RUN');

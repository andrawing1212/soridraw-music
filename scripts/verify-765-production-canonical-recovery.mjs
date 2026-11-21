// APP765: OFF-only independent D1/R2/owner epoch + monotonic history gate.
// Synthetic isolated validation, no actual D1/R2/Auth or Cloudflare calls.
import assert from 'node:assert/strict';
import {createApp765CanonicalRecoveryGate,
 assessApp765CanonicalRecovery,APP765_PRODUCTION_RECOVERY_GATE_COMPILED_OPEN}
 from './app765-production-canonical-recovery.mjs';
import {createApp755ProductionBackend}
 from './app755-production-follow-backend.mjs';
const actor='app765ActorSynthetic',owner='app765OwnerSynthetic';
const operation='app765_canonical_operation_0000000001',epoch='a'.repeat(32);
const env={SORIDRAW_ENVIRONMENT:'production'};
const reservation={actorUid:actor,ownerUid:owner,desired:true,
 canonicalOperationId:operation,expectedRevision:7,
 authEpoch:epoch,cutoverToken:'trusted-app765-cutover',
 beforeFollowing:false,priorR2Revision:13};
const preflight={canonicalVerified:true,actorUid:actor,ownerUid:owner,
 revision:7,following:false,authEpoch:epoch,
 cutoverToken:reservation.cutoverToken,priorR2Revision:13};
function evidence(a=reservation){
 return {
  source:'TRUSTED_SERVER_INDEPENDENT_CANONICAL_765',
  d1:{source:'EXACT_CANONICAL_D1',verified:true,ownerUid:a.ownerUid,
   actorUid:a.actorUid,revision:a.expectedRevision,following:a.beforeFollowing},
  r2:{source:'EXACT_SETTLED_OWNER_R2',verified:true,
   ownerUid:a.ownerUid,revision:a.priorR2Revision,authEpoch:a.authEpoch},
  auth:{source:'FIREBASE_VERIFIED_OWNER_AUTH_EPOCH',verified:true,
   firebaseProjectId:'soridraw-app-866a5',
   ownerUid:a.ownerUid,authEpoch:a.authEpoch},
  history:{source:'INDEPENDENT_MONOTONIC_OPERATION_LEDGER',verified:true,
   independentOfOwnerDo:true,completeFromOrigin:true,
   operationStatus:'never-seen',actorUid:a.actorUid,ownerUid:a.ownerUid,
   canonicalOperationId:a.canonicalOperationId,authEpoch:a.authEpoch,
   completeThroughRevision:a.expectedRevision},
  checkpoint:{source:'EXTERNAL_OWNER_REVISION_FLOOR',verified:true,
   independentOfOwnerDo:true,ownerUid:a.ownerUid,authEpoch:a.authEpoch,
   minD1Revision:a.expectedRevision,minR2Revision:a.priorR2Revision},
 };
}
const verify=x=>assessApp765CanonicalRecovery({
 reservation,preflight,evidence:x});
const valid=verify(evidence());
assert.equal(valid.status,'FRESH_RESERVATION_REVIEWED');
assert.equal(valid.productionDeployAuthorized,false);
assert.equal(verify(null).status,'HOLD');
const mutations=[
 [x=>{x.d1.revision=8},'D1_R2_OWNER_EPOCH_NOT_CONSISTENT'],
 [x=>{x.r2.revision=14},'D1_R2_OWNER_EPOCH_NOT_CONSISTENT'],
 [x=>{x.auth.authEpoch='b'.repeat(32)},'D1_R2_OWNER_EPOCH_NOT_CONSISTENT'],
 [x=>{x.auth.firebaseProjectId='soridraw-app'},'D1_R2_OWNER_EPOCH_NOT_CONSISTENT'],
 [x=>{x.history.operationStatus='committed'},'INDEPENDENT_OPERATION_HISTORY_UNPROVEN'],
 [x=>{x.history.operationStatus='unknown'},'INDEPENDENT_OPERATION_HISTORY_UNPROVEN'],
 [x=>{x.history.completeFromOrigin=false},'INDEPENDENT_OPERATION_HISTORY_UNPROVEN'],
 [x=>{x.history.completeThroughRevision=6},'INDEPENDENT_OPERATION_HISTORY_UNPROVEN'],
 [x=>{x.history.independentOfOwnerDo=false},'INDEPENDENT_OPERATION_HISTORY_UNPROVEN'],
 [x=>{x.history.canonicalOperationId='different-canonical-operation'},'INDEPENDENT_OPERATION_HISTORY_UNPROVEN'],
 [x=>{x.checkpoint.minD1Revision=8},'INDEPENDENT_REVISION_FLOOR_UNPROVEN'],
 [x=>{x.checkpoint.minR2Revision=14},'INDEPENDENT_REVISION_FLOOR_UNPROVEN'],
 [x=>{x.checkpoint.authEpoch='b'.repeat(32)},'INDEPENDENT_REVISION_FLOOR_UNPROVEN'],
 [x=>{x.checkpoint.independentOfOwnerDo=false},'INDEPENDENT_REVISION_FLOOR_UNPROVEN'],
];
for(const [mutate,code] of mutations){
 const x=structuredClone(evidence());mutate(x);
 assert.equal(verify(x).reason,code);
}
assert.equal(assessApp765CanonicalRecovery({
 reservation:{...reservation,expectedRevision:6},preflight,evidence:evidence(),
}).status,'HOLD');
assert.equal(APP765_PRODUCTION_RECOVERY_GATE_COMPILED_OPEN,false);
assert.equal(createApp765CanonicalRecoveryGate(),null);
assert.throws(()=>createApp765CanonicalRecoveryGate({enabled:true}),
 /TRUSTED_EXTERNAL_HISTORY_CALLBACK_MISSING/);
let historyReads=0;
const guard=createApp765CanonicalRecoveryGate({
 enabled:true,verifyIndependentCanonicalHistory:async({reservation:a})=>{
  historyReads++;return evidence(a);
 }});
await assert.rejects(()=>guard({
 request:new Request('https://soridraw.com'),
 env:{SORIDRAW_ENVIRONMENT:'preview'},reservation,preflight,
}),/VERIFIED_REQUEST_ENVIRONMENT_REQUIRED/);
assert.equal(historyReads,0);
const check=await guard({
 request:new Request('https://soridraw.com'),env,reservation,preflight});
assert.equal(check.status,'FRESH_RESERVATION_REVIEWED');
assert.equal(historyReads,1);

// Integrate through the ACTUAL APP755 backend: in a full DO PITR rollback
// the local receipt lookup may return 'absent' even for a prior canonical
// operation, so only independent history can authorize a *new* receipt.
let mode='fresh',writes=0,canonicalReads=0,externalReads=0,found=false;
const known={...reservation,durable:true,ownerDoAlarmScheduled:true,
 operationId:'app765_known_server_receipt_00000001'};
const ownerStore={
 async find(a){return found?{status:'found',receipt:known}:
  {status:'absent',authoritative:true,actorUid:a.actorUid,
   ownerUid:a.ownerUid,desired:a.desired,
   canonicalOperationId:a.canonicalOperationId,expectedRevision:a.expectedRevision}},
 async reserve(a){writes++;return {...a,operationId:
  'app765_new_server_receipt_'+String(writes).padStart(10,'0'),
  durable:true,ownerDoAlarmScheduled:true}},
};
const backend=createApp755ProductionBackend({
 enabled:true,verifyFirebasePrincipal:async()=>({verified:true}),
 ownerStore,readCanonicalPair:async()=>{
  canonicalReads++;
  return {...preflight,
    ...(mode==='stalePair'?{revision:6}:{})};
 },
 verifyExactCommit:async()=>({}),
 verifyIndependentCanonicalHistory:async({reservation:a})=>{
  externalReads++;
  if(mode==='network503')throw Error('INJECTED_R2_503');
  if(mode==='noLedger')return {...evidence(a),history:undefined};
  const x=evidence(a);
  if(mode==='committedBeforePitr')x.history.operationStatus='committed';
  if(mode==='rollBackFloor')x.checkpoint.minD1Revision=a.expectedRevision+1;
  if(mode==='staleAuth')x.auth.authEpoch='b'.repeat(32);
  if(mode==='r2NotSettled')x.r2.verified=false;
  return x;
 },
 sendSignedOwnerRelay:async()=>({status:503,ok:false}),
});
const request=()=>new Request('https://soridraw.com/v1/profiles/'+owner+'/follow',{
 method:'PUT',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({followOperationId:operation,followExpectedRevision:7})});
const action=async()=>{
 const a={...reservation,request:request(),env};
 const receipt=await backend.findDurableReceipt(a);
 if(receipt.status==='found')return receipt;
 const pair=await backend.readCanonicalPair(a);
 if(pair.following===a.desired)return null;
 return backend.reserveOwnerDurableAlarm(a);
};
const real=await action();
assert.equal(real.durable,true);
assert.equal(writes,1);
assert.equal(canonicalReads,1);
assert.equal(externalReads,1);
for(const [scenario,reason] of [
 ['committedBeforePitr','INDEPENDENT_RECOVERY_HISTORY_UNVERIFIED'],
 ['rollBackFloor','INDEPENDENT_RECOVERY_HISTORY_UNVERIFIED'],
 ['staleAuth','INDEPENDENT_RECOVERY_HISTORY_UNVERIFIED'],
 ['r2NotSettled','INDEPENDENT_RECOVERY_HISTORY_UNVERIFIED'],
 ['noLedger','INDEPENDENT_RECOVERY_HISTORY_UNVERIFIED'],
 ['network503','INDEPENDENT_RECOVERY_HISTORY_UNVERIFIED'],
]){
 mode=scenario;
 const earlier=writes;
 await assert.rejects(action(),new RegExp(reason));
 assert.equal(writes,earlier,scenario+' cannot mint a new DO receipt');
}
mode='stalePair';
const olderWrites=writes,beforeHistory=externalReads;
await assert.rejects(action(),/CANONICAL_PREFLIGHT_UNVERIFIED/);
assert.equal(externalReads,beforeHistory,'stale D1 preflight stops before ledger query');
assert.equal(writes,olderWrites);
mode='fresh';found=true;
const preExistingExternal=externalReads,preExistingD1=canonicalReads;
const prior=await action();
assert.equal(prior.receipt.operationId,known.operationId);
assert.equal(externalReads,preExistingExternal,
 'existing authenticated DO receipt replay costs zero extra ledger reads');
assert.equal(canonicalReads,preExistingD1,
 'existing DO replay costs zero extra canonical state reads');
assert.equal(writes,olderWrites);
assert.throws(()=>createApp755ProductionBackend({
 enabled:true,verifyFirebasePrincipal:async()=>({}),
 ownerStore,readCanonicalPair:async()=>({}),verifyExactCommit:async()=>({}),
 sendSignedOwnerRelay:async()=>({}),
}),/VERIFIED_RUNTIME_COMPONENTS_MISSING/);
console.log('APP765_D1_R2_AUTH_EPOCH_MONOTONIC_HISTORY_AND_CHECKPOINT_GUARD=PASS');
console.log('APP765_FULL_DO_PITR_DUPLICATE_AND_UNKNOWN_503_HOLD_BEFORE_NEW_RECEIPT=PASS');
console.log('APP765_EXISTING_DO_RECEIPT_REPLAY_ZERO_EXTRA_HISTORY_READ=PASS');
console.log('APP765_PROD_EXTERNAL_LEDGER_CALLBACK_NOT_CONNECTED=HOLD');
console.log('APP765_SYNTHETIC_ONLY; REAL_CANONICAL_D1_R2_AUTH_READS=0; DEPLOY=0');

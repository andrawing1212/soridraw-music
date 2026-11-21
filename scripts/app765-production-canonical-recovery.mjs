// APP765: production owner-follow *new reservation* recovery gate (OFF).
// No remote access in this module. A trusted, independently reviewed server
// callback must supply D1/R2/Auth and monotonic operation-ledger proof.
// It is NOT safe to derive never-seen from absence in restored DO storage,
// current D1 pair state alone, a client token or a synthetic CI assertion.
export const APP765_PRODUCTION_RECOVERY_GATE_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const OP=/^[A-Za-z0-9_-]{16,128}$/;
const EPOCH=/^[0-9a-f]{32}$/;
const rev=x=>Number.isSafeInteger(x)&&x>=0;
const hold=why=>{throw Error('APP765_INDEPENDENT_CANONICAL_HOLD_'+why)};
export function assessApp765CanonicalRecovery({reservation,preflight,evidence}={}){
 const a=reservation,p=preflight,e=evidence;
 if(!a||!p||!e||!UID.test(a.actorUid||'')||
    !UID.test(a.ownerUid||'')||a.actorUid===a.ownerUid||
    !OP.test(a.canonicalOperationId||'')||!rev(a.expectedRevision)||
    !EPOCH.test(a.authEpoch||'')||
    typeof a.desired!=='boolean'||typeof a.beforeFollowing!=='boolean'||
    a.beforeFollowing===a.desired||!rev(a.priorR2Revision)||
    typeof a.cutoverToken!=='string'||!a.cutoverToken||
    p.canonicalVerified!==true||p.ownerUid!==a.ownerUid||
    p.actorUid!==a.actorUid||p.revision!==a.expectedRevision||
    p.authEpoch!==a.authEpoch||p.following!==a.beforeFollowing||
    p.priorR2Revision!==a.priorR2Revision||
    p.cutoverToken!==a.cutoverToken)
  return {status:'HOLD',reason:'BOUND_CANONICAL_INPUT_UNVERIFIED'};
 const d=e.d1,r=e.r2,au=e.auth,ledger=e.history,checkpoint=e.checkpoint;
 if(e.source!=='TRUSTED_SERVER_INDEPENDENT_CANONICAL_765'||
    d?.source!=='EXACT_CANONICAL_D1'||d.verified!==true||
    d.ownerUid!==a.ownerUid||d.actorUid!==a.actorUid||
    d.revision!==a.expectedRevision||d.following!==a.beforeFollowing||
    r?.source!=='EXACT_SETTLED_OWNER_R2'||r.verified!==true||
    r.ownerUid!==a.ownerUid||r.revision!==a.priorR2Revision||
    r.authEpoch!==a.authEpoch||
    au?.source!=='FIREBASE_VERIFIED_OWNER_AUTH_EPOCH'||
    au.verified!==true||au.firebaseProjectId!=='soridraw-app-866a5'||
    au.ownerUid!==a.ownerUid||au.authEpoch!==a.authEpoch)
  return {status:'HOLD',reason:'D1_R2_OWNER_EPOCH_NOT_CONSISTENT'};
 // An operation ledger MUST be complete for this exact authenticated pair
 // and operation ID, and monotonic independently of this DO's PITR.
 // A "not found" from the current snapshot alone is not sufficient.
 if(ledger?.source!=='INDEPENDENT_MONOTONIC_OPERATION_LEDGER'||
    ledger.verified!==true||ledger.independentOfOwnerDo!==true||
    ledger.completeFromOrigin!==true||
    ledger.operationStatus!=='never-seen'||
    ledger.actorUid!==a.actorUid||ledger.ownerUid!==a.ownerUid||
    ledger.canonicalOperationId!==a.canonicalOperationId||
    ledger.authEpoch!==a.authEpoch||
    !rev(ledger.completeThroughRevision)||
    ledger.completeThroughRevision<a.expectedRevision)
  return {status:'HOLD',reason:'INDEPENDENT_OPERATION_HISTORY_UNPROVEN'};
 // A revision floor anchored outside the DO catches a DO-only PITR
 // rollback where the restored reservation queue is empty but the
 // canonical history has already advanced. No local snapshot can prove
 // this; the future independent trusted server must own that evidence.
 if(checkpoint?.source!=='EXTERNAL_OWNER_REVISION_FLOOR'||
    checkpoint.verified!==true||
    checkpoint.independentOfOwnerDo!==true||
    checkpoint.ownerUid!==a.ownerUid||
    checkpoint.authEpoch!==a.authEpoch||
    !rev(checkpoint.minD1Revision)||
    !rev(checkpoint.minR2Revision)||
    checkpoint.minD1Revision>a.expectedRevision||
    checkpoint.minR2Revision>a.priorR2Revision)
  return {status:'HOLD',reason:'INDEPENDENT_REVISION_FLOOR_UNPROVEN'};
 return {status:'FRESH_RESERVATION_REVIEWED',
   ownerUid:a.ownerUid,actorUid:a.actorUid,
   canonicalOperationId:a.canonicalOperationId,
   expectedRevision:a.expectedRevision,authEpoch:a.authEpoch,
   externalReadsClaimedByCallback:true,
   localDoStateNotSourceOfHistory:true,productionDeployAuthorized:false};
}
export function createApp765CanonicalRecoveryGate({
 enabled=APP765_PRODUCTION_RECOVERY_GATE_COMPILED_OPEN,
 verifyIndependentCanonicalHistory,
}={}){
 if(enabled!==true)return null;
 if(typeof verifyIndependentCanonicalHistory!=='function')
  hold('TRUSTED_EXTERNAL_HISTORY_CALLBACK_MISSING');
 return async ({request,env,reservation,preflight}={})=>{
  if(env?.SORIDRAW_ENVIRONMENT!=='production'||!request||
     typeof request.clone!=='function')
   hold('VERIFIED_REQUEST_ENVIRONMENT_REQUIRED');
  let evidence;
  try{
   // Only the server-injected callback can return evidence. No browser
   // body or user-supplied JSON is passed as a trusted attestation.
   evidence=await verifyIndependentCanonicalHistory({
    request,env,reservation,canonicalPreflight:preflight,
   });
  }catch{hold('TRUSTED_EXTERNAL_HISTORY_UNAVAILABLE')}
  const decision=assessApp765CanonicalRecovery({
    reservation,preflight,evidence});
  if(decision.status!=='FRESH_RESERVATION_REVIEWED')
   hold(decision.reason);
  return decision;
 };
}

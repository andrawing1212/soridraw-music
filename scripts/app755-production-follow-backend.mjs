// APP755: source-only production APP743 dependency adapter. Uses a trusted
// owner-scoped DO store and preexisting canonical R2/D1/APP557 proof and
// APP539 signed Function transport callbacks. NO endpoint/route/DO migration.
// Its default is OFF; actual PROD DO and Functions542 remain unconnected.
export const APP755_PRODUCTION_BACKEND_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const OP=/^[A-Za-z0-9_-]{16,128}$/;
const EPOCH=/^[0-9a-f]{32}$/;
const ENDPOINT='https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542';
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const hold=x=>{throw Error('APP755_BACKEND_HOLD_'+x)};
const same=(r,a)=>r&&r.actorUid===a.actorUid&&
 r.ownerUid===a.ownerUid&&r.desired===a.desired&&
 r.canonicalOperationId===a.canonicalOperationId&&
 r.expectedRevision===a.expectedRevision;
const validInput=a=>a&&UID.test(a.actorUid||'')&&UID.test(a.ownerUid||'')&&
 a.actorUid!==a.ownerUid&&OP.test(a.canonicalOperationId||'')&&
 integer(a.expectedRevision)&&typeof a.desired==='boolean';
export function createApp755ProductionBackend({
 enabled=APP755_PRODUCTION_BACKEND_COMPILED_OPEN,
 verifyFirebasePrincipal,ownerStore,readCanonicalPair,verifyExactCommit,
 sendSignedOwnerRelay,
}={}){
 if(enabled!==true)return null;
 if(typeof verifyFirebasePrincipal!=='function'||
    !ownerStore||typeof ownerStore.find!=='function'||
    typeof ownerStore.reserve!=='function'||
    typeof readCanonicalPair!=='function'||
    typeof verifyExactCommit!=='function'||
    typeof sendSignedOwnerRelay!=='function')
   hold('VERIFIED_RUNTIME_COMPONENTS_MISSING');
 // Only an APP743-authenticated request object can retain its immutable
 // verified canonical preflight. Never accept the client's body as a proof.
 const requestIdentity=new WeakMap(),preflight=new WeakMap();
 const prod=a=>{
  if(a.env?.SORIDRAW_ENVIRONMENT!=='production'||
     !UID.test(a.actorUid||'')||!UID.test(a.ownerUid||'')||
     a.actorUid===a.ownerUid||typeof a.desired!=='boolean')
   hold('PRODUCTION_SCOPE');
 };
 const backend={
  verifyFirebasePrincipal,
  async findDurableReceipt(a){
   prod(a);
   if(!validInput(a)||!a.request)hold('REQUEST_IDENTITY_MISSING');
   let v;
   try{v=await ownerStore.find(a)}catch{hold('DO_READ_UNAVAILABLE')}
   if(v?.status==='found'){
    if(!same(v.receipt,a)||v.receipt?.durable!==true||
       v.receipt?.ownerDoAlarmScheduled!==true||
       !OP.test(v.receipt?.operationId||'')||
       v.receipt.operationId===a.canonicalOperationId)
      hold('DO_RECEIPT_SCOPE');
   }else if(v?.status==='absent'){
    if(v.authoritative!==true||!same(v,a))hold('DO_ABSENCE_NOT_AUTHENTICATED');
    requestIdentity.set(a.request,a);
   }else hold('DO_RECEIPT_UNKNOWN');
   return v;
  },
  async readCanonicalPair(a){
   prod(a);
   const bound=requestIdentity.get(a.request);
   if(!bound||bound.actorUid!==a.actorUid||
      bound.ownerUid!==a.ownerUid||bound.desired!==a.desired)
     hold('DO_ABSENCE_AND_REQUEST_NOT_BOUND');
   let r;
   try{r=await readCanonicalPair({...a,
       canonicalOperationId:bound.canonicalOperationId,
       expectedRevision:bound.expectedRevision})}
   catch{hold('CANONICAL_PREFLIGHT_UNAVAILABLE')}
   if(r?.canonicalVerified!==true||r.actorUid!==a.actorUid||
      r.ownerUid!==a.ownerUid||!integer(r.revision)||
      r.revision!==bound.expectedRevision||
      typeof r.following!=='boolean'||
      !EPOCH.test(r.authEpoch||'')||
      typeof r.cutoverToken!=='string'||r.cutoverToken.length<1||
      r.cutoverToken.length>128||!integer(r.priorR2Revision))
     hold('CANONICAL_PREFLIGHT_UNVERIFIED');
   // APP743's own no-op gate returns durable:false before any reservation.
   // Return the verified unchanged pair so it can fail closed as HTTP 503.
   if(r.following!==a.desired)preflight.set(a.request,{...r,
     canonicalOperationId:bound.canonicalOperationId});
   return r;
  },
  async reserveOwnerDurableAlarm(a){
   prod(a);
   const r=preflight.get(a.request);
   if(!r||r.actorUid!==a.actorUid||r.ownerUid!==a.ownerUid||
      r.revision!==a.expectedRevision||
      r.canonicalOperationId!==a.canonicalOperationId||
      r.following===a.desired)
     hold('PREFLIGHT_REQUEST_NOT_BOUND');
   const reservation={actorUid:a.actorUid,ownerUid:a.ownerUid,
     desired:a.desired,canonicalOperationId:a.canonicalOperationId,
     expectedRevision:a.expectedRevision,authEpoch:r.authEpoch,
     cutoverToken:r.cutoverToken,priorR2Revision:r.priorR2Revision,
     beforeFollowing:r.following};
   let receipt;
   try{receipt=await ownerStore.reserve(reservation)}
   catch{hold('DO_RESERVATION_UNKNOWN')}
   if(!same(receipt,reservation)||receipt?.durable!==true||
      receipt?.ownerDoAlarmScheduled!==true||
      !OP.test(receipt?.operationId||'')||
      receipt.operationId===a.canonicalOperationId||
      receipt.authEpoch!==r.authEpoch||
      receipt.cutoverToken!==r.cutoverToken)
     hold('DO_ATOMIC_RESERVATION_UNVERIFIED');
   return receipt;
  },
  async verifyCanonicalCommit(a){
   if(a.env?.SORIDRAW_ENVIRONMENT!=='production'||
      !same(a.reservation,{actorUid:a.reservation?.actorUid,
        ownerUid:a.reservation?.ownerUid,desired:a.reservation?.desired,
        canonicalOperationId:a.canonicalOperationId,
        expectedRevision:a.reservation?.expectedRevision})||
      a.canonicalAck?.duplicate!==false||
      !integer(a.canonicalAck?.revision)||
      a.canonicalAck.revision<=a.reservation.expectedRevision)
     hold('CANONICAL_ACK_UNVERIFIED');
   let r;
   try{r=await verifyExactCommit(a)}
   catch{hold('EXACT_COMMIT_PROOF_UNAVAILABLE')}
   if(r?.committed!==true||r?.projectionSettled!==true||
      r?.changed!==true||r.ownerUid!==a.reservation.ownerUid||
      r.operationId!==a.reservation.operationId||
      r.canonicalOperationId!==a.canonicalOperationId||
      r.revision!==a.canonicalAck.revision)
     hold('EXACT_CANONICAL_RECEIPT_UNVERIFIED');
   return r;
  },
  // Used by a future *approved* owner DO alarm, never directly in fetch.
  // APP743's queueSettledOwnerSignal itself performs ZERO Functions calls.
  async deliverFromOwnerAlarm({env,reservation,settled,ownerEvent}={}){
   if(env?.SORIDRAW_ENVIRONMENT!=='production'||
      env?.SORIDRAW_OWNER_FOLLOW_ENDPOINT_539!==ENDPOINT||
      typeof env?.SORIDRAW_OWNER_FOLLOW_HMAC_539!=='string'||
      env.SORIDRAW_OWNER_FOLLOW_HMAC_539.length<32)
     hold('PRODUCTION_SIGNED_RECEIVER_UNVERIFIED');
   if(reservation?.durable!==true||
      reservation?.ownerDoAlarmScheduled!==true||
      settled?.committed!==true||settled?.projectionSettled!==true||
      settled?.changed!==true||settled.operationId!==reservation.operationId||
      settled.ownerUid!==reservation.ownerUid||
      !integer(settled.revision)||settled.revision<=reservation.expectedRevision||
      ownerEvent?.ownerUid!==reservation.ownerUid||
      ownerEvent?.authEpoch!==reservation.authEpoch||
      ownerEvent?.version!==settled.revision||
      !integer(ownerEvent.followerCount)||!integer(ownerEvent.updatedAt))
     hold('OWNER_ALARM_EXACT_RECEIPT_UNVERIFIED');
   try{
    // This is the existing APP539 signed transport, injected by the
    // owner DO alarm ONLY after authenticated APP557/R2 exact settle proof.
    const res=await sendSignedOwnerRelay(ownerEvent,{
      endpoint:ENDPOINT,secret:env.SORIDRAW_OWNER_FOLLOW_HMAC_539});
    if(res?.ok===true&&res.status===200)return {status:'delivered',
      applied:res.applied===true};
    if(res?.status===409)return {status:'rejected-generation'};
   }catch{/* retain pending durable alarm */}
   return {status:'relay-failed'};
  },
 };
 return backend;
}

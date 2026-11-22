// APP775 - OFF-only shared follow ingress contract. No active Worker imports.
// Legacy clients and ordered clients are checked against the SAME server-only
// identity and independent pending fence. No mutation or retry is authorized.
export const APP775_UNIFIED_FOLLOW_INGRESS_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const OP=/^[A-Za-z0-9_-]{16,128}$/;
const EPOCH=/^[a-f0-9]{32}$/;
const rev=n=>Number.isSafeInteger(n)&&n>=0;
const unsafe=Object.freeze({
 legacyCanonicalModified:false,routeToLiveCanonical:false,
 canonicalD1WriteAuthorized:false,doReservationAuthorized:false,
 r2AdmissionAuthorized:false,retryAuthorized:false,relayAuthorized:false,
 activeRuntimeConnected:false,productionDeployAuthorized:false,
});
const hold=reason=>Object.freeze({status:'HOLD',reason,...unsafe});
function parseEnvelope(body){
 if(typeof body!=='string'||body.length>512)return null;
 if(!body.trim())return {kind:'legacy'};
 let data;
 try{data=JSON.parse(body)}catch{return null;}
 if(!data||typeof data!=='object'||Array.isArray(data))return null;
 const keys=Object.keys(data);
 if(keys.length===0)return {kind:'legacy'};
 if(keys.length!==2||!keys.includes('followOperationId')||
    !keys.includes('followExpectedRevision')||
    !OP.test(data.followOperationId||'')||!rev(data.followExpectedRevision))
   return null;
 return {kind:'ordered',operationId:data.followOperationId,
  revision:data.followExpectedRevision};
}
async function stableLegacyId(token,actor,owner,revision,desired){
 const bytes=new TextEncoder().encode(JSON.stringify([
  token,actor,owner,revision,desired,
 ]));
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
 return 'owner_follow_579_'+Array.from(hash,n=>
  n.toString(16).padStart(2,'0')).join('');
}
export async function assessApp775UnifiedFollowIngress({
 enabled=APP775_UNIFIED_FOLLOW_INGRESS_COMPILED_OPEN,scope,
 method,ownerUid,body,verifiedActor,ownerEnrollment,
 cutover,serverIdentity,pair,pendingFence,
}={}){
 if(enabled!==true)return Object.freeze({
  status:'OFF_LEGACY_UNCHANGED',next:'KEEP_ACTIVE_CANONICAL_AS_IS',...unsafe,
 });
 if(scope!=='APP775_OFFLINE_SYNTHETIC_ONLY')return hold('OFFLINE_SCOPE_REQUIRED');
 if(method!=='PUT'&&method!=='DELETE')return hold('METHOD_UNSUPPORTED');
 if(!UID.test(ownerUid||''))return hold('OWNER_UNVERIFIED');
 const envelope=parseEnvelope(body);
 if(!envelope)return hold('INVALID_OR_PARTIAL_ENVELOPE');
 const actor=verifiedActor;
 if(actor?.source!=='SIGNED_FIREBASE_AUTH_APP_CHECK_775'||
   actor.verified!==true||actor.firebaseProjectId!=='soridraw-app-866a5'||
   !UID.test(actor.uid||'')||actor.uid===ownerUid||
   !EPOCH.test(actor.authEpoch||''))
  return hold('SERVER_AUTH_OR_GENERATION_UNPROVEN');
 const enrollment=ownerEnrollment;
 if(enrollment?.source!=='TRUSTED_OWNER_ENROLLMENT_775'||
   enrollment.verified!==true||enrollment.ownerUid!==ownerUid||
   enrollment.enrolled!==true||!EPOCH.test(enrollment.ownerAuthEpoch||'')||
   enrollment.ownerDeletionAndUidReuseReviewed!==true)
  return hold('OWNER_UNENROLLED_OR_EPOCH_UNPROVEN');
 const cut=cutover;
 if(cut?.source!=='SERVER_COMPLETE_WRITER_CUTOVER_775'||
   cut.verified!==true||!OP.test(cut.token||'')||
   cut.completeBeforeFirstAcceptedOperation!==true||
   cut.everyActiveWriterCovered!==true||
   cut.everyLegacyWriterCovered!==true||
   cut.noLegacyBypassToCanonical!==true||
   cut.fullOwnerDoPitrCannotBypass!==true||
   cut.authDeletionLifecycleReviewed!==true||
   cut.previewTestProdCompatibilityReviewed!==true)
  return hold('ALL_WRITERS_CUTOVER_UNPROVEN');
 const identity=serverIdentity;
 if(identity?.source!=='TRUSTED_EXACT_SERVER_PAIR_IDENTITY_775'||
   identity.verified!==true||identity.ownerUid!==ownerUid||
   identity.actorUid!==actor.uid||
   identity.authEpoch!==actor.authEpoch||
   identity.ownerAuthEpoch!==enrollment.ownerAuthEpoch||
   identity.cutoverToken!==cut.token||
   !rev(identity.expectedRevision)||!OP.test(identity.canonicalOperationId||'')||
   identity.serverIssuedOrVerified!==true)
  return hold('SERVER_OPERATION_IDENTITY_UNPROVEN');
 const snapshot=pair;
 if(snapshot?.source!=='TRUSTED_EXACT_PAIR_REVISION_775'||
   snapshot.verified!==true||snapshot.ownerUid!==ownerUid||
   snapshot.actorUid!==actor.uid||
   snapshot.ownerAuthEpoch!==enrollment.ownerAuthEpoch||
   snapshot.authEpoch!==actor.authEpoch||
   snapshot.revision!==identity.expectedRevision||
   typeof snapshot.following!=='boolean')
  return hold('EXACT_PAIR_REVISION_UNPROVEN');
 const fence=pendingFence;
 if(fence?.source!=='INDEPENDENT_PAIR_PENDING_FENCE_775'||
   fence.verified!==true||fence.independentOfOwnerDo!==true||
   fence.ownerUid!==ownerUid||fence.actorUid!==actor.uid||
   fence.authEpoch!==actor.authEpoch||
   fence.canonicalOperationId!==identity.canonicalOperationId||
   fence.noEarlierPendingOperation!==true||
   fence.noLaterWriterBypass!==true||
   fence.allLegacyWritersCovered!==true||
   fence.fullOwnerDoPitrProtected!==true)
  return hold('PENDING_FENCE_OR_PITR_UNPROVEN');
 const desired=method==='PUT';
 if(envelope.kind==='ordered'&&
    (envelope.operationId!==identity.canonicalOperationId||
     envelope.revision!==identity.expectedRevision))
  return hold('ORDERED_CLIENT_ID_OR_REVISION_MISMATCH');
 if(envelope.kind==='legacy'){
  let recomputed;
  try{recomputed=await stableLegacyId(cut.token,actor.uid,ownerUid,
     identity.expectedRevision,desired)}
  catch{return hold('LEGACY_STABLE_ID_HASH_UNAVAILABLE')}
  if(recomputed!==identity.canonicalOperationId)
   return hold('LEGACY_SERVER_IDENTITY_MISMATCH');
 }
 return Object.freeze({
   status:'OFFLINE_COMMON_INGRESS_PROOF_SHAPE_ONLY',
   envelopeKind:envelope.kind,
   operationId:identity.canonicalOperationId,
   expectedRevision:identity.expectedRevision,
   desired,
   stateChanged:snapshot.following!==desired,
   admissionRequiredIfConnected:snapshot.following!==desired,
   requiresIndependentR2AndD1CommitProof:true,
   ...unsafe,
 });
}

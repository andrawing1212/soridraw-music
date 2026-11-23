// APP784: one QA-only gate for legacy empty and ordered follow requests.
// This is NOT a production Writer. Never import into active Workers.
// Old empty requests after an ABA cycle are indistinguishable from old retries.
import {assessApp775UnifiedFollowIngress} from './app775-unified-follow-ingress.mjs';
export const APP784_QA_UNIFIED_COMPILED_OPEN=false;
const ID=/^[A-Za-z0-9_-]{16,128}$/,UID=/^[A-Za-z0-9_-]{1,128}$/;
const int=x=>Number.isSafeInteger(x)&&x>=0;
const blocked=Object.freeze({productionDeployAuthorized:false,
 realCanonicalWritesAuthorized:false,ownerDoReserveAuthorized:false,
 signedRelayAuthorized:false,automaticReplayAuthorized:false});
const hold=reason=>Object.freeze({status:'HOLD',reason,...blocked});
function envelope(body){
 if(typeof body!=='string'||body.length>512)return null;
 if(!body.trim())return {kind:'legacy'};
 let b;try{b=JSON.parse(body)}catch{return null}
 if(!b||typeof b!=='object'||Array.isArray(b))return null;
 const keys=Object.keys(b);
 if(keys.length===0)return {kind:'legacy'};
 if(keys.length!==2||!keys.includes('followOperationId')||
  !keys.includes('followExpectedRevision')||
  !ID.test(b.followOperationId||'')||!int(b.followExpectedRevision))return null;
 return {kind:'ordered',id:b.followOperationId,revision:b.followExpectedRevision};
}
export function createApp784QaUnifiedFollow({
 enabled=APP784_QA_UNIFIED_COMPILED_OPEN,scope,
 getSyntheticServerEvidence,findExactSettledOperation,
 claimImmutableAdmission,commitExactQaPair,settleImmutableReceipt,
}={}){
 if(enabled!==true)return null;
 if(scope!=='APP784_ISOLATED_SYNTHETIC_QA'||
  [getSyntheticServerEvidence,findExactSettledOperation,
   claimImmutableAdmission,commitExactQaPair,
   settleImmutableReceipt].some(f=>typeof f!=='function'))
  throw Error('APP784_QA_SCOPE_OR_ADAPTER_REQUIRED');
 return Object.freeze({async handle({env,method,ownerUid,body}={}){
  if(env?.SORIDRAW_ENVIRONMENT!=='isolated-qa'||!UID.test(ownerUid||'')||
     !['PUT','DELETE'].includes(method))return hold('QA_ENV_METHOD_OWNER_REQUIRED');
  const x=envelope(body);
  if(!x)return hold('INVALID_OR_PARTIAL_ENVELOPE');
  let c;try{c=await getSyntheticServerEvidence({env,method,ownerUid});}
  catch{return hold('QA_EVIDENCE_UNAVAILABLE')}
  if(c?.source!=='APP784_SYNTHETIC_QA_ONLY'||c.syntheticOnly!==true||
     c.verifiedActor?.verified!==true||
     c.verifiedActor.firebaseProjectId!=='soridraw-app-866a5'||
     !UID.test(c.verifiedActor.uid||'')||c.verifiedActor.uid===ownerUid||
     !/^[0-9a-f]{32}$/.test(c.verifiedActor.authEpoch||'')||
     c.ownerEnrollment?.source!=='TRUSTED_OWNER_ENROLLMENT_775'||
     c.ownerEnrollment.verified!==true||c.ownerEnrollment.enrolled!==true||
     c.ownerEnrollment.ownerUid!==ownerUid||
     !/^[0-9a-f]{32}$/.test(c.ownerEnrollment.ownerAuthEpoch||'')||
     c.ownerEnrollment.ownerDeletionAndUidReuseReviewed!==true||
     c.cutover?.verified!==true||!ID.test(c.cutover.token||'')||
     c.cutover.everyActiveWriterCovered!==true||
     c.cutover.everyLegacyWriterCovered!==true||
     c.cutover.fullOwnerDoPitrCannotBypass!==true)
   return hold('QA_ACTOR_CUTOVER_UNVERIFIED');
  // An ordered replay must be exact and read-only. Never call settle() when
  // its immutable receipt is absent: that would create one on a replay.
  if(x.kind==='ordered'){
   let r;try{r=await findExactSettledOperation({env,
    ownerUid,actorUid:c.verifiedActor.uid,
    authEpoch:c.verifiedActor.authEpoch,
    ownerAuthEpoch:c.ownerEnrollment.ownerAuthEpoch,
    cutoverToken:c.cutover.token,canonicalOperationId:x.id,
    expectedRevision:x.revision,desired:method==='PUT'});}
   catch{return hold('REPLAY_LOOKUP_UNAVAILABLE')}
   if(r?.status==='verified-read-only'&&r.verified===true&&
      r.ownerUid===ownerUid&&r.actorUid===c.verifiedActor.uid&&
      r.authEpoch===c.verifiedActor.authEpoch&&
      r.ownerAuthEpoch===c.ownerEnrollment.ownerAuthEpoch&&
      r.cutoverToken===c.cutover.token&&
      r.canonicalOperationId===x.id&&
      r.expectedRevision===x.revision&&
      r.desired===(method==='PUT'))
    return Object.freeze({status:'QA784_ORDERED_REPLAY_READ_ONLY',
     operationId:x.id,...blocked});
   if(r?.status!=='absent'||r.authoritative!==true)
    return hold('REPLAY_NOT_AUTHORITATIVELY_ABSENT');
  }
  const decision=await assessApp775UnifiedFollowIngress({
   enabled:true,scope:'APP775_OFFLINE_SYNTHETIC_ONLY',
   method,ownerUid,body,verifiedActor:c.verifiedActor,
   ownerEnrollment:c.ownerEnrollment,cutover:c.cutover,
   serverIdentity:c.serverIdentity,pair:c.pair,
   pendingFence:c.pendingFence,
  });
  if(decision?.status!=='OFFLINE_COMMON_INGRESS_PROOF_SHAPE_ONLY'||
     decision.envelopeKind!==x.kind||!ID.test(decision.operationId||''))
   return hold('APP775_COMMON_IDENTITY_FENCE_UNPROVEN');
  if(!decision.stateChanged)return hold('NO_CHANGE_WITHOUT_SETTLED_RECEIPT');
  // The only safe unversioned operation in this QA fixture is the very
  // first operation after a proven fresh cutover. A post-unfollow empty
  // follow could be an ancient delayed retry and must HOLD.
  if(x.kind==='legacy'&&!(
    c.legacySafeFirstOperation===true&&
    c.legacyHistoryInitiallyEmpty===true&&
    int(c.cutover.firstRevision)&&
    c.pair.revision===c.cutover.firstRevision))
   return hold('LEGACY_ABA_REPLAY_AMBIGUOUS');
  const ticket={ownerUid,actorUid:c.verifiedActor.uid,
   authEpoch:c.verifiedActor.authEpoch,cutoverToken:c.cutover.token,
   canonicalOperationId:decision.operationId,
   expectedRevision:decision.expectedRevision,desired:decision.desired};
  let claim;try{claim=await claimImmutableAdmission({env,ticket});}
  catch{return hold('R2_ADMISSION_ACK_UNKNOWN')}
  if(claim?.status!=='ADMISSION_ONLY_NOT_D1_COMMIT'||
     claim.requiresCanonicalCommitProof!==true||
     claim.productionDeployAuthorized!==false||
     claim.d1AdditionalRowsWritten!==0)
   return hold('R2_ADMISSION_DUPLICATE_OR_UNKNOWN');
  let write;try{write=await commitExactQaPair({env,ticket,claim});}
  catch{return hold('D1_ACK_UNKNOWN_NO_RETRY')}
  if(write?.status!=='QA784_EXACT_D1_COMMITTED'||
     write.canonicalOperationId!==ticket.canonicalOperationId||
     write.rowsWritten!==1)
   return hold('D1_EXACT_W1_NOT_PROVEN');
  let receipt;try{receipt=await settleImmutableReceipt({
   env,ticket,claim,write});}catch{return hold('R2_SETTLED_ACK_UNKNOWN')}
  if(receipt?.status!=='QA_IMMUTABLE_SETTLED_ONLY'||
     receipt.productionDeployAuthorized!==false)
   return hold('R2_SETTLED_NOT_PROVEN');
  return Object.freeze({status:'QA784_ONE_SYNTHETIC_CHANGE_SETTLED',
   kind:x.kind,operationId:ticket.canonicalOperationId,d1RowsWritten:1,
   completeLegacyWriterCutoverVerified:false,
   realFirebaseSignedAuthVerified:false,...blocked});
 }});
}

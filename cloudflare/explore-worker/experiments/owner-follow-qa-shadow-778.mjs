// APP778 QA-only signed status shadow. No mutations and no extra server reads.
// Called ONLY after APP749 verifies real Auth+AppCheck; never accepts client
// assertions of owner epoch, pending fence, cutover or canonical operation.
import {assessApp775UnifiedFollowIngress} from '../../../scripts/app775-unified-follow-ingress.mjs';

export const APP778_SIGNED_QA_SHADOW_SOURCE_ONLY=true;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const blocked=o=>o?.legacyCanonicalModified===false&&
 o?.routeToLiveCanonical===false&&o?.canonicalD1WriteAuthorized===false&&
 o?.doReservationAuthorized===false&&o?.r2AdmissionAuthorized===false&&
 o?.retryAuthorized===false&&o?.relayAuthorized===false&&
 o?.activeRuntimeConnected===false&&o?.productionDeployAuthorized===false;
const HOLD=Object.freeze({status:'HOLD',realWriterConnected:false,
 serverReadsAdded:0,serverWritesAdded:0,doCallsAdded:0,
 sourceOnly:true});
export async function evaluateApp778SignedQaShadow({
 verifiedPrincipal,config,env,assess=assessApp775UnifiedFollowIngress,
}={}){
 // Reuse *only* the APP749 server-verified principal; no raw JWT, UID or
 // client-provided evidence is ever emitted by this QA status shadow.
 if(env?.SORIDRAW_ENVIRONMENT!=='preview'||
  env?.SORIDRAW_QA749_REAL_AUTH!=='1'||
  env?.DB||env?.PROFILE_MEDIA||env?.RATE_DB||env?.EXPLORE_CACHE||
  env?.SORIDRAW_OWNER_FOLLOW_ENDPOINT_539||
  verifiedPrincipal?.verified!==true||
  verifiedPrincipal.qaProject!=='soridraw-app'||
  !UID.test(verifiedPrincipal.uid||'')||
  !UID.test(config?.actorUid||'')||!UID.test(config?.ownerUid||'')||
  ![config.actorUid,config.ownerUid].includes(verifiedPrincipal.uid))
   return HOLD;
 // Two read-only QA test envelopes; *not* real incoming follow requests.
 // No trusted owner epoch, canonical ledger, global Writer coverage or
 // independent pending fence is available. A shape-only PASS here would be
 // a serious false green and must fail the QA status gate.
 for(const body of ['{}',JSON.stringify({
  followOperationId:'qa778_shadow_ordered_op_123456789',
  followExpectedRevision:16,
 })]){
  let decision;
  try{
   decision=await assess({
    enabled:true,scope:'APP777_ISOLATED_QA_SIGNED_READ_ONLY',
    method:'PUT',ownerUid:config.ownerUid,body,
    verifiedActor:{
     source:'SIGNED_FIREBASE_AUTH_APP_CHECK_775',verified:true,
     firebaseProjectId:'soridraw-app',uid:verifiedPrincipal.uid,
     // Auth epoch must NOT be fabricated from Firebase JWT or QA config.
    },
    // Deliberately NO ownerEnrollment, cutover, serverIdentity, pair or
    // pendingFence. Authentication is not canonical mutation authority.
   });
  }catch{return HOLD}
  if(decision?.status!=='HOLD'||!blocked(decision)||
    decision.reason!=='SERVER_AUTH_OR_GENERATION_UNPROVEN')
   return HOLD;
 }
 return Object.freeze({status:'PASS_FAIL_CLOSED',
  qaFirebaseSignaturePreviouslyVerified:true,
  legacyShape:'HOLD',orderedShape:'HOLD',
  realWriterConnected:false,serverReadsAdded:0,
  serverWritesAdded:0,doCallsAdded:0,sourceOnly:true});
}

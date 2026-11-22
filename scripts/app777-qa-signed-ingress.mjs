// APP777 isolated-QA signed Firebase Auth + App Check gate.
// SOURCE-ONLY. Never imported by an active Worker or granted D1/R2/DO writes.
// Real token bytes remain in private QA Cloud Shell; nothing is logged/returned.
// Reuse APP749's Google public JWKS signature verifier, not an unsigned JWT.
import {createQaFirebaseVerifier749} from
 '../cloudflare/explore-worker/experiments/owner-follow-qa-real-auth-749.mjs';
import {assessApp775UnifiedFollowIngress} from './app775-unified-follow-ingress.mjs';

export const APP777_QA_SIGNED_INGRESS_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const stop=reason=>Object.freeze({
 status:'HOLD',reason,qaSignedCredentialsVerified:false,
 commonIngressShapeMatched:false,
 canonicalD1WriteAuthorized:false,r2AdmissionAuthorized:false,
 doReservationAuthorized:false,retryAuthorized:false,relayAuthorized:false,
 realFirebaseAuthRevocationChecked:false,liveWorkerConnected:false,
 productionDeployAuthorized:false,
});
const noMutations=Object.freeze({
 canonicalD1WriteAuthorized:false,r2AdmissionAuthorized:false,
 doReservationAuthorized:false,retryAuthorized:false,relayAuthorized:false,
 realFirebaseAuthRevocationChecked:false,liveWorkerConnected:false,
 productionDeployAuthorized:false,
});
export function createApp777QaSignedIngress({
 send=fetch,now=Date.now,subtle=globalThis.crypto?.subtle,
 qaActorUid,qaOwnerUid,
}={}){
 // Existing QA users ONLY, IDs from local private QA configuration. Never
 // allow the production Firebase project/UID as an implicit fallback.
 if(!UID.test(qaActorUid||'')||!UID.test(qaOwnerUid||'')||
    qaActorUid===qaOwnerUid)
   throw Error('APP777_QA_SCOPE_UNVERIFIED');
 const verify=createQaFirebaseVerifier749({send,now,subtle});
 return async function verifyAndAssess(request,{evidence,expectedOwnerUid}={}){
  if(!request||!UID.test(expectedOwnerUid||'')||
     expectedOwnerUid!==qaOwnerUid)
   return stop('QA_OWNER_SCOPE_UNVERIFIED');
  const method=request.method;
  if(method!=='PUT'&&method!=='DELETE')
   return stop('QA_METHOD_UNSUPPORTED');
  if(new URL(request.url).pathname!==
     '/v1/profiles/'+qaOwnerUid+'/follow'||
     new URL(request.url).search||
     request.headers.get('Origin'))
   return stop('QA_EXACT_ROUTE_REQUIRED');
  const length=request.headers.get('Content-Length');
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>512))
   return stop('QA_BODY_OVERSIZE');
  let body='';
  try{body=await request.text()}catch{return stop('QA_BODY_UNREADABLE')}
  if(body.length>512)return stop('QA_BODY_OVERSIZE');
  // The APP749 verifier enforces QA Firebase JWT and App Check cryptographic
  // RS256 signatures, exact QA issuer/audience, exp and actor UID. It needs
  // its pinned /qa730/verified/follow URL, reconstructed locally from the
  // request headers. This never sends the tokens to that HTTP endpoint.
  let proof;
  try{
   const authProbe=new Request('https://qa-only.invalid/qa730/verified/follow',{
    method,headers:request.headers,
   });
   proof=await verify(authProbe,{
    actorUid:qaActorUid,ownerUid:qaOwnerUid,
    method,path:'follow',
   });
  }catch{return stop('SIGNED_QA_FIREBASE_OR_APPCHECK_REJECTED')}
  if(proof?.verified!==true||proof.uid!==qaActorUid||
     proof.qaProject!=='soridraw-app')
    return stop('QA_SIGNED_ACTOR_UNVERIFIED');
  // APP775's additional epoch, enrollment, pending fence and writer cutover
  // remain synthetic/unattested. This test cannot assert those were verified
  // merely because Firebase JWT signatures were verified above.
  const evidenceSafe=evidence&&typeof evidence==='object'?evidence:{};
  let outcome;
  try{
   outcome=await assessApp775UnifiedFollowIngress({
    ...evidenceSafe,
    scope:'APP777_ISOLATED_QA_SIGNED_READ_ONLY',
    enabled:true,method,body,ownerUid:qaOwnerUid,
    verifiedActor:{
     source:'SIGNED_FIREBASE_AUTH_APP_CHECK_775',
     verified:true,uid:proof.uid,firebaseProjectId:proof.qaProject,
     // This is supplied by isolated synthetic QA fixture, not proven
     // auth epoch/revocation evidence.
     authEpoch:evidenceSafe.verifiedActor?.authEpoch,
    },
   });
  }catch{return stop('COMMON_INGRESS_SHAPE_ERROR')}
  if(outcome.status!=='OFFLINE_COMMON_INGRESS_PROOF_SHAPE_ONLY')
   return Object.freeze({
    ...stop('COMMON_INGRESS_SHAPE_UNVERIFIED'),
    qaSignedCredentialsVerified:true,
   });
  return Object.freeze({
   status:'QA_SIGNED_CREDENTIALS_AND_COMMON_SHAPE_ONLY',
   qaSignedCredentialsVerified:true,commonIngressShapeMatched:true,
   actorUidVerifiedAgainstPrivateQaConfig:true,
   requiresRealServerEpochAndWriterCutover:true,
   envelopeKind:outcome.envelopeKind,
   stateChanged:outcome.stateChanged,
   ...noMutations,
  });
 };
}

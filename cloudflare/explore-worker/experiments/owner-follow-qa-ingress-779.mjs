// APP779: QA-only signed legacy/ordered HTTP ingress, read-only HOLD.
// Called only after APP749 verifies real Auth + App Check. No canonical writes.
import {assessApp775UnifiedFollowIngress} from '../../../scripts/app775-unified-follow-ingress.mjs';
export const APP779_QA_INGRESS_SOURCE_ONLY=true;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const unsafeFlags=[
 'legacyCanonicalModified','routeToLiveCanonical',
 'canonicalD1WriteAuthorized','doReservationAuthorized',
 'r2AdmissionAuthorized','retryAuthorized','relayAuthorized',
 'activeRuntimeConnected','productionDeployAuthorized',
];
const reply=(http,status)=>Response.json({
 ok:false,syntheticOnly:true,qa779ReadOnly:true,status,
},{status:http,headers:{'Cache-Control':'no-store'}});
export async function handleApp779QaSignedIngress({
 request,verifiedPrincipal,config,env,
 assess=assessApp775UnifiedFollowIngress,
}={}){
 if(env?.SORIDRAW_ENVIRONMENT!=='preview'||
  env?.SORIDRAW_QA749_REAL_AUTH!=='1'||
  env?.DB||env?.PROFILE_MEDIA||env?.RATE_DB||
  env?.EXPLORE_CACHE||env?.SORIDRAW_OWNER_FOLLOW_ENDPOINT_539||
  verifiedPrincipal?.verified!==true||
  verifiedPrincipal.qaProject!=='soridraw-app'||
  !UID.test(config?.actorUid||'')||
  !UID.test(config?.ownerUid||'')||
  config.actorUid===config.ownerUid||
  verifiedPrincipal.uid!==config.actorUid||
  !request||!['PUT','DELETE'].includes(request.method)||
  new URL(request.url).pathname!=='/qa730/verified/ingress')
  return reply(403,'QA_SCOPE_DENIED');
 const length=request.headers.get('Content-Length');
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>512))
  return reply(413,'QA_BODY_LIMIT');
 let body;
 try{body=await request.text()}catch{return reply(400,'QA_BODY_UNREADABLE')}
 if(new TextEncoder().encode(body).byteLength>512)
  return reply(413,'QA_BODY_LIMIT');
 let decision;
 try{
  decision=await assess({
   enabled:true,scope:'APP777_ISOLATED_QA_SIGNED_READ_ONLY',
   method:request.method,ownerUid:config.ownerUid,body,
   verifiedActor:{
    source:'SIGNED_FIREBASE_AUTH_APP_CHECK_775',verified:true,
    firebaseProjectId:'soridraw-app',uid:verifiedPrincipal.uid,
    // Intentionally NO fabricated authEpoch from a signed token.
   },
   // No ownerEnrollment, cutover, serverIdentity, pair or pendingFence.
   // Never trust these as client-supplied evidence.
  });
 }catch{return reply(503,'QA_GATE_FAILURE')}
 if(decision?.status!=='HOLD'||unsafeFlags.some(k=>decision?.[k]!==false))
  return reply(503,'QA_GATE_FAILURE');
 if(!['SERVER_AUTH_OR_GENERATION_UNPROVEN',
    'INVALID_OR_PARTIAL_ENVELOPE'].includes(decision.reason))
  return reply(503,'QA_GATE_FAILURE');
 // HTTP 409 means both formats are correctly HELD, not committed/queued.
 return reply(409,decision.reason);
}

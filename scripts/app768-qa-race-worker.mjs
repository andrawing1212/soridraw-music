// APP768 disposable QA Worker: actual APP767 admission code; one synthetic key only.
import {createApp767IsolatedR2Admission} from './app767-r2-admission-candidate.mjs';
const a=e=>({ownerUid:'app768OwnerSynthetic',actorUid:'app768ActorSynthetic',
 authEpoch:e.APP768_EPOCH,cutoverToken:e.APP768_CUTOVER,
 canonicalOperationId:e.APP768_OPERATION,expectedRevision:7,desired:true});
const proof=x=>({source:'SERVER_ATTESTED_NEW_EPOCH_ONLY_767',verified:true,
 ownerUid:x.ownerUid,actorUid:x.actorUid,authEpoch:x.authEpoch,
 cutoverToken:x.cutoverToken,expectedRevision:x.expectedRevision,
 completeBeforeFirstAcceptedOperation:true,canonicalWriterCoverageProven:true,
 noLegacyIdNamespaceOverlap:true,userDeletionLifecycleReviewed:true,
 isolationFromOwnerDoPitrProven:true});
const response=(o,status=200)=>Response.json(o,{status,headers:{'Cache-Control':'no-store'}});
const valid=e=>e?.SORIDRAW_ENVIRONMENT==='isolated-qa'&&
 typeof e.QA_APP768_R2?.put==='function'&&typeof e.QA_APP768_R2?.head==='function'&&
 typeof e.QA_APP768_R2?.delete==='function'&&
 /^[a-f0-9]{32}$/.test(e.APP768_EPOCH||'')&&
 /^qa768_cutover_[a-f0-9]{32}$/.test(e.APP768_CUTOVER||'')&&
 /^qa768_op_[a-f0-9]{32}$/.test(e.APP768_OPERATION||'')&&
 /^[a-f0-9]{64}$/.test(e.APP768_ACCESS||'');
async function key(x){
 const raw=new TextEncoder().encode(JSON.stringify([
 x.cutoverToken,x.ownerUid,x.actorUid,x.authEpoch,x.canonicalOperationId]));
 const h=new Uint8Array(await crypto.subtle.digest('SHA-256',raw));
 return 'internal/qa767/owner-follow-admissions/'+
  [...h].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export default {async fetch(req,env){
 if(!valid(env))return response({status:'HOLD_ENV'},503);
 if(req.headers.get('X-APP768-QA-Access')!==env.APP768_ACCESS)
  return response({status:'DENIED'},403);
 const p=new URL(req.url).pathname, reservation=a(env), k=await key(reservation);
 if(req.method==='GET'&&p==='/health')
  return response({status:'READY',empty:(await env.QA_APP768_R2.head(k))===null});
 if(req.method==='POST'&&p==='/claim'){
  const admission=createApp767IsolatedR2Admission({
   enabled:true,scope:'APP767_ISOLATED_SYNTHETIC_QA',
   bucket:env.QA_APP768_R2,verifyTrustedCutover:async q=>proof(q)});
  const x=await admission.claim({
   env:{SORIDRAW_ENVIRONMENT:'isolated-qa'},reservation});
  if(x.status==='ADMISSION_ONLY_NOT_D1_COMMIT')
   return response({status:'ADMISSION_ONLY_NOT_D1_COMMIT'},201);
  if(x.reason==='PRIOR_OR_CONCURRENT_CLAIM_REQUIRES_RECONCILIATION')
   return response({status:'DUPLICATE_BLOCKED'},409);
  return response({status:'HOLD',reason:x.reason||'UNKNOWN'},503);
 }
 if(req.method==='GET'&&p==='/inspect'){
  const x=await env.QA_APP768_R2.head(k);
  return response({status:'INSPECT',exists:!!x,
   contentType:x?.httpMetadata?.contentType||null});
 }
 if(req.method==='POST'&&p==='/cleanup'){
  await env.QA_APP768_R2.delete(k);
  const done=(await env.QA_APP768_R2.head(k))===null;
  return response({status:done?'CLEANED':'NOT_CLEANED'},done?200:500);
 }
 return response({status:'NOT_FOUND'},404);
}};

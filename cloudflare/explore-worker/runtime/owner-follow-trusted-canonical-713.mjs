// APP713: source-only trusted private canonical bridge.
// IMPORTANT: this is not a public API, does not import the canonical bundle,
// and MUST only be invoked after OwnerFollowReplayEntrypoint607 verifies the
// existing service-binding capability. Client actorUid is never trusted here.
// Production / TEST / not-enabled PREVIEW cannot issue a canonical mutation.
export const APP713_TRUSTED_CANONICAL_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const OP=/^[A-Za-z0-9_-]{16,128}$/;
const error=status=>({ok:false,status});
export async function commitTrustedFollow713({
 actorUid,ownerUid,desired,operationId,env,ctx,authorized,
 readCutover,readIntent,readMembership,runPrecommit,callCanonical,reserve,
 enabled=APP713_TRUSTED_CANONICAL_COMPILED_OPEN,
}={}){
 if(enabled!==true||env?.SORIDRAW_ENVIRONMENT!=='preview'||
    env?.SORIDRAW_FOLLOW_SERVER_CLICK_713!=='1'||
    env?.SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653!=='1'||
    env?.SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653!=='preview-only')
  return error('disabled');
 if(authorized!==true)return error('private-capability-required');
 if(!UID.test(String(actorUid||''))||!UID.test(String(ownerUid||''))||
    actorUid===ownerUid||!OP.test(String(operationId||''))||
    typeof desired!=='boolean')
  return error('invalid-operation');
 if([readCutover,readIntent,readMembership,runPrecommit,
     callCanonical,reserve].some(fn=>typeof fn!=='function'))
  return error('trusted-dependency-unavailable');
 let cutover,prior,member;
 try{
  cutover=await readCutover(env);
  if(cutover?.mode!=='overlay348'||cutover?.readOnly===true||
     typeof cutover.cutoverToken!=='string'||!cutover.cutoverToken)
   return error('canonical-writer-not-ready');
  prior=await readIntent(env,cutover,actorUid,ownerUid);
  if(prior?.value&&prior.value.settled!==true)
   return error('canonical-intent-unsettled');
  member=await readMembership(env,actorUid,ownerUid,cutover);
  if(member?.mode!=='overlay348'||typeof member.following!=='boolean')
   return error('canonical-membership-unverified');
 }catch{return error('canonical-state-unavailable')}
 const old=prior?.value||null;
 // Reuse the exact original pair revision if the canonical request committed
 // but its HTTP response was lost. Never mint a new expected revision for it.
 if(old?.id===operationId&&
    (old.actor!==actorUid||old.target!==ownerUid||
     old.following!==desired))
  return error('operation-identity-conflict');
 if(old?.id===operationId&&member.following!==desired)
  return error('operation-superseded');
 const expectedRevision=old?.id===operationId?
   old.expectedRevision:Number(old?.revision||0);
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)
  return error('pair-revision-invalid');
 if(member.following===desired)
  return {ok:true,status:'noop',canonicalFollowing:desired,
    revision:Number(old?.revision||0),changed:false};
 const request=new Request('https://soridraw-explore-preview.internal/v1/profiles/'+
   encodeURIComponent(ownerUid)+'/follow',{
   method:desired?'PUT':'DELETE',
   headers:{'Content-Type':'application/json',
    'Origin':'https://preview.soridraw.com'},
   body:JSON.stringify({followOperationId:operationId,
    followExpectedRevision:expectedRevision}),
 });
 let response;
 try{
  response=await runPrecommit({
   request,env,ctx,enabled:true,
   publicWithoutEpoch:true,
   // The principal was originally verified by Firebase at the HTTPS ingress.
   // This callback is allowed ONLY within the private, capability-verified
   // WorkerEntrypoint service path, never in public default.fetch.
   authenticate:async()=>({ok:true,uid:actorUid}),
   reserve,
   callCanonical:canonicalRequest=>callCanonical({
    request:canonicalRequest,env,ctx,
    actorUid,ownerUid,desired,cutover}),
  });
 }catch{return error('canonical-write-unavailable')}
 if(!response?.ok)return error('canonical-write-unconfirmed');
 let payload;
 try{payload=await response.json()}catch{return error('canonical-response-invalid')}
 const data=payload?.data;
 if(payload?.ok!==true||data?.uid!==ownerUid||
    data.following!==desired||
    !Number.isSafeInteger(data.revision)||data.revision<0)
  return error('canonical-ack-invalid');
 return {ok:true,status:'committed',canonicalFollowing:desired,
  revision:data.revision,changed:data.duplicate===false};
}

// APP671 PREVIEW-only private-Service replay composition.
// The existing owner replay ALWAYS validates the private bridge capability
// and canonical reservation before this wrapper can touch the public relay.
// No public HTTP route, no new DO class, no receipt deletion or background poll.
import {deliverVerifiedPublicFollow669} from './public-follow-http-669.mjs';
export const APP671_PUBLIC_DUAL_ACK_COMPILED_OPEN=false;
const reply=(status,code)=>Response.json({ok:false,status:code},{
 status,headers:{'Cache-Control':'private,no-store'},
});
export const handleOwnerAndPublicFollowReplay671=async({
 request,env,ownerHandler,publicRelay=deliverVerifiedPublicFollow669,
 enabled=APP671_PUBLIC_DUAL_ACK_COMPILED_OPEN,now=Date.now,send=fetch,
 authorizePublicOnly=()=>false,
}={})=>{
 if(typeof ownerHandler!=='function')throw Error('671_OWNER_HANDLER_REQUIRED');
 // Retain exact old service behavior until all preview-only gates are active.
 const active=enabled===true&&env?.SORIDRAW_ENVIRONMENT==='preview'&&
  env?.SORIDRAW_PUBLIC_FOLLOW_READY_669==='1'&&
  env?.SORIDRAW_PUBLIC_FOLLOW_SCOPE_669==='preview-only';
 if(!active)return ownerHandler();
 // Body must be cloned before the existing handler validates/consumes it.
 let copy;
 try{copy=request.clone()}catch{return reply(503,'request-clone-unavailable')}
 // Public counters for a visible target that has not enrolled the private
 // owner channel use a dedicated DO key and an explicit zero-epoch marker.
 // They may only bypass private owner delivery after the same internal
 // Service-Binding bridge capability and complete ticket are verified.
 // The public receiver independently verifies the exact settled D1/R2
 // operation and live Firebase Auth generations before writing any signal.
 let publicOnlyTicket=null;
 try{publicOnlyTicket=await copy.clone().json()}catch{}
 if(active&&publicOnlyTicket?.authEpoch==='0'.repeat(32)){
  if(!await authorizePublicOnly(request,publicOnlyTicket))
   return reply(403,'public-only-bridge-denied');
  let result;
  try{result=await publicRelay({reservation:publicOnlyTicket,env,enabled:true,now,send});}
  catch{return reply(503,'public-only-transport-retry')}
  if(result?.status==='target-not-public')
   return reply(409,'rejected-generation');
  if(result?.status!=='delivered'||!Number.isSafeInteger(result.deliveredRevision)||
     result.deliveredRevision<=publicOnlyTicket.priorR2Revision)
   return reply(503,'public-only-retry-required');
  return Response.json({ok:true,status:'delivered',
   deliveredRevision:result.deliveredRevision},{
    status:200,headers:{'Cache-Control':'private,no-store'}});
 }
 const existing=await ownerHandler();
 if(existing?.status!==200)return existing;
 let responseBody;
 try{responseBody=await existing.clone().json()}catch{return reply(503,'owner-ack-unreadable')}
 // A successful owner relay is never sufficient to ACK the durable ticket
 // until the corresponding public aggregate has been confirmed as well.
 if(responseBody?.ok!==true||responseBody?.status!=='delivered'||
    !Number.isSafeInteger(responseBody?.deliveredRevision)||
    responseBody.deliveredRevision<=0)
  return reply(503,'owner-ack-unverified');
 let reservation;
 try{reservation=await copy.json()}catch{return reply(503,'reservation-unreadable')}
 let result;
 try{
  result=await publicRelay({reservation,env,enabled:true,now,send});
 }catch{return reply(503,'public-transport-retry')}
 // If the target has no public profile, only its private owner channel
 // participates. Retrying this public-only absence would pin the DO ticket.
 if(result?.status==='target-not-public')return existing;
 if(result?.status!=='delivered')
  return reply(503,'public-retry-required');
 // Owner result is returned byte-for-byte; the DO marks delivery complete
 // only AFTER both independent idempotent receivers succeeded.
 return existing;
};

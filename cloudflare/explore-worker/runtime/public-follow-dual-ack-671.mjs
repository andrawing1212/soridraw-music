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
 if(result?.status!=='delivered')
  return reply(503,'public-retry-required');
 // Owner result is returned byte-for-byte; the DO marks delivery complete
 // only AFTER both independent idempotent receivers succeeded.
 return existing;
};

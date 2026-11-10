// APP557 isolated per-owner Durable Object HTTP adapter and source-only stub.
// No live Worker import of this class, no Wrangler migration or binding.
import {createOwnerFollowRecovery556,OWNER_FOLLOW_RECOVERY_556_COMPILED_OPEN}
 from './owner-follow-recovery-556.mjs';
export class OwnerFollowerRecovery557 {
 constructor(state,env){
  this.state=state;
  this.env=env;
  this.engine=createOwnerFollowRecovery556({
   state,env,enabled:OWNER_FOLLOW_RECOVERY_556_COMPILED_OPEN,
  });
 }
 async fetch(request){
  if(!OWNER_FOLLOW_RECOVERY_556_COMPILED_OPEN||
     this.env?.SORIDRAW_ENVIRONMENT!=='preview'||
     this.env?.SORIDRAW_OWNER_FOLLOW_W2_PUSH_555!=='1')
   return Response.json({ok:false,status:'disabled'},{status:503});
  const url=new URL(request.url);
  if(request.method!=='POST'||url.pathname!=='/owner-follow/reserve557')
   return new Response(null,{status:404});
  const limit=Number(request.headers.get('Content-Length')||0);
  if(limit>1024)return Response.json({ok:false,status:'oversized'},{status:413});
  let body;try{body=await request.json()}catch{
   return Response.json({ok:false,status:'invalid-json'},{status:400});
  }
  const result=await this.engine.reserve(body);
  return Response.json(result,{status:result.ok?200:503});
 }
 async alarm(){
  return this.engine.alarm();
 }
}
export async function reserveOwnerFollowViaDo557(ticket,env){
 const ns=env?.OWNER_FOLLOW_RECOVERY_557;
 if(!ns||typeof ns.idFromName!=='function'||typeof ns.get!=='function')
  return {ok:false,status:'missing-do-binding'};
 const stub=ns.get(ns.idFromName(ticket.ownerUid));
 const response=await stub.fetch('https://soridraw.internal/owner-follow/reserve557',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify(ticket),
 });
 if(!response?.ok)return {ok:false,status:'reservation-failed'};
 const result=await response.json().catch(()=>null);
 return result?.ok===true?result:{ok:false,status:'reservation-invalid-ack'};
}

// APP557 isolated per-owner Durable Object HTTP adapter and source-only stub.
// No live Worker import of this class, no Wrangler migration or binding.
import {createOwnerFollowRecovery556,OWNER_FOLLOW_RECOVERY_556_COMPILED_OPEN}
 from './owner-follow-recovery-556.mjs';
// APP564: actual source-wired DO HTTP boundary with injectible isolated
// dependencies. The active Durable Object class remains compiled OFF.
// A DO stub is private to the authenticated Worker binding; this route is
// NOT exposed as a public Worker HTTP handler or a client API.
export const APP564_OWNER_FOLLOW_DO_BRIDGE_COMPILED_OPEN=false;
export function createOwnerFollowDoService564({
 state,env,deliver,now,enabled=OWNER_FOLLOW_RECOVERY_556_COMPILED_OPEN,
}={}){
 const engine=createOwnerFollowRecovery556({
  state,env,enabled,...(deliver?{deliver}:{}),...(now?{now}:{}),
 });
 const active=()=>enabled&&env?.SORIDRAW_ENVIRONMENT==='preview'&&
  env?.SORIDRAW_OWNER_FOLLOW_W2_PUSH_555==='1';
 return {
  async fetch(request){
   if(!active())return Response.json({ok:false,status:'disabled'},{status:503});
   const url=new URL(request.url);
   if(request.method!=='POST'||url.pathname!=='/owner-follow/reserve557')
    return new Response(null,{status:404});
   const declared=Number(request.headers.get('Content-Length')||0);
   if(!Number.isSafeInteger(declared)||declared<0||declared>1024)
    return Response.json({ok:false,status:'oversized'},{status:413});
   let ticket;
   try{
    // Cloudflare internal stub requests are normally small; a forged/missing
    // Content-Length is not an authorization or resource-limit bypass.
    const body=await request.text();
    if(new TextEncoder().encode(body).byteLength>1024)
     return Response.json({ok:false,status:'oversized'},{status:413});
    ticket=JSON.parse(body);
   }catch{return Response.json({ok:false,status:'invalid-json'},{status:400});}
   const result=await engine.reserve(ticket);
   return Response.json(result,{status:result.ok?200:503});
  },
  alarm:()=>engine.alarm(),
 };
}
export class OwnerFollowerRecovery557 {
 constructor(state,env){
  this.service=createOwnerFollowDoService564({state,env});
 }
 fetch(request){return this.service.fetch(request)}
 alarm(){return this.service.alarm()}
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

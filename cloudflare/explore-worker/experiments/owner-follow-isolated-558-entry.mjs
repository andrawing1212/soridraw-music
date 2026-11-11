// APP558: synthetic-only isolated Durable Object physical proof entry.
// Used solely by the run-owned ephemeral Wrangler worker, NEVER by preview-entry.
// Does not bind shared D1/R2/Functions/RTDB or process actual user identities.
import {createOwnerFollowRecovery556}
 from '../runtime/owner-follow-recovery-556.mjs';
const reply=(value,status=200)=>Response.json(value,{status});
export class OwnerFollowIsolated558 {
 constructor(state,env){
  this.ctx=state;this.env=env;
  this.engine=createOwnerFollowRecovery556({
   state,env,enabled:true,
   deliver:async()=>{
    const mode=await state.storage.get('synthetic-mode');
    if(mode==='success')return {status:'delivered'};
    if(mode==='revoked')return {status:'rejected-generation'};
    return {status:'relay-failed'};
   },
  });
 }
 async fetch(request){
  if(request.headers.get('X-Owner558-Token')!==this.env.OWNER558_TEST_TOKEN)
   return reply({ok:false},403);
  const url=new URL(request.url);
  if(url.pathname==='/proof/status'&&request.method==='GET')
   return reply({pending:await this.ctx.storage.get('pending')||null,
    alarmAt:await this.ctx.storage.getAlarm(),
    hits:await this.ctx.storage.get('synthetic-hits')||0,
    mode:await this.ctx.storage.get('synthetic-mode')||'offline',
    canary:'app558'});
  if(url.pathname==='/proof/reserve'&&request.method==='POST'){
   let ticket;try{ticket=await request.json()}catch{return reply({ok:false},400)}
   return reply(await this.engine.reserve(ticket));
  }
  if(url.pathname==='/proof/mode'&&request.method==='POST'){
   const payload=await request.json().catch(()=>null);
   if(!['offline','success','revoked'].includes(payload?.mode))
    return reply({ok:false},400);
   await this.ctx.storage.put('synthetic-mode',payload.mode);
   return reply({ok:true});
  }
  if(url.pathname==='/proof/step'&&request.method==='POST')
   return reply(await this.engine.alarm());
  if(url.pathname==='/proof/cleanup'&&request.method==='POST'){
   await this.ctx.storage.deleteAlarm();
   await this.ctx.storage.deleteAll();
   return reply({ok:true,cleared:true});
  }
  return reply({ok:false},404);
 }
 async alarm(){
  const hits=Number(await this.ctx.storage.get('synthetic-hits')||0);
  await this.ctx.storage.put('synthetic-hits',hits+1);
  await this.engine.alarm();
 }
}
export default {
 async fetch(request,env){
  if(request.headers.get('X-Owner558-Token')!==env.OWNER558_TEST_TOKEN)
   return reply({ok:false},403);
  // Only one synthetic owner; never derive DO identities from the caller.
  const stub=env.OWNER558_DO.get(env.OWNER558_DO.idFromName('synthetic-owner-only'));
  return stub.fetch(request);
 },
};

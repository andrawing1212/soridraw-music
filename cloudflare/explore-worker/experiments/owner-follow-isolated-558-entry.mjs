// APP558: synthetic-only isolated Durable Object physical proof entry.
// Used solely by the run-owned ephemeral Wrangler worker, NEVER by preview-entry.
// Does not bind shared D1/R2/Functions/RTDB or process actual user identities.
import {createOwnerFollowRecovery556}
 from '../runtime/owner-follow-recovery-556.mjs';
import {createQaOwnerRelay583,parseOwnerQaConfig583} from './owner-follow-qa-live-583.mjs';
const reply=(value,status=200)=>Response.json(value,{status});
export class OwnerFollowIsolated558 {
 constructor(state,env){
  this.ctx=state;this.env=env;
  this.qa583=createQaOwnerRelay583({storage:state.storage,env});
  // Count only genuine APP561 engine storage calls in this synthetic DO.
  // In-memory counters do NOT add metering rows to real DO storage.
  this.meter={put:0,getAlarm:0,setAlarm:0};
  const wrapped={
   get:(...args)=>state.storage.get(...args),
   put:(...args)=>{this.meter.put++;return state.storage.put(...args)},
   delete:(...args)=>state.storage.delete(...args),
   getAlarm:(...args)=>{this.meter.getAlarm++;return state.storage.getAlarm(...args)},
   setAlarm:(...args)=>{this.meter.setAlarm++;return state.storage.setAlarm(...args)},
  };
  this.engine=createOwnerFollowRecovery556({
   state:{storage:wrapped},env,enabled:true,
   deliver:async()=>{
    const mode=await state.storage.get('synthetic-mode');
    if(mode==='success')return {status:'delivered'};
    if(mode==='revoked')return {status:'rejected-generation'};
    return {status:'relay-failed'};
   },
  });
 }
 async fetch(request){
  if(new URL(request.url).pathname.startsWith('/qa583/'))
   return this.qa583.fetch(request);
  if(this.qa583.enabled()||!this.env.OWNER558_TEST_TOKEN||
     request.headers.get('X-Owner558-Token')!==this.env.OWNER558_TEST_TOKEN)
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
  if(url.pathname==='/proof/burst'&&request.method==='POST'){
   // In one request, the real 1s owner alarm cannot fire between admissions.
   // This validates one vs multiple BILLABLE setAlarm API invocations.
   const records=await request.json().catch(()=>null);
   if(!Array.isArray(records)||records.length!==2||
      records.some(r=>r?.ownerUid!=='A'))
    return reply({ok:false},400);
   const before={...this.meter};
   const first=await this.engine.reserve(records[0]);
   const second=await this.engine.reserve(records[1]);
   return reply({first,second,meter:{
    put:this.meter.put-before.put,
    getAlarm:this.meter.getAlarm-before.getAlarm,
    setAlarm:this.meter.setAlarm-before.setAlarm,
   }});
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
  if(await this.qa583.alarm())return;
  const hits=Number(await this.ctx.storage.get('synthetic-hits')||0);
  await this.ctx.storage.put('synthetic-hits',hits+1);
  await this.engine.alarm();
 }
}
export default {
 async fetch(request,env){
  const qaRoute=new URL(request.url).pathname.startsWith('/qa583/');
  if(qaRoute){
   const cfg=parseOwnerQaConfig583(env.OWNER583_QA_CONFIG);
   if(!cfg||request.headers.get('X-Owner583-Token')!==cfg.probeToken)
    return reply({ok:false},403);
  }else if(!env.OWNER558_TEST_TOKEN||
   request.headers.get('X-Owner558-Token')!==env.OWNER558_TEST_TOKEN)
   return reply({ok:false},403);
  // Only one synthetic owner; never derive DO identities from the caller.
  const stub=env.OWNER558_DO.get(env.OWNER558_DO.idFromName('synthetic-owner-only'));
  return stub.fetch(request);
 },
};

import {DurableObject} from 'cloudflare:workers';
import {legacySchedulerClass} from './adapter.mjs';
// Synthetic queue only. No D1/R2, Firebase or production network bindings.
const KEY='active-scheduled-at-194';
const Wrapped=legacySchedulerClass(DurableObject);
export class Legacy extends Wrapped {
 async fetch(req){
  const p=new URL(req.url).pathname,s=this.ctx.storage;
  if(p==='/seed'){
   const b=await req.json();
   await s.put(KEY,b.marker);
   await s.put('unrelated','preserve');
   if(b.alarm===true)await s.setAlarm(Date.now()+1500);
   return Response.json({ok:true});
  }
  if(p==='/state')return Response.json({marker:(await s.get(KEY))??null,unrelated:await s.get('unrelated')});
  if(p==='/invoke'){try{await this.alarm();return Response.json({ok:true})}catch{return Response.json({ok:false},{status:503})}}
  if(p==='/clean'){await s.deleteAlarm();await s.deleteAll();return Response.json({ok:true})}
  return super.fetch(req);
 }
}
export class Shared extends DurableObject {
 async fetch(req){
  const p=new URL(req.url).pathname,s=this.ctx.storage;
  if(p==='/mode'){const mode=await req.text();if(!['fail','ambiguous','settled'].includes(mode))return new Response('bad',{status:400});await s.put('mode',mode);return Response.json({ok:true})}
  if(p==='/state')return Response.json({attempts:(await s.get('attempts'))??0,writes:(await s.get('writes'))??0});
  if(p==='/clean'){await s.deleteAlarm();await s.deleteAll();return Response.json({ok:true})}
  if(p!=='/schedule'||req.method!=='POST')return new Response('not found',{status:404});
  const payload=await req.json();
  if(payload.expectedBatchId418&&payload.expectedBatchId418!=='synthetic-qa-only')return new Response('bad',{status:400});
  const mode=await s.transaction(async tx=>{
   const n=(await tx.get('attempts'))??0;await tx.put('attempts',n+1);return await tx.get('mode');
  });
  if(mode==='fail')return Response.json({ok:false},{status:503});
  if(mode==='ambiguous')return Response.json({ok:true,scheduledAt:123,newlyScheduled:false,activeRecovery194:true});
  if(mode!=='settled')return new Response('not ready',{status:503});
  await s.transaction(async tx=>{if(!await tx.get('settled')){await tx.put('settled',true);await tx.put('writes',1)}});
  return Response.json({ok:true,scheduledAt:123,newlyScheduled:true,activeRecovery194:true,settled:true});
 }
}
// One authenticated external endpoint; explicit namespace, path and method.
// Mark every application response so a provider-edge 404 is distinguishable.
export default {async fetch(req,env){
 const reply=(body,status)=>Response.json(body,{status,headers:{'X-SORIDRAW-QA-Route':'entry'}});
 if(req.method!=='POST'||!env.QA_ACCESS||req.headers.get('X-QA-Access')!==env.QA_ACCESS)return reply({code:'DENIED'},403);
 if(new URL(req.url).pathname!=='/qa')return reply({code:'QA_ENTRY_PATH'},404);
 const target=req.headers.get('X-QA-Command')||'';
 const m=/^(legacy|shared)\/(seed|state|invoke|mode|clean|schedule)$/.exec(target);
 if(!m)return reply({code:'QA_COMMAND'},404);
 const ns=m[1]==='shared'?env.RELEASE_SHARED_LIKE_SCHEDULER:env.EXPLORE_LIKE_BATCH_SCHEDULER;
 const body=await req.text();
 const response=await ns.get(ns.idFromName('shared-like-batch')).fetch(new Request('https://qa.internal/'+m[2],{method:'POST',headers:{'Content-Type':'application/json'},body}));
 const headers=new Headers(response.headers);
 headers.set('X-SORIDRAW-QA-Route',m[1]);
 return new Response(response.body,{status:response.status,headers});
}};

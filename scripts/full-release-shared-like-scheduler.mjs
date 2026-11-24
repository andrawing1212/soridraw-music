// Reuse the already-active PREVIEW like scheduler as the one common window.
// The old production DO namespace stays bound; its remaining alarm forwards
// the accepted work in the SAME canonical D1 queue to the shared scheduler.
// This is a source-only candidate, not an authorization to activate.
// Never clear the old alarm marker/queue or create a second writer.
const BINDING='RELEASE_SHARED_LIKE_SCHEDULER';
const EXISTING='EXPLORE_LIKE_BATCH_SCHEDULER';
const NAME='shared-like-batch';
const ROUTES=new Set(['/schedule','/public-register','/public-release','/public-ack','/curated-repair-468/reserve','/curated-repair-468/confirm','/curated-repair-468/ack']);
export function sharedScheduler(env){
 const ns=env?.[BINDING];
 if(env?.SORIDRAW_ENVIRONMENT!=='production'||!ns||ns===env?.[EXISTING]||typeof ns.idFromName!=='function'||typeof ns.get!=='function')throw Error('SHARED_LIKE_SCHEDULER_NOT_READY');
 return ns;
}
export async function forwardLegacySchedule(env,request){
 const ns=sharedScheduler(env);
 return ns.get(ns.idFromName(NAME)).fetch(request);
}
export async function wakeAcceptedQueue(env){
 const response=await forwardLegacySchedule(env,new Request('https://soridraw.internal/schedule',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}));
 const data=await response.json().catch(()=>null);
 if(!response.ok||data?.ok!==true||!Number.isFinite(Number(data.scheduledAt))||Number(data.scheduledAt)<=0)throw Error('LEGACY_LIKE_HANDOFF_UNCONFIRMED');
 return data;
}
export function legacySchedulerClass(Original){
 return class ExploreLikeBatchScheduler103 extends Original{
  async fetch(request){
   if(request.method!=='POST'||!ROUTES.has(new URL(request.url).pathname))return new Response('Not found',{status:404});
   return forwardLegacySchedule(this.env,request);
  }
  async alarm(){await wakeAcceptedQueue(this.env);}
 };
}
export function composeSharedScheduler(core){
 return {...core,async fetch(request,env,ctx){
  // No environment spoofing. Only the queue binding is projected.
  const target=sharedScheduler(env);
  const projected=new Proxy(env,{get(obj,key,receiver){return key===EXISTING?target:Reflect.get(obj,key,receiver)}});
  return core.fetch.call(core,request,projected,ctx);
 },async scheduled(controller,env,ctx){
  // The default canonical scheduled handler drains the likes queue.
  // Keep the dedicated non-like labels on the existing core. Any legacy
  // like cron uses the same existing shared DO, never a second aggregate.
  if(['soridraw-owner-follow-retry-542'].includes(controller?.cron))return core.scheduled.call(core,controller,env,ctx);
  // Actual configured schedules must be checked before deployment.
  return wakeAcceptedQueue(env);
 }};
}

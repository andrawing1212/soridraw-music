// Isolated local workerd: actual Durable Object storage and transactions;
// synthetic shared scheduler only. No production or Cloudflare credentials.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(resolve(process.argv[2],'package.json'));
const {Miniflare}=require('miniflare');
const adapter=readFileSync(new URL('./full-release-shared-like-scheduler.mjs',import.meta.url),'utf8');
const fixture=`
const KEY='active-scheduled-at-194';
class Original {constructor(ctx,env){this.ctx=ctx;this.env=env}}
const Wrapped=legacySchedulerClass(Original);
export class Legacy extends Wrapped{
 async fetch(req){
  const p=new URL(req.url).pathname;
  if(p==='/seed'){await this.ctx.storage.put(KEY,100);await this.ctx.storage.put('unrelated','preserve');return Response.json({ok:true})}
  if(p==='/state')return Response.json({marker:(await this.ctx.storage.get(KEY))??null,unrelated:await this.ctx.storage.get('unrelated')});
  if(p==='/invoke'){try{await this.alarm();return Response.json({ok:true})}catch{return Response.json({ok:false},{status:503})}}
  return super.fetch(req);
 }
}
export class Shared{
 constructor(ctx){this.ctx=ctx}
 async fetch(req){
  const p=new URL(req.url).pathname,s=this.ctx.storage;
  if(p==='/mode'){await s.put('mode',await req.text());return Response.json({ok:true})}
  if(p==='/state')return Response.json({writes:(await s.get('writes'))??0});
  const mode=await s.get('mode');
  if(mode==='fail')return Response.json({ok:false},{status:503});
  if(mode==='ambiguous')return Response.json({ok:true,scheduledAt:123,newlyScheduled:false,activeRecovery194:true});
  await s.transaction(async tx=>{if(!await tx.get('settled')){await tx.put('settled',true);await tx.put('writes',1)}});
  return Response.json({ok:true,scheduledAt:123,newlyScheduled:true,activeRecovery194:true,settled:true});
 }
}
export default {async fetch(req,env){
 const u=new URL(req.url),shared=u.pathname.startsWith('/shared/');
 const ns=shared?env.RELEASE_SHARED_LIKE_SCHEDULER:env.EXPLORE_LIKE_BATCH_SCHEDULER;
 const path=u.pathname.replace(/^\\/(shared|legacy)/,'');
 return ns.get(ns.idFromName('shared-like-batch')).fetch(new Request('https://qa.internal'+path,req));
}};
`;
const mf=new Miniflare({modules:true,script:adapter+'\n'+fixture,compatibilityDate:'2026-06-17',cf:false,bindings:{SORIDRAW_ENVIRONMENT:'production'},durableObjects:{EXPLORE_LIKE_BATCH_SCHEDULER:{className:'Legacy',useSQLite:true},RELEASE_SHARED_LIKE_SCHEDULER:{className:'Shared',useSQLite:true}},outboundService:()=>new Response('LOCAL_NETWORK_BLOCKED',{status:503})});
try{
 const call=async(path,body)=>{const r=await mf.dispatchFetch('http://localhost'+path,{method:'POST',...(body===undefined?{}:{body})});return {status:r.status,data:await r.json()}};
 const state=async()=> (await call('/legacy/state')).data;
 await call('/legacy/seed');await call('/shared/mode','fail');
 assert.equal((await call('/legacy/invoke')).status,503);assert.deepEqual(await state(),{marker:100,unrelated:'preserve'});
 await call('/shared/mode','ambiguous');assert.equal((await call('/legacy/invoke')).status,200);assert.equal((await state()).marker,100);
 await call('/shared/mode','settled');assert.equal((await call('/legacy/invoke')).status,200);assert.deepEqual(await state(),{marker:null,unrelated:'preserve'});
 await call('/legacy/invoke');assert.deepEqual((await call('/shared/state')).data,{writes:1});
 console.log('FULL_RELEASE_LOCAL_WORKERD_HANDOFF_MARKER=PASS; SYNTHETIC_SETTLEMENT; CLOUD_DEPLOY=0; CANONICAL_E2E_NOT_RUN');
}finally{await mf.dispose()}

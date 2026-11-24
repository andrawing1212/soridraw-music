// Execute pinned scheduler classes and their actual D1 SQL in local workerd.
// Synthetic rows and local R2 only; no Cloudflare writes, external service calls or live credentials.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
const [dir,install]=process.argv.slice(2);assert(dir&&install);
const require=createRequire(resolve(install,'package.json'));
const {Miniflare}=require('miniflare');
const adapter=readFileSync('scripts/full-release-shared-like-scheduler.mjs','utf8');
const harness=`
import {ExploreLikeBatchScheduler103 as Old} from './legacy/production-main.mjs';
import {ExploreLikeBatchScheduler103 as New} from './shared/production-main.mjs';
import {legacySchedulerClass} from './adapter.mjs';
const key='active-scheduled-at-194';
const Adapted=legacySchedulerClass(Old);
export class Legacy extends Adapted{
 async fetch(req){
  const s=this.ctx.storage,p=new URL(req.url).pathname;
  if(p==='/seed'){await s.put(key,Date.now());return Response.json({ok:true})}
  if(p==='/state')return Response.json({marker:(await s.get(key))??null});
  if(p==='/handoff'){await super.alarm();return Response.json({ok:true})}
  if(p==='/rollback'){await Old.prototype.alarm.call(this);return Response.json({ok:true})}
  return super.fetch(req);
 }
}
export class Shared extends New{
 constructor(ctx,env){
  const fault={afterBatch:false};
  const db=new Proxy(env.DB,{get(target,prop){
   if(prop==='batch')return async (...args)=>{
    const result=await target.batch(...args);
    if(fault.afterBatch){fault.afterBatch=false;throw Error('QA_CRASH_AFTER_CANONICAL_COMMIT')}
    return result;
   };
   const v=Reflect.get(target,prop,target);return typeof v==='function'?v.bind(target):v;
  }});
  super(ctx,new Proxy(env,{get(t,p){return p==='DB'?db:Reflect.get(t,p,t)}}));
  this.qaFault=fault;
 }
 async fetch(req){
  const p=new URL(req.url).pathname;
  if(p==='/state'){const s=this.ctx.storage;return Response.json({marker:(await s.get(key))??null,rows:[...(await s.list()).keys()]})}
  if(p==='/inject'){await this.ctx.storage.delete(key);await this.ctx.storage.deleteAlarm();this.qaFault.afterBatch=true;return Response.json({ok:true})}

  return super.fetch(req);
 }
}
export default {async fetch(req,env){
 const u=new URL(req.url),shared=u.pathname.startsWith('/shared/');
 const ns=shared?env.RELEASE_SHARED_LIKE_SCHEDULER:env.EXPLORE_LIKE_BATCH_SCHEDULER;
 const path=u.pathname.replace(/^\\/(shared|legacy)/,'');
 return ns.get(ns.idFromName('shared-like-batch')).fetch(new Request('https://qa.internal'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:await req.text()}));
}};
`;
writeFileSync(join(dir,'adapter.mjs'),adapter);
writeFileSync(join(dir,'entry.mjs'),harness);
const mf=new Miniflare({modules:true,modulesRoot:dir,scriptPath:join(dir,'entry.mjs'),compatibilityDate:'2026-08-06',cf:false,
 bindings:{SORIDRAW_ENVIRONMENT:'production',ENV_NAME:'production',SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET:'local-test-only-never-live-secret',SORIDRAW_PUBLIC_RELEASE416_ENDPOINT:'https://local.invalid/release'},
 durableObjects:{EXPLORE_LIKE_BATCH_SCHEDULER:{className:'Legacy',useSQLite:true},RELEASE_SHARED_LIKE_SCHEDULER:{className:'Shared',useSQLite:true}},
 d1Databases:['DB','RATE_DB'],r2Buckets:['PROFILE_MEDIA','EXPLORE_CACHE'],
 outboundService:async req=>{
  const u=new URL(req.url);
  if(req.method==='GET'&&/cloudfunctions\.net$/.test(u.hostname)&&/config/i.test(u.pathname))return Response.json({ok:true,data:{publicMinutes:20}});
  return new Response('ISOLATED_EXTERNAL_BLOCKED',{status:503});
 }});
try{
 console.log('EXACT_SOURCE_LOCAL_RUNTIME_COMPAT_DATE=2026-08-06; DEPLOYED_COMPAT_DATE_2026-08-28_NOT_CLAIMED');
 const db=await mf.getD1Database('DB'),r2=await mf.getR2Bucket('PROFILE_MEDIA');
 const sql=readFileSync('cloudflare/explore-worker/scripts/fixtures/canonical-schema.sql','utf8');
 // D1 exec processes one statement per line; the historical fixture has complete single-line statements.
 await db.exec(sql.split('\n').filter(x=>x.trim()&&!x.startsWith('--')).join('\n'));
 await db.exec('CREATE TABLE likes(track_id TEXT NOT NULL,user_uid TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(track_id,user_uid))');
 for(const name of ['20260911_01_explore_like_deferred_batches.sql','20260911_02_explore_like_compact_queue.sql','20260912_01_explore_like_w1_queue.sql','20260913_01_explore_like_user_queue.sql']){
  const raw=readFileSync('cloudflare/explore-worker/migrations/'+name,'utf8').split('\n').filter(x=>!x.trim().startsWith('--')).join(' ');
  for(const st of raw.split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(st).run();
 }
 await db.prepare("INSERT INTO tracks(id,owner_uid,source_type,source_id,suno_url_primary,published_at,created_at,updated_at) VALUES ('qa-song','qa-owner','music_note','qa-source','https://invalid.invalid',1,1,1)").run();
 await db.prepare("INSERT INTO track_stats(track_id,like_count,updated_at) VALUES ('qa-song',0,1)").run();
 for(const sort of ['latest','popular'])await r2.put('internal/explore/shared-feed-v112/'+sort+'-40.json',JSON.stringify({payload:{data:{items:[]}}}));
 const call=async(path,body={})=>{
  const r=await mf.dispatchFetch('http://localhost'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal(r.status,200,path+' status='+r.status+' '+(await r.clone().text()).slice(0,250));return r.json();
 };
 const pending=async()=>Number((await db.prepare('SELECT COUNT(*) AS n FROM explore_like_batches_069').first()).n);
 const likes=async()=>Number((await db.prepare("SELECT COUNT(*) AS n FROM likes WHERE track_id='qa-song'").first()).n);
 const batch=async(uid,liked,ch,trackId='qa-song')=>{
  const t=Date.now()-1000,id='l069_'+String(t).padStart(13,'0')+'_'+ch.repeat(64);
  await db.prepare('INSERT INTO explore_like_batches_069(batch_id,user_uid,created_at,mutation_count,mutations_json) VALUES (?,?,?,1,?)').bind(id,uid,t,JSON.stringify([{trackId,liked}])).run();return id;
 };
 await batch('qa-a',true,'a');await call('/legacy/seed');await call('/legacy/handoff');
 assert.equal(await pending(),0);assert.equal(await likes(),1);assert.equal((await call('/legacy/state')).marker,null);
 console.log('PINNED_CANONICAL_069_HANDOFF_D1_MEMBERSHIP=PASS');
 const shared=await call('/shared/state');assert(shared.rows.some(x=>/stage416\/public\/window/.test(x)),'PUBLIC_WINDOW_NOT_DURABLE');
 await call('/legacy/handoff');assert.equal(await likes(),1);assert.equal(await pending(),0);
 // Hold a real canonical processor lease to model an in-flight old writer.
 await batch('qa-b',true,'b');
 await db.prepare("UPDATE explore_like_processor_035 SET lease_until=?,owner='qa-inflight' WHERE id=1").bind(Date.now()+60000).run();
 await call('/legacy/seed');await call('/legacy/handoff');
 assert.equal(await pending(),1);assert.notEqual((await call('/legacy/state')).marker,null);
 await db.prepare("UPDATE explore_like_processor_035 SET lease_until=0,owner='' WHERE id=1 AND owner='qa-inflight'").run();
 await call('/legacy/rollback');
 assert.equal(await pending(),0);assert.equal(await likes(),2);
 console.log('PINNED_CANONICAL_LEASE_HANDOFF_AND_OLD_ROLLBACK=PASS');
 // A legacy alarm has no expectedTrackIds. Deliberately interrupt after the
 // real atomic membership+queue batch returns but before the DO joins public tracks.
 await db.prepare("INSERT INTO tracks(id,owner_uid,source_type,source_id,suno_url_primary,published_at,created_at,updated_at) VALUES ('qa-crash-song','qa-owner','music_note','qa-source-crash','https://invalid.invalid',1,1,1)").run();
 await db.prepare("INSERT INTO track_stats(track_id,like_count,updated_at) VALUES ('qa-crash-song',0,1)").run();
 await batch('qa-c',true,'c','qa-crash-song');await call('/legacy/seed');await call('/shared/inject');
 const interrupted=await mf.dispatchFetch('http://localhost/legacy/handoff',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 assert(interrupted.status>=500,'INJECTED_CRASH_NOT_OBSERVED');
 assert.equal(await pending(),0,'CANONICAL_QUEUE_NOT_COMMITTED');
 assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM likes WHERE track_id='qa-crash-song'").first()).n,1,'CANONICAL_RELATION_NOT_COMMITTED');
 assert.notEqual((await call('/legacy/state')).marker,null,'LEGACY_MARKER_LOST');
 const publicRows=(await call('/shared/state')).rows;
 const registered=publicRows.some(x=>x.endsWith('/track/qa-crash-song'));
 console.log('EXACT_LEGACY_HANDOFF_POSTCOMMIT_CRASH_REGISTERED='+registered);
 assert.equal(registered,true,'LEGACY_069_PUBLIC_TRACK_MISSING_AFTER_COMMIT_CRASH');

 console.log('SCOPE=LOCAL_EXACT_SCHEDULER_D1_R2; PUBLIC_RELEASE_AND_EXTERNAL_FUNCTIONS_NOT_VERIFIED');
}finally{await mf.dispose()}

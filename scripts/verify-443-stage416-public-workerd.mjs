// Local workerd/SQLite Durable Object verification; never uses deployed bindings.
// Install outside the repo: npm install --prefix /tmp/stage416-runtime-check miniflare@4.20260730.0
// Run: MINIFLARE_MODULE=/tmp/stage416-runtime-check/node_modules/miniflare/dist/src/index.js node scripts/verify-443-stage416-public-workerd.mjs
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import {build} from 'esbuild';
const {Miniflare}=await import(process.env.MINIFLARE_MODULE
 ?pathToFileURL(process.env.MINIFLARE_MODULE).href:'miniflare');
const root=process.cwd(),directory=mkdtempSync(join(tmpdir(),'stage416-workerd-'));
const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
const scheduler=entry.slice(entry.indexOf('export class ExploreLikeBatchScheduler103'),
 entry.indexOf('// SORIDRAW_BOUNDED_CANONICAL_PUBLIC_LIKE_CONVERGENCE_191_20260924'));
const secret='stage416-local-workerd-only-secret-32-characters';
const require=createRequire(import.meta.url),mod={exports:{}};
vm.runInNewContext(ts.transpileModule(readFileSync('functions/src/exploreLikePublicRelease416.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText,{module:mod,exports:mod.exports,require,Buffer,JSON,Object,Array,Number,Set,Map,Error,Date,Math});
const records=new Map();let rtdbWrites=0;
const db={ref:path=>({transaction:async update=>{
 const current=structuredClone(records.get(path)||null),next=update(current);
 if(next===undefined)return {committed:false,snapshot:{val:()=>current}};
 records.set(path,structuredClone(next));rtdbWrites++;
 return {committed:true,snapshot:{val:()=>next}};
}})};
const code=`
import {DurableObject} from 'cloudflare:workers';
import {PUBLIC_LIKE_WINDOW_KEY_416,registerPublicLikeEventStorage416,
 ackPublicLikeEventStorage416,joinPublicLikeChangedTracks416,stagePublicLikeOpenPayload416,
 mergePendingPublicLikeOpen416} from './cloudflare/explore-worker/runtime/public-like-window-416.mjs';
import {releaseDuePublicLikeWindow416 as release} from './cloudflare/explore-worker/runtime/public-like-release-416.mjs';
const STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE=true;
const EXPLORE_LIKE_ACTIVE_SCHEDULE_KEY_194='active-scheduled-at-194';
const EXPLORE_LIKE_ACTIVE_GRACE_MS_194=20000,EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105=5000;
let now=globalThis.Date.now(),environment,failPage=0,deletedPages=0,alarmRuns=0;
class Date extends globalThis.Date {static now(){return now;}}
const baseWorker={scheduled:async()=>{throw Error('public-only alarm ran private D1 aggregate');}};
const repairSharedPublicLikeCounts191=async()=>{throw Error('unexpected public repair');};
const wrapped=new WeakMap();
function faultStorage(storage){
 if(wrapped.has(storage))return wrapped.get(storage);
 const proxy=new Proxy(storage,{get(target,key){
  if(key==='transaction')return async fn=>{
   let removedWindow=false;
   const result=await target.transaction(async tx=>fn(new Proxy(tx,{get(t,k){
    if(k==='delete')return async keys=>{
     if((Array.isArray(keys)?keys:[keys]).some(key=>key.includes('/window/')))removedWindow=true;
     return t.delete(keys);
    };
    const value=Reflect.get(t,k);return typeof value==='function'?value.bind(t):value;
   }})));
   if(removedWindow&&++deletedPages===failPage)throw Error('injected committed page termination');
   return result;
  };
  const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
 }});
 wrapped.set(storage,proxy);return proxy;
}
const releaseDuePublicLikeWindow416=options=>release({...options,db:{},
 storage:faultStorage(options.storage),r2:environment.PROFILE_MEDIA,
 releaseEndpoint:'https://local.cloudfunctions.net/release',secret:${JSON.stringify(secret)},
 materialize:async({trackIds})=>({releaseRows:trackIds.map(trackId=>({trackId,ownerUid:'owner'})),d1Writes:0}),
 http:(_url,init)=>environment.PUBLISH.fetch('https://local.invalid/publish',init),
});
${scheduler}
export class Fixture extends ExploreLikeBatchScheduler103 {
 constructor(ctx,env){super(ctx,env);environment=env;}
 async fetch(request){
  const path=new URL(request.url).pathname,storage=this.ctx.storage;
  if(path==='/crash'){
   now=globalThis.Date.now();const opened=now-300000;
   const ids=Array.from({length:5000},(_,i)=>'track-'+String(i).padStart(5,'0'));
   await registerPublicLikeEventStorage416(storage,{eventId:'00000000-0000-4000-8000-000000000001',
    windowCandidateId:'00000000-0000-4000-8000-000000000002',eventAtMs:opened,
    publicMinutes:5,trackIds:ids.slice(0,256)},opened);
   await joinPublicLikeChangedTracks416(storage,ids.slice(256),opened+1);
   await ackPublicLikeEventStorage416(storage,'00000000-0000-4000-8000-000000000001',opened+2);
   failPage=3;
   try{await releaseDuePublicLikeWindow416({storage,nowMs:now});throw Error('expected interruption');}
   catch(error){if(error.message!=='injected committed page termination')throw error;}
   return Response.json({remaining:(await storage.list({prefix:'stage416/public/window/'})).size,
    checkpoint:await storage.get('stage416/public/release')});
  }
  if(path==='/resume'){
   now=globalThis.Date.now();failPage=0;
   const result=await releaseDuePublicLikeWindow416({storage,nowMs:now});
   return Response.json({...result,remaining:(await storage.list()).size});
  }
  if(path==='/successor'){
   now=globalThis.Date.now();const opened=now-300000;
   await registerPublicLikeEventStorage416(storage,{eventId:'00000000-0000-4000-8000-000000000003',
    windowCandidateId:'00000000-0000-4000-8000-000000000004',eventAtMs:opened,
    publicMinutes:5,trackIds:['A']},opened);
   await ackPublicLikeEventStorage416(storage,'00000000-0000-4000-8000-000000000003',opened+1);
   await joinPublicLikeChangedTracks416(storage,['B'],now);
   await releaseDuePublicLikeWindow416({storage,nowMs:now});
   const next=await storage.get(PUBLIC_LIKE_WINDOW_KEY_416);
   const alarm=await storage.getAlarm();
   if(!next||!alarm||alarm>next.deadlineAtMs)throw Error('successor wakeup missing');
   // Advance only this isolated test's clock; the real engine delivers alarm().
   now=next.deadlineAtMs;await storage.setAlarm(globalThis.Date.now()+50);
   return Response.json({next:next.windowId});
  }
  if(path==='/state')return Response.json({alarmRuns,remaining:(await storage.list()).size,
   alarm:await storage.getAlarm()});
  return new Response('unknown',{status:404});
 }
 async alarm(){await super.alarm();alarmRuns++;}
}
export default {fetch(request,env){return env.TEST.get(env.TEST.idFromName('stage416')).fetch(request);}};
`;
const bundle=await build({stdin:{contents:code,resolveDir:root,sourcefile:'stage416-workerd-fixture.mjs'},
 bundle:true,write:false,format:'esm',platform:'browser',external:['cloudflare:workers']});
const options={modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-07-30',
 durableObjects:{TEST:{className:'Fixture',useSQLite:true}},
 durableObjectsPersist:join(directory,'do'),r2Buckets:['PROFILE_MEDIA'],r2Persist:join(directory,'r2'),
 serviceBindings:{PUBLISH:async request=>{
  const raw=await request.text();
  const result=await mod.exports.publishPublicLikeRelease416(db,raw,
   request.headers.get('X-Soridraw-416-Public-Release-Signature'),secret,JSON.parse(raw).signedAtMs);
  return Response.json({ok:true,data:result});
 }}};
let mf;
try{
 mf=new Miniflare(options);
 const get=async path=>{
  const response=await mf.dispatchFetch('http://local'+path);
  assert.equal(response.status,200,await response.clone().text());return response.json();
 };
 const interrupted=await get('/crash');
 assert.equal(interrupted.remaining,2001);assert.equal(interrupted.checkpoint.published,true);
 const before=rtdbWrites;
 await mf.dispose();mf=new Miniflare(options); // actual isolate restart, same SQLite/R2 files
 const recovered=await get('/resume');
 assert.equal(recovered.status,'RELEASED');assert.equal(recovered.trackCount,5000);
 assert.equal(recovered.remaining,0);assert.equal(rtdbWrites,before);
 await get('/successor');
 let state;
 for(let i=0;i<100;i++){
  state=await get('/state');if(state.alarmRuns>0&&state.remaining===0)break;
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 assert(state.alarmRuns>0,'real workerd alarm must execute');
 assert.equal(state.remaining,0);assert.equal(state.alarm,null);
 assert.equal(rtdbWrites,before+6,'A and B each publish once');
 console.log('STAGE416_WORKERD_SQLITE_5000_PARTIAL_CLEAR_PROCESS_RESTART_RTDB_W0=PASS');
 console.log('STAGE416_WORKERD_REAL_ALARM_SUCCESSOR_B_NO_LOSS_NO_DUPLICATE=PASS');
}finally{if(mf)await mf.dispose();rmSync(directory,{recursive:true,force:true});}

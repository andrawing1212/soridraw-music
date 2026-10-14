import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import * as window416 from '../cloudflare/explore-worker/runtime/public-like-window-416.mjs';
import {releaseDuePublicLikeWindow416} from '../cloudflare/explore-worker/runtime/public-like-release-416.mjs';
const base=1_700_200_000_000, due=base+300_000;
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const secret='stage416-crash-test-secret-longer-than-32';
const require=createRequire(import.meta.url),mod={exports:{}};
vm.runInNewContext(ts.transpileModule(readFileSync('functions/src/exploreLikePublicRelease416.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText,{module:mod,exports:mod.exports,require,Buffer,JSON,Object,Array,Number,Set,Map,Error,Date,Math});

// Transactional storage survives a recreated caller. Inject termination AFTER a
// committed delete page; do not restore the pre-crash fixture before retry.
function durableStorage(){
 let data=new Map(),alarm={value:null},tail=Promise.resolve();
 const counters={deletePages:0,crashPage:0,failNextTransition:false};
 const make=(state,alarmState)=>({
  async get(k){return structuredClone(state.get(k));},
  async put(k,v){assert(typeof k==='string'||Object.keys(k).length<=128,'DO put batch limit');
   for(const [key,value] of typeof k==='string'?[[k,v]]:Object.entries(k)){
   assert(Buffer.byteLength(JSON.stringify(value))<=128*1024,'DO value size limit');
   state.set(key,structuredClone(value));
  }},
  async list({prefix='',startAfter,limit=1000}={}){
   return new Map([...state].filter(([k])=>k.startsWith(prefix)&&(!startAfter||k>startAfter))
    .sort(([a],[b])=>a<b?-1:a>b?1:0).slice(0,limit).map(([k,v])=>[k,structuredClone(v)]));
  },
  async delete(keys){assert(!Array.isArray(keys)||keys.length<=128,'DO delete batch limit');
   for(const k of Array.isArray(keys)?keys:[keys])state.delete(k);},
  async getAlarm(){return alarmState.value;},
  async setAlarm(at){assert(Number.isFinite(Number(at))&&Number(at)>0);alarmState.value=Number(at);},
  async deleteAlarm(){alarmState.value=null;},
 });
 const storage={
  get:k=>make(data,alarm).get(k),put:(k,v)=>make(data,alarm).put(k,v),list:o=>make(data,alarm).list(o),
  async delete(keys){await make(data,alarm).delete(keys);crash(keys);},
  getAlarm:()=>make(data,alarm).getAlarm(),setAlarm:at=>make(data,alarm).setAlarm(at),
  deleteAlarm:()=>make(data,alarm).deleteAlarm(),
  transaction(fn){const result=tail.then(async()=>{
   const copy=structuredClone(data),alarmCopy={...alarm},tx=make(copy,alarmCopy),deleted=[];
   const del=tx.delete;tx.delete=async keys=>{deleted.push(...(Array.isArray(keys)?keys:[keys]));await del(keys);};
   const result=await fn(tx);
   if(counters.failNextTransition&&deleted.includes('stage416/public/next')){
    counters.failNextTransition=false;throw Error('injected transition rollback');
   }
   data=copy;alarm=alarmCopy;crash(deleted);return result;
  });tail=result.catch(()=>{});return result;},
 };
 function crash(keys){if(keys.some(k=>k.includes('/window/'))){
  counters.deletePages++;if(counters.crashPage===counters.deletePages)throw Error('injected termination');
 }}
 return {storage,counters,keys:()=>[...data.keys()]};
}
function harness(){
 const durable=durableStorage(),rtdb=new Map(),objects=new Map();
 let writes=0,projectionCalls=0,terminatePublished=false;
 const counts=new Map(),publishedCounts=new Map(),claims=[];
 const db={ref:path=>({transaction:async fn=>{
  const current=structuredClone(rtdb.get(path)||null),next=fn(current);
  if(next===undefined)return {committed:false,snapshot:{val:()=>current}};
  rtdb.set(path,structuredClone(next));writes++;
  return {committed:true,snapshot:{val:()=>next}};
 }})};
 const r2={get:async k=>objects.has(k)?{etag:k,text:async()=>objects.get(k)}:null,
  put:async(k,v)=>{objects.set(k,v);return {etag:k};}};
 const materialize=async({trackIds})=>{
  projectionCalls++;
  for(const trackId of trackIds)publishedCounts.set(trackId,counts.get(trackId)||0);
  return {releaseRows:trackIds.map(trackId=>({trackId,ownerUid:'owner'})),d1Writes:0};
 };
 const http=async(_url,init)=>{
  claims.push(JSON.parse(init.body));
  const result=await mod.exports.publishPublicLikeRelease416(db,init.body,
   init.headers['X-Soridraw-416-Public-Release-Signature'],secret,JSON.parse(init.body).signedAtMs);
  if(terminatePublished){terminatePublished=false;throw Error('terminated immediately after PUBLISHED');}
  return {ok:true,json:async()=>({ok:true,data:result})};
 };
 const release=(nowMs=due,extra={})=>releaseDuePublicLikeWindow416({db:{},r2,
  storage:durable.storage,releaseEndpoint:'https://test.cloudfunctions.net/release',secret,
  nowMs,http,materialize,...extra});
 const open=async(ids=['A'])=>{
  await window416.registerPublicLikeEventStorage416(durable.storage,{
   eventId:id(1),windowCandidateId:id(2),eventAtMs:base,publicMinutes:5,trackIds:ids.slice(0,256),
  },base);
  for(let i=256;i<ids.length;i+=5000)await window416.joinPublicLikeChangedTracks416(durable.storage,ids.slice(i,i+5000),base+1);
  await window416.ackPublicLikeEventStorage416(durable.storage,id(1),base+2);
 };
 return {...durable,open,release,claims,counts,publishedCounts,rtdb,
  writes:()=>writes,projectionCalls:()=>projectionCalls,
  terminatePublished:()=>{terminatePublished=true;}};
}
const mode=process.argv[2]||'all';
if(mode==='all'||mode==='crash'){
 const ids=Array.from({length:5000},(_,i)=>'song-'+String(i).padStart(5,'0'));
 for(let page=1;page<=6;page++){
  const h=harness();await h.open(ids);h.counters.crashPage=page;
  await assert.rejects(h.release(),/injected termination/);
  const before=h.writes(),projections=h.projectionCalls();
  h.counters.crashPage=0;
  const retried=await h.release(due+1);
  assert.equal(retried.status,'RELEASED');assert.equal(retried.trackCount,5000);
  assert.equal(h.writes(),before,'partial cleanup retry must be RTDB W0');
  assert.equal(h.projectionCalls(),projections,'cleanup retry must be D1/R2 projection R0/W0');
  assert.equal(h.keys().length,0,'bounded release state and aliases are fully collected');
 }
 const h=harness();await h.open(ids);h.terminatePublished();
 await assert.rejects(h.release(),/immediately after PUBLISHED/);
 const before=h.writes(),projections=h.projectionCalls();
 await h.release(due+20*60_000); // refresh authentication time, preserve release identity
 assert.equal(h.writes(),before);assert.equal(h.projectionCalls(),projections);
 const identity=c=>({...c,signedAtMs:0});
 assert.deepEqual(identity(h.claims[0]),identity(h.claims[1]));
 assert.equal(h.keys().length,0);
 console.log('STAGE416_5000_EACH_1000_DELETE_INTERRUPT_AND_PUBLISHED_RESTART=PASS');
}
if(mode==='all'||mode==='race'){
 const h=harness();await h.open();
 const joined=await window416.joinPublicLikeChangedTracks416(h.storage,['before'],due-1);
 assert.equal(joined.joined,true);
 const late=await window416.joinPublicLikeChangedTracks416(h.storage,['B'],due);
 assert.equal(late.joined,false,'exact deadline cannot join expired window');
 assert.equal(late.staged,true,'late canonical change must be durable for next window');
 const snapshot=await window416.readPublicLikeReleaseState416(h.storage,due);
 assert.deepEqual(snapshot.trackIds,['A','before']);
 await window416.joinPublicLikeChangedTracks416(h.storage,['C'],due+1);
 assert.deepEqual((await window416.readPublicLikeReleaseState416(h.storage,due+1)).trackIds,snapshot.trackIds);
 await h.release(due+2);
 const next=await h.storage.get(window416.PUBLIC_LIKE_WINDOW_KEY_416);
 assert(next&&next.windowId!==id(2));
 assert((await h.storage.getAlarm())<=next.deadlineAtMs,'next window has a durable wakeup no later than its deadline');
 const nextState=await window416.readPublicLikeReleaseState416(h.storage,next.deadlineAtMs);
 assert.deepEqual(nextState.trackIds,['B','C']);
 await h.release(next.deadlineAtMs);
 assert.equal(h.keys().length,0);
 console.log('STAGE416_DEADLINE_MINUS1_EXACT_DEADLINE_SNAPSHOT_THEN_CHANGE_NEXT_WINDOW=PASS');

 const concurrent=harness();await concurrent.open();
 concurrent.counts.set('A',1);concurrent.counts.set('A',0); // like/unlike net-zero
 let unblock,entered;
 const atPublish=new Promise(r=>{entered=r;});const hold=new Promise(r=>{unblock=r;});
 const release=concurrent.release(due,{materialize:async({trackIds})=>{
  assert.deepEqual(trackIds,['A']);entered();await hold;
  concurrent.publishedCounts.set('A',concurrent.counts.get('A'));
  return {releaseRows:[{trackId:'A',ownerUid:'owner'}],d1Writes:0};
 }});
 await atPublish;
 concurrent.counts.set('B',1);
 await window416.joinPublicLikeChangedTracks416(concurrent.storage,['B'],due+1);
 const duplicate=concurrent.release(due+2);unblock();
 await Promise.all([release,duplicate]);
 assert.equal(concurrent.publishedCounts.get('A'),0);
 assert.equal(concurrent.writes(),3,'concurrent same release must publish only once');
 const concurrentNext=await concurrent.storage.get(window416.PUBLIC_LIKE_WINDOW_KEY_416);
 await concurrent.release(concurrentNext.deadlineAtMs);
 assert.equal(concurrent.publishedCounts.get('B'),1);
 assert.equal(concurrent.keys().length,0);
 console.log('STAGE416_CONCURRENT_RELEASE_JOIN_DUPLICATE_NET_ZERO_NO_LOSS=PASS');
}

if(mode==='all'||mode==='runtime'){
 // Execute the real DO class with its source-only gate enabled in this VM.
 // Network/DB adapters remain local. Verify the wakeup path, not just a stored timestamp.
 const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
 const classSource=entry.slice(entry.indexOf('export class ExploreLikeBatchScheduler103'),
  entry.indexOf('// SORIDRAW_BOUNDED_CANONICAL_PUBLIC_LIKE_CONVERGENCE_191_20260924'))
  .replace('export class','class');
 const h=harness();await h.open();let clock=due,aggregateCalls=0;
 class Clock extends Date {static now(){return clock;}}
 const context={...window416,STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE:true,
  DurableObject:class {constructor(ctx,env){this.ctx=ctx;this.env=env;}},Date:Clock,
  baseWorker:{scheduled:async()=>{aggregateCalls++;return {changedTrackIds416:[]};}},
  releaseDuePublicLikeWindow416:options=>h.release(options.nowMs,options),
  EXPLORE_LIKE_ACTIVE_SCHEDULE_KEY_194:'active-scheduled-at-194',
  EXPLORE_LIKE_ACTIVE_GRACE_MS_194:20000,EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105:5000,
  repairSharedPublicLikeCounts191:async()=>{throw Error('unexpected public repair');},
  console,Response,URL,Proxy,Reflect,Set,Map,Number,Math,String,Array,Error};
 vm.createContext(context);
 vm.runInContext(classSource+'\nglobalThis.Scheduler=ExploreLikeBatchScheduler103;',context);
 const scheduler=new context.Scheduler({storage:h.storage},{DB:{prepare:()=>({first:async()=>null})}});
 // Release while the canonical request is awaiting its D1 response. Its old
 // window reference must not turn B into a successful NO_WINDOW drop.
 let entered,unblock;
 const waiting=new Promise(r=>{entered=r;});const gate=new Promise(r=>{unblock=r;});
 context.baseWorker.scheduled=async()=>{aggregateCalls++;entered();await gate;
  return {changedTrackIds416:['B'],publicDeferred416:true};};
 const aggregate=scheduler.runAggregate194();await waiting;
 await h.release(due);clock=due+10;h.counts.set('B',2);unblock();await aggregate;
 let next=await h.storage.get(window416.PUBLIC_LIKE_WINDOW_KEY_416);
 assert(next&&next.windowId!==id(2));
 await scheduler.finalizeAggregate195();
 assert.equal(await h.storage.getAlarm(),next.deadlineAtMs);
 clock=next.deadlineAtMs;
 // The real alarm passes environment bindings; keep the release harness's mocked IO.
 context.releaseDuePublicLikeWindow416=options=>h.release(options.nowMs);
 await h.storage.deleteAlarm();
 await scheduler.alarm();
 assert.equal(aggregateCalls,1,'public-only alarm must not run canonical D1 drain');
 assert.equal(h.publishedCounts.get('B'),2);
 assert.equal(h.keys().length,0);
 console.log('STAGE416_REAL_DO_DRAIN_AFTER_CLEAR_AND_SUCCESSOR_ALARM_NO_LOSS=PASS');
}

if(mode==='all'||mode==='stale'){
 const h=harness();await h.open();
 const forbidden=new Proxy({}, {get(){throw Error('unexpected D1/R2 access');}});
 for(const expectation of [
  {expectedWindowId:id(999),expectedDeadlineAtMs:due},
  {expectedWindowId:id(2),expectedDeadlineAtMs:due+1},
 ]){
  const result=await h.release(due,{...expectation,db:forbidden,r2:forbidden,
   materialize:async()=>{throw Error('unexpected projection');},
   http:async()=>{throw Error('unexpected RTDB callback');}});
  assert.equal(result.status,'STALE_TASK');assert.equal(result.cleared,false);
  assert.equal(h.writes(),0);assert.equal(h.projectionCalls(),0);
  assert.deepEqual((await window416.readPublicLikeReleaseState416(h.storage,due)).trackIds,['A']);
 }
 await h.release(due,{expectedWindowId:id(2),expectedDeadlineAtMs:due});
 assert.equal(h.writes(),3,'matching task still executes the real publisher');
 console.log('STAGE416_STALE_WINDOW_OR_DEADLINE_D1_R2_RTDB_IO_ZERO=PASS');
}

if(mode==='all'||mode==='successor'){
 const h=harness();await h.open();
 // Recheck an arrival whose canonical drain began before registration.
 await window416.stagePublicLikeOpenPayload416(h.storage,['before-registration-race'],base+1);
 assert.deepEqual((await window416.readPublicLikeReleaseState416(h.storage,due)).trackIds,
  ['A','before-registration-race']);
 const ids=Array.from({length:5500},(_,i)=>'next-'+String(i).padStart(5,'0'));
 await window416.joinPublicLikeChangedTracks416(h.storage,ids,due);
 for(let i=0;i<10;i++)await window416.joinPublicLikeChangedTracks416(h.storage,ids.slice(i,i+100),due+1+i);
 assert.equal(h.keys().filter(k=>k.startsWith('stage416/public/next/track/')).length,5500,
  'pending successor storage is deduplicated by track, not an event history');
 const alarmBefore=await h.storage.getAlarm();
 h.counters.failNextTransition=true;
 await assert.rejects(h.release(due+20),/transition rollback/);
 assert.equal(await h.storage.getAlarm(),alarmBefore,'transaction rollback also restores alarm');
 const before=h.writes();await h.release(due+21);assert.equal(h.writes(),before);
 const next=await h.storage.get(window416.PUBLIC_LIKE_WINDOW_KEY_416);
 const state=await window416.readPublicLikeReleaseState416(h.storage,next.deadlineAtMs);
 assert.deepEqual(state.trackIds,ids);
 await h.release(next.deadlineAtMs);
 assert.equal(h.keys().length,0);
 console.log('STAGE416_5500_SUCCESSOR_ATOMIC_PROMOTION_ROLLBACK_DEDUP_AND_COLLECTION=PASS');
}

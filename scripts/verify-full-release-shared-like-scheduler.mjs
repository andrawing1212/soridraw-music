import assert from 'node:assert/strict';
import {legacySchedulerClass,composeSharedScheduler,wakeAcceptedQueue} from './full-release-shared-like-scheduler.mjs';
const calls=[];
let response=()=>Response.json({ok:true,scheduledAt:123,newlyScheduled:true,activeRecovery194:true,settled:true});
const shared={idFromName(name){assert.equal(name,'shared-like-batch');return name},get(id){assert.equal(id,'shared-like-batch');return {async fetch(req){calls.push({route:new URL(req.url).pathname,body:await req.json()});return response()}}}};
const legacy={idFromName(){throw Error('old namespace used as active writer')}};
const env={SORIDRAW_ENVIRONMENT:'production',EXPLORE_LIKE_BATCH_SCHEDULER:legacy,RELEASE_SHARED_LIKE_SCHEDULER:shared};
let originalCalls=0;
class Original{constructor(ctx,env){this.ctx=ctx;this.env=env}async fetch(){originalCalls++;throw Error('old writer')}async alarm(){originalCalls++;throw Error('old writer')}}
const Old=legacySchedulerClass(Original);
const key='active-scheduled-at-194';
let marker=100,deletes=0;
const storage={async get(k){assert.equal(k,key);return marker},async transaction(fn){return fn({
 get:async k=>storage.get(k),delete:async k=>{assert.equal(k,key);marker=undefined;deletes++;}
})}};
const o=new Old({storage},env);
await o.alarm();
assert.deepEqual(calls,[{route:'/schedule',body:{}}]);
assert.equal(marker,undefined);assert.equal(deletes,1);
await o.fetch(new Request('https://soridraw.internal/schedule',{method:'POST',body:JSON.stringify({expectedBatchId418:'legacy-accepted',expectedTrackIds448:['song']})}));
assert.deepEqual(calls[1],{route:'/schedule',body:{expectedBatchId418:'legacy-accepted',expectedTrackIds448:['song']}});
assert.equal((await o.fetch(new Request('https://soridraw.internal/schedule'))).status,404);
marker=200;response=()=>Response.json({ok:false},{status:503});
await assert.rejects(()=>o.alarm(),/HANDOFF_UNCONFIRMED/);
assert.equal(marker,200);assert.equal(deletes,1);
response=()=>Response.json({ok:true,scheduledAt:321,newlyScheduled:false,activeRecovery194:true});
await o.alarm();assert.equal(marker,200);assert.equal(deletes,1);
response=()=>{marker=201;return Response.json({ok:true,scheduledAt:321,newlyScheduled:true,activeRecovery194:true,settled:true})};
await o.alarm();assert.equal(marker,201);assert.equal(deletes,1);
response=()=>Response.json({ok:true,scheduledAt:321,newlyScheduled:true,activeRecovery194:true,settled:true});
await o.alarm();assert.equal(marker,undefined);assert.equal(deletes,2);assert.equal(originalCalls,0);
const core={async fetch(req,e){assert.equal(e.SORIDRAW_ENVIRONMENT,'production');assert.equal(e.EXPLORE_LIKE_BATCH_SCHEDULER,shared);return Response.json({ok:true})}};
const wrapped=composeSharedScheduler(core);
await wrapped.fetch(new Request('https://example.com/v1/me/likes/batch'),env,{});
await wrapped.scheduled({cron:'37 * * * *'},env,{});
await assert.rejects(()=>wakeAcceptedQueue({...env,RELEASE_SHARED_LIKE_SCHEDULER:undefined}),/NOT_READY/);
assert.equal(env.EXPLORE_LIKE_BATCH_SCHEDULER,legacy);
console.log('FULL_RELEASE_SHARED_EXISTING_QUEUE_HANDOFF_FIXTURE=PASS; LEGACY_AGGREGATE_CALLS=0; USER_WRITES=0');

// Stage421 executes the actual source-only R2 publication implementation.
// No external R2/RTDB binding, deploy, or shared user data.
import assert from 'node:assert/strict';
import {createLikeProjectionPublisher421} from '../cloudflare/explore-worker/runtime/like-public-r2-publisher-421.mjs';

const track='song-421', owner='owner-421';
const latest='internal/explore/shared-feed-v112/latest-40.json';
const popular='internal/explore/shared-feed-v112/popular-40.json';
const card='internal/explore/shared-track-card-v115/song-421.json';
const profile='internal/explore/shared-profile-v113/owner-421.json';
const row=(id='song-421')=>({id,likeCount:0,stats:{likeCount:0},title:id});
const store=new Map([
  [latest,{payload:{data:{items:[row(),row('other-song')]}}}],
  [popular,{payload:{data:{items:[row('other-song')]}}}],
  [card,{card:row()}],
  [profile,{revision:1,body:{data:{revision:1,items:[row(),row('other-song')]}}}],
]);
let version=0;
for(const [key,obj] of store)store.set(key,{payload:obj,etag:'etag'+(++version)});
const copied=v=>JSON.parse(JSON.stringify(v));
let puts=0,casConflictOnce=false,failProfileOnce=false;
const R2={
  async get(key){
    const v=store.get(key);
    if(!v)return null;
    return {etag:v.etag, customMetadata:{},text:async()=>JSON.stringify(copied(v.payload))};
  },
  async put(key,body,{onlyIf}){
    if(failProfileOnce&&key===profile){failProfileOnce=false;throw Error('R2 profile PUT unavailable');}
    if(casConflictOnce&&key===card){casConflictOnce=false;return null;}
    const cur=store.get(key);
    if(!cur||cur.etag!==onlyIf?.etagMatches)return null;
    store.set(key,{payload:JSON.parse(body),etag:'etag'+(++version)});
    puts++;
    return {etag:store.get(key).etag};
  },
};
let personal=new Map(),signals=[],personalFails=false,signalFails=false;
const publisher=createLikeProjectionPublisher421({
  sharedR2:R2,resolveOwnerUid:async id=>{assert.equal(id,track);return owner;},
  async persistPersonalSnapshot(x){
    if(personalFails){personalFails=false;return {persisted:false};}
    const prev=personal.get(x.uid+':'+x.trackId);
    if(prev && prev.revision>x.revision)throw Error('personal revision stale');
    personal.set(x.uid+':'+x.trackId,copied(x));
    return {persisted:true,trackId:x.trackId,revision:x.revision};
  },
  async queueSameAccountSignal(x){
    if(signalFails){signalFails=false;return {queued:false};}
    signals.push(copied(x));
    return {queued:true,trackId:x.trackId,revision:x.revision};
  },
  now:()=>421000,
});
const change=(count,generation,revision,liked)=>({
  uid:'actor-421',trackId:track,liked,likeCount:count,generation,
  revision,operationId:'op-'+revision,
});
let result=await publisher(change(1,1,1,true));
assert.equal(result.settled,true);
for(const key of [latest,card,profile]){
 const o=store.get(key).payload;
 const item=(key===card?o.card:key===profile?o.body.data.items[0]:o.payload.data.items[0]);
 assert.equal(item.likeCount,1); assert.equal(item.stats.likeCount,1);
 assert.equal(item.likeGeneration421,1);
}
assert.equal(store.get(popular).payload.payload.data.items[0].likeCount,0);
assert.equal(personal.get('actor-421:'+track).liked,true);
assert.equal(signals.length,1);
const before=puts;
result=await publisher(change(1,1,1,true));
assert.equal(result.settled,true);
assert.equal(puts,before,'idempotent R2 retry should produce no new R2 writes');

await assert.rejects(publisher(change(0,0,0,false)),/421_STALE_GENERATION_REJECTED/);
assert.equal(signals.length,2,'stale request must not emit RTDB signal');
assert.equal(personal.get('actor-421:'+track).liked,true);

casConflictOnce=true;
result=await publisher(change(2,2,2,true));
assert.equal(result.settled,true);
assert.equal(store.get(card).payload.card.likeCount,2);
assert.equal(store.get(profile).payload.body.data.items[0].likeGeneration421,2);

failProfileOnce=true;
await assert.rejects(publisher(change(3,3,3,true)),/R2 profile PUT unavailable/);
assert.equal(store.get(card).payload.card.likeCount,3);
assert.equal(store.get(profile).payload.body.data.items[0].likeCount,2);
assert.equal(personal.get('actor-421:'+track).revision,2);
result=await publisher(change(3,3,3,true));
assert.equal(result.settled,true);
assert.equal(store.get(profile).payload.body.data.items[0].likeCount,3);

personalFails=true;
await assert.rejects(publisher(change(4,4,4,false)),/421_PERSONAL_R2_NOT_DURABLE/);
assert.equal(signals.at(-1).revision,3);
result=await publisher(change(4,4,4,false));
assert.equal(result.settled,true);
assert.equal(personal.get('actor-421:'+track).revision,4);

signalFails=true;
await assert.rejects(publisher(change(5,5,5,true)),/421_CROSS_DEVICE_SIGNAL_NOT_DURABLE/);
assert.equal(signals.at(-1).revision,4);
result=await publisher(change(5,5,5,true));
assert.equal(result.settled,true);
assert.equal(signals.at(-1).revision,5);

const baseline=JSON.stringify([...store.keys()]);
assert.equal(store.size,4,'no extra R2 keys or whole-feed rebuild');
assert.equal(typeof baseline,'string');
console.log('421_REAL_SOURCE_R2_CARD_PROFILE_FEED_BOUNDED=PASS');
console.log('421_GENERATION_STALE_CANNOT_REPAINT_PERSONAL_STATE=PASS');
console.log('421_R2_CAS_CONFLICT_AND_FAILURE_RECOVERY=PASS');
console.log('421_PERSONAL_AND_SIGNAL_FAILURE_NO_FALSE_ACK=PASS');
console.log('421_DEPLOYMENT=NONE;D1_WRITES=0;REAL_FIREBASE_R2=NOT_USED');

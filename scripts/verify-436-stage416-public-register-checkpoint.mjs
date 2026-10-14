import assert from 'node:assert/strict';
import {
 ackPublicLikeEventStorage416,clearPublicLikeReleaseStorage416,
 readPublicLikeReleaseState416,registerPublicLikeEventStorage416,
 PUBLIC_LIKE_WINDOW_KEY_416,
} from '../cloudflare/explore-worker/runtime/public-like-window-416.mjs';

const base=1_700_070_000_000;
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const map=new Map(),writes=[],deletes=[];
const storage={
 async transaction(fn){return fn(this);},
 async getAlarm(){return null;},async setAlarm() {},
 async get(key){return map.get(key);},
 async put(entries,value){
   if(typeof entries==='string'){
     map.set(entries,structuredClone(value));writes.push([entries]);return;
   }
   for(const [k,v] of Object.entries(entries))map.set(k,structuredClone(v));
   writes.push(Object.keys(entries).sort());
 },
 async list({prefix}={}){return new Map([...map].filter(([k])=>!prefix||k.startsWith(prefix)));},
 async delete(keys){
   const list=Array.isArray(keys)?keys:[keys];for(const k of list)map.delete(k);
   deletes.push([...list]);return list.length;
 },
};
const e1={eventId:id(1),windowCandidateId:id(101),eventAtMs:base,
 publicMinutes:5,trackIds:['song-a','song-b']};
const a=await registerPublicLikeEventStorage416(storage,e1,base);
assert.equal(a.registered,true);assert.equal(a.opened,true);
const ack1=await ackPublicLikeEventStorage416(storage,e1.eventId,base+1);
assert.equal(ack1.acked,true);assert.equal(ack1.duplicate,false);
const ackRetry=await ackPublicLikeEventStorage416(storage,e1.eventId,base+2);
assert.equal(ackRetry.duplicate,true,'ack retry W0');

const e2={eventId:id(2),windowCandidateId:id(102),eventAtMs:base+120_000,
 publicMinutes:1,trackIds:['song-b','song-c']};
await registerPublicLikeEventStorage416(storage,e2,base+120_000);
let state=await readPublicLikeReleaseState416(storage,base+300_000);
assert.equal(state.due,true);assert.equal(state.blockedUnacked,true,
 'release must not outrun Firebase registration checkpoint');
assert.deepEqual(state.trackIds,['song-a','song-b','song-c']);
await assert.rejects(clearPublicLikeReleaseStorage416(storage,state),/416_PUBLIC_CLEAR_REFUSED/);

state=await readPublicLikeReleaseState416(storage,base+300_000);
assert.equal(state.blockedUnacked,true);
await ackPublicLikeEventStorage416(storage,e2.eventId,base+120_001);
state=await readPublicLikeReleaseState416(storage,base+300_000);
assert.equal(state.blockedUnacked,false);
assert.deepEqual(state.trackIds,['song-a','song-b','song-c']);
assert.deepEqual(state.eventIds,[id(1),id(2)]);

const cleared=await clearPublicLikeReleaseStorage416(storage,state);
assert.equal(cleared.cleared,true);
assert.equal(map.has(PUBLIC_LIKE_WINDOW_KEY_416),false);
assert.equal(map.has('stage416/public/event/'+id(1)),false);
assert.equal(map.has('stage416/public/event/'+id(2)),false);
assert.equal([...map.keys()].some(k=>k.startsWith('stage416/public/window/'+id(101)+'/')),false);

const e3={eventId:id(3),windowCandidateId:id(103),eventAtMs:base+300_001,
 publicMinutes:1,trackIds:['song-d']};
const next=await registerPublicLikeEventStorage416(storage,e3,base+300_001);
assert.equal(next.opened,true);assert.equal(next.publicMinutes,1);

console.log('STAGE416_PUBLIC_RELEASE_BLOCKS_UNACKED_REGISTRATION=PASS');
console.log('STAGE416_PUBLIC_REGISTRATION_ACK_RETRY_W0=PASS');
console.log('STAGE416_PUBLIC_RELEASE_EXACT_CHANGED_IDS_DEDUP=PASS');
console.log('STAGE416_PUBLIC_RELEASE_CLEARS_WINDOW_AND_EVENT_ALIASES=PASS');
console.log('STAGE416_PUBLIC_EVENT_MARKERS_BOUNDED_TO_ACTIVE_WINDOW=PASS');
console.log('DEPLOYMENT=0');
console.log('SHARED_DATA_CHANGE=0');

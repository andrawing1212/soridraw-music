// Virtual clock, isolated Map storage, no production requests or configuration writes.
import assert from 'node:assert/strict';
import {PUBLIC_LIKE_WINDOW_KEY_416,joinPublicLikeChangedTracks416,readPublicLikeReleaseState416,clearPublicLikeReleaseStorage416} from '../cloudflare/explore-worker/runtime/public-like-window-416.mjs';
const intervals=[1,3,5,10,20],start=1700200000000,minute=60000;
function storage(){
 const map=new Map();let alarm=null;
 return {async transaction(fn){return fn(this)},async get(k){return structuredClone(map.get(k))},async put(k,v){if(typeof k==='string')map.set(k,structuredClone(v));else for(const [key,val] of Object.entries(k))map.set(key,structuredClone(val))},async list({prefix,startAfter,limit}={}){let rows=[...map].filter(([k])=>(!prefix||k.startsWith(prefix))&&(!startAfter||k>startAfter)).sort(([a],[b])=>a.localeCompare(b));return new Map(structuredClone(limit?rows.slice(0,limit):rows))},async delete(keys){for(const k of Array.isArray(keys)?keys:[keys])map.delete(k)},async getAlarm(){return alarm},async setAlarm(v){alarm=v}};
}
for(const before of intervals)for(const after of intervals){
 const s=storage(),deadline=start+before*minute;
 assert.equal((await joinPublicLikeChangedTracks416(s,['a'],start,before)).joined,true);
 const first=await s.get(PUBLIC_LIKE_WINDOW_KEY_416);
 assert.equal(first.publicMinutes,before);assert.equal(first.deadlineAtMs,deadline);
 assert.equal(await s.getAlarm(),deadline);
 // Settings changed while an existing window is open: never move its deadline.
 await joinPublicLikeChangedTracks416(s,['a','b'],start+1,after);
 await joinPublicLikeChangedTracks416(s,['b'],deadline-1,after);
 assert.deepEqual(await s.get(PUBLIC_LIKE_WINDOW_KEY_416),first);
 assert.equal((await readPublicLikeReleaseState416(s,deadline-1)).due,false);
 const due=await readPublicLikeReleaseState416(s,deadline);
 assert.equal(due.due,true);assert.equal(due.blockedUnacked,false);assert.deepEqual(due.trackIds,['a','b']);
 // At boundary, use new configured interval for the staged successor.
 assert.equal((await joinPublicLikeChangedTracks416(s,['c'],deadline,after)).staged,true);
 await clearPublicLikeReleaseStorage416(s,due,deadline,{alignSuccessorToPriorDeadline:true});
 const successor=await s.get(PUBLIC_LIKE_WINDOW_KEY_416);
 assert.notEqual(successor.windowId,first.windowId);
 assert.equal(successor.openedAtMs,deadline);
 assert.equal(successor.publicMinutes,after);
 assert.equal(successor.deadlineAtMs,deadline+after*minute);
 assert.equal((await readPublicLikeReleaseState416(s,successor.deadlineAtMs-1)).due,false);
 const due2=await readPublicLikeReleaseState416(s,successor.deadlineAtMs);
 assert.equal(due2.due,true);assert.deepEqual(due2.trackIds,['c']);
 await clearPublicLikeReleaseStorage416(s,due2,successor.deadlineAtMs,{alignSuccessorToPriorDeadline:true});
 assert.equal(await s.get(PUBLIC_LIKE_WINDOW_KEY_416),undefined);
 console.log('PUBLIC_INTERVAL_'+before+'_TO_'+after+'=PASS');
}
for(const invalid of [0,2,4,30,NaN]){
 const s=storage();assert.equal((await joinPublicLikeChangedTracks416(s,['a'],start,invalid)).joined,false);
 assert.equal(await s.get(PUBLIC_LIKE_WINDOW_KEY_416),undefined);
}
console.log('ALL_25_VIRTUAL_INTERVAL_TRANSITIONS=PASS; LIVE_SETTINGS_CHANGE=0; LIVE_DEPLOY=0; SHARED_DATA_CHANGE=0');

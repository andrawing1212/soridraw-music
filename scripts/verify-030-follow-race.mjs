// Stage030 regression: a pending FOLLOW result must not overwrite a later
// UNFOLLOW or publish the stale intermediate state while the later write waits.
// Uses real FollowBatch380 TS module, virtual localStorage/clock, zero server IO.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

const source=readFileSync('src/services/exploreFollowBatchService380.ts','utf8');
const js=stripTypeScriptTypes(source,{mode:'strip'});
const originalNow=Date.now;
const origSetTimeout=globalThis.setTimeout;
const origClearTimeout=globalThis.clearTimeout;
const origStorage=globalThis.localStorage;
let clock=originalNow();
const stored=new Map();
let timerCounter=0;
Date.now=()=>clock;
globalThis.setTimeout=()=>++timerCounter;
globalThis.clearTimeout=()=>{};
globalThis.localStorage={
 getItem:k=>stored.has(k)?stored.get(k):null,
 setItem:(k,v)=>stored.set(k,String(v)),
 removeItem:k=>stored.delete(k)
};
try{
 const mod=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(js));
 const key=(a,b)=>JSON.stringify([a,b]);
 const targetProfile=(uid)=>({uid,nickname:'target',avatarUrl:'',handle:'target'});
 const result=(following)=>({isFollowing:following,followerCount:following?1:0,followingCount:0,actorFollowingCount:following?1:0});

 // Test 1: first FOLLOW is in flight; newer UNFOLLOW is the final intention.
 let releaseFirst;
 let requests=[],settlements=[],paint=false;
 const commit=async following=>{
  requests.push(following);
  if(requests.length===1)return new Promise(resolve=>{releaseFirst=resolve});
  return result(following);
 };
 const entry=following=>({
  viewerUid:'actor-1',targetUid:'owner-1',
  baseFollowing:false,baseTargetFollowerCount:0,
  baseTargetFollowingCount:0,baseActorFollowingCount:0,
  desiredFollowing:following,targetProfile:targetProfile('owner-1'),
  commit,onBusy:()=>{},onSettled:x=>{paint=x.result.isFollowing;settlements.push(x.result.isFollowing)},
  onError:e=>{throw Error('unexpected follow error '+e.error)},
  initialDelayMs:0
 });
 mod.queueExploreFollowFinalState380({...entry(true),restoredUpdatedAt:clock-31_000});
 const first=mod.flushExploreFollowPair380(key('actor-1','owner-1'));
 assert.deepEqual(requests,[true]);
 mod.queueExploreFollowFinalState380(entry(false));
 paint=false; // latest optimistic click
 releaseFirst(result(true));
 await first;
 assert.equal(paint,false,'STALE_FOLLOW_REPAINTED_LATEST_UNFOLLOW');
 assert.deepEqual(settlements,[],'STALE_FOLLOW_PUBLISHED_ON_SETTLED');
 clock+=31_000;
 await mod.flushExploreFollowPair380(key('actor-1','owner-1'));
 assert.deepEqual(requests,[true,false]);
 assert.deepEqual(settlements,[false],'FINAL_UNFOLLOW_MUST_SETTLE_ONLY_ONCE');
 assert.equal(paint,false);
 assert.equal(mod.readPendingExploreFollowIntents380('actor-1').length,0);

 // Test 2: a newer sequence returns to the same true final desired value.
 // The accepted first FOLLOW is the final fact and must still publish once.
 let releaseSecond;let requests2=[],settlements2=[];
 const commit2=async following=>{
  requests2.push(following);
  return new Promise(resolve=>{releaseSecond=resolve});
 };
 const next=following=>({
  viewerUid:'actor-2',targetUid:'owner-2',
  baseFollowing:false,baseTargetFollowerCount:0,
  baseTargetFollowingCount:0,baseActorFollowingCount:0,
  desiredFollowing:following,targetProfile:targetProfile('owner-2'),
  commit:commit2,onBusy:()=>{},onSettled:x=>settlements2.push(x.result.isFollowing),
  onError:e=>{throw Error('unexpected follow error '+e.error)},
  initialDelayMs:0
 });
 mod.queueExploreFollowFinalState380({...next(true),restoredUpdatedAt:clock-31_000});
 const p=mod.flushExploreFollowPair380(key('actor-2','owner-2'));
 mod.queueExploreFollowFinalState380(next(false));
 mod.queueExploreFollowFinalState380(next(true));
 releaseSecond(result(true));
 await p;
 assert.deepEqual(settlements2,[true],'RETURN_TO_SAME_FINAL_STATE_MUST_PUBLISH');
 clock+=31_000;
 await mod.flushExploreFollowPair380(key('actor-2','owner-2'));
 assert.deepEqual(requests2,[true],'NO_DUPLICATE_FOLLOW_MUTATION');
 assert.equal(mod.readPendingExploreFollowIntents380('actor-2').length,0);
 console.log('FOLLOW_030_SUPERSEDED_INFLIGHT_STATE_NO_STALE_UI_OR_RTD B=PASS'.replace('RTD B','RTDB'));
 console.log('FOLLOW_030_RETURN_TO_SAME_FINAL_STATE_SETTLES_ONCE=PASS');
 console.log('FOLLOW_030_NO_CANONICAL_OR_NETWORK_IO=PASS');
}finally{
 Date.now=originalNow;
 globalThis.setTimeout=origSetTimeout;
 globalThis.clearTimeout=origClearTimeout;
 if(origStorage===undefined)delete globalThis.localStorage;
 else globalThis.localStorage=origStorage;
}

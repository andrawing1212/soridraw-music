// Regression for real PREVIEW discrepancy: actor shows unfollowed while
// canonical overlay is still following after server cooldown/rate rejection.
// Offline only; no Firebase/Cloudflare requests or canonical writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';

const source=readFileSync('src/services/exploreFollowBatchService380.ts','utf8');
const js=stripTypeScriptTypes(source,{mode:'strip'});
const originalNow=Date.now;
const origTimeout=globalThis.setTimeout,origClear=globalThis.clearTimeout;
const origStorage=globalThis.localStorage;
let clock=Date.now(), timer=0;
const store=new Map();
Date.now=()=>clock;
globalThis.setTimeout=()=>++timer;
globalThis.clearTimeout=()=>{};
globalThis.localStorage={
 getItem:k=>store.has(k)?store.get(k):null,
 setItem:(k,v)=>store.set(k,String(v)),
 removeItem:k=>store.delete(k)
};
try{
 const m=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(js));
 const key=(a,b)=>JSON.stringify([a,b]);
 const seed=(viewerUid,targetUid,base,desired)=>({
  viewerUid,targetUid,
  baseFollowing:base,desiredFollowing:desired,
  baseTargetFollowerCount:2,baseTargetFollowingCount:2,baseActorFollowingCount:2,
  targetProfile:{uid:targetUid,handle:'owner',nickname:'owner',avatarUrl:''},
  initialDelayMs:0,restoredUpdatedAt:clock-31_000
 });
 let calls=0,delayNotices=[],errors=[],settlements=[];
 const rateError=()=>Object.assign(Error('Server cooldown'),{code:'RATE_LIMITED',retryAfterMs:60_000});
 const q=seed('actor','owner',true,false);
 m.queueExploreFollowFinalState380({...q,
  commit:async()=>{calls++;throw rateError()},
  onBusy:()=>{},onDeferred:delay=>delayNotices.push(delay),
  onSettled:x=>settlements.push(x),
  onError:e=>errors.push(e)
 });
 await m.flushExploreFollowPair380(key('actor','owner'));
 assert.equal(calls,1);
 assert.deepEqual(delayNotices,[60_000],'FIRST_COOLDOWN_MUST_BE_VISIBLE');
 assert.deepEqual(errors,[]);
 let pending=m.readPendingExploreFollowIntents380('actor');
 assert.equal(pending.length,1);
 assert.equal(pending[0].suspended,false,'FIRST_COOLDOWN_MUST_NOT_PERMANENTLY_SUSPEND');
 assert.equal(pending[0].retryUsed,true);
 assert.equal(pending[0].desiredFollowing,false);
 clock+=60_001;
 await m.flushExploreFollowPair380(key('actor','owner'));
 assert.equal(calls,2,'AT_MOST_ONE_RETRY');
 assert.equal(errors.length,1,'EXHAUSTED_COOLDOWN_MUST_NOTIFY');
 assert.equal(errors[0].baseFollowing,true,'REVERT_TO_LAST_KNOWN_BASE');
 assert.equal(errors[0].desiredFollowing,false);
 assert.match(errors[0].error.message,/저장하지 못했습니다/);
 assert.equal(m.readPendingExploreFollowIntents380('actor').length,0,
  'MUST_NOT_PERSIST_FALSE_UNFOLLOW_INDEFINITELY');
 assert.deepEqual(settlements,[]);
 clock+=3600_000;
 await m.flushExploreFollowPair380(key('actor','owner'));
 assert.equal(calls,2,'NO_BACKGROUND_RETRY_STORM');

 // Old releases could persist suspended=true indefinitely. On next app
 // resume they must deliver the visible failure/rollback without server I/O.
 let oldCommit=0,oldErrors=[];
 const stale=seed('legacy-actor','legacy-owner',true,false);
 m.queueExploreFollowFinalState380({...stale,
  restoredSuspended:true,restoredRetryUsed:true,
  commit:async()=>{oldCommit++;return {isFollowing:false,followerCount:1,followingCount:2}},
  onError:e=>oldErrors.push(e),onSettled:()=>{},onBusy:()=>{}
 });
 assert.equal(oldCommit,0,'LEGACY_STALLED_RECORD_MUST_NOT_AUTO_WRITE');
 assert.equal(oldErrors.length,1,'LEGACY_STALLED_RECORD_MUST_ROLLBACK');
 assert.equal(oldErrors[0].baseFollowing,true);
 assert.equal(m.readPendingExploreFollowIntents380('legacy-actor').length,0);

 // Final state returns to original before the trailing 30s timer: W0.
 let noOpCalls=0;
 m.queueExploreFollowFinalState380({...seed('noop','owner',true,false),
  commit:async()=>{noOpCalls++;throw Error('must not write')},
  onError:e=>{throw Error('unexpected '+e.error)},onSettled:()=>{},onBusy:()=>{}
 });
 m.queueExploreFollowFinalState380({...seed('noop','owner',true,true),
  restoredUpdatedAt:undefined,
  commit:async()=>{noOpCalls++;throw Error('must not write')},
  onError:e=>{throw Error('unexpected '+e.error)},onSettled:()=>{},onBusy:()=>{}
 });
 clock+=30_001;
 await m.flushExploreFollowPair380(key('noop','owner'));
 assert.equal(noOpCalls,0);
 assert.equal(m.readPendingExploreFollowIntents380('noop').length,0);
 console.log('FOLLOW_031_FIRST_RATE_LIMIT_SHOWS_PENDING_AND_SINGLE_RETRY=PASS');
 console.log('FOLLOW_031_EXHAUSTED_RATE_LIMIT_RESTORES_BASE_AND_ALERTS=PASS');
 console.log('FOLLOW_031_LEGACY_SUSPENDED_UNFOLLOW_REPAIRED_W0=PASS');
 console.log('FOLLOW_031_RETURN_TO_BASE_W0=PASS');
}finally{
 Date.now=originalNow;
 globalThis.setTimeout=origTimeout;globalThis.clearTimeout=origClear;
 if(origStorage===undefined)delete globalThis.localStorage;
 else globalThis.localStorage=origStorage;
}

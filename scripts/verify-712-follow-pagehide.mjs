// APP712: real document exit uses one best-effort, authenticated keepalive
// while preserving the local pending intent until the canonical server ACK.
// Isolated fake browser: no network, real accounts or shared user data.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

let now=1_800_000_000_000, nextTimer=0;
const timers=new Map(), stored=new Map(), normal=[], exits=[], settled=[], errors=[];
const localStorage={
 getItem:key=>stored.get(key)??null,
 setItem:(key,value)=>{stored.set(key,value);},
 removeItem:key=>{stored.delete(key);},
};
const exports={};
const source=readFileSync('src/services/exploreFollowBatchService380.ts','utf8');
runInNewContext(ts.transpileModule(source,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
}}).outputText,{
 exports,console,localStorage,JSON,Number,String,Math,Array,Object,Map,Set,Promise,
 Date:{now:()=>now},
 setTimeout:(callback,delay)=>{
  const id=++nextTimer;
  timers.set(id,{callback,at:now+delay});return id;
 },
 clearTimeout:id=>timers.delete(id),
});
const tick=async(ms=0)=>{
 now+=ms;
 for(const [id,t] of [...timers]){
  if(t.at>now)continue;
  timers.delete(id);t.callback();
 }
 for(let i=0;i<25;i++)await Promise.resolve();
};
const result=following=>({isFollowing:following,followerCount:3,followingCount:0,
 actorFollowingCount:2,countVerified661:true,actorCountVerified662:true});
const request=(targetUid,desiredFollowing=true,baseFollowing=false,extra={})=>({
 viewerUid:'viewer',targetUid,desiredFollowing,baseFollowing,
 baseTargetFollowerCount:2,baseTargetFollowingCount:0,baseActorFollowingCount:1,
 targetProfile:{uid:targetUid,nickname:'artist',avatarUrl:'',handle:''},
 commit:async following=>{normal.push([targetUid,following]);return result(following);},
 exitCommit:async following=>{exits.push([targetUid,following]);return result(following);},
 onSettled:value=>settled.push(value),
 onError:value=>errors.push(value),
 ...extra,
});
const count=()=>exports.readPendingExploreFollowIntents380('viewer').length;

assert.equal(exports.EXPLORE_FOLLOW_IDLE_FLUSH_MS_380,5000);
// Ordinary SPA navigation still waits the entire batching window.
exports.queueExploreFollowFinalState380(request('navigation'));
await tick(1200);
await exports.flushPendingExploreFollowsForPageExit380('viewer');
assert.equal(normal.length,0);
assert.equal(exits.length,0);
assert.equal(count(),1);
await tick(3800);
assert.deepEqual(normal,[['navigation',true]]);
assert.equal(count(),0);

// A true pagehide skips the remaining timer but does NOT delete the local
// record until the server returns a canonical ACK.
let resolveExit;
exports.queueExploreFollowFinalState380(request('window',true,false,{
 exitCommit:following=>{
  exits.push(['window',following]);
  return new Promise(resolve=>{resolveExit=resolve;});
 },
}));
await tick(1000);
assert.equal(exports.dispatchPendingExploreFollowsOnPageHide712('other'),0);
assert.equal(exports.dispatchPendingExploreFollowsOnPageHide712('viewer'),1);
assert.equal(exits.length,1);
assert.equal(count(),1,'keepalive dispatch does not claim server settlement');
assert.equal(exports.dispatchPendingExploreFollowsOnPageHide712('viewer'),0,
 'same document cannot send two concurrent copies');
resolveExit(result(true));
await tick();
assert.equal(count(),0,'remove outbox only on canonical ACK');
assert.equal(settled.length,2);

// Returning to original state during the five-second window stays W0,
// even if the user closes the window.
exports.queueExploreFollowFinalState380(request('netzero',true,false));
exports.queueExploreFollowFinalState380(request('netzero',false,false));
assert.equal(exports.dispatchPendingExploreFollowsOnPageHide712('viewer'),0);
await tick(5000);
assert.equal(count(),0);
assert.equal(exits.length,1);
assert.equal(normal.length,1);

// If keepalive fails/has no ACK, the outbox MUST survive and a resumed
// document may use the unchanged canonical retry path.
exports.queueExploreFollowFinalState380(request('failed',true,false,{
 exitCommit:async()=>{throw new Error('connection ended');},
}));
assert.equal(exports.dispatchPendingExploreFollowsOnPageHide712('viewer'),1);
await tick();
assert.equal(count(),1);
assert.equal(errors.length,0,'unverified exit never runs the rollback callback');
await tick(5000);
assert.deepEqual(normal[1],['failed',true]);
assert.equal(count(),0);

// A future retry-after window is never bypassed by a browser exit.
exports.queueExploreFollowFinalState380(request('cooldown',true,false,{
 restoredNotBefore:now+30000,
}));
assert.equal(exports.dispatchPendingExploreFollowsOnPageHide712('viewer'),0);
assert.equal(count(),1);

// No exit send while a canonical write is already in-flight.
let resolveNormal;
exports.queueExploreFollowFinalState380(request('inflight',true,false,{
 commit:()=>new Promise(resolve=>{resolveNormal=resolve;}),
}));
await tick(5000);
assert.equal(exports.dispatchPendingExploreFollowsOnPageHide712('viewer'),0,
 'already-sent canonical write does not double-dispatch');
resolveNormal(result(true));
await tick();
assert.equal(count(),1,'only separate cooldown intent remains');
console.log('APP712_PAGEHIDE_SAME_ACCOUNT_PREVIEW_ONLY_NO_SPONTANEOUS_WRITE=PASS');
console.log('APP712_EXIT_KEEPALIVE_ACK_REQUIRED_OUTBOX_RECOVERY=PASS');
console.log('APP712_FIVE_SECOND_NET_ZERO_W0_AND_COOLDOWN=PASS');

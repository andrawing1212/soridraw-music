// APP720 real TypeScript logic exercised in an isolated VM; no server I/O.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const transpile=path=>ts.transpileModule(readFileSync(path,'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
}).outputText;
const visitsModule={exports:{}};
vm.runInNewContext(transpile('src/services/exploreFollowVisitReuse715.ts'),{
  exports:visitsModule.exports,require:(name)=>{throw Error('unexpected visit import: '+name);},
  Date,Map,Promise,Number,String,Boolean,Set,
});
const create=visitsModule.exports.createExploreFollowVisitReuse715;
const verified={isFollowing:false,followerCount:3,followingCount:9,countVerified661:true};
const legacy={...verified,countVerified661:false};
const actor='actor',target='public-target',base=1_000_000;
const a=create();
assert.equal(a.remember(actor,target,verified,base,a.version(),base+1,true),true);
assert.equal(a.read(actor,target,base+119999,true).isFollowing,false,
 'existing 120s behavior preserved after APP721');
assert.equal(a.read(actor,target,base+120000,true).isFollowing,false,
 '120s is no longer a cache miss');
assert.equal(a.read(actor,target,base+299999,true).isFollowing,false,
 'one verified GET + healthy RTDB => reuse before the 5-minute boundary');
assert.equal(a.read(actor,target,base+300000,true),null,
 'hard five-minute boundary still makes a new canonical GET necessary');
assert.equal(a.remember(actor,target,verified,base,a.version(),base+1,true),true);
assert.equal(a.read(actor,target,base+10000,false),null,
 'stream unavailable => 10s fallback, no unchecked long lease');
const b=create();
b.remember(actor,target,legacy,base,b.version(),base+1,true);
assert.equal(b.read(actor,target,base+10000,true),null,
 'not exact canonical follow count => never allow 120s');
// APP724: preserve the 30s receipt's ordering protection, but never spend
// another canonical GET after a single matching post-ACK verified response.
const settled724={following:true,settled:true,at:base};
const pending724={...settled724,settled:false};
const match724={...verified,isFollowing:true};
const mismatch724={...verified,isFollowing:false};
const allowed724=visitsModule.exports.canReuseVerifiedFollowChoice724;
const remember724=visitsModule.exports.canRememberPostAckFollowChoice724;
assert.equal(allowed724(settled724,match724,base+1000),true);
assert.equal(allowed724(pending724,match724,base+1000),false,'unsettled click cannot reuse GET');
assert.equal(allowed724(settled724,mismatch724,base+1000),false,'old membership cannot override ACK');
assert.equal(allowed724(settled724,{...match724,countVerified661:false},base+1000),false);
assert.equal(allowed724(settled724,match724,base+30_001),false,'expired receipt is not a new ACK');
assert.equal(remember724(settled724,match724,base-1,base+1000),false,'pre-click GET cannot enter cache');
assert.equal(remember724(settled724,match724,base,base+1000),true);
const after724=create();
after724.remember(actor,target,match724,base+1000,after724.version(),base+1001,true);
const warm724=after724.read(actor,target,base+9000,true);
assert.equal(allowed724(settled724,warm724,base+9000),true,
  'two revisits after one post-ACK canonical GET must use local cache');
after724.invalidate();
assert.equal(after724.read(actor,target,base+9000,true),null,'new signal/click always invalidates');
const c=create();
c.remember(actor,target,verified,base,c.version(),base+1,false);
assert.equal(c.read(actor,target,base+10000,true),null,
 'GET before stream established => cannot gain authority retroactively');
const d=create();
d.remember(actor,target,verified,base,d.version(),base+1,true);
assert.equal(d.read('other-account',target,base+2,true),null,'account isolation');
assert.equal(d.read(actor,'other-target',base+2,true),null,'target isolation');
d.invalidate();
assert.equal(d.read(actor,target,base+2,true),null,'remote event/click/account boundary');
assert.equal(d.remember(actor,target,verified,base,d.version()-1,base+3,true),false,
 'old GET cannot repopulate invalidated cache');
const e=create();
let loads=0,resolve;
const pending=new Promise(r=>resolve=r);
const one=e.runOrJoin(actor,target,()=>{loads++;return pending;},base);
const two=e.runOrJoin(actor,target,()=>{loads++;return pending;},base+10);
resolve(verified);
const [first,joined]=await Promise.all([one,two]);
assert.equal(loads,1,'same viewer+target inflight coalescing preserved');
assert.equal(joined.shared,true);
assert.equal(first.startedAt,base);
assert.equal(joined.startedAt,base);

// APP725: same-account route remount shares only a STILL PENDING GET, not
// completed answers. No actual Cloudflare, D1, R2, Firebase or browser I/O.
const observe725=visitsModule.exports.observeExploreFollowViewer725;
observe725(actor);
const routeA725=create();
let loadCount725=0;
let resolve725;
const wait725=new Promise(resolve=>{resolve725=resolve;});
const original725=routeA725.runOrJoin(actor,target,
  ()=>{loadCount725++;return wait725;},base+100_000);
const routeB725=create();
routeB725.invalidate(false); // ordinary same-user Explore component remount
observe725(actor);
const joined725=routeB725.runOrJoin(actor,target,
  ()=>{loadCount725++;throw Error('APP725 duplicate GET');},base+100_100);
assert.equal(loadCount725,1,'same actor/target across route remount spends one Worker GET');
resolve725({...verified,followerCount:4});
const [originalValue725,joinedValue725]=await Promise.all([original725,joined725]);
assert.equal(joinedValue725.shared,true);
assert.equal(joinedValue725.startedAt,base+100_000,'join retains request time');
assert.equal(joinedValue725.current725,true,'no new event => response can be used');
assert.equal(originalValue725.current725,true);
await routeB725.runOrJoin(actor,target,()=>{loadCount725++;return verified;},base+100_200);
assert.equal(loadCount725,2,'completed GET never becomes a module-level cache');

// A click or freshly confirmed RTDB event must invalidate the in-flight GET.
let resolveOld725;
const oldPromise725=new Promise(resolve=>{resolveOld725=resolve;});
const beforeClick725=routeA725.runOrJoin(actor,target,
  ()=>{loadCount725++;return oldPromise725;},base+110_000);
routeA725.invalidate(); // click / ACK / real signal
const afterClick725=await routeB725.runOrJoin(actor,target,
  ()=>{loadCount725++;return {...verified,isFollowing:true};},
  base+110_010,base+110_005);
resolveOld725(verified);
const stale725=await beforeClick725;
assert.equal(stale725.current725,false,'obsolete GET cannot be cached after invalidation');
assert.equal(afterClick725.current725,true);
assert.equal(afterClick725.shared,false,'changed state requires its own read');
assert.equal(loadCount725,4);

// A newer receipt can disqualify the earlier pending GET even if a route
// change occurred before its invalidation callback ran.
let releaseChoice725;
const choicePending725=new Promise(resolve=>{releaseChoice725=resolve;});
const beforeChoice725=routeA725.runOrJoin(actor,target,
  ()=>{loadCount725++;return choicePending725;},base+120_000);
const afterChoice725=await routeB725.runOrJoin(actor,target,
  ()=>{loadCount725++;return {...verified,isFollowing:true};},
  base+120_020,base+120_010);
releaseChoice725(verified);
await beforeChoice725;
assert.equal(afterChoice725.shared,false,'GET started before newest receipt not shareable');

// An outstanding pending final-state intent never joins an unrelated read.
let releasePending725;
const pendingWait725=new Promise(resolve=>{releasePending725=resolve;});
const beforePending725=routeA725.runOrJoin(actor,target,
  ()=>{loadCount725++;return pendingWait725;},base+130_000);
const pendingResult725=await routeB725.runOrJoin(actor,target,
  ()=>{loadCount725++;return {...verified,isFollowing:true};},
  base+130_010,base+130_005,true);
releasePending725(verified);
await beforePending725;
assert.equal(pendingResult725.shared,false,'queued change must not reuse GET');

// Account changes fence cross-mount requests, including switching back.
let releaseAccount725;
const waitingAccount725=new Promise(resolve=>{releaseAccount725=resolve;});
const priorAccount725=routeA725.runOrJoin(actor,target,
  ()=>{loadCount725++;return waitingAccount725;},base+140_000);
observe725('new-viewer');
observe725(actor);
const afterSwitch725=await routeB725.runOrJoin(actor,target,
  ()=>{loadCount725++;return verified;},base+140_010);
releaseAccount725(verified);
assert.equal((await priorAccount725).current725,false);
assert.equal(afterSwitch725.shared,false);
assert.equal(afterSwitch725.current725,true);
assert.equal(routeB725.read(actor,target,base+140_020,true),null,
  'request joining does not retain any completed state beyond APP715 cache');
console.log('APP725_SAME_PAIR_RAPID_ROUTE_ONE_INFLIGHT_GET=PASS');
console.log('APP725_CHANGED_CHOICE_PENDING_SIGNAL_ACCOUNT_FAIL_CLOSED=PASS');
console.log('APP725_NO_NEW_POLL_CACHE_NETWORK_OR_SHARED_DATA_WRITE=PASS');

const subscriptions=[];
const syncModule={exports:{}};
const fakeDatabase={
  onValue:(_ref,onNext,onError)=>{
    const subscription={onNext,onError,closed:false};
    subscriptions.push(subscription);
    return ()=>{subscription.closed=true};
  },
  ref:(_db,key)=>key,
  runTransaction:async()=>{throw Error('server write forbidden by verification');},
};
vm.runInNewContext(transpile('src/services/exploreFollowSyncService.ts'),{
 exports:syncModule.exports,require:name=>{
  if(name==='firebase/database')return fakeDatabase;
  if(name==='../firebase')return {realtimeDb:{}};
  throw Error('unexpected follow signal dependency '+name);
 },
 Date,Math,Number,String,Boolean,Promise,Set,Map,
 window:{localStorage:{getItem:()=>null,setItem:()=>{}},dispatchEvent:()=>{}},
 CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}},
 console:{warn:()=>{}},
});
let live=false,signals=0;
const unsubscribe=syncModule.exports.subscribeExploreFollowSync377(
 actor,()=>{signals++},ready=>{live=ready});
assert.equal(subscriptions.length,1,'no extra RTDB listener');
subscriptions[0].onNext({val:()=>null});
assert.equal(live,true,'initial valid onValue callback qualifies existing stream');
subscriptions[0].onNext({val:()=>({
 version:100,at:Date.now(),originDeviceId:'other-device',
 targetUid:target,following:true,actorFollowingCount:1,targetFollowerCount:4,
})});
assert.equal(signals,1,'confirmed remote signal retained');
subscriptions[0].onError(Error('disconnected'));
assert.equal(live,false,'RTDB error removes extended cache qualification');
unsubscribe();
assert.equal(subscriptions[0].closed,true);

const page=readFileSync('src/pages/ExplorePage.tsx','utf8');
assert.match(page,/signalQualified720=\(\)=>followStreamReady720Ref\.current===user\.uid/);
assert.match(page,/visit715\.read\(user\.uid,nextProfile\.uid,Date\.now\(\),signalQualified720\(\)\)/);
assert.match(page,/Date\.now\(\),signalQualified720\(\)\);/);
assert.match(page,/canReuseVerifiedFollowChoice724\(currentRecentChoice724,candidateFollow715,Date\.now\(\)\)/,
 'APP724 settled choice must be backed by an exact cached GET');
assert.match(page,/canRememberPostAckFollowChoice724\(/,
 'APP724 post-ACK verified GET must become reusable');
assert.match(page,/observeExploreFollowViewer725\(user\?\.uid\)/,
 'same-user remount preserves only unfinished exact-pair requests');
assert.match(page,/followVisitCache715Ref\.current\?\.invalidate\(false\)/,
 'route remount must retain global in-flight, not persistent visit cache');
assert.match(page,/fetchedFollow716\?\.current725!==false/,
 'invalidated stale read must never populate visit cache');
assert.match(page,/const reusableFollow716=!queuedFollow&&!recentChoice715\(\)/,
 'pending and recent local choice still force canonical verification');
assert.match(page,/window\.addEventListener\('offline',onBoundary720\)/);
assert.match(page,/window\.addEventListener\('online',onBoundary720\)/);
assert.match(page,/followVisitCache715Ref\.current\?\.invalidate\(\)/);
assert.match(page,/getExploreFollowState\(user, nextProfile\.uid, true\)/);
const subscriptionStart721=page.indexOf('return subscribeExploreFollowSync377(viewerUid377');
const subscriptionEnd721=page.indexOf('// app335: warm public-profile entry',subscriptionStart721);
assert.ok(subscriptionStart721>=0&&subscriptionEnd721>subscriptionStart721,
 'follow RTDB subscription must remain in its established hook');
const subscription721=page.slice(subscriptionStart721,subscriptionEnd721);
assert.match(subscription721,/const openDirection377 = profileConnectionsOpen376Ref\.current/,
 'live modal direction must come from existing ref, not stale closure');
assert.match(subscription721,/\}, \[user\?\.uid\]\);/,
 'opening/closing follower list must not resubscribe RTDB');
assert.doesNotMatch(subscription721,/\[user\?\.uid, profileConnectionsOpen376\]/,
 'modal open/close must not trigger another RTDB initial snapshot');
assert.equal((readFileSync('src/services/exploreFollowSyncService.ts','utf8')
 .match(/onValue\(/g)||[]).length,1,'APP720 adds zero RTDB subscriptions');
console.log('APP721_VERIFIED_GET_AND_LIVE_SIGNAL_REUSE_UNTIL_300S=PASS');
console.log('APP721_POPUP_TOGGLE_NO_EXTRA_RTDB_SUBSCRIBE=PASS');
console.log('APP720_FALLBACK_10S_LEGACY_PENDING_ACCOUNT_CONNECTION_FENCES=PASS');
console.log('APP720_RTDB_CONFIRMED_UPDATE_DISCONNECT_AND_SINGLE_LISTENER=PASS');
console.log('APP720_BACKEND_D1_R2_FIREBASE_RULES_WRITES=0');

console.log('APP724_POST_ACK_VERIFIED_REVISIT_NO_REPEAT_WORKER_D1_R2=PASS');

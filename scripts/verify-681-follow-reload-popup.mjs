// APP681: offline regression for follow restoration on non-Explore routes.
// No Firebase/Cloudflare requests and no personal data.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const source=readFileSync('src/services/exploreFollowPendingResume681.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
}}).outputText;
const build=(hostname)=>{
 const callbacks=[],patches=[],events=[],signals=[],cleared=[],exitCalls=[],pagehideListeners=[];
 let queued=[],pending=[],requests=0,serverCalls=0,recheckValue={isFollowing:true};
 const user={uid:'viewer'};
 const auth={currentUser:user};
 const win={location:{hostname},dispatchEvent:event=>events.push(event),
  addEventListener:(name,callback)=>{if(name==='pagehide')pagehideListeners.push(callback);}};
 class FakeCustomEvent{
  constructor(type,options){this.type=type;this.detail=options.detail;}
 }
 const dependencies={
  'firebase/auth':{onAuthStateChanged:(_auth,fn)=>{callbacks.push(fn);return()=>{};}},
  '../firebase':{auth},
  './exploreFollowBatchService380':{
   readPendingExploreFollowIntents380:()=>pending,
   queueExploreFollowFinalState380:row=>{queued.push(row);},
   dispatchPendingExploreFollowsOnPageHide712:uid=>{exitCalls.push(uid);},
  },
  './exploreFollowServerOwned713':{
   confirmExploreServerOwnedFollow713:async()=>{serverCalls++;return recheckValue;},
  },
  './exploreSocialService':{
   patchExploreFollowLocalState377:(...args)=>patches.push(args),
   setExploreFollow:async()=>({isFollowing:true,followerCount:2,followingCount:0,
    actorFollowingCount:1,countVerified661:true,actorCountVerified662:true}),
   getExploreFollowState:async()=>{requests++;return recheckValue;},
  },
  './exploreProfileFirstViewService':{
   patchExplorePublicProfileFirstViewProfile:(...args)=>patches.push(args),
  },
  './exploreFollowSyncService':{
   publishExploreFollowSync377:async(...args)=>{signals.push(args);return null;},
  },
  './exploreFollowChoice685':{
   rememberExploreFollowLocalChoice685:()=>{},
   clearExploreFollowLocalChoice695:(...args)=>cleared.push(args),
  },
 };
 const exports={};
 runInNewContext(compiled,{exports,require:name=>{
  assert.ok(Object.hasOwn(dependencies,name),'unexpected dependency '+name);
  return dependencies[name];
 },window:win,CustomEvent:FakeCustomEvent,console,Date,Map,Set,Number,Promise});
 return {exports,callbacks,patches,events,signals,cleared,exitCalls,pagehideListeners,user,auth,
  setPending:rows=>{pending=rows;},setRecheck:value=>{recheckValue=value;},
  getQueued:()=>queued,requests:()=>requests,serverCalls:()=>serverCalls};
};
const onPreview=build('preview.soridraw.com');
onPreview.exports.startExploreFollowPendingResume681();
onPreview.exports.startExploreFollowPendingResume681();
assert.equal(onPreview.callbacks.length,1,'register auth callback only once');
assert.equal(onPreview.pagehideListeners.length,1,'register one real-document exit listener');
onPreview.pagehideListeners[0]();
assert.deepEqual(onPreview.exitCalls,['viewer'],'pagehide routes only current account to exit sender');
onPreview.callbacks[0](onPreview.user);
assert.equal(onPreview.getQueued().length,0,'no settled-user startup work');
assert.equal(onPreview.requests(),0,'no startup server reads');

const record={
 viewerUid:'viewer',targetUid:'artist',desiredFollowing:true,
 baseFollowing:false,baseTargetFollowerCount:1,
 baseTargetFollowingCount:0,baseActorFollowingCount:0,
 targetProfile:{uid:'artist',nickname:'Artist',avatarUrl:'',handle:''},
 updatedAt:Date.now(),notBefore:0,retryUsed:false,suspended:false,
};
onPreview.setPending([record]);
onPreview.callbacks[0](onPreview.user);
const queued=onPreview.getQueued();
assert.equal(queued.length,1,'only the persisted mutation resumes');
assert.equal(queued[0].immediate,false);
assert.equal(queued[0].initialDelayMs,0,'resumed timer uses persisted original click time');
assert.equal(queued[0].initialDelayMs,0);
assert.equal(queued[0].restoredUpdatedAt,record.updatedAt);
assert.equal((await queued[0].commit(true)).isFollowing,true);
queued[0].onSettled({...record,result:{
 isFollowing:true,followerCount:2,followingCount:0,
 actorFollowingCount:1,countVerified661:true,actorCountVerified662:true,
}});
assert.equal(onPreview.events.length,1);
assert.equal(onPreview.events[0].detail.targetUid,'artist');
assert.equal(onPreview.events[0].detail.actorFollowingCount,1);
assert.equal(onPreview.events[0].detail.targetFollowerCount,2);
assert.equal(onPreview.signals.length,1,'signal only after canonical exact ACK');
assert.equal(onPreview.requests(),0,'settled callback needs no recheck');
// APP713: restored server-owned receipts must never start a legacy PUT/DELETE.
const owned=build('preview.soridraw.com');
owned.exports.startExploreFollowPendingResume681();
owned.setPending([{...record,serverOwned713:true}]);
owned.callbacks[0](owned.user);
const serverRow=owned.getQueued()[0];
assert.equal(serverRow.serverOwned713,true);
assert.equal(serverRow.exitCommit,undefined,'server owns the click after tab close');
assert.equal((await serverRow.commit(true)).isFollowing,true);
assert.equal(owned.serverCalls(),1,'confirm only the exact server-held click');

// APP695: only a confirmed server recheck may recover a failed mutation.
// During rapid reload the global route-independent handler used to broadcast
// pre-click base even when this GET failed, creating a 10-minute false receipt.
const failed=build('preview.soridraw.com');
failed.exports.startExploreFollowPendingResume681();
failed.setPending([record]);failed.callbacks[0](failed.user);
const lost=failed.getQueued()[0];
failed.setPending([]); // 380 removed the failed intent before onError
failed.setRecheck(null);
const patchesBefore=failed.patches.length;
lost.onError({...record,error:new Error('ACK_LOST')});
await Promise.resolve();await Promise.resolve();await Promise.resolve();
assert.equal(failed.requests(),1,'one bounded canonical GET only on actual failure');
assert.equal(failed.cleared.length,1,'clear stale unconfirmed choice for just this pair');
assert.equal(failed.events.length,0,'UNKNOWN_SERVER_STATE_MUST_NOT_EMIT_SETTLED_EVENT');
assert.equal(failed.patches.length,patchesBefore,
 'UNKNOWN_SERVER_STATE_MUST_NOT_RESTORE_STALE_PRE_CLICK_BASE');

const confirmed=build('preview.soridraw.com');
confirmed.exports.startExploreFollowPendingResume681();
confirmed.setPending([record]);confirmed.callbacks[0](confirmed.user);
const recovered=confirmed.getQueued()[0];
confirmed.setPending([]);
confirmed.setRecheck({isFollowing:false,followerCount:1,followingCount:0,
 actorFollowingCount:0,countVerified661:true,actorCountVerified662:true});
recovered.onError({...record,error:new Error('ACK_LOST')});
await Promise.resolve();await Promise.resolve();await Promise.resolve();
assert.equal(confirmed.events.length,1);
assert.equal(confirmed.events[0].detail.following,false,
 'a VERIFIED server correction may be announced');
assert.equal(confirmed.events[0].detail.targetFollowerCount,1);
assert.equal(confirmed.cleared.length,1);

const superseded=build('preview.soridraw.com');
superseded.exports.startExploreFollowPendingResume681();
superseded.setPending([record]);superseded.callbacks[0](superseded.user);
const oldFailure=superseded.getQueued()[0];
superseded.setPending([{...record,updatedAt:record.updatedAt+10,desiredFollowing:false}]);
oldFailure.onError({...record,error:new Error('ACK_LOST')});
await Promise.resolve();await Promise.resolve();await Promise.resolve();
assert.equal(superseded.events.length,0,'old failure must not override newer intent');
assert.equal(superseded.cleared.length,0,'new pending click must keep its choice');

const other=build('soridraw.com');
other.exports.startExploreFollowPendingResume681();
assert.equal(other.callbacks.length,0,'PRODUCTION must not start new recovery');

const main=readFileSync('src/main.tsx','utf8');
const social=readFileSync('src/services/exploreSocialService.ts','utf8');
const snapshot=readFileSync('src/services/exploreSocialSnapshotService.ts','utf8');
const page=readFileSync('src/pages/ExplorePage.tsx','utf8');
assert.match(main,/startExploreFollowPendingResume681\(\)/);
assert.match(social,/followGeneration681\(user\.uid\)!==startedGeneration681/);
assert.match(social,/if\(pending681\)return result/);
assert.match(snapshot,/inflightFollowChanges681/);
assert.match(snapshot,/for\(const \[targetUid,following\] of changes681\)/);
const start=page.indexOf('  // APP681: a settled local mutation');
const end=page.indexOf('  // app377:',start);
assert.ok(start>=0&&end>start,'popup listener missing');
const listener=page.slice(start,end);
assert.match(listener,/readExploreProfileConnectionsLocal681\(viewerUid681,'following'\)/);
assert.doesNotMatch(listener,/getExploreProfileConnections\(/,
 'settlement event cannot add implicit follower-list server reads');
assert.match(page,/announceExploreFollowSettled681\(/);
// APP696: the mounted profile handler must not turn an unavailable canonical
// recheck into a settled receipt or restore the old pre-click base.
const mountedError=page.slice(page.indexOf('      onError: (failure) => {'),
  page.indexOf('      onDeferred: () => {',page.indexOf('      onError: (failure) => {')));
assert.ok(mountedError.includes('clearExploreFollowLocalChoice695(viewerUid,targetUid)'));
assert.match(mountedError,/if \(!latest\) \{/);
assert.match(mountedError,/if \(!latest\) \{[\s\S]*?return;[\s\S]*?\}\s*const restored = latest\.isFollowing/);
assert.doesNotMatch(mountedError,/latest\?\.isFollowing \?\? failure\.baseFollowing/);
assert.match(mountedError,/const diagnosis699/);
assert.match(mountedError,/ACTOR_MISSING_PUBLIC_LIST/);
assert.match(mountedError,/PUBLIC_LIST_UNAVAILABLE/);
assert.match(mountedError,/WRITE_UNKNOWN/);
assert.match(mountedError,/상태:/);
assert.ok(mountedError.includes("failure.desiredFollowing ? 'FOLLOW' : 'UNFOLLOW'"));
assert.match(mountedError,/REVISION_ACK_INVALID/);
assert.match(mountedError,/ORDER_STATE_INVALID/);
assert.match(mountedError,/LOCAL_RETRY_GUARD/);
console.log('APP700_FOLLOW_UNFOLLOW_ERROR_CLASSIFICATION=PASS');
console.log('APP699_MOUNTED_ONE_PAIR_AUTH_DIAGNOSTICS_NO_NEW_GET=PASS');
// APP697: a real existing follower confirmed in a bounded public relation
// page can repair only the button after failure, not invent public counts.
// Missing/partial pages never prove non-follow and cannot force an unfollow.
assert.match(mountedError,/failure\.desiredFollowing === true/);
assert.match(mountedError,/getExploreProfileConnections\(\s*targetUid, 'followers', null, true\)/);
assert.match(mountedError,/page697\.items\.some\(row => row\.uid === viewerUid\)/);
assert.match(mountedError,/if \(confirmedByFollowerPage697\)/);
// APP698: known exact public follower must remain recoverable even when
// local receipt or direct follow-state recheck is unavailable.
assert.match(mountedError,/latest\?\.isFollowing !== true/);
assert.match(mountedError,/clickChoice698\?\.following !== false/);
assert.match(mountedError,/currentChoice698\?\.following === false/);
assert.match(mountedError,/currentChoice698\.at > clickChoice698\.at/);
console.log('APP698_MISSING_RECEIPT_OR_GET_CAN_USE_POSITIVE_ONLY_PROOF=PASS');
assert.match(mountedError,/setFollowState\(previous => previous[\s\S]*isFollowing:true/);
console.log('APP697_POSITIVE_ONLY_ONE_TARGET_FOLLOWER_RECOVERY=PASS');
console.log('APP696_MOUNTED_UNKNOWN_ACK_NO_FAKE_SETTLED=PASS');
console.log('APP681_NON_EXPLORE_RELOAD_ONLY_PENDING_RESUMED=PASS');
console.log('APP681_EXACT_SERVER_ACK_UPDATES_POPUP_AND_ACTOR_WITHOUT_EXTRA_GET=PASS');
console.log('APP681_STALE_SNAPSHOT_AND_FOLLOW_GET_FENCED=PASS');
console.log('APP681_PRODUCTION_AUTO_RECOVERY_OFF=PASS');

console.log('APP695_GLOBAL_RELOAD_UNKNOWN_ACK_NO_FAKE_SETTLED_OR_BASE_ROLLBACK=PASS');


// APP715 — repeated third-party visits must be free until bounded expiry,
 // and no stale in-flight GET may survive an accepted mutation/signal.
const visitSource715=readFileSync('src/services/exploreFollowVisitReuse715.ts','utf8');
const visitExports715={};
runInNewContext(ts.transpileModule(visitSource715,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
}}).outputText,{exports:visitExports715,Date,Number,String,Object,JSON,Map});
const makeVisit715=visitExports715.createExploreFollowVisitReuse715;
assert.equal(typeof makeVisit715,'function');
const visit715=makeVisit715();
const confirmed715={isFollowing:false,followerCount:5,followingCount:2};
const now715=1_900_000_000_000;
const generation715=visit715.version();
assert.equal(visit715.remember('viewer','target',confirmed715,now715,generation715,now715+100),true);
assert.equal(visit715.read('viewer','target',now715+1_000).followerCount,5);
assert.equal(visit715.read('viewer','target',now715+3_000).isFollowing,false,
 '10 route reentries must not each spend a follow-state GET');
assert.equal(visit715.read('another','target',now715+1000),null,
 'no cross-account reuse');
assert.equal(visit715.read('viewer','another',now715+1000),null,
 'no cross-target reuse');
assert.equal(visit715.read('viewer','viewer',now715+1000),null,
 'own profile never uses third-party visit data');
const mutable715=visit715.read('viewer','target',now715+2_000);
mutable715.followerCount=99;
assert.equal(visit715.read('viewer','target',now715+2_001).followerCount,5,
 'caller cannot mutate cached canonical response');
assert.equal(visit715.read('viewer','target',now715+10_000),null,
 'expired visit requires canonical GET again');
assert.equal(visit715.remember('viewer','target',confirmed715,now715,generation715,now715+10_000),false,
 'slow/stale in-flight GET cannot enter visit cache');
const oldGeneration715=visit715.version();
visit715.invalidate(); // mutation, RTDB signal, or tab background
assert.equal(visit715.remember('viewer','target',confirmed715,now715+20_000,oldGeneration715,now715+20_050),false,
 'a server response started before a signal must never repopulate the cache');
assert.equal(visit715.read('viewer','target',now715+20_050),null);
assert.equal(visit715.remember('viewer','target',{...confirmed715,followerCount:6},
 now715+20_100,visit715.version(),now715+20_150),true);
assert.equal(visit715.read('viewer','target',now715+20_200).followerCount,6);
for(let i=0;i<30;i++)visit715.remember('viewer','target'+i,confirmed715,
 now715+30_000,visit715.version(),now715+30_010);
assert.equal(visit715.read('viewer','target0',now715+30_100),null,
 'memory entries must be capped; never write persistent storage');
const page715=readFileSync('src/pages/ExplorePage.tsx','utf8');
assert.match(page715,/const reusableFollow716=!queuedFollow&&!recentChoice715\(\)/);
assert.match(page715,/const candidateFollow715=!queuedFollow/,
  'pending click must never consult a stale visit cache');
assert.match(page715,/const cachedFollow715=currentRecentChoice724/,
  'recent settled choice requires verified post-ACK cache match');
assert.match(page715,/canReuseVerifiedFollowChoice724\(currentRecentChoice724,candidateFollow715,Date\.now\(\)\)/,
  'APP724 must not bypass canonical verification for unmatched choice');
assert.match(page715,/await getExploreFollowState\(user, nextProfile.uid, true\)/,
 'cold visit still uses canonical authenticated GET');
assert.match(page715,/!readPendingExploreFollowIntents380\(user.uid\)/,
 'never cache while an unconfirmed local click is pending');
assert.match(page715,/visit715.remember\(user.uid,nextProfile.uid,nextFollowState/);
assert.match(page715,/onHidden715/);
assert.match(page715,/followVisitCache715Ref.current\?\.invalidate\(\)/);
assert.match(page715,/lastPublicVisitRevision715Ref\.current\.get\(viewedUid\)/);
assert.match(page715,/signal\.revision>previousPublic715\.revision/);
assert.match(page715,/previousPublic715\.generation!==signal\.generation/);
assert.match(page715,/recordCloudflareLocalCacheHit\('\/v1\/profiles\/:id\/follow-state'/);
console.log('APP715_THIRD_PARTY_10S_VISIT_R2_R0_MEMORY_ONLY=PASS');
console.log('APP715_EXPIRE_PENDING_REMOTE_SIGNAL_INFLIGHT_AND_ACCOUNT_FENCES=PASS');


// APP716 — in-flight follow-state GET coalescing is scoped per viewer/target.
// No server/auth network; verify real promise sharing, failures and invalidation.
const visit716=makeVisit715();
let loadCount716=0;
let resolveFirst716;
const waiting716=new Promise(resolve=>{resolveFirst716=resolve;});
const inFirst716=visit716.runOrJoin('viewer','target',()=>{
  loadCount716++;return waiting716;
},now715+60_000);
const inSecond716=visit716.runOrJoin('viewer','target',()=>{
  loadCount716++;throw Error('duplicate same-pair server GET');
},now715+60_050);
assert.equal(loadCount716,1,'overlapping same-pair GET must issue one request');
resolveFirst716({isFollowing:true,followerCount:6,followingCount:2});
const [resultFirst716,resultSecond716]=await Promise.all([inFirst716,inSecond716]);
assert.equal(resultFirst716.shared,false);
assert.equal(resultSecond716.shared,true);
assert.equal(resultSecond716.startedAt,now715+60_000,
 'join must keep ORIGINAL request time for stale-response fencing');
assert.equal(resultSecond716.state.followerCount,6);
resultSecond716.state.followerCount=999;
assert.equal(resultFirst716.state.followerCount,6,'joined readers receive separate state objects');
const countNew716=async()=>{loadCount716++;return confirmed715;};
await visit716.runOrJoin('another','target',countNew716,now715+60_100);
await visit716.runOrJoin('viewer','another',countNew716,now715+60_120);
await visit716.runOrJoin('viewer','target',countNew716,now715+60_140);
assert.equal(loadCount716,4,'different accounts and targets never share, settled GET refetches');

let oldResolve716;
const oldRequest716=new Promise(resolve=>{oldResolve716=resolve;});
const original716=visit716.runOrJoin('viewer','target',()=>oldRequest716,now715+70_000);
const staleGen716=visit716.version();
visit716.invalidate();
const afterSignal716=await visit716.runOrJoin('viewer','target',
 async()=>({...confirmed715,followerCount:8}),now715+70_100);
oldResolve716({...confirmed715,followerCount:3});
const staleResult716=await original716;
assert.equal(afterSignal716.state.followerCount,8);
assert.equal(staleResult716.state.followerCount,3);
assert.equal(visit716.remember('viewer','target',staleResult716.state,
 staleResult716.startedAt,staleGen716,now715+70_150),false,
 'a pre-signal response cannot populate the fresh visit cache');
assert.equal(visit716.remember('viewer','target',afterSignal716.state,
 afterSignal716.startedAt,afterSignal716.generation,now715+70_150),true);
assert.equal(visit716.read('viewer','target',now715+70_200).followerCount,8);

const fail716=visit716.runOrJoin('viewer','failure',
 async()=>{throw Error('temporary follow-state 503');},now715+80_000);
const joinFail716=visit716.runOrJoin('viewer','failure',
 async()=>{throw Error('must share failed GET');},now715+80_050);
await assert.rejects(fail716,/temporary follow-state 503/);
await assert.rejects(joinFail716,/temporary follow-state 503/);
const retry716=await visit716.runOrJoin('viewer','failure',
 async()=>confirmed715,now715+80_200);
assert.equal(retry716.shared,false,'failure clears single-flight entry for later recovery');

assert.match(page715,/visit715\.runOrJoin\(user.uid,nextProfile.uid/);
assert.match(page715,/const reusableFollow716=!queuedFollow&&!recentChoice715\(\)/);
assert.match(page715,/effectiveReadStartedAt716=fetchedFollow716\?\.startedAt/);
assert.match(page715,/followVisitCache715Ref.current\?\.invalidate\(\)/);
console.log('APP716_SAME_PAIR_INFLIGHT_SINGLE_GET_AND_FAILURE_RETRY=PASS');
console.log('APP716_ACCOUNT_TARGET_SIGNAL_AND_STALE_RESPONSE_FENCES=PASS');

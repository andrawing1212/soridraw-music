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
 const callbacks=[],patches=[],events=[],signals=[];
 let queued=[],pending=[],requests=0;
 const user={uid:'viewer'};
 const auth={currentUser:user};
 const win={location:{hostname},dispatchEvent:event=>events.push(event)};
 class FakeCustomEvent{
  constructor(type,options){this.type=type;this.detail=options.detail;}
 }
 const dependencies={
  'firebase/auth':{onAuthStateChanged:(_auth,fn)=>{callbacks.push(fn);return()=>{};}},
  '../firebase':{auth},
  './exploreFollowBatchService380':{
   readPendingExploreFollowIntents380:()=>pending,
   queueExploreFollowFinalState380:row=>{queued.push(row);},
  },
  './exploreSocialService':{
   patchExploreFollowLocalState377:(...args)=>patches.push(args),
   setExploreFollow:async()=>({isFollowing:true,followerCount:2,followingCount:0,
    actorFollowingCount:1,countVerified661:true,actorCountVerified662:true}),
   getExploreFollowState:async()=>{requests++;return {isFollowing:true};},
  },
  './exploreProfileFirstViewService':{
   patchExplorePublicProfileFirstViewProfile:(...args)=>patches.push(args),
  },
  './exploreFollowSyncService':{
   publishExploreFollowSync377:async(...args)=>{signals.push(args);return null;},
  },
  './exploreFollowChoice685':{
   rememberExploreFollowLocalChoice685:()=>{},
  },
 };
 const exports={};
 runInNewContext(compiled,{exports,require:name=>{
  assert.ok(Object.hasOwn(dependencies,name),'unexpected dependency '+name);
  return dependencies[name];
 },window:win,CustomEvent:FakeCustomEvent,console,Date,Map,Set,Number,Promise});
 return {exports,callbacks,patches,events,signals,user,auth,
  setPending:rows=>{pending=rows;},getQueued:()=>queued,requests:()=>requests};
};
const onPreview=build('preview.soridraw.com');
onPreview.exports.startExploreFollowPendingResume681();
onPreview.exports.startExploreFollowPendingResume681();
assert.equal(onPreview.callbacks.length,1,'register auth callback only once');
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
console.log('APP681_NON_EXPLORE_RELOAD_ONLY_PENDING_RESUMED=PASS');
console.log('APP681_EXACT_SERVER_ACK_UPDATES_POPUP_AND_ACTOR_WITHOUT_EXTRA_GET=PASS');
console.log('APP681_STALE_SNAPSHOT_AND_FOLLOW_GET_FENCED=PASS');
console.log('APP681_PRODUCTION_AUTO_RECOVERY_OFF=PASS');

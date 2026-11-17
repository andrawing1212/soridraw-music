// APP712: execute the real TypeScript network layer with fake Auth/AppCheck
// and fake fetch. No external requests, tokens or user data.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const source=readFileSync('src/services/exploreSocialService.ts','utf8');
const requests=[],cacheWrites=[];
let idTokenCalls=0,appCheckCalls=0;
const user={uid:'viewer',getIdToken:async()=>{idTokenCalls++;return 'test-id-token';}};
const fakeResponse={ok:true,status:200,headers:{get:()=>null},json:async()=>({
 data:{isFollowing:true,following:true,followerCount:3,followingCount:0,
 actorFollowingCount:2,followProtocol:354,canonicalCounts662:true},
})};
const modules={
 '../config/exploreEnvironment':{EXPLORE_API_BASE:'https://example.invalid'},
 '../firebase':{getFirebaseAppCheckToken:async()=>{appCheckCalls++;return 'test-app-check';}},
 '../lib/cloudflareDiagnostics':{
  recordCloudflareResponse:()=>{},recordCloudflareLocalCacheHit:()=>{},
 },
 '../lib/soridrawPersistentCache':{
  readSoridrawPersistentCache:()=>null,
  writeSoridrawPersistentCache:row=>cacheWrites.push(row),
  removeSoridrawPersistentCache:()=>{},
 },
 './exploreFollowOrdering354':{
  requestOrderedExploreFollow354:(_viewer,target,following,send)=>
   send('/v1/profiles/'+encodeURIComponent(target)+'/follow',{
    method:following?'PUT':'DELETE',
   }),
 },
 './exploreFollowingPopupConsistency682':{shouldHoldOwnFollowingPage682:()=>false},
 './exploreFollowBatchService380':{readPendingExploreFollowIntents380:()=>[]},
 './exploreSocialSnapshotService':{
  getExplorePersonalSocialSnapshot:()=>null,
  patchExplorePersonalSocialFollow:()=>{},
 },
};
const exports={};
runInNewContext(ts.transpileModule(source,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
}}).outputText,{
 exports,require:name=>{
  assert.ok(Object.hasOwn(modules,name),'unexpected dependency: '+name);
  return modules[name];
 },
 console,Date,Promise,JSON,Map,Set,Math,Number,String,
 fetch:async(url,init)=>{
  requests.push({url,init});return fakeResponse;
 },
});
const {setExploreFollow,primeExploreFollowExitAuth712}=exports;
const actor=user;
assert.equal(requests.length,0);
// A normal canonical write after 5s uses fresh auth AND keepalive.
await setExploreFollow(actor,'artist',true,null);
assert.equal(idTokenCalls,1);
assert.equal(appCheckCalls,1);
assert.equal(requests.length,1);
assert.equal(requests[0].init.method,'PUT');
assert.equal(requests[0].init.keepalive,true);
assert.equal(requests[0].init.headers.Authorization,'Bearer test-id-token');
assert.equal(requests[0].init.headers['X-Firebase-AppCheck'],'test-app-check');

// A real pagehide reuses the already-ready credentials; there must be
// no async token/AppCheck lookup between pagehide and fetch dispatch.
primeExploreFollowExitAuth712(actor);
await setExploreFollow(actor,'artist',false,null,{exitKeepalive:true});
assert.equal(idTokenCalls,1);
assert.equal(appCheckCalls,1);
assert.equal(requests.length,2);
assert.equal(requests[1].init.method,'DELETE');
assert.equal(requests[1].init.keepalive,true);

// A new/unprepared user must not use a different account's credentials.
const unprepared={uid:'another',getIdToken:async()=>{idTokenCalls++;return 'other';}};
await assert.rejects(()=>setExploreFollow(unprepared,'artist',true,null,
 {exitKeepalive:true}),/종료 중 보안 인증/);
assert.equal(requests.length,2,'no unauthenticated or cross-user exit fetch');
console.log('APP712_FOLLOW_NORMAL_AND_EXIT_KEEPALIVE_AUTH_FENCE=PASS');

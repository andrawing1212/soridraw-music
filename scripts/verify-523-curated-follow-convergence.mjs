import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const read=p=>readFileSync(p,'utf8'),curated=read('src/services/exploreCurationService.ts'),
 social=read('src/services/exploreSocialService.ts'),page=read('src/pages/ExplorePage.tsx');
const body=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert.ok(i>=0&&j>i);return s.slice(i,j).replace(/^export const /,'const ');};
const load=(source,name,ctx)=>runInNewContext(ts.transpileModule(source,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None,
}}).outputText+'\n'+name+';',ctx);
let cache={revision:'same-curation-revision',checkedAt:1234,items:[
 {id:'first',likeCount:1,title:'First'},{id:'second',likeCount:3,title:'Second'}],
 settledPublicLikes524:{}},writes=0;
const update=load(body(curated,'export const patchSoridrawCuratedPublishedLikeCount523 =',
 'export const invalidateSoridrawCuratedCache307 ='),
 'patchSoridrawCuratedPublishedLikeCount523',{readCuratedCache307:()=>cache,
 writeCuratedCache307:(items,revision,checkedAt,published)=>{
  writes++;
  cache={...cache,
   items:items.map(row=>row.id===published.trackId
    ? {...row,likeCount:published.likeCount}:row),
   revision,checkedAt,
   settledPublicLikes524:{...cache.settledPublicLikes524,
    [published.trackId]:{likeCount:published.likeCount,updatedAt:published.updatedAt}}};
 }});
assert.equal(update('first',2,2000),true);
assert.equal(cache.items[0].likeCount,2);
assert.equal(cache.items[1].likeCount,3);
assert.equal(cache.revision,'same-curation-revision');
assert.equal(cache.checkedAt,1234);
assert.equal(writes,1);
assert.equal(update('first',2,2000),false);
assert.equal(update('first',1.5),false);
assert.equal(update('unknown',100),false);
assert.equal(writes,1);
assert.equal(update('first',1,3000),true,'unlikes may decrease published count');
assert.equal(cache.items[0].likeCount,1);
assert.match(page,/patchSoridrawCuratedPublishedLikeCount523\(row\.trackId, card\.likeCount, card\.updatedAt\)/);
assert.match(page,/card\.updatedAt < row\.at/);
assert.doesNotMatch(page,/patchSoridrawCuratedPublishedLikeCount523\(.*optimistic/);
console.log('APP523_PUBLISHED_CURATED_COUNT_CACHE_1_2_1_AND_W0=PASS');
let local={items:[{uid:'B',nickname:'B'}],nextCursor:null},calls=0,hits=0;
const get=load(body(social,'export const getExploreProfileConnections =',
 'export const getExplorePublicProfileTracks ='),'getExploreProfileConnections',{
 readProfileConnectionCache377:()=>local,
 writeProfileConnectionCache377:(_id,_dir,page)=>{local=page;},
 recordCloudflareLocalCacheHit:()=>{hits++;},
 EXPLORE_PROFILE_CONNECTION_DIAGNOSTIC_PATH_377:'connections',
 normalizeProfile:row=>({...row}),
 profileConnectionCacheKey377:(uid,d)=>uid+':'+d,
 advanceProfileConnectionGeneration548:()=>1,
 isCurrentProfileConnectionGeneration548:()=>true,
 requestPublic:async path=>{
   calls++;assert.equal(path,'/v1/profiles/A/followers?limit=30');
   return {data:{items:[],nextCursor:null}};
 },
 URLSearchParams,
});
assert.equal((await get('A','followers')).items.length,1);
assert.equal(calls,0);assert.equal(hits,1);
assert.equal((await get('A','followers',null,true)).items.length,0);
assert.equal(calls,1);
assert.equal((await get('A','followers')).items.length,0);
assert.equal(calls,1,'repeat uses newly persisted list, not a server loop');
const staleSource=body(social,'export const getExploreProfileConnections =',
 'export const getExplorePublicProfileTracks =');
const pending548=[],persisted548=[];
let version548=0;const latest548=new Map();
const key548=(uid,dir)=>uid+':'+dir;
const advance548=k=>{const n=++version548;latest548.set(k,n);return n;};
const staleGet548=load(staleSource,'getExploreProfileConnections',{
 readProfileConnectionCache377:()=>null,
 writeProfileConnectionCache377:(_uid,_dir,page)=>persisted548.push(page),
 recordCloudflareLocalCacheHit:()=>{},
 EXPLORE_PROFILE_CONNECTION_DIAGNOSTIC_PATH_377:'connections',
 normalizeProfile:row=>({...row}),
 profileConnectionCacheKey377:key548,
 advanceProfileConnectionGeneration548:advance548,
 isCurrentProfileConnectionGeneration548:(k,v)=>latest548.get(k)===v,
 requestPublic:()=>new Promise(resolve=>pending548.push(resolve)),
 URLSearchParams,
});
const older548=staleGet548('A','followers',null,true);
const newer548=staleGet548('A','followers',null,true);
assert.equal(pending548.length,2);
pending548[1]({data:{items:[{uid:'new-member'}],nextCursor:null}});
await newer548;
pending548[0]({data:{items:[{uid:'old-member'}],nextCursor:null}});
await older548;
assert.equal(persisted548.length,1,'STALE_RESPONSE_CANNOT_OVERWRITE_PERSISTED_CACHE');
assert.equal(persisted548[0].items[0].uid,'new-member');
const invalidated548=staleGet548('A','followers',null,true);
advance548(key548('A','followers')); // New canonical owner event
pending548[2]({data:{items:[{uid:'invalidated-member'}],nextCursor:null}});
await invalidated548;
assert.equal(persisted548.length,1,'INVALIDATED_INFLIGHT_REQUEST_CANNOT_RESTORE_CACHE');
assert.match(social,/advanceProfileConnectionGeneration548\(cacheKey\);\s*removeSoridrawPersistentCache/);
console.log('APP548_STALE_FOLLOWER_RESPONSE_PERSISTENT_CACHE_FENCE=PASS');
assert.match(page,/direction === 'followers' && targetUid === user\?\.uid/);
assert.match(page,/OWN_FOLLOWERS_EXPLICIT_RECHECK_MS_523 = 120_000/);
assert.match(page,/getExploreProfileConnections\(targetUid, direction, null, refreshOwn523\)/);
// app527: app525's 15-second focus/visibility list fetch was measured as
// repeated D1 reads even when there was no actual follow mutation.
// Preserve the verified explicit popup refresh path; no idle/focus fetch.
assert.match(page,/APP527: A's profile must not spend D1\/R2 on window focus/);
assert.doesNotMatch(page,/onOwnFollowersFocus525/);
// APP548: exactly one NEW server-confirmed owner signal may fetch the open
// owner's follower page. Retained RTDB snapshots and closed modals stay D1 R0.
const ownerStart548=page.indexOf('  // APP542:');
const ownerEnd548=page.indexOf('  // APP527:',ownerStart548);
assert.ok(ownerStart548>0&&ownerEnd548>ownerStart548);
const ownerLive548=page.slice(ownerStart548,ownerEnd548);
assert.match(ownerLive548,/const confirmedNewEvent=isNewEvent&&initialSnapshotHandled/);
assert.match(ownerLive548,/if\(confirmedNewEvent&&profileConnectionsOpen376Ref\.current==='followers'\)/);
assert.match(ownerLive548,/getExploreProfileConnections\(ownerUid,'followers',null,true\)/);
assert.doesNotMatch(page.slice(0,ownerStart548)+page.slice(ownerEnd548),
 /getExploreProfileConnections\(ownerUid,'followers',null,true\)/);
const explicitBegin=page.indexOf("  const openProfileConnections376 = async ");
const explicitEnd=page.indexOf('  // APP527:',explicitBegin);
const explicit=page.slice(explicitBegin,explicitEnd);
assert.ok(explicitBegin>0 && explicitEnd>explicitBegin);
assert.match(explicit,/const refreshOwn523 = ownFollowers523 &&/);
assert.match(explicit,/readExploreProfileConnectionLastServerAt528\(targetUid, direction\)/);
assert.match(explicit,/shouldRefreshOwnerFollowersOnOpen528\(/);
assert.match(explicit,/getExploreProfileConnections\(targetUid, direction, null, refreshOwn523\)/);

const stampSource=body(social,
 'export const readExploreProfileConnectionLastServerAt528 =',
 'export const readExploreProfileConnectionExactCount379 =')
 .replace(/export const /g,'const ');
const now528=Date.now();
let persistent528={data:{items:[{uid:'B'}],nextCursor:null},syncedAt:now528-45_000};
const stampApi528=load(stampSource,
 '({read:readExploreProfileConnectionLastServerAt528,should:shouldRefreshOwnerFollowersOnOpen528})',
 {
  readSoridrawPersistentCache:()=>persistent528,
  profileConnectionCacheKey377:(uid,direction)=>uid+':'+direction,
  EXPLORE_PROFILE_CONNECTION_CACHE_SOURCE_TYPE_377:'connections',
  EXPLORE_PROFILE_CONNECTION_CACHE_SCHEMA_VERSION_377:1,
  Date,
 });
assert.equal(stampApi528.read('A','followers'),persistent528.syncedAt);
assert.equal(stampApi528.should(stampApi528.read('A','followers'),now528,120_000),false,
 'REOPEN_WITHIN_2M_WORKER0_D1_R0');
assert.equal(stampApi528.should(stampApi528.read('A','followers'),now528+90_000,120_000),true,
 'EXPLICIT_RETURN_AFTER_2M_MAY_RECHECK_FOR_CROSS_ACCOUNT_FALLBACK');
persistent528=null;
assert.equal(stampApi528.read('A','followers'),0,'INVALIDATED_CACHE_RECHECK_ALLOWED');
assert.equal(stampApi528.should(stampApi528.read('A','followers'),now528,120_000),true);
persistent528={data:{items:[]},syncedAt:now528+30_000};
assert.equal(stampApi528.read('A','followers'),0,'FUTURE_CLOCK_STAMP_MUST_NOT_HIDE_RECHECK');
console.log('APP528_PERSISTED_FOLLOWERS_SERVER_STAMP_ACROSS_RELOAD=PASS');
console.log('APP528_BOUND_2MIN_EXPLICIT_FALLBACK_NO_IDLE_QUERY=PASS');
console.log('APP523_CROSS_ACCOUNT_UNFOLLOW_OWNER_EXPLICIT_LIST_REFRESH=PASS');
console.log('APP523_NO_IDLE_POLL_OR_SHARED_RESOURCE_CHANGE=PASS');

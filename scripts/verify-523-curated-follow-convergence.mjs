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
assert.match(page,/direction === 'followers' && targetUid === user\?\.uid/);
assert.match(page,/OWN_FOLLOWERS_EXPLICIT_RECHECK_MS_523 = 15_000/);
assert.match(page,/getExploreProfileConnections\(targetUid, direction, null, refreshOwn523\)/);
// app525: keep app523 on-demand popup refresh, plus owner header focus
// reconciliation when the modal is closed. No idle cross-user polling.
assert.match(page,/if\(profileConnectionsOpen376==='followers'\)/);
assert.match(page,/void openProfileConnections376\('followers'\)/);
assert.match(page,/window\.addEventListener\('focus',onOwnFollowersFocus525\)/);
assert.match(page,/document\.addEventListener\('visibilitychange',onOwnFollowersFocus525\)/);
console.log('APP523_CROSS_ACCOUNT_UNFOLLOW_OWNER_EXPLICIT_LIST_REFRESH=PASS');
console.log('APP523_NO_IDLE_POLL_OR_SHARED_RESOURCE_CHANGE=PASS');

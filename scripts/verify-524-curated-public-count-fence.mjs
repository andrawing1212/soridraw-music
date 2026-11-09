// app524: execute the actual curated cache writer and settled public-like
// projection in isolated memory. Reproduces: A/B published 2, admin snapshot
// still 1, reload, and later an unlike 1. No real network/user data mutations.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const source=readFileSync('src/services/exploreCurationService.ts','utf8');
const page=readFileSync('src/pages/ExplorePage.tsx','utf8');
const part=(s,start,end)=>{
 const a=s.indexOf(start),b=s.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'MISSING_REAL_SOURCE_'+start);
 return s.slice(a,b);
};
const snippets=[
 "const SORIDRAW_CURATED_CACHE_KEY_307='test-neutral-cache';let memoryCache307=null;",
 part(source,'const readCuratedCache307 = ()','// app406: synchronous'),
 part(source,'// APP524_CURATED_MEMBERSHIP_NEVER_OVERRIDES_PUBLISHED_LIKES','// APP523_PUBLIC_CURATED_COUNT_PUBLISHED_ONLY'),
 part(source,'export const patchSoridrawCuratedPublishedLikeCount523 =','export const invalidateSoridrawCuratedCache307'),
 part(source,'const syncPublicCuratedCacheFromManaged311 =','const fetchCuratedRevision309 ='),
].join('\n').replace(/\bexport const /g,'const ');
const exec=ts.transpileModule(snippets,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None,
}}).outputText+'\n({read:readCuratedCache307,write:writeCuratedCache307,patch:patchSoridrawCuratedPublishedLikeCount523,manage:syncPublicCuratedCacheFromManaged311,project:projectSoridrawCuratedPublishedLikeCounts524,reload:()=>{memoryCache307=null;}})';
const storage=new Map();let localWrites=0,network=0;
const sandbox={localStorage:{
 getItem:k=>storage.get(k)||null,
 setItem:(k,v)=>{localWrites++;storage.set(k,v);},
},fetch:()=>{network++;throw Error('BACKEND_READ_NOT_ALLOWED')},Date};
const api=runInNewContext(exec,sandbox);
const snapshot=[{id:'song-A',title:'A',likeCount:1},{id:'song-B',title:'B',likeCount:4}];
api.write(snapshot,'unchanged-curation-revision',1000);
assert.equal(api.read().items[0].likeCount,1,'INITIAL_MANAGER_RECOMMENDATION_1');
assert.equal(api.patch('song-A',2,2000),true,'B_SETTLED_LIKE_2');
assert.equal(api.read().items[0].likeCount,2);
const before=localWrites;
assert.equal(api.patch('song-A',2,2000),false);
assert.equal(localWrites,before,'SAME_SETTLED_PUBLIC_SIGNAL_LOCAL_W0');
api.manage(snapshot,'unchanged-curation-revision',2500);
assert.equal(api.read().items[0].likeCount,2,'MANAGER_OLD_1_CANNOT_RESTORE_1');
assert.equal(api.read().revision,'unchanged-curation-revision');
api.reload();
assert.equal(api.read().items[0].likeCount,2,'FULL_PAGE_RELOAD_MUST_STAY_2');
assert.equal(api.project(snapshot)[0].likeCount,2,'ADMIN_REOPEN_MUST_STAY_2');
assert.equal(api.project(snapshot)[1].likeCount,4,'OTHER_CURATION_UNCHANGED');
api.write(snapshot,'unchanged-curation-revision',2700);
assert.equal(api.read().items[0].likeCount,2,'STALE_CURATED_R2_HTTP_MUST_NOT_REVERT_2');
assert.equal(api.patch('song-A',1,3000),true,'ACTUAL_UNLIKE_1_MUST_BE_ALLOWED');
assert.equal(api.read().items[0].likeCount,1);
assert.equal(api.patch('song-A',2,2000),false,'OLD_REORDERED_PUBLIC_CARD_REJECTED');
api.manage([{...snapshot[0],likeCount:2},snapshot[1]],'unchanged-curation-revision',3500);
assert.equal(api.read().items[0].likeCount,1,'OLDER_ADMIN_2_CANNOT_REPLACE_NEWER_UNLIKE_1');
api.reload();
assert.equal(api.read().items[0].likeCount,1,'POST_UNLIKE_RELOAD_STABLE');
assert.equal(network,0,'NO_NEW_SERVER_GET_FOR_CURATED_PUBLIC_LIKE');

const vStart='  const visibleCuratedTracks524 = useMemo(() => {';
const vEnd='  const recommendationModel221 =';
const vSrc=part(page,vStart,vEnd);
const compile=(rows,confirmed=null)=>runInNewContext(ts.transpileModule(
 vSrc+'\nvisibleCuratedTracks524;', {compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None,
 }}).outputText,{
 useMemo:fn=>fn(),curatedTracks307:[{id:'song-A',likeCount:1,title:'A',liked:false}],
 tracks:[],popularTracks:rows,
 readSoridrawCuratedPublishedLikeCount524:()=>confirmed,
 auth:{currentUser:null},user:null,
 overlayExploreLikeDisplayCounts:(_uid,rows)=>rows,
});
const painted=compile([{id:'song-A',likeCount:2,title:'A',liked:false}]);
assert.equal(painted[0].likeCount,2,'POPULAR_2_MUST_REPAINT_CURATED_1');
assert.equal(painted[0].liked,false,'PERSONAL_HEART_IS_UNCHANGED');
assert.equal(compile([{id:'song-A',likeCount:0}])[0].likeCount,0,
 'TRUE_UNLIKE_CAN_DECREASE_TO_ZERO');
assert.equal(compile([])[0].likeCount,1,'NO_OTHER_FEED_FALLBACK_TO_CURATED');
assert.equal(compile([{id:'song-A',likeCount:1}],2)[0].likeCount,2,
 'R2_CONFIRMED_2_OUTRANKS_OLDER_POPULAR_1');
assert.equal(compile([{id:'song-A',likeCount:2}],0)[0].likeCount,0,
 'R2_CONFIRMED_UNLIKE_0_OUTRANKS_OLDER_POPULAR_2');
assert.match(page,/readSoridrawCuratedPublishedLikeCount524\(track\.id\)/);
assert.match(page,/confirmed \?\? onScreenCounts\.get\(track\.id\)/);
assert.match(page,/visibleCuratedTracks524\.slice\(0, EXPLORE_HOME_SECTION_VISIBLE_LIMIT_304\)/);
assert.match(page,/patchSoridrawCuratedPublishedLikeCount523\(row\.trackId, card\.likeCount, card\.updatedAt\)/);
assert.match(page,/projectSoridrawCuratedPublishedLikeCounts524\(rows\)/);
assert.doesNotMatch(vSrc,/fetch\(|setInterval\(|localStorage\.setItem\(/);
console.log('APP524_PUBLIC_2_SURVIVES_STALE_ADMIN_CACHE_AND_BROWSER_RELOAD=PASS');
console.log('APP524_UNLIKE_1_OLDER_RELEASE_REORDER_AND_OTHER_TRACK_PROTECTED=PASS');
console.log('APP524_POPULAR_CURATED_RENDER_PARITY_NO_EXTRA_READS_OR_WRITES=PASS');

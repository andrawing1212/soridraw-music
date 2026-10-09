import assert from 'node:assert/strict';
import {createPersonalLikeR2Publisher423} from '../cloudflare/explore-worker/runtime/like-personal-r2-publisher-423.mjs';
import {verifyLikeR2Readiness429} from '../cloudflare/explore-worker/runtime/like-batch-composition-422.mjs';

const uid='user-423', id='track-423';
const key='internal/explore/shared-social-v114/likes/'+uid+'.json';
let stamp=1, puts=0, raceOnce=false;
let object={schemaVersion:1,uid,canonicalComplete156:true,canonicalSource156:'canonical-d1',
  likedTrackIds:[],exactLikeCount156:0,updatedAt:10};
const r2={
 async get(k){if(k!==key||object===null)return null;
   return {etag:'e'+stamp,text:async()=>JSON.stringify(object),customMetadata:{}};},
 async put(k,body,opts){
   assert.equal(k,key);
   if(raceOnce){raceOnce=false;return null;}
   assert.equal(opts.onlyIf.etagMatches,'e'+stamp);
   object=JSON.parse(body);stamp++;puts++;
   return {etag:'e'+stamp};
 },
};
const persist=createPersonalLikeR2Publisher423({r2,now:()=>423000});
let result=await persist({uid,trackId:id,liked:true,revision:1,operationId:'op-1'});
assert.equal(result.persisted,true);
assert.deepEqual(object.likedTrackIds,[id]);
assert.equal(object.exactLikeCount156,1);
assert.equal(object.canonicalComplete156,true);
assert.equal(object.likeRevisions423[id].revision,1);
result=await persist({uid,trackId:id,liked:true,revision:1,operationId:'op-1'});
assert.equal(result.unchanged,true);assert.equal(puts,1);
await assert.rejects(persist({uid,trackId:id,liked:false,revision:0,operationId:'old'}),/423_STALE_PRIVATE_REVISION/);
await assert.rejects(persist({uid,trackId:id,liked:false,revision:1,operationId:'different'}),/423_SAME_REVISION_CONFLICT/);
assert.equal(puts,1);
raceOnce=true;
result=await persist({uid,trackId:id,liked:false,revision:2,operationId:'op-2'});
assert.equal(result.persisted,true);
assert.deepEqual(object.likedTrackIds,[]);
assert.equal(object.exactLikeCount156,0);
assert.equal(object.likeRevisions423[id].revision,2);
assert.equal(puts,2);
object.canonicalComplete156=false;
await assert.rejects(persist({uid,trackId:'another',liked:true,revision:1,operationId:'op-3'}),/423_PERSONAL_CATALOG_NOT_CANONICAL_COMPLETE/);
assert.equal(puts,2);
object=null;
await assert.rejects(persist({uid,trackId:id,liked:true,revision:3,operationId:'op-4'}),/423_COLD_CATALOG_REQUIRES_CANONICAL_BOOTSTRAP/);
assert.equal(puts,2);
console.log('423_ACTUAL_EXISTING_SHARED_SOCIAL_V114_PERSONAL_CAS=PASS');
console.log('423_IDEMPOTENT_RETRY_AND_STALE_REVISION_NO_OVERWRITE=PASS');
console.log('423_LEGACY_COMPLETE_METADATA_PRESERVED=PASS');
// Stage431: unusual track identifiers must never resolve inherited
// metadata properties and fail AFTER D1 has already committed.
object={schemaVersion:1,uid,canonicalComplete156:true,
  canonicalSource156:'verified',likedTrackIds:[],exactLikeCount156:0,
  updatedAt:100};
for(const special of ['constructor','__proto__']){
  const beforePuts=puts;
  result=await persist({uid,trackId:special,liked:true,
    revision:1,operationId:'special-'+special});
  assert.equal(result.persisted,true);
  assert.equal(puts,beforePuts+1);
  assert.equal(Object.prototype.hasOwnProperty.call(object.likeRevisions423,special),true);
  assert.equal(object.likeRevisions423[special].revision,1);
}
console.log('423_PROTOTYPE_LOOKING_IDS_DO_NOT_CAUSE_POST_D1_FAILURE=PASS');
console.log('423_PARTIAL_COLD_CATALOG_FAIL_CLOSED_NO_USER_BACKFILL=PASS');

const preflightKey='internal/explore/shared-social-v114/likes/'+uid+'.json';
const preflightCard='internal/explore/shared-track-card-v115/'+id+'.json';
const preflightLatest='internal/explore/shared-feed-v112/latest-40.json';
const preflightPopular='internal/explore/shared-feed-v112/popular-40.json';
const readyItems=new Map([
 [preflightKey,{schemaVersion:1,uid,canonicalComplete156:true,
   canonicalSource156:'source-verified',likedTrackIds:[],exactLikeCount156:0}],
 [preflightCard,{schemaVersion:1,card:{id,likeCount:0}}],
 [preflightLatest,{payload:{data:{items:[]}}}],
 [preflightPopular,{payload:{data:{items:[]}}}],
]);
const readyR2={async get(k){
 const data=readyItems.get(k);
 return data?{text:async()=>JSON.stringify(data)}:null;
}};
const request=[{trackId:id,liked:true,baseLiked:false,
  mutationAt:429000,expectedRevision:0,operationId:'op-429'}];
assert.equal((await verifyLikeR2Readiness429(readyR2,uid,request)).ready,true);
readyItems.delete(preflightCard);
await assert.rejects(verifyLikeR2Readiness429(readyR2,uid,request),
  /429_CARD_COLD_BEFORE_D1/);
readyItems.set(preflightCard,{schemaVersion:1,card:{id,likeCount:0}});
readyItems.get(preflightKey).canonicalComplete156=false;
await assert.rejects(verifyLikeR2Readiness429(readyR2,uid,request),
  /429_PRIVATE_PARTIAL_BEFORE_D1/);
readyItems.get(preflightKey).canonicalComplete156=true;
readyItems.get(preflightKey).likedTrackIds=
  Array.from({length:2000},(_,i)=>'existing-track-'+i);
readyItems.get(preflightKey).exactLikeCount156=2000;
await assert.rejects(verifyLikeR2Readiness429(readyR2,uid,request),
  /431_BATCH_MEMBERSHIP_CAPACITY/);
readyItems.get(preflightKey).likedTrackIds=[];
readyItems.get(preflightKey).exactLikeCount156=0;
readyItems.get(preflightKey).likeRevisions423=Object.fromEntries(
  Array.from({length:2000},(_,i)=>['r'+i,{revision:1,
    operationId:'op-'+i,liked:false}]));
await assert.rejects(verifyLikeR2Readiness429(readyR2,uid,request),
  /431_REVISION_METADATA_CAPACITY/);
readyItems.get(preflightKey).likeRevisions423={};
readyItems.delete(preflightPopular);
await assert.rejects(verifyLikeR2Readiness429(readyR2,uid,request),
  /429_FEED_COLD_BEFORE_D1/);
console.log('429_PREWRITE_PRIVATE_CARD_FEED_COLD_AND_PARTIAL_GUARDS=PASS');
console.log('429_PREWRITE_GUARDS_HAVE_NO_D1_MUTATIONS=PASS');

import assert from 'node:assert/strict';
import {createPersonalLikeR2Publisher423} from '../cloudflare/explore-worker/runtime/like-personal-r2-publisher-423.mjs';

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
console.log('423_PARTIAL_COLD_CATALOG_FAIL_CLOSED_NO_USER_BACKFILL=PASS');

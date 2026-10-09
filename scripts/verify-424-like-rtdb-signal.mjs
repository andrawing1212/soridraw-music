import assert from 'node:assert/strict';
import {createLikeUserRtdbSignal424} from '../cloudflare/explore-worker/runtime/like-rtdb-user-signal-424.mjs';
const uid='test-424';
let state=null,etag=1,getCount=0,putCount=0,race=true,deny=false;
const fake={
  async run(url,request){
    // This fixture checks no credentials leaked to logs; auth belongs only
    // in the URL passed to Firebase, never in caller-facing errors.
    assert.equal(url.startsWith('https://soridraw-app-866a5-default-rtdb.firebaseio.com/userSync/'+uid+'/exploreLike.json?auth='),true);
    assert.equal(url.includes('token-seen-by-fixture'),true);
    if(request.method==='GET'){
      getCount++;
      return {ok:true,status:200,headers:{get:k=>k.toLowerCase()==='etag'?'e'+etag:null},
        async json(){return state;}};
    }
    assert.equal(request.method,'PUT');
    putCount++;
    if(deny)return {ok:false,status:403};
    if(race){race=false;etag++;return {ok:false,status:412};}
    if(request.headers['if-match']!=='e'+etag)return {ok:false,status:412};
    state=JSON.parse(request.body);etag++;
    return {ok:true,status:200};
  },
};
assert.throws(()=>createLikeUserRtdbSignal424({}),/424_VERIFIED_UID_AND_FIREBASE_ID_TOKEN_REQUIRED/);
const publish=createLikeUserRtdbSignal424({
  authenticatedUid:uid,firebaseIdToken:'token-seen-by-fixture',
  fetchImpl:(url,opts)=>fake.run(url,opts),now:()=>424000,
});
await assert.rejects(publish({uid:'different',trackId:'song',ownerUid:'owner',liked:true,
  likeCount:1,revision:1}),/424_AUTH_UID_OR_SIGNAL_INVALID/);
assert.equal(putCount,0);
let out=await publish({uid,trackId:'song',ownerUid:'owner',liked:true,
  likeCount:1,revision:1});
assert.equal(out.queued,true);
assert.equal(state.version,424000);
assert.equal(state.previousVersion,0);
assert.deepEqual(state.results,[{
  trackId:'song',ownerUid:'owner',liked:true,likeCount:1,canonicalSettled417:true,
}]);
assert.equal(putCount,2);
// The legacy RTDB schema lacks operationId/revision, so identical payload
// MUST NOT be treated as proof of identical accepted mutation. A second real
// same-state click may need its own notification (even if counts cancel out).
out=await publish({uid,trackId:'song',ownerUid:'owner',liked:true,
  likeCount:1,revision:2});
assert.equal(out.queued,true);
assert.equal(putCount,3);
assert.equal(state.previousVersion,424000);
assert.equal(state.version,424001);
out=await publish({uid,trackId:'song',ownerUid:'owner',liked:false,
  likeCount:0,revision:3});
assert.equal(state.previousVersion,424001);
assert.equal(state.version,424002);
assert.equal(out.queued,true);
deny=true;
await assert.rejects(publish({uid,trackId:'song',ownerUid:'owner',liked:true,
  likeCount:1,revision:4}),/424_RTDB_SIGNAL_NOT_PERSISTED/);
assert.equal(state.results[0].liked,false);
console.log('424_EXACT_EXISTING_FIREBASE_RULES_SIGNAL_SCHEMA=PASS');
console.log('424_VERIFIED_UID_BOUNDARY_AND_ETAG_RACE_RETRY=PASS');
console.log('424_EQUAL_PAYLOAD_NEW_REVISION_STILL_SIGNALS_AND_DENIED_NO_ACK=PASS');
console.log('424_REAL_FIREBASE_EXTERNAL_SIGNAL=NOT_TESTED');
console.log('424_DIRECT_RTDB_WRITE_ON_PREVIEW=DISABLED');

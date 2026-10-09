// Stage432 source-only: bounded per-song cold-card recovery, NO remote D1.
import assert from 'node:assert/strict';
import {recoverVerifiedColdCard432 as recover} from '../cloudflare/explore-worker/runtime/like-cold-public-card-432.mjs';
import {verifyLikeR2Readiness429} from '../cloudflare/explore-worker/runtime/like-batch-composition-422.mjs';

const song='track432', uid='user432';
const cardKey='internal/explore/shared-track-card-v115/'+song+'.json';
const sample={
  id:song,owner_uid:'owner432',owner_nickname:'Creator',owner_avatar_url:'',
  title:'A real shared track',cover_url:'cover',suno_url_primary:'media',
  suno_url_secondary:'',published_at:3,profile_pinned:0,
  like_count:4,generation:2,
};
const privateKey='internal/explore/shared-social-v114/likes/'+uid+'.json';
const feeds=['latest','popular'].map(sort=>'internal/explore/shared-feed-v112/'+sort+'-40.json');
const fixture=(initial={})=>{
  const store=new Map(Object.entries(initial));
  let d1Reads=0,d1Writes=0,r2Writes=0,sqlText='';
  let snapshot={...sample};
  const db={
    prepare(sql){
      sqlText=sql;
      if(!sql.includes('WHERE t.id=?')||!sql.includes('LIMIT 1')||
         !sql.includes('explore_like_count_deltas_171'))
        throw Error('432_UNBOUNDED_OR_LEGACY_COUNT_QUERY');
      return{bind(id){
        return{async first(){
          d1Reads++;
          assert.equal(id,song);
          return snapshot;
        }};
      }};
    },
  };
  let conflict=false;
  const r2={
    async get(k){
      const body=store.get(k);
      return body===undefined?null:{etag:'verified',text:async()=>JSON.stringify(body)};
    },
    async put(k,body,opts){
      assert.equal(k,cardKey);
      assert.equal(opts?.onlyIf?.etagDoesNotMatch,'*');
      if(conflict || store.has(k))return null;
      store.set(k,JSON.parse(body));r2Writes++;
      return{etag:'published'};
    },
  };
  return{db,r2,store,
    setRow:value=>{snapshot=value;},race:()=>{conflict=true;},
    counts:()=>({d1Reads,d1Writes,r2Writes}),query:()=>sqlText};
};
{
  const x=fixture();
  await assert.rejects(recover({db:x.db,sharedR2:x.r2,trackId:song}),
    /432_SHARED_WRITER_FREEZE_REQUIRED/);
  assert.deepEqual(x.counts(),{d1Reads:0,d1Writes:0,r2Writes:0});
}
{
  const x=fixture();
  const result=await recover({db:x.db,sharedR2:x.r2,trackId:song,
    cutoverVerified:true,now:()=>432000});
  assert.equal(result.status,'created');
  const body=x.store.get(cardKey);
  assert.equal(body.schemaVersion,1);
  assert.equal(body.card.likeCount,4);
  assert.equal(body.card.likeGeneration421,2);
  assert.equal(body.card.title,sample.title);
  assert.equal(body.card.ownerUid,sample.owner_uid);
  assert.match(x.query(),/t\.is_public=1/);
  assert.equal((await recover({db:x.db,sharedR2:x.r2,trackId:song,
    cutoverVerified:true})).status,'exists');
  assert.deepEqual(x.counts(),{d1Reads:1,d1Writes:0,r2Writes:1});
}
{
  const x=fixture();
  x.setRow(null);
  await assert.rejects(recover({db:x.db,sharedR2:x.r2,trackId:song,
    cutoverVerified:true}),/432_PUBLIC_TRACK_NOT_CANONICALLY_VERIFIED/);
  assert.deepEqual(x.counts(),{d1Reads:1,d1Writes:0,r2Writes:0});
}
{
  const x=fixture();
  x.setRow({...sample,like_count:-1});
  await assert.rejects(recover({db:x.db,sharedR2:x.r2,trackId:song,
    cutoverVerified:true}),/432_CANONICAL_COUNT_OR_GENERATION_INVALID/);
  assert.equal(x.counts().r2Writes,0);
}
{
  const x=fixture();
  x.setRow({...sample,title:''});
  await assert.rejects(recover({db:x.db,sharedR2:x.r2,trackId:song,
    cutoverVerified:true}),/432_PUBLIC_TRACK_DATA_INCOMPLETE/);
  assert.equal(x.counts().r2Writes,0);
}
{
  const x=fixture();
  x.race();
  await assert.rejects(recover({db:x.db,sharedR2:x.r2,trackId:song,
    cutoverVerified:true}),/432_COLD_CARD_CAS_RETRY_REQUIRED/);
  assert.equal(x.counts().r2Writes,0);
}
{
  const initial={
    [privateKey]:{schemaVersion:1,uid,canonicalComplete156:true,
      canonicalSource156:'verified',likedTrackIds:[],exactLikeCount156:0},
  };
  for(const key of feeds)initial[key]={payload:{data:{items:[]}}};
  const x=fixture(initial);
  const result=await verifyLikeR2Readiness429(x.r2,uid,
    [{trackId:song,liked:true}],{db:x.db,cutoverVerified:true});
  assert.equal(result.ready,true);
  assert.equal(x.store.get(cardKey).card.likeCount,4);
  assert.deepEqual(x.counts(),{d1Reads:1,d1Writes:0,r2Writes:1});
  // A warm revisit must be R2-only. No extra canonical D1 query.
  await verifyLikeR2Readiness429(x.r2,uid,[{trackId:song,liked:true}],
    {db:x.db,cutoverVerified:true});
  assert.equal(x.counts().d1Reads,1);
  x.store.delete(feeds[0]);
  await assert.rejects(verifyLikeR2Readiness429(x.r2,uid,
    [{trackId:song,liked:true}],{db:x.db,cutoverVerified:true}),
    /429_FEED_COLD_BEFORE_D1/);
  assert.equal(x.counts().d1Writes,0);
}
console.log('432_INDEXED_SINGLE_PUBLIC_TRACK_AND_OVERLAY_COUNT=PASS');
console.log('432_CAS_COLD_BOOTSTRAP_AND_WARM_D1_R0=PASS');
console.log('432_BAD_TRACK_OR_NO_PROOF_FAILS_BEFORE_CANONICAL_WRITE=PASS');
console.log('432_429_INTEGRATION_WITHOUT_SHARED_D1_MUTATION=PASS');

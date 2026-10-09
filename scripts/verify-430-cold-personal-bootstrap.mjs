// Stage430: no live backend mutation. All catalog and DB state below are local.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {bootstrapVerifiedEmptyPrivate430 as bootstrap} from '../cloudflare/explore-worker/runtime/like-cold-personal-bootstrap-430.mjs';
import {verifyLikeR2Readiness429} from '../cloudflare/explore-worker/runtime/like-batch-composition-422.mjs';
function fixture({index=true}={}){
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE likes(track_id TEXT NOT NULL,user_uid TEXT NOT NULL,PRIMARY KEY(track_id,user_uid));
    CREATE TABLE explore_like_overrides_171(user_uid TEXT NOT NULL,track_id TEXT NOT NULL,liked INTEGER,revision INTEGER,PRIMARY KEY(user_uid,track_id)) WITHOUT ROWID;`);
  if(index)sqlite.exec('CREATE INDEX idx_like_uid430 ON likes(user_uid)');
  let writes=0;
  const db={prepare(sql){return{bind(...args){return{
    async first(){return sqlite.prepare(sql).get(...args)||null;},
    async all(){return {results:sqlite.prepare(sql).all(...args)};},
  }}}}};
  const storage=new Map();
  const r2={
    async get(k){const x=storage.get(k);return x?{
      etag:x.etag,text:async()=>JSON.stringify(x.payload),
    }:null;},
    async put(k,raw,opts){
      if(opts?.onlyIf?.etagDoesNotMatch==='*'&&storage.has(k))return null;
      if(opts?.onlyIf?.etagMatches&&storage.get(k)?.etag!==opts.onlyIf.etagMatches)return null;
      writes++;
      const value={etag:'e'+writes,payload:JSON.parse(raw)};
      storage.set(k,value);return {etag:value.etag};
    },
  };
  const seed=(k,payload)=>storage.set(k,{etag:'seed',payload});
  return{sqlite,db,r2,seed,storage,writes:()=>writes};
}
const uid='u';
const key='internal/explore/shared-social-v114/likes/u.json';
const args=x=>({db:x.db,r2:x.r2,uid,cutoverVerified:true,now:()=>123});
{
  const x=fixture();
  await assert.rejects(bootstrap({db:x.db,r2:x.r2,uid}),/430_SHARED_CUTOVER_NOT_VERIFIED/);
  assert.equal(x.writes(),0);x.sqlite.close();
}
{
  const x=fixture();
  x.sqlite.exec("INSERT INTO likes VALUES('song','u')");
  await assert.rejects(bootstrap(args(x)),/430_LEGACY_LIKES_REQUIRE_EXACT_RECOVERY/);
  assert.equal(x.writes(),0);x.sqlite.close();
}
{
  const x=fixture();
  x.sqlite.exec("INSERT INTO explore_like_overrides_171 VALUES('u','song',0,5)");
  await assert.rejects(bootstrap(args(x)),/430_OVERLAY_REVISIONS_REQUIRE_EXACT_RECOVERY/);
  assert.equal(x.writes(),0);x.sqlite.close();
}
{
  const x=fixture({index:false});
  await assert.rejects(bootstrap(args(x)),/430_INDEXED_USER_PROBE_REQUIRED/);
  assert.equal(x.writes(),0);x.sqlite.close();
}
{
  const x=fixture();
  assert.equal((await bootstrap(args(x))).status,'created');
  const value=JSON.parse(await(await x.r2.get(key)).text());
  assert.deepEqual(value.likedTrackIds,[]);
  assert.equal(value.canonicalComplete156,true);
  assert.equal(value.exactLikeCount156,0);
  assert.equal((await bootstrap(args(x))).status,'exists');
  assert.equal(x.writes(),1);x.sqlite.close();
}
{
  const x=fixture();
  x.seed(key,{schemaVersion:1,uid,likedTrackIds:['old'],canonicalComplete156:false});
  assert.equal((await bootstrap(args(x))).status,'exists');
  assert.equal(x.writes(),0);
  assert.deepEqual(JSON.parse(await(await x.r2.get(key)).text()).likedTrackIds,['old']);
  x.sqlite.close();
}
{
  const x=fixture();
  x.seed('internal/explore/shared-track-card-v115/song.json',{schemaVersion:1,card:{id:'song'}});
  x.seed('internal/explore/shared-feed-v112/latest-40.json',{payload:{data:{items:[]}}});
  x.seed('internal/explore/shared-feed-v112/popular-40.json',{payload:{data:{items:[]}}});
  const result=await verifyLikeR2Readiness429(x.r2,uid,[{trackId:'song',liked:true}],{
    db:x.db,cutoverVerified:true,
  });
  assert.equal(result.ready,true);
  assert.equal(JSON.parse(await(await x.r2.get(key)).text()).exactLikeCount156,0);
  assert.equal(x.writes(),1);
  // Once a partial catalog exists it must never be reinterpreted as empty.
  x.seed(key,{schemaVersion:1,uid,likedTrackIds:['old'],canonicalComplete156:false});
  await assert.rejects(verifyLikeR2Readiness429(x.r2,uid,[{trackId:'song',liked:true}],{
    db:x.db,cutoverVerified:true,
  }),/429_PRIVATE_PARTIAL_BEFORE_D1/);
  assert.equal(x.writes(),1);x.sqlite.close();
}
console.log('430_COLD_EMPTY_BOOTSTRAP_AND_INTEGRATED_PREFLIGHT=PASS');
console.log('430_EXISTING_LEGACY_OR_OVERLAY_PROTECTED=PASS');
console.log('430_UNINDEXED_FULL_SCAN_FORBIDDEN=PASS');
console.log('430_NO_CANONICAL_D1_WRITES=PASS');

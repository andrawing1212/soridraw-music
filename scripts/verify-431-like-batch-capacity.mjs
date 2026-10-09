// Stage431 regression: a multi-like batch cannot partly commit canonical D1
// simply because each item individually fitted the original personal R2 cap.
// Pure fixtures only. NEVER writes to shared Cloudflare/Firebase.
import assert from 'node:assert/strict';
import {verifyLikeBatchCatalogCapacity431 as verify} from '../cloudflare/explore-worker/runtime/like-batch-capacity-431.mjs';
import {verifyLikeR2Readiness429} from '../cloudflare/explore-worker/runtime/like-batch-composition-422.mjs';
const catalog=(likedCount=0,revisionCount=0)=>({
  schemaVersion:1,uid:'u',canonicalComplete156:true,
  canonicalSource156:'verified-test',exactLikeCount156:likedCount,
  likedTrackIds:Array.from({length:likedCount},(_,i)=>'t'+i),
  likeRevisions423:Object.fromEntries(Array.from({length:revisionCount},(_,i)=>[
    'r'+i,{revision:0,liked:false,operationId:'prior-'+i},
  ])),
});
const entry=(id,liked=true)=>({trackId:id,liked});
const expectCode=(fn,code)=>assert.throws(fn,e=>e?.code===code);
{
  const c=catalog(1999);
  const saved=JSON.stringify(c);
  expectCode(()=>verify(c,[entry('new-a'),entry('new-b')]),'431_BATCH_MEMBERSHIP_CAPACITY');
  assert.equal(JSON.stringify(c),saved,'preflight must not modify source');
}
{
  const c=catalog(2000);
  expectCode(()=>verify(c,[entry('new-a'),entry('t0',false)]),'431_BATCH_MEMBERSHIP_CAPACITY');
  assert.equal(verify(c,[entry('t0',false),entry('new-a')]).projectedLikedCount,2000);
}
{
  const c=catalog(1999);
  const good=verify(c,[entry('new-a'),entry('t0',false),entry('new-b')]);
  assert.deepEqual([good.projectedLikedCount,good.projectedRevisionKeys],[2000,3]);
}
{
  const c=catalog(0,1999);
  expectCode(()=>verify(c,[entry('new-a'),entry('new-b')]),'431_REVISION_METADATA_CAPACITY');
  assert.equal(verify(c,[entry('new-a')]).projectedRevisionKeys,2000);
}
{
  const c=catalog(0,2000);
  expectCode(()=>verify(c,[entry('new-a')]),'431_REVISION_METADATA_CAPACITY');
  assert.equal(verify(c,[entry('r0')]).projectedRevisionKeys,2000);
}
{
  const c=catalog();
  expectCode(()=>verify(c,[entry('a'),entry('a',false)]),'431_INVALID_OR_DUPLICATED_TRACK');
  const unusual=verify(c,[entry('__proto__')]);
  assert.equal(unusual.projectedLikedCount,1,'prototype-looking key is a normal track ID');
}

{
  const c=catalog(1999);
  const obj={schemaVersion:1,uid:'u',canonicalComplete156:true,
    canonicalSource156:'fixture',likedTrackIds:c.likedTrackIds,
    exactLikeCount156:c.likedTrackIds.length,likeRevisions423:{}};
  let gets=0;
  const r2={get:async key=>{gets++;return key.endsWith('/u.json')
    ? {text:async()=>JSON.stringify(obj)} : null;}};
  await assert.rejects(
    verifyLikeR2Readiness429(r2,'u',[entry('new-a'),entry('new-b')]),
    /431_BATCH_MEMBERSHIP_CAPACITY/,
  );
  assert.equal(gets,1,'must reject before public R2 lookups or any D1 write');
}
console.log('431_BATCH_CAPACITY_ALL_ENTRIES_PREWRITE=PASS');
console.log('431_SEQUENTIAL_OVERFLOW_AND_METADATA_GUARD=PASS');
console.log('431_INTEGRATED_429_PREFLIGHT=PASS');

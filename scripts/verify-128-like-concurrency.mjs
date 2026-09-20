import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const generatedPath = process.env.SORIDRAW_GENERATED_WORKER;
assert.ok(generatedPath, 'Provide dry-run generated Worker; do not use live Worker');
const worker = readFileSync(generatedPath, 'utf8');
const service = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const patch72 = readFileSync('cloudflare/explore-worker/patches/072-personal-like-r2-revision.mjs', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));
const portableWorker = process.env.SORIDRAW_VERIFY_PORTABLE === '1';

for (const marker of [
  ...portableWorker ? [] : ['SORIDRAW_PERSONAL_LIKE_R2_REVISION_072_20260920'],
  'SORIDRAW_SERVER_ORDER_LIKE_QUEUE_073_20260920',
  'SORIDRAW_PERSONAL_LIKE_R2_CAS_074_20260920',
]) assert.ok(worker.includes(marker), 'missing '+marker);
assert.equal(Number(version.version),126, 'do not bump app before authorized release');
assert.match(patch72,/bucket\.head\(exploreSharedLikesKey061\(authContext\.uid\)\)/);
assert.doesNotMatch(patch72,/bucket\.head\(exploreLikeR2Key\(authContext\.uid\)\)/);

const fnStart=worker.indexOf('async function exploreLikeW1Batch040(');
const fnEnd=worker.indexOf('\n}',fnStart);
assert.ok(fnStart>0 && fnEnd>fnStart);
const queued=worker.slice(fnStart,fnEnd+2);
assert.match(queued,/const batchAt = fallbackAt;/);
assert.doesNotMatch(queued,/batchAt = Math\.max\(fallbackAt, \.\.\.canonical/);
assert.match(queued,/mutationAt: Math\.max\(1, Math\.floor\(Number\(row\.mutationAt/);
assert.match(queued,/String\(batchAt\)\.padStart\(13, '0'\)/);
const agg=worker.slice(worker.indexOf('function exploreLikeAggregateSnapshotCte039('),worker.indexOf('async function processExploreLikeAggregateWave035('));
assert.match(agg,/ORDER BY created_at DESC, batch_id DESC, queue_kind DESC/);

const start=worker.indexOf('const EXPLORE_LIKE_R2_TRACK_ORDER_LIMIT_074');
const end=worker.indexOf('async function syncExploreLikeR2AfterBatch034(',start);
assert.ok(start>0 && end>start);
const handler=worker.slice(start,end);
const build=new Function('exploreSharedLikesKey061','syncExploreLikeR2AfterBatch034',
  handler+'; return {compareLikeOrder074, syncExploreLikeR2AfterBatch074};');
const {compareLikeOrder074, syncExploreLikeR2AfterBatch074: sync}=
  build((uid)=>'shared/'+uid,async()=>{throw Error('unexpected cold fallback')});
assert.equal(compareLikeOrder074({at:100,batchId:'a'},{at:200,batchId:'b'}),-1);
assert.equal(compareLikeOrder074({at:200,batchId:'z'},{at:200,batchId:'b'}),1);

const mockStore=(initIds=[], race=true, initialOrders={})=>{
  let body={schemaVersion:1,uid:'test-uid',likedTrackIds:initIds,lastLikeOrders074:initialOrders};
  let revision=1,gets=0,puts=0,rejected=0;
  let deferredFirstGet=null;
  const barrier=(releaseFirst=true)=>({
    async get(key){
      assert.equal(key,'shared/test-uid');
      gets++;
      const observed=revision;
      const snapshot=JSON.stringify(body);
      if(gets===1 && releaseFirst)await new Promise(resolve=>{deferredFirstGet=resolve;});
      else if(gets===2 && deferredFirstGet){deferredFirstGet();}
      return {etag:'etag-'+observed,text:async()=>snapshot};
    },
    async put(key,contents,opts){
      assert.equal(key,'shared/test-uid');
      if(opts?.onlyIf?.etagMatches!=='etag-'+revision){rejected++;return null;}
      body=JSON.parse(contents);
      revision++;
      puts++;
      return {etag:'etag-'+revision};
    },
  });
  return {env:{PROFILE_MEDIA:barrier(race)},get state(){return body;},get puts(){return puts;},get rejected(){return rejected;},get gets(){return gets;}};
};
const row=(id,liked)=>[{trackId:id,liked}];

// Older accepted request cannot undo a later request, even when its R2 read and
// conditional write finish after the newer one.
{
  const store=mockStore();
  await Promise.all([
    sync(store.env,'test-uid',row('song',true),200,'b'),
    sync(store.env,'test-uid',row('song',false),100,'a'),
  ]);
  assert.deepEqual(store.state.likedTrackIds,['song']);
  assert.ok(store.rejected>=1,'CAS conflict must be retried');
  assert.deepEqual(store.state.lastLikeOrders074.song,{at:200,batchId:'b'});
}
// Opposite desired state on later server receipt wins.
{
  const store=mockStore();
  await Promise.all([
    sync(store.env,'test-uid',row('song',true),100,'a'),
    sync(store.env,'test-uid',row('song',false),200,'b'),
  ]);
  assert.deepEqual(store.state.likedTrackIds,[]);
  assert.deepEqual(store.state.lastLikeOrders074.song,{at:200,batchId:'b'});
}
// Different tracks do not block one another.
{
  const store=mockStore();
  await Promise.all([
    sync(store.env,'test-uid',row('song-a',true),200,'b'),
    sync(store.env,'test-uid',row('song-b',true),100,'a'),
  ]);
  assert.deepEqual(new Set(store.state.likedTrackIds),new Set(['song-a','song-b']));
}
// Same token: idempotent. One actor's unlike must preserve another actor's
// public count, which is not derived from this private shared R2 cache.
{
  const store=mockStore([],false);
  await sync(store.env,'test-uid',row('song',true),100,'a');
  const firstPuts=store.puts;
  await sync(store.env,'test-uid',row('song',true),100,'a');
  assert.equal(store.puts,firstPuts,'same token must not rewrite shared R2');
  const updated=store.state;
  assert.ok(updated.likedTrackIds.includes('song'));
  assert.match(service,/computeExploreLikeAction127/);
}
// Delayed ACK of an older device must not claim the final R2 state.
// It may be persisted in D1's queue, but cannot be broadcast as confirmed.
{
  const store=mockStore([],false);
  const newer=await sync(store.env,'test-uid',row('song',true),200,'b');
  assert.equal(newer.ok,true);
  const writes=store.puts;
  const old=await sync(store.env,'test-uid',row('song',false),100,'a');
  assert.equal(old.ok,false,'superseded response must not be confirmed');
  assert.equal(old.reason,'superseded_like_batch');
  assert.equal(store.puts,writes,'older ACK must not rewrite R2');
  assert.deepEqual(store.state.likedTrackIds,['song']);
}
// Mixed batch: accept the independent new song but do not announce the whole
// request as confirmed when another ID lost a cross-device race.
{
  const store=mockStore([],false);
  await sync(store.env,'test-uid',row('song',true),200,'b');
  const result=await sync(store.env,'test-uid',[
    {trackId:'song',liked:false},{trackId:'another',liked:true}
  ],100,'a');
  assert.equal(result.ok,false);
  assert.equal(result.reason,'partially_superseded_like_batch');
  assert.deepEqual(new Set(store.state.likedTrackIds),new Set(['song','another']));
}
// Cold account, full user bundle and full conflict history must not fall
// back to an unconditional shared R2 overwrite or silently drop any liked ID.
{
  let writes=0;
  const cold={PROFILE_MEDIA:{
    get:async()=>null,
    put:async()=>{writes++; throw Error('cold write forbidden');},
  }};
  const result=await sync({PROFILE_MEDIA:cold.PROFILE_MEDIA},'test-uid',row('song',true),100,'a');
  assert.deepEqual(result,{ok:false,repairNeeded:true,reason:'shared_r2_cold_requires_canonical_rebuild'});
  assert.equal(writes,0);
}
{
  const ids=Array.from({length:2000},(_,i)=>'existing-'+i);
  const store=mockStore(ids,false);
  const result=await sync(store.env,'test-uid',row('new',true),101,'n');
  assert.equal(result.ok,false,'full user bundle is not authoritative for absence');
  assert.equal(result.reason,'shared_r2_capacity_requires_canonical_rebuild');
  assert.equal(store.puts,0);
  assert.deepEqual(store.state.likedTrackIds,ids,'no existing like may be truncated');
}
{
  const orders=Object.fromEntries(Array.from({length:128},(_,i)=>[
    'seen-'+i,{at:i+1,batchId:'a'}
  ]));
  const store=mockStore(['seen-0'],false,orders);
  const result=await sync(store.env,'test-uid',row('new',true),300,'n');
  assert.equal(result.ok,false);
  assert.equal(result.reason,'shared_r2_order_capacity_requires_canonical_rebuild');
  assert.equal(store.puts,0);
  assert.deepEqual(store.state.lastLikeOrders074,orders,'do not forget an ordering token');
  assert.deepEqual(store.state.likedTrackIds,['seen-0']);
}
assert.match(handler,/EXPLORE_LIKE_R2_TRACK_ORDER_LIMIT_074 = 128/);
assert.match(handler,/onlyIf: \{ etagMatches: object\.etag \}/);
assert.doesNotMatch(handler,/env\.DB\.prepare\(|caches\.default/);
// The CAS engine remains testable, but an intake ACK must NOT call it before
// canonical D1 materialization. This is only stage one of settlement; release
// remains blocked until a verified post-aggregate finalizer exists.
const intakeStart138=worker.indexOf('async function handleLikeBatch034(');
const intakeEnd138=worker.indexOf('\\n}',intakeStart138);
assert.ok(intakeStart138>0 && intakeEnd138>intakeStart138);
const intake138=worker.slice(intakeStart138,intakeEnd138+2);
assert.match(intake138,/SORIDRAW_LIKE_PRECOMMIT_R2_BLOCK_138_20260921/);
assert.match(intake138,/awaiting_canonical_d1_settlement/);
assert.match(intake138,/personalLikeSnapshot: 'pending'/);
assert.doesNotMatch(intake138,/personalLikeSnapshot: 'updated'|personalLikeSnapshot: 'settled'/);
assert.doesNotMatch(intake138,/syncExploreLikeR2AfterBatch074\\(|syncExploreLikeR2AfterBatch034\\(/);
assert.match(intake138,/await enqueueExploreLikeBatch035\\(/);
console.log('138_PRECOMMIT_R2_WRITE_SUPPRESSED=PASS');
console.log('138_QUEUE_ACK_PENDING_ONLY=PASS');
console.log('074_SERVER_RECEIPT_BEATS_DEVICE_CLOCK=PASS');
console.log('074_CONCURRENT_SAME_TRACK_LAST_SERVER_ORDER=PASS');
console.log('074_CONCURRENT_DISTINCT_TRACKS_MERGED=PASS');
console.log('074_SHARED_UID_R2_CAS_NO_D1_WRITE=PASS');
console.log('074_LEGACY_SHARED_HEAD_CORRECT=PASS');
console.log('074_SUPERSEDED_ACK_NO_FALSE_CONFIRMED_SIGNAL=PASS');
console.log('074_COLD_FULL_AND_ORDER_CAP_FAIL_CLOSED_NO_DATA_LOSS=PASS');
console.log('074_QUEUE_ACK_SEPARATED_FROM_PERSONAL_SNAPSHOT=PASS');
console.log('074_NO_LIVE_DATA_WRITE=PASS');
if (portableWorker) console.log('074_PORTABLE_FROZEN_WORKER_TEST=PASS');

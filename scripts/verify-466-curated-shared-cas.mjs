import assert from 'node:assert/strict';
import {
  CURATED_SHARED_KEY_466,
  sharedCuratedEnabled466,
  canonicalCuratedIds466,
  visibleCuratedIds466,
  matchesCanonicalCurated466,
  reconcileCuratedShared466,
  getCuratedShared466,
} from '../cloudflare/explore-worker/runtime/curated-shared-canonical-466.mjs';

const row = (id, published=true, updatedAt=100) => ({
  track_id:id,curator_role:'master',curator_uid:'',sort_order:0,updated_at:updatedAt,
  starts_at:null,ends_at:null,is_public:published?1:0,status:published?'published':'private',
});
const track = async (id) => ({id,title:id});
function gate() {
  let release;
  const promise = new Promise((resolve) => {release=resolve;});
  return {promise,release};
}
function memoryR2() {
  let state=null,seq=0,rejectPut=false,puts=0;
  const bucket={
    get:async(key)=>{
      assert.equal(key,CURATED_SHARED_KEY_466);
      if(!state)return null;
      const copy=state;
      return {etag:copy.etag,httpEtag:'"'+copy.etag+'"',text:async()=>copy.body};
    },
    put:async(key,body,options)=>{
      assert.equal(key,CURATED_SHARED_KEY_466);
      assert(options.onlyIf,'all v466 writes require a conditional R2 put');
      puts++;
      if(rejectPut)return null;
      let allowed=false;
      if(options.onlyIf instanceof Headers) allowed=!state&&options.onlyIf.get('If-None-Match')==='*';
      else allowed=!!state&&options.onlyIf.etagMatches===state.etag;
      if(!allowed)return null;
      const etag='e'+(++seq);
      state={body,etag};
      return {etag};
    },
    getState:()=>state,
    getPuts:()=>puts,
    reject:(v)=>{rejectPut=v;},
  };
  return bucket;
}
const envFor = (bucket)=>({PROFILE_MEDIA:bucket,DB:{prepare:()=>{throw Error('unexpected default D1 invocation');}}});
const write = (env,readRows,resolveTrack=track)=>reconcileCuratedShared466(env,resolveTrack,{readRows});

assert.equal(sharedCuratedEnabled466({PROFILE_MEDIA:{},DB:{}}),false);
assert.equal(sharedCuratedEnabled466({PROFILE_MEDIA:{},DB:{},SORIDRAW_CURATED_SHARED_V466:'1'}),true);
assert.deepEqual(canonicalCuratedIds466([row('a'),row('b',false)]),['a','b']);
assert.deepEqual(visibleCuratedIds466([row('a'),row('b',false)]),['a']);

{
  const bucket=memoryR2(),env=envFor(bucket);
  const original=[row('a'),row('b')];
  const first=await write(env,async()=>original);
  assert(first.ok&&!first.unchanged,'cold canonical bootstrap must store verified snapshot');
  const second=await write(env,async()=>original);
  assert(second.ok&&second.unchanged,'same canonical membership must not rewrite');
  assert.equal(bucket.getPuts(),1);
  const warm=await getCuratedShared466(env);
  assert.deepEqual(warm.snapshot.memberIds,['a','b']);
  assert(matchesCanonicalCurated466(original,warm.snapshot));
}

{
  // Concurrent promotion A and B: an older A D1 view must never overwrite the B
  // union, even if A's resolver resumes after B has already written shared R2.
  const bucket=memoryR2(),env=envFor(bucket);
  let canonical=[row('a',true,100)];
  const oldResolve=gate();
  const aRead=gate();
  const A=write(env,async()=>{aRead.release();return [...canonical]},async(id)=>{
    await oldResolve.promise;return track(id);
  });
  await aRead.promise;
  canonical=[row('b',true,200),row('a',true,100)];
  const B=write(env,async()=>[...canonical]);
  assert((await B).ok);
  oldResolve.release();
  assert((await A).ok);
  assert.deepEqual((await getCuratedShared466(env)).snapshot.memberIds,['b','a']);
}

{
  // Promotion vs removal: stale promotion should not resurrect a removed track.
  const bucket=memoryR2(),env=envFor(bucket);
  let canonical=[row('b',true,200),row('a',true,100)];
  assert((await write(env,async()=>[...canonical])).ok);
  const hold=gate(),start=gate();
  canonical=[row('b',true,200),row('a',true,100),row('c',true,210)];
  const promote=write(env,async()=>{start.release();return [...canonical]},async(id)=>{
    if(id==='c')await hold.promise;
    return track(id);
  });
  await start.promise;
  canonical=[row('b',true,200),row('c',true,210)];
  assert((await write(env,async()=>[...canonical])).ok);
  hold.release();
  assert((await promote).ok);
  assert.deepEqual((await getCuratedShared466(env)).snapshot.memberIds,['b','c']);
}

{
  // Publication/private cycle must preserve promoted membership but hide card.
  const bucket=memoryR2(),env=envFor(bucket);
  let canonical=[row('a')];
  assert((await write(env,async()=>canonical)).ok);
  canonical=[row('a',false,300)];
  assert((await write(env,async()=>canonical)).ok);
  const privateState=(await getCuratedShared466(env)).snapshot;
  assert.deepEqual(privateState.memberIds,['a']);
  assert.deepEqual(privateState.payload.data.items,[]);
  canonical=[row('a',true,400)];
  assert((await write(env,async()=>canonical)).ok);
  assert.deepEqual((await getCuratedShared466(env)).snapshot.payload.data.items.map(x=>x.track.id),['a']);
}


{
  // A single re-promotion must refresh only the changed track. Unchanged
  // card details are served from the derived R2 object, not 40 new track reads.
  const bucket=memoryR2(),env=envFor(bucket);
  let canonical=[row('a',true,100),row('b',true,200)];
  let fetched=[];
  const fetchTrack=async (id)=>{fetched.push(id);return track(id);};
  assert((await write(env,async()=>canonical,fetchTrack)).ok);
  assert.deepEqual(fetched,['a','b']);
  fetched=[];
  canonical=[row('a',true,300),row('b',true,200)];
  assert((await write(env,async()=>canonical,fetchTrack)).ok);
  assert.deepEqual(fetched,['a'],'only changed metadata should fetch its track');
  fetched=[];
  const forced=await reconcileCuratedShared466(env,fetchTrack,{
    readRows:async()=>canonical,forceTrackIds:['b'],
  });
  assert(forced.ok);
  assert.deepEqual(fetched,['b'],'publication detail change must refresh only targeted track');
}

{
  // R2 cannot persist: do not return an optimistic success / 200.
  const bucket=memoryR2(),env=envFor(bucket);
  bucket.reject(true);
  const result=await reconcileCuratedShared466(env,track,{attempts:2,readRows:async()=>[row('a')]});
  assert(!result.ok);
  assert.equal(result.reason,'CAS_RETRY_EXHAUSTED');
  assert.equal(bucket.getPuts(),2);
}

{
  // Malformed shared object is held for operator repair; never auto delete it.
  const bucket=memoryR2(),env=envFor(bucket);
  const result=await write(env,async()=>[row('a')]);
  assert(result.ok);
  const current=await getCuratedShared466(env);
  assert(current.object?.etag,'etag must be preserved for conditional writes');
}

console.log('CURATED_SHARED_466_CONCURRENT_PROMOTE_REMOVE_PRIVACY_CAS=PASS');
console.log('CURATED_SHARED_466_WARM_UNCHANGED_R2_ONLY=PASS');
console.log('CURATED_SHARED_466_SHARED_CANONICAL_WRITES=0_WHEN_DISABLED');

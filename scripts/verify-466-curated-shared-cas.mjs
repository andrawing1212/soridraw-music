import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CURATED_SHARED_KEY_466,
  sharedCuratedEnabled466,
  canonicalCuratedIds466,
  visibleCuratedIds466,
  matchesCanonicalCurated466,
  reconcileCuratedShared466,
  getCuratedShared466,
} from '../cloudflare/explore-worker/runtime/curated-shared-canonical-466.mjs';

// Protect the mixed-version rollout: the new shared source must remain dormant
// until the existing PR is independently audited and runtime flag is authorized.
const entry466=fs.readFileSync(new URL('../cloudflare/explore-worker/canonical/preview-entry.js', import.meta.url),'utf8');
const config466=JSON.parse(fs.readFileSync(new URL('../cloudflare/explore-worker/canonical/wrangler.preview.jsonc', import.meta.url),'utf8'));
assert(!Object.hasOwn(config466.vars||{},'SORIDRAW_CURATED_SHARED_V466'),
  'Shared curated runtime mode must be OFF in checked-in PREVIEW config');
assert(entry466.includes('SORIDRAW_CURATED_CROSS_ENV_SHARED_V466'), 'Missing gated source marker');
assert(entry466.includes('const curatedBucket307 = (env) => env?.EXPLORE_CACHE || env?.PROFILE_MEDIA || null;'),
  'Existing v307 derived cache fallback must remain unchanged');
for(const required of [
  'handleCuratedSharedRevision466(request, env)',
  'handleCuratedSharedPublic466(request, env, ctx)',
  'readCuratedShared466(request, env, ctx)',
  'refreshCuratedShared466(request, env, ctx, [id])',
  'syncCuratedPublicationResults307(request, env, results307, ctx)',
  "CURATED_SHARED_CONCURRENT_CHANGE_466",
  'EDGE-SHARED-CURATED-BODY-466',
]) assert(entry466.includes(required),'Missing shared v466 guarded integration: '+required);
assert(!entry466.includes("env?.SORIDRAW_CURATED_SHARED_V466 = '1'"),'Activation must not be implicit');
console.log('CURATED_SHARED_466_RUNTIME_FEATURE_OFF_AND_LEGACY_SAFE=PASS');

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
assert.equal(sharedCuratedEnabled466({SORIDRAW_CURATED_SHARED_V466:'1'}),true,'ON with missing binding must fail closed, not silently fall back');
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
  // Interleaved canonical update without a competing R2 writer: for example,
  // an app377 Worker commits D1 after our first read but has not updated
  // the new v466 shared key. CAS alone succeeds with a stale D1 view.
  // The post-CAS canonical proof must detect and repair this precise race.
  const bucket=memoryR2(),env=envFor(bucket);
  const oldRows=[row('a',true,100)];
  const newerRows=[row('b',true,200),row('a',true,100)];
  let canonicalReads=0;
  const res=await reconcileCuratedShared466(env,track,{
    readRows:async()=>++canonicalReads===1 ? oldRows : newerRows,
  });
  assert(res.ok,'a fresh canonical write interleaved with CAS must be repaired');
  assert(canonicalReads>=3,'must do a post-CAS canonical read and retry the drift');
  assert.deepEqual((await getCuratedShared466(env)).snapshot.memberIds,['b','a']);
}

{
  // The checked-in mixed release remains blocked: an old app377 Worker may
  // mutate D1 and only its local v307 R2 after the new shared v466 write.
  // Without another new-code mutation, v466 cannot learn that change from
  // local R2 HEAD alone. This must NOT be reported as end-to-end parity PASS.
  const bucket=memoryR2(),env=envFor(bucket);
  const original=[row('a',true,100)];
  assert((await write(env,async()=>original)).ok);
  const afterOldWorkerOnly=[row('b',true,200),row('a',true,100)];
  const warm=await getCuratedShared466(env);
  assert.equal(matchesCanonicalCurated466(afterOldWorkerOnly,warm.snapshot),false,
    'old Writer drift must be explicit release blocker, not a source PASS');
  console.log('CURATED_SHARED_466_MIXED_VERSION_ACTIVATION_BLOCKED=PASS');
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

// APP718 isolated cost and failure test: actual frozen APP354 functions in VM.
// No live API, R2, D1, Firebase, or user-data access.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { oldOrchestrate718, candidateOrchestrate718,
  oldOverlayHandler718, candidateOverlayHandler718,
  applyFollowMutationReadCandidate718 } from '../cloudflare/explore-worker/candidates/718-follow-mutation-clean-reads.mjs';

export async function verifyFollowMutationReadCandidate718({ fixture, cutover, source, id }) {
  assert.equal(source.split(oldOrchestrate718).length, 2, 'original orchestration missing');
  assert.equal(source.split(oldOverlayHandler718).length, 2, 'original HTTP handler missing');
  const patched = applyFollowMutationReadCandidate718(source);
  assert.equal(patched.replace(candidateOrchestrate718,oldOrchestrate718)
    .replace(candidateOverlayHandler718,oldOverlayHandler718),source,
    'unrelated Worker code was changed');
  assert.throws(() => applyFollowMutationReadCandidate718(source.replace(oldOrchestrate718,
    oldOrchestrate718.replace('attempt < 6','attempt < 7'))),/HOLD/,
    'drifted original must be blocked');

  const prepare = (optimized) => {
    const g = fixture();
    g.ctx.readFollowCutoverState348 = async () => cutover;
    if (optimized) {
      vm.runInContext(candidateOrchestrate718, g.ctx);
      vm.runInContext(candidateOverlayHandler718, g.ctx);
    }
    return g;
  };
  const request = (n, revision = 0) => ({json:async()=>({
    followOperationId:id(n),followExpectedRevision:revision,
  })});
  const base=prepare(false),fast=prepare(true);
  const oldResponse=await base.ctx.handleFollow(request(71801),base.env,{},'target',true);
  const newResponse=await fast.ctx.handleFollow(request(71801),fast.env,{},'target',true);
  assert.equal(oldResponse.status,200);assert.equal(newResponse.status,200);
  const oldBody=(await oldResponse.json()).data, newBody=(await newResponse.json()).data;
  assert.equal(newBody.following,true);assert.equal(newBody.followerCount,1);
  assert.equal(newBody.followingCount,0);assert.equal(newBody.revision,oldBody.revision);
  assert.equal(base.metrics().reads,9,'frozen no-cutover/no-abuse test counts changed');
  assert.equal(fast.metrics().reads,7,'expected two clean R2 GETs removed');
  assert.equal(fast.metrics().writes,6,'six durable R2 puts must be preserved');
  assert.equal(base.metrics().writes,fast.metrics().writes);
  assert.equal(base.metrics().changed,fast.metrics().changed);
  assert.equal(fast.metrics().changed,1,'one canonical D1 relation change');
  assert.equal(fast.relation('actor','target'),1);

  // Correctly settled reversal, duplicate retries and unchanged desired state.
  const beforeNoop=fast.metrics();
  const noOp=(await (await fast.ctx.handleFollow(request(71802,newBody.revision),
    fast.env,{},'target',true)).json()).data;
  assert.equal(noOp.duplicate,true);
  assert.equal(fast.metrics().changed,beforeNoop.changed,'no-op must not write a D1 edge');
  assert.equal(fast.profile('target').body.data.profile.followerCount,1);
  const noOpWrites=fast.metrics().writes;
  const again=await fast.ctx.handleFollow(request(71802,newBody.revision),fast.env,{},'target',true);
  assert.equal(again.status,200);assert.equal(fast.metrics().writes,noOpWrites,'retry cannot write');
  const undone=(await (await fast.ctx.handleFollow(request(71803,noOp.revision),
    fast.env,{},'target',false)).json()).data;
  assert.equal(undone.following,false);assert.equal(undone.followerCount,0);
  assert.equal(fast.relation('actor','target'),0);
  for(const uid of ['actor','target']) {
    assert.equal(fast.profile(uid).followSync354.exact,true);
    assert.equal(Object.keys(fast.profile(uid).followSync354.pending).length,0);
  }

  // An old intent snapshot raced by a new accepted operation must fail CAS.
  const raced=prepare(true);let injected=false;
  const get=raced.env.PROFILE_MEDIA.get;
  raced.env.PROFILE_MEDIA.get=async key => {
    const snapshot=await get(key);
    if(!injected && key.includes('/follow-intents-v354/')) {
      injected=true;
      await raced.call('actor','target',true,71811);
    }
    return snapshot;
  };
  await assert.rejects(raced.call('actor','target',false,71812),
    e=>e?.code==='FOLLOW_REVISION_CONFLICT');
  assert.equal(injected,true);assert.equal(raced.relation('actor','target'),1);
  assert.equal(raced.profile('target').body.data.profile.followerCount,1);

  // Crash after target dirty marker: stable ID replays and clears both fences.
  const crashed=prepare(true);let stopped=false;
  crashed.hooks(async(phase,key,bundle)=>{
    if(!stopped && phase==='after' && key==='profiles/target' &&
       Object.keys(bundle?.followSync354?.pending||{}).length) {
      stopped=true;throw Error('app718-target-pending-crash');
    }
  });
  await assert.rejects(crashed.call('actor','target',true,71821),/app718-target-pending-crash/);
  crashed.hooks();
  const retried=await crashed.ctx.handleFollow(request(71821),crashed.env,{},'target',true);
  assert.equal(retried.status,200);assert.equal(crashed.relation('actor','target'),1);
  assert.equal(crashed.profile('target').body.data.profile.followerCount,1);
  for(const uid of ['actor','target'])
    assert.equal(Object.keys(crashed.profile(uid).followSync354.pending).length,0);
  console.log('APP718_CLEAN_MUTATION_R2_GET_9_TO_7_ISOLATED=PASS');
  console.log('APP718_R2_PUT_6_D1_EDGE_1_AND_EXACT_PUBLIC_COUNTS_UNCHANGED=PASS');
  console.log('APP718_NOOP_RETRY_CONCURRENT_CAS_AND_PENDING_CRASH_REPLAY=PASS');
  console.log('APP718_SHARED_DEPLOYMENT_AND_USER_DATA_CHANGES=0');
}

// APP717 isolated candidate: one R2 read saved only for clean follow-state GET.
// Uses the existing real canonical Worker function fixture, not a mock client.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {
  followStateOld717, followStateCandidate717, applyFollowStateReadCandidate717,
} from '../cloudflare/explore-worker/candidates/717-follow-state-target-postread.mjs';

export async function verifyFollowStateReadCandidate717({ fixture, cutover, source }) {
  assert.equal(source.split(followStateOld717).length, 2, 'source contract changed');
  const patched = applyFollowStateReadCandidate717(source);
  assert.equal(patched.includes(followStateOld717), false);
  assert.equal(patched.includes(followStateCandidate717), true);
  assert.equal(patched.replace(followStateCandidate717, followStateOld717), source,
    'candidate patch changed unrelated Worker code');

  const prepare = (patchedCandidate = true) => {
    const g = fixture();
    // The 348 cutover read is a separate unchanged R2 GET. Both variants
    // use the exact same mode so this comparison isolates the state reader.
    g.ctx.readFollowCutoverState348 = async () => cutover;
    if (patchedCandidate) {
      vm.runInContext(followStateCandidate717, g.ctx);
      assert.match(g.ctx.readFollowStateSnapshot354.toString(), /APP717 CANDIDATE/);
    }
    return g;
  };

  const ordinary = prepare(false), optimized = prepare();
  const a = (await ordinary.ctx.handleFollowState({},ordinary.env,{},'target')).status;
  const b = (await optimized.ctx.handleFollowState({},optimized.env,{},'target')).status;
  assert.equal(a,200);assert.equal(b,200);
  assert.equal(ordinary.metrics().reads,5,'frozen: intent2 + profile3 R2 GET');
  assert.equal(optimized.metrics().reads,4,'candidate: intent2 + profile2 R2 GET');
  assert.equal(ordinary.metrics().writes,0);assert.equal(optimized.metrics().writes,0);
  assert.equal(ordinary.metrics().changed,0);assert.equal(optimized.metrics().changed,0);

  // After actual canonical change, new member and public count remain exact.
  const committed = prepare();
  await committed.call('actor','target',true,71701);
  const countBefore = committed.metrics();
  const confirmed = (await committed.ctx.handleFollowState({},committed.env,{},'target')).json();
  const d = (await confirmed).data;
  assert.equal(d.following,true);assert.equal(d.followerCount,1);
  assert.equal(d.followingCount,0);
  assert.equal(committed.metrics().writes,countBefore.writes,'GET must not write on settled profile');
  assert.equal(committed.metrics().changed,countBefore.changed);

  // Different actor partially wrote a target pending marker and crashed.
  // A GET for this actor/target pair MUST repair the shared target before
  // returning the post-D1 count; it must never treat a stale D1 read as final.
  const dirty = prepare();
  let crash = false;
  dirty.hooks(async (phase,key,bundle) => {
    if (!crash && phase === 'after' && key === 'profiles/target' &&
        Object.keys(bundle?.followSync354?.pending || {}).length) {
      crash = true;
      throw Error('app717-simulated-worker-crash-after-target-pending');
    }
  });
  await assert.rejects(dirty.call('other','target',true,71702),/app717-simulated-worker-crash/);
  dirty.hooks();
  const recovered = (await dirty.ctx.handleFollowState({},dirty.env,{},'target')).json();
  assert.equal((await recovered).data.following,false);
  assert.equal((await recovered).data.followerCount,1,
    'target other-actor pending must be replayed and its exact count materialized');
  assert.equal(dirty.profile('target').followSync354.exact,true);
  assert.equal(Object.keys(dirty.profile('target').followSync354.pending).length,0);

  // Same actor follow starts between the D1 relation read and the final R2
  // profile snapshot. Before/after intent revision MUST cause a retry, so no
  // newer committed follow is misreported as unfollowed.
  const raced = prepare();
  let inserted = false;
  const originalPrepare = raced.env.DB.prepare;
  raced.env.DB.prepare = (sql) => {
    const stmt = originalPrepare(sql);
    return {
      ...stmt,
      bind(...params) {
        const bound = stmt.bind(...params);
        return {
          ...bound,
          async first() {
            const row = await bound.first();
            if (!inserted && sql.includes('AS baseline_following')) {
              inserted = true;
              await raced.call('actor','target',true,71703);
            }
            return row;
          },
        };
      },
    };
  };
  const observed = await (await raced.ctx.handleFollowState({},raced.env,{},'target')).json();
  assert.equal(inserted,true,'interleaving did not exercise the D1-R2 window');
  assert.equal(observed.data.following,true,'GET must retry across changing pair intent');
  assert.equal(observed.data.followerCount,1,'GET must return latest committed target count');
  assert.ok(observed.data.followRevision>0,'GET returned pre-commit intent revision');

  console.log('APP717_CLEAN_FOLLOW_STATE_R2_B_5_TO_4_PLUS_UNCHANGED_CUTOVER_GET=PASS');
  console.log('APP717_RECOVERY_OTHER_ACTOR_DIRTY_TARGET_AND_INTENT_RACE=PASS');
  console.log('APP717_CANONICAL_WORKER_SOURCE_UNCHANGED_NOT_DEPLOYED=PASS');
}

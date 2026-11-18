// APP719: original APP354 VM function + actual SQLite PK/lookup plan.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { oldFollowMembership719,candidateFollowMembership719,applyFollowMembershipCandidate719 }
 from '../cloudflare/explore-worker/candidates/719-follow-membership-single-overlay-read.mjs';

export async function verifyFollowMembershipCandidate719({fixture,cutover,source}) {
  const patched=applyFollowMembershipCandidate719(source);
  assert.equal(patched.replace(candidateFollowMembership719,oldFollowMembership719),
    source,'unrelated Worker source mutated');
  assert.throws(()=>applyFollowMembershipCandidate719(source.replace(
    oldFollowMembership719,oldFollowMembership719.replace('baselineFollowing','baselineFollowingX'))),/HOLD/);
  const prepare=(optimized,shape='none')=>{
    const g=fixture();
    if(shape==='baseline'||shape==='tombstone')
      g.db.prepare('INSERT INTO follows(follower_uid,following_uid,created_at) VALUES(?,?,?)')
        .run('actor','target',10);
    if(['positive','negative','tombstone'].includes(shape))
      g.db.prepare('INSERT INTO explore_follow_overrides_348(follower_uid,following_uid,following,baseline_following,updated_at,mutation_id) VALUES(?,?,?,?,?,?)')
        .run('actor','target',shape==='negative'?0:1,shape==='tombstone'?1:0,735719,'operation-719-tombstone');
    if(optimized)vm.runInContext(candidateFollowMembership719,g.ctx);
    let query='';
    const prepareOriginal=g.env.DB.prepare;
    g.env.DB.prepare=(sql)=>{
      if(sql.includes('AS baseline_following'))query=sql;
      return prepareOriginal(sql);
    };
    return {g,query:()=>query};
  };
  const clean=v=>JSON.parse(JSON.stringify(v));
  for(const shape of ['none','baseline','positive','negative','tombstone']){
    const old=prepare(false,shape),next=prepare(true,shape);
    const a=await old.g.ctx.readEffectiveFollowMembership348(old.g.env,'actor','target',cutover);
    const b=await next.g.ctx.readEffectiveFollowMembership348(next.g.env,'actor','target',cutover);
    assert.deepEqual(clean(b),clean(a),'same result '+shape);
    const planA=old.g.db.prepare('EXPLAIN QUERY PLAN '+old.query())
      .all('actor','target','actor','target','actor','target','actor','target');
    const planB=next.g.db.prepare('EXPLAIN QUERY PLAN '+next.query())
      .all('actor','target','actor','target');
    const lookups=p=>p.filter(row=>String(row.detail||'').includes('SEARCH o USING PRIMARY KEY')).length;
    assert.equal(lookups(planA),3,'original SQL must look up overlay three times');
    assert.equal(lookups(planB),1,'APP719 SQL must look up overlay once');
    assert.ok(planB.some(row=>String(row.detail).includes('SEARCH follows USING')),
      'legacy baseline index lookup retained');
    assert.ok(!planB.some(row=>/SCAN explore_follow_overrides_348/.test(String(row.detail))),
      'full overlay scan forbidden');
    assert.equal(next.g.metrics().writes,0);
    assert.equal(next.g.metrics().changed,0);
  }
  for(const optimized of [false,true]){
    const {g}=prepare(optimized);
    assert.equal((await g.ctx.readEffectiveFollowMembership348(g.env,'','target',cutover)).mode,'legacy');
    assert.equal((await g.ctx.readEffectiveFollowMembership348(
      g.env,'actor','legacy',{mode:'legacy'})).following,true);
    assert.equal(g.metrics().writes,0);
  }
  const old=prepare(false).g, fast=prepare(true).g;
  const a=await old.call('actor','target',true,71901),
        b=await fast.call('actor','target',true,71901);
  assert.deepEqual(clean(b),clean(a));
  assert.equal(fast.profile('target').body.data.profile.followerCount,1);
  assert.equal(fast.metrics().writes,old.metrics().writes,'R2 writes unchanged');
  assert.equal(fast.metrics().changed,old.metrics().changed,'D1 rows written unchanged');
  const c=await old.call('actor','target',true,71902,a.revision),
        d=await fast.call('actor','target',true,71902,b.revision);
  assert.equal(c.duplicate,true);assert.equal(d.duplicate,true);
  assert.equal(fast.metrics().writes,old.metrics().writes);
  assert.equal(fast.metrics().changed,old.metrics().changed);
  const e=await old.call('actor','target',false,71903,c.revision),
        f=await fast.call('actor','target',false,71903,d.revision);
  assert.deepEqual(clean(f),clean(e));
  assert.equal(fast.relation('actor','target'),0);
  assert.equal(fast.profile('target').body.data.profile.followerCount,0);
  assert.equal(fast.metrics().writes,old.metrics().writes);
  assert.equal(fast.metrics().changed,old.metrics().changed);
  const crash=prepare(true).g;
  let stopped=false;
  crash.hooks(async (phase,key,bundle)=>{
    if(!stopped&&phase==='after'&&key==='profiles/target'&&
       Object.keys(bundle?.followSync354?.pending||{}).length){
      stopped=true;throw Error('app719-simulated-worker-crash');
    }
  });
  await assert.rejects(crash.call('actor','target',true,71911),/app719-simulated-worker-crash/);
  crash.hooks();
  await crash.call('actor','target',true,71911);
  assert.equal(crash.relation('actor','target'),1);
  assert.equal(crash.profile('target').body.data.profile.followerCount,1);
  for(const uid of ['actor','target'])
    assert.equal(Object.keys(crash.profile(uid).followSync354.pending).length,0);
  console.log('APP719_INDEXED_OVERLAY_PK_SEARCH_3_TO_1_ALL_SHAPES=PASS');
  console.log('APP719_FOLLOW_UNFOLLOW_DUPLICATE_LEGACY_TOMBSTONE_AND_CRASH=PASS');
  console.log('APP719_D1_AND_R2_WRITES_UNCHANGED=PASS');
  console.log('APP719_LIVE_D1_ROWS_READ_UNMEASURED');
}

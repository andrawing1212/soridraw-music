// APP562: isolated actual canonical v354 R2 phase and late-crash cost proof.
// NO shared Worker, user data, D1/R2, Firebase or Cloudflare account writes.
// Exact canonical function declarations are provided by verify-354 fixture.
import assert from 'node:assert/strict';
import {fixture,cutover,id} from './verify-354-follow-orchestration.mjs';
import {trySettleCompletedFollowIntent562,APP562_R2_REPLAY_FAST_SETTLE_COMPILED_OPEN}
 from '../cloudflare/explore-worker/candidates/562-follow-r2-replay-fast-settle.mjs';
assert.equal(APP562_R2_REPLAY_FAST_SETTLE_COMPILED_OPEN,false);
const candidate=(f,operation,enabled=true)=>trySettleCompletedFollowIntent562({
 env:f.env,operation,cutover,enabled,
 readProfile:(env,uid,cutover)=>f.ctx.readFollowProfile354(env,uid,cutover),
 readMembership:(env,actor,target,cutover)=>
  f.ctx.readEffectiveFollowMembership348(env,actor,target,cutover),
 readIntent:(env,cutover,actor,target)=>
  f.ctx.readFollowIntent354(env,cutover,actor,target),
});
const measures=(before,after)=>({
 r2Put:after.writes-before.writes,r2Get:after.reads-before.reads,
 d1Changed:after.changed-before.changed,
});
const categories=(entries)=>entries.reduce((o,x)=>{
 const group=x.key.startsWith('profiles/')?'profile':'pair-intent';
 o[group]=(o[group]||0)+1;return o;
},{});
const phases=[];
const f=fixture();
f.hooks(async(phase,key,payload)=>{
 if(phase==='after')phases.push({key,settled:payload?.settled??null,
 pending:payload?.followSync354?.pending?
   Object.keys(payload.followSync354.pending).length:null});
});
let before=f.metrics();
const first=await f.call('actor','target',true,901);
const normal=measures(before,f.metrics());
assert.equal(first.duplicate,false);
assert.equal(normal.r2Put,6,'changed follow: intent start/end + two endpoint pending/delta');
assert.deepEqual(categories(phases),{'pair-intent':2,profile:4});
assert.equal(f.relation('actor','target'),1);
console.log('APP562_FROZEN_CHANGED_FOLLOW_R2_BUDGET='+JSON.stringify({
 normal,phases:categories(phases),
}));
before=f.metrics();phases.length=0;
assert.equal((await f.call('actor','target',true,901)).duplicate,true);
assert.equal(measures(before,f.metrics()).r2Put,0);
console.log('APP562_EXISTING_EXACT_OPERATION_RETRY_R2_W0=PASS');
before=f.metrics();phases.length=0;
const noop=await f.call('actor','target',true,902,first.revision);
const noopDelta=measures(before,f.metrics());
assert.equal(noop.duplicate,true);
assert.equal(noopDelta.r2Put,1,'new noop operation still requires a monotonic pair receipt');
assert.equal(noopDelta.d1Changed,0);
console.log('APP562_FROZEN_NEW_NOOP_R2_BUDGET='+JSON.stringify(noopDelta));
before=f.metrics();phases.length=0;
const remove=await f.call('actor','target',false,903,noop.revision);
const unfollow=measures(before,f.metrics());
assert.equal(remove.duplicate,false);
assert.equal(unfollow.r2Put,6);
console.log('APP562_FROZEN_CHANGED_UNFOLLOW_R2_BUDGET='+JSON.stringify(unfollow));
const makeCrash=()=>{
 const fixtureObj=fixture();let crashed=false;
 const pair=fixtureObj.ctx.followIntentKey354(cutover.cutoverToken,'actor','target');
 fixtureObj.hooks(async(phase,key,payload)=>{
  if(!crashed&&phase==='before'&&key===pair&&payload.settled===true){
   crashed=true;throw Error('APP562_CRASH_POST_BOTH_PROFILE_COUNT_UPDATES');
  }
 });
 return {f:fixtureObj,pair};
};
async function beforeReceiptCrash(){
 const {f:caseFile,pair}=makeCrash();
 const before=caseFile.metrics();
 await assert.rejects(caseFile.call('actor','target',true,911),
 /APP562_CRASH_POST_BOTH_PROFILE_COUNT_UPDATES/);
 const partial=measures(before,caseFile.metrics());
 assert.equal(partial.r2Put,5);
 assert.equal(caseFile.profile('actor').followSync354.exact,true);
 assert.equal(caseFile.profile('target').followSync354.exact,true);
 assert.equal(Object.keys(caseFile.profile('target').followSync354.pending).length,0);
 assert.equal(caseFile.relation('actor','target'),1);
 assert.equal(JSON.parse(caseFile.records.get(pair).body).settled,false);
 caseFile.hooks();
 return {f:caseFile,pair,partial};
}
const old=await beforeReceiptCrash(),oldBefore=old.f.metrics();
const oldRes=await old.f.call('actor','target',true,911);
assert.equal(oldRes.duplicate,true);
const legacyReplay=measures(oldBefore,old.f.metrics());
assert.equal(legacyReplay.r2Put,5,'frozen recovery dirties and rewrites two profiles again');
assert.equal(JSON.parse(old.f.records.get(old.pair).body).settled,true);
const fast=await beforeReceiptCrash(),fastBefore=fast.f.metrics();
const fastOp=JSON.parse(fast.f.records.get(fast.pair).body);
const fastCandidate=await candidate(fast.f,fastOp);
assert.equal(fastCandidate.settled,true);
assert.equal(fastCandidate.r2Writes,1);
const fastResult=await fast.f.call('actor','target',true,911);
assert.equal(fastResult.duplicate,true);
const newReplay=measures(fastBefore,fast.f.metrics());
assert.equal(newReplay.r2Put,1,
 'isolated candidate only settles receipt when two profiles exact and D1 agrees');
assert.equal(fast.f.relation('actor','target'),1);
assert.equal(fast.f.profile('target').body.data.profile.followerCount,1);
assert.equal(JSON.parse(fast.f.records.get(fast.pair).body).settled,true);
assert.equal(newReplay.d1Changed,0);
console.log('APP562_LATE_CRASH_R2_REPLAY_OPTIMIZED='+JSON.stringify({
 oldReplay:legacyReplay,newReplay,
 savedR2Put:legacyReplay.r2Put-newReplay.r2Put,
 oldTotal:old.partial.r2Put+legacyReplay.r2Put,
 newTotal:fast.partial.r2Put+newReplay.r2Put,
}));
const noGate=await beforeReceiptCrash(),noGateBefore=noGate.f.metrics();
await noGate.f.ctx.orchestrateFollowOverlay354(
 noGate.f.env,'actor','target',true,id(911),0,cutover);
assert.equal(measures(noGateBefore,noGate.f.metrics()).r2Put,legacyReplay.r2Put,
 'all live eight-argument calls MUST follow original repair path');
console.log('APP562_DEFAULT_OFF_ORIGINAL_CANONICAL_RECOVERY_UNCHANGED=PASS');
// A previous operation whose D1 edge is not current cannot settle on R2 alone.
const dirty=await beforeReceiptCrash();
const actorBundle=dirty.f.profile('actor');
actorBundle.followSync354.pending.someNewChange={id:'other_pending'};
dirty.f.records.get('profiles/actor').body=JSON.stringify(actorBundle);
const operation=JSON.parse(dirty.f.records.get(dirty.pair).body);
let beforeDirty=dirty.f.metrics();
assert.equal((await candidate(dirty.f,operation)).settled,false);
assert.equal(measures(beforeDirty,dirty.f.metrics()).r2Put,0);
console.log('APP562_DIRTY_PROFILE_FENCE_NO_EARLY_SETTLEMENT=PASS');
const wrong=await beforeReceiptCrash();
const wrongOp=JSON.parse(wrong.f.records.get(wrong.pair).body);
const edge=wrong.f.db.prepare('UPDATE explore_follow_overrides_348 SET following=0 WHERE follower_uid=? AND following_uid=?')
 .run('actor','target');
assert.equal(edge.changes,1);
const wrongBefore=wrong.f.metrics();
assert.equal((await candidate(wrong.f,wrongOp)).settled,false);
assert.equal(measures(wrongBefore,wrong.f.metrics()).r2Put,0);
console.log('APP562_D1_MEMBERSHIP_MISMATCH_NEVER_PUBLISHES_OR_SETTLES=PASS');
assert.equal((await candidate(wrong.f,wrongOp,false)).status,'disabled');
console.log('APP562_SOURCE_ONLY_CANDIDATE_NOT_LIVE=PASS');

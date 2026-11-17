// APP713 trusted canonical adapter: mocked dependencies, no D1/R2 writes.
import assert from 'node:assert/strict';
import {commitTrustedFollow713,APP713_TRUSTED_CANONICAL_COMPILED_OPEN}
 from '../cloudflare/explore-worker/runtime/owner-follow-trusted-canonical-713.mjs';
assert.equal(APP713_TRUSTED_CANONICAL_COMPILED_OPEN,false);
const env={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_FOLLOW_SERVER_CLICK_713:'1',
 SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653:'1',
 SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653:'preview-only'};
const cutover={mode:'overlay348',readOnly:false,cutoverToken:'test-token'};
let intent=null,following=false,precommit=0,actualWrites=0,reads=0;
const args={
 enabled:true,authorized:true,env,
 actorUid:'actor',ownerUid:'owner',desired:true,
 operationId:'click713_operation_000000000000000',issuedAtSec:1000,
 verifyActor:async()=>true,
 readCutover:async()=>{reads++;return cutover},
 readIntent:async()=>({value:intent}),
 readMembership:async()=>({mode:'overlay348',following}),
 reserve:async()=>({ok:true,status:'reserved',generation:1}),
 runPrecommit:async a=>{
  precommit++;
  assert.equal((await a.authenticate()).uid,'actor');
  const payload=await a.request.clone().json();
  assert.ok(/^click713_[A-Za-z0-9_-]+$/.test(payload.followOperationId));
  assert.equal(payload.followExpectedRevision,intent?.id===payload.followOperationId?
    intent.expectedRevision:intent?.revision||0);
  return a.callCanonical(a.request);
 },
 callCanonical:async a=>{
  actualWrites++;
  assert.equal(a.actorUid,'actor');
  assert.equal(a.ownerUid,'owner');
  assert.equal(a.desired,true);
  const p=await a.request.json();
  const rev=(intent?.revision||0)+1;
  following=true;
  intent={id:p.followOperationId,expectedRevision:p.followExpectedRevision,
   revision:rev,actor:'actor',target:'owner',following:true,settled:true};
  return Response.json({ok:true,data:{uid:'owner',following:true,
   revision:rev,duplicate:false}});
 },
};
const request=overrides=>commitTrustedFollow713({...args,...overrides});
assert.equal((await request({enabled:false})).status,'disabled');
assert.equal((await request({authorized:false})).status,'private-capability-required');
assert.equal((await request({env:{...env,SORIDRAW_ENVIRONMENT:'prod'}})).status,'disabled');
assert.equal((await request({ownerUid:'actor'})).status,'invalid-operation');
assert.equal(actualWrites,0);
assert.equal((await request({verifyActor:async()=>false})).status,'actor-current-auth-unverified');
assert.equal(reads,0,'revoked user must not read canonical data');
const committed=await request();
assert.equal(committed.ok,true);
assert.equal(committed.canonicalFollowing,true);
assert.equal(committed.changed,true);
assert.equal(precommit,1);
assert.equal(actualWrites,1);
const previousReads=reads;
assert.equal((await request()).status,'noop','retry after commit must never write twice');
assert.equal(actualWrites,1,'canonical retry does not consume another D1/R2 write');
assert.ok(reads>previousReads);
assert.equal((await request({operationId:'click713_new_operation_00000000000000'})).status,'noop');
assert.equal(precommit,1,'same-state change is W0');
// Other device changed the relation. Old operation may not replay it.
following=false;
assert.equal((await request()).status,'operation-superseded');
assert.equal(precommit,1);
following=true;
assert.equal((await request({
 readIntent:async()=>({value:{...intent,settled:false}})})).status,'canonical-intent-unsettled');
assert.equal((await request({
 readCutover:async()=>({...cutover,readOnly:true})})).status,'canonical-writer-not-ready');
assert.equal((await request({
 readMembership:async()=>{throw Error('D1 offline')}
})).status,'canonical-state-unavailable');
assert.equal((await request({
 desired:false,operationId:'click713_unfollow_operation_000000000',
 callCanonical:async()=>Response.json({ok:false,status:'writer-unknown'},{status:503})
})).status,'canonical-write-unconfirmed');
assert.equal(precommit,2,'changed false branch calls precommit exactly once');
console.log('APP713_TRUSTED_PRIVATE_CANONICAL_WITH_APP711_FENCE=PASS');
console.log('APP713_W0_REPLAY_OR_SAMESTATE_NO_D1_R2_WRITE=PASS');
console.log('APP713_PROD_READONLY_UNCERTAIN_ACK_FAIL_CLOSED=PASS');

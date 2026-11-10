// APP557 exact pair-intent proof guards formerly unsafe APP556 replay.
import assert from 'node:assert/strict';
import {deliverOwnerFollowPostcommit555,replayOwnerFollowReservation556,
 APP555_OWNER_POSTCOMMIT_W2_COMPILED_OPEN}
 from '../cloudflare/explore-worker/runtime/owner-follow-postcommit-555.mjs';
assert.equal(APP555_OWNER_POSTCOMMIT_W2_COMPILED_OPEN,false);
const epoch='0123456789abcdef0123456789abcdef';
const operationId='op_1234567890abcdef';
const cutoverToken='token557';
const c={r2:0,d1:0,send:0};
let version=18,exact=true,manifestReady=true,intentReady=true,matching=true,dbEpoch=epoch;
const env={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',
 SORIDRAW_OWNER_FOLLOW_HMAC_539:'APP557-LOCAL-INERT-NOT-A-RELEASE-SECRET-12345',
 SORIDRAW_OWNER_FOLLOW_ENDPOINT_539:'https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542',
 PROFILE_MEDIA:{get:async key=>{
  c.r2++;
  if(key==='internal/explore/follow-cutover-v348/active.json'){
   if(!manifestReady)return null;
   return {text:async()=>JSON.stringify({relationMode:'overlay348',writeMode:'active',
    cutoverToken,profileCountsR2Exact:true,crashConsistentWriter354:true,
    orderedClientRequests354:true,oneWayAuthority348:true,
    legacyRelationWritersFrozen:true,legacyCounterWritersFrozen:true})};
  }
  if(key.startsWith('internal/explore/follow-intents-v354/')){
   if(!intentReady)return null;
   assert.equal(key,`internal/explore/follow-intents-v354/${cutoverToken}/B/A.json`);
   return {text:async()=>JSON.stringify({token:cutoverToken,actor:'B',target:'A',
    id:matching?operationId:'other_operation_12345678',
    following:true,expectedRevision:4,revision:8,settled:true})};
  }
  assert.equal(key,'internal/explore/shared-profile-v113/A.json');
  return {text:async()=>JSON.stringify({revision:version,
   body:{data:{profile:{uid:'A',followerCount:4}}},
   followSync354:{token:cutoverToken,exact,pending:{}}})};
 }},
 DB:{prepare:()=>({bind:()=>({first:async()=>{c.d1++;return {epoch:dbEpoch}}})})}};
const req=new Request('https://x.test/v1/profiles/A/follow',{method:'PUT'});
const response=new Response(JSON.stringify({ok:true,data:{
 uid:'A',following:true,duplicate:false,revision:12}}),{
 headers:{'X-Soridraw-Follow-Protocol':'354'}});
const send=async()=>{c.send++;return {ok:true,status:200,json:async()=>({ok:true,applied:true})}};
const ticket={ownerUid:'A',actorUid:'B',authEpoch:epoch,operationId,
 expectedRevision:4,cutoverToken,desired:true,beforeFollowing:false,
 priorR2Revision:18};
const replay=async(r=ticket,transport=send)=>replayOwnerFollowReservation556({
 reservation:r,env,send:transport,enabled:true});
assert.equal((await deliverOwnerFollowPostcommit555({request:req,response,env,send,enabled:true})).status,'delivered');
const sent=c.send;
assert.equal((await replay()).status,'r2-not-advanced');
assert.equal(c.send,sent);
version=19;matching=false;
assert.equal((await replay()).status,'intent-not-matching');
assert.equal(c.send,sent,'unrelated R2 revision MUST NOT notify owner');
matching=true;intentReady=false;
assert.equal((await replay()).status,'intent-not-present');
assert.equal(c.send,sent);
intentReady=true;manifestReady=false;
assert.equal((await replay()).status,'cutover-unavailable');
assert.equal(c.send,sent);
manifestReady=true;dbEpoch='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
assert.equal((await replay()).status,'rejected-generation');
assert.equal(c.send,sent);
dbEpoch=epoch;exact=false;
assert.equal((await replay()).status,'r2-unsettled');
exact=true;
assert.equal((await replay()).status,'delivered');
let fails=0;
assert.equal((await replay(ticket,async()=>{fails++;throw Error('503')})).status,'relay-failed');
assert.equal(fails,2);
const before={...c};
assert.equal((await replay({...ticket,operationId:'bad'})).status,'invalid-reservation');
assert.equal((await replay({...ticket,beforeFollowing:true})).status,'invalid-reservation');
assert.equal(c.send,before.send);
assert.equal((await replayOwnerFollowReservation556({reservation:ticket,env,send})).status,'disabled');
assert.equal((await replayOwnerFollowReservation556({reservation:ticket,env:{...env,SORIDRAW_ENVIRONMENT:'test'},send,enabled:true})).status,'disabled');
console.log('APP557_EXACT_COMMITTED_PAIR_AND_CUTOVER_REPLAY_GUARD=PASS');
console.log('APP557_NO_UNRELATED_PROFILE_REVISION_FALSE_OWNER_SIGNAL=PASS');
console.log('APP557_PREVIEW_ONLY_AUTH_EPOCH_FENCE=PASS;LIVE=NO_GO');

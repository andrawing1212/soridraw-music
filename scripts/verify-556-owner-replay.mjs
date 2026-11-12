// APP557 exact pair-intent proof guards formerly unsafe APP556 replay.
import assert from 'node:assert/strict';
import {deliverOwnerFollowPostcommit555,replayOwnerFollowReservation556,
 APP555_OWNER_POSTCOMMIT_W2_COMPILED_OPEN}
 from '../cloudflare/explore-worker/runtime/owner-follow-postcommit-555.mjs';
import {QA_OWNER_FOLLOW_FUNCTION_URL_577}
 from '../cloudflare/explore-worker/runtime/owner-follow-qa-boundary-577.mjs';
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
// APP564: signed HTTP 403 (bad HMAC) is never a safe generation ACK.
// A transient secret rotation/config error cannot delete the durable ticket.
let signed403=0;
const mismatch=async()=>{signed403++;
 return {ok:false,status:403,json:async()=>({ok:false})};
};
assert.equal((await replay(ticket,mismatch)).status,'relay-failed');
assert.equal(signed403,2);
const epochConflict=async()=>({ok:false,status:409,json:async()=>({ok:false})});
assert.equal((await replay(ticket,epochConflict)).status,'rejected-generation');
console.log('APP564_BAD_HMAC_403_RETAIN_RETRY_409_GENERATION_REJECT=PASS');
const before={...c};
assert.equal((await replay({...ticket,operationId:'bad'})).status,'invalid-reservation');
assert.equal((await replay({...ticket,beforeFollowing:true})).status,'invalid-reservation');
assert.equal(c.send,before.send);
assert.equal((await replayOwnerFollowReservation556({reservation:ticket,env,send})).status,'disabled');
assert.equal((await replayOwnerFollowReservation556({reservation:ticket,env:{...env,SORIDRAW_ENVIRONMENT:'test'},send,enabled:true})).status,'disabled');
console.log('APP557_EXACT_COMMITTED_PAIR_AND_CUTOVER_REPLAY_GUARD=PASS');
console.log('APP557_NO_UNRELATED_PROFILE_REVISION_FALSE_OWNER_SIGNAL=PASS');
console.log('APP557_PREVIEW_ONLY_AUTH_EPOCH_FENCE=PASS;LIVE=NO_GO');

// APP580: use the SAME existing durable precommit→replay path for isolated
// QA, not a parallel direct client writer. All HTTP transports are stubs.
// QA mode must never call the operating Firebase URL, including when a
// rollback or configuration accidentally preserves an old endpoint.
let qaSends580=0;
const qaEnv580={...env,SORIDRAW_OWNER_FOLLOW_QA_ONLY_577:'1',
 SORIDRAW_OWNER_FOLLOW_ENDPOINT_539:QA_OWNER_FOLLOW_FUNCTION_URL_577};
const qaSend580=async(url,options)=>{
 qaSends580++;
 assert.equal(url,QA_OWNER_FOLLOW_FUNCTION_URL_577);
 assert.equal(options.method,'POST');
 const payload=JSON.parse(options.body);
 assert.equal(payload.ownerUid,'A');assert.equal(payload.authEpoch,epoch);
 return {ok:true,status:200,json:async()=>({ok:true,applied:true})};
};
assert.equal((await replayOwnerFollowReservation556({
 reservation:ticket,env:qaEnv580,send:qaSend580,enabled:true,
})).status,'delivered','EXACT_DO_REPLAY_MUST_REACH_QA_ONLY_RECEIVER');
assert.equal(qaSends580,1,'ONE_HMAC_POST_TO_QA_ONLY');
const beforeBad580={...c};
const operatingEndpoint580=env.SORIDRAW_OWNER_FOLLOW_ENDPOINT_539;
assert.equal((await replayOwnerFollowReservation556({
 reservation:ticket,env:{...qaEnv580,SORIDRAW_OWNER_FOLLOW_ENDPOINT_539:operatingEndpoint580},
 send:qaSend580,enabled:true,
})).status,'qa-target-hold','QA_MUST_DENY_OPERATING_URL');
assert.deepEqual(c,beforeBad580,'INVALID_QA_URL_ZERO_D1_R2_REQUESTS');
assert.equal(qaSends580,1,'INVALID_QA_URL_NO_NETWORK');
assert.equal((await replayOwnerFollowReservation556({
 reservation:ticket,env:{...qaEnv580,SORIDRAW_OWNER_FOLLOW_QA_ONLY_577:'maybe'},
 send:qaSend580,enabled:true,
})).status,'qa-relay-mode-invalid','INVALID_QA_FLAG_MUST_NOT_FALLBACK');
assert.deepEqual(c,beforeBad580,'INVALID_QA_FLAG_ZERO_D1_R2_REQUESTS');
assert.equal(qaSends580,1,'INVALID_QA_MODE_NO_NETWORK');
assert.equal((await replayOwnerFollowReservation556({
 reservation:ticket,env:{...qaEnv580,SORIDRAW_ENVIRONMENT:'production'},
 send:qaSend580,enabled:true,
})).status,'disabled','PRODUCTION_QA_RELAY_FORBIDDEN');
assert.equal(qaSends580,1);
console.log('APP580_EXISTING_DO_REPLAY_QA_PINNED_RECEIVER_SOURCE_PASS=PASS');
console.log('APP580_QA_WRONG_ENDPOINT_INVALID_MODE_ZERO_IO=PASS');
console.log('APP580_QA_BILLING_AND_LIVE_DEPLOYMENT=NOT_PERFORMED');

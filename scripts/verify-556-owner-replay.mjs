import assert from 'node:assert/strict';
import {deliverOwnerFollowPostcommit555,replayOwnerFollowReservation556,APP555_OWNER_POSTCOMMIT_W2_COMPILED_OPEN}
 from '../cloudflare/explore-worker/runtime/owner-follow-postcommit-555.mjs';
assert.equal(APP555_OWNER_POSTCOMMIT_W2_COMPILED_OPEN,false);
const e='0123456789abcdef0123456789abcdef',q={r2:0,d1:0,send:0};
let rv=18,pending=false,dbEpoch=e;
const env={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',
 SORIDRAW_OWNER_FOLLOW_HMAC_539:'APP556-LOCAL-SECRET-NOT-PRODUCTION-1234567',
 SORIDRAW_OWNER_FOLLOW_ENDPOINT_539:'https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542',
 PROFILE_MEDIA:{get:async()=>{q.r2++;return {text:async()=>JSON.stringify({
 revision:rv,body:{data:{profile:{uid:'A',followerCount:4}}},
 followSync354:{exact:true,pending:pending?{x:1}:{}}
 })}}},DB:{prepare:()=>({bind:()=>({first:async()=>{q.d1++;return {epoch:dbEpoch}}})})}};
const res=new Response(JSON.stringify({ok:true,data:{uid:'A',following:true,duplicate:false,revision:12}}),{
 headers:{'X-Soridraw-Follow-Protocol':'354'}});
const req=new Request('https://x.test/v1/profiles/A/follow',{method:'PUT'});
const send=async()=>{q.send++;return {ok:true,status:200,json:async()=>({ok:true,applied:true})}};
const deliver=async()=>deliverOwnerFollowPostcommit555({request:req,response:res,env,send,enabled:true});
const replay=async(reservation,transport=send)=>replayOwnerFollowReservation556({
 reservation,env,send:transport,enabled:true,
});
assert.equal((await deliver()).status,'delivered');
assert.deepEqual(q,{r2:1,d1:1,send:1});
const ticket={ownerUid:'A',authEpoch:e,priorR2Revision:18};
assert.equal((await replay(ticket)).status,'r2-not-advanced');
assert.deepEqual(q,{r2:2,d1:1,send:1});
rv=19;pending=true;
assert.equal((await replay(ticket)).status,'r2-unsettled');
assert.equal(q.d1,1);
pending=false;dbEpoch='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
assert.equal((await replay(ticket)).status,'rejected-generation');
assert.equal(q.send,1);
dbEpoch=e;
let attempts=0;
assert.equal((await replay(ticket,async()=>{attempts++;throw Error('offline')})).status,'relay-failed');
assert.equal(attempts,2);
assert.equal((await replay(ticket,async()=>({ok:true,status:200,json:async()=>({ok:false})}))).status,'relay-failed');
assert.equal((await replay(ticket)).status,'delivered');
assert.equal((await replay({...ticket,priorR2Revision:19})).status,'r2-not-advanced');
const before={...q};
assert.equal((await replay({...ticket,ownerUid:'?'})).status,'invalid-reservation');
assert.deepEqual(q,before);
assert.equal((await replay(ticket,send)).status,'delivered');
assert.equal((await replayOwnerFollowReservation556({reservation:ticket,env,send})).status,'disabled');
console.log('APP556_PRECOMMIT_VERSION_EPOCH_REPLAY_FENCE=PASS');
console.log('APP556_AFTER_TRANSPORT_FAILURE_EXACT_REPLAY=PASS');
console.log('APP556_NO_DURABLE_RESERVATION_OR_LIVE_ROLLOUT=NO_GO');

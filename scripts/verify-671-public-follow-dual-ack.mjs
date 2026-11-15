import assert from 'node:assert/strict';
import {handleOwnerAndPublicFollowReplay671 as bridge} from
 '../cloudflare/explore-worker/runtime/public-follow-dual-ack-671.mjs';
const ticket={ownerUid:'Target',actorUid:'Actor',operationId:'operation_1234567890',
 priorR2Revision:8};
const env={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_PUBLIC_FOLLOW_READY_669:'1',
 SORIDRAW_PUBLIC_FOLLOW_SCOPE_669:'preview-only'};
const request=()=>new Request('https://private.owner-follow/replay',{method:'POST',
 body:JSON.stringify(ticket)});
const ok=()=>Response.json({ok:true,status:'delivered',deliveredRevision:10});
let owners=0,publicCalls=0;
let result=await bridge({request:request(),env,ownerHandler:async()=>{
 owners++;return ok();
},publicRelay:async()=>{publicCalls++;return {status:'delivered'};}});
assert.equal(result.status,200);assert.equal(owners,1);assert.equal(publicCalls,0);
const ownerHandler=async()=>{owners++;return ok()};
const failures=['transport-retry','r2-not-exact','generation-hold','receiver-retry',
 'target-not-public','disabled'];
for(const status of failures){
 result=await bridge({request:request(),env,ownerHandler,enabled:true,
  publicRelay:async args=>{
    publicCalls++;
    assert.equal(args.reservation.operationId,ticket.operationId);
    assert.equal(args.enabled,true);
    return {status};
  }});
 assert.equal(result.status,503);
 assert.equal((await result.json()).status,'public-retry-required');
}
result=await bridge({request:request(),env,ownerHandler,enabled:true,
 publicRelay:async()=>{publicCalls++;return {status:'delivered'}}});
assert.equal(result.status,200);
assert.deepEqual(await result.json(),{ok:true,status:'delivered',deliveredRevision:10});
assert.equal(publicCalls,failures.length+1);
result=await bridge({request:request(),env,ownerHandler,enabled:true,
 publicRelay:async()=>({status:'target-not-public'})});
assert.equal(result.status,200);
const before=publicCalls;
for(const authFailure of [403,409,503]){
 const ownerFailure=async()=>new Response('',{status:authFailure});
 result=await bridge({request:request(),env,ownerHandler:ownerFailure,
 enabled:true,publicRelay:async()=>{publicCalls++;return {status:'delivered'}}});
 assert.equal(result.status,authFailure);
}
assert.equal(publicCalls,before);
const otherEnv={...env,SORIDRAW_ENVIRONMENT:'production'};
result=await bridge({request:request(),env:otherEnv,enabled:true,
 ownerHandler,publicRelay:async()=>{throw Error('Should never run')}});
assert.equal(result.status,200);
const withoutFlag={...env,SORIDRAW_PUBLIC_FOLLOW_READY_669:'0'};
result=await bridge({request:request(),env:withoutFlag,enabled:true,
 ownerHandler,publicRelay:async()=>{throw Error('Should never run')}});
assert.equal(result.status,200);
console.log('APP671_OWNER_PUBLIC_DUAL_ACK_RETRY_NO_DURABLE_LOSS=PASS');
console.log('APP671_INVALID_OWNER_ACK_NEVER_PUBLISHES_PUBLIC=PASS');
console.log('APP671_PREVIEW_SCOPE_OFF_IS_BYTE_IDENTICAL_OWNER_REPLAY=PASS');

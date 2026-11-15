import assert from 'node:assert/strict';
import {handleOwnerAndPublicFollowReplay671} from '../cloudflare/explore-worker/runtime/public-follow-dual-ack-671.mjs';
const env={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_PUBLIC_FOLLOW_READY_669:'1',
 SORIDRAW_PUBLIC_FOLLOW_SCOPE_669:'preview-only'};
const ticket={ownerUid:'soulforce',actorUid:'actorA',operationId:'operation_123456789',
 authEpoch:'0'.repeat(32),priorR2Revision:9};
const req=()=>new Request('https://private/owner-follow/replay557-internal',{
 method:'POST',body:JSON.stringify(ticket)});
let ownerCalls=0,publicCalls=0;
const ownerHandler=()=>{ownerCalls++;return Response.json({ok:false,status:'retry-required'},{status:503})};
const relay=async()=>{
 publicCalls++;return {status:'delivered',deliveredRevision:10};
};
const invoke=(extra={})=>handleOwnerAndPublicFollowReplay671({
 request:req(),env,enabled:true,ownerHandler,publicRelay:relay,
 authorizePublicOnly:()=>true,...extra,
});
let r=await invoke();
assert.equal(r.status,200);
assert.deepEqual(await r.json(),{ok:true,status:'delivered',deliveredRevision:10});
assert.equal(ownerCalls,0,'never run private owner receiver for an unenrolled profile');
assert.equal(publicCalls,1);
r=await invoke({authorizePublicOnly:()=>false});
assert.equal(r.status,403);
assert.equal(publicCalls,1,'bridge-denied public-only request must not publish');
r=await invoke({publicRelay:async()=>({status:'delivered',deliveredRevision:9})});
assert.equal(r.status,503,'a stale revision cannot ACK the durable ticket');
r=await invoke({publicRelay:async()=>({status:'receiver-retry'})});
assert.equal(r.status,503,'receiver failure must not ACK');
r=await invoke({publicRelay:async()=>({status:'target-not-public'})});
assert.equal(r.status,409,'revoked-public-profile must not publish a counter');
r=await invoke({env:{...env,SORIDRAW_ENVIRONMENT:'production'}});
assert.equal(r.status,503,'non-PREVIEW falls back to unchanged private owner handler');
assert.equal(ownerCalls,1);
console.log('APP680_PUBLIC_ONLY_DURABLE_ACK_AND_PRIVATE_REPLAY_ISOLATION=PASS');

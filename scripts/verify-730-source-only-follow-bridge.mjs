import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {integrateApp729ProductionOwnerFollow} from './app729-production-follow-adapter.mjs';
import {createApp730SourceOnlyBridge,APP730_PRODUCTION_RELAY_ENABLED} from './app730-source-only-follow-bridge.mjs';

// Entirely isolated synthetic owner A / actor B / second device C.
// No HTTP network, no Firebase, no Cloudflare, no shared D1/R2 or client data.
const owner='ownerA',actor='actorB',epoch='0123456789abcdef0123456789abcdef';
const secret='APP730-ISOLATED-ONLY-HMAC-SECRET-12345678901234567890';
const canonical={following:false,revision:0,writeCount:0};
const durable=new Map(),signal={ownerUid:owner,authEpoch:epoch,version:0,receiptId:'',followerCount:0};
let alarmAt=0,signalled=0,authVerified=true,appCheckVerified=true;
let preflightReads=0,logicalWrites=0,relayFailed=true,duplicates=0;
const idFor=(desired)=>'owner_follow_app730_'+(canonical.revision+1)+'_'+(desired?'follow':'unfollow');
const ticketFor=({actorUid,ownerUid,desired})=>{
 preflightReads++;
 return {ownerUid,actorUid,desired,beforeFollowing:canonical.following,
  operationId:idFor(desired),expectedRevision:canonical.revision,
  cutoverToken:'isolated-cutover',authEpoch:epoch,priorR2Revision:canonical.revision+1};
};
const reserved=async ticket=>{
 if(durable.has(ticket.operationId)){duplicates++;return {ok:true,status:'already-reserved'};}
 durable.set(ticket.operationId,{...ticket,done:false});alarmAt=Date.now()+1000;
 return {ok:true,status:'reserved'};
};
let storedIntent=null;
const base={
 async fetch(request){
  if(new URL(request.url).pathname!=='/v1/profiles/'+owner+'/follow')
   return new Response(null,{status:503});
  const body=await request.clone().json();
  assert.equal(body.followExpectedRevision,canonical.revision,'canonical exact revision');
  assert.equal(body.followOperationId,idFor(request.method==='PUT'));
  const following=request.method==='PUT';
  if(canonical.following===following)return Response.json({ok:true,data:{
    uid:owner,following,duplicate:true,revision:canonical.revision
   }},{headers:{'X-Soridraw-Follow-Protocol':'354'}});
  canonical.following=following;canonical.revision++;
  canonical.writeCount++;logicalWrites++;
  storedIntent={id:body.followOperationId,actor,target:owner,
   following,expectedRevision:body.followExpectedRevision,revision:canonical.revision,settled:true};
  return Response.json({ok:true,data:{uid:owner,following,duplicate:false,
   revision:canonical.revision}},{headers:{'X-Soridraw-Follow-Protocol':'354'}});
 },
 scheduled(){throw Error('never scheduled');},
};
const verifyExactCommit=async ({reservation})=>storedIntent?.id===reservation.operationId&&
 storedIntent.actor===reservation.actorUid&&
 storedIntent.target===reservation.ownerUid&&
 storedIntent.following===reservation.desired&&
 storedIntent.expectedRevision===reservation.expectedRevision&&storedIntent.settled===true
 ? {committed:true,operationRevision:storedIntent.revision}
 : {committed:false};
const bridge=createApp730SourceOnlyBridge({
 isolatedProof:{scope:'SYNTHETIC_ISOLATED_QA_ONLY'},
 verifyPrincipal:async()=>({uid:actor,verifiedAuth:authVerified,verifiedAppCheck:appCheckVerified}),
 readCanonicalReservation:ticketFor,
 reserveOwnerDo:reserved,
 verifyExactCommit,
});
const integrated=integrateApp729ProductionOwnerFollow(base,{enabled:true,bridge});
assert.equal(APP730_PRODUCTION_RELAY_ENABLED,false);
assert.notStrictEqual(integrated,base);
assert.strictEqual(integrated.scheduled,base.scheduled);
const url='https://isolated.example/v1/profiles/'+owner+'/follow';
// Offline APP730 synthetic tests explicitly use the confirmed v354 packet.
// The first legacy bodyless client request negotiates; it must never write.
const change=async(desired,body=JSON.stringify({
 followOperationId:idFor(desired),followExpectedRevision:canonical.revision,
}))=>integrated.fetch(new Request(url,{
 method:desired?'PUT':'DELETE',
 headers:{'Content-Type':'application/json'}, ...(body?{body}:{}),
}),{SORIDRAW_ENVIRONMENT:'production'},{});
const legacyFirst=await change(true,'');
assert.equal(legacyFirst.status,409);
assert.equal((await legacyFirst.json()).error?.code,'FOLLOW_ORDER_REQUIRED');
assert.equal(canonical.writeCount,0);
assert.equal(durable.size,0);
const before=canonical.writeCount;
authVerified=false;assert.equal((await change(true)).status,401);
authVerified=true;appCheckVerified=false;assert.equal((await change(true)).status,401);
appCheckVerified=true;assert.equal((await change(true,JSON.stringify({followOperationId:'forged'}))).status,503);
assert.equal(canonical.writeCount,before);
assert.equal(durable.size,0);
assert.equal(signalled,0);
assert.throws(()=>createApp730SourceOnlyBridge({
 verifyPrincipal:()=>{},readCanonicalReservation:()=>{},reserveOwnerDo:()=>{},
 verifyExactCommit:()=>{},
}),/PRODUCTION_ENABLEMENT_NOT_APPROVED/);
let first=await change(true);
assert.equal(first.status,200);
assert.equal(canonical.writeCount,1);
assert.equal(durable.size,1);
assert.equal(signal.version,0,'no direct RTDB write from Worker request');
assert.equal(bridge.diagnostics().immediateRtdbWrites,0);
assert(bridge.diagnostics().durableReserves===1);

// Existing precommit DO alarm is the ONLY sender, including after an ambiguous
// canonical response or a crashed browser. It may retry a transient 503.
const runAlarm=async()=>{
 for(const [id,item] of durable){
  if(item.done)continue;
  const proof=await verifyExactCommit({reservation:item});
  if(!proof.committed)continue;
  if(relayFailed) return {status:'transient-503',pending:true};
  // HMAC-receiver equivalent; tied to owner claim and monotonically ordered.
  const event={ownerUid:item.ownerUid,authEpoch:epoch,version:canonical.revision,
    followerCount:canonical.following?1:0,updatedAt:1800000000000,at:1800000000000};
  const raw=JSON.stringify(event);
  const signed=createHmac('sha256',secret).update(String(event.at)+'.'+raw).digest('hex');
  assert.equal(signed.length,64);
  assert.equal(event.ownerUid,owner);
  if(event.version>signal.version){
   Object.assign(signal,{ownerUid:owner,authEpoch:epoch,version:event.version,
    receiptId:epoch+':'+event.version,followerCount:event.followerCount});
   signalled++;
  }
  item.done=true;return {status:'ACK',pending:false};
 }
 return {status:'nothing-committed'};
};
assert.deepEqual(await runAlarm(),{status:'transient-503',pending:true});
assert.equal(signal.version,0);
assert.equal(canonical.writeCount,1,'relay outage must never re-mutate D1');
relayFailed=false;
assert.equal((await runAlarm()).status,'ACK');
assert.equal(signal.version,1);assert.equal(signal.followerCount,1);assert.equal(signalled,1);
assert.equal((await runAlarm()).status,'nothing-committed');
assert.equal(signalled,1,'retained duplicate no extra push');

first=await change(false);
assert.equal(first.status,200);assert.equal(canonical.writeCount,2);
assert.equal((await runAlarm()).status,'ACK');
assert.equal(signal.version,2);assert.equal(signal.followerCount,0);assert.equal(signalled,2);
assert(!signal.receiptId.startsWith('0:'));
const prevSignal={...signal};
const old={ownerUid:owner,authEpoch:epoch,version:1,followerCount:1};
if(old.version>signal.version)Object.assign(signal,old);
assert.deepEqual(signal,prevSignal,'older delayed notification cannot reverse newest state');
assert.equal((await integrated.fetch(new Request('https://isolated.example/v1/not-follow'),
  {SORIDRAW_ENVIRONMENT:'production'},{})).status,503); // mock base requires canonical envelope
assert.equal(bridge.diagnostics().immediateRtdbWrites,0);
assert.equal(logicalWrites,2);
assert.equal(signalled,2);
assert.equal(alarmAt>0,true);
console.log('APP730_SOURCE_ONLY_AUTH_DO_CANONICAL_RTDB_SYNTHETIC=PASS');
console.log('APP730_CRASH_RETRY_CANONICAL_W_ONCE_RECEIPT_DUPLICATE_ORDERED=PASS');
console.log('APP730_SHARED_SERVER_AND_PHYSICAL_QA=NOT_RUN_RELEASE_HOLD');

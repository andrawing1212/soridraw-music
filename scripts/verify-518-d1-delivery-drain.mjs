import assert from 'node:assert/strict';
import {deliverDueCanonicalFavorites518} from '../cloudflare/media-worker/src/catalogDelivery518.js';
import {parseFirestoreUpdateTimeNs518} from '../cloudflare/media-worker/src/catalogCanonicalFence518.js';
import {CatalogR2ContractError518} from '../cloudflare/media-worker/src/catalogR2Provider518.js';
const time=n=>'2026-10-28T02:00:00.'+String(n).padStart(9,'0')+'Z';
const ver=n=>parseFirestoreUpdateTimeNs518(time(n));
const uid='own',documentId='song-a',nowMs=100000;
function makeDb(state){
 const row={owner_uid:uid,favorite_id:documentId,
   source_version_ns:ver(1),desired_state:'saved',ack_version_ns:null,
   attempt_count:0,next_attempt_ms:0,hold_reason:null,...state};
 const counts={reads:0,writes:0};
 const db={prepare(sql){
  return {bind(...args){
   return {
    async all(){
     counts.reads++;
     if(!sql.includes('SELECT owner_uid'))throw Error('wrong due query');
     return {results:row.hold_reason!==null
       ||row.ack_version_ns===row.source_version_ns
       ||row.next_attempt_ms>args[0]?[]:[{...row}]};
    },
    async run(){
     if(sql.startsWith('INSERT INTO')){
       const [ou,di,v,st]=args;
       if(ou!==uid||di!==documentId)throw Error('cross owner');
       if(BigInt(v)<=BigInt(row.source_version_ns))return {meta:{changes:0}};
       row.source_version_ns=v;row.desired_state=st;
       row.ack_version_ns=null;row.attempt_count=0;row.next_attempt_ms=0;
       row.hold_reason=null;
     }else if(sql.startsWith('UPDATE')&&sql.includes('ack_version_ns=source_version_ns')){
       if(row.source_version_ns!==args[3]||row.ack_version_ns===args[3])
         return {meta:{changes:0}};
       row.ack_version_ns=args[3];
     }else if(sql.startsWith('UPDATE')&&sql.includes('attempt_count=attempt_count+1')){
       if(row.source_version_ns!==args[4]||row.ack_version_ns===args[4]
         ||row.hold_reason!==null)return {meta:{changes:0}};
       if(row.attempt_count!==args[5])return {meta:{changes:0}};
       row.next_attempt_ms=args[0];row.attempt_count++;
     }else if(sql.startsWith('UPDATE')&&sql.includes('SET hold_reason=?')){
       const [reason,time,owner,doc,v]=args;
       if(owner!==uid||doc!==documentId||v!==row.source_version_ns
         ||row.hold_reason!==null)return {meta:{changes:0}};
       row.hold_reason=reason;
     }else throw Error('unknown SQL');
     counts.writes++;return {meta:{changes:1}};
    },
   };
  }};
 }};
 return {db,row,counts};
}
const canonical=(n,state='saved',owner=uid)=>({
 uid:owner,documentId,verifiedByServer:true,origin:'server-exact-read',
 updateTime:time(n),state,item:{id:documentId,uid:owner,title:'fixture'}
});
const run=(db,readExactCanonical,applyVersionedR2,now=nowMs)=>deliverDueCanonicalFavorites518({
 db,readExactCanonical,applyVersionedR2,nowMs:now,
});
// Ordinary save: no queue claiming W; single ACK W after R2 proof.
let ctx=makeDb();
let sent=0;
let result=await run(ctx.db,async()=>canonical(1),async x=>{
 sent++;return {code:'APPLIED',sourceVersionNs:x.sourceVersionNs,
 versionVerified:true,ownerVerified:true,casVerified:true};
});
assert.equal(result.acked,1);assert.equal(ctx.counts.writes,1);assert.equal(sent,1);
assert.equal((await run(ctx.db,async()=>{throw Error('must not read');},async()=>{})).attempted,0);

// An older pending save when exact Firestore already reflects deletion must
// first enqueue deletion; stale save is NEVER sent to R2.
ctx=makeDb();
result=await run(ctx.db,async()=>canonical(2,'removed'),async()=>{throw Error('old R2 mutation');});
assert.equal(result.drift,1);assert.equal(ctx.row.desired_state,'removed');
assert.equal(ctx.row.source_version_ns,ver(2));
assert.equal(ctx.counts.writes,1);
result=await run(ctx.db,async()=>canonical(2,'removed'),async x=>({
 code:'APPLIED',sourceVersionNs:x.sourceVersionNs,ownerVerified:true,
 versionVerified:true,casVerified:true,
}));
assert.equal(result.acked,1);
assert.equal(ctx.row.ack_version_ns,ver(2));

// A late or stale exact canonical *read* cannot clobber a newer pending
// change; it is delayed, not spun forever in the current due batch.
ctx=makeDb({source_version_ns:ver(2),desired_state:'removed'});
result=await run(ctx.db,async()=>canonical(1),async()=>{throw Error('stale!');});
assert.equal(result.drift,1);assert.equal(result.retry,1);
assert.ok(ctx.row.next_attempt_ms>nowMs);
assert.equal(ctx.row.source_version_ns,ver(2));

// R2 HTTP success without verified CAS owner and exact source version does
// NOT cause a D1 ACK. The failure must survive process restart.
ctx=makeDb();
result=await run(ctx.db,async()=>canonical(1),async()=>({
 code:'APPLIED',ownerVerified:true,versionVerified:false,casVerified:true,
 sourceVersionNs:ver(1),
}));
assert.equal(result.acked,0);assert.equal(result.retry,1);
assert.equal(ctx.row.ack_version_ns,null);
assert.equal((await run(ctx.db,async()=>{throw Error('not due yet');},async()=>{})).attempted,0);

// Unversioned hard delete, foreign owner, and offline error retain pending.
for(const invalid of [
 {...canonical(1),updateTime:''},canonical(1,'saved','intruder'),null,
]){
 ctx=makeDb();
 result=await run(ctx.db,async()=>invalid,async()=>{throw Error('must not deliver');});
 assert.equal(result.acked,0);assert.equal(result.retry,1);
 assert.equal(ctx.row.ack_version_ns,null);
}
ctx=makeDb();
result=await run(ctx.db,async()=>{throw Error('offline');},
 async()=>{throw Error('must not reach R2');});
assert.equal(result.retry,1);
// P2: Contract-invalid terminal source is held once, even if the scheduler
// runs thousands of times. A new verified source wakes it without scanning.
ctx=makeDb();
let applyCalls=0;
result=await run(ctx.db,async()=>canonical(1),async()=>{
 applyCalls++;return {code:'DENY_UNFENCED_R2_HEAD',
 ownerVerified:false,versionVerified:false,casVerified:false};
});
assert.equal(result.held,1);
assert.equal(result.retry,0);
assert.equal(ctx.row.hold_reason,'INDEX_CONTRACT');
assert.equal(ctx.row.ack_version_ns,null);
const pendingWrites=ctx.counts.writes,pendingReads=ctx.counts.reads;
for(let i=0;i<5;i++){
 const idle=await run(ctx.db,async()=>{throw Error('held never read');},
 async()=>{throw Error('held never invoked');});
 assert.equal(idle.attempted,0);
}
assert.equal(ctx.counts.writes,pendingWrites);
assert.equal(ctx.counts.reads,pendingReads+5,'only bounded empty D1 due queries');
assert.equal(applyCalls,1);
result=await run(ctx.db,async()=>canonical(2,'removed'),async()=>{
 throw Error('should not run while held');
});
assert.equal(result.attempted,0);
ctx=makeDb({attempt_count:8});
result=await run(ctx.db,async()=>{throw Error('network offline');},
 async()=>{throw Error('must not call R2');});
assert.equal(result.held,1);
assert.equal(ctx.row.hold_reason,'RETRY_BUDGET_EXHAUSTED');
assert.equal(ctx.row.ack_version_ns,null);
assert.equal((await run(ctx.db,async()=>{throw Error('no repeat');},
 async()=>{throw Error('no repeat');})).attempted,0);
// P1 regression: stage index HEAD drift and compaction HEAD motion are
// temporary. Do not permanently HOLD an otherwise valid unchanged source.
// The next due attempt must re-check the same exact canonical and may ACK.
for(const transientCode of [
 'RETRYABLE_INDEX_RETRYABLE_R2_HEAD_MOVED',
 'RETRYABLE_INDEX_RECOVERY_HOLD_RECOVERY_HEAD_MOVED',
]){
 ctx=makeDb();
 let tryCalls=0;
 result=await run(ctx.db,async()=>canonical(1),async()=>{
  tryCalls++;
  return {code:transientCode,ownerVerified:false,
   versionVerified:false,casVerified:false};
 });
 assert.equal(result.attempted,1,transientCode);
 assert.equal(result.acked,0,transientCode);
 assert.equal(result.retry,1,transientCode);
 assert.equal(result.held,0,transientCode);
 assert.equal(ctx.row.hold_reason,null,transientCode);
 assert.equal(ctx.row.attempt_count,1,transientCode);
 assert.ok(ctx.row.next_attempt_ms>nowMs,transientCode);
 const next=ctx.row.next_attempt_ms;
 assert.equal((await run(ctx.db,async()=>{throw Error('not due');},
  async()=>{throw Error('not due');},next-1)).attempted,0);
 result=await run(ctx.db,async()=>canonical(1),async input=>{
  tryCalls++;
  return {code:'APPLIED',sourceVersionNs:input.sourceVersionNs,
   ownerVerified:true,versionVerified:true,casVerified:true};
 },next);
 assert.equal(result.acked,1,transientCode);
 assert.equal(ctx.row.ack_version_ns,ver(1),transientCode);
 assert.equal(tryCalls,2,transientCode);
 assert.equal(ctx.row.hold_reason,null,transientCode);
}
// Genuine permanent authority/budget failures must still hold exactly once.
for(const terminalCode of [
 'RETRYABLE_INDEX_DENY_UNVERIFIED_OR_OVERSIZED_SNAPSHOT',
 'RETRYABLE_INDEX_HOLD_STAGE_RESTART_BUDGET_EXHAUSTED',
 'RETRYABLE_INDEX_RECOVERY_HOLD_NON_MONOTONIC_RECOVERY_HEAD',
]){
 ctx=makeDb();
 result=await run(ctx.db,async()=>canonical(1),async()=>({
  code:terminalCode,ownerVerified:false,
  versionVerified:false,casVerified:false,
 }));
 assert.equal(result.held,1,terminalCode);
 assert.equal(result.retry,0,terminalCode);
 assert.equal(ctx.row.hold_reason,'INDEX_CONTRACT',terminalCode);
 const lastWrites=ctx.counts.writes;
 assert.equal((await run(ctx.db,async()=>{throw Error('held');},
   async()=>{throw Error('held');})).attempted,0);
 assert.equal(ctx.counts.writes,lastWrites,terminalCode);
}
// Repeated transient HEAD movement has the existing finite retry limit,
// never a permanent hot-loop of Firestore/R2 calls.
ctx=makeDb({attempt_count:8});
result=await run(ctx.db,async()=>canonical(1),async()=>({
 code:'RETRYABLE_INDEX_RECOVERY_HOLD_RECOVERY_HEAD_MOVED',
 ownerVerified:false,versionVerified:false,casVerified:false,
}));
assert.equal(result.held,1);
assert.equal(ctx.row.hold_reason,'RETRY_BUDGET_EXHAUSTED');
assert.equal(ctx.row.ack_version_ns,null);
assert.equal((await run(ctx.db,async()=>{throw Error('held');},
  async()=>{throw Error('held');})).attempted,0);
// R2 errors that escape a READY-index provider are equally permanent.
// Raw network I/O still uses bounded retry; never accept an unverified ACK.
ctx=makeDb();
result=await run(ctx.db,async()=>canonical(1),async()=>{
 throw new CatalogR2ContractError518('APP518_R2_HEAD_UNKNOWN_OR_CORRUPT');
});
assert.equal(result.held,1);
assert.equal(result.retry,0);
assert.equal(ctx.row.hold_reason,'INDEX_CONTRACT');
assert.equal(ctx.row.ack_version_ns,null);
ctx=makeDb();
result=await run(ctx.db,async()=>canonical(1),async()=>{
 throw new Error('APP518_R2_IO_TIMEOUT');
});
assert.equal(result.held,0);
assert.equal(result.retry,1);
assert.equal(ctx.row.hold_reason,null);
console.log('APP518_DIRECT_R2_OWNER_SCHEMA_EXCEPTION_HOLD_VS_NETWORK_RETRY=PASS');
console.log('APP518_STAGE_AND_COMPACTION_HEAD_DRIFT_RETRY_NOT_PERMANENT_HOLD=PASS');
console.log('APP518_TERMINAL_RECOVERY_CONTRACT_STILL_DURABLY_HELD=PASS');
console.log('APP518_TRANSIENT_DRIFT_RETRY_BUDGET_BOUNDED=PASS');
console.log('APP518_D1_TERMINAL_ERROR_HOLD_W1_AND_NO_HOURLY_RETRY=PASS');
console.log('APP518_D1_TRANSIENT_RETRY_BUDGET_CAPPED_PENDING_PRESERVED=PASS');
console.log('APP518_D1_DELIVERY_READS_FRESH_CANONICAL_AND_REQUEUES_DRIFT=PASS');
console.log('APP518_D1_OFFLINE_R2_FAILURE_DURABLE_RETRY=PASS');
console.log('APP518_D1_ACK_REQUIRES_VERIFIED_EXACT_R2_CAS=PASS');
console.log('APP518_D1_UNVERSIONED_DELETE_NEVER_RECONSTRUCTED=PASS');
console.log('APP518_D1_IDLE_PROCESSING_FIRESTORE_R0_R2_W0=PASS');
console.log('APP518_DELIVERY_SIMULATOR_LIVE_NETWORK_IO=ZERO');

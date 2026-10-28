import assert from 'node:assert/strict';
import {deliverDueCanonicalFavorites518} from '../cloudflare/media-worker/src/catalogDelivery518.js';
import {parseFirestoreUpdateTimeNs518} from '../cloudflare/media-worker/src/catalogCanonicalFence518.js';
const time=n=>'2026-10-28T02:00:00.'+String(n).padStart(9,'0')+'Z';
const ver=n=>parseFirestoreUpdateTimeNs518(time(n));
const uid='own',documentId='song-a',nowMs=100000;
function makeDb(state){
 const row={owner_uid:uid,favorite_id:documentId,
   source_version_ns:ver(1),desired_state:'saved',ack_version_ns:null,
   attempt_count:0,next_attempt_ms:0,...state};
 const counts={reads:0,writes:0};
 const db={prepare(sql){
  return {bind(...args){
   return {
    async all(){
     counts.reads++;
     if(!sql.includes('SELECT owner_uid'))throw Error('wrong due query');
     return {results:row.ack_version_ns===row.source_version_ns
       ||row.next_attempt_ms>args[0]?[]:[{...row}]};
    },
    async run(){
     if(sql.startsWith('INSERT INTO')){
       const [ou,di,v,st]=args;
       if(ou!==uid||di!==documentId)throw Error('cross owner');
       if(BigInt(v)<=BigInt(row.source_version_ns))return {meta:{changes:0}};
       row.source_version_ns=v;row.desired_state=st;
       row.ack_version_ns=null;row.attempt_count=0;row.next_attempt_ms=0;
     }else if(sql.startsWith('UPDATE')&&sql.includes('ack_version_ns=source_version_ns')){
       if(row.source_version_ns!==args[3]||row.ack_version_ns===args[3])
         return {meta:{changes:0}};
       row.ack_version_ns=args[3];
     }else if(sql.startsWith('UPDATE')&&sql.includes('attempt_count=attempt_count+1')){
       if(row.source_version_ns!==args[4]||row.ack_version_ns===args[4])
         return {meta:{changes:0}};
       if(row.attempt_count!==args[5])return {meta:{changes:0}};
       row.next_attempt_ms=args[0];row.attempt_count++;
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
console.log('APP518_D1_DELIVERY_READS_FRESH_CANONICAL_AND_REQUEUES_DRIFT=PASS');
console.log('APP518_D1_OFFLINE_R2_FAILURE_DURABLE_RETRY=PASS');
console.log('APP518_D1_ACK_REQUIRES_VERIFIED_EXACT_R2_CAS=PASS');
console.log('APP518_D1_UNVERSIONED_DELETE_NEVER_RECONSTRUCTED=PASS');
console.log('APP518_D1_IDLE_PROCESSING_FIRESTORE_R0_R2_W0=PASS');
console.log('APP518_DELIVERY_SIMULATOR_LIVE_NETWORK_IO=ZERO');

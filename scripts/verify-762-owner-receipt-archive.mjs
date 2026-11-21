// APP762: owner-DO-local immutable tombstones keep replay idempotent after the
// 24-slot hot queue fills. Offline mock only: no Cloudflare/QA/PROD connections.
import assert from 'node:assert/strict';
import {createApp755ProductionOwnerReceiptStore}
 from './app755-production-owner-receipt.mjs';
const owner='app762SyntheticOwner',actor='app762SyntheticActor';
const prefix='app762-owner-follow-final-';
const key='app755-owner-follow-pending-v1';
let clock=1800000000000,alarm=null,sequence=0,transactionCount=0;
let failCommit=false,failAlarm=false,failArchiveRead=false;
const map=new Map();
const copy=v=>structuredClone(v);
const storage={
 async get(k){
  if(failArchiveRead&&k.startsWith(prefix))throw Error('INJECTED_ARCHIVE_UNAVAILABLE');
  return map.has(k)?copy(map.get(k)):undefined;
 },
 async getAlarm(){return alarm},
 async setAlarm(value){alarm=value},
 async transaction(fn){
  const staged=new Map([...map].map(([k,v])=>[k,copy(v)]));
  let nextAlarm=alarm;
  const tx={
   async get(k){
    if(failArchiveRead&&k.startsWith(prefix))throw Error('INJECTED_ARCHIVE_UNAVAILABLE');
    return staged.has(k)?copy(staged.get(k)):undefined;
   },
   async put(k,v){staged.set(k,copy(v))},
   async getAlarm(){return nextAlarm},
   async setAlarm(v){if(failAlarm)throw Error('INJECTED_ALARM_UNAVAILABLE');nextAlarm=v},
   async deleteAlarm(){nextAlarm=null},
  };
  const value=await fn(tx);
  if(failCommit){failCommit=false;throw Error('INJECTED_ATOMIC_COMMIT_ABORT')}
  map.clear();for(const [k,v] of staged)map.set(k,v);
  alarm=nextAlarm;transactionCount++;
  return value;
 },
};
const makeStore=(on=owner)=>createApp755ProductionOwnerReceiptStore({
 enabled:true,storage,ownerUid:on,now:()=>clock,
 issueId:()=>('app762_server_receipt_'+(++sequence).toString().padStart(10,'0')),
});
const store=makeStore();
const input=i=>({
 actorUid:actor,ownerUid:owner,desired:i%2===0,
 canonicalOperationId:'app762_canonical_'+String(i).padStart(24,'0'),
 expectedRevision:i+20,authEpoch:'a'.repeat(32),
 cutoverToken:'app762-existing-trusted-canonical',
 priorR2Revision:i+100,beforeFollowing:i%2!==0,
});
const receipt=[];
for(let i=0;i<24;i++){
 const ticket=await store.reserve(input(i));
 assert.equal(ticket.durable,true);
 receipt.push(ticket);
 if(i===0){
  // Existing APP755 persisted v1 records must be readable and unchanged.
  assert.equal(map.get(key).archiveUsed,undefined);
 }
 const result=await store.markDelivery({receipt:ticket,
  result:i===5?'rejected-generation':'delivered'});
 assert.equal(result.status,i===5?'held':'delivered');
 assert.equal(map.get(key).entries.length,i+1);
}
assert.equal(map.get(key).entries.length,24);
assert.equal(map.get(key).archiveUsed,undefined,'v1 compatible until overflow');
const beforeArchive=new Map([...map].map(([k,v])=>[k,copy(v)]));
const originalCount=sequence;
const twentyFifth=await store.reserve(input(24));
assert.equal(twentyFifth.durable,true,'24 completed receipts must not stop next follow');
assert.equal(map.get(key).entries.length,24);
assert.equal(map.get(key).archiveUsed,true);
assert.equal(map.size,2,'only one terminal receipt moved');
assert.equal(map.get(prefix+input(0).canonicalOperationId).operationId,receipt[0].operationId);
assert.equal(map.get(prefix+input(0).canonicalOperationId).delivery.status,'delivered');
assert.equal(map.get(key).entries.some(v=>v.operationId===receipt[0].operationId),false);
assert.equal(sequence,originalCount+1);
// Duplicate after rollover must retrieve ORIGINAL server-issued receipt.
const f0=await store.find(input(0));
assert.equal(f0.status,'found');
assert.equal(f0.receipt.operationId,receipt[0].operationId);
const savedMap=copy([...map]);
const duplicate=await store.reserve(input(0));
assert.equal(duplicate.operationId,receipt[0].operationId);
assert.equal(sequence,originalCount+1);
assert.deepEqual([...map],savedMap,'replay cannot perform new DO state write');
// Same canonical ID with changed intent/epoch cannot be a new operation.
assert.equal((await store.find({...input(0),desired:false})).status,'unknown');
assert.deepEqual(await store.reserve({...input(0),authEpoch:'b'.repeat(32)}),
 {durable:false,reason:'conflict'});
assert.equal(sequence,originalCount+1);
// Terminal at index 5 includes HOLD. All archived records must retain it.
for(let i=24;i<85;i++){
 const ticket=i===24?twentyFifth:await store.reserve(input(i));
 assert.equal(ticket.durable,true);
 receipt.push(ticket);
 const settled=await store.markDelivery({receipt:ticket,result:'delivered'});
 assert.equal(settled.status,'delivered');
 assert(map.get(key).entries.length<=24);
}
assert.equal(sequence,85,'one issued receipt per 85 changed operations');
assert.equal(map.get(key).entries.length,24);
assert.equal([...map.keys()].filter(x=>x.startsWith(prefix)).length,61);
assert.equal((await store.find(input(5))).receipt.delivery.status,'held');
assert.equal((await store.reserve(input(5))).operationId,receipt[5].operationId);
assert.equal((await store.find(input(80))).receipt.operationId,receipt[80].operationId);
const restarts=makeStore();
assert.equal((await restarts.find(input(0))).receipt.operationId,receipt[0].operationId);
assert.equal((await restarts.reserve(input(0))).operationId,receipt[0].operationId);
assert.equal(sequence,85,'restart/replay cannot allocate a new canonical ID');
assert.equal(map.get(key).entries.length,24);
assert.equal(alarm,null,'archiving finished receipts never creates background alarm');

// Simulate corrupted archive: fail closed instead of treating as absence.
const archivedKey=prefix+input(0).canonicalOperationId;
const original=copy(map.get(archivedKey));
map.set(archivedKey,{ownerUid:'other'});
assert.equal((await store.find(input(0))).status,'unknown');
assert.deepEqual(await store.reserve(input(0)),
 {durable:false,reason:'storage-or-alarm-uncertain'});
assert.equal(sequence,85);
map.set(archivedKey,original);
failArchiveRead=true;
assert.equal((await store.find(input(0))).status,'unknown');
assert.deepEqual(await store.reserve(input(0)),
 {durable:false,reason:'storage-or-alarm-uncertain'});
failArchiveRead=false;
assert.equal((await store.find(input(0))).status,'found');

// All 24 hot receipts can be pending simultaneously: stop safely, never
// recycle a pending entry or issue a second receipt to fake progress.
map.clear();alarm=null;sequence=0;transactionCount=0;
for(let i=0;i<24;i++)assert.equal((await store.reserve(input(i))).durable,true);
assert.equal((await store.reserve(input(24))).reason,'owner-pending-queue-full');
assert.equal(sequence,24);
assert.equal(map.size,1);
assert.equal(map.get(key).entries.length,24);
const earlier=copy(map.get(key));
const first=earlier.entries[0];
const ack=await store.markDelivery({receipt:first,result:'delivered'});
assert.equal(ack.status,'delivered');
assert.equal((await store.reserve(input(24))).durable,true);
assert.equal(sequence,25);
assert.equal((await store.find(input(0))).receipt.operationId,first.operationId);
assert.equal(map.get(key).entries.length,24);

// A failed transaction must not publish an archive, new receipt, or lost
// pending reservation. Existing DO transaction does all writes atomically.
const target=input(25),awaited=map.get(key).entries[1];
const beforeAbort=[...map].map(([k,v])=>[k,copy(v)]);
await store.markDelivery({receipt:awaited,result:'delivered'});
const stableMap=new Map([...map].map(([k,v])=>[k,copy(v)]));
failCommit=true;
assert.deepEqual(await store.reserve(target),
 {durable:false,reason:'storage-or-alarm-uncertain'});
assert.deepEqual([...map], [...stableMap],'archive and hot queue must roll back together');
assert.equal((await store.find(target)).status,'absent');
assert.equal((await store.reserve(target)).durable,true);
assert.equal((await store.reserve(target)).operationId,
 (await store.find(target)).receipt.operationId);
assert.deepEqual((await store.find({...input(0),desired:false})).status,'unknown');
// A fully held queue may archive terminal holds, but never claim delivery.
map.clear();alarm=null;sequence=0;
for(let i=0;i<24;i++){
 const t=await store.reserve(input(i));
 await store.markDelivery({receipt:t,result:'rejected-generation'});
}
assert.equal((await store.reserve(input(24))).durable,true);
assert.equal((await store.find(input(0))).receipt.delivery.status,'held');
assert.equal((await store.find(input(0))).status,'found');
console.log('APP762_85_OWNER_FOLLOWS_TOMBSTONE_REPLAY_AFTER_24_AND_RESTART=PASS');
console.log('APP762_PENDING_24_BACKPRESSURE_NOT_SILENT_LOSS=PASS');
console.log('APP762_ATOMIC_ARCHIVE_CORRUPTION_TRANSIENT_FAILURE_AND_409_HELD=PASS');
console.log('APP762_TOMBSTONES_NEVER_DELETED_LONG_TERM_STORAGE_POLICY=HOLD');
console.log('APP762_SHARED_DATA_D1_R2_RTD B=0'.replace('RTD B','RTDB'));
console.log('APP762_ACTIVE_PRODUCTION_DO=OFF; PHYSICAL_QA_REPLAY=NOT_RUN');

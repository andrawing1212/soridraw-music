// APP764: single archived key loss cannot look like authoritative absence.
// Exact APP755/762 store with synthetic DO memory only; no remote data access.
import assert from 'node:assert/strict';
import {createApp755ProductionOwnerReceiptStore} from './app755-production-owner-receipt.mjs';
const owner='app764OwnerSynthetic',actor='app764ActorSynthetic';
const HOT='app755-owner-follow-pending-v1';
const PREFIX='app762-owner-follow-final-';
const clone=x=>structuredClone(x);
let map=new Map(),alarm=null,issued=0,writes=0,failCommit=false;
const storage={
 async get(k){return map.has(k)?clone(map.get(k)):undefined},
 async getAlarm(){return alarm},
 async setAlarm(v){alarm=v},
 async transaction(f){
  const staged=new Map([...map].map(([k,v])=>[k,clone(v)]));
  let nextAlarm=alarm;
  const tx={
   async get(k){return staged.has(k)?clone(staged.get(k)):undefined},
   async put(k,v){staged.set(k,clone(v))},
   async getAlarm(){return nextAlarm},
   async setAlarm(v){nextAlarm=v},
   async deleteAlarm(){nextAlarm=null},
  };
  const result=await f(tx);
  if(failCommit){failCommit=false;throw Error('INJECTED_ATOMIC_ROLLBACK')}
  map=staged;alarm=nextAlarm;writes++;
  return result;
 },
};
const makeStore=()=>createApp755ProductionOwnerReceiptStore({
 enabled:true,storage,ownerUid:owner,now:()=>1800000000000,
 issueId:()=>('app764_server_receipt_'+String(++issued).padStart(12,'0')),
});
const store=makeStore();
const input=i=>({
 actorUid:actor,ownerUid:owner,desired:i%2===0,
 canonicalOperationId:'app764_canonical_'+String(i).padStart(22,'0'),
 expectedRevision:i+10,authEpoch:'a'.repeat(32),priorR2Revision:100+i,
 beforeFollowing:i%2!==0,cutoverToken:'app764-trusted-preflight',
});
const receipts=[];
for(let i=0;i<24;i++){
 const t=await store.reserve(input(i));
 assert.equal(t.durable,true);receipts.push(t);
 assert.equal((await store.markDelivery({receipt:t,result:'delivered'})).status,
  'delivered');
}
assert.equal(map.get(HOT).archiveUsed,undefined,'legacy v1 still works');
const twentyFifth=await store.reserve(input(24));
assert.equal(twentyFifth.durable,true);
const hot=map.get(HOT);
assert.equal(hot.archiveUsed,true);
assert.equal(hot.entries.length,24);
assert.equal(hot.archiveWitnesses.length,1);
assert.match(hot.archiveWitnesses[0],/^[0-9a-f]{32}$/);
assert.match(hot.archiveWitnessSeal,/^[0-9a-f]{64}$/);
const key=PREFIX+input(0).canonicalOperationId;
const original=clone(map.get(key));
assert.equal(original.operationId,receipts[0].operationId);
assert.equal((await store.find(input(0))).receipt.operationId,receipts[0].operationId);
assert.equal((await makeStore().reserve(input(0))).operationId,receipts[0].operationId);
assert.equal(issued,25,'old operation cannot mint a new server receipt');
// Most important: delete JUST the archived key. Witness remains in the hot
// state; find must not return {status:absent,authoritative:true}. A missing
// archived receipt must never reach APP743 canonical write/reserve branch.
map.delete(key);
const mapBefore=clone([...map]),writesBefore=writes,issuedBefore=issued;
const absent=await store.find(input(0));
assert.equal(absent.status,'unknown');
assert.notEqual(absent.authoritative,true);
const refused=await store.reserve(input(0));
assert.equal(refused.durable,false);
assert.equal(refused.reason,'storage-or-alarm-uncertain');
assert.deepEqual([...map],mapBefore,'single deleted key cannot mutate other data');
assert.equal(writes,writesBefore);
assert.equal(issued,issuedBefore);
map.set(key,original);
assert.equal((await store.find(input(0))).receipt.operationId,receipts[0].operationId);
// New operation not present in witness may continue, with the existing
// APP743/755 exact authenticated canonical preflight unchanged.
const newTicket=await store.reserve(input(25));
assert.equal(newTicket.durable,true);
assert.equal(issued,26);
assert.equal(map.get(HOT).archiveWitnesses.length,2);
assert.equal((await store.find(input(1))).receipt.operationId,receipts[1].operationId);

// Index-only loss or silent mutation fails closed rather than accepting
// a tombstone-free past operation. No archive list scan is needed.
const intact=clone(map.get(HOT));
map.set(HOT,{...intact,archiveWitnesses:undefined});
assert.equal((await store.find(input(0))).status,'unknown');
assert.equal((await store.reserve(input(26))).durable,false);
map.set(HOT,{...intact,archiveWitnesses:[]});
assert.equal((await store.find(input(0))).status,'unknown');
map.set(HOT,{...intact,archiveWitnessSeal:'0'.repeat(64)});
assert.equal((await store.find(input(0))).status,'unknown');
map.set(HOT,intact);
assert.equal((await store.find(input(0))).status,'found');
// Legacy APP762 archiveUsed without APP764 witness has no safe backfill.
// HOLD rather than pretending absence, even for a new request.
const legacy=clone(intact);
delete legacy.archiveWitnesses;
delete legacy.archiveWitnessSeal;
map.set(HOT,legacy);
assert.equal((await store.find(input(0))).status,'unknown');
assert.equal((await store.reserve(input(26))).durable,false);
map.set(HOT,intact);

// Atomic failure on rollover must keep the original hot queue and archive
// witness together; no phantom index entry or lost receipt.
map=new Map();issued=0;alarm=null;writes=0;
for(let i=0;i<24;i++){
 const t=await store.reserve(input(i));
 assert.equal(t.durable,true);
 await store.markDelivery({receipt:t,result:'delivered'});
}
const oldState=clone([...map]);
failCommit=true;
const failed=await store.reserve(input(24));
assert.deepEqual(failed,{durable:false,reason:'storage-or-alarm-uncertain'});
assert.deepEqual([...map],oldState,'archive key/index must roll back atomically');
assert.equal(map.get(HOT).archiveUsed,undefined);
assert.equal((await store.find(input(0))).status,'found');
assert.equal((await store.reserve(input(24))).durable,true);
assert.equal(map.get(HOT).archiveWitnesses.length,1);
assert.equal((await store.find(input(0))).receipt.delivery.status,'delivered');
assert.equal((await store.find({...input(0),desired:false})).status,'unknown');
console.log('APP764_MISSING_ARCHIVE_KEY_NEVER_AUTHENTICATED_ABSENCE=PASS');
console.log('APP764_OWNER_WITNESS_CORRUPTION_LEGACY_HOLD_AND_ATOMIC_ROLLBACK=PASS');
console.log('APP764_NORMAL_NEW_CANONICAL_AFTER_ROLLOVER_NO_EXTRA_SERVER_READ=PASS');
console.log('APP764_FULL_DO_PITR_AND_EXTERNAL_CANONICAL_HISTORY_NOT_PROVEN=HOLD');
console.log('APP764_BACKEND_DATA_READS_WRITES=0; PROD_DEPLOY=0');

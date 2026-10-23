import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CURATED_REPAIR_KEY_468, CURATED_REPAIR_PREPARE_GRACE_MS_468,
  reserveCuratedRepair468, confirmCuratedRepair468,
  acknowledgeCuratedRepair468, drainCuratedRepair468,
  armCuratedRepairAlarm468,
} from '../cloudflare/explore-worker/runtime/curated-projection-repair-468.mjs';

function storageFake() {
  const values = new Map();
  let alarm = null;
  const alarms = [];
  return {
    get: async (k) => values.get(k) ?? null,
    put: async (k,v) => { values.set(k, structuredClone(v)); },
    delete: async (k) => values.delete(k),
    getAlarm: async () => alarm,
    setAlarm: async (v) => { alarm=v; alarms.push(v); },
    fire: () => { alarm=null; },
    nextAlarm: () => alarm,
    history: () => alarms,
  };
}

// A successful canonical publication with an R2 CAS failure must keep one
// pending journal that later repairs once Cloudflare R2 is healthy.
{
  const st=storageFake(),t0=100_000;
  const ticket=await reserveCuratedRepair468(st,['curated-a'],t0);
  assert.equal(ticket.reserved,true);
  assert.equal(st.nextAlarm(),t0+5_000);
  await confirmCuratedRepair468(st,ticket.generation,t0+50);
  st.fire();
  let attempts=0;
  const first=await drainCuratedRepair468(st,async(ids)=>{
    attempts++;
    assert.deepEqual(ids,['curated-a']);
    return {ok:false,reason:'CAS_REJECT'};
  },t0+6_000);
  assert.equal(first.retrying,true);
  assert(st.nextAlarm()>t0+6_000);
  const retryAt=st.nextAlarm();
  st.fire();
  const later=await drainCuratedRepair468(st,async(ids)=>{
    attempts++;
    assert.deepEqual(ids,['curated-a']);
    return {ok:true};
  },retryAt);
  assert.equal(later.repaired,true);
  assert.equal(await st.get(CURATED_REPAIR_KEY_468),null);
  assert.equal(attempts,2);
}

// A crash after canonical commit but before confirm/ACK is recovered from
// the pre-reserved journal after its bounded grace period.
{
  const st=storageFake(),t0=300_000;
  const ticket=await reserveCuratedRepair468(st,['curated-b'],t0);
  assert.equal(ticket.reserved,true);
  st.fire();
  let calls=0;
  const early=await drainCuratedRepair468(st,async()=>{calls++;return {ok:true};},t0+5_000);
  assert.equal(early.deferred,true);
  assert.equal(calls,0);
  st.fire();
  const result=await drainCuratedRepair468(st,async(ids)=>{
    calls++;assert.deepEqual(ids,['curated-b']);return {ok:true};
  },t0+CURATED_REPAIR_PREPARE_GRACE_MS_468);
  assert.equal(result.repaired,true);
  assert.equal(calls,1);
}

// Two sequential real curator requests must not allow a late ACK from
// the first to delete the second's durable pending change.
{
  const st=storageFake(),t0=500_000;
  const first=await reserveCuratedRepair468(st,['curated-a'],t0);
  await confirmCuratedRepair468(st,first.generation,t0+1);
  const second=await reserveCuratedRepair468(st,['curated-b'],t0+2);
  assert(second.generation>first.generation);
  assert.deepEqual((await st.get(CURATED_REPAIR_KEY_468)).trackIds,
    ['curated-a','curated-b']);
  assert.equal((await acknowledgeCuratedRepair468(st,first.generation)).acknowledged,true);
  assert((await st.get(CURATED_REPAIR_KEY_468))?.generation===second.generation);
  assert.deepEqual((await st.get(CURATED_REPAIR_KEY_468)).trackIds,['curated-b']);
  assert.equal((await acknowledgeCuratedRepair468(st,second.generation)).acknowledged,true);
}

// Other scheduled work must not be moved later by the curated repair request.
{
  const st=storageFake(),t0=900_000;
  await st.setAlarm(t0+2_000);
  await reserveCuratedRepair468(st,['curated-c'],t0);
  assert.equal(st.nextAlarm(),t0+2_000);
}

{
  const st=storageFake();
  assert.equal((await reserveCuratedRepair468(st,[],1)).reserved,false);
  await assert.rejects(()=>reserveCuratedRepair468(st,
    Array.from({length:41},(_,i)=>String(i)),1),/CURATED_REPAIR_IDS_INVALID_468/);
  const t=await reserveCuratedRepair468(st,['curated-c'],10_000);
  await confirmCuratedRepair468(st,t.generation,10_001);
  st.fire();
  const failed=await drainCuratedRepair468(st,async()=>{throw Error('R2 unavailable');},20_000);
  assert.equal(failed.retrying,true);
}


// Out-of-order writes: B's successful projection cannot erase A's reservation.
// If A later commits while R2 PUT fails, A must still be repaired by its own
// persisted ticket, even though B was already acknowledged.
{
  const st=storageFake(),t0=600_000;
  const a=await reserveCuratedRepair468(st,['curated-a'],t0);
  const b=await reserveCuratedRepair468(st,['curated-b'],t0+1);
  await confirmCuratedRepair468(st,b.generation,t0+2);
  assert.equal((await acknowledgeCuratedRepair468(st,b.generation)).acknowledged,true);
  assert.deepEqual((await st.get(CURATED_REPAIR_KEY_468)).trackIds,['curated-a']);
  await confirmCuratedRepair468(st,a.generation,t0+3);
  st.fire();
  const fail=await drainCuratedRepair468(st,async(ids)=>{
    assert.deepEqual(ids,['curated-a']); return {ok:false};
  },t0+6_000);
  assert.equal(fail.retrying,true);
  const at=st.nextAlarm();
  st.fire();
  const repaired=await drainCuratedRepair468(st,async(ids)=>{
    assert.deepEqual(ids,['curated-a']); return {ok:true};
  },at);
  assert.equal(repaired.repaired,true);
  assert.equal(await st.get(CURATED_REPAIR_KEY_468),null);
}

// A long-delayed acknowledgment from an old empty-queue cycle must never
// match a new ticket generation.
{
  const st=storageFake(),t0=700_000;
  const a=await reserveCuratedRepair468(st,['curated-a'],t0);
  assert((await acknowledgeCuratedRepair468(st,a.generation)).acknowledged);
  const b=await reserveCuratedRepair468(st,['curated-b'],t0+10);
  assert.notEqual(a.generation,b.generation);
  assert.equal((await acknowledgeCuratedRepair468(st,a.generation)).acknowledged,false);
  assert.deepEqual((await st.get(CURATED_REPAIR_KEY_468)).trackIds,['curated-b']);
}

// app470: Cloudflare transaction `txn` only has KV methods (no alarms).
// Mimic the real API so reserve/confirm/repair cannot accidentally call
// tx.getAlarm/tx.setAlarm. The route must arm the full storage AFTER commit.
{
  const st=storageFake(),start=1_100_000;
  st.transaction=async(handler)=>handler({
    get:st.get,put:st.put,delete:st.delete,
  });
  const reserved=await st.transaction((tx)=>
    reserveCuratedRepair468(tx,['track-a'],start));
  assert(reserved.reserved);
  assert.equal(st.nextAlarm(),null,
    'transaction KV must never attempt to arm an alarm');
  assert(await armCuratedRepairAlarm468(st,start+5_000,start));
  await st.transaction((tx)=>confirmCuratedRepair468(tx,reserved.generation,start+30));
  st.fire();
  const failed=await drainCuratedRepair468(st,async()=>({ok:false}),start+6_000);
  assert(failed.retrying);
  assert(st.nextAlarm()>start+6_000,'repair must rearm after atomic ticket update');
  const retryAt=st.nextAlarm();
  st.fire();
  const fixed=await drainCuratedRepair468(st,async()=>({ok:true}),retryAt);
  assert(fixed.repaired);
  assert.equal(await st.get(CURATED_REPAIR_KEY_468),null);
}

const worker470=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
const aggregate470=worker470.split('async finalizeAggregate195() {')[1]?.split('async fetch(request) {')[0];
assert(aggregate470,'like aggregate finalizer must exist');
const deleteAt470=aggregate470.indexOf('await this.ctx.storage.deleteAlarm()');
const rearmAt470=aggregate470.indexOf('await this.ensurePendingCuratedAlarm470()');
assert(deleteAt470>=0 && rearmAt470>deleteAt470,
  'a like queue emptying must not leave a pending curated ticket without its alarm');
assert.match(worker470,/const result = await this\.ctx\.storage\.transaction\(\(tx\) =>\s*reserveCuratedRepair468\(tx/);
assert.match(worker470,/if \(result\.reserved\)\s*await armCuratedRepairAlarm468\(this\.ctx\.storage/);
assert.match(worker470,/if \(result\.confirmed\)\s*await armCuratedRepairAlarm468\(this\.ctx\.storage/);

console.log('APP470_DO_TRANSACTION_KV_ALARM_API_SEPARATION=PASS');
console.log('APP470_LIKE_FINALIZER_CANNOT_STRAND_CURATED_ALARM=PASS');

console.log('APP468_CANONICAL_SUCCESS_R2_FAIL_EVENTUAL_REPAIR=PASS');
console.log('APP468_PRECOMMIT_CRASH_FALLBACK=PASS');
console.log('APP468_OUT_OF_ORDER_ACK_AND_ABA_RACE_SAFE=PASS');
console.log('APP468_GENERATION_RACE_AND_LIKE_ALARM_SAFE=PASS');
console.log('APP468_BOUNDED_CHANGED_IDS_NO_IDLE_POLL=PASS');

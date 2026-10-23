import assert from 'node:assert/strict';
import {
  CURATED_REPAIR_KEY_468, CURATED_REPAIR_PREPARE_GRACE_MS_468,
  reserveCuratedRepair468, confirmCuratedRepair468,
  acknowledgeCuratedRepair468, drainCuratedRepair468,
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
  assert.equal((await acknowledgeCuratedRepair468(st,first.generation)).acknowledged,false);
  assert((await st.get(CURATED_REPAIR_KEY_468))?.generation===second.generation);
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

console.log('APP468_CANONICAL_SUCCESS_R2_FAIL_EVENTUAL_REPAIR=PASS');
console.log('APP468_PRECOMMIT_CRASH_FALLBACK=PASS');
console.log('APP468_GENERATION_RACE_AND_LIKE_ALARM_SAFE=PASS');
console.log('APP468_BOUNDED_CHANGED_IDS_NO_IDLE_POLL=PASS');

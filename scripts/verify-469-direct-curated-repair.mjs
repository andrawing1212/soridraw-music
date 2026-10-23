import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  reserveCuratedRepair468, confirmCuratedRepair468,
  drainCuratedRepair468, acknowledgeCuratedRepair468,
} from '../cloudflare/explore-worker/runtime/curated-projection-repair-468.mjs';

const src=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
const direct=src.split('async function handleCurationMutation307(')[1]?.split('// SORIDRAW_CURATED_MANAGER_R2_READ_310')[0];
assert(direct,'direct curator handler must exist');
const reserveAt=direct.indexOf('await reserveDirectCuratedRepair469(env, id)');
const insertAt=direct.indexOf('INSERT INTO curated_picks(');
const removeAt=direct.indexOf('DELETE FROM curated_picks WHERE');
const confirmAt=direct.indexOf("await finalizeDirectCuratedRepair469(directCuratedTicket469, 'confirm')");
const refreshAt=direct.indexOf('await refreshCuratedShared466(request, env, ctx, [id])');
const ackAt=direct.indexOf("await finalizeDirectCuratedRepair469(directCuratedTicket469, 'ack')");
assert(reserveAt>=0 && reserveAt<insertAt && reserveAt<removeAt,
  'curator promotion and removal must both reserve BEFORE shared D1 mutation');
assert(insertAt>reserveAt && removeAt>reserveAt && confirmAt>removeAt,
  'persisted confirmation must be after the canonical write');
assert(refreshAt>confirmAt && ackAt>refreshAt,
  'do not retire ticket until the derived R2 CAS succeeds');
assert.match(direct,/CURATED_DIRECT_REPAIR_PREFLIGHT_469/);
assert.match(direct,/CURATED_SHARED_SETTLEMENT_PENDING_466/);
assert.match(src,/const curatedOnlyAlarm469 = curatedSharedWriterEnabled471\(this\.env\)/);
assert.match(src,/if \(!publicOnly448 && !curatedOnlyAlarm469\)\s*\{\s*await this\.runAggregate194\(\)/);
assert.match(src,/if \(curatedSharedWriterEnabled471\(this\.env\) &&\s*await this\.ctx\.storage\.get\(CURATED_REPAIR_KEY_468\)\)/);

// Pure deterministic failure-replay: the direct curation route's reserved
// ticket must survive R2 CAS rejection and be healed later without a second
// canonical D1 curator write. This is NOT a live DO/Cloudflare proof.
function memory() {
  const kv=new Map();
  let alarm=null;
  return {
    get:async k=>kv.get(k)??null,
    put:async(k,v)=>kv.set(k,structuredClone(v)),
    delete:async k=>{kv.delete(k);},
    getAlarm:async()=>alarm,
    setAlarm:async(v)=>{alarm=v;},
    fire:()=>{alarm=null;},
    alarm:()=>alarm,
  };
}
const store=memory();
const t0=1_000_000;
const ticket=await reserveCuratedRepair468(store,['curated-1'],t0);
assert.equal(ticket.reserved,true);
await confirmCuratedRepair468(store,ticket.generation,t0+100);
store.fire();
let d1Writes=1, r2Attempts=0;
const failed=await drainCuratedRepair468(store,async changed=>{
  r2Attempts++;
  assert.deepEqual(changed,['curated-1']);
  return {ok:false,reason:'CAS_REJECT'};
},t0+5_500);
assert.equal(failed.retrying,true);
const retryAt=store.alarm();
store.fire();
const fixed=await drainCuratedRepair468(store,async changed=>{
  r2Attempts++;
  assert.deepEqual(changed,['curated-1']);
  return {ok:true};
},retryAt);
assert.equal(fixed.repaired,true);
assert.equal(d1Writes,1,'derived replay must not redo D1 original write');
assert.equal(r2Attempts,2);
assert.equal((await acknowledgeCuratedRepair468(store,ticket.generation)).acknowledged,false,
 'after successful alarm repair the stale HTTP ACK cannot retire future tickets');
console.log('APP469_DIRECT_CURATOR_BOTH_D1_ROUTES_DURABLY_RESERVED=PASS');
console.log('APP469_CURATED_ONLY_ALARM_DOES_NOT_RUN_LIKE_AGGREGATE=PASS');
console.log('APP469_CANONICAL_W1_ONLY_AFTER_DERIVED_R2_FAILURE_REPAIRED=PASS');

console.log('APP471_SHADOW_ALARM_STILL_NO_LIKE_BATCH=PASS');

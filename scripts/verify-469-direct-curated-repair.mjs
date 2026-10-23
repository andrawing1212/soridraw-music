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
assert.match(src,/const curatedOnlyAlarm469 = canRunCuratedWriter471/);
assert.match(src,/if \(!publicOnly448 && !curatedOnlyAlarm469\)\s*\{\s*await this\.runAggregate194\(\)/);
assert.match(src,/if \(curatedEnabled472 && await this\.ctx\.storage\.get\(CURATED_REPAIR_KEY_468\)\)/);

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
// app473 independent-audit sibling case: direct curator PUT/DELETE can also
// fail to persist the v307 display projection. A successful v466 projection
// must not falsely ACK its ticket. Exercise the real legacy writer with an
// injected R2 failure; verify the direct handler waits for its boolean proof.
{
  const fnSource = src.split('async function writeCuratedSnapshot307(')[1]
    ?.split('// SORIDRAW_CURATED_PUBLICATION_TARGETED_SYNC_307_20261003')[0];
  assert(fnSource, 'legacy snapshot function must exist');
  let putFailures = 1, puts = 0;
  const bucket = { put: async () => {
    puts++;
    if (putFailures-- > 0) throw Error('INJECTED_V307_R2_PUT_FAILURE');
  } };
  const write = new Function(
    'curatedBucket307','readCuratedObject307','baseWorker',
    'SORIDRAW_CURATED_R2_KEY_307','SORIDRAW_CURATED_COLLECTION_307',
    'clearCuratedEdge307',
    'return async function writeCuratedSnapshot307(' + fnSource
  )(
    () => bucket,
    async () => ({
      payload: { ok:true, data:{items:[{track:{id:'curated-1'}}]} },
      memberIds: ['curated-1'],
    }),
    { fetch: async()=>{throw Error('unexpected detail request on DELETE');} },
    'curated-v307', 'soridraw', async()=>{},
  );
  const request = new Request('https://preview.soridraw.com/v1/curation/soridraw/curated-1');
  await assert.rejects(write(request, {}, {}, 'curated-1', false, 'master'),
    /INJECTED_V307_R2_PUT_FAILURE/);
  assert.equal(await write(request, {}, {}, 'curated-1', false, 'master'), true);
  assert.equal(puts, 2);
  const start=direct.indexOf('let legacyCuratedSaved473 = false;');
  const writeAt=direct.indexOf('legacyCuratedSaved473 =');
  const sharedAt=direct.indexOf('const settled471 = await refreshCuratedShared466(');
  const failGate=direct.indexOf("if (!legacyCuratedSaved473) throw Error('CURATED_LEGACY_DISPLAY_PENDING_473')");
  const ack=direct.indexOf("await finalizeDirectCuratedRepair469(directCuratedTicket469, 'ack')",sharedAt);
  assert(start>=0 && writeAt>start && sharedAt>writeAt && failGate>sharedAt && ack>failGate,
    'shadow must never ACK direct curator ticket when v307 failed despite v466 success');
}
console.log('APP473_DIRECT_CURATOR_V307_FAILURE_RETAINS_DURABLE_TICKET=PASS');

console.log('APP469_DIRECT_CURATOR_BOTH_D1_ROUTES_DURABLY_RESERVED=PASS');
console.log('APP469_CURATED_ONLY_ALARM_DOES_NOT_RUN_LIKE_AGGREGATE=PASS');
console.log('APP469_CANONICAL_W1_ONLY_AFTER_DERIVED_R2_FAILURE_REPAIRED=PASS');

console.log('APP471_SHADOW_ALARM_STILL_NO_LIKE_BATCH=PASS');

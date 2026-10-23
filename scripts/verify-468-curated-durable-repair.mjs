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

// app472 independent-audit P1 #1: exercise the actual DO repair method.
// Shadow mode may clear its ticket ONLY when v307 (user-visible) and v466
// (shared derived) both succeed. Inject the failed legacy R2 write first.
{
  const source = worker470.split('  async runCuratedRepair468() {')[1]
    ?.split('\n  async runAggregate194() {')[0];
  assert(source && source.includes('materializeCuratedR2FromBase307'));
  const clock = { now: 2_000_000 };
  const store = storageFake();
  const ticket = await reserveCuratedRepair468(store, ['curated-private'], clock.now - 6_000);
  await confirmCuratedRepair468(store, ticket.generation, clock.now - 5_990);
  store.fire();
  let legacyAttempts = 0, sharedAttempts = 0;
  const RepairDo = new Function(
    'curatedSharedWriterEnabled471','curatedWriterShadowEnabled471',
    'drainCuratedRepair468','materializeCuratedR2FromBase307',
    'reconcileCuratedShared466','baseWorker',
    'return class { constructor(storage){ this.ctx={storage}; this.env={}; } async runCuratedRepair468() {'
      + source + '\n }'
  )(
    () => true,
    () => true,
    (storage, callback) => drainCuratedRepair468(storage, callback, clock.now),
    async () => {
      legacyAttempts++;
      if (legacyAttempts === 1) throw Error('INJECTED_V307_R2_PUT_FAILURE');
      return { object: { etag:'legacy-ok' }, payload: { data: { items: [] } } };
    },
    async () => { sharedAttempts++; return { ok: true }; },
    { fetch: async () => { throw Error('unexpected detail resolver'); } },
  );
  const worker = new RepairDo(store);
  await worker.runCuratedRepair468();
  assert.equal(legacyAttempts, 1);
  assert.equal(sharedAttempts, 0,
    'cannot settle shared-only after a legacy display R2 failure');
  assert((await store.get(CURATED_REPAIR_KEY_468))?.tickets?.length === 1,
    'failed legacy display cache MUST leave the durable repair ticket');
  clock.now = store.nextAlarm();
  store.fire();
  await worker.runCuratedRepair468();
  assert.equal(legacyAttempts, 2);
  assert.equal(sharedAttempts, 1);
  assert.equal(await store.get(CURATED_REPAIR_KEY_468), null,
    'ack only once both user-visible and shared projections converge');
}

// app472 independent-audit P1 #2: fail the actual like aggregate 7 times.
// Each alarm must still invoke curated recovery, and then preserve the
// original like failure so the platform's legacy retry signal is intact.
{
  const body = worker470.split('  async alarm() {')[1]
    ?.split('\n  }\n}\n\n// SORIDRAW_BOUNDED_CANONICAL_PUBLIC_LIKE_CONVERGENCE')[0];
  assert(body && body.includes('likeAlarmError472'));
  const AlarmDo = new Function(
    'STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE','COMMON_PUBLIC_LIKE_WINDOW_ACTIVE_448',
    'EXPLORE_LIKE_ACTIVE_SCHEDULE_KEY_194','CURATED_REPAIR_KEY_468',
    'return class { constructor() { this.env={SORIDRAW_CURATED_WRITER_SHADOW471:"1"};'
      + 'this.ctx={storage:{get:async (key)=>key==="like-marker" ? 1 : {tickets:[1]}}};'
      + 'this.likeCalls=0; this.curatedCalls=0; }'
      + 'async runAggregate194(){this.likeCalls++; throw Error("INJECTED_LIKE_FAILURE");}'
      + 'async finalizeAggregate195(){throw Error("must not finalize failed like batch");}'
      + 'async runCuratedRepair468(){this.curatedCalls++;}'
      + 'async alarm(){' + body + '\n }\n}'
  )(false,false,'like-marker','curated-journal');
  const worker = new AlarmDo();
  for (let i = 0; i < 7; i++)
    await assert.rejects(() => worker.alarm(), /INJECTED_LIKE_FAILURE/);
  assert.equal(worker.likeCalls, 7);
  assert.equal(worker.curatedCalls, 7,
    'like failure must never starve an independent curated recovery');
}
// app475: actual bounded legacy bootstrap, not a shape-only mock.
// A published song detail failure must retain the ticket without a partial
// R2 PUT. An earlier bootstrap waking after a newer removal must lose CAS.
{
  const source = worker470.split('async function materializeCuratedR2FromBase307(')[1]
    ?.split('\nasync function readCuratedObject307(')[0];
  assert(source && source.includes('CURATED_DETAIL_PENDING_475'));
  const row = {track_id:'track-a',curator_uid:'master',curator_role:'master',
    sort_order:0,starts_at:null,ends_at:null,created_at:1,updated_at:1,
    is_public:1,status:'published'};
  let rows=[row], state={schemaVersion:1,memberIds:[],
    payload:{ok:true,data:{items:[]}}},etag='rev0',puts=0,phase='fail';
  let enterWait,leaveWait;
  const entered=new Promise(resolve=>{enterWait=resolve;});
  const resume=new Promise(resolve=>{leaveWait=resolve;});
  const bucket={
    get:async()=>({etag,text:async()=>JSON.stringify(state)}),
    put:async(_key,body,opts)=>{
      puts++;
      const condition=opts?.onlyIf;
      assert(condition,'writer-shadow must use conditional R2 PUT');
      const expected=condition instanceof Headers
        ?condition.get('If-Match') :condition?.etagMatches;
      if(expected!==etag)return null;
      state=JSON.parse(body);etag='rev'+puts;
      return {etag};
    },
  };
  const worker={fetch:async()=>{
    if(phase==='fail')return new Response('temporarily unavailable',{status:503});
    if(phase==='throw')throw Error('INJECTED_DETAIL_EXCEPTION');
    if(phase==='wait'){enterWait();await resume;}
    return Response.json({ok:true,data:{track:{id:'track-a'}}});
  }};
  const rebuild=new Function('curatedBucket307','curatedWriterShadowEnabled471',
    'SORIDRAW_CURATED_R2_KEY_307','SORIDRAW_CURATED_COLLECTION_307',
    'baseWorker','clearCuratedEdge307','readCanonicalCurated466',
    'canonicalCuratedIds466','visibleCuratedIds466',
    'return async function materializeCuratedR2FromBase307(' + source
  )(
    ()=>bucket,()=>true,'curated-v307','soridraw',
    worker,async()=>{},async()=>rows.slice(),
    current=>current.map(r=>r.track_id),
    current=>current.filter(r=>r.is_public===1&&r.status==='published')
      .map(r=>r.track_id),
  );
  const env={DB:{prepare:()=>({bind:()=>({all:async()=>({results:rows.slice()})})})}};
  const request=new Request('https://soridraw.internal/v1/curated');
  const failure=await rebuild(request,env,{});
  assert.equal(failure.source,'CURATED_DETAIL_PENDING_475');
  assert.equal(failure.object,null);
  assert.equal(puts,0,'HTTP 503 cannot write partial v307');
  phase='throw';
  const failureThrown=await rebuild(request,env,{});
  assert.equal(failureThrown.source,'CURATED_DETAIL_PENDING_475');
  assert.equal(puts,0,'thrown detail fetch cannot write partial v307');
  phase='success';
  const healed=await rebuild(request,env,{});
  assert(healed.object&&healed.payload?.data?.items?.length===1);
  assert.equal(puts,1);
  phase='wait';
  const stale=rebuild(request,env,{});
  await entered;
  // Simulate later direct removal committing canonical D1 AND updated R2.
  rows=[];
  const deletion=await bucket.put('curated-v307',JSON.stringify({
    schemaVersion:1,memberIds:[],payload:{ok:true,data:{items:[]}},
  }),{onlyIf:{etagMatches:etag}});
  assert(deletion);
  leaveWait();
  const old=await stale;
  assert.equal(old.source,'CURATED_LEGACY_CAS_PENDING_475',
    'late old PUT must fail when newer removal already updated R2');
  assert.deepEqual(state.memberIds,[]);
  assert.deepEqual(state.payload.data.items,[]);
}
console.log('APP475_DETAIL_503_THROW_NO_PARTIAL_V307_PUT=PASS');
console.log('APP475_LATE_OLD_CAS_CANNOT_RESURRECT_REMOVED_TRACK=PASS');

console.log('APP472_LEGACY_V307_AND_SHARED_V466_BOTH_SETTLE_BEFORE_ACK=PASS');
console.log('APP472_LIKE_FAILURE_7_OF_7_CURATED_RECOVERY_INDEPENDENT=PASS');

console.log('APP470_DO_TRANSACTION_KV_ALARM_API_SEPARATION=PASS');
console.log('APP470_LIKE_FINALIZER_CANNOT_STRAND_CURATED_ALARM=PASS');

console.log('APP468_CANONICAL_SUCCESS_R2_FAIL_EVENTUAL_REPAIR=PASS');
console.log('APP468_PRECOMMIT_CRASH_FALLBACK=PASS');
console.log('APP468_OUT_OF_ORDER_ACK_AND_ABA_RACE_SAFE=PASS');
console.log('APP468_GENERATION_RACE_AND_LIKE_ALARM_SAFE=PASS');
console.log('APP468_BOUNDED_CHANGED_IDS_NO_IDLE_POLL=PASS');

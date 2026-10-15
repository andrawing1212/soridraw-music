import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  PUBLIC_LIKE_PENDING_OPEN_KEY_416,
  PUBLIC_LIKE_WINDOW_KEY_416,
  ackPublicLikeEventStorage416,
  clearPublicLikeReleaseStorage416,
  joinPublicLikeChangedTracks416,
  mergePendingPublicLikeOpen416,
  readPublicLikeReleaseState416,
  registerPublicLikeEventStorage416,
  stagePublicLikeOpenPayload416,
} from '../cloudflare/explore-worker/runtime/public-like-window-416.mjs';

const base=1_700_110_000_000;
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const map=new Map(),writes=[],deletes=[];
const storage={
 async transaction(fn){return fn(this);},
 async getAlarm(){return null;},async setAlarm() {},
  async get(key){return map.get(key);},
  async put(entries,value){
    if(typeof entries==='string'){
      map.set(entries,structuredClone(value));writes.push([entries]);return;
    }
    for(const [key,row] of Object.entries(entries))map.set(key,structuredClone(row));
    writes.push(Object.keys(entries).sort());
  },
  async list({prefix,startAfter,limit}={}){
    let rows=[...map].filter(([key])=>!prefix||key.startsWith(prefix))
      .sort((a,b)=>a[0].localeCompare(b[0]));
    if(startAfter)rows=rows.filter(([key])=>key>startAfter);
    if(Number.isSafeInteger(limit)&&limit>0)rows=rows.slice(0,limit);
    return new Map(rows);
  },
  async delete(keys){
    const list=Array.isArray(keys)?keys:[keys];
    for(const key of list)map.delete(key);
    deletes.push(list);return list.length;
  },
};

const waveIds=Array.from({length:5000},(_,i)=>'wave-'+String(i).padStart(5,'0'));
const staged=await stagePublicLikeOpenPayload416(storage,waveIds,base+5_000);
assert.equal(staged.staged,true);
assert.equal(staged.unchanged,false);
assert.equal(staged.trackCount,5000);
const writeCount=writes.length;
const retryStage=await stagePublicLikeOpenPayload416(storage,[...waveIds].reverse(),base+6_000);
assert.equal(retryStage.unchanged,true,'exact pending wave retry must be DO W0');
assert.equal(writes.length,writeCount);
const pendingEvent=[...map.entries()].find(([key])=>
  key.startsWith(PUBLIC_LIKE_PENDING_OPEN_KEY_416+'/event/'))?.[1];
assert.equal(pendingEvent?.eventAtMs,base+5_000);

const firstEvent={eventId:id(1),windowCandidateId:id(101),eventAtMs:base+10_000,
  publicMinutes:5,trackIds:['stage-own-track']};
const opened=await registerPublicLikeEventStorage416(storage,firstEvent,base+10_000);
assert.equal(opened.opened,true);
assert.equal(opened.deadlineAtMs,base+310_000);
const merged=await mergePendingPublicLikeOpen416(storage,base+10_001);
assert.equal(merged.merged,true);
assert.equal(merged.trackCount,5000);
assert.equal([...map.keys()].some(key=>
  key.startsWith(PUBLIC_LIKE_PENDING_OPEN_KEY_416+'/')),false);

const duplicate=await registerPublicLikeEventStorage416(storage,firstEvent,base+11_000);
assert.equal(duplicate.duplicate,true,
  'merging canonical wave IDs must not alter event fingerprint/retry semantics');
assert.equal(duplicate.scheduleAtMs,base+310_000);

const legacyJoin=await joinPublicLikeChangedTracks416(
  storage,['legacy-a','wave-00000'],base+309_000);
assert.equal(legacyJoin.joined,true);
assert.equal(legacyJoin.trackCount,2);
assert.equal(map.get(PUBLIC_LIKE_WINDOW_KEY_416).deadlineAtMs,base+310_000,
  'late legacy change must not extend fixed public deadline');

await ackPublicLikeEventStorage416(storage,firstEvent.eventId,base+12_000);
const state=await readPublicLikeReleaseState416(storage,base+310_000);
assert.equal(state.due,true);
assert.equal(state.blockedUnacked,false);
assert.equal(state.trackIds.length,5002);
assert(state.trackIds.includes('legacy-a'));
assert(state.trackIds.includes('stage-own-track'));
for(const trackId of waveIds)assert(state.trackIds.includes(trackId));
const cleared=await clearPublicLikeReleaseStorage416(storage,state);
assert.equal(cleared.cleared,true);
assert.equal([...map.keys()].some(key=>key.includes('/window/'+id(101)+'/')),false,
  'paged clear must remove every >1000 changed-track row');
assert.equal(map.has(PUBLIC_LIKE_WINDOW_KEY_416),false);

const worker=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
assert.match(worker,/SORIDRAW_STAGE416_EXACT_PUBLIC_CHANGED_IDS_440_20261014/);
assert.match(worker,/RETURNING track_id,\s*\(SELECT MAX\(CASE WHEN d\.stage416_signed=1 AND d\.delta<>0 THEN 1 ELSE 0 END\)/);
assert.match(worker,/Reuse the two canonical track_stats mutations' RETURNING rows: zero extra/);
assert.match(worker,/SORIDRAW_STAGE416_MASTER_ONLY_PUBLIC_444_20261015/);
assert.match(worker,/changedRows416[\s\S]*?filter\(\(row\)=>Number\(row\?\.stage416_signed\|\|0\)===1\)[\s\S]*?changedTrackIds416/);
assert.match(worker,/stage416Changed416=changedTrackIds416\.length>0/);
assert.match(worker,/publicDeferred416:true/);
assert.match(worker,/__SORIDRAW_STAGE416_PUBLIC_WINDOW_ACTIVE===true&&[\s\S]{0,120}totals\.stage416Changed416===true/);
assert.doesNotMatch(worker,/__SORIDRAW_DEFER_PUBLIC_416/);
assert.match(worker,/processExploreLikeUserQueueWave075\(\s*env, now, Date\.now\(\), false\)/);

const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
const runStart=entry.indexOf('async runAggregate194()');
const runEnd=entry.indexOf('async finalizeAggregate195()',runStart);
const run=entry.slice(runStart,runEnd);
assert.match(run,/PUBLIC_LIKE_WINDOW_KEY_416/);
assert.match(run,/__SORIDRAW_STAGE416_PUBLIC_WINDOW_ACTIVE/);
assert.doesNotMatch(run,/__SORIDRAW_DEFER_PUBLIC_416/);
assert.match(run,/STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE===true/);
assert.match(run,/stagePublicLikeOpenPayload416/);
assert.match(run,/joinPublicLikeChangedTracks416/);
assert.ok(run.indexOf('return {...settledAggregate418,publicWindowDeferred416:true')<
  run.indexOf('await repairSharedPublicLikeCounts191(this.env)'),
  'deferred wave must exit before legacy 191 public repair can leak counts');
// Exercise the actual Worker method, not a surrogate: a failed DO read must
// reject BEFORE canonical D1 aggregate and public R2/191 reconciliation.
const aggregateMethod416=run.match(/async runAggregate194\(\) \{[\s\S]*?\n  \}/)?.[0];
assert.ok(aggregateMethod416,'Worker runAggregate194 source extraction failed');
let publicReadFails416=true,publicWindow416={windowId:id(101),publicMinutes:5};
let aggregateCalls416=0,repairCalls416=0,joinCalls416=0,pendingCalls416=0,readCalls416=0;
let signedWave416=false;
const workerAggregate416={scheduled:async(_ev,env)=>{
  aggregateCalls416++;
  assert.equal(env?.__SORIDRAW_STAGE416_PUBLIC_WINDOW_ACTIVE,true);
  return {changedTrackIds416:['canonical-changed-id'],
    stage416Changed416:signedWave416};
}};
const workerRepair416=async()=>{repairCalls416++;};
const workerJoin416=async(_storage,ids,_at,minutes)=>{
  assert.deepEqual(ids,['canonical-changed-id']);
  assert.equal(minutes,5);joinCalls416++;return {joined:true};
};
const workerPending416=async()=>{pendingCalls416++;return {staged:true};};
const makeWorkerRun416=(enabled,worker=workerAggregate416)=>new Function(
  'baseWorker','STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE',
  'COMMON_PUBLIC_LIKE_WINDOW_ACTIVE_448','PUBLIC_LIKE_WINDOW_KEY_416',
  'joinPublicLikeChangedTracks416','stagePublicLikeOpenPayload416',
  'repairSharedPublicLikeCounts191',
  'return ({'+aggregateMethod416+'}).runAggregate194;',
)(worker,enabled,false,PUBLIC_LIKE_WINDOW_KEY_416,workerJoin416,
  workerPending416,workerRepair416);
const workerContext416={env:{},ctx:{storage:{get:async key=>{
  assert.equal(key,PUBLIC_LIKE_WINDOW_KEY_416);readCalls416++;
  if(publicReadFails416)throw Error('INJECTED_PUBLIC_WINDOW_STORAGE_READ_FAILURE');
  return publicWindow416;
}}}};
const activeAggregate416=makeWorkerRun416(true);
await assert.rejects(activeAggregate416.call(workerContext416),
  /INJECTED_PUBLIC_WINDOW_STORAGE_READ_FAILURE/);
assert.equal(aggregateCalls416,0,'unknown public window must prevent canonical D1 mutation');
assert.equal(repairCalls416,0,'unknown public window must prevent premature R2/191 repair');
assert.equal(joinCalls416,0,'failed read must not fabricate an empty window');
publicReadFails416=false;
// Existing public window + ordinary legacy wave must remain immediate.
const ordinaryWhileOpen416=await activeAggregate416.call(workerContext416);
assert.equal(ordinaryWhileOpen416.publicWindowDeferred416,undefined,
  'ordinary users must not be delayed by a Master-only public window');
assert.equal(aggregateCalls416,1);
assert.equal(joinCalls416,0);
assert.equal(repairCalls416,0,'legacy 191 must not leak Master counts while public gate active');
// A signed Stage416 wave joins the already-open fixed public window.
signedWave416=true;
const signedWhileOpen416=await activeAggregate416.call(workerContext416);
assert.equal(signedWhileOpen416.publicWindowDeferred416,true);
assert.equal(joinCalls416,1);
assert.equal(repairCalls416,0);
publicWindow416=null;
const staged416=await activeAggregate416.call(workerContext416);
assert.equal(staged416.publicWindowDeferred416,true);
assert.equal(pendingCalls416,1,'new signed wave stages without an existing public window');
assert.equal(repairCalls416,0);
signedWave416=false;
const empty416=await activeAggregate416.call(workerContext416);
assert.equal(empty416.publicWindowDeferred416,undefined,
  'a genuine ordinary/empty wave may use the existing legacy path');
assert.equal(repairCalls416,0,'even ordinary wave must not invoke cross-track 191 while hold active');
const getCountBeforeOff416=readCalls416;
publicReadFails416=true;
const offAggregate416=makeWorkerRun416(false,{
  scheduled:async(_ev,env)=>{
    aggregateCalls416++;
    assert.equal(env?.__SORIDRAW_STAGE416_PUBLIC_WINDOW_ACTIVE,undefined);
    return {changedTrackIds416:[]};
  },
});
await offAggregate416.call(workerContext416);
assert.equal(readCalls416,getCountBeforeOff416,
  'Stage416 HARD OFF must never read public window storage');
assert.equal(repairCalls416,1,'Stage416 HARD OFF preserves one legacy repair call');

const registerAt=entry.indexOf("url.pathname==='/public-register'");
const registerBlock=entry.slice(registerAt,registerAt+1800);
assert.match(registerBlock,/mergePendingPublicLikeOpen416/);

const finalEndpoint=readFileSync('functions/src/exploreLikePrivateFinalEndpoint416.ts','utf8');
assert.match(finalEndpoint,/STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE=false/);
assert.match(finalEndpoint,/STAGE416_PREVIEW_PUBLIC_FIVE_MINUTE_ACTIVE=true/);

console.log('STAGE416_FIRST_CANONICAL_WAVE_PENDING_IDS_MERGE=PASS');
console.log('STAGE416_OPEN_WINDOW_ORDINARY_USERS_STAY_IMMEDIATE=PASS');
console.log('STAGE416_OPEN_WINDOW_SIGNED_IDS_ONLY_JOIN=PASS');
console.log('STAGE416_FIXED_DEADLINE_NO_EXTENSION=PASS');
console.log('STAGE416_PENDING_RETRY_W0=PASS');
console.log('STAGE416_PUBLIC_WINDOW_5000_IDS_PAGED_READ_CLEAR=PASS');
console.log('STAGE416_NET_CHANGED_IDS_SAME_D1_BATCH_SOURCE=PASS');
console.log('STAGE416_DEFERRED_WAVE_SKIPS_191_PUBLIC_LEAK=PASS');
console.log('STAGE416_PUBLIC_WINDOW_READ_FAILURE_FAIL_CLOSED_RETRY=PASS');
console.log('DEPLOYMENT=0');
console.log('SHARED_DATA_CHANGE=0');

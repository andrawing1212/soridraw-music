import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  PUBLIC_LIKE_PENDING_OPEN_KEY_416,
  PUBLIC_LIKE_WINDOW_KEY_416,
  ackPublicLikeEventStorage416,
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
  async get(key){return map.get(key);},
  async put(entries,value){
    if(typeof entries==='string'){
      map.set(entries,structuredClone(value));writes.push([entries]);return;
    }
    for(const [key,row] of Object.entries(entries))map.set(key,structuredClone(row));
    writes.push(Object.keys(entries).sort());
  },
  async list({prefix}={}){
    return new Map([...map].filter(([key])=>!prefix||key.startsWith(prefix)));
  },
  async delete(keys){
    const list=Array.isArray(keys)?keys:[keys];
    for(const key of list)map.delete(key);
    deletes.push(list);return list.length;
  },
};

const waveIds=Array.from({length:80},(_,i)=>'wave-'+String(i).padStart(3,'0'));
const staged=await stagePublicLikeOpenPayload416(storage,waveIds,base+5_000);
assert.equal(staged.staged,true);
assert.equal(staged.unchanged,false);
assert.equal(staged.trackCount,80);
const writeCount=writes.length;
const retryStage=await stagePublicLikeOpenPayload416(storage,[...waveIds].reverse(),base+6_000);
assert.equal(retryStage.unchanged,true,'exact pending wave retry must be DO W0');
assert.equal(writes.length,writeCount);
assert.equal(map.get(PUBLIC_LIKE_PENDING_OPEN_KEY_416).eventAtMs,base+5_000);

const firstEvent={eventId:id(1),windowCandidateId:id(101),eventAtMs:base+10_000,
  publicMinutes:5,trackIds:['stage-own-track']};
const opened=await registerPublicLikeEventStorage416(storage,firstEvent,base+10_000);
assert.equal(opened.opened,true);
assert.equal(opened.deadlineAtMs,base+310_000);
const merged=await mergePendingPublicLikeOpen416(storage,base+10_001);
assert.equal(merged.merged,true);
assert.equal(merged.trackCount,80);
assert.equal(map.has(PUBLIC_LIKE_PENDING_OPEN_KEY_416),false);

const duplicate=await registerPublicLikeEventStorage416(storage,firstEvent,base+11_000);
assert.equal(duplicate.duplicate,true,
  'merging canonical wave IDs must not alter event fingerprint/retry semantics');
assert.equal(duplicate.scheduleAtMs,base+310_000);

const legacyJoin=await joinPublicLikeChangedTracks416(
  storage,['legacy-a','wave-000'],base+309_000);
assert.equal(legacyJoin.joined,true);
assert.equal(legacyJoin.trackCount,2);
assert.equal(map.get(PUBLIC_LIKE_WINDOW_KEY_416).deadlineAtMs,base+310_000,
  'late legacy change must not extend fixed public deadline');

await ackPublicLikeEventStorage416(storage,firstEvent.eventId,base+12_000);
const state=await readPublicLikeReleaseState416(storage,base+310_000);
assert.equal(state.due,true);
assert.equal(state.blockedUnacked,false);
assert.equal(state.trackIds.length,82);
assert(state.trackIds.includes('legacy-a'));
assert(state.trackIds.includes('stage-own-track'));
for(const trackId of waveIds)assert(state.trackIds.includes(trackId));

const worker=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
assert.match(worker,/SORIDRAW_STAGE416_EXACT_PUBLIC_CHANGED_IDS_440_20261014/);
assert.match(worker,/MAX\(CASE WHEN d\.stage416_signed=1 THEN 1 ELSE 0 END\) AS stage416_signed/);
assert.match(worker,/HAVING SUM\(d\.delta\) <> 0/);
assert.match(worker,/changedTrackIds416/);
assert.match(worker,/stage416Changed416/);
assert.match(worker,/publicDeferred416:true/);
assert.match(worker,/env\?\.__SORIDRAW_DEFER_PUBLIC_416===true\|\|\s*totals\.stage416Changed416===true/);

const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
const runStart=entry.indexOf('async runAggregate194()');
const runEnd=entry.indexOf('async finalizeAggregate195()',runStart);
const run=entry.slice(runStart,runEnd);
assert.match(run,/PUBLIC_LIKE_WINDOW_KEY_416/);
assert.match(run,/__SORIDRAW_DEFER_PUBLIC_416/);
assert.match(run,/stagePublicLikeOpenPayload416/);
assert.match(run,/joinPublicLikeChangedTracks416/);
assert.ok(run.indexOf('return {...settledAggregate418,publicWindowDeferred416:true')<
  run.indexOf('await repairSharedPublicLikeCounts191(this.env)'),
  'deferred wave must exit before legacy 191 public repair can leak counts');
const registerAt=entry.indexOf("url.pathname==='/public-register'");
const registerBlock=entry.slice(registerAt,registerAt+1800);
assert.match(registerBlock,/mergePendingPublicLikeOpen416/);

const finalEndpoint=readFileSync('functions/src/exploreLikePrivateFinalEndpoint416.ts','utf8');
assert.match(finalEndpoint,/STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE=false/);

console.log('STAGE416_FIRST_CANONICAL_WAVE_PENDING_IDS_MERGE=PASS');
console.log('STAGE416_OPEN_WINDOW_LEGACY_CHANGED_IDS_JOIN=PASS');
console.log('STAGE416_FIXED_DEADLINE_NO_EXTENSION=PASS');
console.log('STAGE416_PENDING_RETRY_W0=PASS');
console.log('STAGE416_NET_CHANGED_IDS_SAME_D1_BATCH_SOURCE=PASS');
console.log('STAGE416_DEFERRED_WAVE_SKIPS_191_PUBLIC_LEAK=PASS');
console.log('DEPLOYMENT=0');
console.log('SHARED_DATA_CHANGE=0');

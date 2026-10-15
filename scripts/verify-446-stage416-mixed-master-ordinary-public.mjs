// Stage416 independent audit FAIL regression, 2026-10-15.
// The REAL Worker functions must not leak held Master deltas, nor disable
// ordinary 191 reconciliation, when both users change the SAME track.
// This test is deliberately failing on the audited 142667f2 source; do not
// merge or deploy until its two assertions pass on an implementation branch.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const worker=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
const extract=(source,start,end)=>{
  const i=source.indexOf(start), j=source.indexOf(end,i+start.length);
  assert.ok(i>=0&&j>i,'Worker extraction failed: '+start);
  return source.slice(i,j).trim();
};

const user075=extract(worker,
  'async function processExploreLikeUserQueueWave075(',
  '// SORIDRAW_LIKED_TRACK_PUBLIC_PROFILE_JOIN_056_20260915');
const actualPublished=[];
const stage416ClientWindow=true;
const simulatedDb={
  prepare:sql=>({
    bind:()=>({
      all:async()=>({results:[{track_id:'same-track',owner_uid:'owner-1',
        // Canonical after signed Master -1 AND ordinary +1: 10
        next_like_count:10}]}),
    }),
  }),
  batch:async()=>[
    {meta:{changes:1}},{meta:{changes:0}},{meta:{changes:1}},
    {meta:{changes:0}},{meta:{changes:1}},
  ],
};
const actual075=new Function('exploreLikeUserAggregateCte075',
  'EXPLORE_LIKE_USER_QUEUE_MAX_MUTATIONS_075',
  'patchExploreFeedR2Like044','patchExploreProfileR2Like044',
  'patchSharedFeedLikeCounts065','console',
  'return ('+user075.replace(/^async function /,'async function ')+');')(
    ()=>'',50,
    async(_env,trackId,count)=>{actualPublished.push(['feed',trackId,count]);return {ok:true};},
    async(_env,_owner,trackId,count)=>{actualPublished.push(['profile',trackId,count]);return {ok:true};},
    async(_env,rows)=>{actualPublished.push(['shared',rows[0].trackId,rows[0].likeCount]);return {ok:true};},
    {warn:()=>{}},
  );
await actual075({
  DB:simulatedDb,
  __SORIDRAW_STAGE416_PUBLIC_WINDOW_ACTIVE:stage416ClientWindow,
},Date.now(),Date.now(),false);
const counts=actualPublished.map(row=>row[2]);
const failure1=counts.some(count=>count!==11);
// Initial public count 10 + ordinary +1; Master -1 stays held until deadline.
console.log('STAGE416_SAME_TRACK_PUBLIC_EXPECTED=11 ACTUAL='+counts.join(','));

const method=extract(entry,
  'async runAggregate194() {',
  '// SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_JOIN_RACE_195_20260924');
const m=method.match(/async runAggregate194\(\) \{[\s\S]*?\n  \}/);
assert.ok(m,'Extract runAggregate194 method failed');
let repairCalls=0,normalCalls=0;
const normalScheduler=async()=>{normalCalls++;return {
  stage416Changed416:false,changedTrackIds416:[],changedTracks:1,
}};
const aggregate=new Function('baseWorker','STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE',
 'PUBLIC_LIKE_WINDOW_KEY_416','repairSharedPublicLikeCounts191',
 'joinPublicLikeChangedTracks416','stagePublicLikeOpenPayload416',
 'return ({'+m[0]+'}).runAggregate194')(
 {scheduled:normalScheduler},true,'stage416/public/current',
 async()=>{repairCalls++;return {changedTracks:1};},
 async()=>{},async()=>{},
);
await aggregate.call({env:{},ctx:{storage:{get:async()=>({windowId:'fixed',publicMinutes:5})}}});
const failure2=repairCalls!==1||normalCalls!==1;
console.log('STAGE416_ORDINARY_RECOVERY_EXPECTED=1 ACTUAL='+repairCalls);
assert.equal(failure1,false,'Stage416 same-track ordinary delta leaked signed Master unlike into public cache');
assert.equal(failure2,false,'Stage416 ordinary 191 repair blocked during Master public hold');
console.log('STAGE416_MIXED_TRACK_AND_191_RECOVERY=PASS');

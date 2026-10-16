import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  PUBLIC_LIKE_WINDOW_KEY_416,
  joinPublicLikeChangedTracks416,
  readPublicLikeReleaseState416,
  clearPublicLikeReleaseStorage416,
} from '../cloudflare/explore-worker/runtime/public-like-window-416.mjs';
import {
  settlePublicLikeCountsFromMembership448,
  planPublicLikeCountsFromMembership448,
  applyPublicLikeCountPlan448,
} from '../cloudflare/explore-worker/runtime/public-like-canonical-settle-448.mjs';
import {
  releaseDueCommonPublicLikeWindow448,
} from '../cloudflare/explore-worker/runtime/common-public-like-release-448.mjs';

const base=1_700_200_000_000;
const minute=60_000;
const map=new Map();
let alarm=null;
const storage={
  async transaction(fn){return fn(this);},
  async get(key){return map.get(key);},
  async put(entries,value){
    if(typeof entries==='string'){map.set(entries,structuredClone(value));return;}
    for(const [key,row] of Object.entries(entries))map.set(key,structuredClone(row));
  },
  async list({prefix,startAfter,limit}={}){
    let rows=[...map].filter(([key])=>!prefix||key.startsWith(prefix))
      .sort((a,b)=>a[0].localeCompare(b[0]));
    if(startAfter)rows=rows.filter(([key])=>key>startAfter);
    if(Number.isSafeInteger(limit)&&limit>0)rows=rows.slice(0,limit);
    return new Map(rows);
  },
  async delete(keys){
    for(const key of (Array.isArray(keys)?keys:[keys]))map.delete(key);
  },
  async getAlarm(){return alarm;},
  async setAlarm(value){alarm=value;},
  async deleteAlarm(){alarm=null;},
};

const a=await joinPublicLikeChangedTracks416(storage,['song'],base,20);
assert.equal(a.joined,true);
let window=await storage.get(PUBLIC_LIKE_WINDOW_KEY_416);
assert.equal(window.publicMinutes,20);
assert.equal(window.openedAtMs,base);
assert.equal(window.deadlineAtMs,base+20*minute);

const b=await joinPublicLikeChangedTracks416(storage,['song'],base+5*minute,20);
const c=await joinPublicLikeChangedTracks416(storage,['song'],base+15*minute,20);
assert.equal(b.joined,true);
assert.equal(c.joined,true);
window=await storage.get(PUBLIC_LIKE_WINDOW_KEY_416);
assert.equal(window.deadlineAtMs,base+20*minute,
  'later users must not extend the shared public deadline');

const state=await readPublicLikeReleaseState416(storage,base+20*minute);
assert.equal(state.due,true);
assert.equal(state.blockedUnacked,false);
assert.deepEqual(state.trackIds,['song'],
  'A/B/C on one song must collapse to one public changed-track entry');

const d=await joinPublicLikeChangedTracks416(storage,['song'],base+21*minute,20);
assert.equal(d.joined,false);
assert.equal(d.staged,true);
await clearPublicLikeReleaseStorage416(
  storage,state,base+21*minute,{alignSuccessorToPriorDeadline:true});
const next=await storage.get(PUBLIC_LIKE_WINDOW_KEY_416);
assert.equal(next.publicMinutes,20);
assert.equal(next.openedAtMs,base+20*minute);
assert.equal(next.deadlineAtMs,base+40*minute,
  'successor window must stay on the prior 20-minute cadence');
const nextStateBefore=await readPublicLikeReleaseState416(storage,base+39*minute);
assert.equal(nextStateBefore.due,false);
const nextState=await readPublicLikeReleaseState416(storage,base+40*minute);
assert.deepEqual(nextState.trackIds,['song']);

const preparedSql=[];
const fakeDb={
  prepare(sql){
    preparedSql.push(sql);
    return {bind(){return {all:async()=>{
      if(/SELECT t\.id AS track_id/.test(sql))return {
        results:[{track_id:'song',published_like_count:2,target_like_count:3}],
        meta:{changes:0},
      };
      if(/INSERT INTO track_stats/.test(sql))return {
        results:[{track_id:'song',like_count:3}],meta:{changes:1},
      };
      throw Error('unexpected 448 SQL');
    }};}};
  },
};
const planned=await planPublicLikeCountsFromMembership448(fakeDb,['song','song']);
assert.equal(planned.requestedTracks,1);
assert.equal(planned.changedTracks,1);
assert.deepEqual(planned.changedRows,[{
  trackId:'song',targetLikeCount:3,publishedLikeCount:2,
}]);
const applied=await applyPublicLikeCountPlan448(
  fakeDb,planned.changedRows,base+20*minute);
assert.equal(applied.d1Writes,1);
const settled=await settlePublicLikeCountsFromMembership448(
  fakeDb,['song','song'],base+20*minute);
assert.equal(settled.requestedTracks,1);
assert.equal(settled.changedTracks,1);
assert.equal(settled.d1Writes,1);
assert.equal(preparedSql.filter(sql=>/COUNT\(l\.user_uid\)/.test(sql)).length,2);
assert.ok(preparedSql.some(sql=>/SELECT t\.id AS track_id/.test(sql)));
assert.ok(preparedSql.some(sql=>/INSERT INTO track_stats/.test(sql)));
assert.ok(preparedSql.every(sql=>!/explore_like_public_hold_446/.test(sql)));

const zeroMap=new Map();
let zeroAlarm=null;
const zeroStorage={
  async transaction(fn){return fn(this);},
  async get(key){return zeroMap.get(key);},
  async put(entries,value){
    if(typeof entries==='string'){zeroMap.set(entries,structuredClone(value));return;}
    for(const [key,row] of Object.entries(entries))zeroMap.set(key,structuredClone(row));
  },
  async list({prefix,startAfter,limit}={}){
    let rows=[...zeroMap].filter(([key])=>!prefix||key.startsWith(prefix))
      .sort((a,b)=>a[0].localeCompare(b[0]));
    if(startAfter)rows=rows.filter(([key])=>key>startAfter);
    if(Number.isSafeInteger(limit)&&limit>0)rows=rows.slice(0,limit);
    return new Map(rows);
  },
  async delete(keys){for(const key of (Array.isArray(keys)?keys:[keys]))zeroMap.delete(key);},
  async getAlarm(){return zeroAlarm;},
  async setAlarm(value){zeroAlarm=value;},
  async deleteAlarm(){zeroAlarm=null;},
};
await joinPublicLikeChangedTracks416(zeroStorage,['song'],base,20);
const zeroSql=[];
const zeroDb={
  prepare(sql){
    zeroSql.push(sql);
    return {bind(){return {all:async()=>{
      if(!/SELECT t\.id AS track_id/.test(sql))throw Error('zero-net wrote D1');
      return {results:[{
        track_id:'song',published_like_count:3,target_like_count:3,
      }],meta:{changes:0}};
    }};}};
  },
};
const zeroRelease=await releaseDueCommonPublicLikeWindow448({
  db:zeroDb,r2:{},storage:zeroStorage,nowMs:base+20*minute,
});
assert.equal(zeroRelease.status,'NO_CHANGE');
assert.equal(zeroRelease.canonicalChangedTracks448,0);
assert.equal(zeroRelease.d1Writes,0);
assert.equal(zeroRelease.r2Reads,0);
assert.equal(zeroRelease.r2Writes,0);
assert.equal(zeroRelease.receiptStatus,'NO_PUBLIC_CHANGE');
assert.equal(zeroSql.length,1);
assert.equal(await zeroStorage.get(PUBLIC_LIKE_WINDOW_KEY_416),undefined);

const worker=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
const commonStart=worker.indexOf('SORIDRAW_COMMON_PUBLIC_LIKE_WINDOW_448_20261015');
const commonEnd=worker.indexOf('\n  const statements = [',commonStart);
assert.ok(commonStart>=0&&commonEnd>commonStart);
const commonBranch=worker.slice(commonStart,commonEnd);
assert.match(commonBranch,/INSERT OR IGNORE INTO likes/);
assert.match(commonBranch,/DELETE FROM likes/);
assert.match(commonBranch,/commonPublicChangedTrackIds448/);
assert.doesNotMatch(commonBranch,/INSERT INTO track_stats/);
assert.doesNotMatch(commonBranch,/UPDATE track_stats/);
assert.match(worker,/commonPublicDeferred448/);
assert.match(worker,/publicProjection:'deferred-448'/);
const queue075At=worker.indexOf('async function processExploreLikeUserQueueWave075');
const preread075At=worker.indexOf('SELECT DISTINCT track_id',queue075At);
const callback075At=worker.indexOf('__SORIDRAW_COMMON_PUBLIC_LIKE_PREREGISTER_448',queue075At);
const d1Batch075At=worker.indexOf('const result448 = await env.DB.batch([',queue075At);
assert.ok(queue075At>=0&&preread075At>queue075At&&callback075At>preread075At&&
  d1Batch075At>callback075At,
  '075 must discover delta IDs and durably preregister before membership/cursor D1 batch');
assert.match(worker.slice(queue075At,d1Batch075At),/WHERE delta <> 0/);
assert.match(worker.slice(queue075At,d1Batch075At),/448_PUBLIC_075_PREREGISTER_UNAVAILABLE/);

const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
assert.match(entry,/COMMON_PUBLIC_LIKE_WINDOW_ACTIVE_448 = true/);
assert.match(entry,/const STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE=false/);
assert.match(entry,/__SORIDRAW_COMMON_PUBLIC_LIKE_WINDOW_ACTIVE/);
assert.match(entry,/readCommonPublicLikeMinutes448/);
assert.match(entry,/joinPublicLikeChangedTracks416/);
assert.match(entry,/releaseDueCommonPublicLikeWindow448/);
assert.doesNotMatch(entry,/COMMON_PUBLIC_LIKE_DEFAULT_MINUTES_448/);
assert.match(entry,/448_PUBLIC_CONFIG_UNAVAILABLE/);
assert.match(entry,/__SORIDRAW_COMMON_PUBLIC_LIKE_PREREGISTER_448/);
assert.match(entry,/preregisterCommonPublicLikeTracks448/);
assert.match(entry,/448_PUBLIC_075_PREREGISTER_FAILED/);
const preregisterAt=entry.indexOf('Register the candidate track set durably BEFORE any D1 queue drain');
const activeMarkerAt=entry.indexOf('const activeAt = Number(',preregisterAt);
assert.ok(preregisterAt>=0&&activeMarkerAt>preregisterAt,
  'candidate track registration must happen before an active aggregate can drain D1');
const aggregateStart=entry.indexOf('async runAggregate194()');
const preflightAt=entry.indexOf('const preflightPublicMinutes448=',aggregateStart);
const baseScheduledAt=entry.indexOf('await baseWorker.scheduled({',aggregateStart);
assert.ok(preflightAt>aggregateStart&&baseScheduledAt>preflightAt,
  'public timing config must fail closed before canonical D1 settlement');

const release=readFileSync(
  'cloudflare/explore-worker/runtime/common-public-like-release-448.mjs','utf8');
const planAt=release.indexOf('planPublicLikeCountsFromMembership448(db,originalIds)');
const noChangeAt=release.indexOf("status:'NO_CHANGE'",planAt);
const checkpointAt=release.indexOf('await savePublicLikeCheckpoint416(storage,checkpoint)',planAt);
const applyAt=release.indexOf('await applyPublicLikeCountPlan448(db,planRows,nowMs)',checkpointAt);
const materializeAt=release.indexOf('materializePublicLikeProjection416({',applyAt);
const callbackAt=release.indexOf('sendPublicLikeRelease416({',materializeAt);
const publishedAt=release.indexOf('markPublicLikePublished416(storage,windowId)',callbackAt);
const clearAt=release.lastIndexOf('clearPublicLikeReleaseStorage416(');
assert.ok(planAt>=0&&noChangeAt>planAt&&checkpointAt>noChangeAt&&
  applyAt>checkpointAt&&materializeAt>applyAt&&callbackAt>materializeAt&&
  publishedAt>callbackAt&&clearAt>publishedAt,
  'release must plan -> zero-net exit OR checkpoint -> D1 apply -> R2 -> notify -> publish mark -> clear');
assert.match(release,/r2Reads:0,r2Writes:0/);
assert.match(release,/alignSuccessorToPriorDeadline:true/);

const client=readFileSync('src/services/exploreLikeService.ts','utf8');
assert.match(client,/COMMON_PUBLIC_LIKE_WINDOW_ACTIVE_448 = true/);
assert.match(client,/!STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE[\s\S]{0,160}!COMMON_PUBLIC_LIKE_WINDOW_ACTIVE_448/);

const config=readFileSync('functions/src/exploreLikePublicConfig448.ts','utf8');
assert.match(config,/readLikeBatchTimingAt416/);
assert.match(config,/publicMinutes: timing\.publicMinutes/);
assert.match(config,/Cache-Control", "no-store"/);

const adminPanel=readFileSync('src/components/Stage416LikeBatchMasterPanel.tsx','utf8');
assert.doesNotMatch(adminPanel,/개인 최종상태 서버 저장/);
assert.match(adminPanel,/모든 사용자 공개숫자 공동 집계/);
assert.match(adminPanel,/const changed = !!loaded && loaded\.publicMinutes !== draft\.publicMinutes/);
assert.match(adminPanel,/const latest = await getLatest\(\)/);
assert.match(adminPanel,/privateMinutes: base\.privateMinutes/);

console.log('COMMON_PUBLIC_448_A_B_C_ONE_WINDOW=PASS');
console.log('COMMON_PUBLIC_448_FIXED_DEADLINE_NO_EXTENSION=PASS');
console.log('COMMON_PUBLIC_448_SUCCESSOR_ALIGNED=PASS');
console.log('COMMON_PUBLIC_448_PERSONAL_RELATION_PUBLIC_COUNT_SEPARATED=PASS');
console.log('COMMON_PUBLIC_448_CHANGED_TRACK_ONLY_RECOUNT=PASS');
console.log('COMMON_PUBLIC_448_PREREGISTER_BEFORE_D1=PASS');
console.log('COMMON_PUBLIC_448_CONFIG_FAIL_CLOSED=PASS');
console.log('COMMON_PUBLIC_448_ZERO_NET_PUBLIC_IO_ZERO=PASS');
console.log('COMMON_PUBLIC_448_RELEASE_RETRY_CHECKPOINT=PASS');
console.log('COMMON_PUBLIC_448_075_PREREGISTER_BEFORE_D1=PASS');
console.log('COMMON_PUBLIC_448_ADMIN_INTERVAL_NEW_WINDOW_ONLY=PASS');
console.log('COMMON_PUBLIC_448_CLIENT_INVALIDATION_RELEASE_ONLY=PASS');
console.log('COMMON_PUBLIC_448_NO_446_D1_MIGRATION=PASS');
console.log('DEPLOYMENT=0');
console.log('SHARED_DATA_CHANGE=0');

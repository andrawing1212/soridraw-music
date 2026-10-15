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
} from '../cloudflare/explore-worker/runtime/public-like-canonical-settle-448.mjs';

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
    return {bind(){return {all:async()=>({
      results:[{track_id:'song',like_count:3}],meta:{changes:1},
    })};}};
  },
};
const settled=await settlePublicLikeCountsFromMembership448(
  fakeDb,['song','song'],base+20*minute);
assert.equal(settled.requestedTracks,1);
assert.equal(settled.changedTracks,1);
assert.equal(settled.d1Writes,1);
assert.equal(preparedSql.length,1);
assert.match(preparedSql[0],/COUNT\(l\.user_uid\)/);
assert.match(preparedSql[0],/WHERE track_stats\.like_count<>excluded\.like_count/);
assert.match(preparedSql[0],/WHERE t\.id IN \(/);
assert.doesNotMatch(preparedSql[0],/explore_like_public_hold_446/);

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

const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
assert.match(entry,/COMMON_PUBLIC_LIKE_WINDOW_ACTIVE_448 = true/);
assert.match(entry,/const STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE=false/);
assert.match(entry,/__SORIDRAW_COMMON_PUBLIC_LIKE_WINDOW_ACTIVE/);
assert.match(entry,/readCommonPublicLikeMinutes448/);
assert.match(entry,/joinPublicLikeChangedTracks416/);
assert.match(entry,/releaseDueCommonPublicLikeWindow448/);

const release=readFileSync(
  'cloudflare/explore-worker/runtime/common-public-like-release-448.mjs','utf8');
const settleAt=release.indexOf('settlePublicLikeCountsFromMembership448');
const materializeAt=release.indexOf('materializePublicLikeProjection416({db,r2,trackIds:ids})');
const callbackAt=release.indexOf('sendPublicLikeRelease416({');
const clearAt=release.indexOf('clearPublicLikeReleaseStorage416(');
assert.ok(settleAt>=0&&materializeAt>settleAt&&callbackAt>materializeAt&&clearAt>callbackAt,
  'public release must settle canonical count, project R2, notify, then clear');
assert.match(release,/alignSuccessorToPriorDeadline:true/);

const client=readFileSync('src/services/exploreLikeService.ts','utf8');
assert.match(client,/COMMON_PUBLIC_LIKE_WINDOW_ACTIVE_448 = true/);
assert.match(client,/!STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE[\s\S]{0,160}!COMMON_PUBLIC_LIKE_WINDOW_ACTIVE_448/);

const config=readFileSync('functions/src/exploreLikePublicConfig448.ts','utf8');
assert.match(config,/readLikeBatchTimingAt416/);
assert.match(config,/publicMinutes: timing\.publicMinutes/);
assert.match(config,/Cache-Control", "public, max-age=30"/);

console.log('COMMON_PUBLIC_448_A_B_C_ONE_WINDOW=PASS');
console.log('COMMON_PUBLIC_448_FIXED_DEADLINE_NO_EXTENSION=PASS');
console.log('COMMON_PUBLIC_448_SUCCESSOR_ALIGNED=PASS');
console.log('COMMON_PUBLIC_448_PERSONAL_RELATION_PUBLIC_COUNT_SEPARATED=PASS');
console.log('COMMON_PUBLIC_448_CHANGED_TRACK_ONLY_RECOUNT=PASS');
console.log('COMMON_PUBLIC_448_ADMIN_INTERVAL_NEW_WINDOW_ONLY=PASS');
console.log('COMMON_PUBLIC_448_CLIENT_INVALIDATION_RELEASE_ONLY=PASS');
console.log('COMMON_PUBLIC_448_NO_446_D1_MIGRATION=PASS');
console.log('DEPLOYMENT=0');
console.log('SHARED_DATA_CHANGE=0');

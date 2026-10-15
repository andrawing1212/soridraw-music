// Stage416 independent audit FAIL regression, 2026-10-15.
// The REAL Worker functions must not leak held Master deltas, nor disable
// ordinary 191 reconciliation, when both users change the SAME track.
// This test is deliberately failing on the audited 142667f2 source; do not
// merge or deploy until its two assertions pass on an implementation branch.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

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
// Use actual SQLite SQL rather than stubbing the expected count. The signed
// Master unlike has already settled D1 (-1) while the public projection still
// shows 10. The ordinary 075 wave must publish canonical 10 minus held -1 = 11.
const sqlite=new DatabaseSync(':memory:');
sqlite.exec(readFileSync('cloudflare/explore-worker/candidates/stage416-public-hold-446.sql','utf8'));
sqlite.exec(`
  CREATE TABLE track_stats(track_id TEXT PRIMARY KEY,like_count INTEGER,
    comment_count INTEGER DEFAULT 0,play_count INTEGER DEFAULT 0,updated_at INTEGER);
  CREATE TABLE likes(track_id TEXT,user_uid TEXT,created_at INTEGER,PRIMARY KEY(track_id,user_uid));
  CREATE TABLE explore_like_user_queue_state_075(id INTEGER PRIMARY KEY,processed_at INTEGER,processed_uid TEXT);
  INSERT INTO track_stats VALUES('same-track',9,0,0,0);
  INSERT INTO explore_like_user_queue_state_075 VALUES(1,0,'');
`);
sqlite.prepare('INSERT INTO explore_like_public_hold_446 VALUES(?,?,?,?)')
  .run('l069_1700000000000_'+('a'.repeat(64)),'same-track',1700000000000,-1);
const simpleCte075=`WITH args_075 AS (SELECT ? AS cutoff,? AS max),
  eligible AS (SELECT 'ordinary-user' AS user_uid,1700000001000 AS updated_at),
  valid AS (SELECT 'same-track' AS track_id,'ordinary-user' AS user_uid,
    1700000001000 AS mutation_at,1 AS desired_liked),
  deltas AS (SELECT 'same-track' AS track_id,'owner-1' AS owner_uid,
    'ordinary-user' AS user_uid,1 AS delta)`;
const simulatedDb={
  prepare:sql=>({
    bind:(...values)=>({
      all:async()=>({results:sqlite.prepare(sql).all(...values)}),
    }),
  }),
  batch:async statements=>{
    const out=[];
    sqlite.exec('BEGIN');
    try{
      for(const statement of statements){
        const row=statement._run();
        out.push({meta:{changes:row.changes}});
      }
      sqlite.exec('COMMIT');
      return out;
    }catch(error){sqlite.exec('ROLLBACK');throw error;}
  },
};
// SQLite mock covers the actual 075 five-statement D1 transaction.
simulatedDb.prepare=sql=>({
 bind:(...values)=>({
   all:async()=>({results:sqlite.prepare(sql).all(...values)}),
   _run:()=>sqlite.prepare(sql).run(...values),
 }),
});
const actual075=new Function('exploreLikeUserAggregateCte075',
  'EXPLORE_LIKE_USER_QUEUE_MAX_MUTATIONS_075',
  'patchExploreFeedR2Like044','patchExploreProfileR2Like044',
  'patchSharedFeedLikeCounts065','console',
  'return ('+user075.replace(/^async function /,'async function ')+');')(
    ()=>simpleCte075,50,
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
assert.equal(sqlite.prepare("SELECT like_count AS n FROM track_stats WHERE track_id='same-track'").get().n,10,'ordinary queue must commit its canonical delta');
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

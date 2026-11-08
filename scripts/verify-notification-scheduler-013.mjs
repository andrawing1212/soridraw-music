import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {
  runNotificationScheduled013,NOTIFICATION_RETENTION_CRON_013,
  NOTIFICATION_RETENTION_BATCH_LIMIT_013,NOTIFICATION_RETENTION_MAX_PASSES_013,
} from '../cloudflare/explore-worker/runtime/notification-retention-scheduler-013.mjs';

const read=p=>readFileSync(p,'utf8');
const entry=read('cloudflare/explore-worker/canonical/preview-entry.js');
const wrangler=JSON.parse(read('cloudflare/explore-worker/canonical/wrangler.preview.jsonc'));
assert.match(entry,/NOTIFICATION_RETENTION_013_COMPILED_OPEN = false/);
assert.match(entry,/controller\?\.cron === NOTIFICATION_RETENTION_CRON_013/);
assert.match(entry,/runNotificationScheduled013\(\{controller,env,compiledOpen:true\}\)/);
assert.ok(entry.indexOf('runNotificationScheduled013(') <
  entry.indexOf("controller?.cron === '* * * * *'"));
assert.equal(wrangler.triggers?.crons?.length||0,0,'cron must remain unregistered');
assert.equal(wrangler.vars?.SORIDRAW_NOTIFICATION_RETENTION_013,undefined);
assert.equal(wrangler.vars?.SORIDRAW_NOTIFICATION_SCHEMA_READY_013,undefined);
assert.equal(NOTIFICATION_RETENTION_CRON_013,'37 * * * *');
assert.equal(NOTIFICATION_RETENTION_BATCH_LIMIT_013,200);
assert.equal(NOTIFICATION_RETENTION_MAX_PASSES_013,8);

const sqlite=new DatabaseSync(':memory:');
sqlite.exec(
 'CREATE TABLE tracks(id TEXT PRIMARY KEY,owner_uid TEXT,title TEXT,is_public INTEGER,status TEXT);'+
 'CREATE TABLE public_profiles(uid TEXT PRIMARY KEY,nickname TEXT,is_public INTEGER);'+
 'CREATE TABLE likes(track_id TEXT,user_uid TEXT,created_at INTEGER,PRIMARY KEY(track_id,user_uid));'+
 'CREATE TABLE follows(follower_uid TEXT,following_uid TEXT,created_at INTEGER,PRIMARY KEY(follower_uid,following_uid));'+
 'CREATE TABLE explore_follow_overrides_348(follower_uid TEXT,following_uid TEXT,following INTEGER,baseline_following INTEGER,updated_at INTEGER,mutation_id TEXT,PRIMARY KEY(follower_uid,following_uid));'
);
sqlite.exec(read('cloudflare/explore-worker/candidates/20261107_01_notification_inbox_candidate.sql'));
sqlite.exec(read('cloudflare/explore-worker/candidates/20261108_01_notification_direct_messages_candidate.sql'));
const globalIndex=read('cloudflare/explore-worker/candidates/20261108_02_notification_announcement_expiry_candidate.sql');
sqlite.exec(globalIndex);
const metrics={reads:0,statements:0,physicalChanges:0};
const db={
 prepare(sql){return{
  bind(...values){const stmt=sqlite.prepare(sql);return{
   async first(){metrics.reads++;return stmt.get(...values)||null;},
   async all(){metrics.reads++;return {results:stmt.all(...values)};},
   async run(){metrics.statements++;const r=stmt.run(...values);
    metrics.physicalChanges+=r.changes;return {meta:{changes:r.changes}};},
  };},
  async first(){metrics.reads++;return sqlite.prepare(sql).get()||null;},
 };},
};
let etag=0,shouldFailPut=false;
const cache={
 stored:null,reads:0,writes:0,
 async get(){this.reads++;return this.stored&&{
  etag:this.stored.etag,json:async()=>this.stored.body};},
 async put(key,json,opts){
  assert.equal(key,'internal/notifications/global-announcements-v1.json');
  if(shouldFailPut){shouldFailPut=false;throw Error('SIMULATED_R2_FAILURE');}
  if(this.stored){
   if(opts?.onlyIf?.etagMatches!==this.stored.etag)return null;
  }else{
   assert.ok(opts?.onlyIf instanceof Headers);
   assert.equal(opts.onlyIf.get('If-None-Match'),'*');
  }
  this.writes++;this.stored={etag:'test-'+(++etag),body:JSON.parse(json)};
  return {etag:this.stored.etag};
 },
};
const env={DB:db,PROFILE_MEDIA:cache,
 SORIDRAW_NOTIFICATION_RETENTION_013:'1',
 SORIDRAW_NOTIFICATION_SCHEMA_READY_013:'1'};
const controller={cron:NOTIFICATION_RETENTION_CRON_013};
const now=1_800_000_000_000,cutoff=now-30*86400000;
const count=(table)=>sqlite.prepare('SELECT COUNT(*) AS n FROM '+table).get().n;
const expired=(table,column)=>sqlite.prepare('SELECT COUNT(*) AS n FROM '+
 table+' WHERE '+column+'<?').get(cutoff).n;
const tables=[
 ['soridraw_notification_inbox_001','created_at'],
 ['soridraw_notification_direct_messages_004','created_at'],
 ['soridraw_global_announcements_001','published_at'],
];
const snapshot=()=>({...metrics,cacheReads:cache.reads,cacheWrites:cache.writes});
const before=snapshot();
assert.equal((await runNotificationScheduled013({controller,env,now})).status,'inactive');
assert.equal((await runNotificationScheduled013({
 controller:{cron:'* * * * *'},env,compiledOpen:true,now})).status,'not-notification-cron');
assert.equal((await runNotificationScheduled013({
 controller,env:{...env,SORIDRAW_NOTIFICATION_RETENTION_013:'0'},compiledOpen:true,now})).status,'inactive');
assert.equal((await runNotificationScheduled013({
 controller,env:{...env,SORIDRAW_NOTIFICATION_SCHEMA_READY_013:undefined},compiledOpen:true,now})).status,'inactive');
assert.deepEqual(snapshot(),before,'OFF/mismatched cron must use R0/W0');
await assert.rejects(runNotificationScheduled013({
 controller,env:{...env,PROFILE_MEDIA:null},compiledOpen:true,now}),/MAINTENANCE_UNAVAILABLE/);
await assert.rejects(runNotificationScheduled013({
 controller,env,compiledOpen:true,now,maxPasses:9}),/MAINTENANCE_UNAVAILABLE/);
assert.equal(metrics.statements,0);
sqlite.exec('DROP INDEX idx_soridraw_global_expiry_005');
await assert.rejects(runNotificationScheduled013({
 controller,env,compiledOpen:true,now}),/EXPIRY_INDEXES_MISSING/);
assert.equal(metrics.statements,0,'missing index must fail before deletion');
sqlite.exec(globalIndex);
const off=await runNotificationScheduled013({controller,env,compiledOpen:true,now});
assert.equal(off.status,'latch-off');
assert.equal(metrics.statements,0,'latch OFF must never delete');
assert.equal(cache.reads,0);
const sourceCounts=()=>['likes','follows','tracks','public_profiles',
 'soridraw_notification_preferences_002'].map(name=>count(name));
const originalCounts=sourceCounts();
sqlite.exec('UPDATE soridraw_notification_activation_002 SET enabled=1 WHERE id=1');
const seed=(name,when)=>{
 sqlite.prepare('INSERT INTO soridraw_notification_inbox_001 VALUES(?,?,?,?,?,?,?,?)')
  .run('owner',Math.floor(when/7200000)*7200000,'like',
   'actor-'+name,'song-'+name,'Actor','Song',when);
 sqlite.prepare('INSERT INTO soridraw_notification_direct_messages_004 VALUES(?,?,?,?,?)')
  .run('owner',name,'Title','Body',when);
 sqlite.prepare('INSERT INTO soridraw_global_announcements_001 VALUES(?,?,?,?)')
  .run(name,'Title','Body',when);
};
for(let i=0;i<405;i++)seed('old-'+i,cutoff-i-1);
seed('boundary',cutoff);
const first=await runNotificationScheduled013({
 controller,env,compiledOpen:true,now,maxPasses:2});
assert.equal(first.status,'backlog');
assert.equal(first.passes,2);
assert.equal(first.rowsDeleted,1200);
assert.deepEqual(first.byCategory,{social:400,direct:400,announcement:400});
for(const [t,c] of tables)assert.equal(expired(t,c),5);
assert.equal(cache.writes,1,'single shared announcement snapshot; never fanout');
const second=await runNotificationScheduled013({
 controller,env,compiledOpen:true,now,maxPasses:2});
assert.equal(second.status,'ok');
assert.equal(second.rowsDeleted,15);
assert.deepEqual(second.byCategory,{social:5,direct:5,announcement:5});
assert.equal(second.r2Writes,0);
for(const [t,c] of tables){
 assert.equal(expired(t,c),0);
 assert.equal(count(t),1,'exact 30-day boundary preserved');
}
const changes=metrics.physicalChanges,puts=cache.writes;
const replay=await runNotificationScheduled013({
 controller,env,compiledOpen:true,now});
assert.equal(replay.status,'ok');
assert.equal(replay.rowsDeleted,0);
assert.equal(replay.r2Writes,0);
assert.equal(metrics.physicalChanges,changes,'no expired => D1 W0');
assert.equal(cache.writes,puts,'unchanged => shared cache W0');
assert.deepEqual(sourceCounts(),originalCounts,'canonical user source unchanged');
assert.equal(sqlite.prepare(
 'SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1').get().enabled,1);

seed('expired-retry',cutoff-1000);
sqlite.prepare('INSERT INTO soridraw_global_announcements_001 VALUES (?,?,?,?)')
 .run('fresh-announcement','Fresh','New',now-1000);
shouldFailPut=true;
await assert.rejects(runNotificationScheduled013({
 controller,env,compiledOpen:true,now}),/SIMULATED_R2_FAILURE/);
for(const [t,c] of tables)assert.equal(expired(t,c),0,
 'D1 deletion can settle before failed R2');
assert.equal(cache.stored.body.items.some(x=>x.id==='fresh-announcement'),false);
const resumed=await runNotificationScheduled013({
 controller,env,compiledOpen:true,now});
assert.equal(resumed.status,'ok');
assert.equal(resumed.rowsDeleted,0);
assert.equal(resumed.r2Writes,1);
assert.ok(cache.stored.body.items.some(x=>x.id==='fresh-announcement'),
 'next cron repairs failed announcement snapshot');
assert.deepEqual(sourceCounts(),originalCounts);
sqlite.close();
console.log('NOTIFICATION_013_PREVIEW_CRON_NOT_REGISTERED_COMPILE_OFF_R0_W0=PASS');
console.log('NOTIFICATION_013_WRONG_CRON_AND_FLAGS_R0_W0=PASS');
console.log('NOTIFICATION_013_INDEX_AND_LATCH_FAIL_CLOSED=PASS');
console.log('NOTIFICATION_013_BOUNDED_BACKLOG_DRAIN_30DAY_EDGE=PASS');
console.log('NOTIFICATION_013_EMPTY_REPLAY_D1_W0_R2_W0=PASS');
console.log('NOTIFICATION_013_R2_FAILURE_NEXT_TICK_RECOVERY=PASS');
console.log('NOTIFICATION_013_SHARED_CANONICAL_USER_DATA_UNCHANGED=PASS');

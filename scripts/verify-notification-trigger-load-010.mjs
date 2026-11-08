// SORIDRAW Stage010: isolated SQLite load. No Cloudflare credentials or IO.
// The Cloudflare billed row/CPU figures are NOT derived from SQLite.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const ROOT = 'cloudflare/explore-worker/candidates/';
const path001 = ROOT + '20261107_01_notification_inbox_candidate.sql';
const path007 = ROOT + '20261108_03_notification_inert_schema_release.sql';
const path009 = ROOT + '20261108_04_notification_triggers_off_release.sql';
const hash = content => createHash('sha1').update('blob '+Buffer.byteLength(content)+'\0').update(content).digest('hex');
const source = readFileSync(path001, 'utf8');
const schema = readFileSync(path007, 'utf8');
const triggers = readFileSync(path009, 'utf8');
assert.equal(hash(source), 'd206ffd8b3cc8d8755f9f7b1c2c0f205b72cf751');
assert.equal(hash(schema), 'd20f09f596032822f21ae279c59bce835b802469');
assert.equal(hash(triggers), '69c7be8779cf8b6b22aee023d41a1fc50b4f41a4');
const exactTriggerSql = [...source.matchAll(/CREATE TRIGGER IF NOT EXISTS ([a-z0-9_]+)[\s\S]*?END;/g)];
assert.equal(exactTriggerSql.length, 4);
for (const {0: statement} of exactTriggerSql) assert.ok(triggers.includes(statement));
const canonical = `
CREATE TABLE tracks(id TEXT PRIMARY KEY, owner_uid TEXT, title TEXT, is_public INTEGER, status TEXT);
CREATE TABLE public_profiles(uid TEXT PRIMARY KEY, nickname TEXT, is_public INTEGER);
CREATE TABLE likes(track_id TEXT, user_uid TEXT, created_at INTEGER, PRIMARY KEY(track_id,user_uid));
CREATE TABLE follows(follower_uid TEXT, following_uid TEXT, created_at INTEGER, PRIMARY KEY(follower_uid,following_uid));
CREATE TABLE explore_follow_overrides_348(follower_uid TEXT, following_uid TEXT, following INTEGER, baseline_following INTEGER, updated_at INTEGER, mutation_id TEXT, PRIMARY KEY(follower_uid,following_uid));
`;
const actorCount = 1000;
const ownerCount = 11;
const offEventsEach = 1000;
const onEventsEach = 10000;
const baseTime = 1800000000000;
function setup(withTrigger){
  const db=new DatabaseSync(':memory:');
  db.exec(canonical);
  db.exec(schema);
  if(withTrigger)db.exec(triggers);
  db.exec('BEGIN');
  const person=db.prepare('INSERT INTO public_profiles(uid,nickname,is_public) VALUES(?,?,1)');
  for(let n=0;n<actorCount;n++)person.run('actor'+n,'Actor '+n);
  for(let n=0;n<ownerCount;n++)person.run('owner'+n,'Owner '+n);
  const track=db.prepare("INSERT INTO tracks VALUES(?,?,?,1,'published')");
  for(let n=0;n<ownerCount;n++)track.run('song'+n,'owner0','Song '+n);
  db.exec('COMMIT');
  return db;
}
const legacy=setup(false), proposed=setup(true);
const statements=db=>({
 like:db.prepare('INSERT OR IGNORE INTO likes VALUES(?,?,?)'),
 follow:db.prepare('INSERT OR IGNORE INTO follows VALUES(?,?,?)'),
 overlay:db.prepare('INSERT OR IGNORE INTO explore_follow_overrides_348 VALUES(?,?,?,?,?,?)'),
});
const a=statements(legacy),b=statements(proposed);
const counter=db=>db.prepare('SELECT total_changes() AS n').get().n;
const inbox=db=>db.prepare('SELECT COUNT(*) AS n FROM soridraw_notification_inbox_001').get().n;
const start=process.hrtime.bigint();
const samples=[];
function apply(kind,i,expectedExtra){
  const actor='actor'+(i%actorCount);
  const owner='owner'+Math.floor(i/actorCount);
  const clock=baseTime+i;
  const args=kind==='like'?['song'+Math.floor(i/actorCount),actor,clock]
   :kind==='follow'?[actor,owner,clock]
   :[actor,owner,1,0,clock,'op-'+i];
  const first=counter(legacy),second=counter(proposed);
  const old=a[kind].run(...args),now=b[kind].run(...args);
  const delta=(counter(proposed)-second)-(counter(legacy)-first);
  assert.equal(now.changes,old.changes,'ACK divergence '+kind+'-'+i);
  assert.equal(delta,expectedExtra,'Unexpected extra logical writes '+kind+'-'+i);
  assert.ok(delta>=0&&delta<=1,'Over one logical notification write');
}
function runBatch(label,begin,end,on){
  const before=counter(proposed)-counter(legacy),oldInbox=inbox(proposed);
  for(let i=begin;i<end;i++){
   apply('like',i,on?1:0);
   apply('follow',i,on?1:0);
   apply('overlay',i,0); // identical follower + recipient + 2h bucket
  }
  const extra=(counter(proposed)-counter(legacy))-before;
  const expected=on?2*(end-begin):0;
  assert.equal(extra,expected);
  assert.equal(inbox(proposed)-oldInbox,expected);
  samples.push({label,operations:(end-begin)*3,extraLogicalWrites:extra,inboxRows:inbox(proposed)});
}
assert.equal(proposed.prepare('SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1').get().enabled,0);
runBatch('OFF',0,offEventsEach,false);
assert.equal(inbox(proposed),0,'OFF must remain W0');
for(const db of [legacy,proposed])db.prepare('UPDATE soridraw_notification_activation_002 SET enabled=1 WHERE id=1').run();
runBatch('ON_SIMULATION_ONLY',offEventsEach,offEventsEach+onEventsEach,true);
for(const db of [legacy,proposed])db.prepare('UPDATE soridraw_notification_activation_002 SET enabled=0 WHERE id=1').run();
const oldInbox=inbox(proposed);
for(let i=0;i<1000;i++){
 apply('like',offEventsEach+i,0);
 apply('follow',offEventsEach+i,0);
 apply('overlay',offEventsEach+i,0);
}
assert.equal(inbox(proposed),oldInbox,'Replay with latch OFF must never create rows');
for(const table of ['likes','follows','explore_follow_overrides_348','tracks','public_profiles']){
 const sql='SELECT * FROM '+table+' ORDER BY 1,2';
 const l=legacy.prepare(sql).all(),r=proposed.prepare(sql).all();
 assert.equal(l.length,r.length,'Canonical row count drift '+table);
 assert.equal(JSON.stringify(l),JSON.stringify(r),'Canonical content drift '+table);
}
assert.equal(inbox(proposed),2*onEventsEach);
assert.equal(inbox(legacy),0);
const duplicates=proposed.prepare('SELECT COUNT(*) AS n FROM (SELECT receiver_uid,bucket_ms,category,actor_uid,subject_id,COUNT(*) AS c FROM soridraw_notification_inbox_001 GROUP BY receiver_uid,bucket_ms,category,actor_uid,subject_id HAVING c>1)').get().n;
assert.equal(duplicates,0);
const elapsedMs=Number(process.hrtime.bigint()-start)/1e6;
console.log(JSON.stringify({kind:'SORIDRAW_NOTIFICATION_010_ISOLATED_LOAD',sourcePinned:true,
 samples,replayOffOperations:3000,replayOffExtraLogicalWrites:0,
 canonicalUnchanged:true,duplicateInboxKeys:duplicates,localElapsedMs:Number(elapsedMs.toFixed(1)),
 caution:'SQLite logical total_changes is NOT Cloudflare billed rows_written, rows_read, network latency or CPU. Synthetic fixture excludes other 17 production triggers.'}));
console.log('NOTIFICATION_010_OFF_W0_ON_BOUNDED_W1_AND_LEGACY_PARITY=PASS');
console.log('NOTIFICATION_010_SHARED_D1_SQL=0;REMOTE_DATA_WRITES=0;WORKER_DEPLOY=0');

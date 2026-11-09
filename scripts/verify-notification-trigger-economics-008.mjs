// Pure in-memory SQLite cost/compatibility probe for four dormant notification triggers.
// No network access, shared D1 mutation, Worker deploy or activation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const source=readFileSync('cloudflare/explore-worker/candidates/20261107_01_notification_inbox_candidate.sql','utf8');
const stage=readFileSync('cloudflare/explore-worker/candidates/20261108_03_notification_inert_schema_release.sql','utf8');
const hash=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
assert.equal(hash(source),'d206ffd8b3cc8d8755f9f7b1c2c0f205b72cf751');
assert.equal(hash(stage),'d20f09f596032822f21ae279c59bce835b802469');
const triggerNames=['soridraw_notification_like_insert_002',
 'soridraw_notification_follow_legacy_insert_002',
 'soridraw_notification_follow_overlay_insert_002',
 'soridraw_notification_follow_overlay_update_002'];
const parts=[...source.matchAll(/CREATE TRIGGER IF NOT EXISTS ([a-z0-9_]+)[\s\S]*?END;/g)];
assert.deepEqual(parts.map(m=>m[1]),triggerNames);
const triggers=parts.map(m=>m[0]).join('\n');
assert.equal((triggers.match(/INSERT OR IGNORE INTO soridraw_notification_inbox_001/g)||[]).length,4);
assert.equal((triggers.match(/SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1/g)||[]).length,4);
assert.doesNotMatch(triggers,/\b(?:DROP|ALTER|REPLACE|DELETE FROM likes|DELETE FROM follows|UPDATE likes|UPDATE follows)\b/i);
const active=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
const client=readFileSync('src/services/notifications/notificationInbox004.ts','utf8');
assert.match(active,/NOTIFICATION_INBOX_004_COMPILED_OPEN = false/);
assert.match(active,/NOTIFICATION_PREFS_003_COMPILED_OPEN = false/);
assert.match(client,/canUsePreviewInbox022\(window.location.hostname,EXPLORE_API_BASE\)/,
  'PREVIEW-only explicit authenticated GET; all other environments remain OFF');
assert.doesNotMatch(client,/NOTIFICATION_INBOX_ENABLED_004=false/);

const ddl=[
 'CREATE TABLE tracks(id TEXT PRIMARY KEY,owner_uid TEXT,title TEXT,is_public INTEGER,status TEXT);',
 'CREATE TABLE public_profiles(uid TEXT PRIMARY KEY,nickname TEXT,is_public INTEGER);',
 'CREATE TABLE likes(track_id TEXT,user_uid TEXT,created_at INTEGER,PRIMARY KEY(track_id,user_uid));',
 'CREATE TABLE follows(follower_uid TEXT,following_uid TEXT,created_at INTEGER,PRIMARY KEY(follower_uid,following_uid));',
 'CREATE TABLE explore_follow_overrides_348(follower_uid TEXT,following_uid TEXT,following INTEGER,baseline_following INTEGER,updated_at INTEGER,mutation_id TEXT,PRIMARY KEY(follower_uid,following_uid));',
 'CREATE TABLE legacy_events_008(id INTEGER PRIMARY KEY,event TEXT,actor TEXT,subject TEXT);',
 "CREATE TRIGGER legacy_like_i008 AFTER INSERT ON likes BEGIN INSERT INTO legacy_events_008(event,actor,subject) VALUES('like',NEW.user_uid,NEW.track_id); END;",
 "CREATE TRIGGER legacy_follow_i008 AFTER INSERT ON follows BEGIN INSERT INTO legacy_events_008(event,actor,subject) VALUES('follow',NEW.follower_uid,NEW.following_uid); END;",
 "CREATE TRIGGER legacy_overlay_i008 AFTER INSERT ON explore_follow_overrides_348 BEGIN INSERT INTO legacy_events_008(event,actor,subject) VALUES('overlay-insert',NEW.follower_uid,NEW.following_uid); END;",
 "CREATE TRIGGER legacy_overlay_u008 AFTER UPDATE OF following ON explore_follow_overrides_348 BEGIN INSERT INTO legacy_events_008(event,actor,subject) VALUES('overlay-update',NEW.follower_uid,NEW.following_uid); END;",
].join('\n');
const mirrors=['tracks','public_profiles','likes','follows','explore_follow_overrides_348','legacy_events_008','soridraw_notification_preferences_002'];
function makeDb(withCandidate){
 const db=new DatabaseSync(':memory:');
 db.exec(ddl);
 db.exec(stage); // The already approved Stage007 schema; here only :memory:
 db.exec("INSERT INTO public_profiles VALUES('owner','Owner',1),('actor','Actor',1),('actor2','Actor2',1),('actor3','Actor3',1),('actor4','Actor4',1),('actor5','Actor5',1),('actor6','Actor6',1),('hidden','Hidden',0);");
 db.exec("INSERT INTO tracks VALUES('song','owner','Song',1,'published'),('private','owner','Hidden Song',0,'published'),('draft','owner','Draft',1,'pending'),('own','actor','Own',1,'published');");
 const existing=new Map(db.prepare("SELECT name,sql FROM sqlite_schema WHERE sql IS NOT NULL").all().map(x=>[x.name,x.sql]));
 if(withCandidate)db.exec(triggers);
 const after=new Map(db.prepare("SELECT name,sql FROM sqlite_schema WHERE sql IS NOT NULL").all().map(x=>[x.name,x.sql]));
 for(const [n,sql] of existing)assert.equal(after.get(n),sql,'existing DDL changed: '+n);
 for(const n of triggerNames)assert.equal(after.has(n),withCandidate);
 return db;
}
const baseline=makeDb(false),candidate=makeDb(true);
const t=1_800_000_000_000,windowMs=7_200_000;
const changes=db=>db.prepare('SELECT total_changes() AS n').get().n;
const count=db=>db.prepare('SELECT COUNT(*) AS n FROM soridraw_notification_inbox_001').get().n;
const mirror=()=>{
 for(const n of mirrors)
 assert.deepEqual(candidate.prepare('SELECT * FROM '+n+' ORDER BY 1,2').all(),
                  baseline.prepare('SELECT * FROM '+n+' ORDER BY 1,2').all(),
                  'canonical/legacy writer drift: '+n);
};
let emitted=0,events=0;
function step(label,sql,args,expected){
 const prev=changes(baseline),next=changes(candidate),before=count(candidate);
 const old=baseline.prepare(sql).run(...args),newer=candidate.prepare(sql).run(...args);
 const extra=(changes(candidate)-next)-(changes(baseline)-prev);
 assert.equal(newer.changes,old.changes,label+' canonical statement ACK');
 assert.equal(extra,expected,label+' additional logical writes');
 assert.equal(count(candidate)-before,expected,label+' recipient-inbox row delta');
 assert.ok(extra===0||extra===1,label+' bounded W0/W1');
 mirror();emitted+=extra;events++;
}
const like=(track,actor,time,extra)=>step('like:'+track+':'+actor+':'+time,
 'INSERT OR IGNORE INTO likes VALUES (?,?,?)',[track,actor,time],extra);
const unlike=(track,actor)=>step('unlike:'+track+':'+actor,
 'DELETE FROM likes WHERE track_id=? AND user_uid=?',[track,actor],0);
const follow=(actor,target,time,extra)=>step('legacy-follow:'+actor+':'+target+':'+time,
 'INSERT OR IGNORE INTO follows VALUES (?,?,?)',[actor,target,time],extra);
const overlay=(actor,target,following,base,time,extra)=>step('overlay-insert:'+actor+':'+target+':'+time,
 'INSERT OR IGNORE INTO explore_follow_overrides_348 VALUES (?,?,?,?,?,?)',
 [actor,target,following,base,time,'op-'+actor+'-'+target],extra);
const flip=(actor,target,following,time,extra)=>step('overlay-update:'+actor+':'+following+':'+time,
 'UPDATE explore_follow_overrides_348 SET following=?,updated_at=? WHERE follower_uid=? AND following_uid=?',
 [following,time,actor,target],extra);
function latch(enabled){
 for(const db of [baseline,candidate])
  assert.equal(db.prepare('UPDATE soridraw_notification_activation_002 SET enabled=? WHERE id=1').run(enabled).changes,1);
}
function prefs(master,likeEnabled,followEnabled){
 for(const db of [baseline,candidate]){
  const q='INSERT INTO soridraw_notification_preferences_002(user_uid,master_enabled,like_enabled,follow_enabled,complete_enabled,announcement_enabled,message_enabled,revision,operation_id,updated_at) '+
   'VALUES (?,?,?,?,1,1,1,1,?,?) ON CONFLICT(user_uid) DO UPDATE SET master_enabled=excluded.master_enabled,like_enabled=excluded.like_enabled,follow_enabled=excluded.follow_enabled,revision=revision+1';
  db.prepare(q).run('owner',master,likeEnabled,followEnabled,'operation_owner_008',t);
 }
 mirror();
}
// Every legacy direct write must remain exactly the same when notifications OFF.
assert.equal(candidate.prepare('SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1').get().enabled,0);
like('song','actor',t,0);
follow('actor','owner',t,0);
overlay('actor2','owner',1,0,t,0);
flip('actor2','owner',0,t+1,0);
flip('actor2','owner',1,t+2,0);
assert.equal(count(candidate),0);
console.log('NOTIFICATION_008_OFF_LEGACY_WORKER_WRITER_PARITY_W0=PASS');
// Toggle is ONLY inside in-memory SQLite. Real shared D1 remains OFF.
latch(1);
like('song','actor2',t+1000,1);
like('song','actor2',t+1000,0); // duplicate ignored at canonical PK
unlike('song','actor2');
like('song','actor2',t+1200,0); // 2h bucket dedup
unlike('song','actor2');
like('song','actor2',t+windowMs,1);
like('private','actor3',t,0);
like('draft','actor3',t,0);
like('own','actor',t,0); // self
prefs(1,0,1);
like('song','actor3',t+1000,0); // like opt-out
prefs(0,1,1);
follow('actor3','owner',t+1000,0); // master opt-out
prefs(1,1,1);
like('song','actor4',t+2000,1);
follow('actor4','owner',t+3000,1);
follow('actor4','owner',t+3000,0); // duplicate
overlay('actor4','owner',1,0,t+3000,0); // legacy + overlay, dedup
overlay('actor3','owner',1,0,t+4000,1);
flip('actor3','owner',0,t+4500,0); // unfollow
flip('actor3','owner',1,t+5000,0); // same 2h bucket
flip('actor3','owner',0,t+windowMs+10,0);
flip('actor3','owner',1,t+windowMs+20,1);
overlay('actor5','owner',1,1,t+4000,0); // frozen baseline already followed
overlay('actor5','hidden',1,0,t+4000,0); // hidden target
overlay('actor6','owner',0,0,t+4000,0); // no initial follow
flip('actor6','owner',1,t+4500,1); // 0 -> 1
flip('actor6','owner',1,t+5500,0); // 1 -> 1
latch(0);
like('song','actor5',t+2*windowMs,0);
assert.equal(count(candidate),emitted);
assert.equal(count(baseline),0);
assert.deepEqual(candidate.prepare('SELECT DISTINCT receiver_uid FROM soridraw_notification_inbox_001').all().map(x=>x.receiver_uid),['owner']);
const duplicates=candidate.prepare('SELECT COUNT(*) AS n FROM (SELECT 1 FROM soridraw_notification_inbox_001 GROUP BY receiver_uid,bucket_ms,category,actor_uid,subject_id HAVING COUNT(*)>1)').get();
assert.equal(duplicates.n,0);

// Representative query plans: all trigger owner/profile/preferences lookup keys
// must be indexed in canonical schema. This is not a Cloudflare billing metric.
const plans=[
 candidate.prepare("EXPLAIN QUERY PLAN SELECT t.owner_uid FROM tracks AS t LEFT JOIN public_profiles AS actor ON actor.uid=? LEFT JOIN soridraw_notification_preferences_002 AS pref ON pref.user_uid=t.owner_uid WHERE t.id=? AND t.is_public=1 AND t.status='published'").all('actor','song'),
 candidate.prepare("EXPLAIN QUERY PLAN SELECT target.uid FROM public_profiles AS target LEFT JOIN public_profiles AS actor ON actor.uid=? LEFT JOIN soridraw_notification_preferences_002 AS pref ON pref.user_uid=target.uid WHERE target.uid=? AND target.is_public=1").all('actor','owner'),
];
assert.ok(plans[0].some(p=>/SEARCH t USING/.test(p.detail)),'indexed track owner lookup');
assert.ok(plans[1].some(p=>/SEARCH target USING/.test(p.detail)),'indexed follow target');
assert.ok(plans.every(xs=>xs.every(p=>!/SCAN (?:t|target|pref)\b/.test(p.detail))),'no unbounded join scan');
console.log('NOTIFICATION_008_FOUR_EXACT_TRIGGERS_NO_CANONICAL_SCHEMA_CHANGE=PASS');
console.log('NOTIFICATION_008_CANONICAL_AND_REPRESENTATIVE_LEGACY_TRIGGERS_PARITY=PASS');
console.log('NOTIFICATION_008_NOOP_UNLIKE_UNFOLLOW_PRIVATE_SELF_PREFS_W0=PASS');
console.log('NOTIFICATION_008_TWO_HOUR_DEDUP_CROSS_LEGACY_OVERLAY=PASS');
console.log('NOTIFICATION_008_INDEXED_OWNER_LOOKUPS=PASS');
console.log('NOTIFICATION_008_ISOLATED_OPERATIONS='+events);
console.log('NOTIFICATION_008_ISOLATED_ADDITIONAL_LOGICAL_WRITES='+emitted);
console.log('NOTIFICATION_008_REMOTE_D1_WRITES=0;WORKER_DEPLOY=0;TRIGGER_INSTALL=0');
console.log('NOTIFICATION_008_ACTUAL_CLOUDFLARE_BILLED_ROWS=NOT_MEASURED');

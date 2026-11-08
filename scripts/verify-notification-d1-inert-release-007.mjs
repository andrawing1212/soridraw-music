// D1 Stage007: only OFF tables/indexes. Pure SQLite tests; live mode SELECT only.
// Do not install like/follow triggers or change production Worker in this phase.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const sources=[
 'cloudflare/explore-worker/candidates/20261107_01_notification_inbox_candidate.sql',
 'cloudflare/explore-worker/candidates/20261108_01_notification_direct_messages_candidate.sql',
 'cloudflare/explore-worker/candidates/20261108_02_notification_announcement_expiry_candidate.sql',
];
const pinned=[
 'd206ffd8b3cc8d8755f9f7b1c2c0f205b72cf751',
 'fa53d91b0a9f9d49338ab8092678b3f11042aa97',
 'cc0829f6458d470c73779df685e474565658817e',
];
const gitHash=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
const [a,b,c]=sources.map((p,i)=>{
 const s=readFileSync(p,'utf8');assert.equal(gitHash(s),pinned[i],'CANDIDATE_SOURCE_DRIFT_'+p);return s;
});
const first=a.indexOf('CREATE TABLE IF NOT EXISTS'),cut=a.indexOf('-- Canonical 075');
const second=b.indexOf('CREATE TABLE IF NOT EXISTS'),third=c.indexOf('CREATE INDEX IF NOT EXISTS');
assert.ok(first>=0&&cut>first&&second>=0&&third>=0);
const candidate=
 '-- SORIDRAW NOTIFICATION SCHEMA-ONLY STAGE 007; SOURCE CANDIDATE, NO AUTO-APPLY.\n'+
 '-- 5 tables, 3 secondary indexes, single OFF latch row. NO TRIGGERS.\n'+
 '-- Owner-approved future trigger-only release PR required for real shared D1 installation.\n'+
 '-- On failure: preserve all data, no automatic DROP, no activation.\n'+
 a.slice(first,cut).trim()+'\n\n'+b.slice(second).trim()+'\n\n'+c.slice(third).trim()+'\n';
const sql=readFileSync('cloudflare/explore-worker/candidates/20261108_03_notification_inert_schema_release.sql','utf8');
assert.equal(sql,candidate,'STAGED_SQL_NOT_PINNED_SOURCE');
assert.equal(gitHash(sql),'d20f09f596032822f21ae279c59bce835b802469','STAGED_SQL_BLOB_DRIFT');
const stripped=sql.replace(/--.*$/gm,' ');
assert.doesNotMatch(stripped,/\b(?:DROP|ALTER|TRIGGER|DELETE|UPDATE|REPLACE|ATTACH|DETACH|VACUUM)\b/i);
assert.match(stripped,/INSERT INTO soridraw_notification_activation_002\(id, enabled\)\s*VALUES\(1, 0\) ON CONFLICT\(id\) DO NOTHING/);
const core="CREATE TABLE tracks(id TEXT PRIMARY KEY,owner_uid TEXT,title TEXT,is_public INTEGER,status TEXT);"+
"CREATE TABLE public_profiles(uid TEXT PRIMARY KEY,nickname TEXT,is_public INTEGER);"+
"CREATE TABLE likes(track_id TEXT,user_uid TEXT,created_at INTEGER,PRIMARY KEY(track_id,user_uid));"+
"CREATE TABLE follows(follower_uid TEXT,following_uid TEXT,created_at INTEGER,PRIMARY KEY(follower_uid,following_uid));"+
"CREATE TABLE explore_follow_overrides_348(follower_uid TEXT,following_uid TEXT,following INTEGER,baseline_following INTEGER,updated_at INTEGER,mutation_id TEXT,PRIMARY KEY(follower_uid,following_uid));";
const objectNames=[
 'soridraw_notification_activation_002','soridraw_notification_preferences_002',
 'soridraw_notification_inbox_001','soridraw_global_announcements_001','soridraw_notification_direct_messages_004',
 'idx_soridraw_notification_expiry_002','idx_soridraw_direct_expiry_004','idx_soridraw_global_expiry_005',
];
const triggerNames=[
 'soridraw_notification_like_insert_002','soridraw_notification_follow_legacy_insert_002',
 'soridraw_notification_follow_overlay_insert_002','soridraw_notification_follow_overlay_update_002',
];
const metadata=db=>new Map(db.prepare("SELECT name,type,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND type IN ('table','index','trigger')").all().map(x=>[x.name,x]));
const norm=s=>String(s||'').replace(/\bIF\s+NOT\s+EXISTS\b/gi,'').replace(/\s+/g,'').replace(/"/g,'').toLowerCase();
const full=new DatabaseSync(':memory:');full.exec(core);for(const s of [a,b,c])full.exec(s);
const expected=metadata(full);
for(const n of objectNames)assert.ok(expected.has(n),'MISSING_CANONICAL_CANDIDATE_'+n);
for(const n of triggerNames)assert.equal(expected.get(n)?.type,'trigger');
const db=new DatabaseSync(':memory:');db.exec(core);
db.exec("INSERT INTO tracks VALUES ('song','owner','Song',1,'published');"+
"INSERT INTO public_profiles VALUES ('owner','Owner',1);"+
"INSERT INTO public_profiles VALUES ('actor','Actor',1);"+
"INSERT INTO likes VALUES ('song','actor',100);"+
"INSERT INTO follows VALUES ('actor','owner',100);");
const before=metadata(db),rowsBefore=db.prepare('SELECT COUNT(*) AS n FROM likes').get().n;
db.exec(sql);db.exec(sql); // repeated schema-only install must be safe in isolated SQLite
const after=metadata(db),newObjects=[...after.keys()].filter(n=>!before.has(n));
assert.deepEqual(newObjects.sort(),[...objectNames].sort(),'EXACT_8_DDL_ONLY');
for(const n of objectNames)assert.equal(norm(after.get(n)?.sql),norm(expected.get(n)?.sql),'SCHEMA_MISMATCH_'+n);
for(const [n,o] of before)assert.equal(after.get(n)?.sql,o.sql,'CHANGED_CANONICAL_SCHEMA_'+n);
assert.equal(db.prepare('SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1').get().enabled,0);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM likes').get().n,rowsBefore);
db.exec("INSERT INTO likes VALUES ('song','owner',200);");
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM soridraw_notification_inbox_001').get().n,0);
for(const n of triggerNames)assert.equal(after.has(n),false,'TRIGGER_PREMATURE_'+n);
db.exec("UPDATE soridraw_notification_activation_002 SET enabled=1 WHERE id=1");
db.exec(sql);
assert.equal(db.prepare('SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1').get().enabled,1,
 'repeat cannot change latch, so only absent preflight permitted');
console.log('NOTIFICATION_007_PINNED_SQL_AND_8_INERT_OBJECTS=PASS');
console.log('NOTIFICATION_007_CANONICAL_TABLES_AND_ROWS_PRESERVED=PASS');
console.log('NOTIFICATION_007_NO_TRIGGERS_NO_CANONICAL_WRITE=PASS');
console.log('NOTIFICATION_007_REAPPLY_INERT_DDL_IDEMPOTENT=PASS');
const emitAt=process.argv.indexOf('--emit');
if(emitAt!==-1){
 const path=process.argv[emitAt+1],temp=process.env.RUNNER_TEMP;
 assert.ok(path&&temp&&path.startsWith(temp+'/'),'ONLY_EMIT_IN_RUNNER_TEMP');
 writeFileSync(path,sql,{flag:'wx',mode:0o600});
 console.log('NOTIFICATION_007_LOCAL_SQL_ARTIFACT_ONLY=PASS');
}
if(process.argv.includes('--self-test'))process.exit(0);
if(!process.argv.includes('--live-postflight'))throw Error('MODE_REQUIRED_SELFTEST_OR_LIVE_POSTFLIGHT');
const A=process.env.CLOUDFLARE_ACCOUNT_ID,T=process.env.CLOUDFLARE_API_TOKEN,D=process.env.SHARED_D1_ID;
assert.ok(A&&T&&D,'CLOUDFLARE_CREDENTIALS_REQUIRED');
let remoteWrites=0;
async function select(q,params=[]){
 assert.match(q,/^SELECT /);assert.doesNotMatch(q,/\b(?:INSERT|DELETE|UPDATE|CREATE|DROP|ALTER)\b/i);
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+A+'/d1/database/'+D+'/query',{
  method:'POST',headers:{Authorization:'Bearer '+T,'Content-Type':'application/json',Accept:'application/json'},
  body:JSON.stringify({sql:q,params})});
 const x=await r.json();
 assert.ok(r.ok&&x.success===true&&x.result?.length===1&&x.result[0].success===true,
  'D1_POSTFLIGHT_READ_FAILED_'+r.status);
 const n=Number(x.result[0].meta?.rows_written);
 assert.ok(Number.isFinite(n)&&n===0,'D1_POSTFLIGHT_UNEXPECTED_WRITE');
 remoteWrites+=n;return x.result[0].results;
}
const names=[...objectNames,...triggerNames];
const lookup="SELECT name,type,tbl_name,sql FROM sqlite_schema WHERE name IN ("+
 names.map(n=>"'"+n+"'").join(',')+") ORDER BY name";
assert.equal(db.prepare(lookup).all().length,8,'LOCAL_LIVE_SQL_COMPILE');
const actual=await select(lookup),liveMap=new Map(actual.map(r=>[r.name,r]));
assert.deepEqual([...liveMap.keys()].sort(),[...objectNames].sort(),'POSTFLIGHT_NO_TRIGGERS_EXACT_8');
for(const n of objectNames)assert.equal(norm(liveMap.get(n)?.sql),norm(expected.get(n)?.sql),'POSTFLIGHT_SCHEMA_DRIFT_'+n);
const latch=await select('SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1 LIMIT 1');
assert.equal(latch.length,1);assert.equal(Number(latch[0].enabled),0,'POSTFLIGHT_LATCH_NOT_OFF');
console.log('NOTIFICATION_007_LIVE_SCHEMA_ONLY_EXACT=PASS');
console.log('NOTIFICATION_007_LIVE_LATCH_OFF=PASS');
console.log('NOTIFICATION_007_REMOTE_ROWS_WRITTEN='+remoteWrites);

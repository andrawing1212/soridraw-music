// Shared D1 Stage008 trigger-only OFF release verifier. Self-test uses
// in-memory SQLite only; live pre/post execute SELECT-only metadata reads.
// No user row reads, synthetic mutations, activation or Worker deployment live.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

const ROOT='cloudflare/explore-worker/candidates/';
const base=readFileSync(ROOT+'20261107_01_notification_inbox_candidate.sql','utf8');
const stage=readFileSync(ROOT+'20261108_03_notification_inert_schema_release.sql','utf8');
const actual=readFileSync(ROOT+'20261108_04_notification_triggers_off_release.sql','utf8');
const gitHash=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
assert.equal(gitHash(base),'d206ffd8b3cc8d8755f9f7b1c2c0f205b72cf751');
assert.equal(gitHash(stage),'d20f09f596032822f21ae279c59bce835b802469');
assert.equal(gitHash(actual),'69c7be8779cf8b6b22aee023d41a1fc50b4f41a4');
const names=[
 'soridraw_notification_like_insert_002',
 'soridraw_notification_follow_legacy_insert_002',
 'soridraw_notification_follow_overlay_insert_002',
 'soridraw_notification_follow_overlay_update_002',
];
const expectedSource=[...base.matchAll(/CREATE TRIGGER IF NOT EXISTS ([a-z0-9_]+)[\s\S]*?END;/g)];
assert.deepEqual(expectedSource.map(x=>x[1]),names);
const exact='-- SOURCE-ONLY STAGE008. Four dormant notification triggers (latch 0).\n'+
 '-- No ALTER/DROP/DELETE/UPDATE or canonical data backfill.\n'+
 '-- This candidate must never be applied without separately approved one-use release.\n'+
 '-- No notification activation and no Worker/Hosting deploy.\n\n'+
 expectedSource.map(x=>x[0]).join('\n\n')+'\n';
assert.equal(actual,exact);
const stmts=[...actual.matchAll(/CREATE TRIGGER IF NOT EXISTS ([a-z0-9_]+)[\s\S]*?END;/g)];
assert.deepEqual(stmts.map(x=>x[1]),names);
const body=actual.replace(/--.*$/gm,' ');
assert.doesNotMatch(body,/\b(?:DROP|ALTER|REPLACE|ATTACH|DETACH|VACUUM)\b/i);
assert.doesNotMatch(body,/\b(?:DELETE\s+FROM|UPDATE|INSERT\s+(?:OR\s+\w+\s+)?INTO)\s+(?:likes|follows|tracks|public_profiles|explore_follow_overrides_348)\b/i);
assert.equal((body.match(/CREATE TRIGGER IF NOT EXISTS/g)||[]).length,4);
assert.equal((body.match(/SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1/g)||[]).length,4);
const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
assert.match(entry,/NOTIFICATION_INBOX_004_COMPILED_OPEN = false/);
assert.match(entry,/NOTIFICATION_PREFS_003_COMPILED_OPEN = false/);

const baseTables={
 likes:['track_id','user_uid','created_at'],
 follows:['follower_uid','following_uid','created_at'],
 explore_follow_overrides_348:['follower_uid','following_uid','following','baseline_following','updated_at'],
 tracks:['id','owner_uid','title','is_public','status'],
 public_profiles:['uid','nickname','is_public'],
};
const stageNames=[
 'soridraw_notification_activation_002','soridraw_notification_preferences_002',
 'soridraw_notification_inbox_001','soridraw_global_announcements_001',
 'soridraw_notification_direct_messages_004',
 'idx_soridraw_notification_expiry_002','idx_soridraw_direct_expiry_004',
 'idx_soridraw_global_expiry_005',
];
const normalize=s=>String(s||'').replace(/\bIF\s+NOT\s+EXISTS\b/gi,'')
 .replace(/"([a-z0-9_]+)"/gi,'$1').replace(/\s+/g,'')
 .toLowerCase();
const ddl=[
 'CREATE TABLE likes(track_id TEXT,user_uid TEXT,created_at INTEGER,PRIMARY KEY(track_id,user_uid));',
 'CREATE TABLE follows(follower_uid TEXT,following_uid TEXT,created_at INTEGER,PRIMARY KEY(follower_uid,following_uid));',
 'CREATE TABLE explore_follow_overrides_348(follower_uid TEXT,following_uid TEXT,following INTEGER,baseline_following INTEGER,updated_at INTEGER,mutation_id TEXT,PRIMARY KEY(follower_uid,following_uid));',
 'CREATE TABLE tracks(id TEXT PRIMARY KEY,owner_uid TEXT,title TEXT,is_public INTEGER,status TEXT);',
 'CREATE TABLE public_profiles(uid TEXT PRIMARY KEY,nickname TEXT,is_public INTEGER);',
].join('\n');
const mem=new DatabaseSync(':memory:');
mem.exec(ddl);mem.exec(stage);
const find=db=>new Map(db.prepare("SELECT name,type,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND type IN ('table','index','trigger')").all().map(x=>[x.name,x]));
const expectedStage=find(mem);
for(const n of stageNames)assert.ok(expectedStage.has(n),'MISSING_STAGE007_'+n);
assert.ok(names.every(n=>!expectedStage.has(n)));
const latch=db=>db.prepare('SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1 LIMIT 1').get()?.enabled;
assert.equal(latch(mem),0);
const before=find(mem);
mem.exec(actual);mem.exec(actual); // only ephemeral SQLite
const expectedFull=find(mem);
for(const n of names)assert.equal(expectedFull.get(n)?.type,'trigger');
for(const [n,row] of before)assert.equal(expectedFull.get(n)?.sql,row.sql);
assert.equal(latch(mem),0);
mem.exec("INSERT INTO public_profiles VALUES ('owner','Owner',1),('actor','Actor',1);"+
 "INSERT INTO tracks VALUES ('song','owner','Song',1,'published');"+
 "INSERT INTO likes VALUES ('song','actor',100);"+
 "INSERT INTO follows VALUES ('actor','owner',100);"+
 "INSERT INTO explore_follow_overrides_348 VALUES ('actor','owner',1,0,100,'op-test');");
assert.equal(mem.prepare('SELECT COUNT(*) AS n FROM soridraw_notification_inbox_001').get().n,0,
 'OFF triggers must never create notification content');
assert.equal(mem.prepare('SELECT COUNT(*) AS n FROM likes').get().n,1);
assert.equal(mem.prepare('SELECT COUNT(*) AS n FROM follows').get().n,1);
console.log('NOTIFICATION_009_PINNED_EXACT_FOUR_TRIGGER_DDL=PASS');
console.log('NOTIFICATION_009_OFF_LATCH_CANONICAL_WRITER_PARITY_W0=PASS');

const emit=process.argv.indexOf('--emit');
if(emit!==-1){
 const path=process.argv[emit+1],temp=process.env.RUNNER_TEMP;
 assert.ok(temp&&path?.startsWith(temp+'/'),'EXPLICIT_RUNNER_TEMP_ONLY');
 writeFileSync(path,actual,{flag:'wx',mode:0o600});
 console.log('NOTIFICATION_009_PINNED_SQL_EMITTED=PASS');
}
if(process.argv.includes('--self-test'))process.exit(0);
const isBefore=process.argv.includes('--live-before'),isAfter=process.argv.includes('--live-after');
if(isBefore===isAfter)throw Error('REQUIRE_EXPLICIT_LIVE_BEFORE_OR_AFTER');
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN,dbid=process.env.SHARED_D1_ID;
assert.ok(account&&token&&dbid&&process.env.RUNNER_TEMP,'LIVE_READONLY_CREDENTIAL_UNAVAILABLE');
let rowsWritten=0;
async function select(sql,params=[]){
 assert.match(sql,/^SELECT /);
 assert.ok(!sql.includes(';')&&!/\b(?:DROP|ALTER|UPDATE|DELETE|INSERT|CREATE|REPLACE|VACUUM|ATTACH|DETACH)\b/i.test(sql),
   'SELECT_ONLY');
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database/'+dbid+'/query',{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json'},
  body:JSON.stringify({sql,params}),signal:AbortSignal.timeout(18000)});
 const x=await r.json();
 assert.ok(r.ok&&x.success===true&&x.result?.length===1&&x.result[0].success===true&&
  Array.isArray(x.result[0].results),'D1_READONLY_METADATA_FAIL_'+r.status);
 const count=Number(x.result[0].meta?.rows_written);
 assert.ok(Number.isFinite(count)&&count===0,'REMOTE_ROWS_WRITTEN_UNEXPECTED');
 rowsWritten+=count;
 return x.result[0].results;
}
const coreNames=Object.keys(baseTables),looked=[...coreNames,...stageNames,...names];
const quoted=n=>{assert.match(n,/^[a-z][a-z0-9_]*$/);return "'"+n+"'";};
const schemaSql="SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND type IN ('table','index','trigger') AND (name IN ("+
 looked.map(quoted).join(',')+") OR (type='trigger' AND tbl_name IN ("+
 coreNames.map(quoted).join(',')+"))) ORDER BY name";
mem.prepare(schemaSql).all(); // exact SQL locally compiled before live
const remoteRows=await select(schemaSql);
const live=new Map(remoteRows.map(x=>[x.name,x]));
for(const [n,wanted] of Object.entries(baseTables)){
 assert.equal(live.get(n)?.type,'table','MISSING_CORE_'+n);
 const columns=await select('SELECT name,type,pk FROM pragma_table_info(?)',[n]);
 const found=new Set(columns.map(x=>x.name));
 assert.ok(wanted.every(x=>found.has(x)),'CORE_COLUMNS_DRIFT_'+n);
}
for(const n of stageNames){
 const observed=live.get(n),expected=expectedStage.get(n);
 assert.equal(observed?.type,expected.type,'STAGE007_TYPE_DRIFT_'+n);
 assert.equal(observed?.tbl_name,expected.tbl_name,'STAGE007_TARGET_DRIFT_'+n);
 assert.equal(normalize(observed?.sql),normalize(expected.sql),'STAGE007_DDL_DRIFT_'+n);
}
const activation=await select('SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1 LIMIT 1');
assert.equal(activation.length,1);
assert.equal(Number(activation[0].enabled),0,'NOTIFICATION_LATCH_MUST_REMAIN_OFF');
const existingTriggers=remoteRows.filter(x=>x.type==='trigger'&&!names.includes(x.name));
assert.equal(existingTriggers.length,17,'EXISTING_SOCIAL_TRIGGERS_DRIFT');
const snapshotFile=process.env.RUNNER_TEMP+'/notification-009-before.json';
const serialize=x=>JSON.stringify(x);
if(isBefore){
 assert.ok(names.every(n=>!live.has(n)),'ONE_OR_MORE_NOTIFICATION_TRIGGERS_ALREADY_EXIST');
 writeFileSync(snapshotFile,serialize(remoteRows),{flag:'wx',mode:0o600});
 console.log('NOTIFICATION_009_LIVE_PRE_EXISTING_17_TRIGGER_SCHEMAS=LOCKED');
 console.log('NOTIFICATION_009_LIVE_STAGE007_EXACT_OFF_AND_FOUR_ABSENT=PASS');
}else{
 const old=JSON.parse(readFileSync(snapshotFile,'utf8'));
 const oldMap=new Map(old.map(x=>[x.name,x]));
 for(const row of old){
  assert.deepEqual(live.get(row.name),row,'EXISTING_SCHEMA_MUTATED_'+row.name);
 }
 assert.equal(live.size,oldMap.size+4,'MORE_THAN_FOUR_NEW_OBJECTS');
 for(const n of names){
  const observed=live.get(n),expected=expectedFull.get(n);
  assert.equal(observed?.type,'trigger','NOTIFICATION_TRIGGER_MISSING_'+n);
  assert.equal(observed?.tbl_name,expected.tbl_name,'TRIGGER_TARGET_DRIFT_'+n);
  assert.equal(normalize(observed?.sql),normalize(expected.sql),'TRIGGER_SQL_DRIFT_'+n);
 }
 console.log('NOTIFICATION_009_LIVE_FOUR_EXACT_TRIGGERS=PASS');
 console.log('NOTIFICATION_009_LIVE_PREVIOUS_17_AND_STAGE007_UNCHANGED=PASS');
 console.log('NOTIFICATION_009_LIVE_LATCH_REMAINS_OFF=PASS');
}
console.log('NOTIFICATION_009_LIVE_METADATA_ROWS_WRITTEN='+rowsWritten);
console.log('NOTIFICATION_009_NO_USER_CONTENT_READ=PASS;WORKER_DEPLOY=0;TRIGGER_ACTIVATION=0');

// APP552: exact source candidate measured against ONE owned, synthetic D1.
// Shares no production D1 ID, cannot read or mutate a real user row.
// All objects/data are synthetic; deletion is exact UUID + name checked.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const root='cloudflare/explore-worker/candidates/';
const old=readFileSync(root+'546-owner-follow-epoch-floor-legacy-off.sql','utf8');
const overlay=readFileSync(root+'551-owner-follow-overlay-revision-off.sql','utf8');
assert.match(overlay,/SOURCE-ONLY.*DO NOT APPLY TO SHARED D1/);
assert.equal((overlay.match(/CREATE TRIGGER IF NOT EXISTS explore_owner_follow_overlay_/g)||[]).length,3);
const toStatements=sql=>{
 const triggers=[...sql.matchAll(/CREATE TRIGGER IF NOT EXISTS[\s\S]*?END;/g)].map(x=>x[0]);
 const rest=sql.replace(/CREATE TRIGGER IF NOT EXISTS[\s\S]*?END;/g,'')
  .replace(/^\s*--[^\n]*$/gm,'').trim();
 const parts=rest.split(';').map(x=>x.trim()).filter(Boolean);
 assert.ok(parts.every(s=>/^(?:CREATE TABLE IF NOT EXISTS|INSERT INTO explore_owner_follow_control_530|ALTER TABLE profile_stats ADD COLUMN|CREATE INDEX IF NOT EXISTS)/i.test(s)));
 assert.ok(triggers.every(s=>/\bCREATE TRIGGER IF NOT EXISTS\b/i.test(s)));
 return [...parts,...triggers];
};
const stmts=[...toStatements(old),...toStatements(overlay)];
assert.equal(stmts.filter(x=>/CREATE TRIGGER IF NOT EXISTS/i.test(x)).length,4);
assert.equal(stmts.filter(x=>/ALTER TABLE profile_stats/i.test(x)).length,10);
const table=[
 'CREATE TABLE profile_stats(uid TEXT PRIMARY KEY,follower_count INTEGER NOT NULL DEFAULT 0,following_count INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL DEFAULT 0)',
 'CREATE TABLE follows(follower_uid TEXT,following_uid TEXT,created_at INTEGER,PRIMARY KEY(follower_uid,following_uid))',
 'CREATE INDEX idx_follows_following_created ON follows(following_uid,created_at DESC,follower_uid)',
 'CREATE TABLE explore_follow_overrides_348(follower_uid TEXT NOT NULL,following_uid TEXT NOT NULL,following INTEGER NOT NULL,baseline_following INTEGER NOT NULL,updated_at INTEGER NOT NULL,mutation_id TEXT NOT NULL,PRIMARY KEY(follower_uid,following_uid))',
];
const local=new DatabaseSync(':memory:');
try{
 for(const sql of table)local.exec(sql);
 for(const sql of stmts)local.exec(sql);
 assert.equal(local.prepare('SELECT enabled FROM explore_owner_follow_control_530 WHERE id=1').get().enabled,0);
 assert.equal(local.prepare("SELECT COUNT(*) AS n FROM sqlite_schema WHERE type='trigger' AND name LIKE 'explore_owner_follow_%'").get().n,4);
}finally{local.close()}
console.log('APP552_ISOLATED_D1_SOURCE_DDL_SELFTEST=PASS');
if(process.argv.includes('--self-test'))process.exit(0);
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const runId=process.env.GITHUB_RUN_ID,attempt=process.env.GITHUB_RUN_ATTEMPT;
const temp=process.env.RUNNER_TEMP;
const SHARED='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
assert.equal(process.env.GITHUB_REPOSITORY,'andrawing1212/soridraw-music');
assert.equal(process.env.GITHUB_EVENT_NAME,'pull_request');
assert.equal(process.env.GITHUB_HEAD_REF,'candidate/app526-owner-follower-live-signal');
assert.equal(process.env.GITHUB_BASE_REF,'preview');
assert.equal(process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER,'914');
assert.equal(attempt,'1','NO_EXPENSIVE_RERUN');
assert.match(account||'',/^[0-9a-f]{32}$/);
assert.ok(token&&token.length>15);
assert.match(runId||'',/^[1-9]\d{5,}$/);
assert.ok(temp?.startsWith('/'));
const name='soridraw-follow-552-'+runId+'-'+attempt;
const record=join(temp,'soridraw-follow-552-owned.json');
const rootApi='https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const safeId=id=>{assert.ok(UUID.test(id||'')&&id!==SHARED,'SHARED_D1_ACCESS_DENIED');return id};
async function api(method,path,body){
 const res=await fetch(rootApi+path,{
  method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json'},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(25000)
 });
 let v;try{v=await res.json()}catch{throw Error('CLOUDFLARE_NON_JSON_'+res.status)}
 if(!res.ok||v.success!==true)throw Error('CLOUDFLARE_RESPONSE_'+method+'_'+res.status);
 return v.result;
}
async function assertOwned(id){
 safeId(id);
 const db=await api('GET','/'+id);
 assert.equal(db.name,name,'OWNER_NAME_DIFFERENT');
 assert.equal(db.uuid,id,'OWNER_UUID_DIFFERENT');
}
async function cleanup(id){
 await assertOwned(id);
 await api('DELETE','/'+safeId(id));
 if(existsSync(record))unlinkSync(record);
 const q=await api('GET','/'+id).catch(()=>null);
 assert.equal(q,null,'OWNED_D1_STILL_EXISTS');
 console.log('APP552_OWNED_EPHEMERAL_D1_REMOVED=PASS');
}
if(process.argv[2]==='cleanup'){
 if(!existsSync(record)){console.log('APP552_CLEANUP_NO_OWNED_RECORD=PASS');process.exit(0)}
 const owned=JSON.parse(readFileSync(record,'utf8'));
 assert.equal(owned.name,name);
 await cleanup(owned.uuid);
 process.exit(0);
}
assert.equal(process.argv.length,2);
if(existsSync(record))throw Error('RESIDUAL_OWNED_DATABASE');
let owned=null;
try{
 const created=await api('POST','',{name,primary_location_hint:'apac'});
 assert.equal(created.name,name);
 owned=safeId(created.uuid);
 writeFileSync(record,JSON.stringify({name,uuid:owned}),{flag:'wx',mode:0o600});
 await assertOwned(owned);
 async function sql(query,params=[]){
  assert.ok(typeof query==='string'&&query.length<15000&&Array.isArray(params)&&params.length<=10);
  const raw=await api('POST','/'+safeId(owned)+'/query',{sql:query,params});
  assert.ok(Array.isArray(raw)&&raw.length===1&&raw[0].success===true);
  const m=raw[0].meta||{};
  const meter={R:Number(m.rows_read),W:Number(m.rows_written),changes:Number(m.changes)};
  assert.ok(Object.values(meter).every(x=>Number.isFinite(x)&&x>=0),'METER_MISSING');
  return {rows:raw[0].results||[],meter};
 }
 for(const statement of table)await sql(statement);
 await sql("INSERT INTO profile_stats(uid,updated_at) VALUES('baseline',1),('off',1),('on',1),('unregistered',1)");
 const put=(who,n)=>sql(
  'INSERT OR IGNORE INTO explore_follow_overrides_348(follower_uid,following_uid,following,baseline_following,updated_at,mutation_id) VALUES(?,?,?,?,?,?)',
  ['actor-'+n,who,1,0,1800000000000,'m-'+n]);
 const baseline=await put('baseline','baseline');
 for(const stmt of stmts)await sql(stmt);
 const off=await put('off','off');
 const epoch='0123456789abcdef0123456789abcdef';
 await sql('UPDATE profile_stats SET owner_follow_auth_epoch_532=?,owner_follow_auth_created_at_ms_544=? WHERE uid=?',
  [epoch,1800000000000,'on']);
 await sql('UPDATE explore_owner_follow_control_530 SET enabled=1 WHERE id=1');
 const on=await put('on','on');
 const unregistered=await put('unregistered','unregistered');
 const duplicate=await put('on','on');
 const nop=await sql(
   'UPDATE explore_follow_overrides_348 SET following=1 WHERE following_uid=? AND follower_uid=? AND following<>1',
   ['on','actor-on']);
 const unfollow=await sql(
   'UPDATE explore_follow_overrides_348 SET following=0 WHERE following_uid=? AND follower_uid=? AND following<>0',
   ['on','actor-on']);
 const remove=await sql(
   'DELETE FROM explore_follow_overrides_348 WHERE following_uid=? AND follower_uid=?',
   ['on','actor-on']);
 const revision=await sql('SELECT owner_follow_revision_530 AS revision,owner_follow_overlay_delta_551 AS delta FROM profile_stats WHERE uid=?',['on']);
 assert.equal(Number(revision.rows[0]?.revision),2,'CHANGED_ONLY_REVISION_ERROR');
 assert.equal(Number(revision.rows[0]?.delta),0,'FOLLOW_UNFOLLOW_EFFECTIVE_DELTA');
 assert.equal(duplicate.meter.W,0,'NOOP_INSERT_MUST_BE_W0');
 assert.equal(nop.meter.W,0,'NOOP_UPDATE_MUST_BE_W0');
 assert.equal(unregistered.meter.W,off.meter.W,
  'UNREGISTERED_OWNER_MUST_NOT_WRITE_OWNER_QUEUE');
 assert.ok(on.meter.W>=baseline.meter.W,
  'ENABLED_TRIGGER_CANNOT_HAVE_LOWER_WRITTEN_COUNT');
 const out={
  sourceHash:createHash('sha256').update(old+overlay).digest('hex'),
  ownedDb:name,sharedAccess:0,additionalFunctionOrRTDB:0,
  physicalRows:{
   overlayWithoutTrigger:baseline.meter,
   overlayTriggerOff:off.meter,
   overlayOnEnrolled:on.meter,
   overlayOnUnregistered:unregistered.meter,
   repeatedInsert:duplicate.meter,
   guardedNoopUpdate:nop.meter,
   realUnfollow:unfollow.meter,
   removeBaselineEquivalentOverride:remove.meter,
  },
  incrementalOnW:on.meter.W-off.meter.W,
  warning:'Synthetic D1 and exact APP546/APP551 trigger source only; excludes deployed Stage029 notification triggers, Worker/R2 materialization, Firebase, browser and 100k-user billing'
 };
 console.log('APP552_PHYSICAL_ROWS='+JSON.stringify(out));
 console.log('APP552_SHARED_D1_WRITES_ZERO_WORKER_DEPLOY_ZERO=PASS');
}finally{
 if(owned)await cleanup(owned);
}
console.log('APP552_PHYSICAL_D1_AND_OWNED_CLEANUP=PASS');

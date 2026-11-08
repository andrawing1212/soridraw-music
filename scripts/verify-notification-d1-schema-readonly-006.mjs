// Read-only shared D1 schema preflight. NO migration or user rows.
// Remote D1 API POST carries ONLY guarded SELECT; verify rows_written=0.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const core={
 likes:['track_id','user_uid','created_at'],
 tracks:['id','owner_uid','title','is_public','status'],
 public_profiles:['uid','nickname','is_public'],
 follows:['follower_uid','following_uid','created_at'],
 explore_follow_overrides_348:['follower_uid','following_uid','following','baseline_following','updated_at'],
};
const objects={
 soridraw_notification_activation_002:'table',
 soridraw_notification_preferences_002:'table',
 soridraw_notification_inbox_001:'table',
 soridraw_global_announcements_001:'table',
 soridraw_notification_direct_messages_004:'table',
 idx_soridraw_notification_expiry_002:'index',
 idx_soridraw_direct_expiry_004:'index',
 idx_soridraw_global_expiry_005:'index',
 soridraw_notification_like_insert_002:'trigger',
 soridraw_notification_follow_legacy_insert_002:'trigger',
 soridraw_notification_follow_overlay_insert_002:'trigger',
 soridraw_notification_follow_overlay_update_002:'trigger',
};
const candidates=[
 'cloudflare/explore-worker/candidates/20261107_01_notification_inbox_candidate.sql',
 'cloudflare/explore-worker/candidates/20261108_01_notification_direct_messages_candidate.sql',
 'cloudflare/explore-worker/candidates/20261108_02_notification_announcement_expiry_candidate.sql',
];
const trimSql=s=>String(s||'').replace(/\bIF\s+NOT\s+EXISTS\b/gi,'')
 .replace(/"([a-z0-9_]+)"/gi,'$1').replace(/\s+/g,' ')
 .replace(/\s*([(),=<>])\s*/g,'$1').trim().toLowerCase();
const sqlite=new DatabaseSync(':memory:');
sqlite.exec('CREATE TABLE likes(track_id TEXT,user_uid TEXT,created_at INTEGER,PRIMARY KEY(track_id,user_uid));'
 +'CREATE TABLE tracks(id TEXT PRIMARY KEY,owner_uid TEXT,title TEXT,is_public INTEGER,status TEXT);'
 +'CREATE TABLE public_profiles(uid TEXT PRIMARY KEY,nickname TEXT,is_public INTEGER);'
 +'CREATE TABLE follows(follower_uid TEXT,following_uid TEXT,created_at INTEGER,PRIMARY KEY(follower_uid,following_uid));'
 +'CREATE TABLE explore_follow_overrides_348(follower_uid TEXT,following_uid TEXT,following INTEGER,baseline_following INTEGER,updated_at INTEGER,mutation_id TEXT,PRIMARY KEY(follower_uid,following_uid));');
for(const p of candidates){
 const source=readFileSync(p,'utf8');
 assert.match(source,/SOURCE-ONLY|NO SHARED D1 MIGRATION/);
 assert.doesNotMatch(source,/\b(?:DROP|ALTER|REPLACE)\s+(?:TABLE|INDEX|TRIGGER)\b/i);
 assert.doesNotMatch(source,/\b(?:UPDATE|DELETE FROM)\s+(?:likes|follows|tracks|public_profiles|explore_follow_overrides_348)\b/i);
 sqlite.exec(source); // ONLY isolated in-memory SQLite
}
assert.equal(sqlite.prepare('SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1').get().enabled,0);
const metadata=db=>db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND type IN ('table','index','trigger')").all();
const columns=(db,n)=>db.prepare('SELECT name,type,pk FROM pragma_table_info(?)').all(n);
const expected=Object.fromEntries(metadata(sqlite).filter(x=>Object.hasOwn(objects,x.name)).map(x=>[x.name,x]));
assert.deepEqual(Object.keys(expected).sort(),Object.keys(objects).sort());
const expectedColumns=Object.fromEntries(Object.keys(objects).filter(n=>objects[n]==='table').map(n=>[n,columns(sqlite,n)]));
const equalCols=(a,b)=>JSON.stringify((a||[]).map(x=>[x.name,String(x.type).toUpperCase(),Number(x.pk)]))===
 JSON.stringify((b||[]).map(x=>[x.name,String(x.type).toUpperCase(),Number(x.pk)]));
function review(rows,cols,latch){
 const byName=new Map(rows.map(x=>[String(x.name).toLowerCase(),x]));
 const coreMissing=[];
 for(const [n,required] of Object.entries(core)){
  const has=new Set((cols[n]||[]).map(x=>String(x.name).toLowerCase()));
  if(byName.get(n)?.type!=='table'||required.some(c=>!has.has(c)))coreMissing.push(n);
 }
 const existing=[],drift=[];
 for(const [n,t] of Object.entries(objects)){
  const r=byName.get(n);if(!r)continue;existing.push(n);
  if(r.type!==t||String(r.tbl_name).toLowerCase()!==expected[n].tbl_name.toLowerCase()||
     trimSql(r.sql)!==trimSql(expected[n].sql))drift.push(n+':schema');
  if(t==='table'&&!equalCols(cols[n],expectedColumns[n]))drift.push(n+':columns');
 }
 if(existing.includes('soridraw_notification_activation_002')&&latch!==0)drift.push('notification-latch-not-off');
 const partial=existing.length!==0&&existing.length!==Object.keys(objects).length;
 const overlapping=rows.filter(x=>x.type==='trigger'&&Object.hasOwn(core,x.tbl_name)&&!Object.hasOwn(objects,x.name)).map(x=>x.name);
 return{verdict:coreMissing.length||drift.length||partial?'NO_GO':existing.length?'PASS_EXACT_EXISTING':'PASS_ABSENT',
  coreMissing,drift,partial,existing,overlapping};
}
const baseRows=metadata(sqlite).filter(x=>Object.hasOwn(core,x.name));
const baseCols=Object.fromEntries(Object.keys(core).map(n=>[n,columns(sqlite,n)]));
assert.equal(review(baseRows,baseCols,null).verdict,'PASS_ABSENT');
assert.equal(review(baseRows.filter(x=>x.name!=='likes'),baseCols,null).verdict,'NO_GO');
assert.equal(review([...baseRows,expected.soridraw_notification_activation_002],baseCols,0).verdict,'NO_GO');
assert.equal(review([...baseRows,{...expected.soridraw_notification_inbox_001,sql:'CREATE TABLE soridraw_notification_inbox_001(id TEXT)'}],baseCols,0).verdict,'NO_GO');
console.log('NOTIFICATION_D1_LOCAL_SCHEMA_CANDIDATE_AND_COLLISION=PASS');
// Assemble the exact remote lookup once and compile it with local SQLite
// before any live request; missing parentheses must fail the PR self-test.
const names=[...Object.keys(core),...Object.keys(objects)],baseNames=Object.keys(core);
const safeName=n=>{if(!/^[a-z][a-z0-9_]*$/.test(n))throw Error('UNSAFE_METADATA_IDENTIFIER');return "'"+n+"'";};
const liveSchemaSql=
 "SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE type IN ('table','index','trigger') AND (name IN ("+
 names.map(safeName).join(',')+") OR (type='trigger' AND tbl_name IN ("+
 baseNames.map(safeName).join(',')+"))) ORDER BY type,name";
assert.ok(sqlite.prepare(liveSchemaSql).all().length>0);
assert.equal(sqlite.prepare('SELECT name,type,pk FROM pragma_table_info(?)').all('likes').length>0);
console.log('NOTIFICATION_D1_LOCAL_LIVE_SQL_COMPILE=PASS');
if(process.argv.includes('--self-test'))process.exit(0);
if(!process.argv.includes('--live'))throw Error('REQUIRE_EXPLICIT_LIVE_OR_SELFTEST');
const a=process.env.CLOUDFLARE_ACCOUNT_ID,t=process.env.CLOUDFLARE_API_TOKEN,d=process.env.SHARED_D1_ID;
if(!a||!t||!d)throw Error('NOTIFICATION_READONLY_CREDENTIAL_MISSING');
let written=0;
async function select(sql,params=[]){
 if(!/^SELECT\s/i.test(sql)||sql.includes(';')||
  /\b(?:INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|REPLACE|PRAGMA|ATTACH|DETACH|VACUUM)\b/i.test(sql))
  throw Error('NOTIFICATION_NONSELECT_REFUSED');
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+a+'/d1/database/'+d+'/query',{
  method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json',Accept:'application/json'},
  body:JSON.stringify({sql,params})});
 const x=await response.json();
 if(!response.ok||x.success!==true||!Array.isArray(x.result)||x.result.length!==1||
    x.result[0].success!==true||!Array.isArray(x.result[0].results)){
  const error=x.errors?.[0]||x.result?.[0]?.error||{};
  const code=String(error.code||'NONE').slice(0,16).replace(/[^A-Za-z0-9_-]/g,'');
  const detail=String(error.message||'').slice(0,180)
    .replace(/Bearer\s+\S+/gi,'[REDACTED]').replace(/[\r\n]/g,' ');
  throw Error('NOTIFICATION_D1_METADATA_READ_FAILED_HTTP_'+response.status+'_CODE_'+code+'_DETAIL_'+detail);
 }
 const n=Number(x.result[0].meta?.rows_written);
 if(!Number.isFinite(n)||n!==0)throw Error('NOTIFICATION_D1_WRITE_STATUS_INVALID');
 written+=n;
 return x.result[0].results;
}
const rows=await select(liveSchemaSql);
const cols={};
for(const n of baseNames)cols[n]=await select('SELECT name,type,pk FROM pragma_table_info(?)',[n]);
for(const n of Object.keys(objects))if(objects[n]==='table'&&rows.some(x=>String(x.name).toLowerCase()===n))
 cols[n]=await select('SELECT name,type,pk FROM pragma_table_info(?)',[n]);
let latch=null;
if(rows.some(x=>String(x.name).toLowerCase()==='soridraw_notification_activation_002')){
 const v=await select('SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1 LIMIT 1');
 latch=v.length===1?Number(v[0].enabled):null;
}
const r=review(rows,cols,latch);
console.log('NOTIFICATION_D1_CORE_MISSING='+JSON.stringify(r.coreMissing));
console.log('NOTIFICATION_D1_OBJECTS_EXISTING='+r.existing.join(','));
console.log('NOTIFICATION_D1_COLLISIONS='+JSON.stringify(r.drift));
console.log('NOTIFICATION_D1_PARTIAL='+r.partial);
console.log('NOTIFICATION_D1_OTHER_CORE_TRIGGERS='+r.overlapping.join(','));
console.log('NOTIFICATION_D1_ACTIVATION='+String(latch));
console.log('NOTIFICATION_D1_PREDEPLOY_VERDICT='+r.verdict);
console.log('NOTIFICATION_D1_REMOTE_ROWS_WRITTEN='+written);
console.log('WORKER_DEPLOY=0;D1_MIGRATION=0;R2_WRITES=0;USER_ROWS_QUERIED=0');
if(r.verdict==='NO_GO')process.exitCode=1;

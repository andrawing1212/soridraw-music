// SORIDRAW Stage011: real D1 rows_read/rows_written on ONE owned ephemeral database.
// This script has NO production/shared database lookup, binding, Worker deployment,
// user record read or mutation, and only deletes its run-owned transient database.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';

const ROOT='cloudflare/explore-worker/candidates/';
const source=readFileSync(ROOT+'20261107_01_notification_inbox_candidate.sql','utf8');
const stage=readFileSync(ROOT+'20261108_03_notification_inert_schema_release.sql','utf8');
const triggerSource=readFileSync(ROOT+'20261108_04_notification_triggers_off_release.sql','utf8');
const sha1=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
assert.equal(sha1(source),'d206ffd8b3cc8d8755f9f7b1c2c0f205b72cf751');
assert.equal(sha1(stage),'d20f09f596032822f21ae279c59bce835b802469');
assert.equal(sha1(triggerSource),'69c7be8779cf8b6b22aee023d41a1fc50b4f41a4');
const triggers=[...triggerSource.matchAll(/CREATE TRIGGER IF NOT EXISTS ([a-z0-9_]+)[\s\S]*?END;/g)];
assert.deepEqual(triggers.map(t=>t[1]),[
 'soridraw_notification_like_insert_002',
 'soridraw_notification_follow_legacy_insert_002',
 'soridraw_notification_follow_overlay_insert_002',
 'soridraw_notification_follow_overlay_update_002',
]);
assert.equal((triggerSource.match(/CREATE TRIGGER IF NOT EXISTS/g)||[]).length,4);
const stageStatements=stage.replace(/--[^\n]*/g,'').split(';').map(x=>x.trim()).filter(Boolean);
assert.equal(stageStatements.length,9,'Stage007 must be exactly 5 tables, 3 indexes, 1 OFF row');
assert.ok(stageStatements.every(x=>/^(?:CREATE TABLE IF NOT EXISTS|CREATE INDEX IF NOT EXISTS|INSERT INTO soridraw_notification_activation_002)/.test(x)),
 'Stage007 statement safety');
const coreStatements=[
 "CREATE TABLE tracks(id TEXT PRIMARY KEY,owner_uid TEXT,title TEXT,is_public INTEGER,status TEXT)",
 "CREATE TABLE public_profiles(uid TEXT PRIMARY KEY,nickname TEXT,is_public INTEGER)",
 "CREATE TABLE likes(track_id TEXT,user_uid TEXT,created_at INTEGER,PRIMARY KEY(track_id,user_uid))",
 "CREATE TABLE follows(follower_uid TEXT,following_uid TEXT,created_at INTEGER,PRIMARY KEY(follower_uid,following_uid))",
 "CREATE TABLE explore_follow_overrides_348(follower_uid TEXT,following_uid TEXT,following INTEGER,baseline_following INTEGER,updated_at INTEGER,mutation_id TEXT,PRIMARY KEY(follower_uid,following_uid))",
];
const tableNames=['tracks','public_profiles','likes','follows','explore_follow_overrides_348'];
assert.equal(coreStatements.length,5);
const mock=new DatabaseSync(':memory:');
for(const sql of coreStatements)mock.exec(sql);
for(const sql of stageStatements)mock.exec(sql);
for(const match of triggers)mock.exec(match[0]);
assert.equal(mock.prepare('SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1').get().enabled,0);
mock.exec("INSERT INTO public_profiles VALUES('owner','Owner',1),('actor','Actor',1)");
mock.exec("INSERT INTO tracks VALUES('song','owner','Song',1,'published')");
mock.exec("INSERT INTO likes VALUES('song','actor',1800000000000)");
assert.equal(mock.prepare('SELECT COUNT(*) AS n FROM soridraw_notification_inbox_001').get().n,0);
mock.close();
console.log('NOTIFICATION_011_PINNED_SOURCE_AND_LOCAL_OFF_DDL=PASS');
if(process.argv.includes('--self-test'))process.exit(0);

const account=process.env.CLOUDFLARE_ACCOUNT_ID;
const token=process.env.CLOUDFLARE_API_TOKEN;
const runId=process.env.GITHUB_RUN_ID,attempt=process.env.GITHUB_RUN_ATTEMPT;
const temp=process.env.RUNNER_TEMP;
const SHARED='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
assert.match(account||'',/^[a-f0-9]{32}$/);
assert.ok(token&&token.length>15);
assert.match(runId||'',/^[1-9][0-9]{5,}$/);
assert.match(attempt||'',/^[1-9][0-9]*$/);
assert.ok(temp&&temp.startsWith('/'),'RUNNER_TEMP_REQUIRED');
assert.equal(process.env.GITHUB_REPOSITORY,'andrawing1212/soridraw-music');
assert.equal(process.env.GITHUB_REF,'refs/heads/preview');
assert.equal(attempt,'1','NO_GITHUB_RERUN_CAN_CREATE_NEW_EPHEMERAL');
const name='soridraw-notify-cost-011-'+runId+'-'+attempt;
const record=join(temp,'soridraw-notify-cost-011-owned.json');
const apiRoot='https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database';
const uuidOk=x=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(x||'');
const safeId=id=>{assert.ok(uuidOk(id)&&id!==SHARED,'REFUSE_SHARED_OR_INVALID_D1_UUID');return id;};
async function api(method,suffix,body){
 const r=await fetch(apiRoot+suffix,{
  method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json'},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});
 let x;try{x=await r.json()}catch{throw Error('D1_HTTP_NON_JSON_'+method+'_'+r.status)}
 if(!r.ok||x.success!==true){
  const error=x.errors?.[0];
  const code=String(error?.code||'unknown').replace(/[^a-zA-Z0-9_]/g,'');
  throw Error('D1_API_'+method+'_'+r.status+'_CODE_'+code);
 }
 return x.result;
}
async function verifyOwned(id){
 safeId(id);
 const got=await api('GET','/'+id);
 assert.equal(got?.name,name,'OWNERSHIP_NAME_DOES_NOT_MATCH');
 assert.equal(got?.uuid,id,'OWNERSHIP_ID_DOES_NOT_MATCH');
}
async function removeOwned(id){
 await verifyOwned(id);
 await api('DELETE','/'+safeId(id));
 if(existsSync(record))unlinkSync(record);
 console.log('NOTIFICATION_011_EPHEMERAL_D1_DELETED=PASS');
}
if(process.argv[2]==='cleanup'){
 if(!existsSync(record)){
  console.log('NOTIFICATION_011_CLEANUP_NO_OWNED_RECORD=PASS');process.exit(0);
 }
 const previous=JSON.parse(readFileSync(record,'utf8'));
 assert.equal(previous?.name,name,'CLEANUP_RECORD_NAME_MISMATCH');
 await removeOwned(previous?.uuid);
 process.exit(0);
}
assert.equal(process.argv.length,2,'ONLY_DEFAULT_OR_CLEANUP_ALLOWED');
if(existsSync(record))throw Error('RESIDUAL_OWNED_DB_MUST_BE_CLEANED_BEFORE_NEW_RUN');
let owned=null,cleanupDone=false;
try{
 const created=await api('POST','',{name,primary_location_hint:'apac'});
 assert.equal(created?.name,name,'CREATED_DB_NAME_MISMATCH');
 owned=safeId(created?.uuid);
 writeFileSync(record,JSON.stringify({name,uuid:owned}),{flag:'wx',mode:0o600});
 await verifyOwned(owned);
 console.log('NOTIFICATION_011_OWNED_D1_IDENTITY=PASS;SHARED_D1_UNTOUCHED=YES');

 async function query(sql,params=[]){
  safeId(owned);
  assert.ok(typeof sql==='string'&&sql.length<15000&&Array.isArray(params)&&params.length<10,
   'BOUNDED_OWNED_SQL_ONLY');
  const result=await api('POST','/'+owned+'/query',{sql,params});
  assert.ok(Array.isArray(result)&&result.length===1&&result[0].success===true,'D1_QUERY_RESULT');
  const meta=result[0].meta||{};
  const measure={rowsRead:Number(meta.rows_read),rowsWritten:Number(meta.rows_written),
   changes:Number(meta.changes),durationMs:Number(meta.duration??meta.timings?.sql_duration_ms??0)};
  for(const n of Object.values(measure))assert.ok(Number.isFinite(n)&&n>=0,'D1_QUERY_METER_UNAVAILABLE');
  return {measure,rows:result[0].results||[]};
 }
 async function executeDDL(sql){
  const {measure}=await query(sql);
  return measure;
 }
 for(const stmt of coreStatements)await executeDDL(stmt);
 for(const stmt of stageStatements)await executeDDL(stmt);
 const tally={setupQueries:coreStatements.length+stageStatements.length+triggers.length,
   stages:{baseline:{},off:{},on:{}},inbox:{baseline:0,off:0,on:0}};
 const time=1800000000000;
 const owner='owner-011';
 await query('INSERT INTO public_profiles VALUES(?,?,1)',[owner,'Owner']);
 await query("INSERT INTO tracks VALUES(?,?,?,1,'published')",['song-011',owner,'Synthetic Song']);
 const typeInfo={
  like:(actor)=>({sql:'INSERT OR IGNORE INTO likes VALUES(?,?,?)',args:['song-011',actor,time]}),
  follow:(actor)=>({sql:'INSERT OR IGNORE INTO follows VALUES(?,?,?)',args:[actor,owner,time]}),
  overlayInsert:(actor)=>({sql:'INSERT OR IGNORE INTO explore_follow_overrides_348 VALUES(?,?,?,?,?,?)',
   args:[actor,owner,1,0,time,'operation-'+actor]}),
  overlayUpdate:(actor)=>({sql:'UPDATE explore_follow_overrides_348 SET following=?,updated_at=? WHERE follower_uid=? AND following_uid=?',
   args:[1,time,actor,owner]}),
 };
 const kinds=Object.keys(typeInfo);
 let eventCount=0;
 async function measurePhase(phase){
  const bucket={};
  for(const kind of kinds){
   const results=[];
   for(let n=0;n<3;n++){
    const actor='actor-'+phase+'-'+kind+'-'+n;
    await query('INSERT INTO public_profiles VALUES(?,?,1)',[actor,'Test Actor']);
    if(kind==='overlayUpdate'){
     await query('INSERT INTO explore_follow_overrides_348 VALUES(?,?,?,?,?,?)',
      [actor,owner,0,0,time-10,'preseed-'+actor]);
    }
    const {sql,args}=typeInfo[kind](actor);
    const {measure}=await query(sql,args);
    results.push(measure);eventCount++;
   }
   bucket[kind]={
    count:results.length,
    rowsRead:results.map(x=>x.rowsRead),
    rowsWritten:results.map(x=>x.rowsWritten),
    sqlDurationMs:results.map(x=>x.durationMs),
   };
  }
  tally.stages[phase]=bucket;
  const {rows}=await query('SELECT COUNT(*) AS n FROM soridraw_notification_inbox_001');
  tally.inbox[phase]=Number(rows[0]?.n);
 }
 await measurePhase('baseline');
 assert.equal(tally.inbox.baseline,0);
 for(const stmt of triggers)await executeDDL(stmt[0]);
 const state0=await query('SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1');
 assert.equal(Number(state0.rows[0]?.enabled),0);
 await measurePhase('off');
 assert.equal(tally.inbox.off,0,'OFF state generated inbox data');
 // Only this transient database can be set ON. Shared database has no codepath.
 await query('UPDATE soridraw_notification_activation_002 SET enabled=1 WHERE id=1');
 await measurePhase('on');
 assert.equal(tally.inbox.on,12,'ON synthetic events must create exactly 12 inbox rows');
 const prevActor='actor-on-like-0';
 const dup=await query('INSERT OR IGNORE INTO likes VALUES(?,?,?)',['song-011',prevActor,time]);
 assert.equal(dup.measure.rowsWritten,0,'canonical no-op wrote rows');
 const repeated=await query('INSERT OR IGNORE INTO explore_follow_overrides_348 VALUES(?,?,?,?,?,?)',
  ['actor-on-follow-0',owner,1,0,time,'cross-writer-dedup']);
 const afterRepeat=await query('SELECT COUNT(*) AS n FROM soridraw_notification_inbox_001');
 assert.equal(Number(afterRepeat.rows[0]?.n),12,'legacy follow+overlay duplicate created notification');
 const finalState=await query('UPDATE soridraw_notification_activation_002 SET enabled=0 WHERE id=1');
 assert.ok(finalState.measure.rowsWritten>=1,'Transient OFF restore failed');
 const checkOff=await query('SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1');
 assert.equal(Number(checkOff.rows[0]?.enabled),0);
 for(const k of kinds){
  const baseline=tally.stages.baseline[k],off=tally.stages.off[k],on=tally.stages.on[k];
  assert.ok(off.rowsWritten.every((x,i)=>x===baseline.rowsWritten[i]),
   'OFF added unexpected physical writes '+k);
  assert.ok(on.rowsWritten.every((x,i)=>x>=off.rowsWritten[i]),
   'ON physical writes less than OFF '+k);
 }
 console.log(JSON.stringify({
  kind:'SORIDRAW_NOTIFICATION_011_EPHEMERAL_PHYSICAL_D1_COST',
  source:'Cloudflare D1 query meta rows_read / rows_written (includes indexes)',
  syntheticDbName:name,eventCount,comparisons:tally,
  duplicates:{likeRepeatedRowsWritten:dup.measure.rowsWritten,followOverlayAdditionalInbox:0,
   followOverlayCanonicalPhysicalWrites:repeated.measure.rowsWritten},
  warning:'Isolated synthetic canonical 5 tables; omits production 17 existing triggers, Worker batch and actual account user traffic. NOT an invoice or 100k-user guarantee.'
 },null,2));
 console.log('NOTIFICATION_011_D1_PHYSICAL_ROW_METERS=PASS');
 console.log('NOTIFICATION_011_SHARED_USER_DB_WRITES=0;WORKER_DEPLOY=0;CLIENT_ACTIVATION=0');
}finally{
 if(owned){
  try{await removeOwned(owned);cleanupDone=true}
  catch(e){
   console.error('NOTIFICATION_011_EPHEMERAL_CLEANUP_FAILED_RUN_ID='+runId+
    ';OWNED_NAME='+name+';OWNED_ID='+owned+';ERROR='+String(e).slice(0,120));
   throw e;
  }
 }
}
if(!cleanupDone)throw Error('NO_EPHEMERAL_DELETION_CONFIRMATION');
console.log('NOTIFICATION_011_PHYSICAL_D1_TEST_AND_CLEANUP=PASS');

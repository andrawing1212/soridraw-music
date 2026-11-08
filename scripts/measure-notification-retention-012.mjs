// One-run notification retention cost measurement on a uniquely owned disposable D1.
// Never calls a shared database, never changes an active Worker or an R2 bucket.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync,writeFileSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {DatabaseSync} from 'node:sqlite';
import {runNotificationRetention005} from '../cloudflare/explore-worker/runtime/notification-retention-coordinator-005.mjs';

const folder='cloudflare/explore-worker/';
const expected={
 'candidates/20261108_03_notification_inert_schema_release.sql':'d20f09f596032822f21ae279c59bce835b802469',
 'candidates/20261108_04_notification_triggers_off_release.sql':'69c7be8779cf8b6b22aee023d41a1fc50b4f41a4',
 'candidates/20261108_01_notification_direct_messages_candidate.sql':'fa53d91b0a9f9d49338ab8092678b3f11042aa97',
 'candidates/20261108_02_notification_announcement_expiry_candidate.sql':'cc0829f6458d470c73779df685e474565658817e',
 'runtime/notification-retention-coordinator-005.mjs':'262567341819f0abc8c47e5c73b257244f774a57',
 'runtime/notification-preferences-retention-002.mjs':'1e13ff61b6f2f25ca99385750f9f1c826c82d909',
 'runtime/notification-unified-inbox-004.mjs':'2e9c88d0682c5f3a42c9a138a5468e9f04debe90',
};
const sha1=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0').update(s).digest('hex');
const sources={};
for(const [path,hash] of Object.entries(expected)){
 const source=readFileSync(folder+path,'utf8');
 assert.equal(sha1(source),hash,'SOURCE_CHANGED_'+path);
 sources[path]=source;
}
const ddl=s=>s.replace(/--[^\n]*/g,'').split(';').map(x=>x.trim()).filter(Boolean);
const core=[
 'CREATE TABLE tracks(id TEXT PRIMARY KEY,owner_uid TEXT,title TEXT,is_public INTEGER,status TEXT)',
 'CREATE TABLE public_profiles(uid TEXT PRIMARY KEY,nickname TEXT,is_public INTEGER)',
 'CREATE TABLE likes(track_id TEXT,user_uid TEXT,created_at INTEGER,PRIMARY KEY(track_id,user_uid))',
 'CREATE TABLE follows(follower_uid TEXT,following_uid TEXT,created_at INTEGER,PRIMARY KEY(follower_uid,following_uid))',
 'CREATE TABLE explore_follow_overrides_348(follower_uid TEXT,following_uid TEXT,following INTEGER,baseline_following INTEGER,updated_at INTEGER,mutation_id TEXT,PRIMARY KEY(follower_uid,following_uid))',
];
const stage=ddl(sources['candidates/20261108_03_notification_inert_schema_release.sql']);
const direct=ddl(sources['candidates/20261108_01_notification_direct_messages_candidate.sql']);
const global=ddl(sources['candidates/20261108_02_notification_announcement_expiry_candidate.sql']);
const triggers=[...sources['candidates/20261108_04_notification_triggers_off_release.sql']
 .matchAll(/CREATE TRIGGER IF NOT EXISTS [a-z0-9_]+[\s\S]*?END;/g)].map(m=>m[0]);
assert.equal(stage.length,9);
assert.equal(direct.length,2);
assert.equal(global.length,1);
assert.equal(triggers.length,4);
assert.ok(stage.every(x=>/^(CREATE TABLE IF NOT EXISTS|CREATE INDEX IF NOT EXISTS|INSERT INTO soridraw_notification_activation_002)/.test(x)));
assert.ok(direct.every(x=>/^(CREATE TABLE IF NOT EXISTS|CREATE INDEX IF NOT EXISTS)/.test(x)));
assert.ok(global.every(x=>/^CREATE INDEX IF NOT EXISTS/.test(x)));
const offline=new DatabaseSync(':memory:');
for(const sql of [...core,...stage,...direct,...global,...triggers])offline.exec(sql);
assert.equal(offline.prepare('SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1').get().enabled,0);
for(const [table,index,column] of [
 ['soridraw_notification_inbox_001','idx_soridraw_notification_expiry_002','created_at'],
 ['soridraw_notification_direct_messages_004','idx_soridraw_direct_expiry_004','created_at'],
 ['soridraw_global_announcements_001','idx_soridraw_global_expiry_005','published_at'],
]){
 const plan=offline.prepare('EXPLAIN QUERY PLAN SELECT '+column+' FROM '+table+
  ' WHERE '+column+'<? ORDER BY '+column+' LIMIT 100').all(1800000000000);
 assert.ok(plan.some(row=>String(row.detail).includes(index)),index+' index missing');
}
offline.close();
console.log('NOTIFICATION_012_PINNED_SOURCE_ISOLATED_SQLITE=PASS');
if(process.argv.includes('--self-test'))process.exit(0);

assert.ok(process.argv.length===2 || (process.argv.length===3 && process.argv[2]==='cleanup'));
const account=process.env.CLOUDFLARE_ACCOUNT_ID, token=process.env.CLOUDFLARE_API_TOKEN;
const runId=process.env.GITHUB_RUN_ID, attempt=process.env.GITHUB_RUN_ATTEMPT;
const temp=process.env.RUNNER_TEMP;
const SHARED='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
assert.match(account||'',/^[a-f0-9]{32}$/);
assert.ok(token&&token.length>15);
assert.match(runId||'',/^[1-9][0-9]{5,}$/);
assert.equal(attempt,'1','RERUN_FORBIDDEN');
assert.ok(temp?.startsWith('/'));
assert.equal(process.env.GITHUB_REPOSITORY,'andrawing1212/soridraw-music');
assert.equal(process.env.GITHUB_REF,'refs/heads/preview');
assert.equal(process.env.GITHUB_EVENT_NAME,'push');
const name='soridraw-notify-retention-012-'+runId+'-'+attempt;
const record=join(temp,'soridraw-notification-012-owned.json');
const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database';
const uuidOk=id=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id||'');
function safe(id){assert.ok(uuidOk(id)&&id!==SHARED,'NOTIFICATION_012_SHARED_ID_FORBIDDEN');return id;}
async function request(method,uri,body){
 const response=await fetch(base+uri,{method,
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json'},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});
 const obj=await response.json();
 if(!response.ok||obj?.success!==true)throw Error('NOTIFICATION_012_HTTP_'+method+'_'+response.status+
  '_'+String(obj?.errors?.[0]?.code||'UNKNOWN').replace(/[^0-9A-Za-z_]/g,''));
 return obj.result;
}
async function isGone(id){
 const response=await fetch(base+'/'+safe(id),{
  headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(30000)});
 if(response.status===404)return true;
 const obj=await response.json();
 if(response.ok&&obj?.success===true)return false;
 throw Error('NOTIFICATION_012_DB_LOOKUP_FAILED_'+response.status);
}
async function verifyOwned(id){
 assert.equal(await isGone(id),false,'OWNED_DB_NOT_FOUND');
 const got=await request('GET','/'+safe(id));
 assert.equal(got.name,name,'WRONG_OWNED_NAME');
 assert.equal(got.uuid,id,'WRONG_OWNED_ID');
}
async function removeOwned(id){
 safe(id);
 if(!await isGone(id)){
  await verifyOwned(id);
  await request('DELETE','/'+id);
 }
 assert.equal(await isGone(id),true,'OWNED_DB_STILL_EXISTS');
 if(existsSync(record))unlinkSync(record);
 console.log('NOTIFICATION_012_EXACT_OWNED_DB_DELETED_AND_404=PASS');
}
if(process.argv[2]==='cleanup'){
 if(!existsSync(record)){
  console.log('NOTIFICATION_012_EMERGENCY_CLEANUP_NO_RECORD=PASS');
  process.exit(0);
 }
 const info=JSON.parse(readFileSync(record,'utf8'));
 assert.equal(info?.name,name,'CLEANUP_NAME_MISMATCH');
 await removeOwned(info?.uuid);
 process.exit(0);
}
if(existsSync(record))throw Error('OWNED_DB_RECORD_ALREADY_PRESENT');
let owned=null,cleaned=false;
try{
 const created=await request('POST','',{name,primary_location_hint:'apac'});
 assert.equal(created?.name,name,'CREATED_NAME_MISMATCH');
 owned=safe(created?.uuid);
 writeFileSync(record,JSON.stringify({name,uuid:owned}),{flag:'wx',mode:0o600});
 await verifyOwned(owned);
 console.log('NOTIFICATION_012_OWNED_DB_VERIFIED=PASS');
 const samples=[];
 async function query(sql,params=[],operation='setup'){
  safe(owned);
  assert.ok(typeof sql==='string'&&sql.length<15000&&Array.isArray(params)&&params.length<=10);
  assert.ok(!/\b(?:DROP|ALTER|ATTACH|DETACH|PRAGMA|VACUUM|TRUNCATE)\b/i.test(sql),'UNSAFE_SQL');
  if(/^\s*DELETE\b/i.test(sql))assert.match(sql,/^\s*DELETE FROM soridraw_(?:notification_inbox_001|notification_direct_messages_004|global_announcements_001)\b/i);
  const start=performance.now();
  const raw=await request('POST','/'+owned+'/query',{sql,params});
  const wallMs=+(performance.now()-start).toFixed(2);
  assert.ok(Array.isArray(raw)&&raw.length===1&&raw[0].success===true);
  const meta=raw[0].meta||{};
  const values={rowsRead:Number(meta.rows_read),rowsWritten:Number(meta.rows_written),
   changes:Number(meta.changes),sqlDurationMs:Number(meta.duration??meta.timings?.sql_duration_ms??0),
   wallMs};
  for(const [k,v] of Object.entries(values))assert.ok(Number.isFinite(v)&&v>=0,'MISSING_QUERY_META_'+k);
  if(operation!=='setup')samples.push({operation,...values});
  return {rows:raw[0].results||[],meta:values};
 }
 for(const sql of [...core,...stage,...direct,...global,...triggers])await query(sql);
 const off=await query('SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1');
 assert.equal(Number(off.rows[0]?.enabled),0);
 const now=1800000000000,retention=30*86400000,cutoff=now-retention;
 const n=105;
 // Synthetic rows only; none of these INSERT statements touches canonical user tables.
 await query('WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i+1 FROM n WHERE i<104) '+
  'INSERT INTO soridraw_notification_inbox_001 '+
  'SELECT ?, ((?-i)/7200000)*7200000, ?, ?||i, ?||i, ?, ?, ?-i FROM n',
  ['synthetic-owner',cutoff-1000,'like','synthetic-actor-','synthetic-song-','Synthetic','Synthetic song',cutoff-1000]);
 await query('WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i+1 FROM n WHERE i<104) '+
  'INSERT INTO soridraw_notification_direct_messages_004 '+
  'SELECT ?, ?||i, ?, ?, ?-i FROM n',
  ['synthetic-owner','synthetic-direct-','Title','Private',cutoff-1000]);
 await query('WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i+1 FROM n WHERE i<104) '+
  'INSERT INTO soridraw_global_announcements_001 SELECT ?||i,?,?,?-i FROM n',
  ['synthetic-global-','Title','Shared',cutoff-1000]);
 for(const table of ['soridraw_notification_inbox_001','soridraw_notification_direct_messages_004','soridraw_global_announcements_001']){
  let sql,params;
  if(table==='soridraw_notification_inbox_001'){
   sql='INSERT INTO '+table+' VALUES(?,?,?,?,?,?,?,?)';
   params=['synthetic-owner',Math.floor(cutoff/7200000)*7200000,'like','boundary-actor','boundary-track','Actor','Song',cutoff];
  }else if(table==='soridraw_notification_direct_messages_004'){
   sql='INSERT INTO '+table+' VALUES(?,?,?,?,?)';
   params=['synthetic-owner','boundary-direct','Title','Private',cutoff];
  }else{sql='INSERT INTO '+table+' VALUES(?,?,?,?)';params=['boundary-global','Title','Public',cutoff];}
  await query(sql,params);
 }
 const expectedDeletes=[100,5,0],perPass=[];
 let stored=null,cacheWrites=0,cacheReads=0;
 const cache={
  async get(){cacheReads++;return stored&&{etag:stored.etag,json:async()=>stored.body};},
  async put(key,text,opts){
   assert.equal(key,'internal/notifications/global-announcements-v1.json');
   if(stored && opts.onlyIf?.etagMatches!==stored.etag)return null;
   if(!stored && (!(opts.onlyIf instanceof Headers)||opts.onlyIf.get('If-None-Match')!=='*'))return null;
   stored={etag:'synthetic-'+(++cacheWrites),body:JSON.parse(text)};
   return {etag:stored.etag};
  },
 };
 const db={prepare(sql){return{bind(...params){return{
  async run(){
   const kind=sql.includes('soridraw_notification_inbox_001')?'social':
    sql.includes('soridraw_notification_direct_messages_004')?'direct':
    sql.includes('DELETE FROM soridraw_global_announcements_001')?'global':'other';
   const r=await query(sql,params,kind);
   return {meta:{changes:r.meta.changes}};
  },
  async all(){const r=await query(sql,params,'snapshot');return {results:r.rows};},
  async first(){const r=await query(sql,params,'snapshot');return r.rows[0]||null;},
 };}};}};
 for(let pass=0;pass<expectedDeletes.length;pass++){
  const begin=samples.length;
  const outcome=await runNotificationRetention005({
   db,cache,verifyMaintenance:async()=>true,enabled:true,now,limit:100,
  });
  assert.deepEqual(outcome.byCategory,{
   social:expectedDeletes[pass],direct:expectedDeletes[pass],announcement:expectedDeletes[pass]});
  assert.equal(outcome.rowsDeleted,expectedDeletes[pass]*3);
  assert.equal(outcome.status,pass===0?'more-possible':'ok');
  const operations=samples.slice(begin);
  assert.equal(operations.filter(x=>['social','direct','global'].includes(x.operation)).length,3);
  perPass.push({
   name:['first-100','second-5','empty-replay'][pass],
   limit:100,deleted:outcome.rowsDeleted,status:outcome.status,
   queries:operations,
   totalD1:{rowsRead:operations.reduce((a,x)=>a+x.rowsRead,0),
    rowsWritten:operations.reduce((a,x)=>a+x.rowsWritten,0),
    sqlDurationMs:+operations.reduce((a,x)=>a+x.sqlDurationMs,0).toFixed(3),
    wallMs:+operations.reduce((a,x)=>a+x.wallMs,0).toFixed(2)},
   syntheticR2Gets:cacheReads,syntheticR2Puts:cacheWrites
  });
 }
 assert.equal(cacheWrites,1,'unchanged shared snapshot should use R2 W0');
 assert.equal(stored.body.items.length,1);
 assert.equal(stored.body.items[0].id,'boundary-global');
 for(const [table,time] of [
  ['soridraw_notification_inbox_001','created_at'],
  ['soridraw_notification_direct_messages_004','created_at'],
  ['soridraw_global_announcements_001','published_at']]){
  const remaining=await query('SELECT COUNT(*) AS n FROM '+table+' WHERE '+time+'<?',[cutoff]);
  assert.equal(Number(remaining.rows[0]?.n),0,'EXPIRED_ROWS_REMAIN_'+table);
  const boundary=await query('SELECT COUNT(*) AS n FROM '+table+' WHERE '+time+'=?',[cutoff]);
  assert.equal(Number(boundary.rows[0]?.n),1,'BOUNDARY_WAS_DELETED_'+table);
 }
 const final=await query('SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1');
 assert.equal(Number(final.rows[0]?.enabled),0);
 console.log(JSON.stringify({kind:'SORIDRAW_NOTIFICATION_012_PHYSICAL_RETENTION_D1',
  database:'owned temporary only',syntheticExpiredRowsEach:n,
  categories:['social','direct','announcement'],limit:100,perPass,
  notes:'D1 query meta includes index costs; synthetic cache is not a real R2 operation. Wall time includes network. NOT production invoice, not the shared 17-trigger DB.'},null,2));
 console.log('NOTIFICATION_012_PHYSICAL_D1_INDEXED_RETENTION_AND_REPLAY=PASS');
 console.log('NOTIFICATION_012_SHARED_D1_WRITES=0;WORKER_DEPLOY=0;SHARED_LATCH_UNCHANGED=YES');
}finally{
 if(owned){
  try{await removeOwned(owned);cleaned=true;}
  catch(e){console.error('NOTIFICATION_012_OWNED_CLEANUP_FAILED='+name+';UUID='+owned+';ERROR='+String(e).slice(0,100));throw e;}
 }
}
if(!cleaned)throw Error('OWNED_DELETION_NOT_VERIFIED');
console.log('NOTIFICATION_012_PHYSICAL_MEASUREMENT_AND_DELETION=PASS');

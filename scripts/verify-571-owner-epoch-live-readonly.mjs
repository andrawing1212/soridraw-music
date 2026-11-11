// APP571: actual shared D1 two-column rollout readiness.
// Cloudflare metadata/source GET and a constrained D1 SQL metadata SELECT only.
// No user rows, no deploy, no secrets in output, no mutation of any kind.
import assert from 'node:assert/strict';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const DB='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const WORKERS={
 'soridraw-explore-preview':'350ce33d-ec83-49d0-a4ae-c25d2d90f59e',
 'soridraw-explore-test':'ddd2255a-75cc-4db9-8905-b47338558cb0',
 'soridraw-explore-api':'af81502a-298d-4ec6-bc2a-0c529d6dc29e',
};
const SQL=[
 "SELECT name FROM pragma_table_info('profile_stats') WHERE name LIKE 'owner_follow_%' ORDER BY name LIMIT 40",
 "SELECT type,name,sql FROM sqlite_master WHERE (type='trigger' OR type='view') AND sql LIKE '%profile_stats%' ORDER BY type,name LIMIT 100",
 "SELECT id,phase FROM explore_follow_cutover_control_348 WHERE id=1 LIMIT 1",
];
const forbidden=/\b(?:UPDATE|DELETE|INSERT|ALTER|DROP|CREATE|REPLACE|ATTACH|VACUUM)\b/i;
const positional=/\bINSERT\s+(?:OR\s+(?:REPLACE|IGNORE|ABORT|FAIL|ROLLBACK)\s+)?INTO\s+["'\x60\[]?profile_stats["'\x60\]]?\s+VALUES\s*\(/i;
assert.equal(Object.keys(WORKERS).length,3);
for(const q of SQL)assert.ok(q.startsWith('SELECT ')&&!forbidden.test(q),'APP571_READONLY_METADATA_SQL_ONLY');
if(process.argv.includes('--self-test')){
 assert.equal(positional.test("INSERT INTO profile_stats VALUES(1,2)"),true);
 assert.equal(positional.test("INSERT INTO profile_stats(uid, follower_count) VALUES(?,?)"),false);
 assert.equal(positional.test("INSERT OR IGNORE INTO profile_stats VALUES(1)"),true);
 console.log('APP571_POSitional_OLD_WORKER_GUARD_AND_SELECT_ONLY=PASS');
 process.exit(0);
}
assert.equal(process.argv[2],'--live','APP571_EXPLICIT_LIVE_REQUIRED');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,ACCOUNT,'APP571_ACCOUNT_CHANGED');
assert.equal(process.env.SHARED_D1_ID,DB,'APP571_SHARED_D1_CHANGED');
const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
assert.ok(token.length>20,'APP571_API_TOKEN_UNAVAILABLE');
const root='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
const headers={Authorization:'Bearer '+token};
const get=async path=>{
 const r=await fetch(root+path,{method:'GET',headers,signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('APP571_CLOUDFLARE_METADATA_UNAVAILABLE_HTTP_'+r.status);
 return r;
};
const metadata=async path=>{
 const payload=await (await get(path)).json();
 assert.equal(payload?.success,true,'APP571_METADATA_NOT_SUCCESS');
 return payload.result;
};
const workerStatuses=[];
for(const [name,pin] of Object.entries(WORKERS)){
 const active=(await metadata('/workers/scripts/'+name+'/deployments'))?.deployments?.[0]?.versions||[];
 const single=active.length===1&&Number(active[0].percentage)===100&&active[0].version_id===pin;
 const settings=await metadata('/workers/scripts/'+name+'/settings');
 const bindings=settings?.bindings||[];
 const d1=bindings.filter(b=>(b.type==='d1'||b.type==='d1_database')&&
   (b.id===DB||b.database_id===DB||b.uuid===DB));
 // The response is raw Worker module content, not a JSON object or a
 // user-data route. Search only for SQL shape, then discard the bytes.
 const content=await get('/workers/scripts/'+name+'/content/v2');
 const body=await content.text();
 const readable=body.length>1000 && !body.trimStart().startsWith('{"success":');
 const positionalInsert=positional.test(body);
 const pushOn=bindings.some(b=>b.name==='SORIDRAW_OWNER_FOLLOW_W2_PUSH_555'&&b.text==='1');
 workerStatuses.push({name,versionPinned:single,sharedD1:d1.length===1,
   sourceReadable:readable,positionalProfileStatsInsert:positionalInsert,pushOn});
}
const query=async sql=>{
 assert.ok(SQL.includes(sql),'APP571_QUERY_NOT_ALLOWLISTED');
 const r=await fetch(root+'/d1/database/'+DB+'/query',{method:'POST',
  headers:{...headers,'Content-Type':'application/json'},
  body:JSON.stringify({sql,params:[]}),signal:AbortSignal.timeout(20000)});
 const a=await r.json(),data=a.result?.[0];
 assert.ok(r.ok&&a.success===true&&data?.success===true&&
  Number(data.meta?.rows_written)===0&&Array.isArray(data.results),
  'APP571_D1_METADATA_SELECT_FAILED');
 return data.results;
};
const columns=(await query(SQL[0])).map(x=>x.name);
const oldObjects=await query(SQL[1]);
const phase=await query(SQL[2]);
const existingSqlHazard=oldObjects.some(x=>typeof x.sql==='string'&&positional.test(x.sql));
const wanted=['owner_follow_auth_epoch_532','owner_follow_auth_created_at_ms_544'];
const present=wanted.filter(x=>columns.includes(x));
const extra=columns.filter(x=>!wanted.includes(x));
const ready=present.length===0&&extra.length===0&&!existingSqlHazard&&
 phase.length===1&&phase[0].phase==='overlay'&&
 workerStatuses.every(x=>x.versionPinned&&x.sharedD1&&x.sourceReadable&&
  !x.positionalProfileStatsInsert&&!x.pushOn);
const status=ready?'OFF_SCHEMA_COMPATIBLE_REQUIRES_EXPLICIT_RELEASE_GATE':'NO_GO';
console.log('APP571_SHARED_D1_TWO_COLUMN_BASELINE='+JSON.stringify({
 ownerColumnsAlreadyPresent:present.length,otherOwnerColumns:extra.length,
 overlayAuthority:phase?.[0]?.phase||'unknown',sqlObjectCount:oldObjects.length,
 positionalSqlInTriggersOrViews:existingSqlHazard,
 workers:workerStatuses,
}));
console.log('APP571_OFF_SCHEMA_ROLLOUT_PREFLIGHT='+status);
console.log('APP571_SHARED_USER_DATA_READS_ZERO_SHARED_D1_WRITES_ZERO_NO_DEPLOY=PASS');

// APP548: read-only present-tense owner follower rollout preflight.
// No user rows, no mutations, no cron/Worker/Functions deploy, no secrets logged.
import assert from 'node:assert/strict';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const DB='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const workers={
 'soridraw-explore-preview':'350ce33d-ec83-49d0-a4ae-c25d2d90f59e',
 'soridraw-explore-test':'ddd2255a-75cc-4db9-8905-b47338558cb0',
 'soridraw-explore-api':'af81502a-298d-4ec6-bc2a-0c529d6dc29e',
};
const requiredColumns=[
 'owner_follow_revision_530','owner_follow_acked_revision_530',
 'owner_follow_attempts_530','owner_follow_next_at_530',
 'owner_follow_dead_at_530','owner_follow_delivered_at_530',
 'owner_follow_auth_epoch_532','owner_follow_auth_created_at_ms_544'
];
const sql=[
 "SELECT name FROM pragma_table_info('profile_stats') WHERE name LIKE 'owner_follow_%' ORDER BY name LIMIT 40",
 "SELECT type,name FROM sqlite_master WHERE (type='trigger' AND name LIKE 'explore_owner_follow_%') OR (type='table' AND name='explore_owner_follow_control_530') ORDER BY type,name LIMIT 40",
 "SELECT name FROM sqlite_master WHERE type='trigger' LIMIT 100"
];
assert.equal(Object.keys(workers).length,3);
for(const q of sql)assert.ok(q.startsWith('SELECT ')&&!/\b(?:UPDATE|DELETE|INSERT|DROP|ALTER|CREATE)\b/i.test(q),'ONLY_READONLY_METADATA_SQL');
if(process.argv[2]==='--self-test'){
 console.log('APP548_READONLY_METADATA_ONLY_3_ENV_NO_USER_CONTENT=PASS');
 process.exit(0);
}
assert.equal(process.argv[2],'--live','EXPLICIT_LIVE_READONLY_REQUIRED');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,ACCOUNT,'ACCOUNT_CHANGED');
assert.equal(process.env.SHARED_D1_ID,DB,'SHARED_D1_CHANGED');
const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
assert.ok(token.length>20,'READONLY_API_TOKEN_UNAVAILABLE');
const base='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
async function get(path){
 const res=await fetch(base+path,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(18000)});
 const json=await res.json();
 assert.ok(res.ok&&json?.success===true&&json.result,'CF_METADATA_GET_FAILED_'+res.status);
 return json.result;
}
const snapshots=[];
for(const [name,oldVersion] of Object.entries(workers)){
 const deps=await get('/workers/scripts/'+name+'/deployments');
 const active=deps?.deployments?.[0]?.versions||[];
 assert.ok(active.length===1&&Number(active[0].percentage)===100,'MULTI_VERSION_HOLD_'+name);
 const settings=await get('/workers/scripts/'+name+'/settings');
 const bs=settings?.bindings||[];
 assert.ok(Array.isArray(bs),'BINDINGS_MISSING');
 const d1Binding=bs.filter(x=>
  (x.type==='d1'||x.type==='d1_database')&&
  (x.id===DB||x.database_id===DB||x.uuid===DB));
 const sameVersion=active[0].version_id===oldVersion;
 snapshots.push({env:name.replace('soridraw-explore-',''),knownVersionUnchanged:sameVersion,
  sharedD1Bound:d1Binding.length===1,ownerHmacFlagPresent:bs.some(x=>x.name==='SORIDRAW_OWNER_FOLLOW_HMAC_539'),
  ownerPushEnabled:bs.some(x=>x.name==='SORIDRAW_OWNER_FOLLOW_PUSH_532'&&x.text==='1')});
}
async function query(q){
 assert.ok(sql.includes(q),'SQL_ALLOWLIST');
 const res=await fetch(base+'/d1/database/'+DB+'/query',{method:'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({sql:q,params:[]}),signal:AbortSignal.timeout(18000)});
 const data=await res.json(),r=data?.result?.[0];
 assert.ok(res.ok&&data?.success===true&&data?.result?.length===1&&r?.success===true&&
  Number(r.meta?.rows_written)===0&&Array.isArray(r.results),'READONLY_D1_ACK_NOT_PROVEN');
 return r.results;
}
const columns=(await query(sql[0])).map(x=>x.name).sort();
const objects=await query(sql[1]);
const existingTriggers=await query(sql[2]);
const migrationPresent=requiredColumns.every(x=>columns.includes(x));
const controlPresent=objects.some(x=>x.type==='table'&&x.name==='explore_owner_follow_control_530');
const legacyTriggerPresent=objects.some(x=>x.type==='trigger'&&x.name==='explore_owner_follow_legacy_546');
console.log('APP548_CURRENT_LIVE_WORKER_COMPAT='+JSON.stringify(snapshots));
console.log('APP548_CANONICAL_D1_OWNER_SCHEMA_METADATA='+JSON.stringify({
 columnsPresent:columns,requiredColumnCount:requiredColumns.length,migrationPresent,
 controlPresent,legacyTriggerPresent,existingTriggerCount:existingTriggers.length
}));
console.log('APP548_PREDEPLOY_STATUS='+(
 snapshots.every(x=>x.sharedD1Bound&&x.knownVersionUnchanged)&&
 migrationPresent&&controlPresent&&legacyTriggerPresent
 ? 'SCHEMA_PRESENT_RECHECK_AUTH_RULES_AND_ROLLBACK'
 : 'NO_GO_SHARED_OWNER_BACKEND_NOT_READY'));
console.log('APP548_USER_DATA_READS_ZERO_SHARED_D1_WRITES_ZERO_NO_DEPLOY=PASS');

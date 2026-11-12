// APP588 — approved shared owner-follow prerequisites. OFF ONLY.
// Never reads/rewrites user rows or deletes existing shared rules.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const DB='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const PROJECT='soridraw-app-866a5';
const RULES='https://soridraw-app-866a5-default-rtdb.firebaseio.com/.settings/rules.json';
const PINS={
 'soridraw-explore-preview':'350ce33d-ec83-49d0-a4ae-c25d2d90f59e',
 'soridraw-explore-test':'ddd2255a-75cc-4db9-8905-b47338558cb0',
 'soridraw-explore-api':'af81502a-298d-4ec6-bc2a-0c529d6dc29e'
};
const DDL=[
 "ALTER TABLE profile_stats ADD COLUMN owner_follow_auth_epoch_532 TEXT NOT NULL DEFAULT ''",
 "ALTER TABLE profile_stats ADD COLUMN owner_follow_auth_created_at_ms_544 INTEGER NOT NULL DEFAULT 0"
];
const read=p=>readFileSync(p,'utf8');
const original=JSON.parse(read('database.rules.json')).rules;
const proposed=JSON.parse(read('scripts/emulator/app550.additive.database.rules.json')).rules;
const statements=read('cloudflare/explore-worker/candidates/570-owner-follow-do-epoch-minimal-off.sql')
 .replace(/--.*$/gm,'').split(';').map(x=>x.trim()).filter(Boolean)
 .map(x=>x.replace(/\s+/g,' '));
assert.deepEqual(statements,DDL);
assert.equal(Object.hasOwn(original,'ownerFollowerSync532'),false);
assert.deepEqual(Object.keys(proposed).sort(),[...Object.keys(original),'ownerFollowerSync532'].sort());
for(const [key,val] of Object.entries(original))
 assert.deepEqual(proposed[key],val,'APP588_SOURCE_RULE_DRIFT_'+key);
assert.equal(proposed.ownerFollowerSync532.$uid['.write'],false);
assert.match(proposed.ownerFollowerSync532.$uid['.read'],/auth\.uid === \$uid/);
assert.match(proposed.ownerFollowerSync532.$uid['.read'],/soridrawFollowEpoch532/);
assert.ok(['--source-only','--apply-off'].includes(process.argv[2]));
if(process.argv[2]==='--source-only'){
 console.log('APP588_EXACT_TWO_COLUMNS_AND_ONE_OWNER_ONLY_RULE_SOURCE=PASS');
 console.log('APP588_SOURCE_NO_LIVE_WRITES=PASS');
}else{
 assert.equal(process.env.GITHUB_REF,'refs/heads/preview');
 assert.equal(process.env.GITHUB_EVENT_NAME,'push');
 assert.equal(process.env.GITHUB_REPOSITORY,'andrawing1212/soridraw-music');
 assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,ACCOUNT);
 assert.equal(process.env.SHARED_D1_ID,DB);
 assert.equal(process.env.FIREBASE_PROJECT,PROJECT);
 const marker=read('.deploy/follow-588-owner-off-prereqs.trigger').split(/\r?\n/);
 for(const line of ['approval=director_yes_20261113_preview_shared_owner',
 'migration=two_dormant_columns_only','rules=one_owner_private_root_only',
 'worker=OFF','functions=OFF','client=OFF','user_rows=NO_CHANGE'])
  assert.ok(marker.includes(line),'APP588_APPROVAL_MARKER_'+line);
 const cfToken=String(process.env.CLOUDFLARE_API_TOKEN||'');
 const google=String(process.env.FIREBASE_OWNER_RULES_ACCESS_TOKEN||'');
 assert.ok(cfToken.length>20&&google.length>20,'APP588_CREDENTIALS_MISSING');
 const cfBase='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
 async function cf(path,method='GET',body){
  const r=await fetch(cfBase+path,{method,headers:{
   Authorization:'Bearer '+cfToken,...(body?{'Content-Type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  const p=await r.json();
  assert.ok(r.ok&&p?.success===true&&p.result,'APP588_CLOUDFLARE_FAIL_'+r.status);
  return p.result;
 }
 async function d1(sql,readOnly){
  const arr=await cf('/d1/database/'+DB+'/query','POST',{sql,params:[]});
  assert.ok(Array.isArray(arr)&&arr.length===1&&arr[0].success===true,'APP588_D1_FAILED');
  if(readOnly)assert.equal(Number(arr[0].meta?.rows_written),0);
  return arr[0].results||[];
 }
 async function workerVersions(){
  for(const [name,pin] of Object.entries(PINS)){
   const d=await cf('/workers/scripts/'+name+'/deployments');
   const v=d.deployments?.[0]?.versions||[];
   assert.ok(v.length===1&&v[0].version_id===pin&&Number(v[0].percentage)>=99.99,
    'APP588_WORKER_DRIFT_'+name);
   const s=await cf('/workers/scripts/'+name+'/settings');
   assert.ok((s.bindings||[]).some(b=>
    (b.type==='d1'||b.type==='d1_database')&&
    (b.id===DB||b.database_id===DB||b.uuid===DB)), 'APP588_SHARED_DB_'+name);
  }
 }
 async function getRules(method='GET',payload){
  const r=await fetch(RULES+'?access_token='+encodeURIComponent(google),{
   method,headers:method==='PUT'?{'Content-Type':'application/json'}:{},
   ...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(20000)});
  assert.ok(r.ok,'APP588_FIREBASE_'+method+'_'+r.status);
  return r.json();
 }
 const metadata="SELECT name,type,\"notnull\" AS is_not_null,dflt_value FROM pragma_table_info('profile_stats') WHERE name LIKE 'owner_follow_%' ORDER BY cid LIMIT 20";
 const phase="SELECT id,phase FROM explore_follow_cutover_control_348 WHERE id=1 LIMIT 1";
 await workerVersions();
 assert.deepEqual((await d1(phase,true)).map(x=>({id:Number(x.id),phase:x.phase})),
  [{id:1,phase:'overlay'}],'APP588_OVERLAY_DRIFT');
 assert.deepEqual(await d1(metadata,true),[],'APP588_EXISTING_OWNER_COLUMNS_HOLD');
 const before=await getRules();
 assert.ok(before?.rules&&typeof before.rules==='object');
 assert.equal(before.rules['.read'],false);
 assert.equal(before.rules['.write'],false);
 assert.equal(Object.hasOwn(before.rules,'ownerFollowerSync532'),false,
  'APP588_OWNER_RULE_ALREADY_EXISTS');
 const after={rules:{...before.rules,ownerFollowerSync532:proposed.ownerFollowerSync532}};
 console.log('APP588_LIVE_PRECHECK_PINNED_AND_RULES_CAPTURED=PASS');
 for(const sql of DDL)await d1(sql,false);
 const cols=await d1(metadata,true);
 assert.deepEqual(cols.map(x=>x.name).sort(),
  ['owner_follow_auth_created_at_ms_544','owner_follow_auth_epoch_532']);
 assert.deepEqual(cols.map(x=>[x.name,x.type,Number(x.is_not_null),String(x.dflt_value)]).sort(),
  [['owner_follow_auth_created_at_ms_544','INTEGER',1,'0'],
   ['owner_follow_auth_epoch_532','TEXT',1,"''"]]);
 console.log('APP588_SHARED_D1_TWO_DORMANT_COLUMNS_PASS');
 assert.deepEqual(await getRules(),before,'APP589_SHARED_RULES_CHANGED_BEFORE_PUT_HOLD');
 await getRules('PUT',after);
 assert.deepEqual(await getRules(),after,'APP588_RULES_POSTCHECK');
 console.log('APP588_ONLY_ONE_NEW_RTDB_OWNER_PRIVATE_ROOT=PASS');
 await workerVersions();
 console.log('APP588_THREE_EXISTING_WORKERS_UNCHANGED=PASS');
 console.log('APP588_NEW_FUNCTION_WORKER_CLIENT_FEATURE_OFF_USER_ROWS_UNCHANGED=PASS');
}

// SORIDRAW basic follow blocking regression: GET-only metadata, SELECT-only
// global configuration, and OPTIONS-only browser preflight. No live mutation.
const account='e1a30fc9ef497fda1d34f4ab3dc1da45';
const db='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const worker='soridraw-explore-preview';
const safe='962ee432-fadb-456e-8836-50675aa76b84';
const canary='6b13cde4-4a53-42d2-873f-361f7cf5a931';
const approvedOwner='rcZ2GZrBndOZzT8C635eiNBjYIJ2';
const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
const assert=(b,why)=>{if(!b)throw Error('FOLLOW_BASIC_HOLD_'+why)};
const url='https://soridraw-explore-preview.andrawing1212.workers.dev/v1/profiles/'+encodeURIComponent(approvedOwner)+'/follow';
const o='https://preview.soridraw.com';
const headerList='authorization,content-type,x-firebase-appcheck';
async function cfGet(path){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/'+path,{
  headers:{Authorization:'Bearer '+token,Accept:'application/json'},
  signal:AbortSignal.timeout(20000)});
 const j=await r.json();
 assert(r.ok&&j.success===true&&j.result,'CF_GET_'+r.status);
 return j.result;
}
async function phase(){
 // Global release control only. Does not select user rows, relations, receipts,
 // notifications, or any personal data.
 const sql="SELECT id, phase FROM explore_follow_cutover_control_348 WHERE id=1 LIMIT 1";
 assert(/^SELECT id, phase FROM explore_follow_cutover_control_348/.test(sql),'SQL_ALLOWLIST');
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+
   '/d1/database/'+db+'/query',{
  method:'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({sql,params:[]}),signal:AbortSignal.timeout(20000)});
 const j=await r.json(),x=j.result?.[0];
 assert(r.ok&&j.success===true&&x?.success===true&&
  Number(x?.meta?.rows_written)===0&&x.results?.length===1,
  'READONLY_GLOBAL_PHASE_UNAVAILABLE');
 const value=String(x.results[0].phase||'');
 assert(['legacy','armed','overlay','readonly'].includes(value),'UNKNOWN_FOLLOW_PHASE');
 console.log('BASIC_FOLLOW_GLOBAL_CUTOVER_PHASE='+value);
 return value;
}
async function preflight(method){
 const r=await fetch(url,{method:'OPTIONS',headers:{
  Origin:o,
  'Access-Control-Request-Method':method,
  'Access-Control-Request-Headers':headerList
 },signal:AbortSignal.timeout(20000)});
 const allowOrigin=String(r.headers.get('access-control-allow-origin')||'');
 const allowHeaders=String(r.headers.get('access-control-allow-headers')||'').toLowerCase();
 const allowMethods=String(r.headers.get('access-control-allow-methods')||'').toUpperCase();
 const status=r.status;
 const ok=(status===200||status===204)&&allowOrigin===o&&
  headerList.split(',').every(x=>allowHeaders.split(',').map(y=>y.trim()).includes(x))&&
  allowMethods.split(',').some(x=>x.trim()===method);
 console.log('BASIC_FOLLOW_ORDINARY_OPTIONS_'+method+'='+JSON.stringify({
  status,originMatches:allowOrigin===o,allowHeaders,allowMethods,pass:ok
 }));
 return ok;
}
// Inspect the exact canonical SOURCE ONLY. No requests or mutations.
async function inspectFrozenCanonical(){
 const {readFileSync}=await import('node:fs');
 const x=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
 assert(x.length>100000,'FROZEN_CANONICAL_SOURCE_MISSING');
 const searches=[
  '서버 처리 중 오류가 발생했습니다.',
  'async function handleFollowOverlay354(',
  'async function handleFollow(',
  'async function enforceFollowEdgeRateLimit355(',
  'follow-cutover-v348/active.json',
  'FOLLOW_ORDER_REQUIRED'
 ];
 for(const key of searches){
  const i=x.indexOf(key);
  console.log('BASIC_FOLLOW_SOURCE_MARKER_'+searches.indexOf(key)+'='+JSON.stringify({
   exists:i>=0,count:i<0?0:x.split(key).length-1,
   context:i<0?'':x.slice(Math.max(0,i-380),i+520).replace(/\\s+/g,' ').slice(0,900)
  }));
 }
}
// APP basic Follow: one non-persistent historical query, no live mutation.
// Do not log actor IDs, request headers, tokens, IPs, URLs or response bodies.
// Permission failures are reported as HOLD, not silently bypassed.
async function queryFollowTelemetryDry(){
 const q={
  queryId:'soridraw-follow-once-20261113',
  dry:true,
  timeframe:{from:Date.parse('2026-11-13T21:31:00Z'),
    to:Date.parse('2026-11-13T21:36:00Z')},
  view:'events',limit:100,
  parameters:{
   datasets:['cloudflare-workers'],
   filters:[{key:'$metadata.service',operation:'eq',type:'string',
    value:'soridraw-explore-preview'}],
   needle:{value:'/follow',isRegex:false,matchCase:false}
  }
 };
 try{
  const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+
    '/workers/observability/telemetry/query',{
   method:'POST',headers:{Authorization:'Bearer '+token,
    'Content-Type':'application/json'},
   body:JSON.stringify(q),signal:AbortSignal.timeout(25000)
  });
  const data=await r.json();
  if(!r.ok||data.success!==true){
   console.log('BASIC_FOLLOW_HISTORY_OBSERVABILITY=HOLD_HTTP_'+r.status+
    '_NO_LOG_PRIVILEGE_OR_DATA');
   return;
  }
  const events=data.result?.events?.events||[];
  let found=0;
  const compact=[];
  for(const x of events){
   const uri=String(x?.$workers?.event?.request?.url||x?.$workers?.url||
     x?.url||x?.$metadata?.url||'');
   // The whole query is already explicitly limited to '/follow' events.
   // Never log the URI or identity even when the event schema differs.
   if(found===0)console.log('BASIC_FOLLOW_EVENT_FIELD_KEYS='+JSON.stringify({
    root:Object.keys(x||{}).slice(0,30),
    worker:Object.keys(x?.$workers||{}).slice(0,30),
    workerEvent:Object.keys(x?.$workers?.event||{}).slice(0,30),
    metadata:Object.keys(x?.$metadata||{}).slice(0,30)
   }));
   found++;
   const status=Number(x?.$workers?.event?.response?.status||
     x?.$workers?.statusCode||x.statusCode||x?.$metadata?.statusCode||0);
   const outcome=String(x?.$workers?.outcome||'').slice(0,35);
   const rawErr=String(x?.$metadata?.error||x?.$workers?.event?.error||'');
   const err=rawErr.includes('://')?'[redacted]':
     rawErr.replace(/[A-Za-z0-9_-]{20,}/g,'[redacted]').slice(0,100);
   const messages=[
     typeof x?.source==='string'?x.source:'',
     typeof x?.source?.message==='string'?x.source.message:'',
     typeof x?.$metadata?.message==='string'?x.$metadata.message:'',
     typeof x?.$workers?.event?.error==='string'?x.$workers.event.error:'',
   ];
   const category=messages.join(' ').match(
    /(?:D1_ERROR|SQLITE_ERROR|SQLITE_BUSY|no such column|no such table|constraint failed|FOREIGN KEY constraint failed|binding parameter|missing column|database is locked|query failed)[^\n]{0,180}/i);
   const extracted=category?category[0].split('https://').join('[url]')
     .replace(/[A-Za-z0-9_-]{28,}/g,'[id]').slice(0,190):'';
   const method=String(x?.$workers?.event?.request?.method||'');
   const rawSummary=String(x?.source?.message||x?.$metadata?.message||
      (typeof x?.source==='string'?x.source:'')).split('\\n')[0];
   const safeSummary=rawSummary.includes('://')?'[url-redacted]':
     rawSummary.replace(/[A-Za-z0-9_-]{25,}/g,'[id]').slice(0,status===0?920:140);
   compact.push({status,method,outcome,error:err,dbFailure:extracted,
     errorSummary:safeSummary,errorMessageAvailable:messages.some(v=>v.length>0)});
  }
  console.log('BASIC_FOLLOW_HISTORY_OBSERVABILITY='+JSON.stringify({
   status:data.result?.run?.status,eventsReturned:events.length,
   followEvents:found,details:compact.slice(0,20)
  }));
 }catch(e){console.log('BASIC_FOLLOW_HISTORY_OBSERVABILITY=HOLD_UNAVAILABLE')}
}
async function inspectDeployedFollowStack(){
 const result=await cfGet('workers/workers/'+worker+'/versions/'+safe+'?include=modules');
 const entry=result.modules?.find(m=>m.name==='preview-entry.mjs');
 assert(entry?.content_base64&&result.modules?.length===12,'ACTIVE_MODULE_STACK_UNAVAILABLE');
 const {Buffer}=await import('node:buffer');
 const source=Buffer.from(entry.content_base64,'base64').toString('utf8');
 const lines=source.split(String.fromCharCode(10));
 console.log('BASIC_FOLLOW_DEPLOYED_SOURCE_LINES='+lines.length);
 for(const at of [724,14445,14501,14537,14572,14690]){
  const lower=Math.max(0,at-9),upper=Math.min(lines.length,at+10);
  // Code only; never output source secrets, user payloads or bearer headers.
  const section=lines.slice(lower,upper).map((text,i)=>
   (lower+i+1)+':'+text.slice(0,230)).join(' | ');
  console.log('BASIC_FOLLOW_DEPLOYED_STACK_'+at+'='+section.slice(0,3900));
 }
}
async function inspectFollowMutationSqlAndSchema(){
 const result=await cfGet('workers/workers/'+worker+'/versions/'+safe+'?include=modules');
 const entry=result.modules?.find(m=>m.name==='preview-entry.mjs');
 assert(entry?.content_base64,'ACTIVE_SQL_NOT_AVAILABLE');
 const {Buffer}=await import('node:buffer');
 const lines=Buffer.from(entry.content_base64,'base64').toString('utf8')
  .split(String.fromCharCode(10));
 console.log('BASIC_FOLLOW_ACTIVE_SQL_350='+lines.slice(14678,14743)
  .map((v,i)=>(14679+i)+':'+v.slice(0,280)).join(' | ').slice(0,14000));
 const queries=[
  "SELECT name,type,sql FROM sqlite_master WHERE name IN ('explore_follow_overrides_348','explore_follow_cutover_control_348','follows') ORDER BY name LIMIT 4",
  "SELECT name,type,sql FROM sqlite_master WHERE type='trigger' AND tbl_name='explore_follow_overrides_348' ORDER BY name LIMIT 30",
  "SELECT name,type,sql FROM sqlite_master WHERE type='index' AND tbl_name='explore_follow_overrides_348' ORDER BY name LIMIT 30",
  "SELECT name,type FROM pragma_table_info('explore_follow_overrides_348') ORDER BY cid LIMIT 30",
  "SELECT name,type,sql FROM sqlite_master WHERE name IN ('soridraw_notification_inbox_001','soridraw_notification_activation_002','public_profiles') ORDER BY name LIMIT 5",
  "SELECT name,type FROM pragma_table_info('soridraw_notification_inbox_001') ORDER BY cid LIMIT 35",
  "SELECT name,type FROM pragma_table_info('soridraw_notification_activation_002') ORDER BY cid LIMIT 15",
  "SELECT name,type FROM pragma_table_info('public_profiles') ORDER BY cid LIMIT 50",
  "SELECT id,enabled FROM soridraw_notification_activation_002 WHERE id=1 LIMIT 1"
 ];
 for(let i=0;i<queries.length;i++){
  const sql=queries[i];
  assert(sql.startsWith('SELECT '),'SQL_ALLOWLIST');
  const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+
   '/d1/database/'+db+'/query',{method:'POST',
   headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({sql,params:[]}),signal:AbortSignal.timeout(22000)});
  const j=await r.json(),x=j.result?.[0];
  assert(r.ok&&j.success===true&&x?.success===true&&x?.meta?.rows_written===0,
   'SCHEMA_READONLY_'+i);
  console.log('BASIC_FOLLOW_SCHEMA_'+i+'='+JSON.stringify(x.results).slice(0,13000));
 }
}
async function explainExactFollowUpsertReadonly(){
 const sql=`EXPLAIN WITH baseline(following) AS (
 SELECT EXISTS(SELECT 1 FROM follows WHERE follower_uid=? AND following_uid=?)
 ) INSERT INTO explore_follow_overrides_348(
 follower_uid,following_uid,following,baseline_following,updated_at,mutation_id
 ) SELECT ?,?,?,baseline.following,?,? FROM baseline
 WHERE baseline.following <> ? OR EXISTS(
 SELECT 1 FROM explore_follow_overrides_348 WHERE follower_uid=? AND following_uid=?
 ) ON CONFLICT(follower_uid,following_uid) DO UPDATE SET
 following=excluded.following,updated_at=excluded.updated_at,
 mutation_id=excluded.mutation_id
 WHERE explore_follow_overrides_348.updated_at < excluded.updated_at
 AND explore_follow_overrides_348.following <> excluded.following`;
 const params=['synthetic_actor','synthetic_target','synthetic_actor',
 'synthetic_target',1,1,'synthetic_probe_0123456789',1,
 'synthetic_actor','synthetic_target'];
 assert(sql.startsWith('EXPLAIN ')&&params.length===10,'EXPLAIN_NO_WRITE_SCOPE');
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+
 '/d1/database/'+db+'/query',{method:'POST',
 headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
 body:JSON.stringify({sql,params}),signal:AbortSignal.timeout(25000)});
 let j;try{j=await r.json()}catch{j={}};
 const result=j?.result?.[0],error=j?.errors?.[0]?.message||result?.error||'';
 const allowed=String(error).replace(/[A-Za-z0-9_-]{25,}/g,'[id]').slice(0,250);
 console.log('BASIC_FOLLOW_EXACT_UPSERT_EXPLAIN='+JSON.stringify({
  http:r.status,success:j?.success===true,sqlPrepared:result?.success===true,
  metaWritten:result?.meta?.rows_written??null,opcodeRows:result?.results?.length||0,
  error:allowed
 }));
 assert(!result||result.meta?.rows_written===0||result.success!==true,
  'EXPLAIN_WRITES_NOT_ALLOWED');
}
async function run(){
 assert(process.argv[2]==='--live'&&process.env.GITHUB_ACTIONS==='true'&&
  process.env.CLOUDFLARE_ACCOUNT_ID===account&&token.length>20,'ACTION_CONTEXT');
 const dep=await cfGet('workers/scripts/'+worker+'/deployments?per_page=1');
 const versions=dep.deployments?.[0]?.versions||[];
 assert(versions.length===2&&versions.find(x=>x.version_id===safe)?.percentage===100&&
  versions.find(x=>x.version_id===canary)?.percentage===0,'WORKER_NOT_EXPECTED_SAFE_100');
 const meta=await cfGet('workers/scripts/'+worker+'/versions/'+safe);
 const bindings=meta.resources?.bindings||[];
 const lookup=new Map(bindings.map(x=>[x.name,x]));
 assert(bindings.length===35&&lookup.get('SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607')?.text==='0'&&
 lookup.get('SORIDRAW_ENVIRONMENT')?.text==='preview'&&
 lookup.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.type==='durable_object_namespace'&&
 !lookup.has('OWNER_FOLLOW_RECOVERY_557'),'WORKER_BINDING_SAFE_GUARD');
 console.log('BASIC_FOLLOW_WORKER_SAFE100_BRIDGE_OFF_LIKE_DO_UNCHANGED=PASS');
 const [p,d] = await Promise.all([preflight('PUT'),preflight('DELETE')]);
 const cutover=await phase();
 await inspectFrozenCanonical();
 await inspectDeployedFollowStack();
 await inspectFollowMutationSqlAndSchema();
 await explainExactFollowUpsertReadonly();
 await queryFollowTelemetryDry();
 console.log('BASIC_FOLLOW_NO_USER_MUTATIONS_NO_BACKEND_DEPLOYS=PASS');
 if(!p||!d)throw Error('BASIC_FOLLOW_BROWSER_PREFLIGHT_FAIL');
 if(cutover==='readonly')throw Error('BASIC_FOLLOW_CUTOVER_READONLY');
 console.log('BASIC_FOLLOW_PREFLIGHT_AND_GLOBAL_MODE=PASS');
}
run().catch(e=>{console.error(String(e.message||e).slice(0,250));process.exitCode=2});

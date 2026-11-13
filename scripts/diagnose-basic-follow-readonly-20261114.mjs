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
   compact.push({status,outcome,error:err});
  }
  console.log('BASIC_FOLLOW_HISTORY_OBSERVABILITY='+JSON.stringify({
   status:data.result?.run?.status,eventsReturned:events.length,
   followEvents:found,details:compact.slice(0,20)
  }));
 }catch(e){console.log('BASIC_FOLLOW_HISTORY_OBSERVABILITY=HOLD_UNAVAILABLE')}
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
 await queryFollowTelemetryDry();
 console.log('BASIC_FOLLOW_NO_USER_MUTATIONS_NO_BACKEND_DEPLOYS=PASS');
 if(!p||!d)throw Error('BASIC_FOLLOW_BROWSER_PREFLIGHT_FAIL');
 if(cutover==='readonly')throw Error('BASIC_FOLLOW_CUTOVER_READONLY');
 console.log('BASIC_FOLLOW_PREFLIGHT_AND_GLOBAL_MODE=PASS');
}
run().catch(e=>{console.error(String(e.message||e).slice(0,250));process.exitCode=2});

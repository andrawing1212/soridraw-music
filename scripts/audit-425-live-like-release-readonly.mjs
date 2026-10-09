// Stage425: READ ONLY live release readiness audit. NO deployment.
// Worker deployments/content: GET only. Shared D1: POST /query strictly SELECT.
// NEVER accept arbitrary SQL, arbitrary DB UUID, or arbitrary worker script ID.
// Do not serialize token, request URL, user rows, or live data to output.
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!/^[a-f0-9]{32}$/.test(account||'')||!token)throw Error('425_NEED_READONLY_CLOUDFLARE_CREDENTIALS');
const root='https://api.cloudflare.com/client/v4/accounts/'+account;
const headers={Authorization:'Bearer '+token};
const scripts={
  preview:'soridraw-explore-preview',
  test:'soridraw-explore-test',
  production:'soridraw-explore-api',
};
const sharedId='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const needed=['SORIDRAW_SHARED_LIKE_READER_CUTOVER_078_20260921',
  'SORIDRAW_LIKE_D1ONLY_ROUTE_172_20260921',
  'SORIDRAW_LIKE_D1_ATOMIC_CUTOVER_FENCE_174_20260922'];
const repoMarker='SORIDRAW_420_SOURCE_ONLY_EXACT_D1_WRITER_ADAPTER';
let allReady=true;
for(const [mode,name] of Object.entries(scripts)) {
  const base=root+'/workers/scripts/'+name;
  const deployment=await fetch(base+'/deployments',{method:'GET',headers});
  if(!deployment.ok)throw Error('425_'+mode+'_WORKER_DEPLOYMENT_GET_FAILED_'+deployment.status);
  const body=await deployment.json();
  if(body?.success!==true)throw Error('425_'+mode+'_DEPLOYMENT_UNREADABLE');
  const versions=body?.result?.deployments?.[0]?.versions||[];
  const active=[...versions].sort((a,b)=>Number(b.percentage||0)-Number(a.percentage||0))[0];
  if(!active || Number(active.percentage)<99.99) {
    console.log('425_'+mode.toUpperCase()+'_ACTIVE_WORKER=NOT_EXCLUSIVE');
    allReady=false;
    continue;
  }
  const response=await fetch(base+'/content/v2',{method:'GET',headers});
  if(!response.ok)throw Error('425_'+mode+'_CONTENT_GET_FAILED_'+response.status);
  const source=await response.text();
  if(!source||source.length<1000)throw Error('425_'+mode+'_ACTIVE_CONTENT_EMPTY');
  const missing=needed.filter(x=>!source.includes(x));
  const targetMarker=source.includes(repoMarker);
  const ready=missing.length===0&&targetMarker;
  allReady&&=ready;
  console.log('425_'+mode.toUpperCase()+'_ACTIVE_VERSION='+String(active.version_id||'unknown'));
  console.log('425_'+mode.toUpperCase()+'_171_ROUTE='+(!missing.includes(needed[1])?'PRESENT':'MISSING'));
  console.log('425_'+mode.toUpperCase()+'_174_DB_FENCE='+(!missing.includes(needed[2])?'PRESENT':'MISSING'));
  console.log('425_'+mode.toUpperCase()+'_420_REAL_BUNDLE='+ (targetMarker?'PRESENT':'MISSING'));
}
async function select(sql) {
  if(!/^SELECT\s/i.test(sql)||/[;]/.test(sql)||/\b(INSERT|DELETE|UPDATE|DROP|ALTER|REPLACE|CREATE|PRAGMA|ATTACH|DETACH)\b/i.test(sql)) {
    throw Error('425_REFUSE_NON_SELECT');
  }
  const response=await fetch(root+'/d1/database/'+sharedId+'/query',{
    method:'POST',headers:{...headers,'Content-Type':'application/json'},
    body:JSON.stringify({sql,params:[]}),
  });
  if(!response.ok)throw Error('425_SHARED_D1_READONLY_QUERY_FAILED_'+response.status);
  const payload=await response.json();
  if(payload?.success!==true||!Array.isArray(payload.result)||payload.result.length!==1){
    throw Error('425_SHARED_D1_READONLY_RESPONSE_INVALID');
  }
  const result=payload.result[0];
  if(!result.success||result.meta?.rows_written!==0)throw Error('425_UNEXPECTED_D1_WRITE');
  return result.results||[];
}
const expect=[
  'explore_like_batches_035','explore_like_batches_066',
  'explore_like_batches_069','explore_like_user_queue_075',
  'explore_like_overrides_171','explore_like_count_deltas_171',
  'explore_like_cutover_control_174','explore_like_writer_phase_419',
];
const names=(await select("SELECT name FROM sqlite_schema WHERE type='table' AND name IN ('explore_like_batches_035','explore_like_batches_066','explore_like_batches_069','explore_like_user_queue_075','explore_like_overrides_171','explore_like_count_deltas_171','explore_like_cutover_control_174','explore_like_writer_phase_419')")).map(r=>r.name);
for(const name of expect)console.log('425_SHARED_SCHEMA_'+name+'='+(names.includes(name)?'PRESENT':'MISSING'));
if(!expect.slice(4).every(x=>names.includes(x)))allReady=false;
for(const [type,table] of [
  ['035','explore_like_batches_035'],['066','explore_like_batches_066'],
  ['069','explore_like_batches_069'],['075','explore_like_user_queue_075'],
]){
  if(!names.includes(table)){allReady=false;console.log('425_QUEUE_'+type+'=SCHEMA_MISSING');continue;}
  const list=await select('SELECT 1 AS pending FROM '+table+' LIMIT 1');
  const status=list.length?'PENDING':'EMPTY';
  console.log('425_QUEUE_'+type+'='+status);
  if(list.length)allReady=false;
}
console.log('425_REAL_SHARED_DATA_WRITES=0');
console.log('425_RELEASE_DEPLOYMENT=0');
console.log('425_CUTOVER_RELEASE_GATE='+(allReady?'REQUIRES_INDEPENDENT_PROOF':'HOLD'));
console.log('425_READONLY_AUDIT_EXECUTED=PASS');

// APP518 verified QA live resource preflight. NO deployments or writes.
// The single Cloudflare D1 POST executes only a fixed sqlite_master SELECT,
// and a 200 response MUST attest rows_written=0. Other calls are GET only.
import {execFileSync} from 'node:child_process';
import {QA518} from '../isolated/qaGate518.mjs';
const account='b60fcd62c679c64db19f0b0e0c2f3429';
const base='https://api.cloudflare.com/client/v4/accounts/'+account;
const forbidden='e1a30fc9ef497fda1d34f4ab3dc1da45';
const fail=(code)=>{throw new Error(code)};
const exactly=(rows,pred)=>Array.isArray(rows)&&rows.length===1&&pred(rows[0]);
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const fixedSql="SELECT name FROM sqlite_master WHERE type IN ('table','index')"+
 " AND (name LIKE 'music_note_catalog_%_518' OR name LIKE 'idx_music_note_catalog_%') ORDER BY name LIMIT 20";
const isArray=x=>Array.isArray(x)?x:x?.databases||x?.buckets||x?.scripts;
const noExtraResourceUrl=path=>/^\/(?:workers\/scripts(?:\/soridraw-owner-qa-583\/(?:deployments|settings))?|d1\/database\?per_page=100&page=1|r2\/buckets\?per_page=100)$/.test(path);

export async function inspectCloudflareQa518({call,workerToken,storageToken,dataToken,
 expectedApp518Names=[]}={}){
  if(account!==QA518.accountId||account===forbidden)
    fail('HOLD_QA_CLOUDFLARE_ACCOUNT_PIN');
  if(typeof call!=='function'||[workerToken,storageToken,dataToken].some(x=>
    typeof x!=='string'||x.length<20))fail('HOLD_QA_READONLY_CREDENTIALS');
  const get=async(path,token)=>{
    if(!noExtraResourceUrl(path))fail('HOLD_QA_UNLISTED_API_PATH');
    const response=await call(base+path,{method:'GET',redirect:'error',
      headers:{Authorization:'Bearer '+token,Accept:'application/json'},
      signal:AbortSignal.timeout(15000)});
    if(response?.status!==200)fail('HOLD_QA_METADATA_HTTP_'+String(response?.status));
    const data=await response.json();
    if(data?.success!==true)fail('HOLD_QA_METADATA_DENIED');
    return data.result;
  };
  const [workers,databases,buckets,deploy,settings]=await Promise.all([
    get('/workers/scripts',workerToken),
    get('/d1/database?per_page=100&page=1',storageToken),
    get('/r2/buckets?per_page=100',storageToken),
    get('/workers/scripts/soridraw-owner-qa-583/deployments',workerToken),
    get('/workers/scripts/soridraw-owner-qa-583/settings',workerToken),
  ]);
  if(!exactly(isArray(workers),w=>w.id===QA518.originalWorker)
    ||!exactly(isArray(databases),d=>d.name===QA518.d1Name&&uuid.test(d.uuid||''))
    ||!exactly(isArray(buckets),b=>(b.name||b.bucket_name)===QA518.r2Name))
    fail('HOLD_QA_ACCOUNT_RESOURCES_DRIFTED');
  const original=deploy?.deployments?.[0]?.versions;
  if(!exactly(original,v=>v.version_id===QA518.originalVersion&&Number(v.percentage)===100))
    fail('HOLD_QA_ORIGINAL_WORKER_VERSION_DRIFTED');
  if(!Array.isArray(settings?.bindings)||settings.bindings.length<4
    ||settings.bindings.some(b=>['d1','d1_database','r2_bucket'].includes(b.type))
    ||new Set(settings.bindings.map(b=>b.name)).size!==settings.bindings.length
    ||!settings.bindings.some(b=>b.name==='OWNER558_DO'&&b.type==='durable_object_namespace')
    ||!settings.bindings.some(b=>b.name==='OWNER583_QA_CONFIG'&&b.type==='secret_text'))
    fail('HOLD_QA_ORIGINAL_WORKER_BINDING_CHANGED');
  const d1Id=isArray(databases)[0].uuid;
  const queryUrl=base+'/d1/database/'+d1Id+'/query';
  const response=await call(queryUrl,{method:'POST',redirect:'error',
    headers:{Authorization:'Bearer '+dataToken,Accept:'application/json',
      'Content-Type':'application/json'},
    body:JSON.stringify({sql:fixedSql}),signal:AbortSignal.timeout(15000)});
  if(response?.status!==200)fail('HOLD_QA_D1_SELECT_HTTP_'+String(response?.status));
  const body=await response.json();
  const data=body?.result?.length===1?body.result[0]:null;
  if(body?.success!==true||data?.success!==true
    ||Number(data.meta?.rows_written)!==0||!Array.isArray(data.results)
    ||data.results.length>20||data.results.some(row=>typeof row.name!=='string'))
    fail('HOLD_QA_D1_SELECT_NOT_W0');
  const names=data.results.map(x=>x.name);
  const installed=['music_note_catalog_daily_budget_518',
   'music_note_catalog_index_meta_518','music_note_catalog_member_518',
   'music_note_catalog_paged_stage_518','music_note_catalog_outbox_518',
   'idx_music_note_catalog_member_518_generation',
   'idx_music_note_catalog_outbox_518_due'].sort();
  if(!Array.isArray(expectedApp518Names)
    ||!(expectedApp518Names.length===0 ||
      JSON.stringify([...expectedApp518Names].sort())===JSON.stringify(installed))
    ||JSON.stringify([...names].sort())!==JSON.stringify([...expectedApp518Names].sort()))
    fail('HOLD_QA_PARTIAL_OR_OLD_APP518_TABLES');
  return Object.freeze({accountId:account,d1Id,
    originalWorkerVersion:QA518.originalVersion,
    existingWorkerCount:1,d1DatabaseCount:1,r2BucketCount:1,
    app518TablesPresent:names.filter(x=>x.startsWith('music_note_catalog_')).length,
    app518IndexesPresent:names.filter(x=>x.startsWith('idx_music_note_catalog_')).length,
    d1RowsWritten:0,
    cloudMutations:0,sourceVersion:QA518.candidateSha});
}
const exec=(argv)=>execFileSync('gcloud',argv,{
 encoding:'utf8',maxBuffer:1024*1024,timeout:25000,
 stdio:['ignore','pipe','pipe'],
}).trim();
const json=(argv)=>JSON.parse(exec([...argv,'--format=json','--quiet']));
export function inspectFirebaseQa518({project,number,database,functions}={}){
  if(project?.projectId!==QA518.firebaseProject
    ||String(project?.projectNumber)!==QA518.firebaseNumber)
    fail('HOLD_QA_FIREBASE_PROJECT_DRIFT');
  if(database?.name!=='projects/soridraw-app/databases/(default)'
    ||database.locationId!=='asia-northeast3'
    ||!['STANDARD','FIRESTORE_NATIVE'].includes(
       String(database.edition||database.type||'').toUpperCase()))
    fail('HOLD_QA_FIRESTORE_DB_DRIFT');
  if(!Array.isArray(functions)||functions.length!==1
    ||functions.some(x=>/app518/i.test(String(x.name)))
    ||!functions.some(x=>String(x.name).endsWith('/publishExploreOwnerFollower542')))
    fail('HOLD_QA_FIREBASE_FUNCTIONS_DRIFT');
  return {firebaseProject:QA518.firebaseProject,
    firebaseNumber:QA518.firebaseNumber,
    firestore:'(default) asia-northeast3',existingFunctions:1,
    app518Functions:0,cloudMutations:0};
}
async function runLive(){
  const cf=await inspectCloudflareQa518({
    call:fetch,workerToken:process.env.CLOUDFLARE_QA_API_TOKEN,
    storageToken:process.env.CLOUDFLARE_QA_STORAGE_READ_TOKEN,
    dataToken:process.env.CLOUDFLARE_QA_DATA_TOKEN,
  });
  const f=inspectFirebaseQa518({
    project:json(['projects','describe','soridraw-app']),
    database:json(['firestore','databases','describe','--database=(default)','--project=soridraw-app']),
    functions:json(['functions','list','--project=soridraw-app','--regions=asia-northeast3']),
  });
  console.log('APP518_QA_LIVE_CLOUDFLARE_AND_FIREBASE_READONLY=PASS');
  console.log('APP518_QA_SCHEMA_INACTIVE_AND_EXISTING_QA583_UNCHANGED=PASS');
  console.log('APP518_QA_PRELIVE_NO_WRITES=PASS; CLOUD_MUTATIONS=0; LIVE_E2E=NOT_TESTED');
  console.log(JSON.stringify({code:'QA518_LIVE_READONLY_PRECHECK_PASS',cf:{
    existingWorkerCount:cf.existingWorkerCount,
    d1DatabaseCount:cf.d1DatabaseCount,r2BucketCount:cf.r2BucketCount,
    app518TablesPresent:cf.app518TablesPresent,d1RowsWritten:cf.d1RowsWritten,
  },firebase:f}));
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
  if(process.argv[2]!=='--live-readonly')fail('HOLD_QA_BAD_ENTRY_MODE');
  runLive().catch(e=>{console.error(String(e?.message||e).slice(0,150));process.exitCode=1});
}

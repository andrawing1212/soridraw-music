// APP768 physical QA: guarded temporary Worker and six-way R2 race.
// No PRODUCTION, PREVIEW, TEST, Firebase, or shared user-data mutations.
import {randomBytes,webcrypto} from 'node:crypto';
import {writeFileSync,readFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';

const QA='b60fcd62c679c64db19f0b0e0c2f3429';
const PROD='e1a30fc9ef497fda1d34f4ab3dc1da45';
const BASE='https://api.cloudflare.com/client/v4/accounts/'+QA;
const R2='soridraw-qa-app768-r2', D1='soridraw-qa-app768-d1';
const APP583='soridraw-owner-qa-583',OLD='4ed70845-6a4b-4a80-9c51-ed95d0becc38';
const ID=process.env.GITHUB_RUN_ID||'', TMP=process.env.RUNNER_TEMP||'';
const STATE=join(TMP,'app768-r2-race-state.json');
const CONFIG=resolve('wrangler.app768-r2-race.generated.json');
const worker='soridraw-qa-app768-race-'+ID;
const hold=x=>{throw Error('APP768_QA_RACE_HOLD_'+x)};
const delay=ms=>new Promise(ok=>setTimeout(ok,ms));
const token=t=>typeof t==='string'&&t.length>=20;
function checkRun(){
 if(QA===PROD||process.env.GITHUB_REPOSITORY!=='andrawing1212/soridraw-music'||
  process.env.GITHUB_EVENT_NAME!=='push'||process.env.GITHUB_REF!=='refs/heads/main'||
  !/^\d{8,20}$/.test(ID)||!TMP||
  process.env.CLOUDFLARE_ACCOUNT_ID!==QA)hold('BAD_QA_RUN_IDENTITY');
}
async function api(path,credential,method='GET'){
 if(!path.startsWith(BASE+'/')||!token(credential))hold('API_OUT_OF_QA_SCOPE');
 const response=await fetch(path,{method,redirect:'error',
  headers:{Authorization:'Bearer '+credential,Accept:'application/json',
   'Cache-Control':'no-store'},signal:AbortSignal.timeout(18000)});
 return {code:response.status,json:await response.json().catch(()=>null)};
}
function result(x,label){
 if(x.code!==200||x.json?.success!==true)hold(label+'_HTTP_'+x.code);
 return x.json.result;
}
async function baseline(){
 const readToken=process.env.CLOUDFLARE_QA_API_TOKEN;
 const dataToken=process.env.CLOUDFLARE_QA_DATA_TOKEN;
 const dep=result(await api(BASE+'/workers/scripts/'+APP583+'/deployments',readToken),
  'QA_APP583');
 const vs=dep?.deployments?.[0]?.versions;
 if(!Array.isArray(vs)||vs.length!==1||vs[0]?.version_id!==OLD||
    Number(vs[0]?.percentage)<99.99)hold('APP583_ACTIVE_DRIFT');
 const db=result(await api(BASE+'/d1/database',dataToken),'QA_D1_LIST');
 const rb=result(await api(BASE+'/r2/buckets',dataToken),'QA_R2_LIST');
 const dbs=Array.isArray(db)?db:db?.databases;
 const bs=Array.isArray(rb)?rb:rb?.buckets;
 if(!Array.isArray(dbs)||dbs.length!==1||dbs[0].name!==D1||
    !Array.isArray(bs)||bs.length!==1||bs[0].name!==R2)
   hold('QA_D1_R2_NOT_EXACTLY_PREVIOUS_PASS');
 console.log('APP768_ORIGINAL_APP583_100_AND_PREVIOUS_D1_R2=PASS');
}
async function preflight(){
 checkRun();
 for(const k of ['CLOUDFLARE_QA_API_TOKEN','CLOUDFLARE_QA_DEPLOY_TOKEN',
   'CLOUDFLARE_QA_DATA_TOKEN'])
  if(!token(process.env[k]))hold('QA_TOKEN_MISSING_'+k);
 if(existsSync(STATE)||existsSync(CONFIG))hold('LOCAL_STATE_EXISTS');
 await baseline();
 const endpoint=BASE+'/workers/scripts/'+worker;
 const existing=await api(endpoint,process.env.CLOUDFLARE_QA_API_TOKEN);
 if(existing.code!==404)hold('WORKER_ALREADY_EXISTS_OR_UNVERIFIED_'+existing.code);
 const hex=n=>randomBytes(n).toString('hex');
 const vars={SORIDRAW_ENVIRONMENT:'isolated-qa',
  APP768_ACCESS:hex(32),APP768_EPOCH:hex(16),
  APP768_CUTOVER:'qa768_cutover_'+hex(16),
  APP768_OPERATION:'qa768_op_'+hex(16)};
 const config={name:worker,main:'./scripts/app768-qa-race-worker.mjs',
  account_id:QA,compatibility_date:'2026-11-19',workers_dev:true,
  r2_buckets:[{binding:'QA_APP768_R2',bucket_name:R2}],vars};
 writeFileSync(CONFIG,JSON.stringify(config,null,2),{mode:0o600});
 writeFileSync(STATE,JSON.stringify({worker,vars}),{mode:0o600});
 console.log('APP768_DISPOSABLE_WORKER_PREPARED=PASS');
}
function getState(){
 if(!existsSync(STATE))return null;
 const s=JSON.parse(readFileSync(STATE,'utf8'));
 if(s.worker!==worker||!/^qa768_op_[a-f0-9]{32}$/.test(s.vars?.APP768_OPERATION||'')||
    !/^qa768_cutover_[a-f0-9]{32}$/.test(s.vars?.APP768_CUTOVER||'')||
    !/^[a-f0-9]{32}$/.test(s.vars?.APP768_EPOCH||'')||
    !/^[a-f0-9]{64}$/.test(s.vars?.APP768_ACCESS||''))
  hold('STATE_IDENTITY_UNVERIFIED');
 return s;
}
async function workerFetch(s,route,method='GET'){
 const res=await fetch('https://'+worker+'.soridraw-qa.workers.dev'+route,{
  method,redirect:'error',headers:{'X-APP768-QA-Access':s.vars.APP768_ACCESS,
  'Cache-Control':'no-store'},signal:AbortSignal.timeout(18000)});
 return {code:res.status,json:await res.json().catch(()=>null)};
}
async function deploy(){
 checkRun();
 const s=getState();
 if(!s)hold('NO_PREPARED_STATE');
 if(!token(process.env.CLOUDFLARE_QA_DEPLOY_TOKEN))
  hold('QA_DEPLOY_TOKEN_MISSING');
 const path=resolve('app768-r2-worker.bundle.mjs');
 if(!existsSync(path))hold('OFFLINE_BUNDLE_MISSING');
 const code=readFileSync(path,'utf8');
 if(code.length<1000||code.length>100000||!code.includes('APP767_ISOLATED_SYNTHETIC_QA'))
  hold('BUNDLE_SCOPE_UNVERIFIED');
 const metadata={main_module:'app768-worker.mjs',
  compatibility_date:'2026-11-19',
  bindings:[
   {type:'r2_bucket',name:'QA_APP768_R2',bucket_name:R2},
   ...Object.entries(s.vars).map(([name,text])=>({type:'plain_text',name,text})),
  ],
 };
 const form=new FormData();
 form.append('metadata',new Blob([JSON.stringify(metadata)],
  {type:'application/json'}),'metadata.json');
 form.append('app768-worker.mjs',new Blob([code],
  {type:'application/javascript+module'}),'app768-worker.mjs');
 // The official script upload API is authorized independently of Wrangler's
 // R2 metadata GET. Cloudflare itself must still authorize this binding.
 const uploaded=await fetch(BASE+'/workers/scripts/'+worker,{
  method:'PUT',headers:{Authorization:'Bearer '+
   process.env.CLOUDFLARE_QA_DEPLOY_TOKEN,Accept:'application/json'},
  body:form,redirect:'error',signal:AbortSignal.timeout(20000)});
 const response=await uploaded.json().catch(()=>null);
 if(uploaded.status!==200||response?.success!==true)
  hold('DIRECT_API_BINDING_DEPLOY_'+uploaded.status+'_CODES_'+
   (response?.errors||[]).map(e=>e?.code||'NA').join('_'));
 const sub=await fetch(BASE+'/workers/scripts/'+worker+'/subdomain',{
  method:'POST',headers:{Authorization:'Bearer '+
   process.env.CLOUDFLARE_QA_DEPLOY_TOKEN,
   'Content-Type':'application/json',Accept:'application/json'},
  body:JSON.stringify({enabled:true,previews_enabled:false}),
  redirect:'error',signal:AbortSignal.timeout(18000)});
 const sj=await sub.json().catch(()=>null);
 if(sub.status!==200||sj?.success!==true)
  hold('QA_WORKER_SUBDOMAIN_'+sub.status+'_CODES_'+
   (sj?.errors||[]).map(e=>e?.code||'NA').join('_'));
 // GET /workers/scripts/:name returns raw Worker code, not API JSON.
 // Wait only for this one newly created QA Worker to become readable.
 let readable=false;
 for(let i=0;i<12;i++){
  const available=await api(BASE+'/workers/scripts/'+worker,
   process.env.CLOUDFLARE_QA_API_TOKEN);
  if(available.code===200){readable=true;break;}
  if(available.code!==404)hold('QA_WORKER_VERIFY_HTTP_'+available.code);
  if(i<11)await delay(1500);
 }
 if(!readable)hold('QA_WORKER_UPLOAD_NOT_VISIBLE');
 console.log('APP768_DISPOSABLE_QA_WORKER_DIRECT_UPLOAD=PASS');
}

async function race(){
 checkRun();
 const s=getState();if(!s)hold('NO_PREPARED_STATE');
 let ready=false;
 for(let i=0;i<12;i++){
  try{
   const a=await workerFetch(s,'/health');
   if(a.code===200&&a.json?.status==='READY'){
    if(a.json.empty!==true)hold('SYNTHETIC_KEY_NOT_EMPTY');
    ready=true;break;
   }
  }catch(e){if(String(e.message).includes('KEY_NOT_EMPTY'))throw e;}
  if(i<11)await delay(1800);
 }
 if(!ready)hold('WORKER_NOT_READY');
 const rs=await Promise.all(Array.from({length:6},
  ()=>workerFetch(s,'/claim','POST')));
 const win=rs.filter(x=>x.code===201&&
   x.json?.status==='ADMISSION_ONLY_NOT_D1_COMMIT').length;
 const duplicates=rs.filter(x=>x.code===409&&
   x.json?.status==='DUPLICATE_BLOCKED').length;
 const seen=await workerFetch(s,'/inspect');
 // Only numeric HTTP codes and fixed QA outcome labels, never identities,
 // object keys, access tokens, or raw Cloudflare response bodies.
 const counts=new Map();
 for(const value of rs){
  const kind=String(value.json?.status||'NO_STATUS');
  const reason=String(value.json?.reason||'NONE');
  const label=String(value.code)+'_'+kind+'_'+reason;
  counts.set(label,(counts.get(label)||0)+1);
 }
 console.log('APP768_R2_RACE_RESULT_COUNTS='+JSON.stringify([...counts]));
 console.log('APP768_R2_RACE_INSPECT_HTTP='+seen.code+
  '_EXISTS='+String(seen.json?.exists===true)+
  '_CONTENTTYPE='+String(seen.json?.contentType||'NONE').slice(0,40));
 if(win!==1||duplicates!==5||seen.code!==200||
   seen.json?.exists!==true||seen.json?.contentType!=='application/json')
  hold('R2_PHYSICAL_RACE_NOT_PROVEN');
 console.log('APP768_REAL_R2_SIX_SAME_OPERATION_REQUESTS=6');
 console.log('APP768_REAL_R2_CONDITIONAL_SINGLE_WINNER=1');
 console.log('APP768_REAL_R2_CONDITIONAL_DUPLICATES_BLOCKED=5');
 console.log('APP768_REAL_WORKERS_R2_CREATE_ONCE=PASS');
 console.log('APP768_REAL_CANONICAL_FOLLOW_D1_W2=NOT_TESTED');
}
async function cleanup(){
 checkRun();
 const s=getState();
 if(!s){console.log('APP768_NO_DISPOSABLE_WORKER_PREPARED');return;}
 let objectCleaned=false;
 const errors=[];
 try{
  const reply=await workerFetch(s,'/cleanup','POST');
  objectCleaned=reply.code===200&&reply.json?.status==='CLEANED';
 }catch{}
 if(!objectCleaned){
  // No bucket-wide deletes: derive only this run's exact synthetic hash.
  const v=s.vars, raw=JSON.stringify([v.APP768_CUTOVER,
   'app768OwnerSynthetic','app768ActorSynthetic',v.APP768_EPOCH,v.APP768_OPERATION]);
  const hashed=new Uint8Array(await webcrypto.subtle.digest('SHA-256',
   new TextEncoder().encode(raw)));
  const key='internal/qa767/owner-follow-admissions/'+
   [...hashed].map(n=>n.toString(16).padStart(2,'0')).join('');
  const path=BASE+'/r2/buckets/'+R2+'/objects/'+encodeURIComponent(key);
  try{
   const d=await api(path,process.env.CLOUDFLARE_QA_DATA_TOKEN,'DELETE');
   const codes=(d.json?.errors||[]).map(x=>x.code);
   if(!(d.code===200&&d.json?.success===true)&&
      !codes.includes(10007))
    hold('EXACT_OBJECT_DELETE_FAILED_'+d.code);
   objectCleaned=true;
  }catch(e){errors.push('OBJECT_'+String(e.message));}
 }
 const workerPath=BASE+'/workers/scripts/'+worker;
 try{
  const d=await api(workerPath,process.env.CLOUDFLARE_QA_DEPLOY_TOKEN,'DELETE');
  if(d.code!==200&&d.code!==404)
   hold('WORKER_DELETE_'+d.code);
  let absent=false;
  for(let i=0;i<6;i++){
   const x=await api(workerPath,process.env.CLOUDFLARE_QA_API_TOKEN);
   if(x.code===404){absent=true;break;}
   if(i<5)await delay(1000);
  }
  if(!absent)hold('DISPOSABLE_WORKER_NOT_DELETED');
  console.log('APP768_DISPOSABLE_WORKER_DELETED=PASS');
 }catch(e){errors.push('WORKER_'+String(e.message));}
 if(!objectCleaned)errors.push('R2_OBJECT_NOT_CLEAN');
 try{await baseline()}catch(e){errors.push('EXISTING_QA_DRIFT_'+String(e.message));}
 if(errors.length)hold(errors.join('_'));
 console.log('APP768_EXACT_SYNTHETIC_R2_KEY_CLEANED=PASS');
 console.log('APP768_QA_D1_R2_AND_APP583_UNCHANGED=PASS');
}
const mode=process.argv[2];
if(!['preflight','deploy','race','cleanup'].includes(mode))hold('UNKNOWN_MODE');
const run=mode==='preflight'?preflight:mode==='deploy'?deploy:mode==='race'?race:cleanup;
run().catch(e=>{console.error(String(e.message||'UNEXPECTED_QA_ERROR'));process.exitCode=2;});

// APP790 — one-shot physical QA using ONLY existing QA583 DO namespace,
// existing QA D1 synthetic table and existing QA R2. Never PRODUCTION.
// Candidate is active only in the bounded isolated QA browser window.
// NO new DO namespace/migration, new D1/R2/secret, or user data.
import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
const ACCOUNT='b60fcd62c679c64db19f0b0e0c2f3429';
const PRODUCTION='e1a30fc9ef497fda1d34f4ab3dc1da45';
const OLD='soridraw-owner-qa-583',ORIGINAL='4ed70845-6a4b-4a80-9c51-ed95d0becc38';
const DB='soridraw-qa-app768-d1',BUCKET='soridraw-qa-app768-r2';
const ORIGIN='https://soridraw-owner-qa-583.soridraw-qa.workers.dev';
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
const RUN=process.env.GITHUB_RUN_ID||'',TEMP=process.env.RUNNER_TEMP||'';
const STATE=join(TEMP||'/tmp','app790-physical-state.json');
const SHA=/^[0-9a-f]{40}$/,UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const HOLD=s=>{throw Error('APP790_ISOLATED_PHYSICAL_HOLD_'+s)};
const checkedToken=x=>typeof x==='string'&&x.length>=20;
const getToken=type=>process.env[type]||'';
function guarded(){
 if(ACCOUNT===PRODUCTION||process.env.GITHUB_REPOSITORY!=='andrawing1212/soridraw-music'||
    process.env.GITHUB_EVENT_NAME!=='issue_comment'||
    process.env.GITHUB_REF!=='refs/heads/main'||
    process.env.APP790_QA_APPROVAL!=='APP790_EXISTING_QA_BROWSER_ONE_SHOT'||
    process.env.CLOUDFLARE_ACCOUNT_ID!==ACCOUNT||
    !/^[0-9]{8,20}$/.test(RUN)||!TEMP||
    !checkedToken(getToken('CLOUDFLARE_QA_API_TOKEN'))||
    !checkedToken(getToken('CLOUDFLARE_QA_DEPLOY_TOKEN'))||
    !checkedToken(getToken('CLOUDFLARE_QA_DATA_TOKEN')))
  HOLD('EXACT_QA_SCOPE_OR_TOKEN_MISSING');
}
function state(){
 if(!existsSync(STATE))return null;
 const s=JSON.parse(readFileSync(STATE,'utf8'));
 if(s.run!==RUN||!/^qa790_[a-f0-9]{16}$/.test(s.row||'')||
    !/^qa790_cutover_[a-f0-9]{32}$/.test(s.cutover||'')||

    !/^[a-f0-9]{64}$/.test(s.access||'')||!UUID.test(s.uuid||''))
  HOLD('RUN_SCOPED_STATE_CORRUPT');
 return s;
}
function save(s){writeFileSync(STATE,JSON.stringify(s),{mode:0o600})}
async function api(path,token,method='GET',body){
 if(!path.startsWith(BASE+'/')||!checkedToken(token))HOLD('QA_API_ACCOUNT_BOUNDARY');
 const res=await fetch(path,{method,headers:{Authorization:'Bearer '+token,
  Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),redirect:'error',
  signal:AbortSignal.timeout(25000)});
 const j=await res.json().catch(()=>null);
 return {status:res.status,ok:res.ok&&j?.success===true,data:j?.result,
  errors:(j?.errors||[]).map(e=>Number(e.code)).filter(Number.isInteger).slice(0,2)};
}
function ok(v,name){if(v.status!==200||!v.ok)HOLD(name+'_HTTP_'+v.status+
 '_CODES_'+v.errors.join('_'));return v.data}
async function active(){
 const r=ok(await api(BASE+'/workers/scripts/'+OLD+'/deployments',
  getToken('CLOUDFLARE_QA_API_TOKEN')),'DEPLOYMENT');
 const versions=r?.deployments?.[0]?.versions;
 if(!Array.isArray(versions)||versions.length!==1||
    versions[0].version_id!==ORIGINAL||
    Number(versions[0].percentage)!==100)
  HOLD('QA583_ORIGINAL_TRAFFIC_NOT_100');
 return true;
}
async function d1(s,sql){
 if(!sql.includes(s.row)||!sql.includes('app768_qa_synthetic_follow')||
    !/^(SELECT|INSERT|DELETE)\b/.test(sql)||sql.length>230||
    /DROP|ALTER|CREATE|follows|profile_stats/i.test(sql))
  HOLD('SYNTHETIC_D1_QUERY_SCOPE');
 const raw=ok(await api(BASE+'/d1/database/'+s.uuid+'/query',
   getToken('CLOUDFLARE_QA_DATA_TOKEN'),'POST',{sql}),'SYNTHETIC_D1');
 const a=Array.isArray(raw)&&raw.length===1?raw[0]:null;
 if(a?.success!==true||!Number.isSafeInteger(a?.meta?.rows_written))
  HOLD('D1_META_UNVERIFIED');
 return a;
}
async function preflight(){
 guarded();if(state())HOLD('RUN_COLLISION');
 await active();
 const version=ok(await api(BASE+'/workers/workers/'+OLD+'/versions/'+ORIGINAL,
  getToken('CLOUDFLARE_QA_API_TOKEN')),'ACTIVE_DO_VERSION');
 const expected={OWNER558_DO:'durable_object_namespace',
 OWNER583_QA_CONFIG:'secret_text',SORIDRAW_ENVIRONMENT:'plain_text',
 SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'plain_text'};
 if(version.id!==ORIGINAL||version.bindings?.length!==4||
    Object.keys(expected).some(k=>version.bindings.find(x=>x.name===k)?.type!==expected[k]))
  HOLD('QA583_EXISTING_DO_CLASS_OR_SECRET_BINDING_DRIFT');
 const [databases,r2]=await Promise.all([
  api(BASE+'/d1/database',getToken('CLOUDFLARE_QA_DATA_TOKEN')),
  api(BASE+'/r2/buckets',getToken('CLOUDFLARE_QA_DATA_TOKEN'))]);
 const dbs=ok(databases,'D1_LIST'),buckets=ok(r2,'R2_LIST');
 const list=Array.isArray(dbs)?dbs:dbs?.databases,rs=Array.isArray(buckets)?buckets:buckets?.buckets;
 if(!Array.isArray(list)||list.length!==1||list[0].name!==DB||
    !UUID.test(list[0].uuid)||!Array.isArray(rs)||rs.length!==1||
    rs[0].name!==BUCKET)
  HOLD('EXISTING_QA_D1_R2_RESOURCES_CHANGED');
 const s={run:RUN,uuid:list[0].uuid,row:'qa790_'+randomBytes(8).toString('hex'),
  access:randomBytes(32).toString('hex'),
  cutover:'qa790_cutover_'+randomBytes(16).toString('hex'),
  candidate:null,deployed:false,d1Inserted:false};
 save(s);
 const before=await d1(s,"SELECT COUNT(*) AS n FROM app768_qa_synthetic_follow WHERE k='"+s.row+"'");
 if(before.results?.[0]?.n!==0)HOLD('ROW_ALREADY_EXISTS');
 // Mark attempt BEFORE issuing D1 INSERT: an ACK-lost insert is still
 // cleaned by its exact synthetic key, never by a broad table scan.
 s.d1Inserted=true;save(s);
 const inserted=await d1(s,"INSERT INTO app768_qa_synthetic_follow (k,following) VALUES ('"+s.row+"',0)");
 if(inserted.meta.rows_written<1||inserted.meta.rows_written>2)
  HOLD('SYNTHETIC_INITIAL_D1_W_OVER2');
 console.log('APP790_EXISTING_QA583_OWNER_DO_V1_AND_D1_R2=PASS');
 console.log('APP790_ONLY_ONE_SYNTHETIC_QA_D1_ROW=PASS');
}
async function stage(){
 guarded();const s=state();if(!s||!s.d1Inserted)HOLD('STAGE_BEFORE_PREFLIGHT');
 await active();
 const file=resolve('app790-qa-worker.bundle.mjs');
 if(!existsSync(file))HOLD('NO_ISOLATED_BUNDLE');
 const code=readFileSync(file);
 if(code.length<3000||code.length>400000||
    !code.toString().includes('APP788_ISOLATED_SYNTHETIC_QA')||
    !code.toString().includes('OwnerFollowIsolated558'))
  HOLD('QA_ONLY_DO_BUNDLE_SHAPE');
 const old=ok(await api(BASE+'/workers/workers/'+OLD+'/versions/'+ORIGINAL,
  getToken('CLOUDFLARE_QA_API_TOKEN')),'PINNED_VERSION');
 const bindings=old.bindings.map(b=>({name:b.name,type:'inherit',version_id:ORIGINAL}));
 bindings.push({name:'QA790_D1',type:'d1',id:s.uuid},
  {name:'QA790_R2',type:'r2_bucket',bucket_name:BUCKET},
  ...Object.entries({QA790_ISOLATED:'1',QA790_ROW:s.row,QA790_ACCESS:s.access,
   QA790_CUTOVER:s.cutover,QA790_RUN:RUN})
   .map(([name,text])=>({name,type:'plain_text',text})));
 if(bindings.length!==11||new Set(bindings.map(v=>v.name)).size!==11)
  HOLD('CANDIDATE_BINDINGS_NOT_INHERITED');
 const body={main_module:'app790-qa-worker.mjs',
  compatibility_date:old.compatibility_date||'2026-11-01',
  ...(old.compatibility_flags?{compatibility_flags:old.compatibility_flags}:{}),
  bindings,modules:[{name:'app790-qa-worker.mjs',
   content_type:'application/javascript+module',
   content_base64:code.toString('base64')}],
  annotations:{'workers/message':'APP790 signed QA browser one-shot',
   'workers/tag':'app790-isolated-browser'}};
 await active();
 const raw=await api(BASE+'/workers/workers/'+OLD+'/versions?deploy=false',
  getToken('CLOUDFLARE_QA_DEPLOY_TOKEN'),'POST',body);
 if(raw.status!==200||!raw.ok||!UUID.test(raw.data?.id||''))
  HOLD('INACTIVE_QA_VERSION_UPLOAD_'+raw.status+'_CODE_'+raw.errors.join('_'));
 s.candidate=raw.data.id;save(s);
 const v=ok(await api(BASE+'/workers/workers/'+OLD+'/versions/'+s.candidate,
  getToken('CLOUDFLARE_QA_API_TOKEN')),'STAGED_VERSION_READBACK');
 if(v.id!==s.candidate||v.bindings?.length!==11||
    v.bindings.find(x=>x.name==='OWNER558_DO')?.type!=='durable_object_namespace'||
    v.bindings.find(x=>x.name==='QA790_R2')?.type!=='r2_bucket'||
    v.bindings.find(x=>x.name==='QA790_D1')?.type!=='d1')
  HOLD('STAGED_BINDINGS_FAILED');
 await active();
 console.log('APP790_EXISTING_QA_DO_NAMESPACE_INHERITED_ZERO_TRAFFIC=PASS');
}
async function verifyDeployed(){
 guarded();const s=state();if(!s?.candidate)HOLD('NO_CANDIDATE');
 const d=ok(await api(BASE+'/workers/scripts/'+OLD+'/deployments',getToken('CLOUDFLARE_QA_API_TOKEN')),'DEPLOYMENT');
 const v=d?.deployments?.[0]?.versions;
 if(v?.length!==1||v[0].version_id!==s.candidate||Number(v[0].percentage)!==100)HOLD('QA_CANDIDATE_NOT_EXACT100');
 s.deployed=true;save(s);console.log('APP790_EXACT_QA_CANDIDATE_100=PASS');
}
async function ask(s,path,method='GET',auth=true){
 const response=await fetch(ORIGIN+path,{method,headers:{'Cache-Control':'no-store',...(auth?{'X-QA790-Access':s.access}:{})},
  redirect:'error',signal:AbortSignal.timeout(20000)});
 return {code:response.status,value:await response.json().catch(()=>null)};
}
async function waitBrowser(){
 guarded();const s=state();if(!s?.deployed)HOLD('CANDIDATE_NOT_DEPLOYED');
 let ready=false;
 for(let i=0;i<8;i++){
  const x=await ask(s,'/qa790/operator/health');
  if(x.code===200&&x.value?.status==='QA790_ISOLATED_CANDIDATE_READY'){ready=true;break}
  await new Promise(r=>setTimeout(r,3000));
 }
 if(!ready)HOLD('QA_CANDIDATE_NOT_VISIBLE');
 const denied=await ask(s,'/qa790/operator/progress','GET',false);
 if(denied.code!==403)HOLD('OPERATOR_ROUTE_NOT_PROTECTED');
 const unsigned=await ask(s,'/qa730/verified/status','GET',false);
 if(unsigned.code!==403)HOLD('UNSIGNED_STATUS_NOT_PROTECTED');
 console.log('APP790_REAL_QA_BROWSER_WINDOW_READY=PASS; OPEN_EXISTING_QA749_PAGE; A_B_LOGIN_VERIFY_FOLLOW_CANCEL');
 let last='';
 for(let i=0;i<80;i++){
  const v=await ask(s,'/qa790/operator/progress');
  if(v.code===200&&v.value?.status==='QA790_PROGRESS'){
   const phase=v.value.phase;
   if(['AWAITING_LOGIN','BASELINE_READY','IN_FLIGHT','FOLLOW_CONFIRMED','COMPLETE'].includes(phase)&&phase!==last){
    console.log('APP790_BROWSER_PHASE='+phase);last=phase;
   }
   if(phase==='COMPLETE'){s.testPassed=true;save(s);console.log('APP790_REAL_SIGNED_OWNER_RTDB_FOLLOW_CANCEL_EXACT_COMPLETED=PASS');return}
  }
  await new Promise(r=>setTimeout(r,15000));
 }
 HOLD('BROWSER_WINDOW_EXPIRED_OR_INCOMPLETE');
}
async function cleanup(){
 guarded();const s=state();if(!s){console.log('APP790_NO_STATE_NO_MUTATIONS');return}
 if(s.candidate&&existsSync(join(TEMP,'app790-route-attempted'))){
  // If activation was uncertain, do not erase data on a different version.
  if(!s.deployed){
   try{await active()}catch{await verifyDeployed()}
  }
  const current=state();
  if(current.deployed){
   let clean=false;
   for(let i=0;i<3;i++){
    const v=await ask(current,'/qa790/operator/cleanup','POST');
    if(v.code===200&&v.value?.clean===true&&(!current.testPassed||v.value.completed===true)){clean=true;break}
    if(v.code===409&&v.value?.reason==='PARTIAL_RUN_PRESERVE_EXACT_EVIDENCE')HOLD('PARTIAL_QA_RUN_EVIDENCE_RETAINED');
    if(i<2)await new Promise(r=>setTimeout(r,1500));
   }
   if(!clean)HOLD('QA_DO_R2_CLEANUP_UNVERIFIED');
  }
 }
 if(s.d1Inserted){
  const d=await d1(s,"DELETE FROM app768_qa_synthetic_follow WHERE k='"+s.row+"'");
  if(![0,1].includes(d.meta.rows_written))HOLD('D1_EXACT_DELETE_EXCESS');
  const v=await d1(s,"SELECT COUNT(*) AS n FROM app768_qa_synthetic_follow WHERE k='"+s.row+"'");
  if(v.results?.[0]?.n!==0)HOLD('D1_ROW_REMAINS');
 }
 console.log('APP790_EXACT_RUN_CLEANUP=PASS');
}
async function verifyOriginal(){
 guarded();await active();
 const x=ok(await api(BASE+'/workers/workers/'+OLD+'/versions/'+ORIGINAL,getToken('CLOUDFLARE_QA_API_TOKEN')),'ORIGINAL_QA583');
 if(x.id!==ORIGINAL||x.bindings?.length!==4)HOLD('ORIGINAL_QA583_BINDINGS_CHANGED');
 console.log('APP790_ORIGINAL_QA583_EXCLUSIVE_100_BINDINGS_UNCHANGED=PASS');
}
const jobs={preflight,stage,verifyDeployed,waitBrowser,cleanup,verifyOriginal};
const run=jobs[process.argv[2]];
if(!run)HOLD('INVALID_COMMAND');
try{await run()}catch(e){console.error(String(e?.message||'APP790_HOLD').replace(/[^A-Z0-9_ :]/g,'').slice(0,240));process.exitCode=2}

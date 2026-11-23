// APP789 — one-shot physical QA using ONLY existing QA583 DO namespace,
// existing QA D1 synthetic table and existing QA R2. Never PRODUCTION.
// Candidate version is 0% traffic; always restore original QA583 100%.
// NO new DO namespace/migration, new D1/R2/secret, or user data.
import {randomBytes,createHash} from 'node:crypto';
import {continueQa789Settlement} from './app789-qa-settlement-recovery.mjs';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
const ACCOUNT='b60fcd62c679c64db19f0b0e0c2f3429';
const PRODUCTION='e1a30fc9ef497fda1d34f4ab3dc1da45';
const OLD='soridraw-owner-qa-583',ORIGINAL='4ed70845-6a4b-4a80-9c51-ed95d0becc38';
const DB='soridraw-qa-app768-d1',BUCKET='soridraw-qa-app768-r2';
const ORIGIN='https://soridraw-owner-qa-583.soridraw-qa.workers.dev';
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
const RUN=process.env.GITHUB_RUN_ID||'',TEMP=process.env.RUNNER_TEMP||'';
const STATE=join(TEMP||'/tmp','app789-physical-state.json');
const OP_A='qa789_operation_follow_0000000000001',OP_B='qa789_operation_follow_0000000000002';
const UID='qa789OwnerSynthetic',ACTOR='qa789ActorSynthetic';
const SHA=/^[0-9a-f]{40}$/,UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const HOLD=s=>{throw Error('APP789_ISOLATED_PHYSICAL_HOLD_'+s)};
const checkedToken=x=>typeof x==='string'&&x.length>=20;
const getToken=type=>process.env[type]||'';
function guarded(){
 if(ACCOUNT===PRODUCTION||process.env.GITHUB_REPOSITORY!=='andrawing1212/soridraw-music'||
    process.env.GITHUB_EVENT_NAME!=='issue_comment'||
    process.env.GITHUB_REF!=='refs/heads/main'||
    process.env.APP789_QA_APPROVAL!=='APP789_EXISTING_RESOURCES_ONE_SHOT'||
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
 if(s.run!==RUN||s.doName!=='qa789_'+RUN||
    !/^qa789_[a-f0-9]{16}$/.test(s.row||'')||
    !/^qa789_cutover_[a-f0-9]{32}$/.test(s.cutover||'')||
    !/^[a-f0-9]{32}$/.test(s.epoch||'')||
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
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function r2keys(s){
 const head=[s.cutover,UID,ACTOR,s.epoch];
 const ids=[OP_A,OP_B],names=['internal/qa788/owner-floor/'+sha([
   s.cutover,UID,s.epoch])];
 for(const id of ids){
  const op=sha([...head,id]);
  names.push('internal/qa767/owner-follow-admissions/'+op,
   'internal/qa783/owner-follow-settled/'+op,
   'internal/qa789/projection/'+op);
 }
 return names;
}
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
 const s={run:RUN,uuid:list[0].uuid,row:'qa789_'+randomBytes(8).toString('hex'),
  doName:'qa789_'+RUN,access:randomBytes(32).toString('hex'),
  epoch:randomBytes(16).toString('hex'),
  cutover:'qa789_cutover_'+randomBytes(16).toString('hex'),
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
 console.log('APP789_EXISTING_QA583_OWNER_DO_V1_AND_D1_R2=PASS');
 console.log('APP789_ONLY_ONE_SYNTHETIC_QA_D1_ROW=PASS');
}
async function stage(){
 guarded();const s=state();if(!s||!s.d1Inserted)HOLD('STAGE_BEFORE_PREFLIGHT');
 await active();
 const file=resolve('app789-qa-worker.bundle.mjs');
 if(!existsSync(file))HOLD('NO_ISOLATED_BUNDLE');
 const code=readFileSync(file);
 if(code.length<3000||code.length>400000||
    !code.toString().includes('APP788_ISOLATED_SYNTHETIC_QA')||
    !code.toString().includes('OwnerFollowIsolated558'))
  HOLD('QA_ONLY_DO_BUNDLE_SHAPE');
 const old=ok(await api(BASE+'/workers/workers/'+OLD+'/versions/'+ORIGINAL,
  getToken('CLOUDFLARE_QA_API_TOKEN')),'PINNED_VERSION');
 const bindings=old.bindings.map(b=>({name:b.name,type:'inherit',version_id:ORIGINAL}));
 bindings.push({name:'QA789_D1',type:'d1',id:s.uuid},
  {name:'QA789_R2',type:'r2_bucket',bucket_name:BUCKET},
  ...Object.entries({QA789_ISOLATED:'1',QA789_ROW:s.row,QA789_ACCESS:s.access,
   QA789_EPOCH:s.epoch,QA789_CUTOVER:s.cutover,QA789_DO_NAME:s.doName})
   .map(([name,text])=>({name,type:'plain_text',text})));
 if(bindings.length!==12||new Set(bindings.map(v=>v.name)).size!==12)
  HOLD('CANDIDATE_BINDINGS_NOT_INHERITED');
 const body={main_module:'app789-qa-worker.mjs',
  compatibility_date:old.compatibility_date||'2026-11-01',
  ...(old.compatibility_flags?{compatibility_flags:old.compatibility_flags}:{}),
  bindings,modules:[{name:'app789-qa-worker.mjs',
   content_type:'application/javascript+module',
   content_base64:code.toString('base64')}],
  annotations:{'workers/message':'APP789 one-shot existing QA DO R2 D1 only',
   'workers/tag':'app789-isolated-0percent'}};
 await active();
 const raw=await api(BASE+'/workers/workers/'+OLD+'/versions?deploy=false',
  getToken('CLOUDFLARE_QA_DEPLOY_TOKEN'),'POST',body);
 if(raw.status!==200||!raw.ok||!UUID.test(raw.data?.id||''))
  HOLD('INACTIVE_QA_VERSION_UPLOAD_'+raw.status+'_CODE_'+raw.errors.join('_'));
 s.candidate=raw.data.id;save(s);
 const v=ok(await api(BASE+'/workers/workers/'+OLD+'/versions/'+s.candidate,
  getToken('CLOUDFLARE_QA_API_TOKEN')),'STAGED_VERSION_READBACK');
 if(v.id!==s.candidate||v.bindings?.length!==12||
    v.bindings.find(x=>x.name==='OWNER558_DO')?.type!=='durable_object_namespace'||
    v.bindings.find(x=>x.name==='QA789_R2')?.type!=='r2_bucket'||
    v.bindings.find(x=>x.name==='QA789_D1')?.type!=='d1')
  HOLD('STAGED_BINDINGS_FAILED');
 await active();
 console.log('APP789_EXISTING_QA_DO_NAMESPACE_INHERITED_ZERO_TRAFFIC=PASS');
}
async function verifyDeployed(){
 const s=state();if(!s?.candidate)HOLD('NO_CANDIDATE');
 const x=ok(await api(BASE+'/workers/scripts/'+OLD+'/deployments',
  getToken('CLOUDFLARE_QA_API_TOKEN')),'DEPLOYMENT');
 const m=new Map(x?.deployments?.[0]?.versions?.map(v=>[v.version_id,Number(v.percentage)]));
 if(m.size!==2||m.get(ORIGINAL)!==100||m.get(s.candidate)!==0)
  HOLD('NOT_EXACT_QA_ORIGINAL100_TEST0');
 s.deployed=true;save(s);
 console.log('APP789_ORIGINAL_QA583_100_AND_TEST_VERSION_ZERO=PASS');
}
async function ask(s,method,path,body,auth=true){
 const response=await fetch(ORIGIN+path,{method,
  headers:{'Cloudflare-Workers-Version-Overrides':
    OLD+'="'+s.candidate+'"','Cache-Control':'no-store',
   ...(auth?{'X-QA789-Access':s.access}:{}),
   ...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),redirect:'error',
  signal:AbortSignal.timeout(20000)});
 return {code:response.status,value:await response.json().catch(()=>null)};
}
const assertStatus=(v,c,t)=>{if(v.code!==c||v.value?.status!==t)
  HOLD('HTTP_EXPECTED_'+c+'_'+t+'_RECEIVED_'+v.code+'_'+
   String(v.value?.status).slice(0,40)+'_REASON_'+
   String(v.value?.reason||'NONE').replace(/[^A-Z0-9_]/g,'').slice(0,80));};
async function test(){
 guarded();const s=state();if(!s?.candidate||!s.deployed)HOLD('TEST_NOT_STAGED');
 const get=(method,path,body,auth=true)=>ask(s,method,path,body,auth);
 // Version overrides for a newly deployed 0% version can take time
 // to propagate. Reuse APP736's bounded 3-second read-only probe. Never
 // write QA D1/R2/DO before the distinctive candidate 403 is observed.
 let unauthorized;
 for(let i=0;i<6;i++){
  unauthorized=await get('GET','/qa789/health',undefined,false);
  if(unauthorized.code===403&&unauthorized.value?.status==='DENIED')break;
  if(i<5)await new Promise(done=>setTimeout(done,3000));
 }
 assertStatus(unauthorized,403,'DENIED');
 let ready;
 for(let i=0;i<6;i++){
  ready=await get('GET','/qa789/health');
  if(ready.code===200&&ready.value?.status==='QA789_REAL_R2_D1_READY')break;
  if(i<5)await new Promise(done=>setTimeout(done,1500));
 }
 assertStatus(ready,200,'QA789_REAL_R2_D1_READY');
 if(ready.value.following!==false||ready.value.floorPresent!==false)
  HOLD('INITIAL_SYNTHETIC_STATE_UNCLEAN');
 // Mark DO mutation attempt BEFORE sending the first write; an ACK-lost
 // bootstrap still requires exact synthetic-DO cleanup.
 s.doTouched=true;save(s);
 assertStatus(await get('POST','/qa789/do/bootstrap'),200,
  'QA788_SYNTHETIC_GENESIS_FLOOR_CREATED');
 const race=await Promise.all([OP_A,OP_B].map(canonicalOperationId=>
  get('POST','/qa789/do/reserve',{canonicalOperationId,
   expectedRevision:7,priorR2Revision:13,desired:true})));
 const winners=race.map((x,i)=>({x,id:[OP_A,OP_B][i]})).filter(x=>
  x.x.code===200&&x.x.value?.status==='QA788_ADMITTED_AND_OWNER_DO_RESERVED');
 if(winners.length!==1||race.filter(v=>v.code===409).length!==1)
  HOLD('TWO_DIFFERENT_OPS_SAME_REVISION_NOT_SINGLE_FLIGHT');
 const winner=winners[0].id;
 const expectedReceiptId=winners[0].x.value?.receipt?.operationId;
 if(!/^qa789_do_receipt_[a-f0-9]{32}$/.test(expectedReceiptId||'')||
    winners[0].x.value?.receipt?.canonicalOperationId!==winner)
  HOLD('EXACT_RESERVED_RECEIPT_ID_UNVERIFIED');
 const commit=await get('POST','/qa789/commit',{canonicalOperationId:winner,expectedReceiptId});
 // Log only fixed diagnostic codes and boolean/number evidence, never raw
 // body, receipt, authorization header, exception text or any identifiers.
 const diagnostic=commit.value?.diagnostic;
 const safeDiagnostic=typeof diagnostic==='string'&&/^[A-Z_]{1,120}$/.test(diagnostic)?
  diagnostic:'NONE';
 console.log('APP789_COMMIT_DIAGNOSTIC '+JSON.stringify({
  http:commit.code,stage:commit.value?.stage==='CANONICAL_WRITTEN'?'CANONICAL_WRITTEN':'BEFORE_OR_UNKNOWN',
  d1W1:commit.value?.d1RowsWritten===1,r2Projection:commit.value?.r2ProjectionSettled===true,
  diagnostic:safeDiagnostic}));
 assertStatus(commit,200,'QA789_CANONICAL_WRITTEN_PENDING_SETTLEMENT');
 if(commit.value.d1RowsWritten!==1||commit.value.r2ProjectionSettled!==true||
    commit.value.canonicalRetryAuthorized!==false)
  HOLD('REAL_QA_D1_W1_AND_R2_PROJECTION_MISSING');
 const {attempts,result:finalized}=await continueQa789Settlement({
  get,commit,canonicalOperationId:winner,expectedReceiptId});
 const finalDiagnostic=finalized.value?.diagnostic;
 console.log('APP789_SETTLEMENT_DIAGNOSTIC '+JSON.stringify({
  http:finalized.code,attempts,d1W0:finalized.value?.d1RowsWritten===0,
  diagnostic:typeof finalDiagnostic==='string'&&/^[A-Z_]{1,120}$/.test(finalDiagnostic)?
   finalDiagnostic:'NONE'}));
 if(finalized.code!==200||
    !['QA788_IMMUTABLE_SETTLED_AND_FLOOR_ADVANCED','QA788_FLOOR_ALREADY_SETTLED_NO_WRITE']
      .includes(finalized.value?.status))
  assertStatus(finalized,200,'QA788_IMMUTABLE_SETTLED_AND_FLOOR_ADVANCED');
 if(finalized.value?.d1RowsWritten!==0||finalized.value?.canonicalRetryAuthorized!==false)
  HOLD('RECOVERY_CANONICAL_W0_UNVERIFIED');
 const history=await get('GET','/qa789/do/history');
 assertStatus(history,200,'QA788_READ_ONLY_HISTORY');
 if(history.value.floorD1Revision!==8||history.value.pending!==false)
  HOLD('REAL_QA_EXTERNAL_OWNER_FLOOR_NOT_ADVANCED');
 const previous=await get('POST','/qa789/do/reserve',{
  canonicalOperationId:winner,expectedRevision:7,priorR2Revision:13,
  desired:true});
 if(previous.code!==409||previous.value.status!=='HOLD')
  HOLD('DUPLICATE_NOT_BLOCKED');
 assertStatus(await get('POST','/qa789/do/wipe'),200,
  'QA789_EXACT_SYNTHETIC_DO_WIPED');
 const pitr=await get('POST','/qa789/do/reserve',{
  canonicalOperationId:winner,expectedRevision:7,priorR2Revision:13,
  desired:true});
 if(pitr.code!==409||pitr.value.status!=='HOLD')
  HOLD('REAL_DO_EMPTY_PITR_REPLAY_NOT_BLOCKED');
 const d=await d1(s,"SELECT following FROM app768_qa_synthetic_follow WHERE k='"+s.row+"'");
 if(Number(d.results?.[0]?.following)!==1)
  HOLD('REAL_QA_D1_FINAL_CANONICAL_STATE_NOT_1');
 s.testPassed=true;save(s);
 console.log('APP789_REAL_QA_OWNER_DO_RESERVATION_ON_EXISTING_NAMESPACE=PASS');
 console.log('APP789_REAL_QA_R2_PENDING_CAS_TWO_ID_SINGLE_FLIGHT=PASS');
 console.log('APP789_REAL_QA_D1_W1_R2_PROJECTION_AND_IMMUTABLE_SETTLED=PASS');
 console.log('APP789_REAL_QA_DO_WIPE_AFTER_HISTORY_OLD_ID_REPLAY_HOLD=PASS');
 console.log('APP789_REAL_AUTH_GLOBAL_LEGACY_WRITERS_PROD_RTDB=NOT_TESTED_HOLD');
}
async function cleanup(){
 guarded();const s=state();
 if(!s){console.log('APP789_NO_STATE_NO_MUTATIONS');return}
 const errors=[];
 // The DO owns only QA789_<run> state; do not touch default QA583 ID.
 if(s.candidate&&s.deployed&&s.doTouched){
  let wiped=false;
  for(let i=0;i<5;i++){
   try{const x=await ask(s,'POST','/qa789/do/wipe');
    if(x.code===200&&x.value?.status==='QA789_EXACT_SYNTHETIC_DO_WIPED'){
     wiped=true;break}
   }catch{}
   if(i<4)await new Promise(done=>setTimeout(done,1500));
  }
  if(!wiped)errors.push('SYNTHETIC_OWNER_DO_NOT_WIPED');
 }
 for(const k of r2keys(s)){
  try{
   const u=await api(BASE+'/r2/buckets/'+BUCKET+'/objects/'+encodeURIComponent(k),
     getToken('CLOUDFLARE_QA_DATA_TOKEN'),'DELETE');
   if(![200,204,404].includes(u.status))errors.push('R2_KEY_'+u.status);
  }catch{errors.push('R2_KEY_DELETE_FAILED')}
 }
 if(s.d1Inserted){
  try{
   const x=await d1(s,"DELETE FROM app768_qa_synthetic_follow WHERE k='"+s.row+"'");
   if(![0,1].includes(x.meta.rows_written))errors.push('D1_EXACT_DELETE_EXCESS');
   const y=await d1(s,"SELECT COUNT(*) AS n FROM app768_qa_synthetic_follow WHERE k='"+s.row+"'");
   if(y.results?.[0]?.n!==0)errors.push('D1_ROW_REMAINS');
  }catch{errors.push('D1_EXACT_CLEANUP_UNKNOWN')}
 }
 if(errors.length)HOLD('INCOMPLETE_CLEANUP_'+errors.join('_'));
 console.log('APP789_EXACT_DO_WIPE_D1_ROW_R2_KEYS_CLEANED=PASS');
}
async function verifyOriginal(){
 guarded();await active();
 const s=state();if(!s)HOLD('NO_RECORD_OF_RUN');
 const x=ok(await api(BASE+'/workers/workers/'+OLD+'/versions/'+ORIGINAL,
  getToken('CLOUDFLARE_QA_API_TOKEN')),'QA583_ORIGINAL_CODE');
 if(x.bindings?.length!==4)HOLD('ORIGINAL_QA583_BINDINGS_CHANGED');
 console.log('APP789_ORIGINAL_QA583_EXCLUSIVE_100_BINDINGS_UNCHANGED=PASS');
}
const jobs={preflight,stage,verifyDeployed,test,cleanup,verifyOriginal};
const run=jobs[process.argv[2]];
if(!run)HOLD('UNKNOWN_PHASE');
run().catch(e=>{console.error(String(e?.message||e));process.exitCode=2});

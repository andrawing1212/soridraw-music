// APP635: one-shot PREVIEW-only, exact immutable Worker version OFF recovery.
// No code upload, no migrations, no binding edits, no D1/R2/RTDB/user row operations.
import { createHash } from 'node:crypto';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const EX='soridraw-explore-preview',OW='soridraw-owner-follow-preview-candidate';
const TEST='soridraw-explore-test',PROD='soridraw-explore-api';
const BASE='350ce33d-ec83-49d0-a4ae-c25d2d90f59e';
const ACTIVE='5d0f74b1-84bf-4f96-a9e4-51bea25736fa';
const SAFE_OFF='d5d14cf8-c65a-4aa2-b58f-ed08bcdc92fd';
const OWNER_ACTIVE='e679a602-44fb-4b4d-9e4d-7878c00b68c3';
const EXPECTED_PARENT='afeb59d14427cfb559df9bd9ff890d2169cfa8aa';
const extras=['OWNER_FOLLOW_RESERVATION_SERVICE_600',
 'SORIDRAW_OWNER_DO_BRIDGE_SECRET_600','SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544',
 'SORIDRAW_OWNER_FOLLOW_HMAC_539'];
const onVars=['SORIDRAW_OWNER_FOLLOW_CANARY_UID_574','SORIDRAW_OWNER_FOLLOW_W2_PUSH_555',
 'SORIDRAW_OWNER_DO_STANDALONE_600','SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607',
 'SORIDRAW_OWNER_FOLLOW_BIND_544','SORIDRAW_OWNER_FOLLOW_AUTH_PROOF_547',
 'SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607','SORIDRAW_OWNER_FOLLOW_ENDPOINT_539'];
const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
const need=(yes,what)=>{if(!yes)throw Error('APP635_HOLD_'+what)};
const sha=x=>createHash('sha256').update(x).digest('hex');
async function api(method,path,body){
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path,{
  method,headers:{Authorization:'Bearer '+token,Accept:'application/json',
   ...(method==='POST'?{'Content-Type':'application/json'}:{})},
  ...(method==='POST'?{body:JSON.stringify(body)}:{}),
  signal:AbortSignal.timeout(method==='POST'?55000:25000)});
 let data;
 try{data=await response.json()}catch{throw Error('APP635_HOLD_UNCERTAIN_'+method+'_NO_AUTO_RETRY')}
 if(!response.ok||data?.success!==true){
  console.log('APP635_API_HTTP='+response.status);
  throw Error('APP635_HOLD_API_'+method+'_NO_AUTO_RETRY');
 }
 return data.result;
}
async function live(name){
 const r=await api('GET','workers/scripts/'+name+'/deployments?per_page=1');
 const versions=r?.deployments?.[0]?.versions;
 need(Array.isArray(versions)&&versions.length===1&&
  Number(versions[0].percentage)===100,'TRAFFIC_SPLIT_'+name);
 return versions[0].version_id;
}
async function version(name,id,expected){
 const v=await api('GET','workers/scripts/'+name+'/versions/'+id);
 need(v?.id===id,'WRONG_VERSION_'+id);
 need(v?.resources?.script_runtime?.compatibility_date==='2026-08-28',
  'COMPAT_DATE_'+id);
 const bs=v?.resources?.bindings;
 need(Array.isArray(bs)&&bs.length===expected,'BINDING_COUNT_'+id);
 const b=new Map(bs.map(x=>[x.name,x]));
 need(b.size===expected,'DUPLICATE_BINDING_'+id);
 need(b.get('SORIDRAW_ENVIRONMENT')?.text==='preview','ENVIRONMENT_'+id);
 need(b.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.class_name==='ExploreLikeBatchScheduler103',
  'ORIGINAL_LIKE_DO_V1_'+id);
 need(!b.has('OWNER_FOLLOW_RECOVERY_557'),'FORBIDDEN_NEW_DO_MIGRATION');
 return b;
}
const keys=['type','class_name','service','entrypoint','id','database_id','bucket_name','namespace_id','text'];
function preserve(expected,actual,tag){
 for(const [name,b] of expected){
  const current=actual.get(name);
  need(Boolean(current),'MISSING_'+tag+'_'+name);
  for(const key of keys)if(b[key]!==undefined)need(current[key]===b[key],
   'CHANGED_'+tag+'_'+name+'_'+key);
 }
}
async function moduleHashes(name,id){
 const r=await api('GET','workers/workers/'+name+'/versions/'+id+'?include=modules');
 need(Array.isArray(r?.modules)&&r.modules.length===12,'EXACT_MODULE_SET_'+id);
 const map=new Map();
 for(const m of r.modules){
  need(typeof m.name==='string'&&!map.has(m.name)&&
   typeof m.content_base64==='string'&&m.content_base64.length>20,'MODULE_DATA_'+id);
  map.set(m.name,sha(Buffer.from(m.content_base64,'base64')));
 }
 need(map.size===12,'MODULE_UNIQUE_'+id);
 return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
}
async function verify(){
 need(process.env.GITHUB_ACTIONS==='true'&&
  process.env.GITHUB_REF==='refs/heads/preview'&&
  process.env.APP635_APPROVED_PARENT===EXPECTED_PARENT,'PINNED_TRIGGER_PARENT');
 need(process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT&&token.length>20,'CLOUDFLARE_ACCOUNT_OR_TOKEN');
 const [before,owner,test,prod]=await Promise.all([
  live(EX),live(OW),live(TEST),live(PROD)]);
 need(owner===OWNER_ACTIVE,'OWNER_VERSION_DRIFT');
 need(before===ACTIVE||before===SAFE_OFF,'UNEXPECTED_EXPLORE_VERSION');
 const [base,off,on]=await Promise.all([
  version(EX,BASE,23),version(EX,SAFE_OFF,27),version(EX,ACTIVE,35)
 ]);
 preserve(base,off,'OFF_ORIGINAL');preserve(base,on,'ON_ORIGINAL');
 preserve(off,on,'ON_RECOVERY');
 need([...off.keys()].filter(x=>!base.has(x)).sort().join(',')===extras.sort().join(','),
  'SAFE_OFF_EXTRA_BINDINGS');
 need([...on.keys()].filter(x=>!off.has(x)).sort().join(',')===onVars.sort().join(','),
  'ACTIVE_EXTRA_FLAGS');
 for(const name of extras.slice(1))
  need(off.get(name)?.type==='secret_text'&&on.get(name)?.type==='secret_text',
   'SAME_SECRET_BINDING_TYPE_'+name);
 need(off.get('OWNER_FOLLOW_RESERVATION_SERVICE_600')?.service===OW,
  'SAME_PRIVATE_SERVICE_BINDING');
 for(const name of onVars)need(!off.has(name),'OFF_STILL_HAS_FLAG_'+name);
 const [offHashes,onHashes]=await Promise.all([
  moduleHashes(EX,SAFE_OFF),moduleHashes(EX,ACTIVE)]);
 need(JSON.stringify(offHashes)===JSON.stringify(onHashes),'WORKER_SOURCE_BYTES_NOT_EQUAL');
 console.log('APP635_BEFORE_VERSION='+before);
 console.log('APP635_SOURCE_IDENTICAL_OFF_ON_AND_ORIGINAL_23_BINDINGS=PASS');
 console.log('APP635_SAFE_OFF_RETAINS_3_SECRETS_SERVICE_AND_LIKE_DO_V1=PASS');
 if(before===ACTIVE){
  const second=await live(EX);
  need(second===ACTIVE,'ACTIVE_CHANGED_DURING_PREFLIGHT');
  const payload={strategy:'percentage',
   versions:[{version_id:SAFE_OFF,percentage:100}],
   annotations:{'workers/message':'APP635 approved PREVIEW only exact OFF restore, protect original Follow+Like'}};
  // Only this exact immutable PREVIEW deployment is mutated. Do not retry if uncertain.
  await api('POST','workers/scripts/'+EX+'/deployments',payload);
  console.log('APP635_DEPLOY_POST_RECEIVED=PASS');
 }else console.log('APP635_ALREADY_SAFE_OFF=PASS');
 const [after,ownerAfter,testAfter,prodAfter]=await Promise.all([
  live(EX),live(OW),live(TEST),live(PROD)]);
 need(after===SAFE_OFF,'OFF_VERSION_NOT_ACTIVE_100');
 need(ownerAfter===owner&&testAfter===test&&prodAfter===prod,
  'OTHER_WORKER_CHANGED');
 console.log('APP635_PREVIEW_CANARY_FOLLOW_PRECOMMIT_OFF=PASS');
 console.log('APP635_OLD_FOLLOW_CANONICAL_AND_LIKE_BINDINGS_PRESERVED=PASS');
 console.log('APP635_TEST_PRODUCTION_AND_OWNER_WORKER_UNCHANGED=PASS');
 console.log('APP635_SHARED_DATA_RULES_FUNCTIONS_AND_HOSTING_WRITES=ZERO');
}
if(process.argv[2]==='--self-test'){
 need(BASE!==ACTIVE&&SAFE_OFF!==ACTIVE&&extras.length===4&&onVars.length===8,
  'PINNED_SOURCE_CONFIG');
 console.log('APP635_SOURCE_PINS_AND_SCOPE=PASS');
}else if(process.argv[2]==='--recover-once'){
 try{await verify()}catch(e){console.error(String(e.message||e).slice(0,210));process.exitCode=2}
}else{console.error('APP635_HOLD_INVALID_MODE');process.exitCode=2}

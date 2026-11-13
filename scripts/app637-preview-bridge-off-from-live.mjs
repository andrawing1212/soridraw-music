// APP637 emergency PREVIEW follow restore: clone the CURRENT LIVE version,
// inherit all secrets and bindings, change only owner bridge READY 1 -> 0.
// This avoids deploying an older version with older secret versions.
// Never use force=true, never mutate shared D1/R2/RTDB/Functions/user records.
import {createHash} from 'node:crypto';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const EX='soridraw-explore-preview',OW='soridraw-owner-follow-preview-candidate';
const TEST='soridraw-explore-test',PROD='soridraw-explore-api';
const OLD='350ce33d-ec83-49d0-a4ae-c25d2d90f59e';
const LIVE='5d0f74b1-84bf-4f96-a9e4-51bea25736fa';
const OWNER='e679a602-44fb-4b4d-9e4d-7878c00b68c3';
const FLAG='SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607';
const PARENT='2c1211d4a74f81b743f7dac110b1ed9731377eb9';
const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
const sha=b=>createHash('sha256').update(b).digest('hex');
const need=(good,code)=>{if(!good)throw Error('APP637_HOLD_'+code)};
async function api(method,path,body){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path,{
  method,headers:{Authorization:'Bearer '+token,Accept:'application/json',
   ...(method==='POST'?{'Content-Type':'application/json'}:{})},
  ...(method==='POST'?{body:JSON.stringify(body)}:{}),
  signal:AbortSignal.timeout(method==='POST'?60000:25000)});
 let j;
 try{j=await r.json()}catch{throw Error('APP637_HOLD_API_UNCERTAIN_'+method+'_NO_RETRY')}
 if(!r.ok||j?.success!==true){
  const codes=Array.isArray(j?.errors)?j.errors.map(e=>String(e.code||'')).slice(0,5):[];
  console.log('APP637_API_'+method+'_HTTP='+r.status+';CODES='+JSON.stringify(codes));
  throw Error('APP637_HOLD_API_'+method+'_NO_RETRY');
 }
 return j.result;
}
async function active(name){
 const r=await api('GET','workers/scripts/'+name+'/deployments?per_page=1');
 const v=r?.deployments?.[0]?.versions;
 need(v?.length===1&&Number(v[0].percentage)===100,'NOT_EXACT_100_'+name);
 return v[0].version_id;
}
async function metadata(name,id,expected){
 const r=await api('GET','workers/scripts/'+name+'/versions/'+id);
 need(r?.id===id,'VERSION_ID_'+id);
 need(r?.resources?.script_runtime?.compatibility_date==='2026-08-28','RUNTIME_DATE_'+id);
 const bs=r?.resources?.bindings;
 need(Array.isArray(bs)&&bs.length===expected,'BINDING_COUNT_'+id);
 const map=new Map(bs.map(x=>[x.name,x]));
 need(map.size===expected,'DUPLICATE_BINDING_'+id);
 need(map.get('SORIDRAW_ENVIRONMENT')?.text==='preview','PREVIEW_SCOPE');
 need(map.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.class_name==='ExploreLikeBatchScheduler103',
  'LIKE_DO_V1');
 need(!map.has('OWNER_FOLLOW_RECOVERY_557'),'OWNER_DO_V2_FORBIDDEN');
 return {meta:r,map,bs};
}
async function modules(id){
 const r=await api('GET','workers/workers/'+EX+'/versions/'+id+'?include=modules');
 const ms=r?.modules;
 need(Array.isArray(ms)&&ms.length===12,'MODULES_12');
 const map=new Map();
 for(const m of ms){
  need(typeof m.name==='string'&&m.name.length>0&&
   typeof m.content_base64==='string'&&m.content_base64.length>50&&!map.has(m.name),
   'MODULE_BYTES');
  map.set(m.name,sha(Buffer.from(m.content_base64,'base64')));
 }
 need(map.has('owner-follow-entry-607.mjs'),'ENTRYPOINT');
 return {ms,map};
}
const keys=['type','class_name','service','entrypoint','id','database_id','bucket_name','namespace_id','text'];
function compareBindings(before,after){
 need(before.size===after.size,'POST_BINDING_SET_SIZE');
 for(const [name,b] of before){
  const a=after.get(name);
  need(Boolean(a),'MISSING_BINDING_'+name);
  for(const key of keys){
   if(name===FLAG&&key==='text'){need(a.text==='0','FLAG_NOT_OFF');continue}
   if(b[key]!==undefined)need(a[key]===b[key],'BINDING_DRIFT_'+name+'_'+key);
  }
 }
}
function compareModules(a,b){
 need(a.size===b.size,'MODULE_COUNT_CHANGE');
 for(const [k,v] of a)need(b.get(k)===v,'CODE_BYTES_CHANGED_'+k);
}
async function main(){
 need(process.env.GITHUB_REF==='refs/heads/preview'&&
  process.env.APP637_PARENT===PARENT&&
  process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT&&token.length>20,'APPROVED_CONTEXT');
 const [current,owner,test,prod]=await Promise.all([
  active(EX),active(OW),active(TEST),active(PROD)]);
 need(current===LIVE,'ACTIVE_DRIFT_STOP_NO_MUTATION');
 need(owner===OWNER,'OWNER_WORKER_DRIFT');
 const [base,on,originalModules]=await Promise.all([
  metadata(EX,OLD,23),metadata(EX,LIVE,35),modules(LIVE)]);
 need(on.map.get(FLAG)?.text==='1','BRIDGE_NOT_ON');
 for(const [name,b] of base.map){
  const a=on.map.get(name);need(Boolean(a),'ORIGINAL_BINDING_GONE_'+name);
  for(const k of keys)if(b[k]!==undefined)need(a[k]===b[k],
   'ORIGINAL_BINDING_CHANGED_'+name+'_'+k);
 }
 for(const key of ['SORIDRAW_OWNER_FOLLOW_HMAC_539','SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544',
  'SORIDRAW_OWNER_DO_BRIDGE_SECRET_600'])
   need(on.map.get(key)?.type==='secret_text','SECRET_MISSING_'+key);
 need(on.map.get('OWNER_FOLLOW_RESERVATION_SERVICE_600')?.service===OW,
  'OWNER_SERVICE_BOUND');
 const bs=on.bs.filter(b=>b.name!==FLAG).map(b=>({
  name:b.name,type:'inherit',version_id:LIVE
 }));
 bs.push({name:FLAG,type:'plain_text',text:'0'});
 need(bs.length===35&&new Set(bs.map(b=>b.name)).size===35,'INHERIT_SET');
 const ms=originalModules.ms.map(m=>({
  name:m.name,content_type:m.content_type||'application/javascript+module',
  content_base64:m.content_base64
 }));
 const rt=on.meta.resources.script_runtime;
 const payload={main_module:'owner-follow-entry-607.mjs',
  compatibility_date:'2026-08-28',
  compatibility_flags:rt.compatibility_flags||[],
  annotations:{'workers/tag':'app637-owner-bridge-safe-off',
   'workers/message':'APP637 current-active-code and secrets inherited; one PREVIEW flag 0'},
  bindings:bs,modules:ms};
 need(!('migrations' in payload),'NO_MIGRATIONS');
 console.log('APP637_35_BINDINGS_ORIGINAL_LIKE_DO_CURRENT_SECRETS_AND_MODULE_SOURCE=PASS');
 need(await active(EX)===LIVE,'PRE_STAGE_ACTIVE_DRIFT');
 // Stage a NEW version; cannot override/remove existing secrets with stale versions.
 const staged=await api('POST','workers/workers/'+EX+'/versions?deploy=false',payload);
 const id=String(staged?.id||'');
 need(/^[0-9a-f-]{36}$/i.test(id)&&id!==LIVE,'STAGED_ID');
 console.log('APP637_NEW_VERSION_STAGED_INACTIVE=PASS');
 const [after,afterModules]=await Promise.all([metadata(EX,id,35),modules(id)]);
 compareBindings(on.map,after.map);compareModules(originalModules.map,afterModules.map);
 need(after.map.get(FLAG)?.text==='0','FLAG_VERIFY');
 need(await active(EX)===LIVE,'PRE_ACTIVATION_DRIFT');
 need(await active(OW)===owner&&await active(TEST)===test&&await active(PROD)===prod,
  'OTHER_WORKER_DRIFT');
 console.log('APP637_STAGED_BYTE_IDENTICAL_EXCEPT_BRIDGE_FLAG_ZERO=PASS');
 // Only PREVIEW traffic is changed. No forced rollback or migration.
 await api('POST','workers/scripts/'+EX+'/deployments',{
  strategy:'percentage',versions:[{version_id:id,percentage:100}],
  annotations:{'workers/message':'APP637 PREVIEW: disable owner bridge precommit, preserve old follow writer'}
 });
 console.log('APP637_DEPLOY_ACCEPTED=PASS');
 need(await active(EX)===id,'NEW_OFF_VERSION_NOT_ACTIVE');
 need(await active(OW)===owner&&await active(TEST)===test&&await active(PROD)===prod,
  'OTHER_WORKERS_CHANGED');
 console.log('APP637_PREVIEW_FOLLOW_BRIDGE_DISABLED_AND_CANONICAL_RESTORED=PASS');
 console.log('APP637_OWNER_WORKER_TEST_PROD_UNCHANGED=PASS');
 console.log('APP637_DATA_RULES_FUNCTIONS_HOSTING_WRITES=ZERO');
 console.log('APP637_ACTIVE_OFF_VERSION='+id);
}
if(process.argv[2]==='--self-test'){
 need(FLAG==='SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607'&&OLD!==LIVE&&OWNER!==LIVE,
  'PIN_CONFIGURATION');
 console.log('APP637_PINNED_SAFE_OFF_ONLY=PASS');
}else if(process.argv[2]==='--apply-once'){
 try{await main()}catch(e){console.error(String(e.message||e).slice(0,190));process.exitCode=2}
}else{console.error('APP637_HOLD_UNSUPPORTED_MODE');process.exitCode=2}

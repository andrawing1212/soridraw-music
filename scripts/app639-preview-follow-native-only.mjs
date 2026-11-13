// APP639: PREVIEW-only minimal follow abuse policy.
// KEEP native Cloudflare 60/min actor limiter and canonical ordered idempotency.
// REMOVE only the redundant follow R2/day/pair cooldown consumption in one
// existing Worker function. Like policy, user data and all bindings unchanged.
// Upload a NEW version inherited from exact current active Bridge-OFF source;
// never roll back secrets or apply migrations.
import {createHash} from 'node:crypto';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const EX='soridraw-explore-preview',OW='soridraw-owner-follow-preview-candidate';
const TEST='soridraw-explore-test',PROD='soridraw-explore-api';
const EXPECTED_PARENT='caaedcaa73671bfde42ea13af0893e1dc4c8fcfe';
const OFF='6437d86a-09c5-4ff0-8be5-ecfabd4a1f77';
const OWNER='e679a602-44fb-4b4d-9e4d-7878c00b68c3';
const NEEDLE='await consumeSocialAbuse380(env, uid, "follow", [{ target: targetUid, desired: following, operationId }]);';
const PATCH="/* APP639: follow retains native actor limiter; no redundant R2 cooldown receipt. */";
const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
const sha=b=>createHash('sha256').update(b).digest('hex');
const need=(b,x)=>{if(!b)throw Error('APP639_HOLD_'+x)};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(method,path,body){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path,{
  method,headers:{Authorization:'Bearer '+token,Accept:'application/json',
   ...(method==='POST'?{'Content-Type':'application/json'}:{})},
  ...(method==='POST'?{body:JSON.stringify(body)}:{}),
  signal:AbortSignal.timeout(method==='POST'?60000:25000)});
 let j;try{j=await r.json()}catch{throw Error('APP639_HOLD_UNCERTAIN_'+method)}
 if(!r.ok||j?.success!==true){
  const codes=(j?.errors||[]).map(e=>String(e.code||'')).slice(0,4);
  throw Error('APP639_HOLD_API_'+method+'_'+r.status+'_CODES_'+codes.join('_'));
 }
 return j.result;
}
async function active(name){
 const d=await api('GET','workers/scripts/'+name+'/deployments?per_page=1');
 const v=d?.deployments?.[0]?.versions;
 need(v?.length===1&&Number(v[0].percentage)===100,'TRAFFIC_NOT_100_'+name);
 return v[0].version_id;
}
async function info(id){
 const d=await api('GET','workers/scripts/'+EX+'/versions/'+id);
 const b=d?.resources?.bindings;
 need(d?.id===id&&d.resources?.script_runtime?.compatibility_date==='2026-08-28',
  'VERSION_META');
 need(Array.isArray(b)&&b.length===35,'35_BINDINGS');
 const m=new Map(b.map(x=>[x.name,x]));
 need(m.size===35&&m.get('SORIDRAW_ENVIRONMENT')?.text==='preview'&&
  m.get('SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607')?.text==='0'&&
  m.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.class_name==='ExploreLikeBatchScheduler103'&&
  !m.has('OWNER_FOLLOW_RECOVERY_557'),'OFF_OR_LIKE_GUARD');
 return {bindings:b,map:m,metadata:d};
}
async function modules(id){
 const d=await api('GET','workers/workers/'+EX+'/versions/'+id+'?include=modules');
 need(d?.modules?.length===12,'MODULE_SET');
 const ms=d.modules, map=new Map();
 for(const m of ms){
  need(typeof m.name==='string'&&typeof m.content_base64==='string'&&
   m.content_base64.length>50&&!map.has(m.name),'MODULE_ENTRY');
  map.set(m.name,sha(Buffer.from(m.content_base64,'base64')));
 }
 need(map.has('owner-follow-entry-607.mjs'),'ORIGINAL_ENTRYPOINT');
 return {ms,map};
}
const keys=['type','id','database_id','bucket_name','namespace_id',
 'service','entrypoint','class_name','text'];
function checkSameBindings(a,b){
 need(a.size===b.size,'POST_BINDING_COUNT');
 for(const [name,orig] of a){
  const cur=b.get(name);need(Boolean(cur),'MISSING_'+name);
  for(const k of keys)if(orig[k]!==undefined)need(orig[k]===cur[k],
   'BINDING_CHANGED_'+name+'_'+k);
 }
}
async function stageRead(id){
 for(let i=0;i<25;i++){
  if(i>0)await sleep(3500);
  try{
   const [meta,source]=await Promise.all([info(id),modules(id)]);
   return {meta,source};
  }catch(e){
   const msg=String(e.message||e);
   if(!msg.includes('_GET_404_')&&
      !msg.includes('_MODULE_SET')&&
      !msg.includes('_VERSION_META'))throw e;
   if(i===24)throw Error('APP639_HOLD_STAGED_VERSION_NOT_YET_VISIBLE');
  }
 }
 throw Error('APP639_HOLD_STAGE_TIMEOUT');
}
async function main(){
 need(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REF==='refs/heads/preview'&&
  process.env.APP639_PARENT===EXPECTED_PARENT&&
  process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT&&token.length>20,'APPROVED_CONTEXT');
 const [current,owner,test,prod]=await Promise.all([
  active(EX),active(OW),active(TEST),active(PROD)]);
 need(current===OFF&&owner===OWNER,'PREVIEW_BRIDGE_NOT_OFF');
 const [before,original]=await Promise.all([info(OFF),modules(OFF)]);
 let changed=0;
 const ms=original.ms.map(m=>{
  const source=Buffer.from(m.content_base64,'base64').toString('utf8');
  if(!source.includes(NEEDLE))return {
   name:m.name,content_type:m.content_type||'application/javascript+module',
   content_base64:m.content_base64};
  need(source.split(NEEDLE).length===2,'DUPLICATE_PATCH_NEEDLE');
  const loc=source.indexOf(NEEDLE);
  const functionStart=source.lastIndexOf('async function enforceFollowEdgeRateLimit355(',loc);
  need(functionStart>=0&&loc-functionStart<1800,'PATCH_NOT_IN_NATIVE_FOLLOW_LIMITER');
  const segment=source.slice(functionStart,loc);
  need(segment.includes('limiter.limit({ key: "follow:" + uid })')&&
       segment.includes('socialAbuseLimited380(6e4)'),'NATIVE_LIMITER_NOT_PRESERVED');
  const patched=source.replace(NEEDLE,PATCH);
  need(patched.length>source.length-160&&patched.includes(PATCH),'SINGLE_PATCH');
  changed++;
  return {name:m.name,content_type:m.content_type||'application/javascript+module',
   content_base64:Buffer.from(patched,'utf8').toString('base64')};
 });
 need(changed===1,'TARGET_EXACT_ONE_MODULE');
 const originalMain=original.map.get('owner-follow-entry-607.mjs');
 need(typeof originalMain==='string','MAIN_MODULE');
 const payload={
  main_module:'owner-follow-entry-607.mjs',
  compatibility_date:'2026-08-28',
  compatibility_flags:before.metadata.resources.script_runtime.compatibility_flags||[],
  annotations:{'workers/tag':'app639-preview-follow-native-limit-only',
   'workers/message':'APP639 PREVIEW follow native 60/min only, preserve exact canonical+likes'},
  bindings:before.bindings.map(b=>({name:b.name,type:'inherit',version_id:OFF})),
  modules:ms
 };
 need(payload.bindings.length===35&&!('migrations' in payload),'NO_SCHEMA_OR_BINDING_CHANGE');
 console.log('APP639_EXACT_FOLLOW_R2_COOLDOWN_REMOVAL_NATIVE_LIMITER_PRESERVED=PASS');
 console.log('APP639_PREVIEW_35_LIVE_BINDINGS_AND_MODULES_SOURCE_PIN=PASS');
 need(await active(EX)===OFF,'DRIFT_BEFORE_STAGE');
 const upload=await api('POST','workers/workers/'+EX+'/versions?deploy=false',payload);
 const id=String(upload?.id||'');
 need(/^[0-9a-f-]{36}$/i.test(id)&&id!==OFF,'STAGE_ID');
 console.log('APP639_NEW_VERSION_STAGED_INACTIVE='+id);
 const {meta,source}=await stageRead(id);
 checkSameBindings(before.map,meta.map);
 need(source.map.size===original.map.size,'POST_MODULE_COUNT');
 let patches=0;
 for(const m of ms){
  const expected=sha(Buffer.from(m.content_base64,'base64'));
  need(source.map.get(m.name)===expected,'POST_MODULE_DRIFT_'+m.name);
  if(original.map.get(m.name)!==expected)patches++;
 }
 need(patches===1,'POST_EXACT_ONE_MODULE_PATCH');
 console.log('APP639_POST_STAGE_ALL_BINDINGS_SECRET_AND_EXACT_PATCH_VERIFIED=PASS');
 need(await active(EX)===OFF&&await active(OW)===owner&&
  await active(TEST)===test&&await active(PROD)===prod,'PREDEPLOY_DRIFT');
 await api('POST','workers/scripts/'+EX+'/deployments',{
  strategy:'percentage',versions:[{version_id:id,percentage:100}],
  annotations:{'workers/message':'APP639 PREVIEW follow native actor limiter only'}
 });
 need(await active(EX)===id,'NOT_ACTIVE');
 need(await active(OW)===owner&&await active(TEST)===test&&await active(PROD)===prod,
  'OTHER_WORKER_CHANGED');
 console.log('APP639_PREVIEW_FOLLOW_R2_PAIR_COOLDOWN_REMOVED=PASS');
 console.log('APP639_EXISTING_NATIVE_LIMITER_IDEMPOTENCY_LIKE_AND_AUTH_PRESERVED=PASS');
 console.log('APP639_TEST_PRODUCTION_AND_OWNER_WORKER_UNCHANGED=PASS');
 console.log('APP639_SHARED_D1_R2_RTDB_RULES_FUNCTIONS_USERDATA_WRITES=ZERO');
 console.log('APP639_ACTIVE_VERSION='+id);
}
if(process.argv[2]==='--self-test'){
 need(NEEDLE.includes('consumeSocialAbuse380')&&
  PATCH.includes('native actor limiter')&&OFF!==OWNER,'SOURCE_CONFIG');
 console.log('APP639_SOURCE_ONLY_ONE_CALL_REMOVAL=PASS');
}else if(process.argv[2]==='--apply-once'){
 try{await main()}catch(e){console.error(String(e.message||e).slice(0,190));process.exitCode=2}
}else{console.error('APP639_HOLD_INVALID_MODE');process.exitCode=2}

// APP642: PREVIEW one-owner bridge runtime study, ZERO default traffic.
// Clone exactly pinned APP641 active Worker and all 35 current bindings/secret
// versions. Only flip the PREVIEW owner bridge flag on a new candidate version.
// Add candidate to deployment at 0%, retaining known-safe OFF at 100%.
// Absolutely no D1/R2/RTDB/Functions/Rules/user data access or mutations here.
// A 0%-traffic VERSION IS NOT proof of end-to-end owner follower sync.
import {createHash} from 'node:crypto';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const EX='soridraw-explore-preview', OW='soridraw-owner-follow-preview-candidate';
const TEST='soridraw-explore-test', PROD='soridraw-explore-api';
const OFF='73f64a79-6cac-441b-9906-9ea9e32db66d';
const OWNER='e679a602-44fb-4b4d-9e4d-7878c00b68c3';
const FLAG='SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607';
const PARENT='b64c722dfdb64f43ac0cd3683b83ddde55396ea0';
const CANARY_HASH='8b9cd603dc722a89765da05bfee9100b2645ecff290bf1f35ff4f0a1bf80fc2f';
const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
const need=(condition,key)=>{if(!condition)throw Error('APP642_HOLD_'+key)};
const hash=b=>createHash('sha256').update(b).digest('hex');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(method,path,body){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path,{
  method,headers:{Authorization:'Bearer '+token,Accept:'application/json',
   ...(method==='POST'?{'Content-Type':'application/json'}:{})},
  ...(method==='POST'?{body:JSON.stringify(body)}:{}),
  signal:AbortSignal.timeout(method==='POST'?60000:25000)});
 let j;try{j=await r.json()}catch{throw Error('APP642_HOLD_API_UNCERTAIN_'+method)}
 if(!r.ok||j?.success!==true){
  const codes=(j?.errors||[]).map(x=>String(x.code||'')).slice(0,3);
  throw Error('APP642_HOLD_API_'+method+'_'+r.status+'_CODES_'+codes.join('_'));
 }
 return j.result;
}
async function deployment(name){
 const r=await api('GET','workers/scripts/'+name+'/deployments?per_page=1');
 const versions=r?.deployments?.[0]?.versions;
 need(Array.isArray(versions)&&versions.length>=1,'DEPLOYMENT_MISSING_'+name);
 return versions;
}
async function soleActive(name){
 const v=await deployment(name);
 need(v.length===1&&Number(v[0]?.percentage)===100,'NOT_SINGLE_ACTIVE_'+name);
 return v[0].version_id;
}
async function metadata(id){
 const r=await api('GET','workers/scripts/'+EX+'/versions/'+id);
 need(r?.id===id&&r.resources?.script_runtime?.compatibility_date==='2026-08-28',
  'RUNTIME_IDENTITY');
 const bs=r?.resources?.bindings;
 need(Array.isArray(bs)&&bs.length===35,'EXACT_35_BINDINGS');
 const map=new Map(bs.map(x=>[x.name,x]));
 need(map.size===35&&map.get('SORIDRAW_ENVIRONMENT')?.text==='preview'&&
  map.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.class_name==='ExploreLikeBatchScheduler103'&&
  !map.has('OWNER_FOLLOW_RECOVERY_557'),'EXISTING_LIKE_OR_PREVIEW_DRIFT');
 return {r,bs,map};
}
async function modules(id){
 const r=await api('GET','workers/workers/'+EX+'/versions/'+id+'?include=modules');
 need(Array.isArray(r?.modules)&&r.modules.length===12,'TWELVE_MODULES');
 const map=new Map();
 for(const m of r.modules){
  need(typeof m.name==='string'&&!map.has(m.name)&&
   typeof m.content_base64==='string'&&m.content_base64.length>50,
   'MODULE_IDENTITY');
  map.set(m.name,hash(Buffer.from(m.content_base64,'base64')));
 }
 need(map.has('owner-follow-entry-607.mjs')&&map.has('preview-entry.mjs'),
  'EXPECTED_ENTRYPOINTS');
 return {list:r.modules,map};
}
const keys=['type','class_name','service','entrypoint','id','database_id',
 'bucket_name','namespace_id','text'];
function compareBindings(before,after){
 need(before.size===after.size,'BINDING_SET_CHANGED');
 for(const [name,b] of before){
  const a=after.get(name);need(Boolean(a),'MISSING_BINDING_'+name);
  for(const key of keys){
   if(name===FLAG&&key==='text'){
    need(a.text==='1','BRIDGE_NOT_ON_IN_CANDIDATE');continue;
   }
   if(b[key]!==undefined)need(a[key]===b[key],
    'BINDING_DRIFT_'+name+'_'+key);
  }
 }
}
async function readStaged(id){
 for(let i=0;i<25;i++){
  if(i)await sleep(3500);
  try{
   const [meta,source]=await Promise.all([metadata(id),modules(id)]);
   return {meta,source};
  }catch(e){
   const reason=String(e?.message||e);
   if(!reason.includes('_GET_404_')&&!reason.includes('_RUNTIME_IDENTITY')&&
      !reason.includes('_TWELVE_MODULES'))throw e;
   if(i===24)throw Error('APP642_HOLD_STAGED_VERSION_NOT_VISIBLE');
  }
 }
 throw Error('APP642_HOLD_STAGE_TIMEOUT');
}
async function run(){
 need(process.env.GITHUB_ACTIONS==='true'&&
  process.env.GITHUB_REF==='refs/heads/preview'&&
  process.env.APP642_PARENT===PARENT&&
  process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT&&token.length>20,
  'APPROVED_SINGLE_USE_CONTEXT');
 const [explore,owner,test,prod]=await Promise.all([
  soleActive(EX),soleActive(OW),soleActive(TEST),soleActive(PROD)]);
 need(explore===OFF&&owner===OWNER,'CURRENT_SAFE_OFF_OR_OWNER_DRIFT');
 const [before,source]=await Promise.all([metadata(OFF),modules(OFF)]);
 const m=before.map;
 need(m.get(FLAG)?.text==='0'&&
  m.get('OWNER_FOLLOW_RESERVATION_SERVICE_600')?.service===OW&&
  m.get('OWNER_FOLLOW_CANONICAL_REPLAY_600')===undefined&&
  m.get('SORIDRAW_OWNER_FOLLOW_W2_PUSH_555')?.text==='1'&&
  m.get('SORIDRAW_OWNER_DO_STANDALONE_600')?.text==='1'&&
  m.get('SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607')?.text==='1'&&
  m.get('SORIDRAW_OWNER_FOLLOW_BIND_544')?.text==='1'&&
  m.get('SORIDRAW_OWNER_FOLLOW_AUTH_PROOF_547')?.text==='1'&&
  m.get('SORIDRAW_OWNER_FOLLOW_QA_ONLY_577')?.text!=='1',
  'REQUIRED_PRIVATE_SERVER_BINDING_OR_FLAGS_MISSING');
 for(const name of ['SORIDRAW_OWNER_FOLLOW_HMAC_539',
  'SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544',
  'SORIDRAW_OWNER_DO_BRIDGE_SECRET_600'])
  need(m.get(name)?.type==='secret_text','SERVER_SECRET_BINDING_MISSING_'+name);
 const canary=m.get('SORIDRAW_OWNER_FOLLOW_CANARY_UID_574')?.text||'';
 need(hash(Buffer.from(canary,'utf8'))===CANARY_HASH,
  'CANARY_UID_NOT_PINNED');
 const bs=before.bs.filter(b=>b.name!==FLAG).map(b=>({
  name:b.name,type:'inherit',version_id:OFF
 }));
 bs.push({name:FLAG,type:'plain_text',text:'1'});
 need(bs.length===35&&new Set(bs.map(b=>b.name)).size===35,
  'EXACT_BINDING_INHERITANCE');
 const rt=before.r.resources.script_runtime;
 const payload={main_module:'owner-follow-entry-607.mjs',
  compatibility_date:'2026-08-28',compatibility_flags:rt.compatibility_flags||[],
  annotations:{'workers/tag':'app642-zero-traffic-owner-canary',
   'workers/message':'APP642 PREVIEW source-identical one-owner bridge ON at 0%, safe OFF stays 100%'},
  bindings:bs,
  modules:source.list.map(m=>({
   name:m.name,content_type:m.content_type||'application/javascript+module',
   content_base64:m.content_base64
  }))
 };
 need(!('migrations' in payload)&&!('routes' in payload),
  'DO_MIGRATION_OR_ROUTING_FORBIDDEN');
 console.log('APP642_APPROVED_ONE_OWNER_LIKE_DO_AND_ALL_35_BINDINGS=PASS');
 need(await soleActive(EX)===OFF,'PRE_STAGE_ACTIVE_DRIFT');
 const staged=await api('POST','workers/workers/'+EX+'/versions?deploy=false',payload);
 const id=String(staged?.id||'');
 need(/^[0-9a-f-]{36}$/i.test(id)&&id!==OFF,'STAGED_ID');
 console.log('APP642_INACTIVE_CANDIDATE_VERSION='+id);
 const after=await readStaged(id);
 compareBindings(before.map,after.meta.map);
 need(source.map.size===after.source.map.size,'MODULE_SET_DRIFT');
 for(const [name,checksum] of source.map)
  need(after.source.map.get(name)===checksum,'MODULE_CHANGED_'+name);
 console.log('APP642_STAGED_MODULES_BYTE_IDENTICAL_AND_FLAG_ONLY_ON=PASS');
 need(await soleActive(EX)===OFF&&await soleActive(OW)===owner&&
  await soleActive(TEST)===test&&await soleActive(PROD)===prod,
  'PRE_DEPLOY_DRIFT');
 // No normal traffic is sent to this ON candidate: all normal requests
 // continue to the original OFF version unless version override is specified.
 await api('POST','workers/scripts/'+EX+'/deployments',{
  strategy:'percentage',
  versions:[{version_id:OFF,percentage:100},{version_id:id,percentage:0}],
  annotations:{'workers/message':'APP642 PREVIEW: 100% safe OFF + 0% explicit-header canary only'}
 });
 const v=await deployment(EX);
 const byId=new Map(v.map(x=>[x.version_id,Number(x.percentage)]));
 need(v.length===2&&byId.get(OFF)===100&&byId.get(id)===0,
  'ZERO_PERCENT_DEPLOYMENT_NOT_EXACT');
 need(await soleActive(OW)===owner&&await soleActive(TEST)===test&&
  await soleActive(PROD)===prod,'POST_DEPLOY_OTHER_WORKERS_DRIFT');
 console.log('APP642_NORMAL_PREVIEW_TRAFFIC_SAFE_OFF_100=PASS');
 console.log('APP642_EXPLICIT_VERSION_OVERRIDE_CANDIDATE_0_PERCENT=PASS');
 console.log('APP642_SHARED_DATA_FIREBASE_RULES_HOSTING_WRITES=ZERO');
 console.log('APP642_REAL_PC_MOBILE_ACCEPTANCE=NOT_TESTED');
 console.log('APP642_CANDIDATE_VERSION='+id);
}
if(process.argv[2]==='--self-test'){
 need(FLAG==='SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607'&&
  OFF!==OWNER&&CANARY_HASH.length===64,'SOURCE_PINS');
 console.log('APP642_SOURCE_ONE_FLAG_AND_ZERO_TRAFFIC=PASS');
}else if(process.argv[2]==='--stage-zero'){
 try{await run()}catch(error){
  console.error(String(error?.message||error).slice(0,220));process.exitCode=2;
 }
}else{console.error('APP642_HOLD_INVALID_MODE');process.exitCode=2}

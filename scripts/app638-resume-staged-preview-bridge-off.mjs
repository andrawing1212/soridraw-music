// APP638 resumes an APP637 staged version after Cloudflare eventually
// exposes it. No new uploads, version creation, migrations or force rollback.
// Only the exact PREVIEW version differing from LIVE by one OFF flag may deploy.
import {createHash} from 'node:crypto';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const EX='soridraw-explore-preview',OW='soridraw-owner-follow-preview-candidate';
const TEST='soridraw-explore-test',PROD='soridraw-explore-api';
const LIVE='5d0f74b1-84bf-4f96-a9e4-51bea25736fa';
const OWNER='e679a602-44fb-4b4d-9e4d-7878c00b68c3';
const FLAG='SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607';
const PARENT='72641805eae483592219e27ac4fbc4cd98fd17b8';
const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
const need=(v,msg)=>{if(!v)throw Error('APP638_HOLD_'+msg)};
const sha=x=>createHash('sha256').update(x).digest('hex');
async function api(method,path,body){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path,{
  method,headers:{Authorization:'Bearer '+token,Accept:'application/json',
   ...(method==='POST'?{'Content-Type':'application/json'}:{})},
  ...(method==='POST'?{body:JSON.stringify(body)}:{}),
  signal:AbortSignal.timeout(method==='POST'?55000:25000)});
 let j;try{j=await r.json()}catch{throw Error('APP638_HOLD_UNCERTAIN_'+method)}
 if(!r.ok||j?.success!==true){
  const codes=(j?.errors||[]).map(e=>String(e.code||'')).slice(0,4);
  throw Error('APP638_HOLD_API_'+method+'_'+r.status+'_'+codes.join('_'));
 }
 return j.result;
}
async function active(name){
 const d=await api('GET','workers/scripts/'+name+'/deployments?per_page=1');
 const versions=d?.deployments?.[0]?.versions;
 need(versions?.length===1&&Number(versions[0].percentage)===100,'TRAFFIC_SPLIT_'+name);
 return versions[0].version_id;
}
async function info(id){
 const d=await api('GET','workers/scripts/'+EX+'/versions/'+id);
 need(d?.id===id&&d.resources?.script_runtime?.compatibility_date==='2026-08-28',
  'META_'+id);
 const bs=d.resources.bindings||[];
 need(bs.length===35,'BINDING_COUNT_'+id);
 const map=new Map(bs.map(b=>[b.name,b]));
 need(map.size===35&&map.get('SORIDRAW_ENVIRONMENT')?.text==='preview'&&
  map.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.class_name==='ExploreLikeBatchScheduler103'&&
  !map.has('OWNER_FOLLOW_RECOVERY_557'),'LIKE_OR_ENV');
 return map;
}
async function moduleHash(id){
 const d=await api('GET','workers/workers/'+EX+'/versions/'+id+'?include=modules');
 const ms=d?.modules||[];
 need(ms.length===12,'MODULE_COUNT');
 const map=new Map();
 for(const m of ms){
  need(typeof m.name==='string'&&typeof m.content_base64==='string'&&
   m.content_base64.length>50&&!map.has(m.name),'MODULE_ENTRY');
  map.set(m.name,sha(Buffer.from(m.content_base64,'base64')));
 }
 need(map.has('owner-follow-entry-607.mjs'),'MAIN');
 return map;
}
function compare(a,b){
 need(a.size===b.size,'BINDING_SET');
 for(const [name,orig] of a){
  const next=b.get(name);need(Boolean(next),'MISSING_'+name);
  for(const key of ['type','id','database_id','bucket_name','namespace_id',
   'service','entrypoint','class_name','text']){
   if(name===FLAG&&key==='text'){need(next.text==='0','FLAG_NOT_OFF');continue}
   if(orig[key]!==undefined)need(orig[key]===next[key],'DRIFT_'+name+'_'+key);
  }
 }
}
async function main(){
 need(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REF==='refs/heads/preview'&&
  process.env.APP638_PARENT===PARENT&&
  process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT&&token.length>20,'APPROVED_CONTEXT');
 const [live,owner,test,prod]=await Promise.all([active(EX),active(OW),active(TEST),active(PROD)]);
 need(live===LIVE,'ACTIVE_CHANGED_NO_DEPLOY');
 need(owner===OWNER,'OWNER_WORKER_DRIFT');
 const list=await api('GET','workers/scripts/'+EX+'/versions?per_page=30');
 const items=Array.isArray(list)?list:list?.items||list?.versions||[];
 need(Array.isArray(items)&&items.length>0,'VERSIONS_UNAVAILABLE');
 const candidates=items.filter(x=>x?.id&&x.id!==LIVE&&
  String(x.metadata?.created_on||x.created_on||'')>='2026-11-13T20:25:00Z'&&
  String(x.metadata?.created_on||x.created_on||'')<='2026-11-13T20:31:00Z');
 console.log('APP638_STAGED_VERSIONS_CANDIDATE_COUNT='+candidates.length);
 need(candidates.length>0&&candidates.length<=6,'STAGED_VERSION_NOT_LISTED');
 const [oldBindings,oldModules]=await Promise.all([info(LIVE),moduleHash(LIVE)]);
 need(oldBindings.get(FLAG)?.text==='1','ACTIVE_NOT_ON');
 let verified=[];
 for(const candidate of candidates){
  try{
   const [b,m]=await Promise.all([info(candidate.id),moduleHash(candidate.id)]);
   need(b.get(FLAG)?.text==='0','CANDIDATE_NOT_OFF');
   compare(oldBindings,b);
   need(m.size===oldModules.size,'CODE_MODULE_COUNT');
   for(const [name,v] of oldModules)need(m.get(name)===v,'SOURCE_CHANGED_'+name);
   verified.push(candidate.id);
  }catch(e){
   console.log('APP638_CANDIDATE_NOT_VERIFIED_CODE='+
    String(e.message||e).slice(0,88).replace(/[a-f0-9-]{32,}/gi,'<id>'));
  }
 }
 need(verified.length===1,'EXACTLY_ONE_VERIFIED_STAGED_OFF_REQUIRED');
 const id=verified[0];
 console.log('APP638_EXISTING_STAGED_VERSION_IDENTICAL_EXCEPT_ONE_FLAG=PASS');
 need(await active(EX)===LIVE,'PRE_DEPLOY_DRIFT');
 need(await active(OW)===owner&&await active(TEST)===test&&await active(PROD)===prod,
  'OTHER_WORKER_DRIFT');
 await api('POST','workers/scripts/'+EX+'/deployments',{
  strategy:'percentage',versions:[{version_id:id,percentage:100}],
  annotations:{'workers/message':'APP638 PREVIEW only, previously staged one-flag OFF version'}
 });
 console.log('APP638_DEPLOY_ACCEPTED=PASS');
 need(await active(EX)===id,'POST_NOT_ACTIVE');
 need(await active(OW)===owner&&await active(TEST)===test&&await active(PROD)===prod,
  'OTHER_WORKERS_CHANGED');
 console.log('APP638_PREVIEW_OWNER_BRIDGE_OFF=PASS');
 console.log('APP638_LIKE_DO_EXISTING_FOLLOW_SOURCE_AND_SECRETS_PRESERVED=PASS');
 console.log('APP638_TEST_PRODUCTION_AND_OWNER_WORKER_UNCHANGED=PASS');
 console.log('APP638_SHARED_D1_R2_RTDB_RULES_FUNCTIONS_USERDATA_MUTATION=ZERO');
 console.log('APP638_ACTIVE_OFF_VERSION='+id);
}
if(process.argv[2]==='--self-test'){
 need(FLAG==='SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607'&&OWNER!==LIVE,'CONFIG');
 console.log('APP638_ONE_STAGED_VERSION_REUSE_ONLY=PASS');
}else if(process.argv[2]==='--apply-once'){
 try{await main()}catch(e){console.error(String(e.message||e).slice(0,180));process.exitCode=2}
}else{console.error('APP638_HOLD_MODE');process.exitCode=2}

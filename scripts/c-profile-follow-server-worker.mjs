// Complete the ALREADY STAGED C-profile bridge; no new Worker architecture.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
const A='e1a30fc9ef497fda1d34f4ab3dc1da45';
const EXP='soridraw-explore-preview',OWNER='soridraw-owner-follow-preview-candidate';
const PROTECTED=['soridraw-explore-test','soridraw-explore-api'];
const OLD='88e89c7a-d07c-426f-89ff-461b87fbf0fc';
const STAGED='0e6486e5-5a7d-4806-9542-6879f4c6ec3c';
const OWNER_VERSION='142e7005-cf9c-4cc7-88fc-a786a8d35058';
const ENDPOINT='https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExplorePublicFollow669';
const MODULE='app605/public-follow-dual-ack-671.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const requireThat=(x,k)=>{if(!x)throw Error('C_PROFILE_WORKER_HOLD_'+k)};
const api=async(method,path,payload)=>{
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+A+'/'+path,{
  method,headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},
  ...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(90000)});
 const data=await response.json();
 requireThat(response.ok&&data.success===true,'API_'+method+'_'+response.status);
 return data.result;
};
const deployments=async name=>(await api('GET','workers/scripts/'+name+'/deployments?per_page=1'))?.deployments?.[0]?.versions;
const stable=versions=>JSON.stringify(versions?.map(({version_id,percentage})=>({version_id,percentage})).sort((a,b)=>a.version_id.localeCompare(b.version_id)));
const snap=async id=>{
 const [meta,code]=await Promise.all([
  api('GET','workers/scripts/'+EXP+'/versions/'+id),
  api('GET','workers/workers/'+EXP+'/versions/'+id+'?include=modules')]);
 requireThat(code?.modules?.length>0,'MODULE_FETCH');
 return {meta,modules:code.modules,bindings:meta.resources.bindings};
};
const text=m=>Buffer.from(m.content_base64,'base64').toString('utf8');
const oldPublicFlag='export const APP671_PUBLIC_DUAL_ACK_COMPILED_OPEN=false;';
async function main(){
 requireThat(process.argv[2]==='--apply','MODE');
 requireThat(process.env.GITHUB_ACTIONS==='true'&&
   process.env.GITHUB_REF==='refs/heads/preview'&&
   process.env.GITHUB_SHA===process.env.APP_C_PROFILE_APPROVED_SHA&&
   /^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA||'')&&
   process.env.CLOUDFLARE_ACCOUNT_ID===A,'PREVIEW_WORKFLOW');
 const oldMap={};
 for(const name of [EXP,OWNER,...PROTECTED])oldMap[name]=await deployments(name);
 requireThat(oldMap[EXP]?.some(x=>x.version_id===OLD&&x.percentage===100),'ACTIVE_EXP_DRIFT');
 requireThat(oldMap[OWNER]?.some(x=>x.version_id===OWNER_VERSION&&x.percentage===100),'ACTIVE_OWNER_DRIFT');
 const [active,standby]=await Promise.all([snap(OLD),snap(STAGED)]);
 requireThat(active.modules.length===12&&active.bindings.length===37,'OLD_SHAPE_DRIFT');
 requireThat(standby.modules.length===15&&standby.bindings.length===37,'STAGED_SHAPE_DRIFT');
 const oldNames=new Map(active.modules.map(m=>[m.name,m]));
 const candidates=new Map(standby.modules.map(m=>[m.name,m]));
 for(const [name,original] of oldNames){
  const proposed=candidates.get(name);
  requireThat(proposed&&
   (name==='app605/owner-follow-service-601.mjs'||
    sha(text(proposed))===sha(text(original))), 'UNRELATED_MODULE_DRIFT_'+name);
 }
 for(const prior of active.bindings)
  requireThat(isDeepStrictEqual(standby.bindings.find(b=>b.name===prior.name),prior),
   'UNEXPECTED_BINDING_CHANGE_'+prior.name);
 const target=candidates.get(MODULE);
 requireThat(!!target,'DUAL_ACK_MODULE_MISSING');
 const approved=readFileSync('cloudflare/explore-worker/runtime/public-follow-dual-ack-671.mjs','utf8');
 requireThat(approved.includes(oldPublicFlag),'COMPILE_SOURCE_DRIFT');
 const changed=approved.replace(oldPublicFlag,
  'export const APP671_PUBLIC_DUAL_ACK_COMPILED_OPEN=true;');
 requireThat(changed.includes("result?.status==='target-not-public'"),
  'PRIVATE_TARGET_RETRY_FIX_MISSING');
 const modules=standby.modules.map(m=>m.name===MODULE
  ?{...m,content_base64:Buffer.from(changed).toString('base64')}:m);
 const hashes=new Map(modules.map(m=>[m.name,sha(text(m))]));
 const bindings=[
  ...active.bindings.map(b=>({name:b.name,type:'inherit',version_id:OLD})),
  ...Object.entries({
   SORIDRAW_PUBLIC_FOLLOW_READY_669:'1',
   SORIDRAW_PUBLIC_FOLLOW_SCOPE_669:'preview-only',
   SORIDRAW_PUBLIC_FOLLOW_ENDPOINT_669:ENDPOINT,
  }).map(([name,text])=>({name,type:'plain_text',text})),
 ];
 requireThat(new Set(bindings.map(b=>b.name)).size===40,'DUPLICATE_BINDING');
 for(const n of [EXP,OWNER,...PROTECTED])
  requireThat(stable(await deployments(n))===stable(oldMap[n]),'PRE_STAGE_TRAFFIC_DRIFT_'+n);
 const runtime=active.meta.resources.script_runtime;
 requireThat(runtime.compatibility_date==='2026-08-28','RUNTIME_DRIFT');
 const created=await api('POST','workers/workers/'+EXP+'/versions?deploy=false',{
  main_module:'owner-follow-entry-607.mjs',
  compatibility_date:runtime.compatibility_date,
  compatibility_flags:runtime.compatibility_flags||[],
  annotations:{'workers/tag':'c-profile-follow-finish',
   'workers/message':'PREVIEW C public profile follow update using existing owner replay'},
  bindings,modules,
 });
 requireThat(/^[a-f0-9-]{36}$/.test(created?.id||''),'NEW_VERSION_ID');
 const next=await snap(created.id);
 requireThat(next.modules.length===15&&next.bindings.length===40,'NEW_VERSION_SHAPE');
 for(const m of next.modules)requireThat(sha(text(m))===hashes.get(m.name),
  'NEW_VERSION_SOURCE_'+m.name);
 for(const b of active.bindings)requireThat(
  isDeepStrictEqual(next.bindings.find(n=>n.name===b.name),b),'ACTIVE_BINDING_LOST_'+b.name);
 for(const [name,value] of Object.entries({
  SORIDRAW_PUBLIC_FOLLOW_READY_669:'1',SORIDRAW_PUBLIC_FOLLOW_SCOPE_669:'preview-only',
  SORIDRAW_PUBLIC_FOLLOW_ENDPOINT_669:ENDPOINT,
 })){
  const b=next.bindings.find(x=>x.name===name);
  requireThat(b?.type==='plain_text'&&b?.text===value,'NEW_FLAG_'+name);
 }
 for(const n of [EXP,OWNER,...PROTECTED])
  requireThat(stable(await deployments(n))===stable(oldMap[n]),'PRE_ACTIVE_DRIFT_'+n);
 // Firebase receiver and shared ACL must be live before this script runs.
 // Activate precisely the Explore Worker, never the standalone owner DO.
 await api('POST','workers/scripts/'+EXP+'/deployments',{
  strategy:'percentage',versions:[{version_id:created.id,percentage:100}],
  annotations:{'workers/message':'C public-follow number updates on PREVIEW only'},
 });
 const after=await deployments(EXP);
 requireThat(after?.some(x=>x.version_id===created.id&&x.percentage===100),
  'ACTIVATION_NOT_CONFIRMED');
 for(const n of [OWNER,...PROTECTED])
  requireThat(stable(await deployments(n))===stable(oldMap[n]),
   'PROTECTED_CHANGED_'+n);
 writeFileSync('c-profile-worker-result.json',JSON.stringify({
  status:'PASS',previewWorkerVersion:created.id,previous:OLD,
  ownerWorkerUnchanged:true,testProductionUnchanged:true,
 }));
 console.log('C_PROFILE_EXPLORE_WORKER_ACTIVE='+created.id);
 console.log('C_PROFILE_OWNER_DO_TEST_PROD_UNCHANGED=PASS');
}
main().catch(e=>{console.error(String(e.message).slice(0,700));process.exitCode=2});

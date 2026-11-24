// APP797 one-time approved activation of existing workers only.
// Inherit the staged credential values without reading or rotating them.
// Probe uses a temporary zero-traffic version and malformed reservation:
// no valid UID/ticket, no DO instantiation, D1/R2/RTDB writes or Auth enrollment.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {sameStagedWorkerRuntime660} from './lib/owner-follow-general660.mjs';
const token=process.env.CLOUDFLARE_API_TOKEN||'',base='https://api.cloudflare.com/client/v4/accounts/e1a30fc9ef497fda1d34f4ab3dc1da45/';
const EX='soridraw-explore-preview',TEST='soridraw-explore-test',OW='soridraw-owner-follow-preview-candidate',PROD='soridraw-explore-api';
const active={ [EX]:'cfd40718-6ab5-4133-bdb2-fa69332d6810',[TEST]:'ddd2255a-75cc-4db9-8905-b47338558cb0',[OW]:'1e987bc3-36d3-4bb0-861f-4df17f536592',[PROD]:'af81502a-298d-4ec6-bc2a-0c529d6dc29e'};
const staged={ [OW]:'3cac8c6c-4059-4fd5-b04c-137d78962bf1',[PROD]:'19023069-20da-4fd2-a39e-cd14dc890cac'};
const flags={ [OW]:'SORIDRAW_OWNER_FOLLOW_PRODUCTION_RESERVE_797',[PROD]:'SORIDRAW_OWNER_FOLLOW_PRODUCTION_797'};
const main={ [OW]:'worker.js',[PROD]:'entry.mjs'};
const hold=m=>{throw Error('APP797_ACTIVATION_HOLD_'+m)};
const need=(x,m)=>{if(!x)hold(m)};
const hash=b=>createHash('sha256').update(b).digest('hex');
const uuid=x=>/^[0-9a-f-]{36}$/.test(String(x||''));
const norm=vs=>vs.map(x=>({version_id:x.version_id,percentage:Number(x.percentage)})).sort((a,b)=>a.version_id.localeCompare(b.version_id));
const expected=(id,probe)=>[{version_id:id,percentage:100},...(probe?[{version_id:probe,percentage:0}]:[])];
const state=join(process.env.RUNNER_TEMP||'/tmp','app797-worker-state.json');
async function api(method,p,body){
 const res=await fetch(base+p,{method,redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});
 const j=await res.json().catch(()=>null);
 if(!res.ok||j?.success!==true){
  // Only deployment errors: payload has version UUIDs and percentages,
  // not credential values. Keep the provider's actionable error text.
  if(method==='POST'&&p.endsWith('/deployments')){
   const msg=(j?.errors||[]).map(e=>String(e.message||'')).join(' | ').slice(0,1000);
   console.log('APP797_DEPLOYMENT_REJECTION='+JSON.stringify({path:p,versions:body.versions,message:msg}));
  }
  hold('HTTP_'+method+'_'+res.status+'_CODE_'+(j?.errors||[]).map(e=>Number(e.code)).filter(Number.isSafeInteger).slice(0,3).join('_'));
 }
 return j.result;
}
async function versions(name){const x=await api('GET','workers/scripts/'+name+'/deployments?per_page=1');need(Array.isArray(x?.deployments?.[0]?.versions),'DEPLOYMENT_MISSING');return norm(x.deployments[0].versions)}
async function check(name,vs){need(isDeepStrictEqual(await versions(name),norm(vs)),'TRAFFIC_DRIFT_'+name)}
async function snapshot(name,id){
 const [m,c]=await Promise.all([api('GET','workers/scripts/'+name+'/versions/'+id),api('GET','workers/workers/'+name+'/versions/'+id+'?include=modules')]);
 const bindings=m.resources?.bindings,runtime=m.resources?.script_runtime,modules=c.modules?.map(x=>({name:x.name,content_type:x.content_type||'application/javascript+module',content_base64:x.content_base64}));
 need(m.id===id&&Array.isArray(bindings)&&runtime&&Array.isArray(modules)&&new Set(bindings.map(x=>x.name)).size===bindings.length&&new Set(modules.map(x=>x.name)).size===modules.length,'SNAPSHOT_'+name);
 return {name,id,bindings,runtime,modules};
}
async function stage(src,{entry=main[src.name],bindings=[],extraModules=[]}={}){
 const overrides=new Map(bindings.map(x=>[x.name,x]));
 const rows=[...src.bindings.map(x=>overrides.get(x.name)||{name:x.name,type:'inherit',version_id:src.id}),...bindings.filter(x=>!src.bindings.some(y=>y.name===x.name))];
 const modules=[...src.modules,...extraModules];
 const uploaded=await api('POST','workers/workers/'+src.name+'/versions?deploy=false',{main_module:entry,compatibility_date:src.runtime.compatibility_date,compatibility_flags:src.runtime.compatibility_flags||[],bindings:rows,modules,annotations:{'workers/tag':'app797-activation','workers/message':'APP797 approved production follow connection, no schema change'}});
 need(uuid(uploaded?.id),'STAGE_ID');
 const after=await snapshot(src.name,uploaded.id),actual=new Map(after.bindings.map(x=>[x.name,x]));
 need(after.bindings.length===rows.length&&sameStagedWorkerRuntime660(src.runtime,after.runtime),'STAGED_BINDING_RUNTIME');
 for(const old of src.bindings){const x=actual.get(old.name),o=overrides.get(old.name);if(!o)need(isDeepStrictEqual(old,x),'BINDING_DRIFT_'+old.name);else need(x?.type===o.type&&x.text===o.text,'FLAG_DRIFT_'+old.name)}
 for(const o of bindings.filter(x=>!src.bindings.some(y=>y.name===x.name)))need(actual.get(o.name)?.type===o.type,'EXTRA_BINDING');
 need(after.modules.length===modules.length,'MODULE_COUNT');
 for(const m of modules){const v=after.modules.find(x=>x.name===m.name);need(v&&hash(Buffer.from(v.content_base64,'base64'))===hash(Buffer.from(m.content_base64,'base64')),'MODULE_DRIFT_'+m.name)}
 console.log('APP797_EXACT_INHERITED_VERSION='+src.name+';version='+after.id);
 return after;
}
const plain=(name,text)=>({name,type:'plain_text',text});
async function deploy(name,vs){await api('POST','workers/scripts/'+name+'/deployments',{strategy:'percentage',versions:vs,annotations:{'workers/message':'APP797 approved backend-only connection / exact rollback'}});await check(name,vs)}
const save=s=>writeFileSync(state,JSON.stringify(s),{mode:0o600});
async function rollback(s){
 // Only restore a version if the live version is still exactly ours.
 // If an API call was uncertain, inspect it before proceeding.
 for(const n of [PROD,OW]){
  const v=await versions(n);
  if(isDeepStrictEqual(v,norm(expected(active[n]))))continue;
  const ours=n===PROD?[expected(active[n],s.probe),expected(s.prodOn)]:[expected(s.ownerOn)];
  if(!ours.some(x=>x[0].version_id&&isDeepStrictEqual(v,norm(x))))hold('ROLLBACK_CONCURRENT_DEPLOY_'+n);
  await deploy(n,expected(active[n]));
  console.log('APP797_ROLLBACK_OLD_100_PERCENT='+n);
 }
 await check(EX,expected(active[EX]));await check(TEST,expected(active[TEST]));
}
const probePath='/internal/app797-connection-probe';
const origin='https://soridraw.com',url='https://soridraw-explore-api.andrawing1212.workers.dev';
async function run(){
 need(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='andrawing1212/soridraw-music'&&process.env.GITHUB_ACTOR===process.env.GITHUB_REPOSITORY_OWNER&&process.env.GITHUB_REF==='refs/heads/prep/production-follow-existing-writer'&&process.env.GITHUB_RUN_ATTEMPT==='1'&&execFileSync('git',['rev-parse','HEAD^'],{encoding:'utf8'}).trim()==='8d48818ac94704239b170df4e776ff562614c000','ONE_TIME_APPROVED_CONTEXT');
 need(token.length>20,'TOKEN');
 for(const n of Object.keys(active))await check(n,expected(active[n]));
 const [ow,prod]=await Promise.all([snapshot(OW,staged[OW]),snapshot(PROD,staged[PROD])]);
 for(const x of [ow,prod]){
  const old=await snapshot(x.name,active[x.name]),map=new Map(x.bindings.map(x=>[x.name,x]));
  need(map.get(flags[x.name])?.text==='0','OFF_PIN');
  for(const b of old.bindings)need(isDeepStrictEqual(b,map.get(b.name)),'ORIGINAL_BINDING_DRIFT_'+b.name);
  need(sameStagedWorkerRuntime660(old.runtime,x.runtime),'ORIGINAL_RUNTIME_DRIFT');
 }
 need(ow.bindings.length===15&&prod.bindings.length===20,'CANDIDATE_COUNT');
 need(prod.bindings.some(b=>b.name==='OWNER_FOLLOW_RESERVATION_SERVICE_600'&&b.service===OW)&&ow.bindings.some(b=>b.name==='SORIDRAW_OWNER_DO_PRODUCTION_BRIDGE_797'&&b.type==='secret_text')&&prod.bindings.some(b=>b.name==='SORIDRAW_OWNER_DO_BRIDGE_SECRET_600'&&b.type==='secret_text'),'STAGED_CREDENTIAL_BINDINGS');
 // Reuse the exact versions whose private binding and auth denial already
 // passed in run 45371145323. No new credential or repeat live probe.
 const [onOwner,provedProd]=await Promise.all([snapshot(OW,'c71d7c12-ace4-4405-ab1a-d8c651c90559'),snapshot(PROD,'a3a3d85c-d519-495b-b5eb-8e87d83ec574')]);
 for(const [off,on] of [[ow,onOwner],[prod,provedProd]]){
  const map=new Map(on.bindings.map(x=>[x.name,x]));
  need(on.bindings.length===off.bindings.length&&map.get(flags[on.name])?.text==='1','PROVEN_ON_BINDING_COUNT');
  for(const b of off.bindings)if(b.name!==flags[on.name])need(isDeepStrictEqual(b,map.get(b.name)),'PROVEN_BINDING_DRIFT_'+b.name);
  // Once a version has been deployed its migration tag can be exposed again
  // even if the inactive upload omitted it. Compare BOTH against the exact
  // active original, not against an inactive snapshot missing its tag.
  const original=await snapshot(on.name,active[on.name]);
  const runtimeOK=sameStagedWorkerRuntime660(original.runtime,off.runtime)&&sameStagedWorkerRuntime660(original.runtime,on.runtime);
  if(!runtimeOK){
   const changed=Object.keys({...original.runtime,...on.runtime,...off.runtime}).filter(k=>!isDeepStrictEqual(original.runtime[k],on.runtime[k])||!isDeepStrictEqual(original.runtime[k],off.runtime[k]));
   console.log('APP797_RUNTIME_MISMATCH='+JSON.stringify({worker:on.name,fields:changed,originalMigrationTag:original.runtime.migration_tag||null,offMigrationTag:off.runtime.migration_tag||null,onMigrationTag:on.runtime.migration_tag||null}));
  }
  need(runtimeOK,'PROVEN_RUNTIME_DRIFT_'+on.name);
  const moduleHashes=x=>x.modules.map(m=>[m.name,m.content_type,hash(Buffer.from(m.content_base64,'base64'))]).sort((a,b)=>a[0].localeCompare(b[0]));
  need(isDeepStrictEqual(moduleHashes(off),moduleHashes(on)),'PROVEN_SOURCE_DRIFT_'+on.name);
 }
 // The previously tested probe was uploaded AFTER the production ON version.
 // Use a fresh, identical final version (no probe route/secret) so Cloudflare
 // can validate the actual release candidate at 0% before touching Firebase.
 const onProd=await stage(provedProd);
 const s={ownerOn:onOwner.id,prodOn:onProd.id,probe:onProd.id};save(s);
 need(readFileSync(join(process.env.RUNNER_TEMP,'app797-function','before.json'),'utf8').includes('enrollOwnerFollow544Candidate'),'FUNCTION_PREFLIGHT');
 try{
  for(const n of Object.keys(active))await check(n,expected(active[n]));
  await deploy(OW,expected(s.ownerOn));
  await deploy(PROD,expected(active[PROD],s.prodOn));
  console.log('APP797_FINAL_VERSION_ZERO_TRAFFIC_ACCEPTED;PREVIOUS_LIVE_PRIVATE_AUTH_REUSED');
  await check(EX,expected(active[EX]));await check(TEST,expected(active[TEST]));
  // Shared callable only: source/environment patch, existing Auth/AppCheck,
  // HMAC, lifecycle, permissions and other Functions unchanged.
  execFileSync('python3',['scripts/app797-enrollment-activation.py','apply'],{stdio:'inherit',timeout:1000000});
  await check(OW,expected(s.ownerOn));await check(PROD,expected(active[PROD],s.prodOn));await check(EX,expected(active[EX]));await check(TEST,expected(active[TEST]));
  await deploy(PROD,expected(s.prodOn));
  await check(EX,expected(active[EX]));await check(TEST,expected(active[TEST]));await check(OW,expected(s.ownerOn));
  const after=await fetch(url+'/v1/profiles/SyntheticOwner797/follow',{method:'PUT',redirect:'error',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
  need([401,403].includes(after.status),'ACTIVE_PRODUCTION_AUTH_DENIAL_'+after.status);
  console.log(JSON.stringify({status:'APP797_BACKEND_ACTIVE',ownerVersion:s.ownerOn,productionVersion:s.prodOn,productionTraffic:100,previewExploreUnchanged:true,testUnchanged:true,hostingChanged:false,syntheticLiveFollowMutation:false,realPCMobile:false,oldRollbackVersions:{owner:active[OW],production:active[PROD]}}));
 }catch(e){
  console.log('APP797_ACTIVATION_FAILED;RESTORE_EXACT_PRIOR_WORKER_VERSIONS');
  try{await rollback(s)}catch{console.log('APP797_WORKER_ROLLBACK_NOT_CONFIRMED');}
  try{execFileSync('python3',['scripts/app797-enrollment-activation.py','rollback'],{stdio:'inherit',timeout:1000000})}catch{console.log('APP797_ENROLLMENT_ROLLBACK_NOT_CONFIRMED');}
  throw e;
 }
}
run().catch(e=>{console.error(String(e?.message||'APP797_UNKNOWN').startsWith('APP797_')?e.message:'APP797_ACTIVATION_HOLD_UNEXPECTED');process.exitCode=2});

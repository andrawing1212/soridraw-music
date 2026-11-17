// APP711: deploy one exact PREVIEW Worker module, preserve everything else.
// Patch only the active owner reservation module; preserve all bindings and storage.
// Explore, Functions, D1/R2 data, TEST and PRODUCTION remain unchanged.
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {hash711,patchReservationRetry711} from './lib/follow-reservation-retry-711.mjs';
import {sameStagedWorkerRuntime660} from './lib/owner-follow-general660.mjs';
const A='e1a30fc9ef497fda1d34f4ab3dc1da45';
const EX='soridraw-owner-follow-preview-candidate',OW='soridraw-explore-preview';
const ACTIVE='15981200-c988-44b7-8b20-73b777d4fe63';
// Owner Worker is a separate service. Read its current 100%-active version at runtime.
// No historical 0% canary is permitted on the current 100% active release.
const check=(yes,why)=>{if(!yes)throw Error('APP711_PREVIEW_HOLD_'+why)};
async function api(method,path,body){
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+A+'/'+path,{
  method,headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},
  ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(90000)});
 const data=await response.json();
 check(response.ok&&data.success===true,'API_'+method+'_'+response.status+'_'+JSON.stringify(data.errors||[]).slice(0,300));
 return data.result;
}
async function deployed(name){
 return (await api('GET','workers/scripts/'+name+'/deployments?per_page=1'))?.deployments?.[0]?.versions;
}
const norm=v=>JSON.stringify((v||[]).map(({version_id,percentage})=>({version_id,percentage}))
 .sort((a,b)=>a.version_id.localeCompare(b.version_id)));
const beforePreview=[{version_id:ACTIVE,percentage:100}];
const afterPreview=id=>[{version_id:id,percentage:100}];
// Snapshot exact active owner deployment, preserving its current version unchanged.
async function snapshot(id){
 const [metadata,source]=await Promise.all([
  api('GET','workers/scripts/'+EX+'/versions/'+id),
  api('GET','workers/workers/'+EX+'/versions/'+id+'?include=modules')]);
 // APP711: the CURRENT 100%-active Worker is exact-version and exact-main-
 // hash locked. Old historical module/binding counts are not release identity.
 // Preserve the complete actual inventory, and compare every item after staging.
 const n=source?.modules?.length||0;
 check(n===1,'LIVE_MODULE_INVENTORY');
 check(new Set(source.modules.map(m=>m?.name)).size===n &&
  source.modules.every(m=>typeof m?.name==='string'&&
   typeof m?.content_base64==='string'&&m.content_base64.length>0),
  'LIVE_MODULE_IDENTITY');
 const bindings=metadata?.resources?.bindings;
 check(Array.isArray(bindings)&&bindings.length>=5&&bindings.length<=100 &&
  new Set(bindings.map(b=>b?.name)).size===bindings.length &&
  bindings.every(b=>typeof b?.name==='string'&&typeof b?.type==='string'),
  'LIVE_BINDING_INVENTORY');
 check(/^\d{4}-\d{2}-\d{2}$/.test(metadata?.resources?.script_runtime?.compatibility_date||''),
  'LIVE_RUNTIME_DATE');
 check(source.modules.some(m=>m.name==='worker.js'),
  'PINNED_MAIN_MODULE_MISSING');
 return {metadata,modules:source.modules.map(m=>({
  name:m.name,content_type:m.content_type||'application/javascript+module',content_base64:m.content_base64
 }))};
}
const bytes=m=>Buffer.from(m.content_base64,'base64');
async function verifyStage(id,prior,expectedModules){
 const after=await snapshot(id);
 const beforeBindings=prior.metadata.resources.bindings;
 const afterBindings=after.metadata.resources.bindings;
 const map=new Map(afterBindings.map(binding=>[binding.name,binding]));
 check(map.size===beforeBindings.length,'BINDING_DUPLICATE');
 for(const binding of beforeBindings)check(isDeepStrictEqual(map.get(binding.name),binding),'BINDING_DRIFT_'+binding.name);
 check(sameStagedWorkerRuntime660(prior.metadata.resources.script_runtime,after.metadata.resources.script_runtime),'RUNTIME');
 for(const expected of expectedModules){
  const found=after.modules.find(m=>m.name===expected.name);
  check(found&&hash711(bytes(found))===hash711(bytes(expected)),'SOURCE_DRIFT_'+expected.name);
 }
}
async function run(){
 check(process.argv[2]==='--preflight'||process.argv[2]==='--apply-once','MODE');
 check(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REF==='refs/heads/preview'&&
  process.env.CLOUDFLARE_ACCOUNT_ID===A&&/^[a-f0-9]{40}$/.test(process.env.APP711_APPROVED_PARENT||''),
  'RELEASE_CONTEXT');
 const protectedNames=['soridraw-explore-test','soridraw-explore-api'];
 const beforeProtected=await Promise.all(protectedNames.map(deployed));
 const ownerBefore=await deployed(OW);
 check(Array.isArray(ownerBefore)&&ownerBefore.length===1&&
  ownerBefore[0]?.version_id&&Number(ownerBefore[0].percentage)===100,
  'OWNER_ACTIVE_SPLIT_OR_MISSING');
 check(ownerBefore[0].version_id==='a28c1391-1d98-41fb-b9c4-8f51aa19e0a0','OWNER_VERSION_DRIFT');
 check(norm(await deployed(EX))===norm(beforePreview),'EXPLORE_ACTIVE_VERSION');
 check(norm(await deployed(OW))===norm(ownerBefore),'OWNER_ACTIVE_VERSION');
 const old=await snapshot(ACTIVE);
 const main=old.modules.find(m=>m.name==='worker.js');
 check(main,'MAIN_BUNDLE');
 check(hash711(bytes(main))==='99f30a31d757de95861a6fb371194ddf82bae40cf03bbc83c5c4090f4eef1223','PINNED_MAIN_SOURCE_SHA');
 const patched=patchReservationRetry711(bytes(main).toString('utf8'));
 // Syntax-check the exact real module without invoking Cloudflare bindings.
 const directory=mkdtempSync(join(tmpdir(),'app711-'));
 try {
  const file=join(directory,'service.mjs');
  writeFileSync(file,patched);
  execFileSync(process.execPath,['--check',file],{stdio:'pipe',timeout:20000});
 }finally{rmSync(directory,{recursive:true,force:true})}
 const modules=old.modules.map(m=>m.name==='worker.js'
  ?{...m,content_base64:Buffer.from(patched).toString('base64')}
  :m);
 const changed=modules.filter((m,i)=>hash711(bytes(m))!==hash711(bytes(old.modules[i])));
 check(changed.length===1&&changed[0].name==='worker.js','ONE_MODULE_ONLY');
 console.log('APP711_ACTIVE_MAIN_SHA_AND_ONLY_FOLLOW_GUARD_PATCH=PASS');
 const inherited=old.metadata.resources.bindings;
 check(inherited.find(x=>x.name==='SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653')?.text==='1','OWNER_GENERAL_ON');
 check(inherited.find(x=>x.name==='SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653')?.text==='preview-only','PREVIEW_FENCE');
 console.log('APP711_ACTIVE_WORKER_EXACT_SOURCE_ONE_MODULE_PREFLIGHT=PASS');
 if(process.argv[2]==='--preflight')return;
 // Do not perform a second mutation before the exact deployed target check.
 check(norm(await deployed(EX))===norm(beforePreview),'PRE_STAGE_DRIFT');
 const runtime=old.metadata.resources.script_runtime;
 const payload={main_module:'worker.js',
  compatibility_date:runtime.compatibility_date,compatibility_flags:runtime.compatibility_flags||[],
  annotations:{'workers/tag':'app711-follow-reservation-retry',
   'workers/message':'Preserve exact reservation identity across profile revisions'},
  bindings:inherited.map(binding=>({name:binding.name,type:'inherit',version_id:ACTIVE})),
  modules};
 const staged=await api('POST','workers/workers/'+EX+'/versions?deploy=false',payload);
 const next=String(staged.id||'');
 check(/^[a-f0-9-]{36}$/.test(next),'NEW_VERSION_ID');
 console.log('APP711_INACTIVE_STAGED='+next);
 await verifyStage(next,old,modules);
 check(norm(await deployed(EX))===norm(beforePreview),'PRE_ACTIVE_DRIFT');
 check(norm(await deployed(OW))===norm(ownerBefore),'OWNER_PRE_ACTIVE_DRIFT');
 for(let i=0;i<protectedNames.length;i++)
  check(norm(await deployed(protectedNames[i]))===norm(beforeProtected[i]),'PROTECTED_PRE_ACTIVE_'+protectedNames[i]);
 let activated=false;
 try{
  await api('POST','workers/scripts/'+EX+'/deployments',
   {strategy:'percentage',versions:afterPreview(next),
    annotations:{'workers/message':'APP711 PREVIEW exact reservation retry compatibility'}});
  activated=true;
  check(norm(await deployed(EX))===norm(afterPreview(next)),'ACTIVATED_VERSION');
  await verifyStage(next,old,modules);
  check(norm(await deployed(OW))===norm(ownerBefore),'OWNER_POST');
  for(let i=0;i<protectedNames.length;i++)
   check(norm(await deployed(protectedNames[i]))===norm(beforeProtected[i]),'PROTECTED_POST_'+protectedNames[i]);
 }catch(error){
  if(activated&&norm(await deployed(EX))===norm(afterPreview(next))){
   await api('POST','workers/scripts/'+EX+'/deployments',
    {strategy:'percentage',versions:beforePreview,
     annotations:{'workers/message':'APP711 automatic PREVIEW rollback on failed release'}});
   check(norm(await deployed(EX))===norm(beforePreview),'ROLLBACK_FAILED');
   console.error('APP711_POSTFLIGHT_ROLLED_BACK');
  }
  throw error;
 }
 writeFileSync('app711-worker-result.json',JSON.stringify({status:'PASS',source_parent:process.env.APP711_APPROVED_PARENT,
  previous:ACTIVE,active:next,owner:ownerBefore[0].version_id,changedModules:['worker.js']}));
 console.log('APP711_PREVIEW_WORKER_FOLLOW_503_STAGE_ACTIVE='+next);
 console.log('APP711_TEST_PRODUCTION_EXPLORE_DATA_UNCHANGED=PASS');
}
run().catch(error=>{console.error(String(error?.message||error).slice(0,1000));process.exitCode=2});

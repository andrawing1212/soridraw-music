// APP661: deploy one exact PREVIEW Worker module, preserve everything else.
// Existing general-owner follow relay, DO, Functions, D1/R2 data and TEST/PROD
// are immutable. New code has only one conditional bounded public-profile SELECT.
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {hash661,patchActiveProfileConnections661} from './lib/profile-connections-661.mjs';
import {sameStagedWorkerRuntime660} from './lib/owner-follow-general660.mjs';
const A='e1a30fc9ef497fda1d34f4ab3dc1da45';
const EX='soridraw-explore-preview',OW='soridraw-owner-follow-preview-candidate';
const ACTIVE='a2e6390d-c879-4e31-83e3-dee8046cb6ed';
const OW_ACTIVE='142e7005-cf9c-4cc7-88fc-a786a8d35058';
const ZERO='6b13cde4-4a53-42d2-873f-361f7cf5a931';
const check=(yes,why)=>{if(!yes)throw Error('APP661_PREVIEW_HOLD_'+why)};
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
const beforePreview=[{version_id:ACTIVE,percentage:100},{version_id:ZERO,percentage:0}];
const afterPreview=id=>[{version_id:id,percentage:100},{version_id:ZERO,percentage:0}];
const ownerBefore=[{version_id:OW_ACTIVE,percentage:100}];
async function snapshot(id){
 const [metadata,source]=await Promise.all([
  api('GET','workers/scripts/'+EX+'/versions/'+id),
  api('GET','workers/workers/'+EX+'/versions/'+id+'?include=modules')]);
 check(source.modules?.length===12,'MODULES_12');
 check(new Set(source.modules.map(m=>m.name)).size===12,'NO_DUPLICATE_MODULE');
 check(metadata?.resources?.bindings?.length===37,'BINDINGS_37');
 check(metadata.resources.script_runtime.compatibility_date==='2026-08-28','COMPAT_DATE');
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
  check(found&&hash661(bytes(found))===hash661(bytes(expected)),'SOURCE_DRIFT_'+expected.name);
 }
}
async function run(){
 check(process.argv[2]==='--preflight'||process.argv[2]==='--apply-once','MODE');
 check(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REF==='refs/heads/preview'&&
  process.env.CLOUDFLARE_ACCOUNT_ID===A&&/^[a-f0-9]{40}$/.test(process.env.APP661_APPROVED_PARENT||''),
  'RELEASE_CONTEXT');
 const protectedNames=['soridraw-explore-test','soridraw-explore-api'];
 const beforeProtected=await Promise.all(protectedNames.map(deployed));
 check(norm(await deployed(EX))===norm(beforePreview),'EXPLORE_ACTIVE_VERSION');
 check(norm(await deployed(OW))===norm(ownerBefore),'OWNER_ACTIVE_VERSION');
 const old=await snapshot(ACTIVE);
 const main=old.modules.find(m=>m.name==='preview-entry.mjs');
 check(main,'MAIN_BUNDLE');
 const patched=patchActiveProfileConnections661(bytes(main).toString('utf8'));
 // Syntax-check the exact real module without invoking Cloudflare bindings.
 const directory=mkdtempSync(join(tmpdir(),'app661-'));
 try {
  const file=join(directory,'preview-entry.mjs');
  writeFileSync(file,patched);
  execFileSync(process.execPath,['--check',file],{stdio:'pipe',timeout:20000});
 }finally{rmSync(directory,{recursive:true,force:true})}
 const modules=old.modules.map(m=>m.name==='preview-entry.mjs'
  ?{...m,content_base64:Buffer.from(patched).toString('base64')}
  :m);
 const changed=modules.filter((m,i)=>hash661(bytes(m))!==hash661(bytes(old.modules[i])));
 check(changed.length===1&&changed[0].name==='preview-entry.mjs','ONE_MODULE_ONLY');
 const inherited=old.metadata.resources.bindings;
 check(inherited.find(x=>x.name==='SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653')?.text==='1','OWNER_GENERAL_ON');
 check(inherited.find(x=>x.name==='SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653')?.text==='preview-only','PREVIEW_FENCE');
 console.log('APP661_ACTIVE_WORKER_EXACT_SOURCE_ONE_MODULE_PREFLIGHT=PASS');
 if(process.argv[2]==='--preflight')return;
 // Do not perform a second mutation before the exact deployed target check.
 check(norm(await deployed(EX))===norm(beforePreview),'PRE_STAGE_DRIFT');
 const runtime=old.metadata.resources.script_runtime;
 const payload={main_module:'owner-follow-entry-607.mjs',
  compatibility_date:runtime.compatibility_date,compatibility_flags:runtime.compatibility_flags||[],
  annotations:{'workers/tag':'app661-public-connection-fallback',
   'workers/message':'One conditional missing-public-profile list fallback'},
  bindings:inherited.map(binding=>({name:binding.name,type:'inherit',version_id:ACTIVE})),
  modules};
 const staged=await api('POST','workers/workers/'+EX+'/versions?deploy=false',payload);
 const next=String(staged.id||'');
 check(/^[a-f0-9-]{36}$/.test(next),'NEW_VERSION_ID');
 console.log('APP661_INACTIVE_STAGED='+next);
 await verifyStage(next,old,modules);
 check(norm(await deployed(EX))===norm(beforePreview),'PRE_ACTIVE_DRIFT');
 check(norm(await deployed(OW))===norm(ownerBefore),'OWNER_PRE_ACTIVE_DRIFT');
 for(let i=0;i<protectedNames.length;i++)
  check(norm(await deployed(protectedNames[i]))===norm(beforeProtected[i]),'PROTECTED_PRE_ACTIVE_'+protectedNames[i]);
 let activated=false;
 try{
  await api('POST','workers/scripts/'+EX+'/deployments',
   {strategy:'percentage',versions:afterPreview(next),
    annotations:{'workers/message':'APP661 PREVIEW bounded follow list fallback'}});
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
     annotations:{'workers/message':'APP661 automatic PREVIEW rollback after postflight failure'}});
   check(norm(await deployed(EX))===norm(beforePreview),'ROLLBACK_FAILED');
   console.error('APP661_POSTFLIGHT_ROLLED_BACK');
  }
  throw error;
 }
 writeFileSync('app661-worker-result.json',JSON.stringify({status:'PASS',source_parent:process.env.APP661_APPROVED_PARENT,
  previous:ACTIVE,active:next,owner:OW_ACTIVE,changedModules:['preview-entry.mjs']}));
 console.log('APP661_PREVIEW_WORKER_PUBLIC_R2_FALLBACK_ACTIVE='+next);
 console.log('APP661_TEST_PRODUCTION_OWNER_DATA_UNCHANGED=PASS');
}
run().catch(error=>{console.error(String(error?.message||error).slice(0,1000));process.exitCode=2});

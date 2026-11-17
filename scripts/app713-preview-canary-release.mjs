// APP713 canary-only PREVIEW release; no production/test deploy or D1/R2 edits.
// Stages new versions with exactly one runtime toggle, then activates owner
// and Explore. Roll back to pinned active versions on any failed postflight.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {APP713_EXTRA_MODULES,patchOwnerWorker713,patchExploreEntry713,
 patchExploreCanonicalExports713} from './lib/follow-server-owned-patch-713.mjs';
const A='e1a30fc9ef497fda1d34f4ab3dc1da45';
const CANARY='rcZ2GZrBndOZzT8C635eiNBjYIJ2';
const T=[
 {name:'soridraw-owner-follow-preview-candidate',main:'worker.js',baseCount:1,
  old:'1e987bc3-36d3-4bb0-861f-4df17f536592',stage:'c4b42dcc-606d-4ac4-a897-da8c6d95c604',
  extras:APP713_EXTRA_MODULES.owner},
 {name:'soridraw-explore-preview',main:'owner-follow-entry-607.mjs',baseCount:15,
  old:'a28c1391-1d98-41fb-b9c4-8f51aa19e0a0',stage:'44cd9dcc-38f9-42af-9596-89a2672f9e0f',
  extras:APP713_EXTRA_MODULES.explore},
];
const protectedNames=['soridraw-explore-api','soridraw-explore-test'];
const token=process.env.CLOUDFLARE_API_TOKEN;
const die=s=>{throw Error('APP713_CANARY_HOLD_'+s)};
const need=(v,s)=>{if(!v)die(s)};
const hash=s=>createHash('sha256').update(s).digest('hex');
const bytes=m=>Buffer.from(m.content_base64,'base64').toString('utf8');
const stable=versions=>JSON.stringify((versions||[]).map(({version_id,percentage})=>
 ({version_id,percentage})).sort((x,y)=>x.version_id.localeCompare(y.version_id)));
const expected=id=>stable([{version_id:id,percentage:100}]);
const bodyVersion=v=>[{version_id:v,percentage:100}];
const key=m=>new Map(m.map(x=>[x.name,x]));
const mode=process.argv[2];
need(['--activate','--rollback-if-owned'].includes(mode),'MODE');
need(process.env.GITHUB_ACTIONS==='true'&&
 process.env.GITHUB_REF==='refs/heads/fix/app713-server-owned-follow'&&
 typeof token==='string'&&token.length>24&&
 process.env.APP713_APPROVED_SHA===process.env.GITHUB_SHA,'PINNED_WORKFLOW');
async function cf(method,path,data){
 const resp=await fetch('https://api.cloudflare.com/client/v4/accounts/'+A+'/'+path,{
  method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  ...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(70000)});
 const json=await resp.json().catch(()=>null);
 need(resp.ok&&json?.success===true,'CF_'+method+'_'+resp.status+'_'+String(json?.errors?.[0]?.code||''));
 return json.result;
}
async function deployment(name){
 return (await cf('GET','workers/scripts/'+name+'/deployments?per_page=1'))
  ?.deployments?.[0]?.versions;
}
async function snapshot(name,id){
 const [meta,bundle]=await Promise.all([
  cf('GET','workers/scripts/'+name+'/versions/'+id),
  cf('GET','workers/workers/'+name+'/versions/'+id+'?include=modules'),
 ]);
 need(Array.isArray(bundle?.modules)&&Array.isArray(meta?.resources?.bindings),
  'SNAPSHOT_INCOMPLETE_'+name);
 return {meta,modules:bundle.modules,bindings:meta.resources.bindings};
}
function expectedSource(t,original){
 const modules=original.modules.map(m=>{
  let source=bytes(m);
  if(t.baseCount===1&&m.name==='worker.js')
   source=patchOwnerWorker713(source);
  if(t.baseCount===15){
   if(m.name==='owner-follow-entry-607.mjs')source=patchExploreEntry713(source);
   if(m.name==='preview-entry.mjs')source=patchExploreCanonicalExports713(source);
  }
  return {name:m.name,source};
 });
 for(const name of t.extras){
  modules.push({name,source:readFileSync('cloudflare/explore-worker/runtime/'+name.split('/').at(-1),'utf8')});
 }
 return modules;
}
async function stageOne(t){
 need(stable(await deployment(t.name))===expected(t.old),'ACTIVE_DRIFT_'+t.name);
 const [live,off]=await Promise.all([snapshot(t.name,t.old),snapshot(t.name,t.stage)]);
 need(live.modules.length===t.baseCount&&
   off.modules.length===t.baseCount+t.extras.length,
   'MODULE_COUNTS_'+t.name);
 const normal=key(live.bindings),disabled=key(off.bindings);
 need(normal.get('SORIDRAW_ENVIRONMENT')?.text==='preview'&&
  disabled.get('SORIDRAW_FOLLOW_SERVER_CLICK_713')?.text==='0'&&
  disabled.get('SORIDRAW_FOLLOW_CANARY_UID_713')?.text===CANARY&&
  disabled.size===normal.size+2,'OFF_PREVIEW_SCOPE_OR_BINDINGS_'+t.name);
 for(const [name,old] of normal)
  need(isDeepStrictEqual(old,disabled.get(name)),'ORIGINAL_BINDING_CHANGED_'+name);
 const source=expectedSource(t,live),offMap=key(off.modules);
 need(source.length===off.modules.length,'ORIGINAL_MODULE_COUNT_'+t.name);
 for(const m of source)need(hash(m.source)===hash(bytes(offMap.get(m.name)||{content_base64:''})),
  'OFF_SOURCE_DRIFT_'+m.name);
 // Cloudflare reports migration_tag only for an *already deployed* version.
 // An inactive staged version has no migration_tag by design. All other
 // runtime fields (including compatibility date and usage model) must match.
 const originalRuntime=live.meta.resources.script_runtime||{};
 const inactiveRuntime=off.meta.resources.script_runtime||{};
 const {migration_tag:appliedTag,...baselineRuntime}=originalRuntime;
 need(appliedTag===(t.baseCount===1?'owner600_v1':'v1')&&
  isDeepStrictEqual(baselineRuntime,inactiveRuntime),
  'REAL_RUNTIME_DRIFT_'+t.name);
 // The old and new bundles share exact modules, secrets, bindings and DO
 // namespaces. The ONLY configuration difference is this click route flag.
 const runtime=off.meta.resources.script_runtime;
 const payload={
  main_module:t.main,
  compatibility_date:runtime.compatibility_date,
  compatibility_flags:runtime.compatibility_flags||[],
  annotations:{'workers/tag':'app713-preview-canary',
   'workers/message':'APP713 one-canary user only; original bindings preserved'},
  bindings:[...off.bindings.filter(x=>x.name!=='SORIDRAW_FOLLOW_SERVER_CLICK_713')
    .map(x=>({name:x.name,type:'inherit',version_id:t.stage})),
    {name:'SORIDRAW_FOLLOW_SERVER_CLICK_713',type:'plain_text',text:'1'}],
  modules:off.modules.map(m=>({name:m.name,
   content_type:m.content_type||'application/javascript+module',
   content_base64:m.content_base64})),
 };
 const newVersion=await cf('POST','workers/workers/'+t.name+'/versions?deploy=false',payload);
 const next=String(newVersion?.id||'');
 need(/^[0-9a-f-]{36}$/.test(next),'NEW_VERSION_INVALID_'+t.name);
 // Cloudflare can return 100146 for a version immediately after POST.
 // Retry ONLY this documented eventual-consistency case, bounded to ~17s.
 let after=null;
 for(let attempt=0;attempt<7;attempt++){
  try{after=await snapshot(t.name,next);break}
  catch(error){
   const message=String(error?.message||error);
   if(!message.includes('CF_GET_404_100146')||attempt===6)throw error;
   await new Promise(resolve=>setTimeout(resolve,350*(2**attempt)));
  }
 }
 need(after!==null,'NEW_VERSION_NOT_READABLE_'+t.name);
 const a=key(after.bindings),m=key(after.modules);
 need(after.modules.length===off.modules.length&&
   a.size===off.bindings.length&&
   a.get('SORIDRAW_FOLLOW_SERVER_CLICK_713')?.text==='1'&&
   a.get('SORIDRAW_FOLLOW_CANARY_UID_713')?.text===CANARY,
   'NEW_VERSION_SCOPE_'+t.name);
 for(const binding of off.bindings){
  if(binding.name==='SORIDRAW_FOLLOW_SERVER_CLICK_713')continue;
  need(isDeepStrictEqual(a.get(binding.name),binding),
    'NEW_VERSION_BINDING_DRIFT_'+binding.name);
 }
 for(const module of off.modules)
  need(hash(bytes(m.get(module.name)||{content_base64:''}))===hash(bytes(module)),
   'NEW_VERSION_MODULE_DRIFT_'+module.name);
 need(stable(await deployment(t.name))===expected(t.old),
  'ACTIVE_MOVED_DURING_STAGE_'+t.name);
 return {...t,next};
}
async function rollbackFromArtifact(){
 if(!existsSync('app713-canary-prepared.json'))return;
 const recorded=JSON.parse(readFileSync('app713-canary-prepared.json','utf8'));
 need(recorded?.sha===process.env.GITHUB_SHA,'ROLLBACK_ARTIFACT_SHA');
 for(const t of [...T].reverse()){
  const next=recorded.versions?.find(v=>v.name===t.name)?.next;
  if(!next)continue;
  const live=stable(await deployment(t.name));
  if(live===expected(t.old))continue;
  need(live===expected(next),'ROLLBACK_CONCURRENT_RELEASE_'+t.name);
  await cf('POST','workers/scripts/'+t.name+'/deployments',{
   strategy:'percentage',versions:bodyVersion(t.old),
   annotations:{'workers/message':'APP713 automatic canary rollback to exact pre-release version'},
  });
  need(stable(await deployment(t.name))===expected(t.old),
   'ROLLBACK_NOT_CONFIRMED_'+t.name);
 }
 console.log('APP713_EXACT_PREVIEW_WORKERS_ROLLBACK_VERIFIED=PASS');
}
async function main(){
 if(mode==='--rollback-if-owned'){await rollbackFromArtifact();return}
 const originalProtected=await Promise.all(protectedNames.map(deployment));
 const list=[];
 try{
  for(const t of T){
   for(const other of T)
    need(stable(await deployment(other.name))===expected(other.old),
     'PRE_STAGE_ACTIVE_DRIFT_'+other.name);
   for(let i=0;i<protectedNames.length;i++)
    need(stable(await deployment(protectedNames[i]))===stable(originalProtected[i]),
     'PROTECTED_PRE_STAGE_DRIFT_'+protectedNames[i]);
   list.push(await stageOne(t));
  }
  writeFileSync('app713-canary-prepared.json',JSON.stringify({
   sha:process.env.GITHUB_SHA,versions:list.map(({name,old,next})=>({name,old,next})),
  },null,2));
  console.log('APP713_CANARY_WORKERS_NEW_VERSIONS_PREPARED_INACTIVE=PASS');
  for(const t of list){
   need(stable(await deployment(t.name))===expected(t.old),'PRE_DEPLOY_DRIFT_'+t.name);
   await cf('POST','workers/scripts/'+t.name+'/deployments',{
    strategy:'percentage',versions:bodyVersion(t.next),
    annotations:{'workers/message':'APP713 exact PREVIEW single-actor canary release'},
   });
   need(stable(await deployment(t.name))===expected(t.next),
    'POST_DEPLOY_NOT_EXACT_'+t.name);
  }
  for(let i=0;i<protectedNames.length;i++)
   need(stable(await deployment(protectedNames[i]))===stable(originalProtected[i]),
    'TEST_PROD_DEPLOYMENT_CHANGED');
  // The original Durable Object migration tag must still be applied
  // after deployment. No new migration declaration is submitted.
  for(const t of list){
   const current=await snapshot(t.name,t.next);
   const tag=current.meta?.resources?.script_runtime?.migration_tag;
   need(tag===(t.baseCount===1?'owner600_v1':'v1'),
    'DO_MIGRATION_TAG_NOT_PRESERVED_'+t.name);
  }

  const url='https://soridraw-explore-preview.andrawing1212.workers.dev'+
   '/v1/profiles/synthetic_owner_B/follow-click-713';
  const options=await fetch(url,{method:'OPTIONS',headers:{
   Origin:'https://preview.soridraw.com',
   'Access-Control-Request-Method':'POST',
   'Access-Control-Request-Headers':'authorization, content-type, x-firebase-appcheck',
  },signal:AbortSignal.timeout(18000)});
  need(options.status===204,'CORS_OPTIONS_NOT_204_'+options.status);
  const unauth=await fetch(url,{method:'POST',headers:{
   Origin:'https://preview.soridraw.com','Content-Type':'application/json',
   Authorization:'Bearer unauthorized','X-Firebase-AppCheck':'unauthorized',
  },body:JSON.stringify({following:true,deviceId:'device713_dummy',sequence:1}),
   signal:AbortSignal.timeout(18000)});
  need(unauth.status===401||unauth.status===403,
   'UNAUTHENTICATED_POST_NOT_DENIED_'+unauth.status);
  for(const t of list)need(stable(await deployment(t.name))===expected(t.next),
   'FINAL_PREVIEW_ACTIVE_DRIFT_'+t.name);
  writeFileSync('app713-canary-live-result.json',JSON.stringify({
   status:'PASS',sha:process.env.GITHUB_SHA,
   versions:list.map(({name,old,next})=>({name,old,next})),
   canaryUid:CANARY,optionsStatus:204,unauthorizedStatus:unauth.status,
   userDataWrites:0,hostingDeployed:false,otherWorkerChanges:0,
  },null,2));
  console.log('APP713_ONLY_SINGLE_ACTOR_PREVIEW_WORKER_ROUTES_LIVE=PASS');
  console.log('APP713_CORS_AND_UNAUTHENTICATED_REQUEST_DENIAL=PASS');
 }catch(error){
  console.error(String(error?.message||error).slice(0,400));
  try{await rollbackFromArtifact()}
  catch(e){console.error('APP713_ROLLBACK_HOLD_'+String(e?.message||e).slice(0,350))}
  process.exitCode=2;
 }
}
main().catch(e=>{console.error(String(e?.message||e).slice(0,450));process.exitCode=2});

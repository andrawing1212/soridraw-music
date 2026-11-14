// Clone current deployed modules; no wrangler migrations or canonical rebuild.
import {readFileSync,writeFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {hash660,patchExplore660,patchOwner660,patchEnrollment660} from './lib/owner-follow-general660.mjs';
const A='e1a30fc9ef497fda1d34f4ab3dc1da45';
const EX='soridraw-explore-preview',OW='soridraw-owner-follow-preview-candidate';
const ZERO='6b13cde4-4a53-42d2-873f-361f7cf5a931';
const targets=[
 {name:EX,old:'02576623-2172-4922-85b8-3f08a5216653',count:35,modules:12,main:'owner-follow-entry-607.mjs',
  // Previously staged by approved APP660 run #43614246553, traffic 0%.
  // A subsequent read-only inventory #43614801284 verified all 12 modules.
  resume:'a2e6390d-c879-4e31-83e3-dee8046cb6ed'},
 {name:OW,old:'e679a602-44fb-4b4d-9e4d-7878c00b68c3',count:7,modules:1,main:'worker.js'},
];
const flags={SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653:'1',SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653:'preview-only'};
const check=(v,m)=>{if(!v)throw Error('APP660_WORKER_HOLD_'+m)};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(method,path,body){
 const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${A}/${path}`,{
  method,headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},
  ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(90000)});
 const j=await r.json();check(r.ok&&j.success===true,`API_${method}_${r.status}_${JSON.stringify(j.errors||[]).slice(0,500)}`);return j.result;
}
async function deployed(name){return (await api('GET',`workers/scripts/${name}/deployments?per_page=1`))?.deployments?.[0]?.versions}
const expected=(t,id)=>t.name===EX?[{version_id:id,percentage:100},{version_id:ZERO,percentage:0}]:[{version_id:id,percentage:100}];
const stable=vs=>JSON.stringify(vs?.map(({version_id,percentage})=>({version_id,percentage})).sort((a,b)=>a.version_id.localeCompare(b.version_id)));
async function snapshot(t,id){
 const [meta,source]=await Promise.all([
  api('GET',`workers/scripts/${t.name}/versions/${id}`),
  api('GET',`workers/workers/${t.name}/versions/${id}?include=modules`)]);
 check(source.modules?.length===t.modules,'MODULE_COUNT_'+t.name);
 const modules=source.modules.map(m=>({name:m.name,content_type:m.content_type||'application/javascript+module',content_base64:m.content_base64}));
 check(new Set(modules.map(m=>m.name)).size===t.modules,'DUPLICATE_MODULE');
 check(modules.some(m=>m.name===t.main),'MAIN_MODULE');
 const bindings=meta.resources.bindings;
 check(new Set(bindings.map(b=>b.name)).size===bindings.length,'DUPLICATE_BINDING');
 check(meta.resources.script_runtime.compatibility_date==='2026-08-28','RUNTIME');
 return {meta,bindings,modules};
}
const text=m=>Buffer.from(m.content_base64,'base64').toString('utf8');
function patched(t,files){
 return files.map(m=>{
  let code=text(m);
  if(t.name===OW)code=patchOwner660(code);
  else if(m.name===t.main)code=patchExplore660(code);
  else if(m.name.endsWith('/owner-follow-enrollment-544.mjs'))code=patchEnrollment660(code);
  return {...m,content_base64:Buffer.from(code).toString('base64')};
 });
}
async function verify(t,id,old,modules){
 const next=await snapshot(t,id);
 check(next.bindings.length===t.count+2,'STAGED_BINDING_COUNT');
 const map=new Map(next.bindings.map(b=>[b.name,b]));
 for(const b of old.bindings)check(isDeepStrictEqual(map.get(b.name),b),'EXISTING_BINDING_CHANGED_'+b.name);
 for(const [name,value] of Object.entries(flags))check(map.get(name)?.type==='plain_text'&&map.get(name)?.text===value,'FLAGS');
 for(const m of modules){const after=next.modules.find(x=>x.name===m.name);check(after&&hash660(Buffer.from(after.content_base64,'base64'))===hash660(Buffer.from(m.content_base64,'base64')),'MODULE_HASH_'+m.name)}
 check(isDeepStrictEqual(next.meta.resources.script_runtime,old.meta.resources.script_runtime),'RUNTIME_CHANGED');
}
// Cloudflare version modules can be temporarily absent just after an upload.
// The 2026-11-14 APP660 stage returned MODULE_COUNT for ~75 seconds, while
// a later GET confirmed the complete 12-module version. Only that transient
// response may retry; hashes, bindings, runtime and protected deployments
// must still match exactly or fail immediately.
async function verifyStagedSource(t,id,old,modules){
 for(let attempt=0;attempt<72;attempt++){
  try{await verify(t,id,old,modules);return}
  catch(error){
   const reason=String(error?.message||error);
   if(!reason.startsWith('APP660_WORKER_HOLD_MODULE_COUNT_')||attempt===71)
    throw error;
   if(attempt===0)console.log('APP660_STAGED_SOURCE_PENDING='+t.name+';version='+id);
   await sleep(5000);
  }
 }
}
async function run(){
 check(['--apply-once','--preflight'].includes(process.argv[2]),'MODE');
 check(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REF==='refs/heads/preview'&&process.env.CLOUDFLARE_ACCOUNT_ID===A&&/^[0-9a-f]{40}$/.test(process.env.APP660_APPROVED_PARENT||''),'APPROVED_CONTEXT');
 if(process.argv[2]==='--apply-once'){
  const result=JSON.parse(readFileSync('app660-functions-result.json','utf8'));
  check(result.status==='PASS'&&result.source_parent===process.env.APP660_APPROVED_PARENT&&result.functions?.length===3,'FUNCTIONS_FIRST');
 }
 const protectedNames=['soridraw-explore-test','soridraw-explore-api'];
 const protectedBefore=await Promise.all(protectedNames.map(deployed));
 for(const t of targets){
  check(stable(await deployed(t.name))===stable(expected(t,t.old)),'ACTIVE_DRIFT_'+t.name);
  t.before=await snapshot(t,t.old);
  check(t.before.bindings.length===t.count,'BINDING_COUNT');
  const b=new Map(t.before.bindings.map(x=>[x.name,x]));
  check(b.get('SORIDRAW_ENVIRONMENT')?.text==='preview','ENVIRONMENT');
  check(Object.keys(flags).every(k=>!b.has(k)),'FLAGS_ALREADY_PRESENT');
  if(t.name===EX){
   check(b.get('SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607')?.text==='1'&&b.get('SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607')?.text==='1','BRIDGE_READY');
   check(b.get('OWNER_FOLLOW_RESERVATION_SERVICE_600')?.service===OW,'OWNER_SERVICE');
   check(b.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.class_name==='ExploreLikeBatchScheduler103','LIKE_DO');
   check(text(t.before.modules.find(m=>m.name==='preview-entry.mjs')).includes('RETURNING 1 AS relation_changed'),'CANONICAL_FIX');
   const replay=t.before.modules.find(m=>m.name.endsWith('/owner-follow-service-601.mjs'));
   check(replay&&hash660(text(replay))===hash660(readFileSync('scripts/fixtures/owner-follow660/owner-follow-service-601.mjs','utf8')),'REPLAY_SOURCE');
   check(t.before.modules.filter(m=>m.name.endsWith('/owner-follow-enrollment-544.mjs')).length===1,'ENROLLMENT_MODULE');
  }else{
   check(b.get('OWNER_FOLLOW_DO_600')?.class_name==='OwnerFollowerStandalone600','OWNER_DO');
   check(b.get('OWNER_FOLLOW_CANONICAL_REPLAY_600')?.entrypoint==='OwnerFollowReplayEntrypoint607','PRIVATE_REPLAY');
  }
  t.modules=patched(t,t.before.modules);
  // Verify the already uploaded version before any remaining mutation.
  // A mismatching or overwritten candidate is a hard HOLD, not a new upload.
  if(t.resume){
   await verify(t,t.resume,t.before,t.modules);
   console.log('APP660_REUSABLE_INACTIVE_EXACT_SOURCE='+t.name+';version='+t.resume);
  }
 }
 if(process.argv[2]==='--preflight'){console.log('APP660_WORKER_EXACT_ACTIVE_SOURCE_PREFLIGHT=PASS');return}
 for(const t of targets){
  if(t.resume){
   t.new=t.resume;
   console.log('APP660_REUSE_INACTIVE_STAGED='+t.name+';version='+t.new);
   continue;
  }
  const payload={main_module:t.main,compatibility_date:'2026-08-28',compatibility_flags:t.before.meta.resources.script_runtime.compatibility_flags||[],
   annotations:{'workers/tag':'app660-preview-general-owner','workers/message':'APP660 existing owner relay for all PREVIEW principals; canonical unchanged'},
   bindings:[...t.before.bindings.map(b=>({name:b.name,type:'inherit',version_id:t.old})),...Object.entries(flags).map(([name,text])=>({name,type:'plain_text',text}))],modules:t.modules};
  const staged=await api('POST',`workers/workers/${t.name}/versions?deploy=false`,payload);
  t.new=staged.id;check(/^[a-f0-9-]{36}$/.test(t.new),'STAGED_ID');
  console.log('APP660_INACTIVE_STAGED='+t.name+';version='+t.new);
  await verifyStagedSource(t,t.new,t.before,t.modules);
 }
 for(const t of targets)check(stable(await deployed(t.name))===stable(expected(t,t.old)),'PRE_ACTIVATION_DRIFT');
 for(let i=0;i<protectedNames.length;i++)check(stable(await deployed(protectedNames[i]))===stable(protectedBefore[i]),'PROTECTED_DRIFT');
 // Owner accepts general reservations before the Explore wrapper starts sending.
 // No synthetic user writes and no pending queue deletion on a deployment error.
 for(const t of [...targets].reverse()){
  await api('POST',`workers/scripts/${t.name}/deployments`,{strategy:'percentage',versions:expected(t,t.new),annotations:{'workers/message':'APP660 PREVIEW general owner relay'}});
  check(stable(await deployed(t.name))===stable(expected(t,t.new)),'ACTIVE_POSTFLIGHT_'+t.name);
  await verify(t,t.new,t.before,t.modules);
  console.log('APP660_WORKER_ACTIVE='+t.name+';version='+t.new);
 }
 for(let i=0;i<protectedNames.length;i++)check(stable(await deployed(protectedNames[i]))===stable(protectedBefore[i]),'PROTECTED_POSTFLIGHT');
 writeFileSync('app660-workers-result.json',JSON.stringify({status:'PASS',source_parent:process.env.APP660_APPROVED_PARENT,workers:targets.map(t=>({name:t.name,version:t.new,previous:t.old}))}));
 console.log('APP660_WORKERS_GENERAL_PREVIEW_ACTIVE_PROTECTED_TEST_PROD_UNCHANGED=PASS');
}
run().catch(e=>{console.error(String(e.message).slice(0,1500));process.exitCode=2});

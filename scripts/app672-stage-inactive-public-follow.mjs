// APP672: PREVIEW only, stage a ZERO-traffic candidate with exact active
// Cloudflare Worker modules. Never change deployments/aliases/DO migrations.
// Fail closed on any drift in active source, bindings, runtime or protections.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {patchOwnerServiceDualAck671} from './lib/public-follow-active-patch-671.mjs';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const PREVIEW='soridraw-explore-preview';
const OWNER='soridraw-owner-follow-preview-candidate';
const PROTECTED=['soridraw-explore-test','soridraw-explore-api'];
const REQUIRED_PREVIEW='88e89c7a-d07c-426f-89ff-461b87fbf0fc';
const REQUIRED_OWNER='142e7005-cf9c-4cc7-88fc-a786a8d35058';
const EXISTING_MODULES=12;
const SOURCE_SERVICE='app605/owner-follow-service-601.mjs';
const MODULE_ROOT='app605/';
const BINDING_COUNT=37;
const UID=(x)=>typeof x==='string'&&/^[a-f0-9-]{36}$/.test(x);
const die=(cond,msg)=>{if(!cond)throw Error('APP672_HOLD_'+msg)};
const sha=s=>createHash('sha256').update(s).digest('hex');
const stable=v=>JSON.stringify(v?.map(x=>({
 version_id:x.version_id,percentage:x.percentage,
})).sort((a,b)=>a.version_id.localeCompare(b.version_id)));
const API='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/';
async function api(method,url,body){
 const response=await fetch(API+url,{
  method,headers:{
   Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,
   'Content-Type':'application/json',
  },...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(90000),
 });
 const json=await response.json();
 die(response.ok&&json.success===true,'API_'+method+'_'+response.status+'_'+
  JSON.stringify(json.errors||[]).slice(0,250));
 return json.result;
}
const deploy=name=>api('GET','workers/scripts/'+name+'/deployments?per_page=1')
 .then(d=>d?.deployments?.[0]?.versions);
const snap=async(id)=>{
 const [meta,source]=await Promise.all([
  api('GET','workers/scripts/'+PREVIEW+'/versions/'+id),
  api('GET','workers/workers/'+PREVIEW+'/versions/'+id+'?include=modules'),
 ]);
 die(source?.modules?.length>0,'MODULES_MISSING');
 return {meta,modules:source.modules,bindings:meta.resources.bindings};
};
const source=m=>Buffer.from(m.content_base64,'base64').toString('utf8');
const newSources=[
 ['public-follow-dual-ack-671.mjs','cloudflare/explore-worker/runtime/public-follow-dual-ack-671.mjs'],
 ['public-follow-http-669.mjs','cloudflare/explore-worker/runtime/public-follow-http-669.mjs'],
 ['public-follow-proven-pair-669.mjs','cloudflare/explore-worker/runtime/public-follow-proven-pair-669.mjs'],
];
async function main(){
 die(process.argv[2]==='--stage-inactive','MODE');
 die(process.env.GITHUB_ACTIONS==='true'&&
  process.env.GITHUB_REF==='refs/heads/preview'&&
  process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT&&
  process.env.GITHUB_SHA===process.env.APP672_APPROVED_SHA&&
  /^[0-9a-f]{40}$/.test(process.env.APP672_APPROVED_SHA||''),'WORKFLOW_CONTEXT');
 die(typeof process.env.CLOUDFLARE_API_TOKEN==='string'&&
  process.env.CLOUDFLARE_API_TOKEN.length>20,'CF_TOKEN_UNAVAILABLE');
 const before={};
 for(const n of [PREVIEW,OWNER,...PROTECTED])before[n]=await deploy(n);
 die(before[PREVIEW]?.some(x=>x.version_id===REQUIRED_PREVIEW&&x.percentage===100),
  'ACTIVE_PREVIEW_DRIFT');
 die(before[OWNER]?.some(x=>x.version_id===REQUIRED_OWNER&&x.percentage===100),
  'ACTIVE_OWNER_DRIFT');
 const old=await snap(REQUIRED_PREVIEW);
 die(old.modules.length===EXISTING_MODULES,'ACTIVE_MODULE_COUNT');
 die(old.bindings.length===BINDING_COUNT,'ACTIVE_BINDING_COUNT');
 die(old.modules.some(m=>m.name==='owner-follow-entry-607.mjs'),'ACTIVE_ENTRY');
 die(old.bindings.some(b=>b.name==='SORIDRAW_ENVIRONMENT'&&b.text==='preview'),
  'WRONG_ENVIRONMENT');
 die(new Set(old.modules.map(m=>m.name)).size===EXISTING_MODULES,'DUPLICATE_MODULE');
 const current=old.modules.find(m=>m.name===SOURCE_SERVICE);
 die(!!current,'SERVICE_MODULE_MISSING');
 const patched=patchOwnerServiceDualAck671(source(current));
 const modules=old.modules.map(m=>m.name===SOURCE_SERVICE
  ? {...m,content_base64:Buffer.from(patched).toString('base64')}:m);
 const expected=new Map(modules.map(m=>[m.name,sha(source(m))]));
 for(const [name,path] of newSources){
  const source=readFileSync(path,'utf8');
  const pathName=MODULE_ROOT+name;
  die(!expected.has(pathName),'MODULE_ALREADY_PRESENT');
  expected.set(pathName,sha(source));
  modules.push({name:pathName,content_type:'application/javascript+module',
   content_base64:Buffer.from(source).toString('base64')});
 }
 die(modules.length===EXISTING_MODULES+3,'CANDIDATE_MODULE_COUNT');
 die(!modules.some(m=>m.name==='worker.js'),'OWNER_WORKER_STAGING_FORBIDDEN');
 for(const m of old.modules){
  if(m.name===SOURCE_SERVICE)continue;
  die(sha(source(m))===expected.get(m.name),'OLD_MODULE_DRIFT_'+m.name);
 }
 // Stop before any mutation if the protected deployments changed.
 for(const n of [PREVIEW,OWNER,...PROTECTED])
  die(stable(await deploy(n))===stable(before[n]),'PREFLIGHT_TRAFFIC_DRIFT_'+n);
 const runtime=old.meta.resources.script_runtime;
 die(runtime.compatibility_date==='2026-08-28','RUNTIME_DRIFT');
 const payload={
  main_module:'owner-follow-entry-607.mjs',
  compatibility_date:runtime.compatibility_date,
  compatibility_flags:runtime.compatibility_flags||[],
  annotations:{
   'workers/tag':'app672-preview-public-follow-inactive',
   'workers/message':'APP672 exact owner replay dual ACK source, all public gates OFF, 0 traffic',
  },
  bindings:old.bindings.map(b=>({name:b.name,type:'inherit',version_id:REQUIRED_PREVIEW})),
  modules,
 };
 // This creates a candidate VERSION but never changes live traffic.
 const created=await api('POST','workers/workers/'+PREVIEW+'/versions?deploy=false',payload);
 die(UID(created?.id),'CANDIDATE_ID_INVALID');
 const after=await snap(created.id);
 die(after.modules.length===EXISTING_MODULES+3,'STAGED_MODULES_MISSING');
 die(after.bindings.length===BINDING_COUNT,'STAGED_BINDINGS_DRIFT');
 for(const original of old.bindings){
  const candidate=after.bindings.find(b=>b.name===original.name);
  die(isDeepStrictEqual(candidate,original),'BINDING_CHANGED_'+original.name);
 }
 for(const m of after.modules)die(sha(source(m))===expected.get(m.name),
  'STAGED_SOURCE_HASH_'+m.name);
 const stagedRuntime=after.meta.resources.script_runtime;
 die(stagedRuntime.compatibility_date===runtime.compatibility_date&&
   isDeepStrictEqual(stagedRuntime.compatibility_flags||[],runtime.compatibility_flags||[]),
  'STAGED_RUNTIME_CHANGED');
 for(const n of [PREVIEW,OWNER,...PROTECTED])
  die(stable(await deploy(n))===stable(before[n]),'POSTFLIGHT_TRAFFIC_DRIFT_'+n);
 writeFileSync('app672-inactive-result.json',JSON.stringify({
  status:'PASS',source:process.env.APP672_APPROVED_SHA,
  active:REQUIRED_PREVIEW,inactive:created.id,modules:after.modules.length,
  trafficChanged:false,ownerChanged:false,productionChanged:false,
 }));
 console.log('APP672_INACTIVE_PREVIEW_CANDIDATE='+created.id);
 console.log('APP672_ORIGINAL_ACTIVE_PREVIEW='+REQUIRED_PREVIEW);
 console.log('APP672_EXISTING_BINDINGS_UNCHANGED=PASS');
 console.log('APP672_ALL_OLD_SOURCE_MODULES_EXCEPT_SERVICE_IDENTICAL=PASS');
 console.log('APP672_OWNER_TEST_PRODUCTION_DEPLOYMENTS_UNCHANGED=PASS');
 console.log('APP672_PUBLIC_FOLLOW_GATES_COMPILED_OFF=PASS');
 console.log('APP672_PUBLIC_WORKER_STAGE_INACTIVE_ONLY=PASS');
}
main().catch(error=>{console.error(String(error.message).slice(0,1000));process.exitCode=2});

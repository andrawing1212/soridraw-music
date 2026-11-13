// APP613: one-shot INACTIVE service-binding candidate based on exact APP612 bytes.
// Does not deploy, configure shared secrets/vars, migrate DO classes or touch data.
import {createHash} from 'node:crypto';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const WORKER='soridraw-explore-preview';
const STABLE='350ce33d-ec83-49d0-a4ae-c25d2d90f59e';
const SOURCE='3fd8618a-4359-4df4-aeb0-c17abc06b90e';
const TARGET='soridraw-owner-follow-preview-candidate';
const BRANCH='refs/heads/feat/app600-owner-standalone-isolated';
const need=(condition,msg)=>{if(!condition)throw Error('APP613_HOLD_'+msg)};
const sha=data=>createHash('sha256').update(data).digest('hex');
async function get(path,token){
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path,{
  method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},
  signal:AbortSignal.timeout(25000)});
 need(response.ok,'GET_HTTP_'+response.status);
 const value=await response.json();need(value.success===true,'GET_RESULT');
 return value.result;
}
const root='workers/scripts/'+WORKER;
async function assertActive(token){
 const list=await get(root+'/deployments?per_page=1',token);
 const versions=list?.deployments?.[0]?.versions;
 need(Array.isArray(versions)&&versions.length===1&&
  versions[0].version_id===STABLE&&Number(versions[0].percentage)===100,
  'STABLE_DEPLOYMENT_CHANGED');
}
function allBindings(rows,size=23){
 need(Array.isArray(rows)&&rows.length===size,'BINDING_COUNT_'+size);
 const b=new Map(rows.map(x=>[x.name,x]));
 need(b.size===rows.length,'DUPLICATE_BINDING');
 need(b.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.class_name==='ExploreLikeBatchScheduler103','LIKE_DO_CHANGED');
 need(!b.has('OWNER_FOLLOW_RECOVERY_557'),'UNSAFE_OWNER_V2');
 need(b.get('SORIDRAW_ENVIRONMENT')?.text==='preview','WRONG_ENVIRONMENT');
 return b;
}
function originalMatch(before,after){
 for(const [name,x] of before){
  const y=after.get(name);
  need(y?.type===x.type,'BINDING_CHANGED_'+name);
  if(x.type==='d1')need((y.id||y.database_id||y.uuid)===(x.id||x.database_id||x.uuid),'D1_DRIFT_'+name);
  if(x.type==='r2_bucket')need((y.bucket_name||y.bucket)===(x.bucket_name||x.bucket),'R2_DRIFT_'+name);
  if(x.type==='durable_object_namespace')need(y.class_name===x.class_name,'DO_DRIFT_'+name);
 }
}
async function run(){
 need(process.env.GITHUB_REF===BRANCH,'WRONG_BRANCH');
 need(process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT,'WRONG_ACCOUNT');
 need(process.env.APP613_APPROVED_PARENT?.match(/^[a-f0-9]{40}$/),'TRIGGER_NOT_LOCKED');
 const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
 need(token.length>15,'MISSING_CF_TOKEN');
 await assertActive(token);
 const stable=await get(root+'/versions/'+STABLE,token);
 const base=allBindings(stable?.resources?.bindings);
 need(stable.resources?.script_runtime?.compatibility_date==='2026-08-28'&&
  stable.resources.script_runtime.migration_tag==='v1','STABLE_RUNTIME_DRIFT');
 const settings=allBindings((await get(root+'/settings',token))?.bindings);
 originalMatch(base,settings);
 const pinned=await get(root+'/versions/'+SOURCE,token);
 originalMatch(base,allBindings(pinned?.resources?.bindings));
 const actual=await get('workers/workers/'+WORKER+'/versions/'+SOURCE+'?include=modules',token);
 const modules=actual?.modules;
 need(Array.isArray(modules)&&modules.length===12,'EXACT_12_MODULES_REQUIRED');
 const moduleNames=new Set(modules.map(x=>x.name));
 need(moduleNames.size===12&&moduleNames.has('owner-follow-entry-607.mjs')&&
  moduleNames.has('preview-entry.mjs')&&
  moduleNames.has('app607/owner-follow-enrollment-544.mjs')&&
  moduleNames.has('app607/owner-follow-current-auth-547.mjs'),'APP612_MODULE_GRAPH_DRIFT');
 const prepared=modules.map(part=>{
  need(typeof part.content_base64==='string'&&part.content_base64.length>100,'MISSING_MODULE_BYTES');
  return {name:part.name,content_type:'application/javascript+module',
   content_base64:part.content_base64};
 });
 // Candidate is immutable: identical source, 23 version-pinned inherited
 // bindings plus just one inactive, private service binding to existing OFF Worker.
 const payload={
  main_module:'owner-follow-entry-607.mjs',
  compatibility_date:'2026-08-28',
  compatibility_flags:stable.resources.script_runtime.compatibility_flags||[],
  annotations:{'workers/message':'APP613 add OFF owner private reservation service binding, NOT DEPLOYED',
   'workers/tag':'app613-nondeployed-private-binding'},
  bindings:[
   ...[...base.keys()].sort().map(name=>({name,type:'inherit',version_id:STABLE})),
   {name:'OWNER_FOLLOW_RESERVATION_SERVICE_600',type:'service',service:TARGET},
  ],
  modules:prepared,
 };
 need(payload.bindings.length===24&&
  payload.bindings.filter(x=>x.type==='service').length===1&&
  !('migrations' in payload)&&!('exports' in payload),'UNSAFE_BINDING_PAYLOAD');
 await assertActive(token);
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+
  '/workers/workers/'+WORKER+'/versions?deploy=false',{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify(payload),signal:AbortSignal.timeout(50000)});
 let answer;
 try{answer=await response.json()}catch{throw Error('APP613_UNCERTAIN_UPLOAD_NO_RETRY')}
 if(!response.ok||answer?.success!==true){
  const codes=(answer?.errors||[]).map(e=>e.code).join(',');
  console.log('APP613_REMOTE_ERROR_CODES='+codes.slice(0,100));
  throw Error('APP613_UPLOAD_HTTP_'+response.status+'_NO_RETRY');
 }
 const created=String(answer.result?.id||'');
 need(/^[a-f0-9-]{36}$/.test(created)&&created!==SOURCE,'VERSION_ID_BAD');
 console.log('APP613_NEW_UNUSED_VERSION='+created);
 const [v,code]=await Promise.all([
  get(root+'/versions/'+created,token),
  get('workers/workers/'+WORKER+'/versions/'+created+'?include=modules',token),
 ]);
 const after=allBindings(v.resources.bindings,24);
 originalMatch(base,after);
 const binding=after.get('OWNER_FOLLOW_RESERVATION_SERVICE_600');
 need(binding?.type==='service'&&binding?.service===TARGET&&!binding.entrypoint,
  'OWNER_SERVICE_BINDING_DRIFT');
 need(v.resources.script_runtime?.compatibility_date==='2026-08-28'&&
  (!v.resources.script_runtime?.migration_tag||
   v.resources.script_runtime?.migration_tag==='v1'),'RUNTIME_OR_LIFECYCLE_DRIFT');
 need(Array.isArray(code?.modules)&&code.modules.length===12,'MODULES_MISSING');
 const originalHashes=new Map(prepared.map(m=>[m.name,sha(Buffer.from(m.content_base64,'base64'))]));
 for(const module of code.modules)
  need(originalHashes.get(module.name)===sha(Buffer.from(module.content_base64||'','base64')),
   'MODULE_BYTES_CHANGED_'+module.name);
 await assertActive(token);
 console.log('APP613_23_EXISTING_BINDINGS_PRESERVED=PASS');
 console.log('APP613_NEW_ONE_PRIVATE_SERVICE_BINDING=PASS');
 console.log('APP613_12_MODULES_SHA_UNCHANGED=PASS');
 console.log('APP613_NO_DO_MIGRATION_AND_NO_DEPLOY=PASS');
 console.log('APP613_ACTIVE_100_PERCENT_UNCHANGED=PASS');
}
if(process.argv[2]==='--source-only'){
 need(TARGET==='soridraw-owner-follow-preview-candidate','TARGET_MISMATCH');
 console.log('APP613_SOURCE_BOUNDARIES=PASS');
}else if(process.argv[2]==='--stage-once')await run();
else throw Error('APP613_INVALID_MODE');

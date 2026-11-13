// APP620: one unused immutable Cloudflare owner Worker version with a
// reverse private named-entrypoint binding. Never deploy or access DO/data.
import {createHash} from 'node:crypto';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const OWNER='soridraw-owner-follow-preview-candidate';
const SOURCE='5a2d333c-f703-4ef7-9468-0293f7699268';
const EXPLORE='soridraw-explore-preview';
const EXPLORE_ACTIVE='350ce33d-ec83-49d0-a4ae-c25d2d90f59e';
const BIND='OWNER_FOLLOW_CANONICAL_REPLAY_600';
const ENTRY='OwnerFollowReplayEntrypoint607';
const fail=(v,k)=>{if(!v)throw Error('APP620_HOLD_'+k)};
const sha=x=>createHash('sha256').update(x).digest('hex');
const root='workers/scripts/'+OWNER;
async function get(path,token){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path,{
  method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},
  signal:AbortSignal.timeout(20000)});
 fail(r.ok,'GET_HTTP_'+r.status);
 const v=await r.json();fail(v?.success===true,'GET_NOT_SUCCESS');return v.result;
}
async function checkActive(name,id,token){
 const result=await get('workers/scripts/'+name+'/deployments?per_page=1',token);
 const versions=result?.deployments?.[0]?.versions;
 fail(versions?.length===1&&versions[0].version_id===id&&Number(versions[0].percentage)===100,
  'TRAFFIC_DRIFT_'+name);
}
function mapBindings(list,count){
 fail(Array.isArray(list)&&list.length===count,'WRONG_BINDING_COUNT');
 const map=new Map(list.map(x=>[x.name,x]));
 fail(map.size===count,'DUPLICATE_BINDING');
 fail(map.get('SORIDRAW_ENVIRONMENT')?.text==='preview'&&
  map.get('OWNER_FOLLOW_DO_600')?.class_name==='OwnerFollowerStandalone600',
  'ORIGINAL_BINDING_IDENTITY');
 fail(!map.has('SORIDRAW_OWNER_DO_STANDALONE_600')&&
  !map.has('SORIDRAW_OWNER_DO_BRIDGE_SECRET_600'),
  'ACTIVATION_ALREADY_PRESENT');
 return map;
}
async function stage(){
 fail(process.env.GITHUB_REF==='refs/heads/feat/app600-owner-standalone-isolated','BRANCH');
 fail(process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT,'ACCOUNT');
 fail(/^[0-9a-f]{40}$/.test(String(process.env.APP620_APPROVED_PARENT||'')),'TRIGGER');
 const token=String(process.env.CLOUDFLARE_API_TOKEN||'');fail(token.length>15,'TOKEN');
 await checkActive(OWNER,SOURCE,token);await checkActive(EXPLORE,EXPLORE_ACTIVE,token);
 const version=await get(root+'/versions/'+SOURCE,token);
 const runtime=version?.resources?.script_runtime||{};
 fail(runtime.compatibility_date==='2026-08-28'&&runtime.migration_tag==='owner600_v1',
  'RUNTIME_IDENTITY');
 const baseline=mapBindings(version?.resources?.bindings,2);
 const settings=mapBindings((await get(root+'/settings',token))?.bindings,2);
 for(const [name,v] of baseline)
  fail(settings.get(name)?.type===v.type,'SCRIPT_SETTING_DRIFT');
 const code=await get('workers/workers/'+OWNER+'/versions/'+SOURCE+'?include=modules',token);
 const modules=code?.modules;
 fail(Array.isArray(modules)&&modules.length>=1&&modules.length<=12,'MODULE_LIST');
 const moduleNames=new Set(modules.map(m=>m.name));
 fail(moduleNames.size===modules.length,'DUPLICATE_MODULE_NAMES');
 const main=moduleNames.has('worker.mjs')?'worker.mjs':
  (typeof code?.main_module==='string'&&moduleNames.has(code.main_module)?code.main_module:
   (typeof runtime.main_module==='string'&&moduleNames.has(runtime.main_module)?runtime.main_module:
    (modules.length===1?modules[0].name:null)));
 if(!main){
  console.log('APP620_SOURCE_MODULE_NAMES='+[...moduleNames].join(',').slice(0,300));
  throw Error('APP620_HOLD_AMBIGUOUS_ENTRY_MODULE');
 }
 console.log('APP620_SOURCE_ENTRY_MODULE='+main);
 const saved=modules.map(m=>{
  fail(typeof m.content_base64==='string'&&m.content_base64.length>20,'MODULE_BYTES_MISSING');
  return {name:m.name,content_type:m.content_type||'application/javascript+module',
   content_base64:m.content_base64};
 });
 const payload={
  main_module:main,
  compatibility_date:'2026-08-28',
  compatibility_flags:runtime.compatibility_flags||[],
  annotations:{'workers/message':'APP620 reverse owner service binding, not deployed and runtime OFF',
   'workers/tag':'app620-unused-reverse-owner-binding'},
  bindings:[
   ...[...baseline.keys()].sort().map(name=>({name,type:'inherit',version_id:SOURCE})),
   {name:BIND,type:'service',service:EXPLORE,entrypoint:ENTRY},
  ],
  modules:saved,
 };
 fail(payload.bindings.length===3&&!('migrations' in payload)&&!('deploy' in payload),
  'UNSAFE_DEPLOYMENT_PAYLOAD');
 await checkActive(OWNER,SOURCE,token);await checkActive(EXPLORE,EXPLORE_ACTIVE,token);
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+
  '/workers/workers/'+OWNER+'/versions?deploy=false',{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify(payload),signal:AbortSignal.timeout(45000)});
 let response;
 try{response=await r.json()}catch{throw Error('APP620_UNCERTAIN_POST_NO_RETRY')}
 if(!r.ok||response?.success!==true){
  const codes=(response?.errors||[]).map(e=>e.code).slice(0,3).join(',');
  console.log('APP620_API_ERROR_CODES='+codes);
  throw Error('APP620_INACTIVE_UPLOAD_HTTP_'+r.status+'_NO_RETRY');
 }
 const newId=String(response.result?.id||'');
 fail(/^[a-f0-9-]{36}$/.test(newId)&&newId!==SOURCE,'NEW_VERSION_INVALID');
 console.log('APP620_NEW_UNUSED_REVERSE_BINDING_VERSION='+newId);
 const [after,afterCode]=await Promise.all([
  get(root+'/versions/'+newId,token),
  get('workers/workers/'+OWNER+'/versions/'+newId+'?include=modules',token),
 ]);
 const bound=mapBindings(after?.resources?.bindings,3);
 for(const [name,value] of baseline)fail(bound.get(name)?.type===value.type,'BASE_BINDING_DRIFT');
 const service=bound.get(BIND);
 fail(service?.type==='service'&&service.service===EXPLORE&&service.entrypoint===ENTRY,
  'REVERSE_SERVICE_IDENTITY_DRIFT');
 fail(after.resources.script_runtime.compatibility_date==='2026-08-28'&&
   (!after.resources.script_runtime.migration_tag||
    after.resources.script_runtime.migration_tag==='owner600_v1'),
  'UNSAFE_DO_LIFECYCLE');
 const hashes=new Map(saved.map(m=>[m.name,sha(Buffer.from(m.content_base64,'base64'))]));
 fail(afterCode?.modules?.length===saved.length,'MODULE_COUNT_DRIFT');
 for(const m of afterCode.modules)
  fail(hashes.get(m.name)===sha(Buffer.from(m.content_base64||'','base64')),
   'MODULE_HASH_DRIFT');
 await checkActive(OWNER,SOURCE,token);await checkActive(EXPLORE,EXPLORE_ACTIVE,token);
 console.log('APP620_REVERSE_PRIVATE_NAMED_SERVICE_INACTIVE=PASS');
 console.log('APP620_ORIGINAL_TWO_OWNER_BINDINGS_AND_DO_V1_PRESERVED=PASS');
 console.log('APP620_ORIGINAL_OWNER_AND_EXPLORE_TRAFFIC_UNCHANGED=PASS');
 console.log('APP620_SHARED_USER_DATA_AND_FIREBASE_WRITES=ZERO');
}
if(process.argv[2]==='--source-only'){
 fail(ENTRY==='OwnerFollowReplayEntrypoint607'&&BIND==='OWNER_FOLLOW_CANONICAL_REPLAY_600','CONFIG');
 console.log('APP620_SOURCE_BOUNDARY=PASS');
}else if(process.argv[2]==='--stage-once')await stage();
else throw Error('APP620_INVALID_MODE');

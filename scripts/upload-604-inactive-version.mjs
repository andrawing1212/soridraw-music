// APP604: one-shot version creation using exact active Worker bytes.
// No script upload API, wrangler deploy, DO lifecycle, service bindings, or traffic shift.
// No response values, secrets or active code are logged or saved.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const WORKER='soridraw-explore-preview';
const ACTIVE='350ce33d-ec83-49d0-a4ae-c25d2d90f59e';
const FINGERPRINT='82f8ffb762f8fd55f5a6284333db220dca9790981bbec91d8d6d18c102617065';
const COMPAT='2026-08-28',MAIN='preview-entry.js';
const REF='refs/heads/feat/app600-owner-standalone-isolated';
const sha=x=>createHash('sha256').update(x).digest('hex');
const need=(v,reason)=>{if(!v)throw Error('APP604_HOLD_'+reason)};
const sort=arr=>[...arr].sort();
const expectedOriginalNames=['BOOTSTRAP_TOKEN','ENV_NAME','EXPLORE_MIRROR_TOKEN',
 'PROD_BASE','SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019',
 'SORIDRAW_NOTIFICATION_RETENTION_013','SORIDRAW_NOTIFICATION_SCHEMA_READY_013',
 'SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET','TARGET_BASE'];
const typeName=x=>String(x?.name||'')+'|'+String(x?.type||'');
function safeBindingMap(items,label){
 need(Array.isArray(items)&&items.length===23,label+'_23_REQUIRED');
 const map=new Map();
 for(const item of items){
  need(item&&typeof item.name==='string'&&item.name&&
   typeof item.type==='string'&&item.type&&
   !map.has(item.name),label+'_INVALID');
  map.set(item.name,item);
 }
 need(map.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.class_name==='ExploreLikeBatchScheduler103',
  label+'_LIKE_CLASS_DRIFT');
 need(!map.has('OWNER_FOLLOW_RECOVERY_557'),label+'_OLD_DO_V2_NOT_ALLOWED');
 need(!map.has('OWNER_FOLLOW_RESERVATION_SERVICE_600'),label+'_NO_ACTIVE_SERVICE_ALLOWED');
 const origin=map.get('SORIDRAW_ENVIRONMENT');
 need(origin?.type==='plain_text'&&origin.text==='preview',label+'_PREVIEW_REQUIRED');
 for(const n of expectedOriginalNames)need(map.has(n),label+'_DASHBOARD_BINDING_MISSING');
 return map;
}
function bindingParity(before,after){
 const a=safeBindingMap(before,'BASE'),b=safeBindingMap(after,'CANDIDATE');
 need(sort([...a.values()].map(typeName)).join('\n')===
   sort([...b.values()].map(typeName)).join('\n'),'23_BINDING_TYPE_PARITY');
 for(const [name,x] of a){
  const y=b.get(name);
  if(x.type==='d1')need(String(x.id||x.database_id||x.uuid)===
    String(y.id||y.database_id||y.uuid),'D1_ID_DRIFT');
  if(x.type==='r2_bucket')need(String(x.bucket_name||x.bucket)===
    String(y.bucket_name||y.bucket),'R2_ID_DRIFT');
  if(x.type==='durable_object_namespace')
   need(x.class_name===y.class_name,'DO_IDENTITY_DRIFT');
  if(x.type==='ratelimit'&&x.namespace_id&&y.namespace_id)
   need(String(x.namespace_id)===String(y.namespace_id),'RATELIMIT_DRIFT');
 }
 return true;
}
function plannedUpload(version,code){
 need(version?.id===ACTIVE,'BASE_ID_CHANGED');
 const r=version.resources||{},runtime=r.script_runtime||{};
 need(runtime.migration_tag==='v1','LIKE_DO_V1_NOT_PROVEN');
 need(runtime.compatibility_date===COMPAT,'RUNTIME_DATE_CHANGED');
 const flags=runtime.compatibility_flags??[];
 need(Array.isArray(flags)&&flags.every(x=>typeof x==='string'),
  'COMPAT_FLAGS_MALFORMED');
 const existing=safeBindingMap(r.bindings,'SOURCE');
 need(code?.id===ACTIVE&&Array.isArray(code.modules)&&code.modules.length===1,
  'SOURCE_MODULE_SHAPE');
 const module=code.modules[0];
 need(module.name===MAIN&&typeof module.content_base64==='string',
  'SOURCE_MAIN_MISSING');
 const bytes=Buffer.from(module.content_base64,'base64');
 need(bytes.length===2440556,'SOURCE_BYTE_LENGTH_DRIFT');
 const sourceSha=sha(bytes);
 const fingerprint=sha(JSON.stringify([{name:module.name,sha256:sourceSha,bytes:bytes.length}]));
 need(fingerprint===FINGERPRINT,'ACTIVE_MODULE_SHA_DRIFT');
 // Strictly clone original bytes. Do not introduce a new code export,
 // DO migration, external service, secret, or a new feature gate.
 const bindings=sort([...existing.keys()]).map(name=>({
  name,type:'inherit',version_id:ACTIVE,
 }));
 const request={
  annotations:{'workers/message':'APP604 byte-identical inactive version, no traffic',
   'workers/tag':'app604-exact-copy-hold'},
  bindings,compatibility_date:COMPAT,compatibility_flags:flags,
  main_module:MAIN,modules:[{
   name:MAIN,content_base64:module.content_base64,
   content_type:module.content_type||'application/javascript+module',
  }],
 };
 // Do not specify migrations/exports, deployment, routes or keep_vars.
 const allowed=['annotations','bindings','compatibility_date',
  'compatibility_flags','main_module','modules'];
 need(JSON.stringify(Object.keys(request).sort())===JSON.stringify(allowed.sort()),
  'UNEXPECTED_UPLOAD_FIELDS');
 need(request.bindings.length===23&&request.bindings.every(x=>
  x.type==='inherit'&&x.version_id===ACTIVE),'INHERIT_NOT_PINNED');
 need(!('migrations' in request)&&!('exports' in request)&&
  !('deploy' in request),'DO_LIFECYCLE_OR_DEPLOY_MUST_BE_ABSENT');
 return {request,sourceSha};
}
function selfTest(){
 const bindings=Array.from({length:21},(_,i)=>({name:expectedOriginalNames[i]||'X'+i,type:'plain_text'}));
 bindings[0]={name:'SORIDRAW_ENVIRONMENT',type:'plain_text',text:'preview'};
 bindings[1]={name:'EXPLORE_LIKE_BATCH_SCHEDULER',type:'durable_object_namespace',
  class_name:'ExploreLikeBatchScheduler103'};
 for(let i=2;i<=10;i++)bindings[i]={name:expectedOriginalNames[i-2],type:'plain_text'};
 // Remove duplicated names for a full 23-binding simulated baseline.
 const unique=new Map(bindings.map(x=>[x.name,x]));
 for(let i=0;unique.size<23;i++)unique.set('SYNTHETIC_'+i,{
  name:'SYNTHETIC_'+i,type:'plain_text'});
 const fake=[...unique.values()];
 assert.equal(safeBindingMap(fake,'TEST').size,23);
 assert.equal(bindingParity(fake,structuredClone(fake)),true);
 assert.throws(()=>safeBindingMap(fake.slice(1),'TEST'),/TEST_23_REQUIRED/);
 assert.throws(()=>safeBindingMap([...fake.slice(0,22),
  {name:'OWNER_FOLLOW_RECOVERY_557',type:'durable_object_namespace'}],'TEST'),
  /OLD_DO_V2_NOT_ALLOWED/);
 console.log('APP604_SELFTEST_23_PINNED_BINDINGS_AND_DO_V2_DENIAL=PASS');
}
async function cloud(path,token){
 const url='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path;
 const response=await fetch(url,{method:'GET',headers:{
  Authorization:'Bearer '+token,Accept:'application/json'
 },signal:AbortSignal.timeout(20000)});
 need(response.ok,'READ_HTTP_'+response.status);
 const o=await response.json();
 need(o?.success===true,'READ_REJECTED');
 return o.result;
}
async function active(token){
 const deployments=await cloud('workers/scripts/'+WORKER+'/deployments?per_page=1',token);
 const vers=deployments?.deployments?.[0]?.versions||[];
 need(vers.length===1&&vers[0].version_id===ACTIVE&&
  Number(vers[0].percentage)===100,'DEPLOYMENT_CHANGED');
}
async function upload(){
 need(process.env.GITHUB_REF===REF,'WRONG_REF');
 need(process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT,'ACCOUNT_CHANGED');
 need(process.env.APP604_APPROVED_PARENT&&
  /^[0-9a-f]{40}$/.test(process.env.APP604_APPROVED_PARENT),
  'RELEASE_TRIGGER_PARENT_REQUIRED');
 const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
 need(token.length>15,'TOKEN_MISSING');
 await active(token);
 const root='workers/scripts/'+WORKER;
 const [v,code]=await Promise.all([
  cloud(root+'/versions/'+ACTIVE,token),
  cloud('workers/workers/'+WORKER+'/versions/'+ACTIVE+'?include=modules',token)
 ]);
 const {request,sourceSha}=plannedUpload(v,code);
 // Read script settings solely to assert no previously uploaded candidate
 // silently changed bindings. Values are not printed or exported.
 const settings=(await cloud(root+'/settings',token)).bindings;
 bindingParity(v.resources.bindings,settings);
 await active(token);
 const url='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+
  '/workers/workers/'+WORKER+'/versions?deploy=false';
 const response=await fetch(url,{method:'POST',headers:{
  Authorization:'Bearer '+token,'Content-Type':'application/json',
 },body:JSON.stringify(request),signal:AbortSignal.timeout(45000)});
 let result;
 try{result=await response.json()}catch{need(false,'UPLOAD_BAD_JSON')}
 if(!response.ok||result?.success!==true){
  const codes=Array.isArray(result?.errors)?
   result.errors.map(x=>String(x.code||'UNKNOWN')).slice(0,3):[];
  // No API message or token is printed.
  console.log('APP604_UPLOAD_ERROR_CODES='+codes.join(','));
  need(false,'UPLOAD_HTTP_'+response.status);
 }
 const id=String(result?.result?.id||'');
 need(/^[0-9a-f-]{36}$/.test(id)&&id!==ACTIVE,'NEW_VERSION_ID_MISSING');
 console.log('APP604_CANDIDATE_VERSION_UPLOADED_NONDEPLOYED='+id);
 // No automatic retry of any POST; on postflight failure quarantine version.
 const [newVersion,newSource]=await Promise.all([
  cloud(root+'/versions/'+id,token),
  cloud('workers/workers/'+WORKER+'/versions/'+id+'?include=modules',token)
 ]);
 need(newVersion?.id===id,'NEW_VERSION_METADATA_MISSING');
 need(bindingParity(v.resources.bindings,newVersion.resources?.bindings),
  'NEW_VERSION_BINDINGS_DRIFT');
 need(newVersion.resources?.script_runtime?.compatibility_date===COMPAT,
  'NEW_VERSION_COMPATIBILITY_DRIFT');
 const migrated=newVersion.resources?.script_runtime?.migration_tag;
 need(migrated===undefined||migrated===null||migrated===''||migrated==='v1',
  'NEW_VERSION_MIGRATION_TAG_UNSAFE');
 const reconciliation=newVersion.exports_reconciliation;
 if(reconciliation)for(const k of ['created','deleted','renamed','transferred','updated'])
  need(!Array.isArray(reconciliation[k])||reconciliation[k].length===0,
   'LIFECYCLE_RECONCILIATION_'+k);
 need(newSource?.modules?.length===1&&
  newSource.modules[0].name===MAIN&&
  sha(Buffer.from(newSource.modules[0].content_base64||'','base64'))===sourceSha,
  'CANDIDATE_MODULE_BYTES_CHANGED');
 await active(token);
 const evidence={
  candidateVersion:id,activeVersionUnchanged:ACTIVE,
  exactModuleSHA256:sourceSha,activeBaselineFingerprint:FINGERPRINT,
  byteIdentical:true,inheritedBindingCount:23,
  secretPlaintextsObserved:false,allInheritPinnedToActive:true,
  migrationSpecified:false,oldLikeDoClassPreserved:true,
  noNewOwnerDoV2:true,compatibilityDate:COMPAT,codeChanges:false,
  createdVersionNotDeployed:true,rollout:'HOLD',pcMobile:'NOT_TESTED',
 };
 if(process.env.RUNNER_TEMP)writeFileSync(
  process.env.RUNNER_TEMP+'/app604-inactive-version.json',
  JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
 console.log('APP604_CANDIDATE_MODULE_SHA256_EXACT=PASS');
 console.log('APP604_NEW_VERSION_23_INHERITED_BINDINGS=PASS');
 console.log('APP604_ACTIVE_DEPLOYMENT_UNCHANGED_100_PERCENT=PASS');
 console.log('APP604_DO_LIFECYCLE_MIGRATION_NONE=PASS');
 console.log('APP604_NEXT_ACTIVATION=HOLD');
}
const mode=process.argv[2];
if(mode==='--self-test')selfTest();
else if(mode==='--upload-once')await upload();
else throw Error('APP604_UNAPPROVED_MODE');

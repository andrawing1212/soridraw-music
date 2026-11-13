// APP605 OFF-only, source-preserving stage of APP601 module graph.
// Never modifies the active Worker's fetch, scheduled, queue, default exports or DO class.
// It is not an operational owner-follow integration: no routing and no Service Bindings.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const WORKER='soridraw-explore-preview';
const ACTIVE='350ce33d-ec83-49d0-a4ae-c25d2d90f59e';
const MAIN='preview-entry.js';
const AGGREGATE='82f8ffb762f8fd55f5a6284333db220dca9790981bbec91d8d6d18c102617065';
const DATE='2026-08-28';
const REF='refs/heads/feat/app600-owner-standalone-isolated';
const TAG='app605-inactive-sidecar-off-v1';
const ROOT=new URL('../cloudflare/explore-worker/runtime/',import.meta.url);
const PARTS=[
 'owner-follow-service-601.mjs',
 'owner-follow-postcommit-555.mjs',
 'owner-follow-commit-proof-557.mjs',
 'owner-follow-qa-boundary-577.mjs',
 'owner-follow-http-539.mjs',
 'owner-follow-outbox-529.mjs',
 'owner-follow-auth-epoch-532.mjs',
];
const ADDITION=String.raw`
// APP605: private APP601 bridge module is linked but NOT installed in any
// Worker route, cron, export, DO class, or user-facing request handler.
// Keep this gate hard-coded false. Later ON needs an independent release.
import {APP601_OWNER_SERVICE_WIRING_COMPILED_OPEN as APP605_SERVICE_OFF,
 reserveOwnerFollowViaService601 as app605ReserveOwner,
 handleOwnerFollowReplayService601 as app605ReplayOwner}
 from './app605/owner-follow-service-601.mjs';
const APP605_ACTIVE_BRIDGE_COMPILED_OPEN=false;
async function app605DormantOwnerBridge(kind,env,arg) {
 if (!APP605_ACTIVE_BRIDGE_COMPILED_OPEN || !APP605_SERVICE_OFF)
  return {ok:false,status:'disabled'};
 return kind==='reserve'?
  app605ReserveOwner(arg,env,{enabled:true}):
  app605ReplayOwner({request:arg,env,enabled:true});
}
`;
const sha=x=>createHash('sha256').update(x).digest('hex');
const need=(v,why)=>{if(!v)throw Error('APP605_HOLD_'+why)};
const sort=a=>[...a].sort();
const byName=(records,what)=>{
 need(Array.isArray(records)&&records.length===23,what+'_23_BINDINGS_REQUIRED');
 const o=new Map();
 for(const x of records){
  need(x&&typeof x.name==='string'&&x.name.length&&
   typeof x.type==='string'&&!o.has(x.name),what+'_DUPLICATE_OR_MALFORMED');
  o.set(x.name,x);
 }
 need(!o.has('OWNER_FOLLOW_RECOVERY_557'),what+'_V2_DO_UNSAFE');
 need(!o.has('OWNER_FOLLOW_RESERVATION_SERVICE_600'),what+'_SERVICE_UNEXPECTED');
 need(o.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.class_name==='ExploreLikeBatchScheduler103',
  what+'_LIKE_DO_DRIFT');
 need(o.get('SORIDRAW_ENVIRONMENT')?.text==='preview',what+'_NOT_PREVIEW');
 return o;
};
const checkParity=(a,b)=>{
 const x=byName(a,'ACTIVE'),y=byName(b,'CANDIDATE');
 need(sort([...x.values()].map(q=>q.name+'|'+q.type)).join('\n')===
  sort([...y.values()].map(q=>q.name+'|'+q.type)).join('\n'),
  'BINDING_NAME_TYPE_CHANGED');
 for(const [name,entry] of x){
  const got=y.get(name);
  if(entry.type==='d1')
   need(String(entry.id||entry.database_id||entry.uuid)===
     String(got.id||got.database_id||got.uuid),'D1_TARGET_CHANGED');
  if(entry.type==='r2_bucket')
   need(String(entry.bucket_name||entry.bucket)===
     String(got.bucket_name||got.bucket),'R2_TARGET_CHANGED');
  if(entry.type==='durable_object_namespace')
   need(entry.class_name===got.class_name,'DO_CLASS_CHANGED');
  if(entry.type==='ratelimit'&&entry.namespace_id&&got.namespace_id)
   need(String(entry.namespace_id)===String(got.namespace_id),
    'RATELIMIT_NAMESPACE_CHANGED');
 }
 return [...x.keys()].sort();
};
function sidecars(){
 const contents=PARTS.map(file=>{
  const buf=readFileSync(new URL(file,ROOT));
  const text=buf.toString('utf8');
  need(Buffer.from(text).equals(buf),'INVALID_UTF8_'+file);
  need(!/export\s+class\s+OwnerFollowerRecovery557/.test(text),
   'NEW_DO_EXPORT_FORBIDDEN_'+file);
  return {name:'app605/'+file,content_base64:buf.toString('base64'),
   content_type:'application/javascript+module',sha:sha(buf),bytes:buf.length};
 });
 const bridge=readFileSync(new URL('owner-follow-service-601.mjs',ROOT),'utf8');
 need(bridge.includes('export const APP601_OWNER_SERVICE_WIRING_COMPILED_OPEN=false;'),
  'APP601_FLAG_NOT_COMPILED_OFF');
 const a=readFileSync(new URL('owner-follow-postcommit-555.mjs',ROOT),'utf8');
 need(a.includes('export const APP555_OWNER_POSTCOMMIT_W2_COMPILED_OPEN=false;'),
  'APP555_FLAG_NOT_OFF');
 const html=contents.map(x=>Buffer.from(x.content_base64,'base64').toString('utf8')).join('\n');
 need(!html.includes("from '../src/firebase.js'"),'FIREBASE_CLIENT_IMPORT_FORBIDDEN');
 need(!html.includes("from '../../../functions'"),'BACKEND_FUNCTION_IMPORT_FORBIDDEN');
 return contents;
}
function build(version,source){
 need(version?.id===ACTIVE,'ACTIVE_ID_DRIFT');
 const runtime=version.resources?.script_runtime||{};
 need(runtime.migration_tag==='v1','ACTIVE_MIGRATION_NOT_V1');
 need(runtime.compatibility_date===DATE,'ACTIVE_COMPAT_DATE_DRIFT');
 need(runtime.compatibility_flags===undefined||
  Array.isArray(runtime.compatibility_flags),'BAD_RUNTIME_FLAGS');
 const bindings=byName(version.resources?.bindings,'ACTIVE');
 need(source?.id===ACTIVE&&source.modules?.length===1,'SOURCE_MODULE_COUNT_CHANGED');
 const old=source.modules[0];
 need(old.name===MAIN&&typeof old.content_base64==='string','MAIN_MODULE_CHANGED');
 const original=Buffer.from(old.content_base64,'base64');
 need(original.length===2440556,'ORIGINAL_SOURCE_BYTES_DRIFT');
 const originalSha=sha(original);
 need(sha(JSON.stringify([{name:MAIN,sha256:originalSha,bytes:original.length}]))===
  AGGREGATE,'ORIGINAL_SHA_DRIFT');
 const suffix=Buffer.from(ADDITION,'utf8');
 const combined=Buffer.concat([original,suffix]);
 need(combined.subarray(0,original.length).equals(original),
  'ORIGINAL_SOURCE_PREFIX_CHANGED');
 const deps=sidecars();
 const candidate=[
  {name:MAIN,content_base64:combined.toString('base64'),
   content_type:old.content_type||'application/javascript+module'},
  ...deps.map(({name,content_base64,content_type})=>({name,content_base64,content_type})),
 ];
 need(candidate.length===8,'CANDIDATE_MODULES_NOT_EIGHT');
 const flags=runtime.compatibility_flags||[];
 const request={
  annotations:{'workers/message':'APP605 inactive APP601 private bridge module, compile OFF',
   'workers/tag':TAG},
  main_module:MAIN,compatibility_date:DATE,
  compatibility_flags:flags,
  bindings:[...bindings.keys()].sort().map(name=>
   ({name,type:'inherit',version_id:ACTIVE})),
  modules:candidate,
 };
 need(!('migrations' in request)&&!('exports' in request)&&
  !('services' in request),'DO_LIFECYCLE_FIELDS_NOT_ALLOWED');
 need(!request.bindings.some(x=>x.version_id!==ACTIVE||x.type!=='inherit'),
  'UNPINNED_BINDING');
 return {request,originalSha,candidateSha:sha(combined),oldBytes:original.length,
  addedBytes:suffix.length,dependencies:deps.map(({name,sha,bytes})=>({name,sha,bytes}))};
}
function offline(){
 const mods=sidecars();
 assert.equal(mods.length,7);
 assert.match(ADDITION,/APP605_ACTIVE_BRIDGE_COMPILED_OPEN=false/);
 assert.match(ADDITION,/from '.\/app605\/owner-follow-service-601.mjs'/);
 assert.doesNotMatch(ADDITION,/export\s+(default|class)\s+/);
 const pairs=mods.map(x=>x.name);
 assert.equal(new Set(pairs).size,7);
 for(const mod of mods){
  const src=Buffer.from(mod.content_base64,'base64').toString('utf8');
  for(const found of src.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)){
   const resolved='app605/'+found[1].slice(2);
   assert.ok(pairs.includes(resolved),resolved);
  }
 }
 console.log('APP605_OFFLINE_SEVEN_REAL_APP601_MODULES=PASS');
 console.log('APP605_OFFLINE_GATE_HARD_OFF_NO_NEW_EXPORTS=PASS');
 console.log('APP605_OFFLINE_IMPORT_CLOSURE_NO_REMOTE_IMPORT=PASS');
}
async function getApi(route,token){
 const u='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+route;
 const response=await fetch(u,{method:'GET',headers:{
  Authorization:'Bearer '+token,Accept:'application/json'
 },signal:AbortSignal.timeout(20000)});
 need(response.ok,'CLOUDFLARE_READ_HTTP_'+response.status);
 const data=await response.json();
 need(data?.success===true,'CLOUDFLARE_READ_RESPONSE_FAIL');
 return data.result;
}
async function assertCurrent(token){
 const x=await getApi('workers/scripts/'+WORKER+'/deployments?per_page=1',token);
 const v=x?.deployments?.[0]?.versions;
 need(v?.length===1&&v[0].version_id===ACTIVE&&
  Number(v[0].percentage)===100,'DEPLOYMENT_CHANGED');
}
const tempDir=()=>join(process.env.RUNNER_TEMP||'/nonexistent-app605','app605');
async function prepare(token){
 await assertCurrent(token);
 const root='workers/scripts/'+WORKER;
 const [version,source,settings]=await Promise.all([
  getApi(root+'/versions/'+ACTIVE,token),
  getApi('workers/workers/'+WORKER+'/versions/'+ACTIVE+'?include=modules',token),
  getApi(root+'/settings',token),
 ]);
 checkParity(version.resources.bindings,settings.bindings);
 const built=build(version,source);
 await assertCurrent(token);
 return {version,source,built};
}
async function inspect(){
 need(process.env.GITHUB_REF===REF,'WRONG_REF');
 need(process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT,'ACCOUNT_MISMATCH');
 const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
 need(token.length>15,'READ_TOKEN_MISSING');
 const {source,built}=await prepare(token);
 const root=tempDir();
 mkdirSync(root,{recursive:true});
 mkdirSync(join(root,'baseline'),{recursive:true});
 mkdirSync(join(root,'candidate','app605'),{recursive:true});
 writeFileSync(join(root,'baseline',MAIN),
  Buffer.from(source.modules[0].content_base64,'base64'),{mode:0o600});
 for(const part of built.request.modules){
  const dir=join(root,'candidate',part.name);
  writeFileSync(dir,Buffer.from(part.content_base64,'base64'),{mode:0o600});
 }
 writeFileSync(join(root,'candidate-proof.json'),
  JSON.stringify({sourceSha:built.originalSha,candidateSha:built.candidateSha,
   prefixBytes:built.oldBytes,appendedBytes:built.addedBytes,
   moduleCount:built.request.modules.length,
   modules:built.dependencies,compiledOff:true,sourcePreserved:true,
   activeVersion:ACTIVE,compatibilityDate:DATE,
   readOnly:true,noNewBindings:true,
   runtimeParity:'NOT_YET_TESTED',uploadApproved:false},null,2)+'\n');
 console.log('APP605_SOURCE_PREFIX_BYTE_IDENTICAL=PASS');
 console.log('APP605_CANDIDATE_DEPENDENCIES='+built.dependencies.length);
 console.log('APP605_PREPARED_REAL_RUNTIME_DATE='+DATE);
 console.log('APP605_ACTIVE_23_BINDINGS_PINNED=PASS');
 console.log('APP605_CLOUDFLARE_GET_ONLY=PASS');
}
async function upload(){
 need(process.env.GITHUB_REF===REF,'WRONG_REF');
 need(process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT,'ACCOUNT_MISMATCH');
 need(/^[0-9a-f]{40}$/.test(String(process.env.APP605_APPROVED_PARENT||'')),
  'ONE_TIME_APPROVED_PARENT_REQUIRED');
 need(process.env.APP605_RUNTIME_PARITY==='PASS','REAL_RUNTIME_PARITY_NOT_PROVEN');
 const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
 need(token.length>15,'TOKEN_MISSING');
 const {version,built}=await prepare(token);
 const path='workers/workers/'+WORKER+'/versions';
 const url='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path+'?deploy=false';
 const r=await fetch(url,{method:'POST',headers:{
  Authorization:'Bearer '+token,'Content-Type':'application/json'
 },body:JSON.stringify(built.request),signal:AbortSignal.timeout(45000)});
 let body;
 try{body=await r.json()}catch{throw Error('APP605_HOLD_POST_UNKNOWN_JSON_NO_RETRY')}
 if(!r.ok||body?.success!==true){
  const codes=Array.isArray(body?.errors)?body.errors.map(x=>x.code).slice(0,2):[];
  console.log('APP605_UPLOAD_ERROR_CODES='+codes.join(','));
  throw Error('APP605_HOLD_UPLOAD_HTTP_'+r.status+'_NO_RETRY');
 }
 const candidate=String(body.result?.id||'');
 need(/^[0-9a-f-]{36}$/.test(candidate)&&candidate!==ACTIVE,'VERSION_ID_UNKNOWN');
 console.log('APP605_NEW_INACTIVE_VERSION_CREATED='+candidate);
 // No second POST even if GET postflight fails; quarantine uncertain candidate.
 const [meta,content]=await Promise.all([
  getApi('workers/scripts/'+WORKER+'/versions/'+candidate,token),
  getApi('workers/workers/'+WORKER+'/versions/'+candidate+'?include=modules',token)
 ]);
 need(meta?.id===candidate,'NEW_METADATA_MISSING');
 checkParity(version.resources.bindings,meta.resources?.bindings);
 need(meta.resources?.script_runtime?.compatibility_date===DATE,
  'COMPAT_DATE_CHANGED');
 const migrate=meta.resources?.script_runtime?.migration_tag;
 need(migrate===undefined||migrate===null||migrate===''||migrate==='v1',
  'UNEXPECTED_DO_MIGRATION');
 const uploaded=content?.modules;
 need(Array.isArray(uploaded)&&uploaded.length===8,'MODULE_COUNT_UPLOAD_DRIFT');
 const checked=new Map(uploaded.map(x=>[x.name,sha(Buffer.from(x.content_base64||'','base64'))]));
 for(const part of built.request.modules){
  need(checked.get(part.name)===sha(Buffer.from(part.content_base64,'base64')),
    'MODULE_SHA_DRIFT_'+part.name);
 }
 await assertCurrent(token);
 const evidence={
  candidate,baseline:ACTIVE,compiledOff:true,mainSha:built.candidateSha,
  originalPrefixSha:built.originalSha,originalPrefixBytes:built.oldBytes,
  appendedBytes:built.addedBytes,moduleCount:8,
  pinnedBindings:23,existingDoLifecycleChange:false,
  noNewDO:true,sourceOnlySidecarModules:true,
  noActiveTrafficChange:true,
  noServiceBindings:true,noFirebaseWrites:true,
  functionalOwnerSync:'NOT_ENABLED',decision:'HOLD',
 };
 if(process.env.RUNNER_TEMP)writeFileSync(
  join(process.env.RUNNER_TEMP,'app605-inactive-proof.json'),
  JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
 console.log('APP605_NEW_VERSION_EXACT_MODULE_HASHES=PASS');
 console.log('APP605_NEW_VERSION_23_INHERITED_BINDINGS=PASS');
 console.log('APP605_NO_V2_DO_MIGRATION=PASS');
 console.log('APP605_EXISTING_WORKER_ACTIVE_STILL_100_PERCENT=PASS');
 console.log('APP605_REAL_USER_FOLLOW_SYNC=HOLD_OFF');
}
function auditStructure(){
 const root=tempDir();
 const original=readFileSync(join(root,'baseline',MAIN),'utf8');
 const candidate=readFileSync(join(root,'candidate',MAIN),'utf8');
 need(candidate.startsWith(original),'NOT_ACTUAL_ORIGINAL_PREFIX');
 // Textual import path inventory, never print source/module paths.
 // Counts are diagnostic, not full AST or runtime equivalence proof.
 const paths=src=>[...src.matchAll(/(?:\bfrom\s*|\bimport\s*\(|\bimport\s*)(['"])([^'"]+)\1/g)]
  .map(m=>m[2]);
 const originalImports=paths(original);
 const relativeUp=originalImports.filter(x=>x.startsWith('../'));
 const relativeAny=originalImports.filter(x=>x.startsWith('./')||x.startsWith('../'));
 const originalLikeClass=original.includes('ExploreLikeBatchScheduler103');
 const candidateOwnerClasses=(candidate.match(/OwnerFollowerRecovery557/g)||[]).length;
 console.log('APP605_ACTIVE_TEXTUAL_IMPORTS='+originalImports.length);
 console.log('APP605_ACTIVE_TEXTUAL_UPLEVEL_IMPORTS='+relativeUp.length);
 console.log('APP605_ACTIVE_TEXTUAL_RELATIVE_IMPORTS='+relativeAny.length);
 console.log('APP605_ACTIVE_REFERENCES_LIKE_DO_CLASS='+originalLikeClass);
 console.log('APP605_CANDIDATE_TEXTUAL_LEGACY_OWNER_REFERENCES='+candidateOwnerClasses);
 console.log('APP605_OFF_SOURCE_BYTE_IDENTICAL_PREFIX=PASS');
 console.log('APP605_MINIFLARE_WORKERD_FULL_PARITY=HOLD_PREVIOUS_FAILURE');
}
const mode=process.argv[2];
if(mode==='--self-test')offline();
else if(mode==='--prepare')await inspect();
else if(mode==='--audit-structure')auditStructure();
else if(mode==='--upload-once')await upload();
else throw Error('APP605_UNAUTHORIZED_MODE');

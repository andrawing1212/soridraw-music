// APP612: one-use Cloudflare Beta Versions API candidate, NEVER deploy traffic.
// Existing 23 bindings pinned to immutable active ID, no new settings, secrets
// or DO lifecycle. All writes are ONE version upload, no retry on uncertainty.
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const WORKER='soridraw-explore-preview';
const ACTIVE='350ce33d-ec83-49d0-a4ae-c25d2d90f59e';
const BRANCH='refs/heads/feat/app600-owner-standalone-isolated';
const WORKER_DATE='2026-08-28';
const SOURCE_PROOF='b076990f36ea6816ece2dce30d9e314527231ec0';
const MAIN='owner-follow-entry-607.mjs';
const temp=()=>join(process.env.RUNNER_TEMP||'/no-607-runtime','app607');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const need=(v,why)=>{if(!v)throw Error('APP612_HOLD_'+why)};
const names=rows=>{
 need(Array.isArray(rows)&&rows.length===23,'23_BINDINGS_REQUIRED');
 const a=new Map();
 for(const b of rows){
  need(typeof b.name==='string'&&b.name&&
   typeof b.type==='string'&&!a.has(b.name),'MALFORMED_BINDING');
  a.set(b.name,b);
 }
 need(a.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.class_name===
  'ExploreLikeBatchScheduler103','LIKE_DO_V1_DRIFT');
 need(!a.has('OWNER_FOLLOW_RECOVERY_557'),'OLD_WORKER_OWNER_DO_V2_FORBIDDEN');
 need(!a.has('OWNER_FOLLOW_RESERVATION_SERVICE_600'),'OWNER_SERVICE_NOT_YET_APPROVED_TO_CONFIGURE');
 need(a.get('SORIDRAW_ENVIRONMENT')?.text==='preview','PREVIEW_ONLY');
 return a;
};
function bindingMatch(before,after){
 const x=names(before),y=names(after);
 need([...x.keys()].sort().map(k=>k+':'+x.get(k).type).join('|')===
  [...y.keys()].sort().map(k=>k+':'+y.get(k).type).join('|'),
  'BINDINGS_NAME_TYPE_DRIFT');
 for(const [key,v] of x){
  const z=y.get(key);
  if(v.type==='d1')need(String(v.id||v.database_id||v.uuid)===
   String(z.id||z.database_id||z.uuid),'D1_TARGET_DRIFT');
  if(v.type==='r2_bucket')need(String(v.bucket_name||v.bucket)===
   String(z.bucket_name||z.bucket),'R2_TARGET_DRIFT');
  if(v.type==='durable_object_namespace')need(v.class_name===z.class_name,
   'LIKE_DO_CLASS_DRIFT');
 }
}
async function get(path,token){
 const uri='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path;
 const res=await fetch(uri,{method:'GET',headers:{
  Authorization:'Bearer '+token,Accept:'application/json'
 },signal:AbortSignal.timeout(20000)});
 need(res.ok,'GET_HTTP_'+res.status);
 const data=await res.json();
 need(data?.success===true,'GET_RESULT_NOT_SUCCESS');
 return data.result;
}
async function assertActive(token){
 const ds=await get('workers/scripts/'+WORKER+'/deployments?per_page=1',token);
 const v=ds?.deployments?.[0]?.versions;
 need(v?.length===1&&v[0].version_id===ACTIVE&&
  Number(v[0].percentage)===100,'EXISTING_ACTIVE_VERSION_CHANGED');
}
function modules(){
 const manifest=JSON.parse(readFileSync(join(temp(),'candidate-proof.json'),'utf8'));
 need(manifest.main===MAIN&&manifest.moduleCount===12&&
  manifest.sourcePrefixExact===true&&manifest.existingLikeDoV1===true&&
  manifest.additionalDoClasses===0,'PREPARE_PROOF_INVALID');
 need(manifest.sourceActiveVersion===ACTIVE&&
  manifest.compatibilityDate===WORKER_DATE,'ACTIVE_SOURCE_MISMATCH');
 need(Array.isArray(manifest.moduleProof)&&manifest.moduleProof.length===12,
  'MODULE_PROOF_MISSING');
 return manifest.moduleProof.map(item=>{
  const bytes=readFileSync(join(temp(),item.name));
  need(bytes.length===item.bytes&&sha(bytes)===item.sha256,
   'SOURCE_MODULE_MISMATCH_'+item.name);
  return {name:item.name,content_type:'application/javascript+module',
   content_base64:bytes.toString('base64')};
 });
}
async function release(){
 need(process.env.GITHUB_REF===BRANCH,'UNAPPROVED_GIT_REF');
 need(process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT,'ACCOUNT_ID_MISMATCH');
 need(process.env.APP612_PASS_SHA===SOURCE_PROOF,
  'UNVERIFIED_APP612_RUNTIME_RELEASE_SOURCE');
 need(/^[0-9a-f]{40}$/.test(String(process.env.APP612_APPROVED_PARENT||'')),
  'ONE_USE_APPROVED_PARENT_MISSING');
 const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
 need(token.length>15,'CF_TOKEN_MISSING');
 await assertActive(token);
 const root='workers/scripts/'+WORKER;
 const version=await get(root+'/versions/'+ACTIVE,token);
 const bindingSet=names(version?.resources?.bindings);
 const runtime=version.resources?.script_runtime||{};
 need(runtime.compatibility_date===WORKER_DATE&&
   runtime.migration_tag==='v1','LIVE_RUNTIME_DO_V1_DRIFT');
 const settings=await get(root+'/settings',token);
 bindingMatch(version.resources.bindings,settings.bindings);
 const prepared=modules();
 // This is a code-only *nondeployed* version. Bridge HMAC, service bindings
 // and receiver readiness are deliberately absent; all users remain OFF.
 const payload={
  main_module:MAIN,
  annotations:{
   'workers/message':'APP612 one-owner signed enrollment + private replay; inactive, 23 inherited bindings',
   'workers/tag':'app612-owner-enrollment-entry-source-hold',
  },
  compatibility_date:WORKER_DATE,
  compatibility_flags:runtime.compatibility_flags||[],
  bindings:[...bindingSet.keys()].sort().map(name=>({
   name,type:'inherit',version_id:ACTIVE,
  })),
  modules:prepared,
 };
 need(!('migrations' in payload)&&!('exports' in payload)&&
  !('services' in payload)&&!('deploy' in payload),
  'CANDIDATE_DO_LIFECYCLE_OR_SERVICE_UNSAFE');
 need(payload.bindings.length===23&&payload.bindings.every(x=>
  x.type==='inherit'&&x.version_id===ACTIVE),'BINDINGS_NOT_PINNED');
 await assertActive(token);
 const uri='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+
  '/workers/workers/'+WORKER+'/versions?deploy=false';
 const res=await fetch(uri,{method:'POST',headers:{
  Authorization:'Bearer '+token,'Content-Type':'application/json'
 },body:JSON.stringify(payload),signal:AbortSignal.timeout(45000)});
 let body;
 try{body=await res.json()}
 catch{throw Error('APP612_HOLD_UNKNOWN_UPLOAD_RESPONSE_NO_RETRY')}
 if(!res.ok||body?.success!==true){
  const codes=Array.isArray(body?.errors)?body.errors.map(x=>x.code).slice(0,3):[];
  console.log('APP612_UPLOAD_ERROR_CODES='+codes.join(','));
  throw Error('APP612_HOLD_UPLOAD_HTTP_'+res.status+'_NO_RETRY');
 }
 const candidate=String(body.result?.id||'');
 need(/^[0-9a-f-]{36}$/.test(candidate)&&candidate!==ACTIVE,'NEW_CANDIDATE_ID_INVALID');
 console.log('APP612_NEW_UNUSED_CANDIDATE_VERSION='+candidate);
 // No re-POST if any postflight check fails. Retain the unused version as HOLD.
 const [metadata,source]=await Promise.all([
  get(root+'/versions/'+candidate,token),
  get('workers/workers/'+WORKER+'/versions/'+candidate+'?include=modules',token),
 ]);
 bindingMatch(version.resources.bindings,metadata?.resources?.bindings);
 need(metadata.resources?.script_runtime?.compatibility_date===WORKER_DATE,
  'NEW_COMPATIBILITY_DATE_DRIFT');
 const migration=metadata.resources?.script_runtime?.migration_tag;
 need(!migration||migration==='v1','UNSAFE_DO_MIGRATION_LIFECYCLE');
 const exported=metadata.resources?.script_runtime?.exports||{};
 if(Object.keys(exported).length){
  const replay=exported.OwnerFollowReplayEntrypoint607;
  need(replay?.type==='worker','PRIVATE_ENTRYPOINT_NOT_WORKER');
  const like=exported.ExploreLikeBatchScheduler103;
  need(like?.type==='durable_object','EXISTING_DO_EXPORT_DRIFT');
 }
 const uploaded=source?.modules;
 need(Array.isArray(uploaded)&&uploaded.length===prepared.length,
  'UPLOADED_MODULE_COUNT_DRIFT');
 const lookup=new Map(uploaded.map(x=>[x.name,sha(Buffer.from(x.content_base64||'','base64'))]));
 for(const part of prepared){
  need(lookup.get(part.name)===sha(Buffer.from(part.content_base64,'base64')),
   'MODULE_CODE_DRIFT_'+part.name);
 }
 await assertActive(token);
 const proof={
  activeVersion:ACTIVE,candidateVersion:candidate,trafficSwitched:false,
  uploadedModuleCount:prepared.length,inheritedBindingCount:23,
  currentLikeDoPreserved:true,newDoClasses:0,noMigrations:true,
  privateEntrypointNamed:'OwnerFollowReplayEntrypoint607',
  noServiceBindingOrSecretConfigured:true,
  actualCanaryDelivery:'NOT_ENABLED',
  serverAndBrowserUserTests:'NOT_PERFORMED',deployDecision:'HOLD',
 };
 if(process.env.RUNNER_TEMP)writeFileSync(
  join(process.env.RUNNER_TEMP,'app612-version-metadata.json'),
  JSON.stringify(proof,null,2)+'\n',{mode:0o600});
 console.log('APP612_INHERITED_23_BASELINE_BINDINGS=PASS');
 console.log('APP612_MODULES_AND_PRIVATE_ENTRYPOINT_CODE_IDENTITY=PASS');
 console.log('APP612_NO_DO_MIGRATION_OR_REAL_TRAFFIC=PASS');
 console.log('APP612_EXISTING_ACTIVE_100_PERCENT=PASS');
 console.log('APP612_WORKER_ACTIVATION=HOLD_RECEIVER_AND_CLIENT_OFF');
}
if(process.argv[2]==='--upload-once')await release();
else if(process.argv[2]==='--self-test'){
 const p=readFileSync(new URL('../cloudflare/explore-worker/experiments/owner-follow-entry-607.mjs',import.meta.url),'utf8');
 need(p.includes('OwnerFollowReplayEntrypoint607')&&
  p.includes('SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607')&&
  p.includes("url.pathname==='/internal/owner-follow/epoch-544'")&&
  p.includes('handleOwnerEpochBinding544({'),'SOURCE_FENCE_INVALID');
 console.log('APP612_NONDEPLOY_VERSION_UPLOAD_GUARD=PASS');
}else throw Error('APP612_UNAUTHORIZED_MODE');

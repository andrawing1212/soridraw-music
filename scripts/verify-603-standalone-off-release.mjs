// APP603 one-shot independent OFF Worker release gate; never upload Explore Worker.
// Only --preflight/--postflight may make Cloudflare requests and both use GET.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const ACTIVE='350ce33d-ec83-49d0-a4ae-c25d2d90f59e';
const NAME='soridraw-owner-follow-preview-candidate';
const BRANCH='refs/heads/feat/app600-owner-standalone-isolated';
const RUNTIME_DATE='2026-08-28';
const configPath=new URL('../cloudflare/owner-follow-worker/wrangler.candidate.jsonc',import.meta.url);
const workerPath=new URL('../cloudflare/owner-follow-worker/worker.mjs',import.meta.url);
const parentSHA=/^[0-9a-f]{40}$/;
const fail=(why)=>{throw Error('APP603_HOLD_'+why)};
const check=(v,why)=>{if(!v)fail(why)};
const names=rows=>(Array.isArray(rows)?rows:[]).map(x=>String(x.name||'')).sort();
function validateSource(){
 const c=JSON.parse(readFileSync(configPath,'utf8'));
 const code=readFileSync(workerPath,'utf8');
 check(c.name===NAME&&c.main==='./worker.mjs','WRONG_STANDALONE_TARGET');
 check(c.compatibility_date===RUNTIME_DATE,'BAD_COMPAT_DATE');
 check(c.workers_dev===false,'PUBLIC_WORKERS_DEV_FORBIDDEN');
 check(Array.isArray(c.triggers?.crons)&&c.triggers.crons.length===0,'CRON_FORBIDDEN');
 for(const k of ['routes','route','services','d1_databases','r2_buckets',
   'queues','kv_namespaces','dispatch_namespaces','assets','unsafe','secrets','tail_consumers'])
  check(c[k]===undefined,'UNEXPECTED_CONFIG_'+k);
 check(JSON.stringify(c.vars)==='{"SORIDRAW_ENVIRONMENT":"preview"}',
  'UNEXPECTED_VARS');
 check(c.durable_objects?.bindings?.length===1&&
  c.durable_objects.bindings[0].name==='OWNER_FOLLOW_DO_600'&&
  c.durable_objects.bindings[0].class_name==='OwnerFollowerStandalone600',
  'DO_BINDING_MISMATCH');
 check(c.migrations?.length===1&&c.migrations[0].tag==='owner600_v1'&&
  JSON.stringify(c.migrations[0].new_sqlite_classes)==='["OwnerFollowerStandalone600"]',
  'EXCLUSIVE_OWNER_DO_SQLITE_V1_REQUIRED');
 check(!code.includes('export const APP600_OWNER_WORKER_COMPILED_OPEN = true'),
  'COMPILE_GATE_ENABLED');
 check(code.includes('export const APP600_OWNER_WORKER_COMPILED_OPEN = false;'),
  'OFF_GATE_REQUIRED');
 check(code.includes('export class OwnerFollowerStandalone600'),'DO_NOT_EXPORTED');
 check(code.includes('export default {fetch(request, env) { return handleOwnerWorker600(request, env); }};'),
  'ENTRY_NOT_OFF_WRAPPED');
 return c;
}
async function fetchCloud(path,{allow404=false}={}){
 const url='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path;
 const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
 check(token.length>15,'READ_TOKEN_UNAVAILABLE');
 const resp=await fetch(url,{method:'GET',headers:{
  'Authorization':'Bearer '+token,'Accept':'application/json'
 },signal:AbortSignal.timeout(20000)});
 if(allow404&&resp.status===404)return null;
 check(resp.ok,'CLOUDFLARE_GET_HTTP_'+resp.status);
 const json=await resp.json();
 check(json?.success===true,'CLOUDFLARE_API_RESULT_NOT_SUCCESS');
 return json.result;
}
async function previewPinned(){
 const result=await fetchCloud('workers/scripts/soridraw-explore-preview/deployments?per_page=1');
 const deployment=result?.deployments?.[0];
 check(deployment?.versions?.length===1&&
  deployment.versions[0].version_id===ACTIVE&&
  Number(deployment.versions[0].percentage)===100,'EXPLORE_ACTIVE_DRIFT');
 return ACTIVE;
}
async function preflight(){
 validateSource();
 check(process.env.GITHUB_REF===BRANCH,'UNAPPROVED_REF');
 check(process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT,'ACCOUNT_MISMATCH');
 check(parentSHA.test(String(process.env.APP603_APPROVED_PARENT||'')),
  'APPROVED_SOURCE_SHA_MISSING');
 await previewPinned();
 // Never overwrite a prior Worker, even when it looks like our candidate:
 // a formerly created namespace or a separately modified script is protected.
 const existing=await fetchCloud('workers/scripts/'+NAME+'/settings',{allow404:true});
 const prior=await fetchCloud('workers/scripts/'+NAME+'/deployments?per_page=1',{allow404:true});
 check(existing===null&&prior===null,'STANDALONE_WORKER_ALREADY_EXISTS');
 console.log('APP603_EXISTING_EXPLORE_ACTIVE_FROZEN=PASS');
 console.log('APP603_NEW_WORKER_NAME_ABSENT=PASS');
 console.log('APP603_EXCLUSIVE_OFF_NEW_SQLITE_DO_PLAN=PASS');
 console.log('APP603_PREFLIGHT_GET_ONLY=PASS');
}
async function postflight(){
 validateSource();
 await previewPinned();
 const result=await fetchCloud('workers/scripts/'+NAME+'/deployments?per_page=1');
 const deployment=result?.deployments?.[0];
 check(deployment?.versions?.length===1&&
  Number(deployment.versions[0].percentage)===100,'OFF_WORKER_NOT_FULLY_DEPLOYED');
 const id=String(deployment.versions[0].version_id||'');
 check(/^[0-9a-f-]{36}$/.test(id),'OFF_WORKER_VERSION_INVALID');
 const settings=await fetchCloud('workers/scripts/'+NAME+'/settings');
 check(settings&&Array.isArray(settings.bindings),'STANDALONE_BINDINGS_UNREADABLE');
 check(JSON.stringify(names(settings.bindings))===
  JSON.stringify(['OWNER_FOLLOW_DO_600','SORIDRAW_ENVIRONMENT'].sort()),
  'OFF_WORKER_UNEXPECTED_BINDINGS');
 const obj=settings.bindings.find(x=>x.name==='OWNER_FOLLOW_DO_600');
 check(obj?.type==='durable_object_namespace'&&
  obj.class_name==='OwnerFollowerStandalone600','STANDALONE_DO_CLASS_MISMATCH');
 const env=settings.bindings.find(x=>x.name==='SORIDRAW_ENVIRONMENT');
 check(env?.type==='plain_text'&&env.text==='preview','STANDALONE_ENV_CHANGED');
 const metadata=await fetchCloud('workers/scripts/'+NAME+'/versions/'+id);
 const runtime=metadata?.resources?.script_runtime||{};
 check(runtime.compatibility_date===RUNTIME_DATE,'RUNTIME_DATE_MISMATCH');
 check(runtime.migration_tag==='owner600_v1','STANDALONE_DO_MIGRATION_UNPROVEN');
 const forbidden=(metadata.resources?.bindings||[]).filter(b=>!['OWNER_FOLLOW_DO_600',
  'SORIDRAW_ENVIRONMENT'].includes(b.name));
 check(!forbidden.length,'PINNED_VERSION_UNEXPECTED_BINDINGS');
 // A new Worker is not a fully tested service until a Service Binding
 // exists. This is OFF-only infrastructure, no user-facing integration.
 console.log('APP603_NEW_WORKER_100_PERCENT_ACTIVE_VERSION='+id);
 console.log('APP603_NEW_WORKER_OFF_BINDING_SET_EXACT=PASS');
 console.log('APP603_NEW_DO_SQLITE_V1_CONFIRMED=PASS');
 console.log('APP603_EXISTING_EXPLORE_ACTIVE_STILL_UNCHANGED=PASS');
 console.log('APP603_NO_SHARED_DATA_OR_FIREBASE_BINDINGS=PASS');
 console.log('APP603_REAL_OWNER_FOLLOW_SYNC=NOT_ENABLED');
}
const mode=process.argv[2];
if(mode==='--self-test'){
 const conf=validateSource();
 assert.equal(conf.workers_dev,false);
 assert.equal(conf.migrations[0].new_sqlite_classes[0],'OwnerFollowerStandalone600');
 console.log('APP603_OFFLINE_RELEASE_CONTRACT=PASS');
}else if(mode==='--preflight')await preflight();
else if(mode==='--postflight')await postflight();
else fail('UNKNOWN_MODE');

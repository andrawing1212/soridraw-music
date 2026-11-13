// APP602 - exact deployed-version read-only Worker release preflight.
// No deploy, upload, migration, R2/D1/DO request, source write, or user data access.
// Only GET Cloudflare metadata, never print/store binding values or API tokens.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const WORKER='soridraw-explore-preview';
const ACTIVE='350ce33d-ec83-49d0-a4ae-c25d2d90f59e';
const PREVIOUS='332ca384-725d-46aa-8824-e19a3543bed8';
const EXPECTED_DATE='2026-08-28';
const EXTRAS=[
 'BOOTSTRAP_TOKEN','ENV_NAME','EXPLORE_MIRROR_TOKEN','PROD_BASE',
 'SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019','SORIDRAW_NOTIFICATION_RETENTION_013',
 'SORIDRAW_NOTIFICATION_SCHEMA_READY_013','SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET',
 'TARGET_BASE'
].sort();
const check=(x,why)=>{if(!x)throw Error('APP602_HOLD_'+why)};
const sorted=xs=>[...xs].sort();
const key=b=>String(b?.name||'')+'|'+String(b?.type||'');
const mapByName=(items,why)=>{
 check(Array.isArray(items),why+'_NOT_ARRAY');
 const map=new Map();
 for(const x of items){
  check(x&&typeof x.name==='string'&&x.name.length>0&&
    typeof x.type==='string'&&x.type.length>0,why+'_BAD_ENTRY');
  check(!map.has(x.name),why+'_DUPLICATE');
  map.set(x.name,x);
 }
 return map;
};
const declaredBindings=conf=>new Map([
 ...Object.keys(conf.vars||{}).map(name=>[name,'plain_text']),
 ...(conf.d1_databases||[]).map(x=>[x.binding,'d1']),
 ...(conf.r2_buckets||[]).map(x=>[x.binding,'r2_bucket']),
 ...(conf.ratelimits||[]).map(x=>[x.name,'ratelimit']),
 ...(conf.durable_objects?.bindings||[]).map(x=>[x.name,'durable_object_namespace']),
]);
const compareBindings=(configuration,live,version)=>{
 const candidate=structuredClone(configuration);
 check(candidate.name===WORKER,'WRONG_WORKER');
 check(candidate.compatibility_date===EXPECTED_DATE,'CHECKED_IN_COMPAT_DRIFT');
 check(candidate.keep_vars===true,'KEEP_VARS_MISSING');
 // This is a source-only release planning manifest. No Wrangler deploy may
 // use the checked-in canonical config because it contains DO v2.
 check(candidate.migrations?.length===2 &&
  candidate.migrations[0]?.tag==='v1' &&
  JSON.stringify(candidate.migrations[0].new_sqlite_classes)==='["ExploreLikeBatchScheduler103"]' &&
  candidate.migrations[1]?.tag==='v2' &&
  JSON.stringify(candidate.migrations[1].new_sqlite_classes)==='["OwnerFollowerRecovery557"]',
  'UNEXPECTED_SOURCE_MIGRATION_HISTORY');
 check(candidate.durable_objects?.bindings?.length===2,'SOURCE_DO_BINDINGS_DRIFT');
 candidate.migrations=[candidate.migrations[0]];
 candidate.durable_objects.bindings=candidate.durable_objects.bindings.filter(
  x=>x.name==='EXPLORE_LIKE_BATCH_SCHEDULER'&&
     x.class_name==='ExploreLikeBatchScheduler103');
 check(candidate.durable_objects.bindings.length===1,'LIKE_DO_ONLY_REQUIRED');
 check(candidate.migrations.length===1&&candidate.migrations[0].tag==='v1','V2_NOT_REMOVED');
 check(!JSON.stringify(candidate).includes('OwnerFollowerRecovery557'),'OLD_WORKER_OWNER_DO_REMAINS');
 // Keep runtime flags, cron, existing bind definitions and code path intact.
 const listed=declaredBindings(candidate);
 const latest=mapByName(live,'SCRIPT_SETTINGS');
 const pinned=mapByName(version,'ACTIVE_VERSION');
 check(latest.size===23,'LIVE_BINDING_COUNT_CHANGED');
 check(pinned.size===23,'ACTIVE_VERSION_BINDING_COUNT_CHANGED');
 check(sorted([...latest.values()].map(key)).join('\n')===
  sorted([...pinned.values()].map(key)).join('\n'),
  'SCRIPT_SETTINGS_DIFFER_FROM_ACTIVE_VERSION');
 for(const [name,type] of listed){
  check(latest.get(name)?.type===type,'KNOWN_BINDING_'+name+'_TYPE_DRIFT');
 }
 const extra=sorted([...latest.keys()].filter(n=>!listed.has(n)));
 check(JSON.stringify(extra)===JSON.stringify(EXTRAS),'UNDECLARED_BINDING_SET_DRIFT');
 check(listed.size===14 && extra.length===9,'BINDING_ACCOUNTING_DRIFT');
 check(!latest.has('OWNER_FOLLOW_RECOVERY_557'),'OLD_WORKER_OWNER_DO_ALREADY_BOUND');
 check(!latest.has('OWNER_FOLLOW_RESERVATION_SERVICE_600'),'SERVICE_ALREADY_PRESENT');
 check(!latest.has('SORIDRAW_OWNER_DO_BRIDGE_SECRET_600'),'CAPABILITY_ALREADY_PRESENT');
 for(const x of candidate.d1_databases||[]){
  const b=latest.get(x.binding);
  check(String(b?.id||b?.database_id||b?.uuid||'')===x.database_id,'D1_BINDING_TARGET_CHANGED');
 }
 for(const x of candidate.r2_buckets||[]){
  const b=latest.get(x.binding);
  check(String(b?.bucket_name||b?.bucket||'')===x.bucket_name,'R2_BINDING_TARGET_CHANGED');
 }
 check(latest.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.class_name==='ExploreLikeBatchScheduler103',
  'LIKE_DO_CLASS_CHANGED');
 const rate=latest.get('LIKE_RATE_LIMITER');
 check(rate?.type==='ratelimit','RATE_BINDING_MISSING');
 if(rate.namespace_id!==undefined)
  check(String(rate.namespace_id)===String(candidate.ratelimits[0].namespace_id),
   'RATE_NAMESPACE_DRIFT');
 check(latest.get('SORIDRAW_ENVIRONMENT')?.text==='preview','NOT_PREVIEW_ENV');
 // Metadata equality DOES NOT expose runtime secret values. New candidate
 // binding preservation must be pinned to the active version; keep_vars is
 // not affirmative proof of all nine dashboard-only entries.
 return {candidate,baselineBindingCount:latest.size,
  configuredBindingCount:listed.size,undeclaredCount:extra.length,
  namesTypesMatchActiveVersion:true,
  requiredInheritFromActive:sorted([...latest.keys()]),
  missingFromCheckin:extra};
};
const versionRuntime=(metadata)=>{
 check(metadata?.result?.id===ACTIVE,'VERSION_ID_DRIFT');
 const resources=metadata.result?.resources;
 check(resources&&typeof resources==='object','VERSION_RESOURCES_MISSING');
 const runtime=resources.script_runtime||{};
 check(runtime.compatibility_date===EXPECTED_DATE,'ACTIVE_COMPATIBILITY_DATE_CHANGED');
 check(runtime.compatibility_flags===undefined||runtime.compatibility_flags===null||
  Array.isArray(runtime.compatibility_flags),'COMPATIBILITY_FLAGS_MALFORMED');
 const migrationTag=String(runtime.migration_tag||'');
 check(migrationTag!=='v2','OWNER_DO_V2_ALREADY_APPLIED');
 check(migrationTag==='v1','EXISTING_DO_TAG_UNPROVEN');
 const bindings=resources.bindings;
 check(Array.isArray(bindings),'PINNED_VERSION_BINDINGS_MISSING');
 return {bindings,compatibilityDate:runtime.compatibility_date,
  compatibilityFlags:runtime.compatibility_flags??[],migrationTag};
};
function pinnedInheritPlan602(names){
 check(Array.isArray(names)&&names.length===23,'INHERIT_SOURCE_23_REQUIRED');
 check(new Set(names).size===23,'INHERIT_DUPLICATE');
 // The beta Workers version API permits exact version_id inheritance.
 // The legacy /workers/scripts versions upload silently uses "latest"
 // and is NOT valid for this pinned rollback-safe plan.
 return sorted(names).map(name=>({name,type:'inherit',version_id:ACTIVE}));
}
function selfTest(){
 const conf=JSON.parse(readFileSync(new URL(
  '../cloudflare/explore-worker/canonical/wrangler.preview.jsonc',import.meta.url),'utf8'));
 const items=[
  ...Object.entries(conf.vars).map(([name,text])=>({name,type:'plain_text',text})),
  ...conf.d1_databases.map(x=>({name:x.binding,type:'d1',id:x.database_id})),
  ...conf.r2_buckets.map(x=>({name:x.binding,type:'r2_bucket',bucket_name:x.bucket_name})),
  {name:'EXPLORE_LIKE_BATCH_SCHEDULER',type:'durable_object_namespace',
   class_name:'ExploreLikeBatchScheduler103'},
  {name:'LIKE_RATE_LIMITER',type:'ratelimit',namespace_id:'91054'},
  ...EXTRAS.map(name=>({name,type:name.includes('TOKEN')||name.includes('SECRET')
   ?'secret_text':'plain_text',text:'synthetic-only'})),
 ];
 assert.equal(items.length,23);
 const result=compareBindings(conf,items,structuredClone(items));
 assert.equal(result.candidate.migrations.length,1);
 assert.equal(result.candidate.durable_objects.bindings.length,1);
 assert.equal(result.configuredBindingCount,14);
 assert.equal(result.undeclaredCount,9);
 assert.equal(result.baselineBindingCount,23);
 const inherit=pinnedInheritPlan602(result.requiredInheritFromActive);
 assert.equal(inherit.length,23);
 assert.ok(inherit.every(x=>x.type==='inherit'&&x.version_id===ACTIVE));
 assert.equal(inherit.find(x=>x.name==='EXPLORE_LIKE_BATCH_SCHEDULER')?.version_id,ACTIVE);
 assert.deepEqual(result.missingFromCheckin,EXTRAS);
 const drift=structuredClone(items);drift[0].type='secret_text';
 assert.throws(()=>compareBindings(conf,items,drift),/SCRIPT_SETTINGS_DIFFER_FROM_ACTIVE_VERSION/);
 const extra=items.filter(x=>x.name!==EXTRAS[0]);
 assert.throws(()=>compareBindings(conf,extra,extra),/LIVE_BINDING_COUNT_CHANGED/);
 const oldDO=[...items,{name:'OWNER_FOLLOW_RECOVERY_557',type:'durable_object_namespace'}];
 assert.throws(()=>compareBindings(conf,oldDO,oldDO),/LIVE_BINDING_COUNT_CHANGED/);
 const fakeVersion={result:{id:ACTIVE,resources:{
  script_runtime:{compatibility_date:EXPECTED_DATE,compatibility_flags:[],migration_tag:'v1'},
  bindings:items,
 }}};
 assert.equal(versionRuntime(fakeVersion).migrationTag,'v1');
 fakeVersion.result.resources.script_runtime.migration_tag='v2';
 assert.throws(()=>versionRuntime(fakeVersion),/OWNER_DO_V2_ALREADY_APPLIED/);
 fakeVersion.result.resources.script_runtime.migration_tag='v1';
 fakeVersion.result.resources.script_runtime.compatibility_date='2026-08-06';
 assert.throws(()=>versionRuntime(fakeVersion),/ACTIVE_COMPATIBILITY_DATE_CHANGED/);
 console.log('APP602_OFFLINE_NO_V2_MIGRATION_SOURCE_CANDIDATE=PASS');
 console.log('APP602_OFFLINE_23_BINDING_INHERIT_CONTRACT=PASS');
 console.log('APP602_OFFLINE_DRIFT_AND_RUNTIME_FAIL_CLOSED=PASS');
 console.log('APP602_OFFLINE_PINNED_VERSION_23_BINDING_INHERIT_PLAN=PASS');
}
async function cfGet(path,token){
 const uri='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path;
 const response=await fetch(uri,{method:'GET',headers:{Authorization:'Bearer '+token,
  Accept:'application/json'},signal:AbortSignal.timeout(15000)});
 check(response.ok,'READ_HTTP_'+response.status);
 const data=await response.json();
 check(data?.success!==false,'READ_RESPONSE_REJECTED');
 return data;
}
async function live(){
 const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
 check(token.length>15,'MISSING_READ_TOKEN');
 check(process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT,'ACCOUNT_ID_MISMATCH');
 check(process.env.GITHUB_REF==='refs/heads/feat/app600-owner-standalone-isolated',
  'UNAUTHORIZED_BRANCH');
 const root='workers/scripts/'+WORKER;
 const deployments=await cfGet(root+'/deployments?per_page=10',token);
 const ds=deployments.result?.deployments||[];
 check(ds.length>1&&ds[0].versions?.length===1&&
  ds[0].versions[0].version_id===ACTIVE&&
  Number(ds[0].versions[0].percentage)===100,'ACTIVE_DEPLOYMENT_CHANGED');
 check(ds.slice(1).some(x=>x.versions?.some(v=>v.version_id===PREVIOUS)),
  'HISTORICAL_ROLLBACK_TARGET_NOT_IN_HISTORY');
 const detail=await cfGet(root+'/versions/'+ACTIVE,token);
 const runtime=versionRuntime(detail);
 // This endpoint can show recently uploaded settings not active; never
 // consider it authoritative without the exact pinned version comparison.
 const settings=(await cfGet(root+'/settings',token)).result;
 const conf=JSON.parse(readFileSync(new URL(
  '../cloudflare/explore-worker/canonical/wrangler.preview.jsonc',import.meta.url),'utf8'));
 const compared=compareBindings(conf,settings?.bindings,runtime.bindings);
 const previous=(await cfGet(root+'/versions/'+PREVIOUS,token)).result;
 check(previous?.id===PREVIOUS,'PREVIOUS_METADATA_NOT_FOUND');
 const after=await cfGet(root+'/deployments?per_page=1',token);
 check(after.result?.deployments?.[0]?.versions?.length===1&&
  after.result.deployments[0].versions[0].version_id===ACTIVE,
  'ACTIVE_CHANGED_DURING_READ');
 const evidence={
  scope:'APP602_GET_ONLY_NO_DEPLOY',
  activeWorker:WORKER,activeVersion:ACTIVE,rollbackCandidate:PREVIOUS,
  activeMigrationTag:runtime.migrationTag,
  activeCompatibilityDate:runtime.compatibilityDate,
  activeCompatibilityFlags:runtime.compatibilityFlags,
  activeVersionBindingsMatchScriptSettings:compared.namesTypesMatchActiveVersion,
  activeBindingCount:compared.baselineBindingCount,
  knownCodeConfigBindings:compared.configuredBindingCount,
  dashboardOnlyUnresolved:compared.undeclaredCount,
  // Only names, never values. No authorization or secret material.
  unresolvedBindingNames:compared.missingFromCheckin,
  preserveBindingIdentitiesByExactActiveVersion:true,
  futureBetaVersionUploadOnly:true,
  pinnedBindingInheritancePlan:pinnedInheritPlan602(compared.requiredInheritFromActive),
  inheritedBindingValuesNotMaterialized:true,
  liveSecretValuesVerified:false,
  upgradeRunnable:false,
  existingWorkerDoLifecycleMigration:'NONE_PLANNED',
  oldWorkerLikeDoClass:'ExploreLikeBatchScheduler103',
  oldWorkerExistingV1Only:true,
  newOwnerWorker:'SEPARATE_NOT_DEPLOYED',
  rollbackSafety:'STRUCTURAL_NO_LIFECYCLE_CHANGE_ONLY; NOT EXECUTED',
  prospectiveServiceBindings:'NOT_CONFIGURED',
  expectedRuntimeParity:'NOT_PROVEN',
  deployDecision:'HOLD',
 };
 const temp=process.env.RUNNER_TEMP;
 if(temp)writeFileSync(join(temp,'app602-readonly-evidence.json'),
  JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
 console.log('APP602_ACTIVE_VERSION_METADATA_AND_SETTINGS_NAME_TYPE_PARITY=PASS');
 console.log('APP602_ACTIVE_BINDING_COUNT='+evidence.activeBindingCount);
 console.log('APP602_DASHBOARD_ONLY_BINDINGS_UNRESOLVED='+evidence.dashboardOnlyUnresolved);
 console.log('APP602_PINNED_23_BINDING_INHERIT_SOURCE_PLAN=PASS_NOT_UPLOADED');
 console.log('APP602_EXISTING_LIKE_DO_V1_NO_OWNER_V2=PASS');
 console.log('APP602_ACTIVE_COMPAT_DATE='+evidence.activeCompatibilityDate);
 console.log('APP602_ROLLBACK_PREVIOUS_VERSION_EXISTS_NOT_EXECUTED=PASS');
 console.log('APP602_DEPLOY_ELIGIBILITY=HOLD');
 console.log('APP602_CLOUDFLARE_GET_ONLY_NO_LIVE_CHANGES=PASS');
}
if(process.argv[2]==='--self-test')selfTest();
else if(process.argv[2]==='--live-readonly')await live();
else throw Error('APP602_EXPECTED_SELF_TEST_OR_LIVE_READONLY');

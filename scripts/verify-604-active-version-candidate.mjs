// APP604: read-only active Worker byte/binding/runtime attestation.
// No active source bytes, secret values or user data are logged or stored.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const NAME='soridraw-explore-preview';
const ACTIVE='350ce33d-ec83-49d0-a4ae-c25d2d90f59e';
const FINGERPRINT='82f8ffb762f8fd55f5a6284333db220dca9790981bbec91d8d6d18c102617065';
const EXPECTED_RUNTIME='2026-08-28';
const REF='refs/heads/feat/app600-owner-standalone-isolated';
const sha256=buffer=>createHash('sha256').update(buffer).digest('hex');
const need=(condition,why)=>{if(!condition)throw Error('APP604_HOLD_'+why)};
const key=b=>String(b?.name||'')+':'+String(b?.type||'');
function normalizedBindings(items,label){
 need(Array.isArray(items),label+'_NOT_ARRAY');
 const map=new Map();
 for(const b of items){
  need(b&&typeof b.name==='string'&&b.name.length>0&&
   typeof b.type==='string'&&b.type.length>0&&!map.has(b.name),
   label+'_DUPLICATE_OR_MALFORMED');
  map.set(b.name,b);
 }
 need(map.size===23,label+'_NOT_23');
 need(map.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.class_name==='ExploreLikeBatchScheduler103',
  label+'_EXISTING_LIKE_DO_MISMATCH');
 need(!map.has('OWNER_FOLLOW_RECOVERY_557'),label+'_UNSAFE_OWNER_DO_V2');
 need(!map.has('OWNER_FOLLOW_RESERVATION_SERVICE_600'),label+'_UNAPPROVED_SERVICE');
 return map;
}
function verifyBindings(settings,active){
 const a=normalizedBindings(settings,'SETTINGS');
 const b=normalizedBindings(active,'ACTIVE');
 need([...a.keys()].sort().map(n=>key(a.get(n))).join('\n')===
  [...b.keys()].sort().map(n=>key(b.get(n))).join('\n'),
 'ACTIVE_AND_SETTINGS_DIFFER');
 for(const name of a.keys()){
  const one=a.get(name),two=b.get(name);
  if(one.type==='d1')
   need(String(one.id||one.database_id||one.uuid)===
    String(two.id||two.database_id||two.uuid),'D1_TARGET_DRIFT');
  if(one.type==='r2_bucket')
   need(String(one.bucket_name||one.bucket)===
    String(two.bucket_name||two.bucket),'R2_TARGET_DRIFT');
  if(one.type==='durable_object_namespace')
   need(one.class_name===two.class_name,'DO_CLASS_DRIFT');
 }
 need(a.get('SORIDRAW_ENVIRONMENT')?.text==='preview','PREVIEW_ENV_DRIFT');
 return {count:23,names:[...a.keys()].sort(),
  secretNames:[...a.values()].filter(x=>x.type==='secret_text').map(x=>x.name).sort()};
}
function inspectVersion(version,source,settings){
 need(version?.id===ACTIVE,'ACTIVE_VERSION_ID_CHANGED');
 const resources=version.resources;
 need(resources&&typeof resources==='object','ACTIVE_RESOURCES_MISSING');
 const runtime=resources.script_runtime||{};
 need(runtime.compatibility_date===EXPECTED_RUNTIME,'ACTIVE_DATE_MISMATCH');
 need(runtime.migration_tag==='v1','OLD_DO_MIGRATION_NOT_V1');
 need(runtime.compatibility_flags===undefined||Array.isArray(runtime.compatibility_flags),
  'ACTIVE_RUNTIME_FLAGS_INVALID');
 const bind=verifyBindings(settings,resources.bindings);
 need(source?.id===ACTIVE,'CODE_SOURCE_VERSION_MISMATCH');
 const modules=source.modules;
 need(Array.isArray(modules)&&modules.length===1,'MODULE_COUNT_NOT_ONE');
 const hashes=modules.map(m=>{
  need(typeof m.name==='string'&&m.name.length>0&&
   typeof m.content_base64==='string'&&m.content_base64.length>5000,
   'MODULE_CONTENT_MISSING');
  const bytes=Buffer.from(m.content_base64,'base64');
  need(bytes.length>5000,'MODULE_TOO_SMALL');
  const fingerprint={name:m.name,sha256:sha256(bytes),bytes:bytes.length};
  return {...fingerprint,contentType:m.content_type||null};
 }).sort((a,b)=>a.name.localeCompare(b.name));
 const aggregate=sha256(JSON.stringify(hashes.map(({name,sha256,bytes})=>
  ({name,sha256,bytes}))));
 need(aggregate===FINGERPRINT,'SOURCE_FINGERPRINT_DRIFT');
 const exportMap=resources.exports||version.exports||null;
 const names=exportMap&&typeof exportMap==='object'?Object.keys(exportMap).sort():[];
 need(!names.includes('OwnerFollowerRecovery557'),'UNSAFE_DO_EXPORT_EXISTS');
 const script=resources.script||{};
 const declaredMain=String(script.main_module||version.main_module||
  source.main_module||'');
 if(declaredMain)need(declaredMain===hashes[0].name,'MAIN_MODULE_MISMATCH');
 const migrations=version.migrations||resources.migrations||null;
 if(migrations)need(!JSON.stringify(migrations).includes('OwnerFollowerRecovery557'),
  'UNSAFE_DO_MIGRATIONS_PRESENT');
 return {active:ACTIVE,main:hashes[0].name,moduleSha256:hashes[0].sha256,
  moduleBytes:hashes[0].bytes,moduleContentType:hashes[0].contentType,
  aggregateSourceSha256:aggregate,flags:runtime.compatibility_flags||[],
  migrationTag:runtime.migration_tag,exportClassNames:names,
  hasExports:!!exportMap,hasExplicitMain:!!declaredMain,
  hasMigrations:!!migrations,bindingCount:bind.count,
  bindingNames:bind.names,secretCount:bind.secretNames.length};
}
function selfTest(){
 const base=[...Array.from({length:21},(_,i)=>({name:'F'+i,type:'plain_text'})),
  {name:'EXPLORE_LIKE_BATCH_SCHEDULER',type:'durable_object_namespace',
   class_name:'ExploreLikeBatchScheduler103'},
  {name:'SORIDRAW_ENVIRONMENT',type:'plain_text',text:'preview'}];
 assert.equal(verifyBindings(base,structuredClone(base)).count,23);
 assert.throws(()=>verifyBindings(base,base.slice(1)),/ACTIVE_NOT_23/);
 assert.throws(()=>verifyBindings(base,[...base.slice(0,22),
  {name:'OWNER_FOLLOW_RECOVERY_557',type:'durable_object_namespace'}]),
  /UNSAFE_OWNER_DO_V2/);
 console.log('APP604_OFFLINE_23_BINDING_DRIFT_FENCE=PASS');
 console.log('APP604_OFFLINE_UNSAFE_OWNER_V2_REJECTED=PASS');
}
async function getApi(path,token){
 const url='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path;
 const response=await fetch(url,{method:'GET',headers:{
  Authorization:'Bearer '+token,Accept:'application/json'
 },signal:AbortSignal.timeout(20000)});
 need(response.ok,'CLOUDFLARE_HTTP_'+response.status);
 const payload=await response.json();
 need(payload?.success===true,'CLOUDFLARE_RESPONSE_FAIL');
 return payload.result;
}
async function readActive(token){
 const route='workers/scripts/'+NAME;
 const deployments=await getApi(route+'/deployments?per_page=1',token);
 const vers=deployments?.deployments?.[0]?.versions;
 need(Array.isArray(vers)&&vers.length===1&&
  vers[0].version_id===ACTIVE&&Number(vers[0].percentage)===100,
 'ACTIVE_DEPLOYMENT_CHANGED');
 return vers[0].version_id;
}
async function inspect(){
 need(process.env.GITHUB_REF===REF,'UNAPPROVED_GITHUB_REF');
 need(process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT,'ACCOUNT_ID_MISMATCH');
 const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
 need(token.length>15,'READ_TOKEN_MISSING');
 await readActive(token);
 const route='workers/scripts/'+NAME;
 const [settings,metadata,source]=await Promise.all([
  getApi(route+'/settings',token),
  getApi(route+'/versions/'+ACTIVE,token),
  getApi('workers/workers/'+NAME+'/versions/'+ACTIVE+'?include=modules',token),
 ]);
 const proof=inspectVersion(metadata,source,settings.bindings);
 await readActive(token);
 const artifact={...proof,worker:NAME,observedOnly:true,
  uploadRequestMayBeBuilt:false,deploymentChanged:false,noDataAccess:true,
  cloudflareOperation:'GET_ONLY',decision:'HOLD_UNTIL_PROOF_REVIEWED'};
 if(process.env.RUNNER_TEMP)writeFileSync(
  process.env.RUNNER_TEMP+'/app604-source-proof.json',
  JSON.stringify(artifact,null,2)+'\n',{mode:0o600});
 console.log('APP604_PINNED_ACTIVE_SOURCE_EXACT_SHA256=PASS');
 console.log('APP604_ACTIVE_CODE_MODULE_BYTES='+proof.moduleBytes);
 console.log('APP604_SOURCE_MAIN_MODULE='+proof.main);
 console.log('APP604_HAS_DECLARED_MAIN='+proof.hasExplicitMain);
 console.log('APP604_ACTIVE_EXPORTS_METADATA_PRESENT='+proof.hasExports);
 console.log('APP604_EXPORT_CLASS_COUNT='+proof.exportClassNames.length);
 console.log('APP604_MIGRATIONS_METADATA_PRESENT='+proof.hasMigrations);
 console.log('APP604_ACTIVE_23_BINDINGS_NAME_TYPE_PARITY=PASS');
 console.log('APP604_ACTIVE_RUNTIME_AND_DO_V1=PASS');
 console.log('APP604_CLOUDFLARE_GET_ONLY_NO_UPLOAD=PASS');
}
const mode=process.argv[2];
if(mode==='--self-test')selfTest();
else if(mode==='--inspect')await inspect();
else throw Error('APP604_INVALID_MODE');

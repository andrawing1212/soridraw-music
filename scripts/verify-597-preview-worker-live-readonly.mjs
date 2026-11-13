// APP597 live worker release preflight. GET-only; no settings, data or deploy mutation.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFileSync,readFileSync} from 'node:fs';

const account='e1a30fc9ef497fda1d34f4ab3dc1da45';
const workerNames={preview:'soridraw-explore-preview',test:'soridraw-explore-test',production:'soridraw-explore-api'};
const url='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/';
const hash=b=>createHash('sha256').update(b).digest('hex');
const need=(condition,code)=>{if(!condition)throw Error('APP597_HOLD_'+code)};
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
function getDeployment(body){
 const data=body?.result??body;
 const list=data?.deployments??data;
 need(Array.isArray(list)&&list.length>0,'NO_DEPLOYMENTS');
 const v=list[0]?.versions;
 need(Array.isArray(v)&&v.length===1&&Number(v[0].percentage)===100&&uuid.test(String(v[0].version_id||'')),'ACTIVE_NOT_SINGLE_100');
 const old=list.slice(1).flatMap(x=>x.versions||[]).find(x=>uuid.test(String(x.version_id||''))&&x.version_id!==v[0].version_id);
 return {active:v[0].version_id,rollbackCandidate:old?.version_id||''};
}
function inspectBindings(body,config){
 const binds=body?.result?.bindings??body?.bindings;
 need(Array.isArray(binds),'BINDINGS_UNAVAILABLE');
 const map=new Map();
 for(const b of binds){need(b.name&&!map.has(b.name),'DUPLICATE_BINDING');map.set(b.name,b);}
 for(const d of config.d1_databases){
  const b=map.get(d.binding);
  need(b?.type==='d1'&&String(b.id||b.database_id||b.uuid||'')===d.database_id,'D1_BINDING_'+d.binding);
 }
 for(const d of config.r2_buckets){
  const b=map.get(d.binding);
  need(b?.type==='r2_bucket'&&String(b.bucket_name||b.bucket||'')===d.bucket_name,'R2_BINDING_'+d.binding);
 }
 need(map.get('EXPLORE_LIKE_BATCH_SCHEDULER')?.type==='durable_object_namespace','EXISTING_LIKE_DO_MISSING');
 need(map.get('SORIDRAW_ENVIRONMENT')?.text==='preview','NOT_PREVIEW_ENVIRONMENT');
 need(!map.has('OWNER_FOLLOW_RECOVERY_557'),'OWNER_DO_ALREADY_LIVE_REVIEW_FIRST');
 need(![...map.keys()].some(x=>/^SORIDRAW_OWNER_FOLLOW_(CANARY|BIND|W2_PUSH|AUTH_PROOF|ENDPOINT|PUSH)_/.test(x)),'OWNER_SIGNAL_ALREADY_ENABLED');
 return binds.map(x=>({name:x.name,type:x.type})).sort((a,b)=>a.name.localeCompare(b.name));
}
async function get(path,token){
 const r=await fetch(url+path,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(15000)});
 need(r.ok,'CLOUDFLARE_HTTP_'+r.status);
 const o=await r.json();
 need(o?.success!==false,'CLOUDFLARE_API_REJECTED');
 return o;
}
async function main(){
 const mode=process.argv[2];
 need(['--self-test','--live'].includes(mode),'EXPLICIT_MODE_REQUIRED');
 const conf=JSON.parse(readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc','utf8'));
 if(mode==='--self-test'){
  const a='350ce33d-1111-4111-8111-111111111111',b='332ca384-1111-4111-8111-111111111111';
  assert.equal(getDeployment({result:{deployments:[{versions:[{version_id:a,percentage:100}]},{versions:[{version_id:b,percentage:100}]}]}}).active,a);
  assert.throws(()=>getDeployment({result:{deployments:[{versions:[{version_id:a,percentage:50},{version_id:b,percentage:50}]}]}}));
  const binds=[
    {name:'DB',type:'d1',id:conf.d1_databases[0].database_id},
    {name:'RATE_DB',type:'d1',id:conf.d1_databases[1].database_id},
    {name:'PROFILE_MEDIA',type:'r2_bucket',bucket_name:conf.r2_buckets[0].bucket_name},
    {name:'EXPLORE_CACHE',type:'r2_bucket',bucket_name:conf.r2_buckets[1].bucket_name},
    {name:'EXPLORE_LIKE_BATCH_SCHEDULER',type:'durable_object_namespace'},
    {name:'SORIDRAW_ENVIRONMENT',type:'plain_text',text:'preview'}];
  assert.equal(inspectBindings({result:{bindings:binds}},conf).length,6);
  assert.throws(()=>inspectBindings({result:{bindings:[...binds,{name:'OWNER_FOLLOW_RECOVERY_557',type:'durable_object_namespace'}]}},conf));
  assert.throws(()=>inspectBindings({result:{bindings:binds.map(x=>x.name==='DB'?{...x,id:'wrong'}:x)}},conf));
  console.log('APP597_READONLY_SOURCE_SELFTEST=PASS');
  return;
 }
 const token=process.env.CLOUDFLARE_API_TOKEN||'';
 need(token.length>15,'CLOUDFLARE_CREDENTIAL_UNAVAILABLE');
 need(process.env.CLOUDFLARE_ACCOUNT_ID===account,'CLOUDFLARE_ACCOUNT_MISMATCH');
 need(conf.name===workerNames.preview,'WORKER_NAME_MISMATCH');
 const deployed={};
 for(const [env,name] of Object.entries(workerNames)){
  deployed[env]=getDeployment(await get('scripts/'+name+'/deployments?per_page=5',token));
 }
 const worker=workerNames.preview,active=deployed.preview.active;
 const metadata=await get('scripts/'+worker+'/versions/'+active,token);
 need(metadata?.result?.id===active,'ACTIVE_VERSION_METADATA_MISMATCH');
 const settings=inspectBindings(await get('scripts/'+worker+'/settings',token),conf);
 const code=await get('workers/'+worker+'/versions/'+active+'?include=modules',token);
 const modules=code?.result?.modules||[];
 need(Array.isArray(modules)&&modules.length>0,'ACTIVE_CODE_UNAVAILABLE');
 const stamps=modules.map((module,i)=>{
  const binary=Buffer.from(String(module.content_base64||''),'base64');
  need(binary.length>0,'EMPTY_MODULE_'+i);
  return {name:String(module.name||'module-'+i),sha256:hash(binary),bytes:binary.length};
 }).sort((a,b)=>a.name.localeCompare(b.name));
 need(stamps.reduce((a,b)=>a+b.bytes,0)>5000,'ACTIVE_WORKER_CODE_TOO_SMALL');
 need(deployed.preview.rollbackCandidate,'NO_PREVIOUS_ROLLBACK_VERSION');
 const previous=await get('scripts/'+worker+'/versions/'+deployed.preview.rollbackCandidate,token);
 need(previous?.result?.id===deployed.preview.rollbackCandidate,'ROLLBACK_VERSION_NOT_RETRIEVABLE');
 const repeated=getDeployment(await get('scripts/'+worker+'/deployments?per_page=1',token));
 need(repeated.active===active,'DEPLOYMENT_CHANGED_DURING_PREFLIGHT');
 const evidence={
  previewActiveVersion:active,
  matchesEarlierDirectorScreenshot:active.startsWith('350ce33d'),
  previewRollbackCandidate:deployed.preview.rollbackCandidate,
  testActiveVersion:deployed.test.active,
  productionActiveVersion:deployed.production.active,
  sourceModules:stamps,
  sourceAggregateHash:hash(JSON.stringify(stamps)),
  versionContentEtag:String(metadata.result.resources?.script?.etag||''),
  versionMigrationTag:String(metadata.result.resources?.script_runtime?.migration_tag||''),
  versionExports:Object.keys(metadata.result.resources?.script_runtime?.exports||{}).sort(),
  versionNamedHandlers:(metadata.result.resources?.script?.named_handlers||[]).map(x=>x.name),
  liveBindingNamesAndTypes:settings,
  existingLikeDO:'PRESENT',
  newOwnerDO:'ABSENT',
  releaseSourceEquivalence:'UNVERIFIED',
  rollbackViability:'VERSION_RETRIEVABLE_ONLY',
  sharedWrites:0,
 };
 writeFileSync(process.env.RUNNER_TEMP+'/app597-readonly.json',JSON.stringify(evidence,null,2));
 for(const name of ['previewActiveVersion','previewRollbackCandidate','testActiveVersion','productionActiveVersion','sourceAggregateHash'])
  console.log('APP597_'+name+'='+evidence[name]);
 console.log('APP597_BINDINGS='+settings.map(x=>x.name+':'+x.type).join(','));
 console.log('APP597_OWNER_DO=ABSENT; LIKE_DO=PRESENT');
 console.log('APP597_EXACT_RELEASE_SOURCE_EQUIVALENCE=UNVERIFIED; WORKER_DEPLOY=HOLD');
 console.log('APP597_GET_ONLY=PASS; USER_ROWS_WRITES=ZERO');
}
main().catch(e=>{console.error(String(e?.message||e).slice(0,180));process.exitCode=2;});

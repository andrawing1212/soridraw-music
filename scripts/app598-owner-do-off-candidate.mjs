// APP598: build a byte-preserving dormant Owner DO candidate, never deploy.
// Remote operations: Cloudflare GET only. All candidate files stay in RUNNER_TEMP.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const WORKER='soridraw-explore-preview';
const VERSION='350ce33d-ec83-49d0-a4ae-c25d2d90f59e';
const PREVIOUS='332ca384-725d-46aa-8824-e19a3543bed8';
const ACTIVE_DIGEST='82f8ffb762f8fd55f5a6284333db220dca9790981bbec91d8d6d18c102617065';
const DO_BINDING='OWNER_FOLLOW_RECOVERY_557';
const DO_CLASS='OwnerFollowerRecovery557';
const sha=b=>createHash('sha256').update(b).digest('hex');
const requireTrue=(v,why)=>{if(!v)throw Error('APP598_HOLD_'+why);};
const STUB=String.raw`
// APP598 ONLY: inert new Durable Object; never linked from existing fetch paths.
// The class does not access state, env, external APIs, secrets, D1, R2 or RTDB.
export class OwnerFollowerRecovery557 {
  constructor(_state, _env) {}
  async fetch(_request) { return new Response('owner follow disabled', {status: 503}); }
  async alarm() {}
}
`;

function preserveOriginal(original,addition){
 const suffix=Buffer.from(addition,'utf8');
 const candidate=Buffer.concat([original,suffix]);
 requireTrue(candidate.subarray(0,original.length).equals(original),'ORIGINAL_BYTES_CHANGED');
 requireTrue(candidate.length-original.length===suffix.length,'NOT_APPEND_ONLY');
 requireTrue(sha(candidate.subarray(0,original.length))===sha(original),'ORIGINAL_HASH_CHANGED');
 return candidate;
}
function checkMigrations(config){
 const versions=config.migrations;
 requireTrue(Array.isArray(versions)&&versions.length===2,'EXPECTED_TWO_MIGRATIONS');
 requireTrue(versions[0].tag==='v1'&&
  JSON.stringify(versions[0].new_sqlite_classes)==='["ExploreLikeBatchScheduler103"]',
  'EXISTING_LIKE_V1_MIGRATION_CHANGED');
 requireTrue(versions[1].tag==='v2'&&
  JSON.stringify(versions[1].new_sqlite_classes)==='["OwnerFollowerRecovery557"]',
  'NEW_OWNER_V2_MIGRATION_CHANGED');
 const binding=config.durable_objects?.bindings||[];
 requireTrue(binding.length===2&&
  binding[0].name==='EXPLORE_LIKE_BATCH_SCHEDULER'&&
  binding[0].class_name==='ExploreLikeBatchScheduler103'&&
  binding[1].name===DO_BINDING&&binding[1].class_name===DO_CLASS,
  'DO_BINDING_NOT_EXACT_ADDITIVE');
 requireTrue(config.name===WORKER,'INCORRECT_WORKER');
}
function validateCurrentBindings(raw,config){
 const items=raw?.result?.bindings;
 requireTrue(Array.isArray(items),'LIVE_BINDINGS_MISSING');
 const mapping=new Map();
 for(const item of items){
  requireTrue(item.name&&!mapping.has(item.name),'DUPLICATE_BINDING');
  mapping.set(item.name,item);
 }
 for(const d of config.d1_databases){
  const b=mapping.get(d.binding);
  requireTrue(b?.type==='d1'&&String(b.id||b.database_id||b.uuid||'')===d.database_id,
    'ORIGINAL_D1_CHANGED_'+d.binding);
 }
 for(const d of config.r2_buckets){
  const b=mapping.get(d.binding);
  requireTrue(b?.type==='r2_bucket'&&String(b.bucket_name||b.bucket||'')===d.bucket_name,
    'ORIGINAL_R2_CHANGED_'+d.binding);
 }
 const like=mapping.get('EXPLORE_LIKE_BATCH_SCHEDULER');
 requireTrue(like?.type==='durable_object_namespace'&&
   like.class_name==='ExploreLikeBatchScheduler103','ORIGINAL_LIKE_DO_CHANGED');
 requireTrue(!mapping.has(DO_BINDING),'OWNER_DO_ALREADY_EXISTS');
 requireTrue(mapping.get('SORIDRAW_ENVIRONMENT')?.text==='preview','NOT_PREVIEW');
 const allNames=[...mapping.keys()];
 requireTrue(!allNames.some(n=>n.startsWith('SORIDRAW_OWNER_FOLLOW_')),'OWNER_FEATURE_VARIABLE_ALREADY_PRESENT');
 const candidateNames=[...allNames,DO_BINDING];
 requireTrue(candidateNames.length===allNames.length+1 &&
   candidateNames.filter(x=>!mapping.has(x)).join(',')===DO_BINDING,
   'EXTRA_BINDING_DELTA');
 return items.map(x=>({name:String(x.name),type:String(x.type)}))
   .sort((a,b)=>a.name.localeCompare(b.name));
}
function inspectModuleBody(payload){
 const mods=payload?.result?.modules;
 requireTrue(Array.isArray(mods)&&mods.length===1,'WORKER_NOT_SINGLE_MODULE');
 const stamps=mods.map((m,i)=>{
  const b=Buffer.from(String(m.content_base64||''),'base64');
  requireTrue(b.length>5000,'ACTIVE_SOURCE_UNAVAILABLE_'+i);
  return {name:String(m.name||'module-'+i),sha256:sha(b),bytes:b.length,b};
 }).sort((a,b)=>a.name.localeCompare(b.name));
 const fingerprint=sha(JSON.stringify(stamps.map(({name,sha256,bytes})=>({name,sha256,bytes}))));
 requireTrue(fingerprint===ACTIVE_DIGEST,'ACTIVE_SOURCE_FINGERPRINT_DRIFT');
 const original=stamps[0].b;
 const code=original.toString('utf8');
 requireTrue(Buffer.from(code,'utf8').equals(original),'ACTIVE_NOT_VALID_UTF8');
 requireTrue(code.includes('export default') &&
   code.includes('ExploreLikeBatchScheduler103') &&
   !code.includes('class OwnerFollowerRecovery557') &&
   !code.includes('export {OwnerFollowerRecovery557}'),
   'CANONICAL_MODULE_EXPORT_SHAPE_CHANGED');
 return {original,originalModuleSha256:sha(original),name:stamps[0].name,fingerprint};
}
async function getApi(path,token){
 const url='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path;
 const r=await fetch(url,{method:'GET',
  headers:{Authorization:'Bearer '+token,Accept:'application/json'},
  signal:AbortSignal.timeout(15000)});
 requireTrue(r.ok,'CLOUDFLARE_READ_HTTP_'+r.status);
 const body=await r.json();
 requireTrue(body?.success!==false,'CLOUDFLARE_READ_REJECTED');
 return body;
}
async function selfTest(){
 const t=Buffer.from('export default {fetch(){return new Response("ok")}};\n');
 const merged=preserveOriginal(t,STUB);
 assert.deepEqual(merged.subarray(0,t.length),t);
 const module=await import('data:text/javascript;base64,'+Buffer.from(STUB).toString('base64'));
 const instance=new module.OwnerFollowerRecovery557(null,null);
 assert.equal((await instance.fetch(new Request('https://example.org'))).status,503);
 assert.equal(await instance.alarm(),undefined);
 const c=JSON.parse(readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc','utf8'));
 checkMigrations(c);
 const raw={result:{bindings:[
   ...c.d1_databases.map(x=>({name:x.binding,type:'d1',id:x.database_id})),
   ...c.r2_buckets.map(x=>({name:x.binding,type:'r2_bucket',bucket_name:x.bucket_name})),
   {name:'EXPLORE_LIKE_BATCH_SCHEDULER',type:'durable_object_namespace',class_name:'ExploreLikeBatchScheduler103'},
   {name:'SORIDRAW_ENVIRONMENT',type:'plain_text',text:'preview'}
 ]}};
 assert.equal(validateCurrentBindings(raw,c).length,6);
 assert.throws(()=>validateCurrentBindings({result:{bindings:[...raw.result.bindings,{name:DO_BINDING}]}},c));
 console.log('APP598_BYTE_PRESERVATION_AND_DORMANT_503=PASS');
 console.log('APP598_EXISTING_LIKE_DO_V1_AND_NEW_OWNER_DO_V2=PASS');
 console.log('APP598_SOURCE_ONLY_NO_CLOUD_CALL=PASS');
}
async function candidate(){
 const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
 requireTrue(token.length>15,'NO_CLOUDFLARE_READ_TOKEN');
 requireTrue(process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT,'ACCOUNT_MISMATCH');
 const config=JSON.parse(readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc','utf8'));
 checkMigrations(config);
 const root='workers/scripts/'+WORKER;
 const deployments=await getApi(root+'/deployments?per_page=5',token);
 const rows=deployments.result?.deployments;
 requireTrue(Array.isArray(rows)&&rows.length>1,'DEPLOYMENT_HISTORY_MISSING');
 requireTrue(rows[0]?.versions?.length===1&&
  rows[0].versions[0].version_id===VERSION&&
  Number(rows[0].versions[0].percentage)===100,'ACTIVE_VERSION_CHANGED');
 requireTrue(rows.slice(1).some(x=>x.versions?.some(v=>v.version_id===PREVIOUS)),
   'PREVIOUS_ROLLBACK_VERSION_CHANGED');
 const metadata=await getApi(root+'/versions/'+VERSION,token);
 requireTrue(metadata.result?.id===VERSION,'METADATA_VERSION_CHANGED');
 const oldMigration=String(metadata.result?.resources?.script_runtime?.migration_tag||'');
 requireTrue(oldMigration!== 'v2','OWNER_MIGRATION_ALREADY_APPLIED');
 const settings=await getApi(root+'/settings',token);
 const bindings=validateCurrentBindings(settings,config);
 const moduleData=inspectModuleBody(
   await getApi('workers/workers/'+WORKER+'/versions/'+VERSION+'?include=modules',token));
 const candidateBytes=preserveOriginal(moduleData.original,'\n'+STUB);
 requireTrue(sha(moduleData.original)===moduleData.originalModuleSha256,'ORIGINAL_HASH_DIFFERENCE');
 const latest=await getApi(root+'/deployments?per_page=1',token);
 requireTrue(latest.result?.deployments?.[0]?.versions?.[0]?.version_id===VERSION,
    'ACTIVE_CHANGED_DURING_READ');
 const dir=process.env.RUNNER_TEMP?
   join(process.env.RUNNER_TEMP,'app598-owner-do-candidate'):
   mkdtempSync(join(tmpdir(),'app598-'));
 mkdirSync(dir,{recursive:true});
 writeFileSync(join(dir,'candidate-worker.mjs'),candidateBytes,{mode:0o600});
 // A build-only manifest; missing live secrets/ratelimit intentionally NOT deployable.
 const dryConfig={...config,main:'./candidate-worker.mjs',keep_vars:true};
 writeFileSync(join(dir,'wrangler.jsonc'),JSON.stringify(dryConfig,null,2)+'\n');
 const result={
   basis:'APP597 GET-only evidence 43400469773',
   baselineVersion:VERSION,
   originalModuleName:moduleData.name,
   originalModuleSHA256:moduleData.originalModuleSha256,
   originalAggregateSHA256:moduleData.fingerprint,
   originalBytes:moduleData.original.length,
   candidateSHA256:sha(candidateBytes),
   candidateBytes:candidateBytes.length,
   appendedBytes:candidateBytes.length-moduleData.original.length,
   originalPrefixByteIdentical:true,
   newOwnerDORequestStatus:503,
   oldMigrationVersion:oldMigration||'UNREPORTED',
   plannedMigrations:['v1:ExploreLikeBatchScheduler103','v2:OwnerFollowerRecovery557'],
   sourceOnlyExistingBindingNamesAndTypes:bindings,
   bindingDeltaOnly:[{name:DO_BINDING,class_name:DO_CLASS}],
   dryRunConfigNotDeployable:true,
   originalSecretValuesNotCaptured:true,
   rollbackCandidate:PREVIOUS,
   rollbackOperationalSafety:'NOT_PROVEN',
   existingRouteRuntimeParity:'BYTE_PREFIX_ONLY_NOT_RUNTIME_TESTED',
   mayDeploy:false,
   calls:'CLOUDFLARE_GET_ONLY',
 };
 writeFileSync(join(dir,'sanitized-evidence.json'),JSON.stringify(result,null,2)+'\n');
 console.log('APP598_SOURCE_PREFIX_BYTE_IDENTICAL=PASS');
 console.log('APP598_ACTIVE_SHA256='+moduleData.fingerprint);
 console.log('APP598_CANDIDATE_SHA256='+result.candidateSHA256);
 console.log('APP598_EXISTING_BINDINGS_UNMODIFIED=PASS');
 console.log('APP598_NEW_DO_BINDING_ONE_ONLY=PASS');
 console.log('APP598_CLASS_503_OFF_WITH_NO_STORAGE_CALLS=PASS');
 console.log('APP598_ROLLBACK_RISK=NOT_PROVEN');
 console.log('APP598_NO_LIVE_DEPLOY=PASS');
}
const mode=process.argv[2];
if(mode==='--self-test')await selfTest();
else if(mode==='--candidate')await candidate();
else throw Error('APP598_EXPECTED_SELF_TEST_OR_CANDIDATE');

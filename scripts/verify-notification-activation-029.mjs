// Stage029: exact PREVIEW Worker + shared D1 global social collector gate.
// Reads metadata and one OFF/ON latch row only; NEVER reads user content.
// Always use with Stage018 exact D1 schema/trigger preflight and owner release.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const D1='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const BASE='332ca384-725d-46aa-8824-e19a3543bed8';
const BUNDLE='da67be2c626b4dd47cd04625d0261fce96e9b107cce8ba5793434c804a2b2c28';
const names=['soridraw-explore-preview','soridraw-explore-test','soridraw-explore-api'];
const cron='37 * * * *';
const flags=['SORIDRAW_NOTIFICATION_RETENTION_013','SORIDRAW_NOTIFICATION_SCHEMA_READY_013'];
const dataFile=join(resolve(process.env.RUNNER_TEMP||'/invalid'),'notification-029-before.json');
const mode=process.argv[2];
const hash=s=>createHash('sha256').update(s).digest('hex');
const compare=(x,mode)=>{
 assert.equal(x.versions[names[1]],'ddd2255a-75cc-4db9-8905-b47338558cb0','TEST_VERSION_CHANGED');
 assert.equal(x.versions[names[2]],'af81502a-298d-4ec6-bc2a-0c529d6dc29e','PROD_VERSION_CHANGED');
 assert.equal(x.module,BUNDLE,'WORKER_MODULE_DRIFT');
 assert.deepEqual(x.crons,[cron],'CRON_DRIFT');
 const by=new Map(x.bindings.map(b=>[b.name,b]));
 assert.equal(by.get('SORIDRAW_ENVIRONMENT')?.text,'preview','ENVIRONMENT_DRIFT');
 assert.equal(by.get('SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019')?.text,'1','SIGNED_GET_DISABLED');
 assert.equal(by.get('DB')?.id||by.get('DB')?.database_id||by.get('DB')?.uuid,D1,'D1_BINDING_DRIFT');
 assert.equal(by.get('PROFILE_MEDIA')?.bucket_name,'soridraw-profile-media','R2_BINDING_DRIFT');
 for(const flag of flags){
  if(mode==='OFF')assert.equal(by.has(flag),false,'UNEXPECTED_ENABLE_FLAG_'+flag);
  if(mode==='ON')assert.equal(by.get(flag)?.text,'1','MISSING_ENABLE_FLAG_'+flag);
 }
};
if(mode==='--self-test'){
 const dummy={versions:{[names[0]]:BASE,[names[1]]:'ddd2255a-75cc-4db9-8905-b47338558cb0',
 [names[2]]:'af81502a-298d-4ec6-bc2a-0c529d6dc29e'},
 module:BUNDLE,crons:[cron],bindings:[
 {name:'SORIDRAW_ENVIRONMENT',text:'preview'},
 {name:'SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019',text:'1'},
 {name:'DB',id:D1},{name:'PROFILE_MEDIA',bucket_name:'soridraw-profile-media'}]};
 compare(dummy,'OFF');
 compare({...dummy,bindings:[...dummy.bindings,...flags.map(name=>({name,text:'1'}))]},'ON');
 assert.throws(()=>compare({...dummy,crons:[]},'OFF'),/CRON_DRIFT/);
 assert.throws(()=>compare({...dummy,versions:{...dummy.versions,[names[2]]:BASE}},'OFF'),/PROD_VERSION_CHANGED/);
 console.log('NOTIFICATION_029_PINNED_OFF_ON_AND_THREE_WORKER_GATES=PASS');
 process.exit(0);
}
assert.ok(process.env.RUNNER_TEMP&&['--before','--after-worker','--after-live','--after-rollback'].includes(mode),
 'LIVE_METADATA_ONLY_EXPLICIT_MODE');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,ACCOUNT,'ACCOUNT_MISMATCH');
const token=process.env.CLOUDFLARE_API_TOKEN;
assert.ok(token?.length>20,'TOKEN_MISSING');
const api=async path=>{
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+path,{
  headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(18000)});
 const body=await response.json();
 assert.ok(response.ok&&body.success===true&&body.result,'CLOUDFLARE_GET_FAILED_'+response.status);
 return body.result;
};
const d1=async()=>{
 const sql='SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1 LIMIT 1';
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+
  '/d1/database/'+D1+'/query',{method:'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({sql,params:[]}),signal:AbortSignal.timeout(18000)});
 const result=(await response.json())?.result?.[0];
 assert.ok(response.ok&&result?.success===true&&result?.meta?.rows_written===0&&
  result?.results?.length===1,'LATCH_READONLY_NOT_PROVEN');
 return Number(result.results[0].enabled);
};
const get=async()=>{
 const versions={};
 for(const name of names){
  const result=await api('/workers/scripts/'+name+'/deployments');
  const v=result.deployments?.[0]?.versions;
  assert.ok(v?.length===1&&Number(v[0].percentage)===100,'NON_SINGLE_WORKER_'+name);
  versions[name]=v[0].version_id;
 }
 const binds=(await api('/workers/scripts/'+names[0]+'/settings')).bindings;
 assert.ok(Array.isArray(binds)&&new Set(binds.map(x=>x.name)).size===binds.length,'BINDING_INVALID');
 const schedule=(await api('/workers/scripts/'+names[0]+'/schedules')).schedules;
 assert.ok(Array.isArray(schedule),'SCHEDULE_INVALID');
 const info=await api('/workers/workers/'+names[0]+'/versions/'+versions[names[0]]+'?include=modules');
 const module=info.modules?.find(x=>String(x.name).endsWith('preview-entry.js'));
 assert.ok(module?.content_base64,'MODULE_NOT_AVAILABLE');
 return {versions,bindings:binds,crons:schedule.map(x=>x.cron).sort(),
  module:hash(Buffer.from(module.content_base64,'base64')),latch:await d1()};
};
const now=await get();
if(mode==='--before'){
 assert.equal(now.versions[names[0]],BASE,'PREVIEW_VERSION_MOVED');
 assert.equal(now.latch,0,'D1_COLLECTOR_NOT_OFF');
 compare(now,'OFF');
 writeFileSync(dataFile,JSON.stringify(now),{flag:'wx',mode:0o600});
 console.log('NOTIFICATION_029_ACTIVE_PREVIEW_EXACT_BINARY_OFF_AND_3_ENV=PASS');
}else{
 const before=JSON.parse(readFileSync(dataFile,'utf8'));
 assert.equal(before.versions[names[0]],BASE);
 compare(before,'OFF');assert.equal(before.latch,0);
 assert.equal(now.versions[names[1]],before.versions[names[1]]);
 assert.equal(now.versions[names[2]],before.versions[names[2]]);
 if(mode==='--after-worker'||mode==='--after-live'){
  assert.notEqual(now.versions[names[0]],BASE,'NEW_WORKER_VERSION_NOT_DEPLOYED');
  compare(now,'ON');
  // Only the two enable flags may differ. No existing binding altered.
  const enabled=new Set(flags);
  const normal=s=>JSON.stringify(s.filter(x=>!enabled.has(x.name)).sort((a,b)=>a.name.localeCompare(b.name)));
  assert.equal(normal(now.bindings),normal(before.bindings),'OTHER_BINDINGS_MODIFIED');
  assert.equal(now.latch,mode==='--after-worker'?0:1,'LATCH_STAGE_DRIFT');
  console.log(mode==='--after-worker'
   ?'NOTIFICATION_029_RETENTION_READY_PREVIEW_ONLY_LATCH_OFF=PASS'
   :'NOTIFICATION_029_COLLECTOR_ACTIVE_AND_RETENTION_READY_3_ENV=PASS');
 }else{
  assert.equal(now.versions[names[0]],BASE,'ROLLBACK_OLD_VERSION_MISSING');
  compare(now,'OFF');assert.equal(now.latch,0,'ROLLBACK_LATCH_STILL_ON');
  console.log('NOTIFICATION_029_COLLECTOR_OFF_PREVIEW_WORKER_RESTORED=PASS');
 }
}

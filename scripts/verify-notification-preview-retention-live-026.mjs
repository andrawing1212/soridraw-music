// Stage026 PREVIEW-only notification 30-day retention release pre/postflight.
// Get-only metadata. User rows never queried; D1 rows_written must be zero.
// A failed release restores the original Worker version and cron schedule.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const D1='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const PREVIOUS='e8772114-3f75-4143-90f3-b321592b2e74';
const PREVIOUS_SHA='c0b500d3b14bdc767dc601fb07b865c54af20835abb3a9d3937551fa08f08216';
const names=['soridraw-explore-preview','soridraw-explore-test','soridraw-explore-api'];
const cron='37 * * * *';
const triggerNames=['soridraw_notification_like_insert_002','soridraw_notification_follow_legacy_insert_002','soridraw_notification_follow_overlay_insert_002','soridraw_notification_follow_overlay_update_002'];
const hash=x=>createHash('sha256').update(x).digest('hex');
const temp=resolve(process.env.RUNNER_TEMP||'/invalid');
const snapshot=()=>join(temp,'notification-026-before.json');
const candidateShaPath=()=>join(temp,'notification-026-candidate.sha');
const mode=process.argv[2];
const config=JSON.parse(readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc','utf8'));
assert.equal(config.name,names[0]);assert.equal(config.vars?.SORIDRAW_ENVIRONMENT,'preview');
assert.deepEqual(config.triggers?.crons,[cron]);
assert.equal(config.vars?.SORIDRAW_NOTIFICATION_RETENTION_013,undefined);
assert.equal(config.vars?.SORIDRAW_NOTIFICATION_SCHEMA_READY_013,undefined);
assert.equal(config.vars?.SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019,undefined);
assert.equal(config.d1_databases.find(x=>x.binding==='DB')?.database_id,D1);
const staged=String(readFileSync('cloudflare/explore-worker/runtime/notification-retention-scheduler-013.mjs','utf8'));
assert.match(staged,/env\?\.SORIDRAW_ENVIRONMENT!=='preview'/);
assert.match(staged,/NOTIFICATION_RETENTION_MS_002/);
if(mode==='--self-test'){
 assert.equal(hash('test'),'9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
 console.log('NOTIFICATION_026_PREVIEW_ONE_CRON_FLAGS_HARD_OFF_SELFTEST=PASS');
 process.exit(0);
}
if(mode==='--bundles'){
 const bundle=p=>{
  assert.ok(resolve(p).startsWith(temp+'/'),'TEMP_ONLY');
  const files=readdirSync(p).filter(x=>x.endsWith('.js'));assert.equal(files.length,1);
  return hash(readFileSync(join(p,files[0])));
 };
 const old=bundle(process.argv[3]),fresh=bundle(process.argv[4]);
 assert.equal(old,PREVIOUS_SHA,'STAGE021_FROZEN_BUNDLE_NOT_IDENTICAL');
 assert.match(fresh,/^[a-f0-9]{64}$/);assert.notEqual(fresh,old);
 writeFileSync(candidateShaPath(),fresh+'\n',{flag:'wx',mode:0o600});
 console.log('NOTIFICATION_026_FROZEN_ACTIVE_BUNDLE_SHA256='+old);
 console.log('NOTIFICATION_026_PINNED_CANDIDATE_BUNDLE_SHA256='+fresh);
 console.log('NOTIFICATION_026_EXACT_MINIMAL_BUNDLE_DELTA=PASS');
 process.exit(0);
}
assert.ok(process.env.RUNNER_TEMP && ['--before','--after','--rollback-precheck','--rollback-postcheck'].includes(mode),
 'EXPLICIT_LIVE_READONLY_MODE_REQUIRED');
assert.ok(process.env.CLOUDFLARE_API_TOKEN?.length>15,'TOKEN_MISSING');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,ACCOUNT);
const expectedNew=()=>{
 const s=readFileSync(candidateShaPath(),'utf8').trim();
 assert.match(s,/^[a-f0-9]{64}$/);return s;
};
const api=async path=>{
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+path,{
  headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,Accept:'application/json'},
  signal:AbortSignal.timeout(18000),
 });
 const payload=await r.json();assert.ok(r.ok&&payload.success===true&&payload.result,'CF_GET_'+r.status);
 return payload.result;
};
const d1=async sql=>{
 assert.ok(/^SELECT\s/.test(sql) && !sql.includes(';') &&
  !/\b(?:INSERT|DELETE|UPDATE|DROP|ALTER|CREATE|PRAGMA|REPLACE|ATTACH|DETACH)\b/i.test(sql));
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/d1/database/'+D1+'/query',{
  method:'POST',
  headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},
  body:JSON.stringify({sql,params:[]}),signal:AbortSignal.timeout(18000),
 });
 const payload=await r.json(),result=payload.result?.[0];
 assert.ok(r.ok&&payload.success===true&&payload.result?.length===1&&result?.success===true&&
  Array.isArray(result?.results)&&Number(result?.meta?.rows_written)===0,'D1_READONLY_NOT_PROVEN');
 return result.results;
};
const get=async()=>{
 const versions={};
 for(const name of names){
  const result=await api('/workers/scripts/'+name+'/deployments');
  const v=result.deployments?.[0]?.versions;
  assert.ok(v?.length===1&&Number(v[0].percentage)===100,'WORKER_NOT_SINGLE_100_'+name);
  versions[name]=v[0].version_id;
 }
 const settings=await api('/workers/scripts/'+names[0]+'/settings');
 const bindings=settings.bindings;assert.ok(Array.isArray(bindings));
 assert.equal(new Set(bindings.map(b=>b.name)).size,bindings.length,'DUPLICATE_BINDINGS');
 const by=new Map(bindings.map(x=>[x.name,x]));
 for(const [n,t,id] of [['DB','d1',D1],['RATE_DB','d1','aaaa0fd9-1f34-4c97-9a41-11ef75d31f0f'],
 ['PROFILE_MEDIA','r2_bucket','soridraw-profile-media'],['EXPLORE_CACHE','r2_bucket','soridraw-profile-media-preview']]){
  const b=by.get(n);
  assert.equal(b?.type,t,'BINDING_DRIFT_'+n);
  assert.equal(t==='d1'?(b?.id||b?.database_id||b?.uuid):b?.bucket_name,id,'RESOURCE_DRIFT_'+n);
 }
 assert.equal(by.get('SORIDRAW_ENVIRONMENT')?.text,'preview');
 assert.equal(String(by.get('SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019')?.text),'1');
 for(const n of ['SORIDRAW_NOTIFICATION_RETENTION_013','SORIDRAW_NOTIFICATION_SCHEMA_READY_013','SORIDRAW_NOTIFICATION_INBOX_004']){
  assert.equal(by.has(n),false,'UNEXPECTED_NOTIFICATION_ENABLE_FLAG_'+n);
 }
 for(const n of ['SORIDRAW_CURATED_WRITER_SHADOW471','SORIDRAW_CURATED_SHARED_V466','SORIDRAW_CURATED_ALL_WRITERS_READY466']){
  const v=by.get(n);assert.ok(!v||(v.type==='plain_text'&&String(v.text)==='0'),'UNSAFE_WRITER_FLAG_'+n);
 }
 const schedule=await api('/workers/scripts/'+names[0]+'/schedules');
 assert.ok(Array.isArray(schedule?.schedules),'CRON_RESPONSE_INVALID');
 const crons=schedule.schedules.map(x=>x.cron).sort();
 const latch=await d1('SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1 LIMIT 1');
 assert.equal(latch.length,1);assert.equal(Number(latch[0].enabled),0,'COLLECTION_MUST_REMAIN_OFF');
 const trigger=await d1("SELECT name,sql FROM sqlite_schema WHERE type='trigger' AND name IN ('"+
  triggerNames.join("','")+"') ORDER BY name");
 assert.deepEqual(trigger.map(x=>x.name),[...triggerNames].sort(),'TRIGGERS_MISSING');
 assert.ok(trigger.every(x=>String(x.sql).includes('soridraw_notification_activation_002')&&
  !String(x.sql).includes('soridraw_notification_preferences_002')),'TRIGGER_BEHAVIOR_CHANGED');
 const info=await api('/workers/workers/'+names[0]+'/versions/'+versions[names[0]]+'?include=modules');
 const module=info.modules?.find(x=>String(x.name).endsWith('preview-entry.js'));
 assert.ok(module?.content_base64,'MODULE_UNAVAILABLE');
 return {versions,bindings:bindings.sort((a,b)=>a.name.localeCompare(b.name)),triggers:trigger,
  crons,module:hash(Buffer.from(module.content_base64,'base64'))};
};
const previous=mode==='--before'?null:JSON.parse(readFileSync(snapshot(),'utf8'));
const now=await get();
if(mode==='--before'){
 assert.equal(now.versions[names[0]],PREVIOUS,'UNEXPECTED_PREVIEW_VERSION');
 assert.equal(now.module,PREVIOUS_SHA,'UNEXPECTED_LIVE_MODULE_SHA');
 assert.deepEqual(now.crons,[],'PREVIOUS_CRON_MUST_BE_EMPTY');
 writeFileSync(snapshot(),JSON.stringify(now),{flag:'wx',mode:0o600});
 console.log('NOTIFICATION_026_CURRENT_GET_ONLY_WORKER_VERSION_AND_SHA=PASS');
 console.log('NOTIFICATION_026_THREE_ENV_SHARED_D1_LATCH_OFF_CRON_EMPTY=PASS');
}else{
 assert.equal(previous.versions[names[0]],PREVIOUS);
 assert.equal(previous.module,PREVIOUS_SHA);
 assert.deepEqual(previous.crons,[]);
 assert.equal(now.versions[names[1]],previous.versions[names[1]],'TEST_WORKER_MOVED');
 assert.equal(now.versions[names[2]],previous.versions[names[2]],'PRODUCTION_WORKER_MOVED');
 assert.deepEqual(now.triggers,previous.triggers,'D1_TRIGGER_CHANGED');
 assert.deepEqual(now.bindings,previous.bindings,'WORKER_BINDINGS_CHANGED');
 if(mode==='--after'){
  assert.notEqual(now.versions[names[0]],PREVIOUS,'NEW_PREVIEW_VERSION_MISSING');
  assert.equal(now.module,expectedNew(),'CANDIDATE_MODULE_MISMATCH');
  assert.deepEqual(now.crons,[cron],'SINGLE_PREVIEW_CRON_NOT_INSTALLED');
  console.log('NOTIFICATION_026_PREVIEW_CRON_INSTALLED_FLAGS_OFF_EXACT_BUNDLE=PASS');
  console.log('NOTIFICATION_026_TEST_PRODUCTION_UNCHANGED_SHARED_D1_OFF=PASS');
 }else if(mode==='--rollback-precheck'){
  assert.ok(now.versions[names[0]]===PREVIOUS&&now.module===PREVIOUS_SHA ||
   now.versions[names[0]]!==PREVIOUS&&now.module===expectedNew(),
   'UNRELATED_PREVIEW_VERSION_MANUAL_HOLD');
  assert.ok(now.crons.length===0||now.crons.length===1&&now.crons[0]===cron,
   'UNRELATED_CRON_MANUAL_HOLD');
  console.log('NOTIFICATION_026_ROLLBACK_MATCHES_REVIEWED_VERSION_ONLY=PASS');
 }else{
  assert.equal(now.versions[names[0]],PREVIOUS,'ROLLBACK_PREVIOUS_VERSION_MISSING');
  assert.equal(now.module,PREVIOUS_SHA,'ROLLBACK_PREVIOUS_MODULE_MISSING');
  assert.deepEqual(now.crons,[],'ROLLBACK_CRON_STILL_ACTIVE');
  console.log('NOTIFICATION_026_PREVIOUS_GET_AND_NO_CRON_RESTORED=PASS');
 }
}

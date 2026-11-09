// Stage021: exact PREVIEW Worker hash, bindings, latch and schedule guard.
// No remote writes. A rollback after a failed deployment is handled by the release workflow.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const D1='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const OLD='2960d485-fe66-4136-9f84-41ce3e0d4b58';
const OLD_SHA='ac2e5ffb9abbb530a0ae5bd99a6b5e86fc066281985a5b8cb5fb95fe45b4b9e3';
const NEW_SHA='c0b500d3b14bdc767dc601fb07b865c54af20835abb3a9d3937551fa08f08216';
const names=['soridraw-explore-preview','soridraw-explore-test','soridraw-explore-api'];
const triggerNames=['soridraw_notification_like_insert_002','soridraw_notification_follow_legacy_insert_002','soridraw_notification_follow_overlay_insert_002','soridraw_notification_follow_overlay_update_002'];
const hash=x=>createHash('sha256').update(x).digest('hex');
const temp=process.env.RUNNER_TEMP;
const snapshot=()=>resolve(temp,'notification-021-before.json');
const mode=process.argv[2];
const config=JSON.parse(readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc','utf8'));
assert.equal(config.name,names[0]);
assert.equal(config.vars?.SORIDRAW_ENVIRONMENT,'preview');
assert.equal(config.vars?.SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019,undefined);
assert.equal(config.d1_databases.find(x=>x.binding==='DB')?.database_id,D1);
if(mode==='--self-test'){
 assert.equal(hash('test'),'9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
 console.log('NOTIFICATION_021_OFF_LATCH_CONFIG_CONTRACT=PASS');
 process.exit(0);
}
if(mode==='--bundles'){
 const bundle=p=>{
  assert.ok(temp&&resolve(p).startsWith(resolve(temp)+'/'),'TEMP_ONLY');
  const files=readdirSync(p).filter(x=>x.endsWith('.js'));assert.equal(files.length,1);
  return hash(readFileSync(join(p,files[0])));
 };
 assert.equal(bundle(process.argv[3]),OLD_SHA,'FROZEN_BUILD_DRIFT');
 assert.equal(bundle(process.argv[4]),NEW_SHA,'MINIMAL_GET_BUILD_DRIFT');
 console.log('NOTIFICATION_021_PINNED_OLD_AND_NEW_BUNDLES=PASS');
 process.exit(0);
}
assert.ok(temp&&/^(--before|--after|--rollback-precheck|--rollback-postcheck)$/.test(mode),'MODE_REQUIRED');
assert.ok(process.env.CLOUDFLARE_API_TOKEN?.length>15,'TOKEN_MISSING');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,ACCOUNT);
const api=async path=>{
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+path,{
  headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,Accept:'application/json'},
  signal:AbortSignal.timeout(20000),
 });
 const data=await r.json();
 assert.ok(r.ok&&data.success===true&&data.result,'CLOUDFLARE_GET_FAILED_'+r.status);
 return data.result;
};
const d1=async sql=>{
 assert.ok(/^SELECT\s/i.test(sql)&&!sql.includes(';')&&!/\b(INSERT|DELETE|UPDATE|DROP|ALTER|CREATE|PRAGMA)\b/i.test(sql));
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/d1/database/'+D1+'/query',{
  method:'POST',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},
  body:JSON.stringify({sql,params:[]}),signal:AbortSignal.timeout(20000),
 });
 const j=await r.json();const a=j.result?.[0];
 assert.ok(r.ok&&j.success===true&&j.result?.length===1&&a?.success===true&&Array.isArray(a.results)&&
  Number(a.meta?.rows_written)===0,'D1_SELECT_ONLY_FAIL');
 return a.results;
};
const get=async()=>{
 const versions={};
 for(const name of names){
  const result=await api('/workers/scripts/'+name+'/deployments');
  const vs=result.deployments?.[0]?.versions;
  assert.ok(vs?.length===1&&Number(vs[0].percentage)===100,'WORKER_SPLIT_'+name);
  versions[name]=vs[0].version_id;
 }
 const result=await api('/workers/scripts/'+names[0]+'/settings');
 const bindings=result.bindings;
 assert.ok(Array.isArray(bindings)&&new Set(bindings.map(x=>x.name)).size===bindings.length);
 const by=new Map(bindings.map(x=>[x.name,x]));
 for(const [n,t,id] of [['DB','d1',D1],['RATE_DB','d1','aaaa0fd9-1f34-4c97-9a41-11ef75d31f0f'],
 ['PROFILE_MEDIA','r2_bucket','soridraw-profile-media'],['EXPLORE_CACHE','r2_bucket','soridraw-profile-media-preview']]){
  const b=by.get(n);
  assert.equal(b?.type,t,'BINDING_DRIFT_'+n);
  assert.equal(t==='d1'?(b?.id||b?.database_id||b?.uuid):b?.bucket_name,id,'BINDING_ID_'+n);
 }
 assert.equal(by.get('SORIDRAW_ENVIRONMENT')?.text,'preview');
 for(const n of ['SORIDRAW_CURATED_WRITER_SHADOW471','SORIDRAW_CURATED_SHARED_V466','SORIDRAW_CURATED_ALL_WRITERS_READY466']){
  const v=by.get(n);assert.ok(!v||(v.type==='plain_text'&&String(v.text)==='0'),'WRITER_FLAG_'+n);
 }
 const cron=await api('/workers/scripts/'+names[0]+'/schedules');
 assert.deepEqual(cron.schedules,[],'CRON_MUST_BE_EMPTY');
 const latch=await d1('SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1 LIMIT 1');
 assert.equal(latch.length,1);assert.equal(Number(latch[0].enabled),0,'NOTIFICATION_LATCH_NOT_OFF');
 const trigger=await d1("SELECT name,sql FROM sqlite_schema WHERE type='trigger' AND name IN ('"+triggerNames.join("','")+"') ORDER BY name");
 assert.deepEqual(trigger.map(x=>x.name),[...triggerNames].sort(),'NOTIFICATION_TRIGGER_DRIFT');
 assert.ok(trigger.every(x=>String(x.sql).includes('soridraw_notification_activation_002')&&!String(x.sql).includes('soridraw_notification_preferences_002')));
 const info=await api('/workers/workers/'+names[0]+'/versions/'+versions[names[0]]+'?include=modules');
 const module=info.modules?.find(x=>String(x.name).endsWith('preview-entry.js'));
 assert.ok(module?.content_base64,'MODULE_CONTENT_MISSING');
 return{versions,bindings:bindings.sort((a,b)=>a.name.localeCompare(b.name)),triggers:trigger,
  module:hash(Buffer.from(module.content_base64,'base64'))};
};
const before=mode==='--before'?null:JSON.parse(readFileSync(snapshot(),'utf8'));
const now=await get();
if(mode==='--before'){
 assert.equal(now.versions[names[0]],OLD);assert.equal(now.module,OLD_SHA);
 assert.ok(!now.bindings.some(x=>x.name==='SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019'));
 writeFileSync(snapshot(),JSON.stringify(now),{flag:'wx',mode:0o600});
 console.log('NOTIFICATION_021_LIVE_OLD_WORKER_D1_OFF_BINDINGS_VERIFIED=PASS');
}else{
 assert.equal(before.versions[names[0]],OLD);assert.equal(before.module,OLD_SHA);
 assert.equal(before.versions[names[1]],now.versions[names[1]],'TEST_WORKER_MOVED');
 assert.equal(before.versions[names[2]],now.versions[names[2]],'PRODUCTION_WORKER_MOVED');
 assert.deepEqual(before.triggers,now.triggers,'SHARED_D1_TRIGGER_CHANGED');
 const originalBindings=before.bindings;
 if(mode==='--after'){
  assert.notEqual(now.versions[names[0]],OLD,'NEW_VERSION_ABSENT');
  assert.equal(now.module,NEW_SHA,'GET_MODULE_MISMATCH');
  const flag=now.bindings.find(x=>x.name==='SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019');
  assert.equal(flag?.type,'plain_text');assert.equal(String(flag.text),'1');
  assert.deepEqual(now.bindings.filter(x=>x.name!=='SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019'),originalBindings,'EXISTING_BINDING_DRIFT');
  console.log('NOTIFICATION_021_NEW_SHA_ONLY_EXTRA_GET_FLAG=PASS');
  console.log('NOTIFICATION_021_TEST_PROD_UNCHANGED_D1_OFF=PASS');
 }else if(mode==='--rollback-precheck'){
  assert.ok(now.versions[names[0]]===OLD&&now.module===OLD_SHA ||
    now.versions[names[0]]!==OLD&&now.module===NEW_SHA,'UNRELATED_WORKER_VERSION_MANUAL_HOLD');
  console.log('NOTIFICATION_021_SAFE_TO_RESTORE_ORIGINAL=PASS');
 }else{
  assert.equal(now.versions[names[0]],OLD,'ORIGINAL_VERSION_NOT_RESTORED');
  assert.equal(now.module,OLD_SHA,'ORIGINAL_BUNDLE_NOT_RESTORED');
  assert.deepEqual(now.bindings,originalBindings,'ORIGINAL_BINDINGS_NOT_RESTORED');
  console.log('NOTIFICATION_021_PREVIEW_ORIGINAL_EXACT_ROLLBACK=PASS');
 }
}

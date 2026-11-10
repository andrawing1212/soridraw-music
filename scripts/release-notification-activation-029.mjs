// Stage029: one-use PREVIEW retention-enable + shared notification latch release.
// All real operations require exact approved GitHub push workflow; no user rows
// or canonical likes/follows are edited. On failure, latch OFF before rollback.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const ROOT=process.cwd(),temp=process.env.RUNNER_TEMP;
assert.ok(temp&&resolve(temp)!==resolve(ROOT),'RUNNER_TEMP_REQUIRED');
const dir=join(resolve(temp),'notification-026-frozen/cloudflare/explore-worker');
const wrangler=join(dir,'node_modules/wrangler/bin/wrangler.js');
const cfgPath=join(dir,'canonical/wrangler.preview.jsonc');
const source=join(dir,'canonical/preview-entry.js');
const expectedHash='da67be2c626b4dd47cd04625d0261fce96e9b107cce8ba5793434c804a2b2c28';
const oldVersion='332ca384-725d-46aa-8824-e19a3543bed8';
const account='e1a30fc9ef497fda1d34f4ab3dc1da45';
const d1='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const binsha=s=>createHash('sha256').update(s).digest('hex');
const run=(cmd,args,opts={})=>{
 const result=spawnSync(cmd,args,{cwd:opts.cwd||ROOT,stdio:'inherit',timeout:420000,env:process.env});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error('NOTIFICATION_029_EXIT_'+result.status+'_'+args[0]);
};
const node=(file,...args)=>run(process.execPath,[file,...args]);
const mode=process.argv[2];
const config=()=>JSON.parse(readFileSync(cfgPath,'utf8'));
const prepare=()=>{
 node('scripts/release-notification-preview-retention-026.mjs','--prepare');
 const data=config();
 assert.equal(data.name,'soridraw-explore-preview');
 assert.deepEqual(data.triggers?.crons,['37 * * * *']);
 assert.equal(data.vars?.SORIDRAW_ENVIRONMENT,'preview');
 assert.equal(data.vars?.SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019,'1');
 assert.equal(data.vars?.SORIDRAW_NOTIFICATION_RETENTION_013,undefined);
 assert.equal(data.vars?.SORIDRAW_NOTIFICATION_SCHEMA_READY_013,undefined);
 assert.equal(data.keep_vars,true,'OTHER_WORKER_VARS_MUST_BE_PRESERVED');
 data.vars.SORIDRAW_NOTIFICATION_RETENTION_013='1';
 data.vars.SORIDRAW_NOTIFICATION_SCHEMA_READY_013='1';
 writeFileSync(cfgPath,JSON.stringify(data,null,2)+'\n');
 const dry=join(resolve(temp),'notification-029-live-ready');
 assert.ok(!existsSync(dry),'DRY_RUN_MUST_BE_FRESH');
 run(process.execPath,[wrangler,'deploy','--config',cfgPath,'--dry-run','--outdir',dry],{cwd:dir});
 const bundles=readdirSync(dry).filter(f=>f.endsWith('.js'));
 assert.equal(bundles.length,1,'UNEXPECTED_BUNDLE');
 assert.equal(binsha(readFileSync(join(dry,bundles[0]))),expectedHash,
  'NOTIFICATION_PREVIEW_WORKER_CODE_WOULD_CHANGE');
 assert.equal(binsha(readFileSync(source)),binsha(readFileSync(
  join(resolve(temp),'notification-026-new.js'))),'FROZEN_SOURCE_MISMATCH');
 console.log('NOTIFICATION_029_EXACT_ACTIVE_BUNDLE_NO_CODE_CHANGE_FLAGS_ONLY=PASS');
};
if(mode==='--prepare'){prepare();process.exit(0);}
if(mode!=='--deploy')throw Error('EXPLICIT_PREPARE_OR_DEPLOY');
assert.ok(existsSync(wrangler)&&existsSync(cfgPath)&&existsSync(source),'PREPARE_REQUIRED');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,account);
assert.ok(process.env.CLOUDFLARE_API_TOKEN?.length>20,'TOKEN_REQUIRED');
const D1URL='https://api.cloudflare.com/client/v4/accounts/'+account+
 '/d1/database/'+d1+'/query';
const query=async sql=>{
 assert.ok([
  'SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1 LIMIT 1',
  'UPDATE soridraw_notification_activation_002 SET enabled=1 WHERE id=1 AND enabled=0',
  'UPDATE soridraw_notification_activation_002 SET enabled=0 WHERE id=1 AND enabled=1'
 ].includes(sql),'UNAUTHORIZED_SQL');
 const response=await fetch(D1URL,{method:'POST',headers:{
  Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,
  'Content-Type':'application/json'},body:JSON.stringify({sql,params:[]}),
  signal:AbortSignal.timeout(18000)});
 const data=await response.json(),first=data?.result?.[0];
 assert.ok(response.ok&&data?.success===true&&data.result?.length===1&&first?.success===true,
  'D1_CONTROL_SQL_NOT_ACKNOWLEDGED_'+response.status);
 const rw=Number(first.meta?.rows_written),changes=Number(first.meta?.changes);
 assert.ok(Number.isSafeInteger(rw)&&rw>=0&&rw<=1,'UNBOUNDED_D1_WRITE');
 assert.ok(Number.isSafeInteger(changes)&&changes>=0&&changes<=1,'UNBOUNDED_D1_CHANGE');
 return {rows:first.results||[],rw,changes};
};
const latch=async()=>{
 const result=await query('SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1 LIMIT 1');
 assert.equal(result.rw,0);assert.equal(result.rows.length,1);
 return Number(result.rows[0].enabled);
};
const setLatch=async (enabled)=>{
 const initial=await latch();
 if(initial===enabled)return;
 assert.equal(initial,1-enabled,'UNEXPECTED_LATCH_STATE');
 const sql='UPDATE soridraw_notification_activation_002 SET enabled='+
  enabled+' WHERE id=1 AND enabled='+initial;
 const result=await query(sql);
 assert.equal(result.changes,1,'LATCH_UPDATE_NOT_EXACTLY_ONE');
 assert.equal(result.rw,1,'LATCH_PHYSICAL_WRITE_NOT_ONE');
 assert.equal(await latch(),enabled,'LATCH_UPDATE_UNCONFIRMED');
};
let deployed=false,attempted=false;
const rollback=async()=>{
 // Fail closed for all environments first, then restore previous Worker flags.
 await setLatch(0);
 // Do not overwrite an unrelated concurrent Worker change. The read-only gate
 // requires exact binary and only reviewed flags while observing this release.
 const script='scripts/verify-notification-activation-029.mjs';
 let deployedNew=false;
 try{node(script,'--after-worker');deployedNew=true;}catch(error){
  const cf=async url=>{
   const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+url,{
    headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN},
    signal:AbortSignal.timeout(18000)});
   const payload=await response.json();
   assert.ok(response.ok&&payload?.success===true&&payload.result,'RECOVERY_METADATA_UNAVAILABLE');
   return payload.result;
  };
  const versions=(await cf('/workers/scripts/soridraw-explore-preview/deployments'))
   .deployments?.[0]?.versions;
  assert.ok(versions?.length===1&&Number(versions[0].percentage)===100,
   'CONCURRENT_WORKER_DEPLOY_MANUAL_HOLD');
  if(versions[0].version_id!==oldVersion){
   // A partially applied flag deployment may need rollback too. But never
   // replace an unrelated concurrent deploy; compare the exact module,
   // schedule, remaining bindings and three-environment pinned versions.
   const active=versions[0].version_id;
   const moduleInfo=await cf('/workers/workers/soridraw-explore-preview/versions/'+
    active+'?include=modules');
   const module=moduleInfo.modules?.find(x=>String(x.name).endsWith('preview-entry.js'));
   assert.ok(module?.content_base64,'RECOVERY_MODULE_UNAVAILABLE');
   assert.equal(binsha(Buffer.from(module.content_base64,'base64')),expectedHash,
    'UNRELATED_MODULE_MANUAL_HOLD');
   const nowBindings=(await cf('/workers/scripts/soridraw-explore-preview/settings')).bindings;
   const before=JSON.parse(readFileSync(join(resolve(temp),'notification-029-before.json'),'utf8'));
   const optional=new Set(['SORIDRAW_NOTIFICATION_RETENTION_013',
    'SORIDRAW_NOTIFICATION_SCHEMA_READY_013']);
   const clean=list=>JSON.stringify(list.filter(x=>!optional.has(x.name))
    .sort((a,b)=>a.name.localeCompare(b.name)));
   assert.equal(clean(nowBindings),clean(before.bindings),'UNRELATED_BINDING_MANUAL_HOLD');
   const crons=(await cf('/workers/scripts/soridraw-explore-preview/schedules'))
    .schedules?.map(x=>x.cron);
   assert.deepEqual(crons,['37 * * * *'],'UNRELATED_CRON_MANUAL_HOLD');
   for(const name of ['soridraw-explore-test','soridraw-explore-api']){
    const v=(await cf('/workers/scripts/'+name+'/deployments')).deployments?.[0]?.versions;
    assert.ok(v?.length===1&&Number(v[0].percentage)===100&&
     v[0].version_id===before.versions[name],'OTHER_ENVIRONMENT_MOVED_MANUAL_HOLD');
   }
   deployedNew=true;
  }
 }
 if(deployedNew){
  run(process.execPath,[wrangler,'rollback',oldVersion,'--name',
   'soridraw-explore-preview','--config',cfgPath,
   '--message','Stage029 social collector activation failed; restore Stage026 OFF'],{cwd:dir});
 }
 node(script,'--after-rollback');
 console.log('NOTIFICATION_029_COLLECTOR_OFF_AND_PREVIEW_FLAGS_RESTORED=PASS');
};
try{
 node('scripts/verify-notification-cost-headroom-028.mjs','--live');
 node('scripts/verify-notification-d1-dot-upgrade-018.mjs','--live-existing');
 node('scripts/verify-notification-activation-029.mjs','--before');
 assert.equal(await latch(),0);
 attempted=true;
 run(process.execPath,[wrangler,'deploy','--config',cfgPath],{cwd:dir});
 deployed=true;
 node('scripts/verify-notification-activation-029.mjs','--after-worker');
 // The *only* shared mutation: one-row OFF -> ON conditional D1 control.
 await setLatch(1);
 node('scripts/verify-notification-activation-029.mjs','--after-live');
 node('scripts/verify-notification-preview-smoke-021.mjs');
 console.log('NOTIFICATION_029_SHARED_COLLECTION_ON_3_ENV_AND_30DAY_PREVIEW_CRON=PASS');
 console.log('NOTIFICATION_029_CANONICAL_LIKES_FOLLOWS_UNCHANGED=PASS');
}catch(error){
 console.error('NOTIFICATION_029_RELEASE_FAILED',String(error?.message||error));
 if(attempted){
  try{await rollback();}
  catch(e){console.error('NOTIFICATION_029_ROLLBACK_MANUAL_HOLD',String(e?.message||e));}
 }
 process.exitCode=1;
}

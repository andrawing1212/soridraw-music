// Exact Stage021 GET-only -> Stage026 PREVIEW retention release executor.
// CLI only from the one-use owner-approved GitHub workflow. No user-data writes.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
const ROOT=process.cwd(),TEMP=process.env.RUNNER_TEMP;
assert.ok(TEMP&&resolve(TEMP)!==resolve(ROOT),'RUNNER_TEMP_REQUIRED');
const FROZEN=join(resolve(TEMP),'notification-026-frozen');
const DIR=join(FROZEN,'cloudflare/explore-worker');
const CONFIG=join(DIR,'canonical/wrangler.preview.jsonc');
const WRANGLER=join(DIR,'node_modules/wrangler/bin/wrangler.js');
const MAIN=join(DIR,'canonical/preview-entry.js');
const OLD=join(resolve(TEMP),'notification-026-old.js');
const NEW=join(resolve(TEMP),'notification-026-new.js');
const JOBS=[
 'notification-unified-api-004.mjs','notification-unified-inbox-004.mjs',
 'notification-inbox-001.mjs','notification-preferences-retention-002.mjs',
 'notification-retention-coordinator-005.mjs','notification-retention-scheduler-013.mjs',
];
const call=(cmd,args,opts={})=>{
 const res=spawnSync(cmd,args,{cwd:opts.cwd||ROOT,stdio:'inherit',timeout:420000,
  env:process.env,encoding:'utf8'});
 if(res.error)throw res.error;
 if(res.status!==0)throw Error('NOTIFICATION_026_COMMAND_EXIT_'+res.status+'_'+args[0]);
};
const runScript=(p,...args)=>call(process.execPath,[p,...args]);
const config=()=>JSON.parse(readFileSync(CONFIG,'utf8'));
const writeConfig=data=>writeFileSync(CONFIG,JSON.stringify(data,null,2)+'\n');
const mode=process.argv[2];
if(mode==='--prepare'){
 assert.ok(!existsSync(FROZEN),'ONE_SHOT_WORKTREE_ONLY');
 call('git',['worktree','add','--detach',FROZEN,'5bf84dee4c9db7f0ce8296a57781be9161d8e59f']);
 call('npm',['install','--no-audit','--no-fund','--package-lock=false'],{cwd:DIR});
 runScript('scripts/verify-notification-preview-retention-026.mjs','--emit',OLD,NEW);
 for(const name of JOBS){
  const source=join(ROOT,'cloudflare/explore-worker/runtime',name);
  const dest=join(DIR,'runtime',name);
  assert.ok(!existsSync(dest),'FROZEN_DEPENDENCY_ALREADY_PRESENT_'+name);
  copyFileSync(source,dest);
 }
 const oldConfig=config();
 const current=JSON.parse(readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc','utf8'));
 const withoutCron=structuredClone(current);delete withoutCron.triggers;
 assert.deepEqual(withoutCron,oldConfig,'LIVE_BASE_CONFIG_DRIFT_BEFORE_CRON');
 assert.equal(oldConfig.keep_vars,true);
 assert.equal(oldConfig.vars?.SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019,undefined);
 assert.equal(oldConfig.vars?.SORIDRAW_NOTIFICATION_RETENTION_013,undefined);
 assert.equal(oldConfig.vars?.SORIDRAW_NOTIFICATION_SCHEMA_READY_013,undefined);
 assert.ok(!oldConfig.triggers?.crons?.length);
 oldConfig.vars.SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019='1';
 copyFileSync(OLD,MAIN);
 writeConfig(oldConfig);
 call(process.execPath,[WRANGLER,'deploy','--config',CONFIG,'--dry-run','--outdir',
  join(resolve(TEMP),'notification-026-old')],{cwd:DIR});
 copyFileSync(NEW,MAIN);
 const candidate=structuredClone(oldConfig);
 candidate.triggers={crons:['37 * * * *']};
 writeConfig(candidate);
 call(process.execPath,[WRANGLER,'deploy','--config',CONFIG,'--dry-run','--outdir',
  join(resolve(TEMP),'notification-026-new')],{cwd:DIR});
 runScript('scripts/verify-notification-preview-retention-live-026.mjs','--bundles',
  join(resolve(TEMP),'notification-026-old'),join(resolve(TEMP),'notification-026-new'));
 console.log('NOTIFICATION_026_EXACT_PREVIOUS_BUNDLE_AND_MINIMAL_CRON_DRYRUN=PASS');
 process.exit(0);
}
if(mode!=='--deploy')throw Error('EXPLICIT_PREPARE_OR_DEPLOY_MODE_ONLY');
assert.ok(existsSync(WRANGLER)&&existsSync(MAIN)&&existsSync(CONFIG),'PREPARE_REQUIRED');
const account='e1a30fc9ef497fda1d34f4ab3dc1da45';
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,account);
assert.ok(process.env.CLOUDFLARE_API_TOKEN?.length>15);
const prefix='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/soridraw-explore-preview';
const req=async (suffix,opts={})=>{
 const r=await fetch(prefix+suffix,{
  method:opts.method||'GET',
  headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,
   'Content-Type':'application/json',Accept:'application/json'},
  ...(opts.body?{body:opts.body}:{}),signal:AbortSignal.timeout(18000),
 });
 const j=await r.json();assert.ok(r.ok&&j.success===true&&j.result,'CF_API_'+r.status);
 return j.result;
};
const rollback=async()=>{
 // No auto-rollback if an unrelated deployment took over.
 runScript('scripts/verify-notification-preview-retention-live-026.mjs','--rollback-precheck');
 const payload=await req('/deployments'),vs=payload.deployments?.[0]?.versions;
 assert.ok(vs?.length===1&&Number(vs[0].percentage)===100,'WORKER_CONCURRENT_CHANGE');
 const ver=vs[0].version_id;
 const expectedNew=readFileSync(join(resolve(TEMP),'notification-026-candidate.sha'),'utf8').trim();
 assert.match(expectedNew,/^[a-f0-9]{64}$/);
 const crons=(await req('/schedules')).schedules?.map(x=>x.cron);
 assert.ok(Array.isArray(crons)&&(
  crons.length===0||crons.length===1&&crons[0]==='37 * * * *'),
  'UNRELATED_CRON_MODIFICATION');
 if(crons.length){
  const cleared=await req('/schedules',{method:'PUT',body:'[]'});
  assert.deepEqual(cleared.schedules,[],'CRON_ROLLBACK_FAILED');
  console.log('NOTIFICATION_026_CRON_ROLLBACK_TO_EMPTY=PASS');
 }
 if(ver!=='e8772114-3f75-4143-90f3-b321592b2e74'){
  // The exact module hash was already compared by --rollback-precheck.
  call(process.execPath,[WRANGLER,'rollback',
   'e8772114-3f75-4143-90f3-b321592b2e74',
   '--name','soridraw-explore-preview','--config',CONFIG,
   '--message','Stage026 cron failed, restore previous GET-only Worker'],{cwd:DIR});
 }
 runScript('scripts/verify-notification-preview-retention-live-026.mjs','--rollback-postcheck');
 console.log('NOTIFICATION_026_PREVIOUS_GET_AND_NO_CRON_FULLY_RESTORED=PASS');
};
let attempted=false;
try{
 runScript('scripts/verify-notification-preview-retention-live-026.mjs','--before');
 runScript('scripts/verify-notification-d1-dot-upgrade-018.mjs','--live-existing');
 attempted=true;
 call(process.execPath,[WRANGLER,'deploy','--config',CONFIG],{cwd:DIR});
 runScript('scripts/verify-notification-preview-retention-live-026.mjs','--after');
 runScript('scripts/verify-notification-preview-smoke-021.mjs');
 console.log('NOTIFICATION_026_PREVIEW_30DAY_CRON_DEPLOYED_FLAGS_OFF=PASS');
 console.log('NOTIFICATION_026_TEST_PRODUCTION_UNCHANGED_D1_COLLECTION_OFF=PASS');
}catch(error){
 console.error('NOTIFICATION_026_DEPLOY_OR_POSTCHECK_FAILED',String(error?.message||error));
 if(attempted){
  try{await rollback();}
  catch(recoveryError){
   console.error('NOTIFICATION_026_ROLLBACK_MANUAL_HOLD',String(recoveryError?.message||recoveryError));
  }
 }
 process.exitCode=1;
}

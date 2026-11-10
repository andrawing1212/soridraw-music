// Stage026: exact minimal PREVIEW retention change atop the deployed Stage021
// GET-only module. Generates source in RUNNER_TEMP only, never deploys.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const BASE='5bf84dee4c9db7f0ce8296a57781be9161d8e59f';
const PRODUCT='448708f218573af0d8fa67036a364916bf0b4399';
const PATH='cloudflare/explore-worker/canonical/preview-entry.js';
const sourceAt=ref=>execFileSync('git',['show',ref+':'+PATH],{encoding:'utf8',maxBuffer:8*1024*1024});
const hash=s=>createHash('sha256').update(s).digest('hex');
const blob=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0'+s).digest('hex');
const orig=sourceAt(BASE),modern=sourceAt(PRODUCT);
assert.equal(blob(orig),'094bbf8e4c3daf7a382e77733ed6a0ceb2fe683d');
assert.equal(blob(modern),'6980f0e6b676b9de04f5343e8eb76374265359bf');
assert.equal(readFileSync(PATH,'utf8'),modern,'MODERN_SOURCE_CHANGED');
const copy=(start,end)=>{
 const a=modern.indexOf(start),b=modern.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'EXACT_ANCHOR_MISSING_'+start);
 assert.equal(modern.indexOf(start,a+1),-1,'ANCHOR_DUPLICATE_'+start);
 return modern.slice(a,b);
};
const inject=(src,anchor,insert)=>{
 assert.equal(src.split(anchor).length,2,'INSERT_ANCHOR_NOT_UNIQUE');
 return src.replace(anchor,anchor+insert);
};
const baseImport="import baseWorker from './preview-worker.js';\n";
const getImport="import {handleUnifiedNotificationsApi004}\n from '../runtime/notification-unified-api-004.mjs';\n";
const cronImport="import {NOTIFICATION_RETENTION_CRON_013,runNotificationScheduled013}\n from '../runtime/notification-retention-scheduler-013.mjs';\n";
assert.ok(modern.includes(getImport)&&modern.includes(cronImport));
const get=copy('    // Stage019: PREVIEW-only authenticated inbox GET candidate.',
 '    // Notification preferences remain strictly OFF until');
const cron=copy('    // Stage025: PREVIEW-only registered 30-day retention cron candidate.',
 '    // SORIDRAW_PREDEPLOY_PENDING_LIKE_DRAIN_192_20260924');
assert.match(get,/NOTIFICATION_PREVIEW_INBOX_019_COMPILED_OPEN = true/);
assert.match(get,/SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019 === '1'/);
assert.match(get,/const actor = await validateExploreAuth307/);
assert.match(cron,/NOTIFICATION_RETENTION_013_COMPILED_OPEN = true/);
assert.match(cron,/env\?\.SORIDRAW_ENVIRONMENT !== 'preview'/);
assert.match(cron,/runNotificationScheduled013\(\{controller,env,compiledOpen:true\}\)/);
const scheduled="  async scheduled(controller, env, ctx) {\n";
const fetch="  async fetch(request, env, ctx) {\n    const url = new URL(request.url);\n";
const previously=inject(inject(orig,baseImport,getImport),fetch,get);
const candidate=inject(inject(previously,baseImport,getImport==='unused'? '' : cronImport),scheduled,cron);
assert.equal(candidate.replace(cronImport,'').replace(cron,'').replace(getImport,'').replace(get,''),orig,
 'FROZEN_NON_NOTIFICATION_CODE_CHANGED');
assert.equal(candidate.replace(cronImport,'').replace(cron,''),previously,
 'STAGE021_GET_CODE_DRIFT');
assert.equal((candidate.match(/NOTIFICATION_RETENTION_013_COMPILED_OPEN = true/g)||[]).length,1);
assert.equal((candidate.match(/Stage019: PREVIEW-only authenticated inbox GET candidate/g)||[]).length,1);
const runtime={
 'notification-unified-api-004.mjs':'7b43f7d6533b80d6aa2adbefbe6f8db5fadbb8b2',
 'notification-unified-inbox-004.mjs':'149d56a4da7ff3c8154f8977f8713def89405fc5',
 'notification-inbox-001.mjs':'7b555a4fe1654cb8021f9a9e7d46797bd720fcd8',
 'notification-preferences-retention-002.mjs':'1e13ff61b6f2f25ca99385750f9c1c826c82d909',
 'notification-retention-coordinator-005.mjs':'262567341819f0abc8c47e5c73b257244f774a57',
 'notification-retention-scheduler-013.mjs':'8484602448591566de20cbcd2edb1eb1fca508d9',
};
for(const [name,expected] of Object.entries(runtime)){
 const s=readFileSync('cloudflare/explore-worker/runtime/'+name,'utf8');
 assert.equal(blob(s),expected,'PINNED_RUNTIME_DRIFT_'+name);
}
const cfg=JSON.parse(readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc','utf8'));
assert.equal(cfg.name,'soridraw-explore-preview');
assert.deepEqual(cfg.triggers?.crons,['37 * * * *']);
assert.equal(cfg.vars?.SORIDRAW_ENVIRONMENT,'preview');
assert.equal(cfg.vars?.SORIDRAW_NOTIFICATION_RETENTION_013,undefined);
assert.equal(cfg.vars?.SORIDRAW_NOTIFICATION_SCHEMA_READY_013,undefined);
assert.equal(cfg.vars?.SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019,undefined);
console.log('NOTIFICATION_026_STAGED_SOURCE_MINIMAL_DELTA=PASS');
console.log('NOTIFICATION_026_ACTIVE_GET_SOURCE_PRESERVED=PASS');
console.log('NOTIFICATION_026_FLAGS_ABSENT_COLLECTION_AND_MAINTENANCE_OFF=PASS');
const arg=process.argv.indexOf('--emit');
if(arg>=0){
 const parent=resolve(process.env.RUNNER_TEMP||'/invalid');
 for(const [filename,content] of [[process.argv[arg+1],previously],[process.argv[arg+2],candidate]]){
  const full=resolve(filename||'');
  assert.ok(full.startsWith(parent+'/'),'RUNNER_TEMP_ONLY');
  writeFileSync(full,content,{flag:'wx',mode:0o600});
 }
 console.log('NOTIFICATION_026_PREVIOUS_SOURCE_SHA256='+hash(previously));
 console.log('NOTIFICATION_026_CANDIDATE_SOURCE_SHA256='+hash(candidate));
}

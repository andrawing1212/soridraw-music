// Stage020 source-only: project one authenticated GET route onto the frozen
// PREVIEW Worker source. Does NOT modify canonical files or deploy anything.
// A live module hash mismatch must HOLD; a Git source SHA is not itself proof
// of the exact Cloudflare active bundle.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';

const PIN='5bf84dee4c9db7f0ce8296a57781be9161d8e59f';
const PIN_BLOB='094bbf8e4c3daf7a382e77733ed6a0ceb2fe683d';
const SOURCE_BLOB='d4c61df583af67c66a04dd128d5debe3e25d98a1';
const LIVE_VERSION='2960d485-fe66-4136-9f84-41ce3e0d4b58';
const SHARED_D1='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const PATH='cloudflare/explore-worker/canonical/preview-entry.js';
const CURRENT=readFileSync(PATH,'utf8');
const FROZEN=execFileSync('git',['show',PIN+':'+PATH],{
 encoding:'utf8',maxBuffer:4*1024*1024,
});
const blobHash=s=>createHash('sha1').update('blob '+Buffer.byteLength(s)+'\0'+s).digest('hex');
const sha=s=>createHash('sha256').update(s).digest('hex');
assert.equal(blobHash(FROZEN),PIN_BLOB,'FROZEN_GIT_SOURCE_MISMATCH');
assert.equal(blobHash(CURRENT),SOURCE_BLOB,'STAGE019_SOURCE_SHA_DRIFT');
const imports="import {handleUnifiedNotificationsApi004}\n from '../runtime/notification-unified-api-004.mjs';\n";
const baseImport="import baseWorker from './preview-worker.js';\n";
assert.equal(FROZEN.split(baseImport).length,2,'BASE_IMPORT_DRIFT');
assert.equal(CURRENT.split(imports).length,2,'STAGE019_IMPORT_DRIFT');
const start='    // Stage019: PREVIEW-only authenticated inbox GET candidate.';
const end='    // Notification preferences remain strictly OFF until';
const i=CURRENT.indexOf(start),j=CURRENT.indexOf(end,i);
assert.ok(i>=0&&j>i,'STAGE019_ROUTE_MISSING');
const route=CURRENT.slice(i,j);
const dispatch="  async fetch(request, env, ctx) {\n    const url = new URL(request.url);\n";
assert.equal(FROZEN.split(dispatch).length,2,'FROZEN_FETCH_DRIFT');
assert.equal(CURRENT.split(dispatch).length,2,'MODERN_FETCH_DRIFT');
assert.match(route,/env\?\.SORIDRAW_ENVIRONMENT === 'preview'/);
assert.match(route,/SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019 === '1'/);
assert.match(route,/request\.method !== 'GET' && request\.method !== 'OPTIONS'/);
assert.match(route,/const actor = await validateExploreAuth307\(request,env,ctx\)/);
assert.match(route,/verifyUid:async\(\)=>actor\.uid,verifyAdmin:async\(\)=>false/);
assert.doesNotMatch(route,/\b(?:UPDATE|DELETE|INSERT|PUT|POST)\b(?:(?!request\.method)[\s\S]){0,25}(?:FROM|INTO|notifications\/)/i);
const cfg=JSON.parse(readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc','utf8'));
assert.equal(cfg.name,'soridraw-explore-preview');
assert.equal(cfg.vars?.SORIDRAW_ENVIRONMENT,'preview');
assert.equal(cfg.vars?.SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019,undefined,
 'RUNTIME_FLAG_MUST_REMAIN_ABSENT');
assert.equal(cfg.vars?.SORIDRAW_NOTIFICATION_INBOX_004,undefined);
const frozenCfg=JSON.parse(execFileSync('git',['show',PIN+':cloudflare/explore-worker/canonical/wrangler.preview.jsonc'],{encoding:'utf8'}));
assert.equal(frozenCfg.vars?.SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019,undefined);
assert.equal(frozenCfg.d1_databases.find(x=>x.binding==='DB')?.database_id,SHARED_D1);
const runtime={
 'notification-unified-api-004.mjs':'7b43f7d6533b80d6aa2adbefbe6f8db5fadbb8b2',
 'notification-unified-inbox-004.mjs':'149d56a4da7ff3c8154f8977f8713def89405fc5',
 'notification-inbox-001.mjs':'7b555a4fe1654cb8021f9a9e7d46797bd720fcd8',
 'notification-preferences-retention-002.mjs':'1e13ff61b6f2f25ca99385750f9f1c826c82d909',
 'notification-retention-coordinator-005.mjs':'262567341819f0abc8c47e5c73b257244f774a57',
};
for(const [name,hash] of Object.entries(runtime)){
 assert.equal(blobHash(readFileSync('cloudflare/explore-worker/runtime/'+name,'utf8')),hash,
 'RUNTIME_DEPENDENCY_DRIFT_'+name);
}
const candidate=FROZEN.replace(baseImport,baseImport+imports)
 .replace(dispatch,dispatch+route);
assert.equal(candidate.replace(imports,'').replace(route,''),FROZEN,
 'FROZEN_NON_NOTIFICATION_CODE_CHANGED');
assert.equal((candidate.match(/Stage019: PREVIEW-only authenticated inbox GET candidate/g)||[]).length,1);
assert.equal((candidate.match(/handleUnifiedNotificationsApi004/g)||[]).length,3);
assert.ok(candidate.length>FROZEN.length);
console.log('NOTIFICATION_020_FROZEN_SOURCE_EXACT_TWO_INSERTIONS=PASS');
console.log('NOTIFICATION_020_PINNED_RUNTIME_DEPENDENCIES_AND_OPT_IN_ABSENT=PASS');
const emit=process.argv.indexOf('--emit');
if(emit>=0){
 const path=resolve(process.argv[emit+1]||'');
 assert.ok(process.env.RUNNER_TEMP&&path.startsWith(resolve(process.env.RUNNER_TEMP)+'/'),
 'OUTPUT_OUTSIDE_RUNNER_TEMP');
 writeFileSync(path,candidate,{flag:'wx',mode:0o600});
 console.log('NOTIFICATION_020_MINIMAL_CANDIDATE_EMITTED=PASS');
}
const live=process.argv.indexOf('--verify-live');
if(live>=0){
 const root=process.env.RUNNER_TEMP;
 assert.ok(root&&process.argv[live+1]?.startsWith(root+'/')&&
  process.argv[live+2]?.startsWith(root+'/'),'LIVE_BUNDLE_PATH_INVALID');
 const findJs=folder=>{
  const names=readdirSync(folder).filter(n=>n.endsWith('.js'));
  assert.equal(names.length,1,'EXPECTED_SINGLE_BUNDLE');
  return readFileSync(join(folder,names[0]));
 };
 const baseline=findJs(process.argv[live+1]);
 const addition=findJs(process.argv[live+2]);
 assert.notEqual(sha(baseline),sha(addition),'GET_ROUTE_NOT_IN_CANDIDATE');
 const token=process.env.CLOUDFLARE_API_TOKEN;
 assert.ok(token?.length>15,'LIVE_READONLY_TOKEN_UNAVAILABLE');
 assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,ACCOUNT,'ACCOUNT_MISMATCH');
 const prefix='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
 const get=async path=>{
  const reply=await fetch(prefix+path,{
   method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},
   signal:AbortSignal.timeout(15000),
  });
  const body=await reply.json();
  assert.ok(reply.ok&&body.success===true&&body.result,'CLOUDFLARE_GET_FAILED_'+reply.status);
  return body.result;
 };
 const script='/workers/scripts/soridraw-explore-preview';
 const currentDeployment=async()=>{
  const payload=await get(script+'/deployments');
  const deployed=payload.deployments?.[0];
  assert.ok(deployed?.versions?.length===1,'LIVE_VERSION_SPLIT');
  const only=deployed.versions[0];
  assert.equal(Number(only.percentage),100,'LIVE_VERSION_NOT_100');
  assert.equal(only.version_id,LIVE_VERSION,'LIVE_WORKER_VERSION_DRIFT');
  return only.version_id;
 };
 const versionId=await currentDeployment();
 const settings=await get(script+'/settings');
 const bindings=settings.bindings||[];
 const bound=bindings.find(x=>x.name==='DB');
 assert.equal(String(bound?.id||bound?.database_id||bound?.uuid||''),SHARED_D1,
 'LIVE_SHARED_D1_BINDING_DRIFT');
 assert.ok(!bindings.some(x=>x.name==='SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019'),
 'LIVE_OPT_IN_MUST_REMAIN_ABSENT');
 const exact=await get('/workers/workers/soridraw-explore-preview/versions/'+versionId+'?include=modules');
 const modules=exact.modules||[];
 const source=modules.find(x=>String(x.name||'').endsWith('preview-entry.js'));
 assert.ok(source?.content_base64,'ACTIVE_SOURCE_MODULE_NOT_AVAILABLE');
 const remote=Buffer.from(source.content_base64,'base64');
 await currentDeployment();
 console.log('NOTIFICATION_020_ACTIVE_VERSION='+versionId);
 console.log('NOTIFICATION_020_ACTIVE_MODULE_SHA256='+sha(remote));
 console.log('NOTIFICATION_020_FROZEN_BASELINE_SHA256='+sha(baseline));
 console.log('NOTIFICATION_020_MINIMAL_CANDIDATE_SHA256='+sha(addition));
 console.log('NOTIFICATION_020_REMOTE_MODULE_BYTES='+remote.byteLength);
 assert.equal(sha(remote),sha(baseline),
  'NOTIFICATION_020_ACTIVE_FROZEN_BASE_MISMATCH_HOLD_NO_RELEASE');
 console.log('NOTIFICATION_020_EXACT_ACTIVE_BASE_MATCH=PASS');
 console.log('NOTIFICATION_020_CLOUDFLARE_GET_ONLY_WORKER_DEPLOY_0=PASS');
}
if(process.argv.includes('--self-test')) console.log('NOTIFICATION_020_MINIMAL_SOURCE_CONTRACT=PASS');

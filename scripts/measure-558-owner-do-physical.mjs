// APP558: one-shot, exclusively run-owned Cloudflare Durable Object proof.
// No shared D1/R2/Worker/Rules/Functions binding. Real Cloudflare namespace
// is removed by a class DELETE migration, then its Worker is removed.
// Logs distinguish physical execution from unmeasured Cloudflare bill rows.
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
const repo=resolve('.');
const account=String(process.env.CLOUDFLARE_ACCOUNT_ID||'');
const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
const run=String(process.env.GITHUB_RUN_ID||''),attempt=String(process.env.GITHUB_RUN_ATTEMPT||'');
const safeName=/^soridraw-owner558-proof-[1-9][0-9]{5,15}-[1-9][0-9]{0,3}$/;
const name='soridraw-owner558-proof-'+run+'-'+attempt;
const recordPath=join(process.env.RUNNER_TEMP||tmpdir(),'soridraw-owner-558-owned.json');
const entry=join(repo,'cloudflare/explore-worker/experiments/owner-follow-isolated-558-entry.mjs');
const wrangler=join(repo,'cloudflare/explore-worker/node_modules/.bin/wrangler');
const required=()=>{
 assert.equal(process.env.GITHUB_REPOSITORY,'andrawing1212/soridraw-music');
 assert.equal(process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER,'914');
 assert.ok(safeName.test(name),'INVALID_ISOLATED_SCRIPT_NAME');
 assert.match(account,/^[0-9a-f]{32}$/);
 assert.ok(token.length>=24,'CLOUDFLARE_CREDENTIAL_UNAVAILABLE');
 assert.ok(existsSync(entry)&&existsSync(wrangler),'PINNED_SOURCE_OR_WRANGLER_MISSING');
};
const config=(main,extra)=>({
 name,main,compatibility_date:'2026-11-01',
 workers_dev:true,keep_vars:false,
 ...extra,
});
function wranglerRun(cfg,argv){
 const proc=spawnSync(wrangler,['--config',cfg,...argv],{
  cwd:repo,encoding:'utf8',timeout:120000,input:'y\n',
  env:{...process.env,CI:'true',CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:token},
 });
 const content=String(proc.stdout||'')+'\n'+String(proc.stderr||'');
 if(proc.status!==0)throw Error('WRANGLER_'+argv[0]+'_FAIL_'+proc.status+':'+
  content.replaceAll(token,'[REDACTED]').slice(-1100));
 return content.replaceAll(token,'[REDACTED]');
}
async function scriptExists(){
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+
  account+'/workers/scripts/'+name,{headers:{Authorization:'Bearer '+token},
  signal:AbortSignal.timeout(20000)});
 if(response.status===404)return false;
 if(response.status===200)return true;
 throw Error('WORKER_EXISTENCE_UNCERTAIN_'+response.status);
}
const checkpoint=value=>writeFileSync(recordPath,JSON.stringify(value),'utf8');
const readRecord=()=>JSON.parse(readFileSync(recordPath,'utf8'));
async function cleanup(){
 if(!existsSync(recordPath)){
  console.log('APP558_CLEANUP_NO_OWNED_RECORD=PASS');return;
 }
 required();
 const rec=readRecord();
 assert.equal(rec.run,run);assert.equal(rec.attempt,attempt);
 assert.equal(rec.name,name);assert.ok(safeName.test(rec.name));
 assert.ok(rec.dir.startsWith(join(process.env.RUNNER_TEMP||tmpdir(),'soridraw-owner558-')));
 const exists=await scriptExists();
 if(exists){
  const cleanupEntry=join(rec.dir,'cleanup-entry.mjs');
  writeFileSync(cleanupEntry,"export default {fetch(){return new Response('gone',{status:410})}};\n");
  const tomb=join(rec.dir,'wrangler.cleanup.json');
  writeFileSync(tomb,JSON.stringify(config(cleanupEntry,{
   migrations:[{tag:'v1',new_sqlite_classes:['OwnerFollowIsolated558']},
    {tag:'v2',deleted_classes:['OwnerFollowIsolated558']}],
  })));
  // This destroys ONLY the script-unique synthetic DO class and its data.
  wranglerRun(tomb,['deploy']);
  console.log('APP558_OWNED_DO_DELETE_MIGRATION=PASS');
  wranglerRun(tomb,['delete','--name',name]);
 }
 assert.equal(await scriptExists(),false,'ISOLATED_WORKER_NOT_DELETED');
 console.log('APP558_OWNED_WORKER_DELETED=PASS');
 rmSync(rec.dir,{recursive:true,force:true});
 rmSync(recordPath,{force:true});
 console.log('APP558_RUN_OWNED_RESOURCE_CLEANUP=PASS');
}
if(process.argv.includes('--self-test')){
 assert.ok(safeName.test('soridraw-owner558-proof-42894782964-1'));
 assert.equal(safeName.test('soridraw-explore-preview'),false);
 const source=readFileSync(entry,'utf8');
 assert.match(source,/createOwnerFollowRecovery556/);
 assert.match(source,/synthetic-owner-only/);
 assert.doesNotMatch(source,/env\.DB|env\.PROFILE_MEDIA|env\.RATE_DB|Firebase/);
 console.log('APP558_ISOLATION_AND_EXACT_ENGINE_SOURCE=PASS');
 process.exit(0);
}
if(process.argv[2]==='cleanup'){
 if(!existsSync(recordPath)){console.log('APP558_CLEANUP_NOTHING_CREATED=PASS');process.exit(0)}
 await cleanup();process.exit(0);
}
required();
if(existsSync(recordPath))throw Error('RESIDUAL_ISOLATED_RESOURCE_RECORD');
assert.equal(await scriptExists(),false,'ISOLATED_SCRIPT_PREEXISTS');
const dir=mkdtempSync(join(process.env.RUNNER_TEMP,'soridraw-owner558-'));
const proof=randomBytes(24).toString('hex');
const file=join(dir,'wrangler.json');
writeFileSync(file,JSON.stringify(config(entry,{
 durable_objects:{bindings:[{name:'OWNER558_DO',class_name:'OwnerFollowIsolated558'}]},
 migrations:[{tag:'v1',new_sqlite_classes:['OwnerFollowIsolated558']}],
 vars:{SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',
  OWNER558_TEST_TOKEN:proof},
})));
const rec={name,run,attempt,dir,attempted:true};
checkpoint(rec); // Cleanup before any possible network mutation.
const output=wranglerRun(file,['deploy']);
const match=output.match(/https:\/\/[^\s]+?\.workers\.dev\/?/);
assert.ok(match,'NO_ISOLATED_WORKERS_DEV_URL');
const endpoint=match[0].replace(/\/$/,'');
assert.ok(endpoint.startsWith('https://'+name+'.'),'WRONG_WORKER_DESTINATION');
assert.equal(await scriptExists(),true,'ISOLATED_DEPLOY_NOT_VERIFIED');
console.log('APP558_REAL_CLOUDFLARE_OWNED_WORKER_DEPLOYED=PASS');
const http=async(route,body)=>{
 const res=await fetch(endpoint+route,{
  method:body===undefined?'GET':'POST',
  headers:{'X-Owner558-Token':proof,...(body===undefined?{}:{'Content-Type':'application/json'})},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
  signal:AbortSignal.timeout(18000),
 });
 const result=await res.json().catch(()=>({}));
 assert.equal(res.status,200,'ISOLATED_HTTP_'+route+'_'+res.status+'_'+JSON.stringify(result).slice(0,300));
 return result;
};
const poll=async(predicate,tries=22)=>{
 for(let i=0;i<tries;i++){
  const value=await http('/proof/status');
  if(predicate(value))return value;
  await new Promise(r=>setTimeout(r,1000));
 }
 throw Error('DO_ALARM_DID_NOT_FIRE_WITHIN_BOUNDED_WINDOW');
};
const ticket=(actor,operationId)=>({
 ownerUid:'A',actorUid:actor,authEpoch:'0123456789abcdef0123456789abcdef',
 operationId,expectedRevision:4,cutoverToken:'synthetic-v558',
 desired:true,beforeFollowing:false,priorR2Revision:18,
});
const b=ticket('B','op_1234567890abcdef'),c=ticket('C','op_234567890abcdef');
const denied=await fetch(endpoint+'/proof/status');
assert.equal(denied.status,403,'UNAUTHENTICATED_SYNTHETIC_ENDPOINT_MUST_DENY');
assert.equal((await http('/proof/reserve',b)).status,'reserved');
assert.equal((await http('/proof/reserve',b)).status,'already-reserved');
assert.equal((await http('/proof/reserve',c)).status,'reserved');
let state=await http('/proof/status');
assert.equal(state.pending.entries.length,2,'DO_LOST_DISTINCT_OWNER_OPERATIONS');
assert.ok(Number.isSafeInteger(state.alarmAt)&&state.alarmAt>0);
state=await poll(x=>x.hits>0&&x.pending?.entries?.[0]?.attempts>=1);
console.log('APP558_PHYSICAL_DO_AUTONOMOUS_ALARM=PASS;HITS='+state.hits);
// Redeploy EXACT SAME disposable script and test persisted queue. This is a
// code-refresh test, NOT a claim that the DO instance was forcibly evicted.
wranglerRun(file,['deploy']);
state=await http('/proof/status');
assert.equal(state.pending.entries.length,2,'DO_STATE_LOST_ON_VERSION_REDEPLOY');
console.log('APP558_PHYSICAL_DO_REDEPLOY_RETENTION=PASS');
assert.equal((await http('/proof/mode',{mode:'success'})).ok,true);
for(let i=0;i<3;i++){
 state=await http('/proof/status');
 if(!state.pending)break;
 await http('/proof/step',{});
}
state=await http('/proof/status');
assert.equal(state.pending,null,'DO_SUCCESS_NOT_ACKED');
console.log('APP558_PHYSICAL_DO_REPLAY_AND_OWNER_ORDER=PASS');
await http('/proof/mode',{mode:'offline'});
const d=ticket('D','op_34567890abcdef12');
assert.equal((await http('/proof/reserve',d)).status,'reserved');
for(let i=0;i<8;i++){
 const out=await http('/proof/step',{});
 assert.equal(out.status,i===7?'manual-hold':'retry-scheduled');
}
state=await http('/proof/status');
assert.equal(state.pending.entries[0].dead,true);
assert.equal(state.pending.entries[0].attempts,8);
console.log('APP558_PHYSICAL_DO_MAX8_RETAINED_MANUAL_HOLD=PASS');
const measured={operationType:'isolated-DO-synthetic',
 authenticatedRequests:true,
 automaticAlarmsAtLeast:state.hits,
 distinctReservations:3,
 additionalCanonicalD1Writes:0,
 physicalDOStorageRows:'NOT_AVAILABLE_PER_OPERATION_FROM_STORAGE_API',
 physicalFullFollowW2:'NOT_MEASURED',
 workersRequests:'SMALL_SYNTHETIC_ONLY',
 rules:'NO_PRODUCTION_BINDINGS',
};
console.log('APP558_ISOLATED_METRICS='+JSON.stringify(measured));
await http('/proof/cleanup',{});
state=await http('/proof/status');
assert.equal(state.pending,null);
assert.equal(state.alarmAt,null);
console.log('APP558_OWNED_DO_INSTANCE_DATA_CLEARED=PASS');
// The workflow always() cleanup stage additionally deletes namespace + script.

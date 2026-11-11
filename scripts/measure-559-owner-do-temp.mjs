// APP559: real Cloudflare temporary-account Durable Object isolation.
// This NEVER uses the owner's Cloudflare account/API token or shared bindings.
// Wrangler temporary preview account expires automatically; claim URL is secret.
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
const repo=resolve('.');
const run=String(process.env.GITHUB_RUN_ID||'');
const attempt=String(process.env.GITHUB_RUN_ATTEMPT||'');
const name='soridraw-owner559-temp-'+run+'-'+attempt;
const OWN=/^soridraw-owner559-temp-[1-9][0-9]{5,15}-[1-9][0-9]{0,3}$/;
const marker=join(process.env.RUNNER_TEMP||tmpdir(),'soridraw-owner559-temp-owned.json');
const entry=join(repo,'cloudflare/explore-worker/experiments/owner-follow-isolated-558-entry.mjs');
const wrangler=join(repo,'cloudflare/explore-worker/node_modules/.bin/wrangler');
const env={...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'};
for(const key of ['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN','CLOUDFLARE_EMAIL','CLOUDFLARE_API_KEY'])delete env[key];
function check(){
 assert.equal(process.env.GITHUB_REPOSITORY,'andrawing1212/soridraw-music');
 assert.equal(process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER,'914');
 assert.ok(OWN.test(name),'INVALID_TEMP_SCRIPT_ID');
 assert.ok(existsSync(entry)&&existsSync(wrangler));
 assert.equal(Boolean(process.env.CLOUDFLARE_API_TOKEN),false,
  'OWNER_ACCOUNT_CREDENTIALS_MUST_NOT_BE_PRESENT');
}
function cli(args,cfg){
 const r=spawnSync(wrangler,['--config',cfg,...args],{
  cwd:repo,encoding:'utf8',timeout:120000,input:'y\n',env,
 });
 if(r.status!==0){
  const raw=String(r.stdout||'')+'\n'+String(r.stderr||'');
  const code=raw.match(/\[code:\s*\d+\]/)?.[0]||'no-platform-code';
  throw Error('TEMP_WORKER_'+args[0]+'_FAILED_'+r.status+'_'+code);
 }
 return String(r.stdout||'')+'\n'+String(r.stderr||'');
}
const config=(main,token)=>JSON.stringify({
 name,main,compatibility_date:'2026-11-01',
 workers_dev:true,
 durable_objects:{bindings:[{name:'OWNER558_DO',class_name:'OwnerFollowIsolated558'}]},
 migrations:[{tag:'v1',new_sqlite_classes:['OwnerFollowIsolated558']}],
 vars:{SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',
  OWNER558_TEST_TOKEN:token},
});
async function cleanup(){
 if(!existsSync(marker)){console.log('APP559_TEMP_NO_OWNED_RESOURCE=PASS');return;}
 check();
 const rec=JSON.parse(readFileSync(marker,'utf8'));
 assert.equal(rec.run,run);assert.equal(rec.attempt,attempt);assert.equal(rec.name,name);
 assert.ok(rec.dir.startsWith(join(process.env.RUNNER_TEMP||tmpdir(),'soridraw-owner559-')));
 // The temporary Cloudflare account expires after 60 minutes without a claim.
 // Attempt exact-name delete while the temporary Wrangler session is valid.
 if(rec.deployed){
  try{
   cli(['delete','--name',name],rec.config);
   console.log('APP559_TEMP_WORKER_DELETE=PASS');
  }catch{
   console.log('APP559_TEMP_WORKER_DELETE=UNAVAILABLE_60MIN_ACCOUNT_EXPIRY');
  }
 }
 rmSync(rec.dir,{recursive:true,force:true});
 rmSync(marker,{force:true});
 console.log('APP559_OWNER_ACCOUNT_UNTOUCHED_TEMP_ACCOUNT_EXPIRES_60MIN=PASS');
}
if(process.argv.includes('--self-test')){
 assert.ok(OWN.test('soridraw-owner559-temp-42959820645-1'));
 assert.equal(OWN.test('soridraw-explore-preview'),false);
 const source=readFileSync(entry,'utf8');
 assert.match(source,/createOwnerFollowRecovery556/);
 assert.doesNotMatch(source,/env\.DB|env\.PROFILE_MEDIA|env\.RATE_DB|Firebase/);
 console.log('APP559_TEMP_ACCOUNT_SYNTHETIC_NO_SHARED_BINDINGS=PASS');
 process.exit(0);
}
if(process.argv[2]==='cleanup'){await cleanup();process.exit(0);}
check();
if(existsSync(marker))throw Error('RESIDUAL_TEMP_MARKER');
const dir=mkdtempSync(join(process.env.RUNNER_TEMP,'soridraw-owner559-'));
const token=randomBytes(24).toString('hex');
const conf=join(dir,'wrangler.json');
writeFileSync(conf,config(entry,token));
const checkpoint=(deployed)=>writeFileSync(marker,JSON.stringify({
 name,run,attempt,dir,config:conf,deployed,
}));
checkpoint(false);
const response=cli(['deploy','--temporary'],conf);
const matches=[...response.matchAll(/https:\/\/[^\s"'<>]+\.workers\.dev\/?/g)];
const valid=matches.map(m=>m[0].replace(/\/$/,'')).find(link=>{
 try{const u=new URL(link);return u.hostname.endsWith('.workers.dev')&&u.hostname.startsWith(name+'.');}
 catch{return false}
});
assert.ok(valid,'NO_VALID_TEMP_WORKER_URL');
checkpoint(true);
console.log('APP559_REAL_CLOUDFLARE_TEMP_WORKER=PASS');
const http=async(route,body)=>{
 const r=await fetch(valid+route,{
  method:body===undefined?'GET':'POST',
  headers:{'X-Owner558-Token':token,...(body===undefined?{}:{'Content-Type':'application/json'})},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
  signal:AbortSignal.timeout(16000),
 });
 const data=await r.json().catch(()=>({}));
 assert.equal(r.status,200,'TEMP_WORKER_HTTP_'+route+'_'+r.status);
 return data;
};
const ticket=(actor,id)=>({
 ownerUid:'A',actorUid:actor,authEpoch:'0123456789abcdef0123456789abcdef',
 operationId:id,expectedRevision:4,cutoverToken:'synthetic-v559',
 desired:true,beforeFollowing:false,priorR2Revision:18,
});
const b=ticket('B','op_1234567890abcdef');
const c=ticket('C','op_234567890abcdef');
const unauthorized=await fetch(valid+'/proof/status');
assert.equal(unauthorized.status,403);
assert.equal((await http('/proof/reserve',b)).status,'reserved');
assert.equal((await http('/proof/reserve',b)).status,'already-reserved');
assert.equal((await http('/proof/reserve',c)).status,'reserved');
let state=await http('/proof/status');
assert.equal(state.pending?.entries?.length,2,'DISTINCT_OWNER_QUEUE_LOST');
assert.ok(Number.isSafeInteger(state.alarmAt)&&state.alarmAt>0);
let auto=false;
for(let i=0;i<25;i++){
 await new Promise(r=>setTimeout(r,1000));
 state=await http('/proof/status');
 if(state.hits>0&&state.pending?.entries?.[0]?.attempts>0){auto=true;break}
}
assert.equal(auto,true,'TEMP_ACTUAL_ALARM_DID_NOT_RUN_IN_BOUNDED_WINDOW');
console.log('APP559_REAL_DO_AUTONOMOUS_ALARM=PASS;HITS='+state.hits);
assert.equal((await http('/proof/mode',{mode:'success'})).ok,true);
for(let i=0;i<4;i++){
 state=await http('/proof/status');
 if(!state.pending)break;
 await http('/proof/step',{});
}
state=await http('/proof/status');
assert.equal(state.pending,null,'TEMP_DELIVERED_QUEUE_NOT_ACKED');
console.log('APP559_REAL_DO_PERSISTED_ACK_AFTER_OUTAGE=PASS');
await http('/proof/mode',{mode:'offline'});
const d=ticket('D','op_34567890abcdef12');
assert.equal((await http('/proof/reserve',d)).status,'reserved');
for(let i=0;i<8;i++){
 const result=await http('/proof/step',{});
 assert.equal(result.status,i===7?'manual-hold':'retry-scheduled');
}
state=await http('/proof/status');
assert.equal(state.pending.entries[0].dead,true);
assert.equal(state.pending.entries[0].attempts,8);
console.log('APP559_REAL_DO_8_FAILURE_HOLD=PASS');
await http('/proof/cleanup',{});
state=await http('/proof/status');
assert.equal(state.pending,null);
assert.equal(state.alarmAt,null);
console.log('APP559_REAL_DO_DELETE_ALL_AND_ALARM=PASS');
console.log('APP559_METRICS='+JSON.stringify({
 exactAccount:'TEMPORARY_CLOUDFLARE_PREVIEW_ONLY',
 distinctReservations:3,autonomousAlarmFired:true,
 canonicalD1Writes:0,canonicalR2Reads:0,
 physicalCloudflareDOInvocation:'OBSERVED',
 physicalCloudflareBilledRows:'NOT_EXPOSED_BY_TEMP_ACCOUNT',
 estimateOnly:'public_DO_requests_and_SQLite_storage_tariff',
 sourceToActiveRelease:'NO_GO',
}));

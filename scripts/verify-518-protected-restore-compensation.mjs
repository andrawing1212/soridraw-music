// app518 P2 isolated red-team regression. Kept historical filename so the
// existing CI runs it; protected RESTORE is now fail-closed, NOT compensated.
// Exercise the real source; all Cloudflare/Wrangler actions are fake functions.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('.deploy/release-worker-runtime.mjs','utf8');
const start=source.indexOf('async function assertNoLegacyExploreBudgetDowngrade518()');
const end=source.indexOf('\nawait assertNoLegacyExploreBudgetDowngrade518();',start);
const restoreStart=source.indexOf('async function restore() {');
const restoreEnd=source.indexOf('\n// app518: a legacy Explore',restoreStart);
assert.ok(start>restoreEnd&&end>start);
assert.ok(end<source.indexOf('\nawait makeConfig();',end));
assert.ok(end<source.indexOf("if (action === 'restore') {",end));
const guardCode=source.slice(start,end)+'\nreturn assertNoLegacyExploreBudgetDowngrade518;';
const restoreCode=source.slice(restoreStart,restoreEnd)+'\nreturn restore;';
const TARGET='deadbeef-1111-4111-8111-123456789abc';
const CURRENT='aaaabbbb-2222-4222-8222-123456789abc';
const OTHER='cccccccc-3333-4333-8333-123456789abc';
const OLD_SCHEDULE=[{cron:'*/10 * * * *'}];
const NEW_SCHEDULE=[{cron:'*/5 * * * *'}];
const OTHER_SCHEDULE=[{cron:'*/20 * * * *'}];
const markers=['SORIDRAW_D1_ACCOUNT_BUDGET_ENFORCEMENT_518',
 'SORIDRAW_APP518_RELEASE_FENCES_VERIFIED'];
const names=['soridraw-explore-api','soridraw-explore-test','soridraw-explore-preview'];

const setup=({protectedAt='soridraw-explore-preview',marker=markers[0],
 externalChange='between-reads',noMarker=false,readError=false}={})=>{
 let active=CURRENT,schedules=OLD_SCHEDULE;
 const observed=[],commands=[],schedulePuts=[];
 const cfGet=async url=>{
  const name=names.find(n=>url.endsWith('/'+n+'/settings'));
  if(!name)throw Error('UNEXPECTED_API_READ');
  observed.push(name);
  // External actor deploys C outside the GitHub mutex while our GETs
  // are executing. This must not enable a subsequent rollback write.
  if(externalChange==='between-reads'&&(name===names[1]||name===protectedAt)){
   active=OTHER;schedules=OTHER_SCHEDULE;
  }
  if(readError&&name===names[1])throw Error('HTTP_403');
  const bindings=[{name:'DB',type:'d1',database_id:'shared'}];
  if(!noMarker&&name===protectedAt)
   bindings.push({name:marker,type:'plain_text',text:'ENFORCE'});
  return {bindings};
 };
 const guard=new Function('cfGet','apiBase','action',guardCode)(
  cfGet,'https://api.cloudflare.com/client/v4/accounts/account','restore');
 const run=(_binary,args)=>{
  commands.push(args);
  if(args[0]==='wrangler'&&args[1]==='versions'&&args[2]==='deploy')
   active=args[3].split('@')[0];
 };
 const cfPut=async(_url,value)=>{schedulePuts.push(value);schedules=value;};
 const actualRestore=new Function('process','run','WRANGLER','CONFIG_PATH',
  'WORKER_DIR','cfPut','apiBase','target','sleep','activeVersion',
  'readSchedules','mode','console',restoreCode)(
  {execPath:'node',env:{RELEASE_WORKER_VERSION:TARGET,
   RELEASE_WORKER_SCHEDULES_JSON:JSON.stringify(NEW_SCHEDULE)}},
  run,'wrangler','/config','/worker',cfPut,'https://fake-cloudflare.example/v4',
  {worker:'soridraw-explore-test'},async()=>{},async()=>active,
  async()=>schedules,'test',{log:()=>{}});
 const invoke=async()=>{
  await guard();
  await actualRestore();
 };
 return {invoke,guard,active:()=>active,schedules:()=>schedules,
  commands,schedulePuts,observed};
};

for(const protectedAt of names)for(const marker of markers){
 const attempt=setup({protectedAt,marker});
 await assert.rejects(attempt.invoke(),/HOLD_518_PROTECTED_RESTORE_ATOMIC_DEPLOY_FENCE_UNVERIFIED/);
 assert.equal(attempt.active(),OTHER,'external C traffic must remain 100%');
 assert.deepEqual(attempt.schedules(),OTHER_SCHEDULE,'external C schedule must remain intact');
 assert.equal(attempt.commands.length,0,'NO Wrangler traffic change in race');
 assert.equal(attempt.schedulePuts.length,0,'NO Cloudflare schedules PUT in race');
 const direct=setup({protectedAt,marker,externalChange:'none'});
 await assert.rejects(direct.invoke(),/HOLD_518_PROTECTED_RESTORE_ATOMIC_DEPLOY_FENCE_UNVERIFIED/);
 assert.equal(direct.active(),CURRENT,'no previous protected traffic mutation');
 assert.equal(direct.commands.length,0);
 assert.equal(direct.schedulePuts.length,0);
}
const unauthorized=setup({readError:true});
await assert.rejects(unauthorized.invoke(),/HTTP_403/);
assert.equal(unauthorized.commands.length,0);
assert.equal(unauthorized.schedulePuts.length,0);
// The unprotected, pre-existing restore behavior remains functional.
const unprotected=setup({noMarker:true,externalChange:'none'});
await unprotected.invoke();
assert.equal(unprotected.active(),TARGET);
assert.deepEqual(unprotected.schedules(),NEW_SCHEDULE);
assert.equal(unprotected.commands.length,1);
assert.equal(unprotected.schedulePuts.length,1);
console.log('APP518_PROTECTED_ROLLBACK_CONCURRENT_C_TRAFFIC_OVERWRITE_DENIED_W0=PASS');
console.log('APP518_PROTECTED_ROLLBACK_CONCURRENT_C_SCHEDULE_OVERWRITE_DENIED_W0=PASS');
console.log('APP518_PROTECTED_ROLLBACK_NO_ATOMIC_CAS_FAILS_BEFORE_MUTATION=PASS');
console.log('APP518_UNPROTECTED_LEGACY_RESTORE_RETAINED=PASS');

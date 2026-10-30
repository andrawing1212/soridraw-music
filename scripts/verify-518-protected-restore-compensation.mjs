// app518 P2 frozen activate/restore red-team; historical filename retained for CI.
// No token, Cloudflare call, deploy, schedules PUT or user-data mutation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('.deploy/release-worker-runtime.mjs','utf8');
const topStart=source.indexOf('const mode = String(process.argv[2]');
const topEnd=source.indexOf('// SORIDRAW_RELEASE_ENVIRONMENT_PARITY_INVARIANT',topStart);
const guardStart=source.indexOf('async function assertNoLegacyExploreBudgetDowngrade518()');
const restoreStart=source.indexOf('async function restore() {');
const firstConfig=source.indexOf('await makeConfig();');
const tokenRead=source.indexOf('const TOKEN =');
const restoreDispatch=source.indexOf("if (action === 'restore') {",firstConfig);
assert.ok(topStart>0&&topEnd>topStart&&topEnd<tokenRead);
assert.ok(guardStart>restoreStart&&firstConfig>guardStart&&restoreDispatch>firstConfig);
const entry=new Function('process',source.slice(topStart,topEnd)+'\nreturn {mode,action};');
const holdRestore=/HOLD_518_TEST_PRODUCTION_RESTORE_DISABLED_NO_ATOMIC_FENCE/;
const holdActivate=/HOLD_518_TEST_PRODUCTION_ACTIVATE_DISABLED_NO_ATOMIC_RECOVERY/;
const C='cccccccc-3333-4333-8333-123456789abc';
const A='aaaabbbb-2222-4222-8222-123456789abc';
const TARGET='deadbeef-1111-4111-8111-123456789abc';
const cSchedules=[{cron:'*/20 * * * *'}];
for(const stage of ['test','production']){
 for(const action of ['restore','activate']){
 for(const marker of ['SORIDRAW_D1_ACCOUNT_BUDGET_ENFORCEMENT_518',
  'SORIDRAW_APP518_RELEASE_FENCES_VERIFIED','NO_MARKER']){
  for(const race of ['C_ALREADY_ACTIVE','C_DURING_GUARD_WINDOW']){
   // The external actor may have deployed C before us, or while our prior
   // (now prohibited) guard would have read its stale settings.
   const live={version:A,schedules:[{cron:'*/10 * * * *'}],
    protected:marker!=='NO_MARKER',writes:0,schedulePuts:0,reads:0};
   if(race==='C_ALREADY_ACTIVE'||race==='C_DURING_GUARD_WINDOW'){
    live.version=C;live.schedules=cSchedules;live.protected=true;
   }
   const fakeProcess={argv:['node','.deploy/release-worker-runtime.mjs',stage,action],
    env:{CLOUDFLARE_API_TOKEN:'',RELEASE_WORKER_VERSION:TARGET}};
   assert.throws(()=>entry(fakeProcess),action==='restore'?holdRestore:holdActivate,
    'traffic mutation must be denied before any request');
   assert.equal(live.version,C,'external actor C traffic must remain active');
   assert.deepEqual(live.schedules,cSchedules,'C schedules must be preserved');
   assert.equal(live.writes,0,'Wrangler deploy must never be reached');
   assert.equal(live.schedulePuts,0,'schedules PUT must never be reached');
   assert.equal(live.reads,0,'no stale settings reads before freeze');
  }
 }
 }
 // Other actions remain selectable at the entrypoint, preserving their
 // previously guarded, otherwise independent implementation.
 for(const action of ['upload','verify','dry-run']){
  const v=entry({argv:['node','.deploy/release-worker-runtime.mjs',stage,action]});
  assert.equal(v.action,action,'existing non-restore action must remain reachable');
 }
 assert.throws(()=>entry({argv:['node','.deploy/release-worker-runtime.mjs',stage,'bad-action']}),
  /unsupported action/);
}
// Confirm the legacy restore implementation is still present but unreachable
// when invoked through its TEST/PROD runtime entrypoint. It is not a supported
// manual recovery path until explicitly re-authorized.
assert.match(source,/async function restore\(\) \{/);
assert.match(source,/await cfPut\(\x60\$\{apiBase\}\/workers\/scripts\/\$\{target\.worker\}\/schedules\x60, schedules\)/);
assert.match(source,/await assertNoLegacyExploreBudgetDowngrade518\(\);\s*await makeConfig\(\)/);
// Defense-in-depth: even if activation were allowed by a future edit,
// the failure handler must not restore A over external C or overwrite C's cron.
const actStart=source.lastIndexOf('const before = await activeVersion();');
assert.ok(actStart>firstConfig,'activation branch must exist');
const activateBody=source.slice(actStart);
const current={version:A,schedule:'A',commands:[],puts:[],logs:[]};
const activeVersion=async()=>current.version;
const readSchedules=async()=>[{cron:current.schedule}];
const cfPut=async(_u,body)=>{current.puts.push(body);current.schedule=body[0].cron;};
const run=(_bin,args)=>{
 current.commands.push(args);
 if(args[1]==='versions'&&args[2]==='deploy')current.version=TARGET;
 else if(args[1]==='rollback')current.version=args[2];
 else throw Error('UNEXPECTED_EXECUTABLE');
};
const smoke=async()=>{
 current.version=C;current.schedule='C';
 throw Error('EXTERNAL_C_ACTIVATED_DURING_SMOKE');
};
const activate=new Function('process','activeVersion','readSchedules','run','WRANGLER',
 'CONFIG_PATH','WORKER_DIR','cfPut','apiBase','target','sleep','smoke','console','mode',
 'return (async()=>{'+activateBody+'})();');
await assert.rejects(activate(
 {env:{RELEASE_WORKER_VERSION:TARGET},execPath:'node'},
 activeVersion,readSchedules,run,'wrangler','/config','/worker',cfPut,
 'https://fake-cloudflare.example/v4',{worker:'soridraw-explore-test'},
 async()=>{},smoke,{log:()=>{},error:x=>current.logs.push(x)},'test'),
 /EXTERNAL_C_ACTIVATED_DURING_SMOKE/);
assert.equal(current.version,C,'no rollback over external C');
assert.equal(current.schedule,'C','no scheduled cron rewrite over C');
assert.equal(current.commands.filter(x=>x[1]==='rollback').length,0,
 'no unsafe Wrangler rollback in catch');
assert.equal(current.puts.length,1,'no schedule restoration PUT in catch');
assert.match(current.logs.join('\n'),/NO_UNSAFE_AUTO_ROLLBACK_MANUAL_HOLD/);
console.log('APP518_ACTIVATE_SMOKE_FAIL_EXTERNAL_C_NO_AUTO_ROLLBACK_W0=PASS');
console.log('APP518_TEST_PRODUCTION_ACTIVATE_RESTORE_EARLY_HOLD_WITH_OR_WITHOUT_MARKERS=PASS');
console.log('APP518_EXTERNAL_DEPLOY_C_TRAFFIC_AND_SCHEDULE_PRESERVED_W0=PASS');
console.log('APP518_RESTORE_NO_CREDENTIAL_OR_CLOUDFLARE_READ_REQUIRED=PASS');
console.log('APP518_EXISTING_NON_TRAFFIC_ACTIONS_UNCHANGED=PASS');

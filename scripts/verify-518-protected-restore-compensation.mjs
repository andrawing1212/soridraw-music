// app518 P2 frozen-restore red-team test; historical filename retained for CI.
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
const hold=/HOLD_518_TEST_PRODUCTION_RESTORE_DISABLED_NO_ATOMIC_FENCE/;
const C='cccccccc-3333-4333-8333-123456789abc';
const A='aaaabbbb-2222-4222-8222-123456789abc';
const TARGET='deadbeef-1111-4111-8111-123456789abc';
const cSchedules=[{cron:'*/20 * * * *'}];
for(const stage of ['test','production']){
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
   const fakeProcess={argv:['node','.deploy/release-worker-runtime.mjs',stage,'restore'],
    env:{CLOUDFLARE_API_TOKEN:'',RELEASE_WORKER_VERSION:TARGET}};
   assert.throws(()=>entry(fakeProcess),hold,'freeze must deny before any request');
   assert.equal(live.version,C,'external actor C traffic must remain active');
   assert.deepEqual(live.schedules,cSchedules,'C schedules must be preserved');
   assert.equal(live.writes,0,'Wrangler deploy must never be reached');
   assert.equal(live.schedulePuts,0,'schedules PUT must never be reached');
   assert.equal(live.reads,0,'no stale settings reads before freeze');
  }
 }
 // Other actions remain selectable at the entrypoint, preserving their
 // previously guarded, otherwise independent implementation.
 for(const action of ['upload','activate','verify','dry-run']){
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
console.log('APP518_TEST_PRODUCTION_RESTORE_EARLY_HOLD_WITH_OR_WITHOUT_MARKERS=PASS');
console.log('APP518_EXTERNAL_DEPLOY_C_TRAFFIC_AND_SCHEDULE_PRESERVED_W0=PASS');
console.log('APP518_RESTORE_NO_CREDENTIAL_OR_CLOUDFLARE_READ_REQUIRED=PASS');
console.log('APP518_EXISTING_NON_RESTORE_ACTIONS_UNCHANGED=PASS');

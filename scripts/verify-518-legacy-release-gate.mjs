// app518 old Explore release gate. This tests the REAL guard source only.
// No Cloudflare writes, deploys, secrets, user data or network.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const source=readFileSync('.deploy/release-worker-runtime.mjs','utf8');
const start=source.indexOf('async function assertNoLegacyExploreBudgetDowngrade518()');
const end=source.indexOf('\nawait assertNoLegacyExploreBudgetDowngrade518();',start);
assert.ok(start>0&&end>start,'guard must run before any deployment command');
assert.ok(end<source.indexOf('\nawait makeConfig();',end),'guard must precede local config build');
assert.ok(end<source.indexOf("if (action === 'restore') {",end),
 'guard must precede restore action dispatch');
const fixture=source.slice(start,end)+'\nreturn assertNoLegacyExploreBudgetDowngrade518;';
const expected=['soridraw-explore-api','soridraw-explore-test','soridraw-explore-preview'];
const markers=['SORIDRAW_D1_ACCOUNT_BUDGET_ENFORCEMENT_518',
 'SORIDRAW_APP518_RELEASE_FENCES_VERIFIED'];
const prepare=({action='upload',flags={},deny=null}={})=>{
 const calls=[],commands=[];
 const cfGet=async url=>{
  calls.push(url);
  const name=url.split('/').at(-2);
  if(deny===name)throw Error('HTTP_403');
  return {bindings:[{name:'DB',type:'d1',database_id:'shared'},...(flags[name]||[])]};
 };
 const run=(...args)=>{commands.push(args);throw Error('NO_MUTATION_ALLOWED');};
 const fn=new Function('cfGet','apiBase','action','run',fixture)(
  cfGet,'https://api.cloudflare.com/client/v4/accounts/account',action,run);
 return {fn,calls,commands};
};
for(const action of ['upload']){
 const normal=prepare({action});
 await normal.fn();
 assert.deepEqual(normal.calls.map(url=>url.split('/').at(-2)),expected);
 assert.equal(normal.commands.length,0,'old unprotected release remains unchanged');
 for(const name of expected)for(const marker of markers){
  const protectedEnv=prepare({action,
   flags:{[name]:[{name:marker,type:'plain_text',text:'ENFORCE'}]}});
  const error=action==='restore'
   ?/HOLD_518_PROTECTED_RESTORE_ATOMIC_DEPLOY_FENCE_UNVERIFIED/
   :/HOLD_518_LEGACY_EXPLORE_ROLLBACK_REOPENS_D1_BYPASS/;
  await assert.rejects(protectedEnv.fn(),error);
  assert.equal(protectedEnv.commands.length,0,'no CLI action before guard denial');
 }
}
for(const action of ['verify','dry-run']){
 const normal=prepare({action});
 await normal.fn();
 assert.equal(normal.calls.length,0);
 assert.equal(normal.commands.length,0);
}
for(const action of ['upload','activate','restore']){
 const failed=prepare({action,deny:'soridraw-explore-test'});
 await assert.rejects(failed.fn(),/HTTP_403/);
 assert.equal(failed.commands.length,0,'read-denied must fail closed');
}
// The actual entrypoint must refuse both traffic mutation actions before
// token checks, GET/PUT, Wrangler or schedules updates in TEST/PRODUCTION.
const holdRestore='HOLD_518_TEST_PRODUCTION_RESTORE_DISABLED_NO_ATOMIC_FENCE';
const holdActivate='HOLD_518_TEST_PRODUCTION_ACTIVATE_DISABLED_NO_ATOMIC_RECOVERY';
const entryGuard=source.indexOf("if (action === 'restore' || action === 'activate') {");
const credentialGate=source.indexOf("if (!TOKEN) throw new Error");
const firstRemoteCall=source.indexOf("async function cfGet(url)");
assert.ok(entryGuard>0&&entryGuard<credentialGate&&entryGuard<firstRemoteCall,
 'restore freeze must run BEFORE token and remote reads');
for(const stage of ['test','production'])for(const action of ['restore','activate']){
 const result=spawnSync(process.execPath,
  ['.deploy/release-worker-runtime.mjs',stage,action],
  {encoding:'utf8',env:{...process.env,CLOUDFLARE_API_TOKEN:''}});
 assert.notEqual(result.status,0,action+' entrypoint must exit nonzero');
 assert.match(result.stderr, new RegExp(action==='restore'?holdRestore:holdActivate));
 assert.doesNotMatch(result.stderr,/CLOUDFLARE_API_TOKEN is required/,
  'early freeze is not dependent on credential validity');
}
assert.doesNotMatch(source,/\[WRANGLER, 'rollback', before/,
 'unsafe activate fallback must not be reachable through source');
console.log('APP518_ALL_TEST_PRODUCTION_ACTIVATE_RESTORE_DENIED_PRE_READ_W0=PASS');
assert.match(source,/await assertNoLegacyExploreBudgetDowngrade518\(\);\s*await makeConfig\(\)/);
assert.doesNotMatch(source,/APP518_PROTECTED_RESTORE_COMPENSATED_ORIGINAL_VERIFIED/);
console.log('APP518_PROTECTED_RESTORE_BLOCKS_BEFORE_WRANGLER_AND_SCHEDULES=PASS');
console.log('APP518_UNPROTECTED_UPLOAD_ACTIVATE_UNCHANGED_RESTORE_TEMPORARILY_BLOCKED=PASS');
console.log('APP518_PROTECTED_UPLOAD_ACTIVATE_DOWNGRADE_AND_READ_DENY_HOLD=PASS');

// app518 isolated execution of the REAL protected restore() source.
// No network, GitHub mutation, Cloudflare deployment or user data.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('.deploy/release-worker-runtime.mjs','utf8');
const start=source.indexOf('async function restore() {');
const end=source.indexOf('\n// app518: a legacy Explore',start);
assert.ok(start>0&&end>start);
const code=source.slice(start,end)+'\nreturn restore;';
const ORIGINAL='aaaabbbb-2222-4222-8222-123456789abc';
const TARGET='deadbeef-1111-4111-8111-123456789abc';
const originalSchedule=[{cron:'*/10 * * * *'}];
const targetSchedule=[{cron:'*/5 * * * *'}];
const setup=({guarded=true,failedPost=false,failedCompensation=false,
 failedRollbackDeploy=false,concurrent=false,originalDrift=false}={})=>{
 let active=originalDrift?'cccccccc-1111-4111-8111-123456789abc':ORIGINAL;
 let schedule=[...originalSchedule];
 const commands=[],checks=[];
 const run=(binary,args)=>{
  commands.push({binary,args});
  if(args[0]==='scripts/verify-518-account-release-preflight.mjs'){
   checks.push(args[1]);
   if(args[1]==='--post-restore'&&failedPost)throw Error('FAIL_518_CODE_AND_BINDINGS');
   if(args[1]==='--post-compensate'&&failedCompensation)
    throw Error('FAIL_518_ORIGINAL_CODE_OR_BINDINGS');
   return 'READONLY_AUDIT_OK';
  }
  if(args[0]==='versions'&&args[1]==='deploy'){
   const version=args[2].split('@')[0];
   if(version===ORIGINAL&&failedRollbackDeploy)throw Error('CLOUDFLARE_DEPLOY_DENIED');
   active=concurrent&&version===TARGET?'bbbbbbbb-2222-4222-8222-123456789abc':version;
   return 'DEPLOY_RESPONSE_OK';
  }
  throw Error('UNEXPECTED_COMMAND');
 };
 const cfPut=async(url,body)=>{schedule=body;};
 const live=async()=>active;
 const schedules=async()=>schedule;
 const processFake={env:{
  RELEASE_WORKER_VERSION:TARGET,
  RELEASE_WORKER_SCHEDULES_JSON:JSON.stringify(targetSchedule),
 },execPath:'node'};
 const deps=[processFake,guarded,ORIGINAL,run,'wrangler','/cloudflare','/root',
  cfPut,'https://fake-cloudflare.example/v4','test',{worker:'soridraw-explore-test'},
  async()=>{},live,schedules,{error:()=>{},log:()=>{}}];
 const names=['process','protectedRestorePreflight518','protectedOriginalVersion518',
  'run','WRANGLER','CONFIG_PATH','WORKER_DIR','ROOT','cfPut','apiBase','mode','target',
  'sleep','activeVersion','readSchedules','console'];
 const fn=new Function(...names,code)(...deps);
 return {fn,commands,checks,active:()=>active,schedules:()=>schedule};
};
const normal=setup({failedPost:false});
await normal.fn();
assert.equal(normal.active(),TARGET);
assert.deepEqual(normal.checks,['--post-restore']);
assert.equal(normal.commands.filter(x=>x.args[0]==='versions').length,1);
for(const mode of [{failedPost:true},{failedPost:true,failedCompensation:true},
 {failedPost:true,failedRollbackDeploy:true}]){
 const test=setup(mode);
 await assert.rejects(test.fn(),/HOLD_518_/);
 assert.deepEqual(test.checks.includes('--post-restore'),true);
 if(!mode.failedRollbackDeploy)
  assert.equal(test.active(),ORIGINAL,'postcheck mismatch must revert 100% traffic');
 assert.deepEqual(test.schedules(),originalSchedule,'restore old schedules');
 if(!mode.failedCompensation&&!mode.failedRollbackDeploy)
  assert.deepEqual(test.checks,['--post-restore','--post-compensate']);
 if(mode.failedRollbackDeploy)
  assert.equal(test.active(),TARGET,'unrecoverable Cloudflare failure explicitly HOLD');
}
const race=setup({failedPost:true,concurrent:true});
await assert.rejects(race.fn(),/HOLD_518_COMPENSATION_UNVERIFIED_MANUAL_RELEASE_HOLD/);
assert.equal(race.commands.filter(x=>x.args[2]?.startsWith(ORIGINAL)).length,0,
 'unknown concurrent deployment must not be overwritten');
const drift=setup({originalDrift:true});
await assert.rejects(drift.fn(),/HOLD_518_PROTECTED_ORIGINAL_VERSION_CHANGED/);
assert.equal(drift.commands.length,0,'preflight-to-mutation version drift W0');
const unguarded=setup({guarded:false,failedPost:true});
await unguarded.fn();assert.deepEqual(unguarded.checks,[],
 'legacy unprotected restore stays unchanged');
console.log('APP518_PROTECTED_RESTORE_POSTCHECK_FAILURE_REVERTS_100_PERCENT_TRAFFIC=PASS');
console.log('APP518_COMPENSATION_RESTORES_SCHEDULES_AND_AUDITS_ORIGINAL=PASS');
console.log('APP518_COMPENSATION_FAILURE_AND_CONCURRENT_ROLLOUT_MANUAL_HOLD=PASS');
console.log('APP518_ORIGINAL_VERSION_DRIFT_PREMUTATION_BLOCK=PASS');

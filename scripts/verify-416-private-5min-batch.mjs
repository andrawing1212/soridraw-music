// Stage416 focused scheduler: no account IO, no live database or timers.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
let source = stripTypeScriptTypes(
  readFileSync('src/services/exploreLikePrivateBatchPolicy416.ts', 'utf8'),
  {mode: 'strip'},
).replaceAll('export const ', 'const ');
source += '\nmodule.exports={PRIVATE_BATCH_MINUTES_416,DEFAULT_PRIVATE_BATCH_MINUTES_416,validPrivateBatchMinutes416,parsePrivateBatchWindow416,advancePrivateBatchWindow416,advancePrivateBatchWindowForRemoteClick416,privateBatchDeadline416};';
const module={exports:{}};
vm.runInNewContext(source,{module,Number,Array,Error},{timeout:1000});
const p=module.exports;
assert.deepEqual([...p.PRIVATE_BATCH_MINUTES_416],[1,3,5,10,20]);
assert.equal(p.DEFAULT_PRIVATE_BATCH_MINUTES_416,5);
for(const m of [1,3,5,10,20]){
  const start=1_000_000;
  const a=p.advancePrivateBatchWindow416(null,start,m);
  assert.equal(a.deadlineAt,start+m*60_000);
  const b=p.advancePrivateBatchWindow416(a,start+30_000,1);
  assert.equal(b.minutes,m,'new Master setting cannot change open window');
  assert.equal(b.deadlineAt,start+30_000+m*60_000,'last user click restarts trailing window');
  assert.equal(p.privateBatchDeadline416(b,b.lastClickAt),b.deadlineAt);
  const c=p.advancePrivateBatchWindow416(b,b.deadlineAt+1,1);
  assert.equal(c.minutes,1,'next window takes Master setting');
  assert.equal(p.privateBatchDeadline416(null,start),start+300_000);
}
for(const x of [0,2,6,21,'5'])assert.equal(p.validPrivateBatchMinutes416(x),false);
assert.equal(p.parsePrivateBatchWindow416({openedAt:1_000_000,lastClickAt:1_000_000,minutes:5,deadlineAt:2}),null);
assert.throws(()=>p.advancePrivateBatchWindow416(null,0,5));
const r=p.advancePrivateBatchWindow416(null,1_000_000,5);
const pending={version:7,at:1_020_000,status:'pending'};
const extended=p.advancePrivateBatchWindowForRemoteClick416(r,pending,1_021_000,1);
assert.equal(extended.minutes,5,'keep original duration');
assert.equal(extended.deadlineAt,1_321_000,'use conservative receive time');
const ahead=p.advancePrivateBatchWindowForRemoteClick416(r,{version:8,at:1_034_000,status:'pending'},1_030_000,5);
assert.equal(ahead.lastClickAt,1_034_000,'clock skew must not allow earlier flush');
assert.equal(p.advancePrivateBatchWindowForRemoteClick416(r,{version:9,at:1_090_000,status:'pending'},1_030_000,5),null);
assert.equal(p.advancePrivateBatchWindowForRemoteClick416(r,{version:10,at:1_020_000,status:'rejected'},1_020_000,5),null);
console.log('STAGE416_REMOTE_PENDING_CLOCK_AND_SETTLEMENT_GUARD=PASS');
const appVersion=Number(JSON.parse(readFileSync('public/app-version.json','utf8')).version);
const stage416ClientActive=appVersion>=400&&appVersion<408;
const service=readFileSync('src/services/exploreLikeService.ts','utf8');
if(stage416ClientActive) assert.match(service,/STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE = true/,'app400-407 must activate Stage416');
else assert.match(service,/STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE = false/,'app399 or app408 rollback keeps Stage416 off');
assert.match(service,/advancePrivateBatchWindow416\(/);
assert.match(service,/advancePrivateBatchWindowForRemoteClick416\(/);
assert.match(service,/privateBatchDeadline416\(/);
assert.match(service,/const EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 5_000/);
assert.match(service,/subscribeExploreLikeIntent416\(uid, \(trackId, liked416, observed416\) => \{[\s\S]*?if \(STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE && observed416.status === 'pending'\)/);
assert.match(service,/if \(STAGE416_PRIVATE_FIVE_MINUTE_ACTIVE && observed416.status === 'pending'\) \{[\s\S]*?schedulePendingFlush\(current416\)/,
  'same-account private signal extends an active user-wide pending window');
console.log('STAGE416_FUTURE_TWO_DEVICE_WINDOW_EXTENSION_SOURCE=PASS');
console.log('STAGE416_PRIVATE_BATCH_MASTER_OPTIONS_AND_FROZEN_WINDOW=PASS');
console.log(stage416ClientActive
  ? 'STAGE416_APP400_TO_407_PRIVATE_FIVE_MINUTE_ACTIVE=PASS'
  : appVersion>=408
    ? 'APP408_PRIVATE_FIVE_MINUTE_ROLLBACK_OFF=PASS'
    : 'STAGE416_CURRENT_APP399_BEHAVIOR_OFF=PASS');
// Server-only deterministic contract is a separate module, exercised by this CI entrypoint.
const { spawnSync } = await import('node:child_process');
const server416 = spawnSync(process.execPath, ['scripts/verify-416-private-window-gate.mjs'], { encoding: 'utf8' });
if (server416.status !== 0) throw new Error(server416.stderr || server416.stdout || '416 server clock test failed');
process.stdout.write(server416.stdout);


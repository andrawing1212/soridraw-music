// Server-owned Stage416 clock runtime contract. No Firebase/Cloudflare IO.
import assert from 'node:assert/strict';
import { registerServerPrivateClick416 as record, evaluateServerPrivateIntake416 as gate,
  PRIVATE_CLOCK_MINUTES_416 as supported } from '../cloudflare/explore-worker/runtime/private-window-gate-416.mjs';
assert.deepEqual([...supported],[1,3,5,10,20]);
const now=1_000_000;
for(const minutes of supported){
  const a=record(null,{version:1,serverReceivedAtMs:now,configuredMinutes:minutes});
  assert.equal(a.updated,true);
  assert.equal(a.clock.deadlineAtMs,now+minutes*60_000);
  assert.deepEqual(gate(a.clock,{observedVersion:1,serverNowMs:now+minutes*60_000}).allowed,true);
  const b=record(a.clock,{version:2,serverReceivedAtMs:now+30_000,configuredMinutes:1});
  assert.equal(b.clock.minutes,minutes,'do not change active Master window');
  assert.equal(b.clock.deadlineAtMs,now+30_000+minutes*60_000);
  assert.deepEqual(gate(b.clock,{observedVersion:1,serverNowMs:b.clock.deadlineAtMs}).reason,'STALE_DEVICE');
  assert.equal(gate(b.clock,{observedVersion:2,serverNowMs:b.clock.deadlineAtMs-1}).reason,'WAIT_UNTIL_DEADLINE');
  assert.equal(gate(b.clock,{observedVersion:2,serverNowMs:b.clock.deadlineAtMs}).allowed,true);
  const c=record(b.clock,{version:3,serverReceivedAtMs:b.clock.deadlineAtMs+1,configuredMinutes:1});
  assert.equal(c.clock.minutes,1,'next window may adopt new Master period');
}
const first=record(null,{version:39,serverReceivedAtMs:now,configuredMinutes:5});
const mobile=record(first.clock,{version:41,serverReceivedAtMs:now+60_000,configuredMinutes:5});
assert.equal(mobile.clock.version,41);
const stale=record(mobile.clock,{version:40,serverReceivedAtMs:now+120_000,configuredMinutes:5});
assert.equal(stale.updated,false);
assert.equal(stale.clock.deadlineAtMs,mobile.clock.deadlineAtMs,'out-of-order event cannot reopen clock');
assert.equal(record(mobile.clock,{version:41,serverReceivedAtMs:now+140_000,configuredMinutes:10}).updated,false,
  'repeated operation version must never extend timer or incur state write');
assert.equal(gate(mobile.clock,{observedVersion:40,serverNowMs:now+600_000}).allowed,false);
assert.equal(gate(mobile.clock,{observedVersion:42,serverNowMs:now+600_000}).reason,'UNKNOWN_VERSION');
assert.equal(gate(null,{observedVersion:41,serverNowMs:now+600_000}).reason,'NO_SERVER_CLOCK');
for(const minutes of [0,2,6,21,'5'])assert.throws(
  ()=>record(null,{version:1,serverReceivedAtMs:now,configuredMinutes:minutes}),/INVALID/);
assert.throws(()=>record(null,{version:1,serverReceivedAtMs:0,configuredMinutes:5}),/INVALID/);
assert.throws(()=>record({...mobile.clock,deadlineAtMs:0},{version:42,serverReceivedAtMs:now+1,configuredMinutes:5}),/CORRUPT/);
// A single newest monotonic UID version is O(1), independent of changed-track
// count, including 80 tracks; no track history must be scanned by this gate.
let clock=first.clock;
for(let version=40;version<120;version++){
  const next=record(clock,{version,serverReceivedAtMs:now+(version-39)*100,configuredMinutes:5});
  assert.equal(next.updated,true);clock=next.clock;
}
assert.equal(clock.version,119);
assert.equal(gate(clock,{observedVersion:119,serverNowMs:clock.deadlineAtMs}).allowed,true);
console.log('STAGE416_SERVER_UID_WINDOW_1_3_5_10_20=PASS');
console.log('STAGE416_SERVER_UID_STALE_REPLAY_MASTER_AND_CLOCK=PASS');
console.log('STAGE416_SERVER_INTAKE_SERIALIZATION_REQUIRED=UNWIRED');

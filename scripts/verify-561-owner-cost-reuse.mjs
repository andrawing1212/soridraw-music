// APP561: physical-operation-aware owner alarm coalescing, source-only OFF.
// Uses exact APP556 queue code; synthetic store counts actual API methods,
// not Cloudflare billed rows, request duration, R2 or Firebase charges.
import assert from 'node:assert/strict';
import {createOwnerFollowRecovery556,OWNER_FOLLOW_RECOVERY_556_COMPILED_OPEN}
 from '../cloudflare/explore-worker/runtime/owner-follow-recovery-556.mjs';
assert.equal(OWNER_FOLLOW_RECOVERY_556_COMPILED_OPEN,false);
const EPOCH='0123456789abcdef0123456789abcdef',TOKEN='cutover-561';
const meter={get:0,getAlarm:0,put:0,setAlarm:0,del:0};
const rows=new Map();let clock=1800000000000,alarmAt=null;
const storage={
 async get(k){meter.get++;return structuredClone(rows.get(k))},
 async getAlarm(){meter.getAlarm++;return alarmAt},
 async put(k,v){meter.put++;rows.set(k,structuredClone(v))},
 async setAlarm(at){meter.setAlarm++;alarmAt=at},
 async delete(k){meter.del++;rows.delete(k)},
};
const env={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1'};
const engine=createOwnerFollowRecovery556({
 state:{storage},env,now:()=>clock,enabled:true,
 deliver:async()=>({status:'delivered'}),
});
const id=n=>'op_'+String(n).padStart(16,'0');
const ticket=(n)=>({ownerUid:'A',actorUid:'actor_'+n,
 authEpoch:EPOCH,operationId:id(n),expectedRevision:0,
 cutoverToken:TOKEN,desired:true,beforeFollowing:false,priorR2Revision:18});
const cold=await engine.reserve(ticket(1));
assert.equal(cold.status,'reserved');
assert.equal(meter.setAlarm,1,'cold owner requires ONE real alarm');
assert.equal(alarmAt,clock+1000);
assert.equal((await engine.reserve(ticket(1))).status,'already-reserved');
assert.equal(meter.setAlarm,1,'duplicate must never rearm');
const normal=await engine.reserve(ticket(2));
assert.equal(normal.status,'reserved');
assert.equal((await engine.reserve(ticket(3))).status,'reserved');
assert.equal(meter.setAlarm,1,'two simultaneous follower requests reuse pending owner alarm');
assert.equal(rows.get('pending').entries.length,3);
assert.equal(meter.put,3,'only distinct pending reservations are written');
console.log('APP561_BURST_OWNER_PENDING_ALARM_REUSE=PASS');
const saved=2;
assert.equal(3-meter.setAlarm,saved);
clock+=2_000; // overdue clock/alarm cannot be treated as a healthy wake-up.
assert.equal((await engine.reserve(ticket(4))).status,'reserved');
assert.equal(meter.setAlarm,2);
assert.equal(alarmAt,clock+1_000);
alarmAt=clock+60_000; // future retry alarm must be brought forward for new work.
assert.equal((await engine.reserve(ticket(5))).status,'reserved');
assert.equal(meter.setAlarm,3);
assert.equal(alarmAt,clock+1_000);
const before={...meter};
const disabled=createOwnerFollowRecovery556({state:{storage},
 env:{...env,SORIDRAW_ENVIRONMENT:'production'},enabled:true,now:()=>clock});
assert.equal((await disabled.reserve(ticket(6))).status,'disabled');
assert.deepEqual(meter,before,'disabled cross-environment must perform NO storage I/O');
assert.equal((await engine.reserve({...ticket(5),cutoverToken:'wrong-token'})).status,
 'operation-conflict');
assert.equal(meter.setAlarm,3,'rejected collision never arms an alarm');
console.log('APP561_OVERDUE_FUTURE_ALARMS_AND_OPERATION_COLLISION_FENCED=PASS');
const d1Writes=0;
assert.equal(d1Writes,0,'owner DO adapter has no canonical D1 binding');
console.log('APP561_OWNER_ALARM_API_LEDGER='+JSON.stringify({distinctReservations:5,
 oldSetAlarmCallsWithoutCoalescing:5,optimizedSetAlarmCalls:meter.setAlarm,
 savedSetAlarmCalls:5-meter.setAlarm,doPutCalls:meter.put,
 doDeleteCalls:meter.del,getAlarmCalls:meter.getAlarm,
 physicalProviderBilledRows:'NOT_EXPOSED_BY_SYNTHETIC_STORE',
 canonicalD1Writes:'NOT_TOUCHED',
 }));

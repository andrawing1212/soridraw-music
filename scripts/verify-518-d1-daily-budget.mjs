import assert from 'node:assert/strict';
import {reserveD1WriteRows518,createD1BudgetGate518,
 D1_FREE_DAILY_ROWS_518,D1_MAX_RESERVED_ROWS_518,RESERVE_518}
 from '../cloudflare/media-worker/src/catalogD1DailyWriteBudget518.js';
assert.equal(D1_FREE_DAILY_ROWS_518,100000);
assert.equal(D1_MAX_RESERVED_ROWS_518,80000);
const calls=[];let used=0;
const db={prepare(sql){
 assert.equal(sql,RESERVE_518);
 return {bind(...args){
  calls.push(args);
  return {async run(){
   const [day,amount,now,amount2,cap,cap2]=args;
   assert.equal(day,'2026-10-30');
   assert.equal(amount,amount2);assert.equal(cap,cap2);
   assert.equal(now,1793354400000);
   if(used+amount>cap)return {success:true,meta:{changes:0}};
   used+=amount;return {success:true,meta:{changes:1}};
  }};
 }};
}};
const at=1793354400000;
for(const flags of [
 {},{allAccountWritersVerified:true},
 {sharedAccountLedgerVerified:true},
]){
 const result=await reserveD1WriteRows518({db,nowMs:at,
  requestedRows:1040,...flags});
 assert.equal(result.code,'HOLD_D1_GLOBAL_WRITERS_UNVERIFIED');
 assert.equal(result.d1Writes,0);
}
assert.equal(calls.length,0,'unknown legacy account writers cost W0');
const gate=createD1BudgetGate518({db,allAccountWritersVerified:true,
 sharedAccountLedgerVerified:true});
const accepted=await gate({nowMs:at,requestedRows:1040});
assert.equal(accepted.code,'RESERVED');
assert.equal(accepted.guaranteedRows,1040);
assert.equal(used,1041);
for(let k=0;k<75;k++)await gate({nowMs:at,requestedRows:1040});
assert.ok(used<=80000);
const hold=await gate({nowMs:at,requestedRows:1040});
assert.equal(hold.code,'HOLD_D1_DAILY_QUOTA');
assert.equal(hold.d1Writes,0);
const prior=used;assert.equal(used,prior);
const outage=createD1BudgetGate518({db:{prepare(){throw Error('db down');}},
 allAccountWritersVerified:true,sharedAccountLedgerVerified:true});
assert.equal((await outage({nowMs:at,requestedRows:1040})).code,
 'RETRYABLE_D1_BUDGET_IO');
console.log('APP518_D1_GLOBAL_ATTESTATION_DEFAULT_OFF_R0_W0=PASS');
console.log('APP518_D1_ATOMIC_SHARED_QUOTA_AND_FAIL_CLOSED=PASS');

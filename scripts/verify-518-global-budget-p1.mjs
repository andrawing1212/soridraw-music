import assert from 'node:assert/strict';
import {createD1BudgetGate518} from '../cloudflare/media-worker/src/catalogD1DailyWriteBudget518.js';
import {createMeteredD1Database518} from '../cloudflare/media-worker/src/catalogD1MeteredDatabase518.js';
import {deliverDueCanonicalFavorites518,permanentDeliveryHoldReason518}
 from '../cloudflare/media-worker/src/catalogDelivery518.js';
const t0=Date.UTC(2026,9,30,12),day=ms=>new Date(ms).toISOString().slice(0,10);
let time=t0,mutated=0,ledger=new Map(),pending={
 owner_uid:'owner',favorite_id:'song',source_version_ns:'001793152800000000001',
 desired_state:'saved',attempt_count:0,next_attempt_ms:0,hold_reason:null,ack_version_ns:null,
};
let r2Count=0,controlCount=0;
const raw={prepare(sql){
 return {bind(...args){
  return {
   async first(){return null;},
   async all(){
    if(sql.includes('FROM music_note_catalog_outbox_518'))
     return {results:pending.hold_reason===null&&pending.next_attempt_ms<=args[0]
      &&pending.ack_version_ns!==pending.source_version_ns?[{...pending}]:[]};
    return {results:[]};
   },
   async run(){
    if(sql.includes('INSERT INTO music_note_catalog_daily_budget_518')){
     const [d,amount,,_,cap]=args;
     const old=ledger.get(d)||0;
     if(old+amount>cap)return {success:true,meta:{changes:0}};
     ledger.set(d,old+amount);return {success:true,meta:{changes:1}};
    }
    if(sql.includes('APP518_DAILY_PAUSE_CONTROL_518')){
     assert.equal(args[0],Date.UTC(2026,9,31,0,1));
     pending.next_attempt_ms=args[0];controlCount++;mutated++;
     return {success:true,meta:{changes:1}};
    }
    if(sql.includes('SET ack_version_ns=source_version_ns')){
     pending.ack_version_ns=pending.source_version_ns;
     mutated++;return {success:true,meta:{changes:1}};
    }
    if(sql.includes('INSERT OR IGNORE INTO music_note_catalog_member_518')){
     mutated+=JSON.parse(args[2]).length;
     return {success:true,meta:{changes:JSON.parse(args[2]).length}};
    }
    mutated++;return {success:true,meta:{changes:1}};
   },
  };
 }};
 }};
const gate=createD1BudgetGate518({db:raw,allAccountWritersVerified:true,
 sharedAccountLedgerVerified:true});
const db=createMeteredD1Database518({rawDb:raw,reserveWriteBudget:gate,clock:()=>time});
const sql='INSERT OR IGNORE INTO music_note_catalog_member_518(owner_uid,generation,favorite_id) SELECT ?,?,value FROM json_each(?)';
let stopped=false,owner=0;
for(;owner<6;owner++){
 for(let batch=0;batch<40;batch++){
  const start=batch*500;
  const ids=Array.from({length:500},(_,i)=>'owner-'+owner+'-'+(start+i));
  try{
   await db.prepare(sql).bind('owner-'+owner,1,JSON.stringify(ids)).run();
  }catch(e){
   assert.equal(e.code,'HOLD_D1_DAILY_QUOTA');
   stopped=true;break;
  }
 }
 if(stopped)break;
}
assert.equal(stopped,true,'six 20k owners must not exceed shared account cap');
assert.ok(owner<6);
assert.ok(mutated<=80000&&ledger.get(day(time))<=80000);
const before=mutated;
const invalid=createD1BudgetGate518({db:raw});
const off=createMeteredD1Database518({rawDb:raw,reserveWriteBudget:invalid,clock:()=>time});
await assert.rejects(off.prepare(sql).bind('unknown',1,JSON.stringify(['x'])).run(),
 e=>e.code==='HOLD_D1_GLOBAL_WRITERS_UNVERIFIED');
assert.equal(mutated,before,'unattested legacy writer must write zero');
assert.equal(permanentDeliveryHoldReason518('RETRYABLE_INDEX_HOLD_D1_DAILY_QUOTA'),null);
// Outbox is NOT terminal when bulk quota is exhausted. The control-only
// reservation is below 90k and moves only this pending source to next UTC.
const first=await deliverDueCanonicalFavorites518({
 db,nowMs:time,maxItems:1,
 readExactCanonical:async()=>({verifiedByServer:true,uid:'owner',
  documentId:'song',state:'saved',updateTime:'2026-10-28T02:00:00.000000001Z'}),
 applyVersionedR2:async()=>({code:'RETRYABLE_INDEX_HOLD_D1_DAILY_QUOTA'}),
});
assert.equal(first.held,0);assert.equal(first.retry,1);
assert.equal(controlCount,1);assert.equal(pending.ack_version_ns,null);
const blocked=await deliverDueCanonicalFavorites518({
 db,nowMs:time+60000,maxItems:1,
 readExactCanonical:async()=>{throw Error('must not read before UTC next day');},
 applyVersionedR2:async()=>{throw Error('should not deliver');},
});
assert.equal(blocked.attempted,0);
time=Date.UTC(2026,9,31,0,2);
const next=await deliverDueCanonicalFavorites518({
 db,nowMs:time,maxItems:1,
 readExactCanonical:async()=>({verifiedByServer:true,uid:'owner',
  documentId:'song',state:'saved',updateTime:'2026-10-28T02:00:00.000000001Z'}),
 applyVersionedR2:async input=>{r2Count++;return {
  code:'APPLIED',versionVerified:true,ownerVerified:true,casVerified:true,
  sourceVersionNs:input.sourceVersionNs};},
});
assert.equal(next.acked,1);assert.equal(next.held,0);
assert.equal(r2Count,1);assert.equal(pending.ack_version_ns,pending.source_version_ns);
assert.ok((ledger.get(day(time))||0)>0,'new UTC day has fresh budget');
console.log('APP518_P1_SIX_20K_OWNERS_SHARED_D1_CAP=PASS');
console.log('APP518_P1_UNATTESTED_GLOBAL_WRITERS_WRITE_ZERO=PASS');
console.log('APP518_P1_DAILY_QUOTA_UTC_RETRY_NO_PERMANENT_HOLD=PASS');

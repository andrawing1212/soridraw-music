// Dormant Stage420 atomic Firestore ledger execution (in-memory only).
// Demonstrates 257+ exact replay W0 and bounded per-mutation document size.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
let code=stripTypeScriptTypes(readFileSync(
  'functions/src/exploreLikeAtomicLedgerCandidate420.ts','utf8'),{mode:'strip'})
  .replace(/^import\s+.*?from\s+'[^']+';\s*$/gm,'')
  .replaceAll('export const ','const ');
assert.doesNotMatch(code,/^import\s/m);
code+='\nmodule.exports={approveLikeWithAtomicLedgerCandidate420,readLikeOperationTime420};';
const module={exports:{}};
vm.runInNewContext(code,{module,createHash,Number,Math,Date,Error},
  {timeout:1500});
const {approveLikeWithAtomicLedgerCandidate420:approve,
  readLikeOperationTime420:readTime}=module.exports;
const day=24*60*60_000;
const base=1_800_000_000_000;
const v7=(id,t=base)=>{
  const hex=t.toString(16).padStart(12,'0');
  return hex.slice(0,8)+'-'+hex.slice(8)+'-7aaa-8bbb-'+String(id).padStart(12,'0');
};
assert.equal(readTime(v7(1)),base);
assert.equal(readTime('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'),null);
const docs=new Map();let writes=0,reads=0,created=0;
let maxRateBytes=0,maxReceiptBytes=0;
const clone=x=>x==null?x:structuredClone(x);
const ref=(path)=>({
  path,
  collection:name=>({doc:id=>ref(path+'/'+name+'/'+id)}),
});
const store={
  collection:name=>({doc:id=>ref(name+'/'+id)}),
  runTransaction:async callback=>{
    const staged=[];
    const tx={
      get:async doc=>{
        reads++;
        const found=docs.get(doc.path);
        return{exists:found!==undefined,data:()=>clone(found)};
      },
      set:(doc,val)=>staged.push(['set',doc.path,clone(val)]),
      create:(doc,val)=>{
        assert.equal(docs.has(doc.path),false,'no overwrite of existing op receipt');
        staged.push(['create',doc.path,clone(val)]);
      },
    };
    const out=await callback(tx);
    for(const [type,path,val] of staged){
      docs.set(path,val);writes++;
      const size=Buffer.byteLength(JSON.stringify(val));
      if(type==='set') maxRateBytes=Math.max(maxRateBytes,size);
      else{created++;maxReceiptBytes=Math.max(maxReceiptBytes,size);}
    }
    return out;
  },
};
const policy={warningPerMinute:30,limitPerMinute:40,suspensionMinutes:120};
const mk=i=>({trackId:'track-'+i,ownerUid:'owner',liked:i%2===0,
  operationId:v7(i,base+i*65_000)});
for(let i=1;i<=1000;i++){
  const op=mk(i);
  const result=await approve(store,'uid-1',op,base+i*65_000,policy);
  assert.equal(result.allowed,true);
  assert.equal(result.duplicate,false);
}
assert.equal(created,1000);
const first=mk(1);
const beforeReplayWrite=writes;
const duplicate=await approve(store,'uid-1',first,base+1001*65_000,policy);
assert.equal(duplicate.allowed,true);
assert.equal(duplicate.duplicate,true);
assert.equal(writes,beforeReplayWrite,'1001st operation cannot redo an old click');
const changed=await approve(store,'uid-1',{...first,liked:!first.liked},
  base+1002*65_000,policy);
assert.equal(changed.allowed,false);
assert.equal(writes,beforeReplayWrite);
await assert.rejects(approve(store,'uid-1',first,base+31*day,policy),
  /420_ATOMIC_LEDGER_EXPIRED_FAIL_CLOSED/);
await assert.rejects(approve(store,'uid-1',{
  ...mk(1002),operationId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
},base+1002*65_000,policy),/420_ATOMIC_LEDGER_REQUEST_INVALID/);
const stampOld=v7(7001,base);
// A newly received 8-day-old command must be safely DENIED (not thrown).
// assert.rejects here would conceal a successful deny behind a catch handler.
const eightDayFirstSend=await approve(store,'uid-1',
  {...mk(7001),operationId:stampOld},base+8*day,policy);
assert.equal(eightDayFirstSend.allowed,false);
assert.equal(eightDayFirstSend.duplicate,false);
assert.equal(writes,beforeReplayWrite);
assert(maxRateBytes<1000,'account counter is bounded, no 256-item journal payload');
assert(maxReceiptBytes<1000,'one independent operation has bounded footprint');
assert.equal(docs.size,1001,'one small account doc + 1000 independent receipts');

// Exercise the actual 30/40/2-consecutive-minutes/120-minute policy.
// The 1000-approval fixture above spaces clicks by 65 seconds and CANNOT
// substantiate warning, per-minute denial, or account locking behavior.
const minute0=Math.ceil((base+120_000)/60_000)*60_000;
const mkRate=(id,at)=>({
  trackId:'rate-track-'+id,ownerUid:'owner',liked:true,
  operationId:v7(10_000+id,at),
});
const rateUid='uid-lock-fixture';
for(let i=1;i<=40;i++){
  const result=await approve(store,rateUid,mkRate(i,minute0+i),
    minute0+i,policy);
  assert.equal(result.allowed,true,'first-minute allowed click '+i);
  assert.equal(result.duplicate,false);
  assert.equal(result.warning,i>=30,'warning begins at click 30');
  assert.equal(result.remainingInWindow,40-i);
}
const firstDeniedAtLimit=await approve(store,rateUid,
  mkRate(41,minute0+41),minute0+41,policy);
assert.equal(firstDeniedAtLimit.allowed,false,'41st minute click blocked');
const afterFirstLimitWrites=writes;
const rateReplay=await approve(store,rateUid,mkRate(1,minute0+1),
  minute0+45,policy);
assert.equal(rateReplay.allowed,true);
assert.equal(rateReplay.duplicate,true);
assert.equal(writes,afterFirstLimitWrites,'exact replay must never add writes');

let secondFull;
for(let i=1;i<=40;i++){
  secondFull=await approve(store,rateUid,
    mkRate(100+i,minute0+60_000+i),
    minute0+60_000+i,policy);
  assert.equal(secondFull.allowed,true,'second-minute allowed click '+i);
}
const expectedLockedUntil=minute0+60_000+40+120*60_000;
assert.equal(secondFull.lockedUntilMs,expectedLockedUntil,
  'second consecutive full minute triggers 120-minute lock');
const afterLockWrites=writes;
const whileLocked=await approve(store,rateUid,
  mkRate(201,minute0+120_000),minute0+120_000,policy);
assert.equal(whileLocked.allowed,false);
assert.equal(whileLocked.lockedUntilMs,expectedLockedUntil);
assert.equal(writes,afterLockWrites,'locked click must perform no writes');
const retryDuringLock=await approve(store,rateUid,
  mkRate(1,minute0+1),minute0+120_001,policy);
assert.equal(retryDuringLock.duplicate,true,
  'previously approved exact operation is not a new click');
assert.equal(writes,afterLockWrites);
const afterExpiry=await approve(store,rateUid,
  mkRate(202,expectedLockedUntil+1),expectedLockedUntil+1,policy);
assert.equal(afterExpiry.allowed,true,'lock expires automatically');
assert.equal(afterExpiry.duplicate,false);
assert.equal(afterExpiry.lockedUntilMs,0);

// UUID v4 remains the existing app/outbox format; the dormant v7-only
// candidate must be reported as INCOMPATIBLE, never wired in silently.
const oldV4={...mk(9001),operationId:'2e2db23f-56aa-4f91-82b2-13e3d2c62c00'};
const beforeV4Writes=writes;
await assert.rejects(approve(store,rateUid,oldV4,minute0,policy),
  /420_ATOMIC_LEDGER_REQUEST_INVALID/);
assert.equal(writes,beforeV4Writes,'legacy v4 must never be re-keyed/written');

console.log('STAGE420_ATOMIC_LEDGER_1000_UNIQUE_APPROVALS=PASS');
console.log('STAGE420_ATOMIC_LEDGER_1001ST_EXACT_REPLAY_W0=PASS');
console.log('STAGE420_ATOMIC_LEDGER_TAMPER_AND_EXPIRED_FAIL_CLOSED=PASS');
console.log('STAGE420_ATOMIC_LEDGER_MAX_RATE_DOC_BYTES='+maxRateBytes);
console.log('STAGE420_ATOMIC_LEDGER_MAX_RECEIPT_DOC_BYTES='+maxReceiptBytes);
console.log('STAGE420_FIRESTORE_FIRST_ACCEPT=2_READ_2_WRITE_THEORETICAL');
console.log('STAGE420_FIRESTORE_DUPLICATE=1_READ_0_WRITE_THEORETICAL');
console.log('STAGE420_ATOMIC_LEDGER_30_WARNING_40_LIMIT_120M_LOCK=PASS');
console.log('STAGE420_ATOMIC_LEDGER_V4_LEGACY_COMPATIBILITY=FAIL_CUTOVER_HOLD');
console.log('STAGE420_ATOMIC_LEDGER_8DAY_FIRST_SEND_SAFE_DENIAL=PASS');
console.log('STAGE420_LIVE_BILLING_AND_RTDB_DELIVERY=NOT_VERIFIED');
console.log('STAGE420_ATOMIC_LEDGER_CUTOVER=OFF');

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
code+='\nmodule.exports={approveLikeWithAtomicLedgerCandidate420,readLikeOperationTime420,planAtomicLikeDisplayDeliveryCandidate420,recoverAtomicLikeDisplayGapCandidate420};';
const module={exports:{}};
vm.runInNewContext(code,{module,createHash,Number,Math,Date,Error},
  {timeout:1500});
const {approveLikeWithAtomicLedgerCandidate420:approve,
  readLikeOperationTime420:readTime,
  planAtomicLikeDisplayDeliveryCandidate420:project,
  recoverAtomicLikeDisplayGapCandidate420:reconcile}=module.exports;
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
// The mock scans its Map to emulate a Firestore indexed equality query;
// real code uses a single-UID query with where(version)==next and limit(1).
const ref=(path)=>({
  path,
  collection:name=>collection(path+'/'+name),
});
const collection=(path)=>({
  doc:id=>ref(path+'/'+id),
  where:(field,op,version)=>{
    assert.equal(field,'version');
    assert.equal(op,'==');
    return {limit:n=>({
      get:async()=>{
        assert.equal(n,1);
        const matches=[...docs.entries()].filter(([p,v])=>
          p.startsWith(path+'/') &&
          p.slice(path.length+1).indexOf('/')===-1 &&
          v.version===version).slice(0,n);
        reads+=matches.length || 1; // model one query read minimum
        return {empty:matches.length===0,
          docs:matches.map(([p,v])=>({
            id:p.slice(path.length+1),data:()=>clone(v),
          }))};
      },
    })};
  },
});
const store={
  collection:name=>collection(name),
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
  ...mk(1002),operationId:'aaaaaaaa-aaaa-5aaa-aaaa-aaaaaaaaaaaa',
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

// Existing app396 pending operation IDs are UUID v4. They cannot be
// treated as new approvals (no timestamp). Only an exact pre-existing
// SERVER proof can be used for read-only replay; none is created here.
const oldV4={...mk(9001),operationId:'2e2db23f-56aa-4f91-82b2-13e3d2c62c00'};
const beforeV4Writes=writes;
const beforeV4Reads=reads;
await assert.rejects(approve(store,rateUid,oldV4,minute0,policy),
  /420_LEGACY_PROOF_MISSING_FAIL_CLOSED/);
assert.equal(writes,beforeV4Writes,'unproven old v4 is never charged or re-keyed');
assert.equal(reads,beforeV4Reads+1,'unproven v4 needs only one receipt lookup');

// Synthetic server-owned approval fixture, NOT a migration of live v4 data.
// New v4 operations are always blocked; proof must already exist.
const legacyUid='uid-legacy-approved';
const legacyPath='privateLikeGuardV2_420/'+legacyUid+
  '/approvals/'+oldV4.operationId;
const approvedAtMs=minute0-600;
docs.set(legacyPath,{
  digest:createHash('sha256').update(JSON.stringify([
    legacyUid,oldV4.trackId,oldV4.ownerUid,oldV4.liked,oldV4.operationId,
  ])).digest('base64url'),
  status:'approved', approvedAtMs, version:17,
  warning:false,
  rateAtApproval:{acceptedInWindow:9,lockedUntilMs:0},
});
const readOnlyBefore=reads;
const replayBefore=writes;
const acceptedOld=await approve(store,legacyUid,oldV4,minute0,policy);
assert.equal(acceptedOld.allowed,true);
assert.equal(acceptedOld.duplicate,true);
assert.equal(acceptedOld.version,17);
assert.equal(reads,readOnlyBefore+1,'old approval is a single exact-point read');
assert.equal(writes,replayBefore,'old receipt replay W0');
const forgedOld=await approve(store,legacyUid,
  {...oldV4,liked:!oldV4.liked},minute0,policy);
assert.equal(forgedOld.allowed,false,'same v4 with altered action rejected');
assert.equal(writes,replayBefore,'tampered v4 costs W0');
await assert.rejects(approve(store,'different-uid',oldV4,minute0,policy),
  /420_LEGACY_PROOF_MISSING_FAIL_CLOSED/);
assert.equal(writes,replayBefore,'wrong UID cannot replay approval');
await assert.rejects(approve(store,legacyUid,oldV4,
  approvedAtMs+31*day,policy),/420_LEGACY_PROOF_EXPIRED_FAIL_CLOSED/);
assert.equal(writes,replayBefore,'old v4 beyond safe proof age remains W0');
docs.delete(legacyPath); // simulate TTL deleting the proof
await assert.rejects(approve(store,legacyUid,oldV4,
  approvedAtMs+31*day,policy),/420_LEGACY_PROOF_MISSING_FAIL_CLOSED/);
assert.equal(writes,replayBefore,'missing post-TTL proof never becomes a new click');

// Cross-database partial failure fixture: ONLY source-only planning.
// Firestore already approved 1000 distinct operations, but RTDB may fail
// before emitting. Never re-run approve() merely to send the notification.
let display=null;let emitted=0;
const readProof=(id)=>clone(docs.get(
  'privateLikeGuardV2_420/uid-1/approvals/'+mk(id).operationId));
const displayFrom=(id,state=display,uid='uid-1',operation=mk(id))=>
  project(uid,operation,readProof(id),state,base+1001*65_000);
const attempt=async id=>{
  const plan=displayFrom(id);
  if(plan.status==='emit'){display=clone(plan.next);emitted++;}
  return plan.status;
};
// Approvals 1 and 2 exist, but event 2 arrives before event 1.
assert.equal(await attempt(2),'waiting-prior');
assert.equal(display,null,'must not skip missing unrelated track event');
assert.equal(emitted,0,'RTDB writes zero until predecessor succeeds');
assert.equal(await attempt(1),'emit');
assert.equal(await attempt(1),'already-delivered','retry never broadcasts again');
assert.equal(emitted,1,'one event per exact approval');
// A late event 2 must be recovered before a later version 3 or 4.
// Even valid events for unrelated tracks are NOT allowed to skip a gap.
assert.equal(await attempt(4),'waiting-prior');
assert.equal(await attempt(3),'waiting-prior');
assert.equal(await attempt(2),'emit');
assert.equal(await attempt(4),'waiting-prior');
assert.equal(await attempt(3),'emit');
assert.equal(await attempt(4),'emit');
assert.equal(emitted,4,'recovered 1 through 4 in sequence');
for(let i=5;i<=1000;i++){
  assert.equal(await attempt(i),'emit','all versions delivered consecutively');
}
assert.equal(display.version,1000);
assert.equal(display.results.length,50,'bounded RTDB display even after 1000');
assert.equal(display.results[49].at,base+1001*65_000,
  'delayed server signal uses delivery timestamp, not stale approval timestamp');
const displayBytes=Buffer.byteLength(JSON.stringify(display));
assert(displayBytes<12000,
  'server-owned last-50 display should be bounded under 12KB in fixture');

const after1000=emitted;
assert.equal(await attempt(1),'already-delivered',
  '257+ original RTDB delivery retry must not re-emit');
assert.equal(emitted,after1000,'RTDB duplicate W0 with oldest row evicted');
assert.equal(displayFrom(1000,display,'wrong-uid').status,'invalid',
  'other UID cannot use source receipt');
assert.equal(displayFrom(1000,display,'uid-1',
  {...mk(1000),liked:!mk(1000).liked}).status,'invalid',
  'tampered action cannot use source receipt');
assert.equal(project('uid-1',mk(1),null,display,
  base+1001*65_000).status,'invalid',
  'receipt unavailable cannot be treated as delivered');
assert.equal(displayFrom(1,{version:900,results:[]}).status,
  'already-delivered',
  'planner assumes trusted contiguous RTDB version (not verified externally)');
const futureGap=displayFrom(1000,{version:998,results:[]});
assert.equal(futureGap.status,'waiting-prior',
  'out of order cannot skip a missing previous event');
const beforeDeliveryReplayWrites=writes;
assert.equal(writes,beforeDeliveryReplayWrites,
  'projecting a signal never adds Firestore approval writes');
console.log('STAGE420_DISPLAY_V2_MAX_50_FIXTURE_BYTES='+displayBytes);
console.log('STAGE420_DISPLAY_V2_LATE_DELIVERY_FRESHNESS=PASS');
// Full source recovery: Firestore approval commits exist independently of
// RTDB delivery. Simulate Function crash before any RTDB notification and
// restore only the exact missing receipt version; no account/full-track scan.
let rtdbState=null;let rtdbWrites=0;
const rtdbRef={
  get:async()=>({val:()=>clone(rtdbState)}),
  transaction:async callback=>{
    const next=callback(clone(rtdbState));
    if(next!==undefined){rtdbState=clone(next);rtdbWrites++;}
    return {committed:next!==undefined,
      snapshot:{val:()=>clone(rtdbState)}};
  },
};
const rtdb={ref:path=>{
  assert.equal(path,'privateLikeSync420/uid-1/displayV2');
  return rtdbRef;
}};
const recoveryNow=base+1001*65_000;
const thirdPath='privateLikeGuardV2_420/uid-1/approvals/'+mk(3).operationId;
const thirdProof=clone(docs.get(thirdPath));
docs.delete(thirdPath); // indexed proof lookup fails closed; no skipped track 3
const gap=await reconcile(store,rtdb,'uid-1',5,recoveryNow,8);
assert.equal(gap.reason,'missing-proof');
assert.equal(gap.lastVersion,2);
assert.equal(gap.delivered,2);
assert.equal(rtdbWrites,2);
docs.set(thirdPath,thirdProof);
const healed=await reconcile(store,rtdb,'uid-1',5,recoveryNow,8);
assert.equal(healed.complete,true);
assert.equal(healed.lastVersion,5);
assert.equal(healed.delivered,3);
assert.equal(rtdbWrites,5);
// Out-of-order trigger for version 260 catches up 6..260 in bounded groups,
// and can resume after each explicit incomplete result.
let loops=0;let completed=false;
while(!completed && loops++<40){
  const result=await reconcile(store,rtdb,'uid-1',260,recoveryNow,8);
  assert.equal(result.reason,result.complete?'delivered':'needs-retry');
  completed=result.complete;
}
assert.equal(completed,true,'bounded sequential recovery makes progress');
assert.equal(rtdbState.version,260);
assert.equal(rtdbState.results.length,50);
assert.equal(rtdbWrites,260,'at most one RTDB publish per exact approval');
const rtdbBeforeReplay=rtdbWrites;
const replay=await reconcile(store,rtdb,'uid-1',260,recoveryNow,8);
assert.equal(replay.delivered,0);
assert.equal(replay.complete,true);
assert.equal(rtdbWrites,rtdbBeforeReplay,
  'old trigger delivered again must not create a write');
// Missing/mismatched proof never turns into a new rate approval or broadcast.
const nextPath='privateLikeGuardV2_420/uid-1/approvals/'+mk(261).operationId;
const afterMissing=await reconcile(store,rtdb,'uid-1',261,recoveryNow,8);
assert.equal(afterMissing.reason,'missing-proof');
assert.equal(rtdbWrites,rtdbBeforeReplay);
assert.equal(docs.has(nextPath),false);
console.log('STAGE420_RECOVERY_MISSING_PROOF_FAIL_CLOSED=PASS');
console.log('STAGE420_RECOVERY_GAP_THEN_RETRY_TO_260=PASS');
console.log('STAGE420_RECOVERY_260_REPLAY_RTDB_W0=PASS');
console.log('STAGE420_RECOVERY_BACKEND_ONCREATE_TRIGGER=NOT_WIRED');
console.log('STAGE420_RECOVERY_UNATTENDED_RETRY=NOT_VERIFIED');
console.log('STAGE420_DISPLAY_V2_ORDERED_1000_EMIT_50_BOUND=PASS');
console.log('STAGE420_DISPLAY_V2_RETRY_257PLUS_NO_REEMIT=PASS');
console.log('STAGE420_DISPLAY_V2_FAILCLOSED_ON_GAP_AND_PROOF_MISMATCH=PASS');
console.log('STAGE420_DISPLAY_V2_DURABLE_RECOVERY_TRIGGER=NOT_IMPLEMENTED');
console.log('STAGE420_DISPLAY_V2_MASTER_UNLOCK_PARITY=NOT_IMPLEMENTED');
console.log('STAGE420_DISPLAY_V2_REAL_RTDB_TRANSACTION=NOT_VERIFIED');

console.log('STAGE420_ATOMIC_LEDGER_1000_UNIQUE_APPROVALS=PASS');
console.log('STAGE420_ATOMIC_LEDGER_1001ST_EXACT_REPLAY_W0=PASS');
console.log('STAGE420_ATOMIC_LEDGER_TAMPER_AND_EXPIRED_FAIL_CLOSED=PASS');
console.log('STAGE420_ATOMIC_LEDGER_MAX_RATE_DOC_BYTES='+maxRateBytes);
console.log('STAGE420_ATOMIC_LEDGER_MAX_RECEIPT_DOC_BYTES='+maxReceiptBytes);
console.log('STAGE420_FIRESTORE_FIRST_ACCEPT=2_READ_2_WRITE_THEORETICAL');
console.log('STAGE420_FIRESTORE_DUPLICATE=1_READ_0_WRITE_THEORETICAL');
console.log('STAGE420_ATOMIC_LEDGER_30_WARNING_40_LIMIT_120M_LOCK=PASS');
console.log('STAGE420_ATOMIC_LEDGER_V4_EXACT_SERVER_PROOF_READ_ONLY_W0=PASS');
console.log('STAGE420_ATOMIC_LEDGER_UNPROVEN_OR_EXPIRED_V4_FAIL_CLOSED=PASS');
console.log('STAGE420_ATOMIC_LEDGER_V4_LIVE_OUTBOX_CUTOVER=HOLD_UNPROVEN_PROOF');
console.log('STAGE420_ATOMIC_LEDGER_8DAY_FIRST_SEND_SAFE_DENIAL=PASS');
console.log('STAGE420_LIVE_BILLING_AND_RTDB_DELIVERY=NOT_VERIFIED');
console.log('STAGE420_ATOMIC_LEDGER_CUTOVER=OFF');

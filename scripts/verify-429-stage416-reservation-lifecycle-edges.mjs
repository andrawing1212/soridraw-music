import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const nativeRequire=createRequire(import.meta.url);
const output=ts.transpileModule(
  readFileSync('functions/src/exploreLikePrivateServerClick416.ts','utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}},
).outputText;
const module={exports:{}};
vm.runInNewContext(output,{module,exports:module.exports,require:nativeRequire,
  Date,Object,Number,Error,Array,Promise,console},{timeout:2500});
const {
  recordUserPrivateClick416,
  cleanupExpiredGlobalReservations416,
  getGlobalReservationLeaseUntil416,
  GLOBAL_RESERVATION_LEASE_MS_416,
  GLOBAL_RESERVATION_LEGACY_GRACE_MS_416,
}=module.exports;

const uid='reservation-lifecycle-edge-user';
const privateRoot='privateLikeBatch416';
const globalRoot='privateLikeGlobalVersion416';
const deviceA='00000000-0000-4000-8000-000000000201';
const opA='00000000-0000-4000-8000-000000000202';
const deviceC='00000000-0000-4000-8000-000000000203';
const opC='00000000-0000-4000-8000-000000000204';
const key=id=>createHash('sha256').update(id).digest('hex');

const roots={[privateRoot]:null,[globalRoot]:null};
let reads=0,changedWrites=0;
const clone=value=>value==null?value:structuredClone(value);
const db={ref:path=>{
  const suffix='/'+uid;
  assert.ok(path.endsWith(suffix),path);
  const root=path.slice(0,-suffix.length);
  assert.ok(Object.hasOwn(roots,root),root);
  return {
    get:async()=>{reads++;return {val:()=>clone(roots[root])};},
    transaction:async update=>{
      const before=clone(roots[root]);
      const next=update(clone(before));
      if(next===undefined)return {committed:false,snapshot:{val:()=>clone(roots[root])}};
      if(JSON.stringify(next)!==JSON.stringify(before))changedWrites++;
      roots[root]=clone(next);
      return {committed:true,snapshot:{val:()=>clone(roots[root])}};
    },
  };
}};

// 1) A lower row version can remain materialized inside a newer environment
// batch even after settledVersion has advanced past the row version. An exact
// duplicate must use environment proof and remain logical W0; it must NOT be
// rebased merely because settledVersion is higher.
const now=1_700_020_000_000;
const rowTrack='materialized-old-row';
roots[globalRoot]={
  version:now+3,settledVersion:now+2,
  devices:{
    [deviceA]:{
      deviceSequence:1,operationId:opA,trackId:rowTrack,liked:true,
      version:now+1,previous:null,leaseUntilMs:now-1,
    },
  },
};
roots[privateRoot]={
  version:now+3,
  deviceSeq:{[deviceA]:1,[deviceC]:1},
  pending:{
    [key(rowTrack)]:{
      trackId:rowTrack,liked:true,operationId:opA,deviceId:deviceA,
      deviceSequence:1,version:now+1,mutationAt:now-100,
    },
    [key('newer-row')]:{
      trackId:'newer-row',liked:true,operationId:opC,deviceId:deviceC,
      deviceSequence:1,version:now+3,mutationAt:now-50,
    },
  },
  window:{id:opA,minutes:5,openedAtMs:now-100,lastClickAtMs:now-50,revision:now+3},
  sealed:null,
};
const writesBeforeDuplicate=changedWrites;
const duplicate=await recordUserPrivateClick416(db,uid,{
  trackId:rowTrack,liked:true,operationId:opA,deviceId:deviceA,deviceSequence:1,
},5,now,false,privateRoot,globalRoot);
assert.equal(duplicate.accepted,true);
assert.equal(duplicate.reason,'DUPLICATE_CONFIRMED');
assert.equal(duplicate.version,now+1);
assert.equal(changedWrites,writesBeforeDuplicate,
  'expired-lease exact environment-proven duplicate must remain logical W0');
assert.equal(roots[globalRoot].devices[deviceA].version,now+1,
  'settled batch fence must not force a row-version rebase');

// 2) An expired GLOBAL-ONLY exact retry that still needs environment
// materialization renews its short fence first, then writes the environment.
// It must not mutate global state for an already-proven duplicate, only here.
const retryNow=now+1_000;
roots[globalRoot]={
  version:retryNow-10,settledVersion:retryNow-20,
  devices:{
    [deviceA]:{
      deviceSequence:1,operationId:opA,trackId:'orphan-retry',liked:true,
      version:retryNow-10,previous:null,leaseUntilMs:retryNow-1,
    },
  },
};
roots[privateRoot]=null;
const writesBeforeRetry=changedWrites;
const retry=await recordUserPrivateClick416(db,uid,{
  trackId:'orphan-retry',liked:true,operationId:opA,deviceId:deviceA,deviceSequence:1,
},5,retryNow,false,privateRoot,globalRoot);
assert.equal(retry.accepted,true);
assert.equal(retry.reason,'ACCEPTED');
assert.equal(retry.version,retryNow-10);
assert.equal(roots[globalRoot].devices[deviceA].leaseUntilMs,
  retryNow+GLOBAL_RESERVATION_LEASE_MS_416);
assert.equal(changedWrites-writesBeforeRetry,2,
  'genuine expired global-only retry performs one lease W1 + one env W1');

// 3) Settlement inspection can race a retry. If its stale snapshot says
// "expired" but the retry refreshed the exact lease before cleanup commits,
// cleanup must recheck current global state and refuse to remove it.
const raceNow=now+2_000;
roots[globalRoot]={
  version:raceNow,settledVersion:raceNow-10,
  devices:{
    [deviceA]:{
      deviceSequence:2,operationId:opA,trackId:'race-track',liked:false,
      version:raceNow,previous:null,leaseUntilMs:raceNow+120_000,
    },
  },
};
const raceWrites=changedWrites;
const raced=await cleanupExpiredGlobalReservations416(
  db,uid,globalRoot,raceNow,[{
    deviceId:deviceA,deviceSequence:2,operationId:opA,trackId:'race-track',
    liked:false,version:raceNow,leaseUntilMs:raceNow-1,
  }],
);
assert.equal(raced.resolved,false);
assert.equal(raced.changed,false);
assert.equal(changedWrites,raceWrites);
assert.equal(roots[globalRoot].devices[deviceA].leaseUntilMs,raceNow+120_000);

// 4) Existing-device no-retry orphan recovery restores the exact predecessor
// rather than deleting the whole device sequence history.
const oldOp='00000000-0000-4000-8000-000000000205';
const existingNow=now+3_000;
const prior={
  deviceSequence:4,operationId:oldOp,trackId:'prior-track',liked:true,
  version:existingNow-20,
};
roots[globalRoot]={
  version:existingNow,settledVersion:existingNow-20,
  devices:{
    [deviceA]:{
      deviceSequence:5,operationId:opA,trackId:'existing-orphan',liked:false,
      version:existingNow,previous:prior,leaseUntilMs:existingNow-1,
    },
  },
};
const existingCleanup=await cleanupExpiredGlobalReservations416(
  db,uid,globalRoot,existingNow,[{
    deviceId:deviceA,deviceSequence:5,operationId:opA,trackId:'existing-orphan',
    liked:false,version:existingNow,leaseUntilMs:existingNow-1,
  }],
);
assert.equal(existingCleanup.resolved,true);
assert.equal(existingCleanup.changed,true);
assert.deepEqual(roots[globalRoot].devices[deviceA],prior);

// 5) Rolling compatibility: the immediately preceding candidate has no
// leaseUntilMs but uses server epoch-ms versions. Give it a bounded 15-minute
// grace; after that it stops being a permanent ordering blocker and can be
// cleaned when predecessor metadata exists.
const legacyVersion=1_700_030_000_000;
const beforeLegacyExpiry=legacyVersion+GLOBAL_RESERVATION_LEGACY_GRACE_MS_416-1;
const afterLegacyExpiry=legacyVersion+GLOBAL_RESERVATION_LEGACY_GRACE_MS_416+1;
assert.equal(
  getGlobalReservationLeaseUntil416({version:legacyVersion},beforeLegacyExpiry),
  legacyVersion+GLOBAL_RESERVATION_LEGACY_GRACE_MS_416,
);
roots[globalRoot]={
  version:legacyVersion,settledVersion:legacyVersion-1,
  devices:{
    [deviceA]:{
      deviceSequence:1,operationId:opA,trackId:'legacy-orphan',liked:true,
      version:legacyVersion,previous:null,
    },
  },
};
const legacyCleanup=await cleanupExpiredGlobalReservations416(
  db,uid,globalRoot,afterLegacyExpiry,[{
    deviceId:deviceA,deviceSequence:1,operationId:opA,trackId:'legacy-orphan',
    liked:true,version:legacyVersion,
    leaseUntilMs:legacyVersion+GLOBAL_RESERVATION_LEGACY_GRACE_MS_416,
  }],
);
assert.equal(legacyCleanup.resolved,true);
assert.equal(legacyCleanup.changed,true);
assert.equal(Object.hasOwn(roots[globalRoot].devices,deviceA),false);

// Unknown older schema without predecessor metadata is never destructively
// guessed. It may cease to act as an ordering fence after grace, but its device
// record is preserved for a later explicit/preflight decision.
roots[globalRoot]={
  version:legacyVersion,settledVersion:legacyVersion-1,
  devices:{
    [deviceA]:{
      deviceSequence:1,operationId:opA,trackId:'ambiguous-legacy',liked:true,
      version:legacyVersion,
    },
  },
};
const ambiguousWrites=changedWrites;
const ambiguous=await cleanupExpiredGlobalReservations416(
  db,uid,globalRoot,afterLegacyExpiry,[{
    deviceId:deviceA,deviceSequence:1,operationId:opA,trackId:'ambiguous-legacy',
    liked:true,version:legacyVersion,
    leaseUntilMs:legacyVersion+GLOBAL_RESERVATION_LEGACY_GRACE_MS_416,
  }],
);
assert.equal(ambiguous.resolved,true);
assert.equal(ambiguous.changed,false);
assert.equal(changedWrites,ambiguousWrites);
assert.ok(roots[globalRoot].devices[deviceA]);

console.log('STAGE416_EXPIRED_LEASE_ENV_PROVEN_DUPLICATE_W0=PASS');
console.log('STAGE416_SETTLED_BATCH_FENCE_DOES_NOT_REBASE_MATERIALIZED_ROW=PASS');
console.log('STAGE416_GENUINE_EXPIRED_RETRY_RENEWS_THEN_MATERIALIZES=PASS');
console.log('STAGE416_CLEANUP_RACE_WITH_RETRY_REFRESH_FAILS_CLOSED=PASS');
console.log('STAGE416_EXISTING_DEVICE_NO_RETRY_ORPHAN_RESTORES_PREDECESSOR=PASS');
console.log('STAGE416_PREVIOUS_CANDIDATE_NO_LEASE_HAS_BOUNDED_LEGACY_GRACE=PASS');
console.log('STAGE416_AMBIGUOUS_LEGACY_CLEANUP_IS_NONDESTRUCTIVE=PASS');
console.log('STAGE416_LIFECYCLE_EDGE_PAGE_UPDATE_REENTRY_IO=0');

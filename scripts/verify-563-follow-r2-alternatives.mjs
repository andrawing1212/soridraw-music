// APP563 isolated feasibility/adversarial comparison, NOT a release test.
// Emulates an alternative D1-atomic per-profile generation/outbox + R2 CAS
// model to measure what it costs to cut normal changed-operation R2 PUTs.
// This is consciously NOT hooked into the existing frozen canonical Worker.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture} from './verify-354-follow-orchestration.mjs';
import {createIsolatedR2PostcommitModel563,
 APP563_REDUCED_R2_SOURCE_ONLY,APP563_LIVE_ACTIVATION_ALLOWED}
 from '../cloudflare/explore-worker/candidates/563-follow-r2-postcommit-feasibility.mjs';
assert.equal(APP563_REDUCED_R2_SOURCE_ONLY,true);
assert.equal(APP563_LIVE_ACTIVATION_ALLOWED,false);
const canonicalSource=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
for(const contract of ['async function orchestrateFollowOverlay354(',
 'async function registerFollowPending354(',
 'async function repairFollowProfile354(',
 'async function readFollowStateSnapshot354(',
 'async function readFollowIntent354(',
 'async function completeFollowIntent354('])
 assert.ok(canonicalSource.includes(contract),'frozen 354 contract removed: '+contract);
assert.equal(canonicalSource.includes('563-follow-r2-postcommit-feasibility'),false);
const id=n=>'operation_'+String(n).padStart(16,'0');
const old=fixture();
const start=old.metrics();
const oldAck=await old.call('actor','target',true,563);
const baseline={r2Put:old.metrics().writes-start.writes,
 r2Get:old.metrics().reads-start.reads,
 logicalD1Changed:old.metrics().changed-start.changed};
assert.equal(baseline.r2Put,6);
assert.equal(baseline.logicalD1Changed,1);
console.log('APP563_CURRENT_354_ACTUAL_CHANGED_BASELINE='+JSON.stringify(baseline));
const next=createIsolatedR2PostcommitModel563();
const owner='A',actor='B',operation=id(1);
assert.equal(next.reserve({actor,owner,id:operation,following:true}).status,'reserved');
assert.equal(next.reserve({actor,owner,id:operation,following:true}).status,'duplicate');
assert.equal(next.reserve({actor,owner,id:id(2),following:false}).status,'same-pair-pending');
assert.equal(next.signal(operation).status,'uncommitted');
const before=next.ledger.r2Put;
assert.equal(next.commit(operation).status,'committed');
// SAFETY REJECTION: old v354 profile consumers see a stale profile marked
// exact immediately after D1 commits, with no R2 pending fence.
const unsafe=next.readLegacy(owner);
assert.equal(unsafe.exact,true);
assert.equal(unsafe.followers,0);
assert.equal(next.current(owner).followers,1);
assert.equal(next.readFenced(owner).status,'stale-after-commit');
assert.equal(next.signal(operation).status,'both-profiles-not-materialized');
assert.equal(next.materialize(operation,owner).status,'materialized');
assert.equal(next.signal(operation).status,'both-profiles-not-materialized');
assert.equal(next.readFenced(owner).status,'exact');
assert.equal(next.readFenced(actor).status,'stale-after-commit');
assert.equal(next.materialize(operation,actor,{raceOnce:true}).status,'cas-conflict-retry-needed');
assert.equal(next.materialize(operation,actor).status,'materialized');
const signal=next.signal(operation);
assert.equal(signal.status,'delivered');
assert.equal(signal.followerCount,1);
assert.equal(signal.ownerVersion,1);
assert.equal(next.ledger.r2Put-before,2,'2 profile materializations, no R2 pair-intent');
assert.equal(next.ledger.d1Write,3,'D1 relation + two required generation/counter writes');
assert.equal(next.ledger.doWrite,3,'DO reservation + receipt + delivered metadata');
assert.equal(next.ledger.doAlarm,1);
assert.equal(next.materialize(operation,owner).status,'already-current');
assert.equal(next.materialize(operation,actor).status,'already-current');
assert.equal(next.signal(operation).status,'already-delivered');
assert.equal(next.ledger.r2Put,2,'retry must NOT apply a second count delta');
console.log('APP563_NEW_POSTCOMMIT_2_R2_PUT_WITH_REQUIRED_D1_FENCE_SOURCE_ONLY=PASS');
console.log('APP563_LEGACY_EXACT_STALE_DURING_D1_R2_GAP=RELEASE_FAIL');
const afterWarm=next.ledger.d1Read;
assert.equal(next.readFenced(owner).status,'exact');
assert.equal(next.ledger.d1Read-afterWarm,1,
 'every otherwise warm public profile GET now requires D1 version read');
console.log('APP563_WARM_PROFILE_GET_D1_READ_ZERO_CONTRACT=FAIL_BY_DESIGN');
const noOpId=id(3);
assert.equal(next.reserve({actor,owner,id:noOpId,following:true}).status,'reserved');
const beforeNoop={...next.ledger};
assert.equal(next.commit(noOpId).status,'noop');
assert.equal(next.getRevision(actor,owner),2,
 'legacy 354 browser expects increasing response revision even for noop');
assert.equal(next.signal(noOpId).status,'noop-no-signal');
assert.equal(next.ledger.r2Put,beforeNoop.r2Put);
assert.equal(next.ledger.d1Write-beforeNoop.d1Write,1,
 'a new no-op identity must still persist a sequence receipt');
assert.equal(next.ledger.ownerSignals,1);
console.log('APP563_NEW_NOOP_MONOTONIC_RECEIPT_MOVES_R2_CLASS_A_TO_D1_DO=PASS');
// Simulated crash just AFTER canonical D1 commit, BEFORE DO acknowledgement,
// before either R2 profile CAS. Durable stable operation can reconstruct.
const failure=createIsolatedR2PostcommitModel563(),crashedId=id(4);
assert.equal(failure.reserve({actor:'B',owner:'A',id:crashedId,following:true}).status,'reserved');
assert.throws(()=>failure.commit(crashedId,{crashBeforeJournalAck:true}),
 /SYNTHETIC_CRASH_AFTER_D1_COMMIT/);
assert.equal(failure.current('A').followers,1);
assert.equal(failure.readFenced('A').status,'stale-after-commit');
assert.equal(failure.materialize(crashedId,'A').status,'uncommitted');
assert.equal(failure.commit(crashedId).status,'recovered-d1-commit');
assert.equal(failure.ledger.d1Write,3,'same operation MUST NOT write D1 twice');
assert.equal(failure.materialize(crashedId,'A').status,'materialized');
assert.equal(failure.signal(crashedId).status,'both-profiles-not-materialized');
assert.equal(failure.materialize(crashedId,'B').status,'materialized');
assert.equal(failure.signal(crashedId).status,'delivered');
assert.equal(failure.ledger.r2Put,2);
console.log('APP563_SYNTHETIC_D1_CRASH_RECOVERY_WITH_FENCE=PASS');
// Two actors concurrently committed to one owner. The D1-absolute-profile
// generation avoids CAS lost-delta even when R2 materialization is reordered.
const crowded=createIsolatedR2PostcommitModel563(),a=id(5),b=id(6);
for(const [uid,receipt] of [['B',a],['C',b]]){
 assert.equal(crowded.reserve({actor:uid,owner:'A',id:receipt,following:true}).status,'reserved');
 assert.equal(crowded.commit(receipt).status,'committed');
}
assert.equal(crowded.current('A').followers,2);
assert.equal(crowded.readFenced('A').status,'stale-after-commit');
assert.equal(crowded.materialize(a,'A').status,'materialized');
assert.equal(crowded.materialize(b,'A').status,'already-current');
assert.equal(crowded.materialize(a,'B').status,'materialized');
assert.equal(crowded.materialize(b,'C').status,'materialized');
const e1=crowded.signal(a),e2=crowded.signal(b);
assert.equal(e1.followerCount,2);
assert.equal(e2.followerCount,2);
assert.equal(e1.ownerVersion,2);
assert.equal(e2.ownerVersion,2);
assert.equal(crowded.ledger.r2Put,3,'batched owner two latest + two actor writes');
assert.equal(crowded.ledger.d1Write,6,'two changed edges require +2 D1 counter/generation writes each');
console.log('APP563_TWO_ACTORS_OWNER_MONOTONIC_COUNT_REQUIRES_D1_COUNTER_ROWS=PASS');
console.log('APP563_COMPARATIVE_ISOLATED_COST='+JSON.stringify({
 frozen354Changed:{r2Put:baseline.r2Put,logicalD1Changed:baseline.logicalD1Changed,
  perPublicProfileExtraCanonicalRead:0},
 postcommitVariant:{r2Put:2,d1Writes:3,doWrites:3,doAlarms:1,
  extraD1ReadPerFencedProfileGet:1,ownerAuthEpochAndRTDB:'UNMEASURED'},
 releaseGate:'NO_GO_LEGACY_354_EXACTNESS_AND_D1_W2_COST_CONTRACT_CHANGED',
 sameAccountPCMobile:'NOT_TESTED',
 userDataAndSharedBackendWrites:0,
}));
console.log('APP563_ALTERNATIVE_FEASIBILITY_PASS_RELEASE_GO_NO_GO=NO_GO');

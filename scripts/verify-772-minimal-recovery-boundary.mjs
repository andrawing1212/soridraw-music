import assert from 'node:assert/strict';
import {APP772_MINIMAL_RECOVERY_COMPILED_OPEN,
  assessApp772FailureWindow} from './app772-minimal-recovery-boundary.mjs';
const preservedFetch=globalThis.fetch;
globalThis.fetch=()=>{throw Error('APP772_MUST_HAVE_ZERO_NETWORK_CALLS')};
const op={ownerUid:'qa772OwnerActor',actorUid:'qa772FollowerActor',
  canonicalOperationId:'qa772CanonicalOperation0000000001',
  cutoverToken:'qa772NewCutoverToken0000000001',authEpoch:'a'.repeat(32),
  expectedRevision:20, priorR2Revision:30,beforeFollowing:false,desired:true};
async function digest(a){
  const raw=new TextEncoder().encode(JSON.stringify([a.cutoverToken,a.ownerUid,
    a.actorUid,a.authEpoch,a.canonicalOperationId]));
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',raw));
  return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
}
const admission={status:'ADMISSION_ONLY_NOT_D1_COMMIT',requiresCanonicalCommitProof:true,
  productionDeployAuthorized:false,d1AdditionalRowsWritten:0,keyDigest:await digest(op)};
const common={ownerUid:op.ownerUid,actorUid:op.actorUid,
  canonicalOperationId:op.canonicalOperationId,authEpoch:op.authEpoch,
  cutoverToken:op.cutoverToken};
const owner={ownerUid:op.ownerUid,authEpoch:op.authEpoch};
function trusted(){return {
  source:'TRUSTED_SERVER_POST_ADMISSION_770',verified:true,independentOfOwnerDo:true,
  auth:{source:'FIREBASE_VERIFIED_OWNER_AUTH_EPOCH',verified:true,
    firebaseProjectId:'soridraw-app-866a5',...owner},
  cutover:{source:'SERVER_ATTESTED_COMPLETE_CUTOVER_770',verified:true,...owner,
    cutoverToken:op.cutoverToken,completeBeforeFirstAcceptedOperation:true,
    everyWriterCovered:true,legacyWriterCoverageProven:true,
    noLegacyIdNamespaceOverlap:true,userDeletionLifecycleReviewed:true},
  d1:{source:'EXACT_CANONICAL_D1_OPERATION_RECEIPT',verified:true,...common,
    expectedRevision:op.expectedRevision,beforeFollowing:false,following:true,
    committed:true,revision:21,immutableOperationIdProof:true},
  r2:{source:'EXACT_SETTLED_OWNER_R2_OPERATION_RECEIPT',verified:true,
    ...common,projectionSettled:true,revision:31,d1CommittedRevision:21,
    immutableOperationIdProof:true},
  history:{source:'INDEPENDENT_MONOTONIC_OPERATION_LEDGER',verified:true,
    independentOfOwnerDo:true,completeFromOrigin:true,everyWriterCovered:true,
    legacyWriterCoverageProven:true,operationStatus:'committed',...common,
    committedD1Revision:21,completeThroughRevision:21},
  checkpoint:{source:'EXTERNAL_OWNER_REVISION_FLOOR',verified:true,
    independentOfOwnerDo:true,...owner,minD1Revision:21,minR2Revision:31},
};}
const fence=()=>({source:'TRUSTED_INDEPENDENT_PAIR_PENDING_FENCE_772',verified:true,
  independentOfOwnerDo:true,allActiveAndLegacyWritersCovered:true,
  noLaterPairCommitBeforeSettle:true,fullOwnerDoPitrCannotBypass:true,
  userDeletionAndUidReuseReviewed:true,...common});
const budget=()=>({source:'EXACT_CANONICAL_WRITER_META_772',verified:true,
  originalD1RowsWritten:2,additionalD1RowsWritten:0,
  fullScanAllowed:false,backgroundPollingAllowed:false});
const set=()=>({phase:'D1_COMMITTED_ACK_LOST',reservation:structuredClone(op),
  admission:structuredClone(admission),evidence:trusted(),pendingFence:fence(),budget:budget()});
let count=0;
const noMutations=r=>{
  for(const k of ['canonicalD1WriteAuthorized','repeatCanonicalWriteAuthorized',
    'mintOperationIdAuthorized','ownerDoReserveAuthorized','relayAuthorized',
    'mutationAuthorized','productionDeployAuthorized','activeCallbackConnected'])
    assert.equal(r[k],false,'unsafe '+k);
};
async function expectedHold(label,mutator,reason){
  const a=set();mutator(a);
  const result=await assessApp772FailureWindow(a);
  assert.equal(result.status,'HOLD',label);noMutations(result);
  if(reason)assert.equal(result.reason,reason,label);
  count++;
}
try{
 assert.equal(APP772_MINIMAL_RECOVERY_COMPILED_OPEN,false);
 for(const p of ['D1_COMMITTED_ACK_LOST','EXACT_SETTLED_RECEIPT_REPLAY']){
   const result=await assessApp772FailureWindow({...set(),phase:p});
   assert.equal(result.status,'OFFLINE_EXACT_SETTLED_READ_ONLY_SHAPE_ONLY');
   assert.equal(result.actualAutomaticRecoveryVerified,false);
   assert.equal(result.realD1CostPhysicallyVerified,false);
   noMutations(result);count++;
 }
 const failurePhases={
   R2_CLAIM_ACK_UNKNOWN:'R2_CLAIM_POSSIBLY_ACCEPTED',
   ADMITTED_D1_RESULT_UNKNOWN:'D1_COMMIT_OUTCOME_UNKNOWN',
   D1_FAILURE_OBSERVED:'D1_NOT_COMMITTED_IS_NOT_RETRY_PROOF',
   R2_SETTLEMENT_ACK_UNKNOWN:'SETTLEMENT_OR_CANONICAL_ACK_UNKNOWN',
   OWNER_DO_PITR:'EXTERNAL_OPERATION_FLOOR_AND_WRITER_CUTOVER_REQUIRED',
 };
 for(const [p,reason] of Object.entries(failurePhases))
   await expectedHold(p,a=>{a.phase=p},reason);
 await expectedHold('unknown phase',a=>{a.phase='UNKNOWN'},'INVALID_FAILURE_PHASE');
 await expectedHold('missing operation',a=>{a.reservation=null});
 await expectedHold('wrong actor',a=>{a.reservation.actorUid=a.reservation.ownerUid});
 await expectedHold('invalid operation ID',a=>{a.reservation.canonicalOperationId='short'});
 await expectedHold('bad cost metadata',a=>{a.budget=undefined});
 await expectedHold('W0 abnormal',a=>{a.budget.originalD1RowsWritten=0});
 await expectedHold('W3 disallowed',a=>{a.budget.originalD1RowsWritten=3});
 await expectedHold('new D1 ledger row forbidden',a=>{a.budget.additionalD1RowsWritten=1});
 await expectedHold('batch scan forbidden',a=>{a.budget.fullScanAllowed=true});
 await expectedHold('poll forbidden',a=>{a.budget.backgroundPollingAllowed=true});
 await expectedHold('unverified D1 metadata',a=>{a.budget.verified=false});
 await expectedHold('lost admission',a=>{a.admission=null});
 await expectedHold('R2 wrong ID',a=>{a.admission.keyDigest='0'.repeat(64)});
 await expectedHold('D1 last state only',a=>{a.evidence.d1.source='LATEST_D1_PAIR'});
 await expectedHold('D1 exact ID overwritten',a=>{a.evidence.d1.canonicalOperationId='otherOperationForQA0000001'});
 await expectedHold('D1 failure unknown',a=>{a.evidence.d1.committed=false});
 await expectedHold('R2 settle missing',a=>{a.evidence.r2=undefined});
 await expectedHold('R2 stale epoch',a=>{a.evidence.r2.authEpoch='b'.repeat(32)});
 await expectedHold('D1 and R2 inconsistent',a=>{a.evidence.r2.d1CommittedRevision=22});
 await expectedHold('prior operation history incomplete',a=>{a.evidence.history.completeFromOrigin=false});
 await expectedHold('old Writer gap',a=>{a.evidence.history.legacyWriterCoverageProven=false});
 await expectedHold('out-of-DO floor missing',a=>{a.evidence.checkpoint=null});
 await expectedHold('floor behind R2',a=>{a.evidence.checkpoint.minR2Revision=30});
 await expectedHold('stale Firebase UID epoch',a=>{a.evidence.auth.authEpoch='c'.repeat(32)});
 await expectedHold('no pending fence',a=>{a.pendingFence=undefined},'PAIR_WRITER_PENDING_FENCE_UNVERIFIED');
 await expectedHold('old Writer bypass',a=>{a.pendingFence.allActiveAndLegacyWritersCovered=false});
 await expectedHold('subsequent D1 overwrite',a=>{a.pendingFence.noLaterPairCommitBeforeSettle=false});
 await expectedHold('full DO rollback bypass',a=>{a.pendingFence.fullOwnerDoPitrCannotBypass=false});
 await expectedHold('owner mismatch fence',a=>{a.pendingFence.ownerUid='anotherOwner'});
 await expectedHold('fence tied to DO',a=>{a.pendingFence.independentOfOwnerDo=false});
 await expectedHold('deletion policy unproven',a=>{a.pendingFence.userDeletionAndUidReuseReviewed=false});
 console.log('APP772_FAIL_CLOSED_STATES='+count+'; LIVE_RUNTIME_WRITES_READS=0; LOCAL_OFFLINE=PASS');
 console.log('APP772_W1_W2_BOUNDARY_W3_BLOCKED=PASS');
 console.log('APP772_LEGACY_WRITER_PITR_ACK_LOSS_NO_REPLAY=PASS');
 console.log('APP772_REAL_SERVER_RECOVERY_AND_PHYSICAL_COST=NOT_TESTED_HOLD');
} finally {globalThis.fetch=preservedFetch;}

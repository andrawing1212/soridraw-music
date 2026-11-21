// APP767 independent synthetic QA: no Cloudflare account, D1, R2 bucket,
// Firebase, RTDB or user-data read/write. No real PRODUCTION activation.
// Validates conditional R2 escrow vs original canonical W1-W2 budget.
import assert from 'node:assert/strict';
import {
 APP767_R2_ADMISSION_COMPILED_OPEN,
 createApp767IsolatedR2Admission,compareApp767HistoryOptions,
} from './app767-r2-admission-candidate.mjs';
assert.equal(APP767_R2_ADMISSION_COMPILED_OPEN,false);
assert.equal(createApp767IsolatedR2Admission(),null);
const epoch='a'.repeat(32),uid='app767OwnerQaSynthetic';
const reservation={ownerUid:uid,actorUid:'app767ActorQaSynthetic',
 authEpoch:epoch,cutoverToken:'cutover_app767_qa_synthetic',
 canonicalOperationId:'canonical_app767_qa_000000001',
 expectedRevision:7,desired:true};
const attested=a=>({
 source:'SERVER_ATTESTED_NEW_EPOCH_ONLY_767',verified:true,
 ownerUid:a.ownerUid,actorUid:a.actorUid,
 authEpoch:a.authEpoch,cutoverToken:a.cutoverToken,
 expectedRevision:a.expectedRevision,
 completeBeforeFirstAcceptedOperation:true,
 canonicalWriterCoverageProven:true,
 noLegacyIdNamespaceOverlap:true,
 userDeletionLifecycleReviewed:true,
 isolationFromOwnerDoPitrProven:true,
});
const map=new Map(),metrics={classA:0,reads:0,writes:0,list:0,deletes:0};
let timeoutBeforeWrite=false,timeoutAfterWrite=false,malformedAck=false;
const qaBucket={
 async put(key,body,options){
  metrics.classA++;
  assert.equal(options?.onlyIf?.etagDoesNotMatch,'*');
  assert.equal(options?.httpMetadata?.contentType,'application/json');
  assert.match(key,/^internal\/qa767\/owner-follow-admissions\/[0-9a-f]{64}$/);
  assert(!key.includes(uid)&&!key.includes(reservation.actorUid));
  const entry=JSON.parse(body);
  assert.equal(entry.kind,'APP767_ADMISSION_NOT_CANONICAL_COMMIT');
  if(timeoutBeforeWrite){timeoutBeforeWrite=false;throw Error('INJECTED_BEFORE_R2_WRITE_503')}
  if(map.has(key))return null;
  map.set(key,structuredClone(entry));metrics.writes++;
  if(timeoutAfterWrite){timeoutAfterWrite=false;throw Error('INJECTED_AFTER_R2_COMMIT_503')}
  return malformedAck?{version:'synthetic'}:{etag:'qa767-etag-'+metrics.writes};
 },
 async get(){metrics.reads++;throw Error('UNEXPECTED_R2_GET')},
 async list(){metrics.list++;throw Error('UNEXPECTED_R2_SCAN')},
 async delete(){metrics.deletes++;throw Error('UNEXPECTED_R2_DELETE')},
};
let proofMode='good',proofs=0;
const admission=createApp767IsolatedR2Admission({
 enabled:true,scope:'APP767_ISOLATED_SYNTHETIC_QA',
 bucket:qaBucket,
 verifyTrustedCutover:async a=>{
  proofs++;
  const q=attested(a);
  if(proofMode==='incomplete')q.completeBeforeFirstAcceptedOperation=false;
  if(proofMode==='legacy')q.noLegacyIdNamespaceOverlap=false;
  if(proofMode==='writerGap')q.canonicalWriterCoverageProven=false;
  if(proofMode==='noDeletion')q.userDeletionLifecycleReviewed=false;
  if(proofMode==='doPitr')q.isolationFromOwnerDoPitrProven=false;
  if(proofMode==='epoch')q.authEpoch='c'.repeat(32);
  if(proofMode==='503')throw Error('TRUSTED_CUTOVER_503');
  return q;
 },
});
const claim=a=>admission.claim({
 env:{SORIDRAW_ENVIRONMENT:'isolated-qa'},reservation:a,
});
for(const mode of ['incomplete','legacy','writerGap','noDeletion','doPitr','epoch','503']){
 proofMode=mode;
 const before=metrics.classA;
 const v=await claim(reservation);
 assert.equal(v.status,'HOLD');
 assert.equal(metrics.classA,before,'unverified preflight cannot call R2');
}
proofMode='good';
assert.equal((await admission.claim({
 env:{SORIDRAW_ENVIRONMENT:'production'},reservation,
})).status,'HOLD');
assert.equal((await claim({...reservation,authEpoch:'invalid'})).status,'HOLD');
assert.equal((await claim({...reservation,canonicalOperationId:'old'})).status,'HOLD');
assert.equal(metrics.classA,0);
assert.throws(()=>createApp767IsolatedR2Admission({
 enabled:true,scope:'production',bucket:qaBucket,
 verifyTrustedCutover:attested,
}),/APP767_OFF_SCOPE/);
// Same op concurrent claims -> only exactly one wins R2 create-once.
const results=await Promise.all(Array.from({length:6},()=>claim(reservation)));
assert.equal(results.filter(x=>x.status==='ADMISSION_ONLY_NOT_D1_COMMIT').length,1);
assert.equal(results.filter(x=>x.reason==='PRIOR_OR_CONCURRENT_CLAIM_REQUIRES_RECONCILIATION').length,5);
assert.equal(map.size,1);
assert.equal(metrics.writes,1);
assert.equal(metrics.classA,6,'412 conditional conflicts still count Class A');
const first=results.find(x=>x.status==='ADMISSION_ONLY_NOT_D1_COMMIT');
assert.equal(first.productionDeployAuthorized,false);
assert.equal(first.requiresCanonicalCommitProof,true);
assert.equal(first.d1AdditionalRowsWritten,0);
// After DO loss (synthetic), no prior DO receipt remains. R2 escrow blocks
// second canonical reservation regardless of current D1 follow state.
let doReceipt=null,canonicalCalls=0,observedCanonicalD1W=0;
async function qaCanonicalTry(a,{failAfterCanonical=false}={}){
 const escrow=await claim(a);
 if(escrow.status!=='ADMISSION_ONLY_NOT_D1_COMMIT')
  return {status:'HOLD_BEFORE_CANONICAL',reason:escrow.reason};
 doReceipt={operationId:a.canonicalOperationId,authEpoch:a.authEpoch};
 canonicalCalls++;
 observedCanonicalD1W+=2; // simulated W2 baseline; NOT a physical CF meta proof.
 if(failAfterCanonical)throw Error('INJECTED_ACK_LOST_AFTER_D1_COMMIT');
 return {status:'SYNTHETIC_D1_CHANGED',canonicalD1W:2};
}
let prior=await qaCanonicalTry(reservation);
assert.equal(prior.status,'HOLD_BEFORE_CANONICAL','already claimed');
const second={...reservation,canonicalOperationId:'canonical_app767_qa_000000002'};
await assert.rejects(()=>qaCanonicalTry(second,{failAfterCanonical:true}),
 /INJECTED_ACK_LOST_AFTER_D1_COMMIT/);
assert.equal(canonicalCalls,1);
assert.equal(observedCanonicalD1W,2);
doReceipt=null; // injected DO full PITR / lost ACK
assert.equal((await qaCanonicalTry(second)).status,'HOLD_BEFORE_CANONICAL');
assert.equal(canonicalCalls,1,'old ID after full DO loss cannot write D1 twice');
assert.equal(map.size,2);
// R2 success but DO storage fails: do not claim canonical success,
// and never re-execute D1 on an uncertain reservation.
const third={...reservation,canonicalOperationId:'canonical_app767_qa_000000003'};
assert.equal((await claim(third)).status,'ADMISSION_ONLY_NOT_D1_COMMIT');
assert.equal((await qaCanonicalTry(third)).status,'HOLD_BEFORE_CANONICAL');
assert.equal(canonicalCalls,1);
// R2 503-before-write, 503-after-write, malformed ACK all fail closed.
const fourth={...reservation,canonicalOperationId:'canonical_app767_qa_000000004'};
timeoutBeforeWrite=true;
assert.equal((await claim(fourth)).reason,'CLAIM_OUTCOME_UNCERTAIN');
assert.equal(map.size,3);
const fifth={...reservation,canonicalOperationId:'canonical_app767_qa_000000005'};
timeoutAfterWrite=true;
assert.equal((await claim(fifth)).reason,'CLAIM_OUTCOME_UNCERTAIN');
assert.equal(map.size,4);
assert.equal((await qaCanonicalTry(fifth)).status,'HOLD_BEFORE_CANONICAL');
const sixth={...reservation,canonicalOperationId:'canonical_app767_qa_000000006'};
malformedAck=true;
assert.equal((await claim(sixth)).reason,'INDETERMINATE_CLAIM_ACK');
malformedAck=false;
assert.equal((await qaCanonicalTry(sixth)).status,'HOLD_BEFORE_CANONICAL');
// New Auth epoch without server claim proof must not treat old ledger as
// permission to replay, and cross-owner ownership fails before R2 writes.
proofMode='epoch';
const recreated={...reservation,authEpoch:'b'.repeat(32),
 canonicalOperationId:'canonical_app767_qa_000000007'};
const countBefore=metrics.classA;
assert.equal((await claim(recreated)).status,'HOLD');
assert.equal(metrics.classA,countBefore);
proofMode='good';
const next={...reservation,canonicalOperationId:'canonical_app767_qa_000000008'};
assert.equal((await qaCanonicalTry(next)).status,'SYNTHETIC_D1_CHANGED');
assert.equal(canonicalCalls,2);
assert.equal(observedCanonicalD1W,4);
assert.equal(metrics.reads,0);
assert.equal(metrics.list,0);
assert.equal(metrics.deletes,0);
const m50=compareApp767HistoryOptions({canonicalD1RowsWrittenBaseline:2});
const m500=compareApp767HistoryOptions({canonicalD1RowsWrittenBaseline:2,
 yearlyOperationsPerOwner:500});
assert.equal(m50.d1AppendOnlyLedger.estimatedMinRowsWritten,3);
assert.equal(m50.d1AppendOnlyLedger.withinW1W2,false);
assert.equal(m50.r2Admission.additionalD1RowsWritten,0);
assert.equal(m50.r2Admission.estimatedMonthlyNewClassA,416667);
assert.equal(m500.r2Admission.estimatedMonthlyNewClassA,4166667);
assert.equal(m500.r2Admission.paidOverageClassAUSD,18);
assert.equal(m500.r2Admission.paidOverageStorageUSD,0.12);
assert.equal(m500.r2Admission.endYearStorageGB,17.5);
assert.equal(m50.r2Admission.atomicWithCanonicalD1Commit,false);
assert.equal(m50.productionDeployAuthorized,false);
assert.equal(compareApp767HistoryOptions({
 canonicalD1RowsWrittenBaseline:1}).d1AppendOnlyLedger.withinW1W2,true);
assert.throws(()=>compareApp767HistoryOptions({
 canonicalD1RowsWrittenBaseline:NaN}),/COST_INPUT_UNVERIFIED/);
console.log('APP767_R2_CONDITIONAL_CREATE_ONCE_CONCURRENT_DUPLICATE_HOLD=PASS');
console.log('APP767_AFTER_DO_PITR_AND_D1_ACK_LOSS_NO_SECOND_CANONICAL_WRITE=PASS');
console.log('APP767_CUTOVER_AUTH_EPOCH_DELETION_LIFECYCLE_503_FAIL_CLOSED=PASS');
console.log('APP767_SYNTHETIC_CANONICAL_W2_EXTRA_D1_W0_AND_R2_COST_MODEL=PASS');
console.log('APP767_PERSISTENT_R2_REAL_QA_AND_INDEPENDENT_HISTORY_COVERAGE=NOT_PROVEN');
console.log('APP767_ISOLATED_MEMORY_QA_ONLY; SHARED_DATA_RW=0; PROD_DEPLOY=0');

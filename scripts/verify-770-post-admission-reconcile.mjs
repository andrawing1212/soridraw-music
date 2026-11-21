// APP770 standalone OFF-only reconciliation contract tests: pure functions.
// No accounts, tokens, real D1/R2/DO, Cloudflare, Firebase or user data.
import assert from 'node:assert/strict';
import {APP770_POST_ADMISSION_COMPILED_OPEN,assessApp770PostAdmission} from './app770-post-admission-reconcile.mjs';

assert.equal(APP770_POST_ADMISSION_COMPILED_OPEN,false);
const operation={ownerUid:'ownerQA770',actorUid:'actorQA770',
 canonicalOperationId:'qa770CanonicalOperationId0001',
 cutoverToken:'qa770_exclusive_new_cutover_token',
 authEpoch:'a'.repeat(32),expectedRevision:17,priorR2Revision:41,
 beforeFollowing:false,desired:true};
async function digest(op){
 const raw=new TextEncoder().encode(JSON.stringify([
  op.cutoverToken,op.ownerUid,op.actorUid,op.authEpoch,op.canonicalOperationId]));
 const h=new Uint8Array(await crypto.subtle.digest('SHA-256',raw));
 return [...h].map(x=>x.toString(16).padStart(2,'0')).join('');
}
const admission={status:'ADMISSION_ONLY_NOT_D1_COMMIT',
 keyDigest:await digest(operation),d1AdditionalRowsWritten:0,
 requiresCanonicalCommitProof:true,productionDeployAuthorized:false};
const bind={ownerUid:operation.ownerUid,actorUid:operation.actorUid,
 canonicalOperationId:operation.canonicalOperationId,
 authEpoch:operation.authEpoch,cutoverToken:operation.cutoverToken};
function completeEvidence(){return {
 source:'TRUSTED_SERVER_POST_ADMISSION_770',verified:true,independentOfOwnerDo:true,
 auth:{source:'FIREBASE_VERIFIED_OWNER_AUTH_EPOCH',verified:true,
  firebaseProjectId:'soridraw-app-866a5',ownerUid:operation.ownerUid,authEpoch:operation.authEpoch},
 cutover:{source:'SERVER_ATTESTED_COMPLETE_CUTOVER_770',verified:true,
  ownerUid:operation.ownerUid,authEpoch:operation.authEpoch,
  cutoverToken:operation.cutoverToken,completeBeforeFirstAcceptedOperation:true,
  everyWriterCovered:true,legacyWriterCoverageProven:true,
  noLegacyIdNamespaceOverlap:true,userDeletionLifecycleReviewed:true},
 d1:{source:'EXACT_CANONICAL_D1_OPERATION_RECEIPT',verified:true,
  committed:true,...bind,expectedRevision:operation.expectedRevision,
  beforeFollowing:operation.beforeFollowing,following:operation.desired,
  revision:18,immutableOperationIdProof:true},
 r2:{source:'EXACT_SETTLED_OWNER_R2_OPERATION_RECEIPT',verified:true,
  projectionSettled:true,...bind,revision:42,d1CommittedRevision:18,
  immutableOperationIdProof:true},
 history:{source:'INDEPENDENT_MONOTONIC_OPERATION_LEDGER',verified:true,
  independentOfOwnerDo:true,completeFromOrigin:true,everyWriterCovered:true,
  legacyWriterCoverageProven:true,operationStatus:'committed',...bind,
  committedD1Revision:18,completeThroughRevision:18},
 checkpoint:{source:'EXTERNAL_OWNER_REVISION_FLOOR',verified:true,
  independentOfOwnerDo:true,ownerUid:operation.ownerUid,
  authEpoch:operation.authEpoch,minD1Revision:18,minR2Revision:42},
};}
const originalFetch=globalThis.fetch;
globalThis.fetch=()=>{throw Error('APP770_UNEXPECTED_REMOTE_FETCH')};
let checked=0;
try{
 async function denied(label,change){
  const a={reservation:structuredClone(operation),admission:structuredClone(admission),
   evidence:completeEvidence()};
  change(a);
  const result=await assessApp770PostAdmission(a);
  assert.equal(result.status,'HOLD',label);
  assert.equal(result.canonicalD1WritesAuthorized,false,label);
  assert.equal(result.retryOriginalOperationAuthorized,false,label);
  assert.equal(result.mintNewOperationAuthorized,false,label);
  assert.equal(result.ownerDoReservationAuthorized,false,label);
  assert.equal(result.signedRelayAuthorized,false,label);
  assert.equal(result.productionDeployAuthorized,false,label);
  checked++;
 }
 const complete=await assessApp770PostAdmission({reservation:operation,admission,
  evidence:completeEvidence()});
 assert.equal(complete.status,'OFFLINE_EXACT_SETTLED_PROOF_SHAPE_MATCHED_ONLY');
 assert.equal(complete.confirmedD1Revision,18);
 assert.equal(complete.confirmedR2Revision,42);
 assert.equal(complete.actualCanonicalRecoveryVerified,false);
 assert.equal(complete.runtimeCallbackConnected,false);
 for(const key of ['canonicalD1WritesAuthorized','retryOriginalOperationAuthorized',
  'mintNewOperationAuthorized','ownerDoReservationAuthorized',
  'signedRelayAuthorized','productionDeployAuthorized'])
  assert.equal(complete[key],false);
 checked++;
 await denied('missing operation',a=>{a.reservation=null});
 await denied('invalid auth epoch',a=>{a.reservation.authEpoch='invalid'});
 await denied('self-follow forbidden',a=>{a.reservation.ownerUid=a.reservation.actorUid});
 await denied('no follow state change',a=>{a.reservation.beforeFollowing=true});
 await denied('missing accepted claim',a=>{a.admission=null});
 await denied('uncertain claim after 503',a=>{a.admission.status='HOLD'});
 await denied('claim different operation',a=>{a.admission.keyDigest='f'.repeat(64)});
 await denied('claim unauthorized deployment',a=>{a.admission.productionDeployAuthorized=true});
 await denied('claim falsely adds D1 writes',a=>{a.admission.d1AdditionalRowsWritten=1});
 await denied('cannot trust client proof',a=>{a.evidence.source='UNTRUSTED_CLIENT'});
 await denied('no callback evidence',a=>{a.evidence=undefined});
 await denied('stale auth epoch',a=>{a.evidence.auth.authEpoch='b'.repeat(32)});
 await denied('wrong firebase project',a=>{a.evidence.auth.firebaseProjectId='other'});
 await denied('missing complete cutover',a=>{a.evidence.cutover.completeBeforeFirstAcceptedOperation=false});
 await denied('legacy writer bypass',a=>{a.evidence.cutover.legacyWriterCoverageProven=false});
 await denied('deletion/retention policy unknown',a=>{a.evidence.cutover.userDeletionLifecycleReviewed=false});
 await denied('D1 SQL 503 before commit',a=>{a.evidence.d1.committed=false});
 await denied('no immutable D1 operation',a=>{a.evidence.d1.immutableOperationIdProof=false});
 await denied('D1 latest state alone',a=>{a.evidence.d1.source='LATEST_PAIR_SNAPSHOT'});
 await denied('D1 revision older than expected',a=>{a.evidence.d1.revision=17});
 await denied('D1 same state but wrong request',a=>{a.evidence.d1.canonicalOperationId='differentOperationId00000001'});
 await denied('D1 changed to opposite follow state',a=>{a.evidence.d1.following=false});
 await denied('R2 accepted but not settled',a=>{a.evidence.r2.projectionSettled=false});
 await denied('R2 only latest intent not immutable',a=>{a.evidence.r2.immutableOperationIdProof=false});
 await denied('R2 from other operation',a=>{a.evidence.r2.actorUid='otherQAActor'});
 await denied('R2 inconsistent D1 revision',a=>{a.evidence.r2.d1CommittedRevision=19});
 await denied('R2 prior revision not advanced',a=>{a.evidence.r2.revision=41});
 await denied('missing history after DO PITR',a=>{a.evidence.history=undefined});
 await denied('history is not complete',a=>{a.evidence.history.completeFromOrigin=false});
 await denied('ledger missing old writer',a=>{a.evidence.history.legacyWriterCoverageProven=false});
 await denied('ledger only latest pair',a=>{a.evidence.history.source='LATEST_PAIR'});
 await denied('older committed operation',a=>{a.evidence.history.committedD1Revision=17});
 await denied('not committed',a=>{a.evidence.history.operationStatus='never-seen'});
 await denied('history stale',a=>{a.evidence.history.completeThroughRevision=17});
 await denied('history tied to restored DO',a=>{a.evidence.history.independentOfOwnerDo=false});
 await denied('no outside revision floor',a=>{a.evidence.checkpoint=null});
 await denied('DO rollback floor behind D1',a=>{a.evidence.checkpoint.minD1Revision=17});
 await denied('DO rollback floor behind R2',a=>{a.evidence.checkpoint.minR2Revision=41});
 await denied('owner generation floor changed',a=>{a.evidence.checkpoint.authEpoch='b'.repeat(32)});
 await denied('R2 owner changed epoch',a=>{a.evidence.r2.authEpoch='c'.repeat(32)});
 await denied('cutover token mismatch',a=>{a.evidence.cutover.cutoverToken='another_cutover'});
 console.log('APP770_SOURCE_ONLY_OFF_DEFAULT=PASS');
 console.log('APP770_EXACT_SETTLED_PROOF_SHAPE_MATCHED_NO_REPLAY=PASS');
 console.log('APP770_UNCERTAIN_D1_R2_AUTH_HISTORY_DO_PITR_FAIL_CLOSED=PASS');
 console.log('APP770_SERVER_READS_WRITES=0; PRODUCTION_DEPLOY=0; TEST_CASES='+checked);
 console.log('APP770_ACTUAL_PRODUCTION_CALLBACK_AND_AUTORECOVERY=NOT_TESTED_HOLD');
}finally{globalThis.fetch=originalFetch;}

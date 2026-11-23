// APP784 isolated QA-only gate: two envelopes, same ID, W1, ABA and 503.
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createApp784QaUnifiedFollow,APP784_QA_UNIFIED_COMPILED_OPEN}
 from './app784-qa-unified-follow.mjs';
const fetchBefore=globalThis.fetch;
globalThis.fetch=()=>{throw Error('APP784_OFFLINE_NETWORK_FORBIDDEN')};
const token='qa784_cutover_00000000000001';
const ownerUid='qa784Owner',uid='qa784Actor',authEpoch='a'.repeat(32);
const ownerEpoch='b'.repeat(32),env={SORIDRAW_ENVIRONMENT:'isolated-qa'};
const stable=async (revision,desired)=>{
 const a=JSON.stringify([token,uid,ownerUid,revision,desired]);
 const h=new Uint8Array(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(a)));
 return 'owner_follow_579_'+[...h].map(v=>v.toString(16).padStart(2,'0')).join('');
};
const initialId=await stable(1,true);
let current=1,following=false,historyEmpty=true,certified=true;
let stored=null,claim=null,claimed=0,committed=0,settlements=0,reads=0,fault=false;
const evidence=async()=>({
 source:'APP784_SYNTHETIC_QA_ONLY',syntheticOnly:true,
 verifiedActor:{source:'SIGNED_FIREBASE_AUTH_APP_CHECK_775',verified:true,
  firebaseProjectId:'soridraw-app-866a5',uid,authEpoch},
 ownerEnrollment:{source:'TRUSTED_OWNER_ENROLLMENT_775',verified:true,
  ownerUid,ownerAuthEpoch:ownerEpoch,enrolled:true,
  ownerDeletionAndUidReuseReviewed:true},
 cutover:{source:'SERVER_COMPLETE_WRITER_CUTOVER_775',verified:certified,
  token,firstRevision:1,completeBeforeFirstAcceptedOperation:true,
  everyActiveWriterCovered:true,everyLegacyWriterCovered:true,
  noLegacyBypassToCanonical:true,fullOwnerDoPitrCannotBypass:true,
  authDeletionLifecycleReviewed:true,previewTestProdCompatibilityReviewed:true},
 serverIdentity:{source:'TRUSTED_EXACT_SERVER_PAIR_IDENTITY_775',verified:true,
  ownerUid,actorUid:uid,authEpoch,ownerAuthEpoch:ownerEpoch,
  cutoverToken:token,expectedRevision:current,
  canonicalOperationId:await stable(current,true),serverIssuedOrVerified:true},
 pair:{source:'TRUSTED_EXACT_PAIR_REVISION_775',verified:true,
  ownerUid,actorUid:uid,authEpoch,ownerAuthEpoch:ownerEpoch,
  revision:current,following},
 pendingFence:{source:'INDEPENDENT_PAIR_PENDING_FENCE_775',
  verified:true,independentOfOwnerDo:true,ownerUid,actorUid:uid,authEpoch,
  canonicalOperationId:await stable(current,true),
  noEarlierPendingOperation:true,noLaterWriterBypass:true,
  allLegacyWritersCovered:true,fullOwnerDoPitrProtected:true},
 legacySafeFirstOperation:current===1&&historyEmpty,
 legacyHistoryInitiallyEmpty:historyEmpty,
});
const router=createApp784QaUnifiedFollow({
 enabled:true,scope:'APP784_ISOLATED_SYNTHETIC_QA',
 getSyntheticServerEvidence:evidence,
 findExactSettledOperation:async p=>{
  reads++;
  if(stored?.canonicalOperationId===p.canonicalOperationId)
   return {status:'verified-read-only',verified:true,...stored};
  return {status:'absent',authoritative:true};
 },
 claimImmutableAdmission:async({ticket})=>{
  claimed++;
  if(fault)throw Error('R2_503');
  if(claim)return {status:'HOLD'};
  claim=ticket;return {status:'ADMISSION_ONLY_NOT_D1_COMMIT',
   requiresCanonicalCommitProof:true,productionDeployAuthorized:false,
   d1AdditionalRowsWritten:0};
 },
 commitExactQaPair:async({ticket})=>{
  if(claim?.canonicalOperationId!==ticket.canonicalOperationId)return null;
  committed++;if(fault)throw Error('D1_ACK_UNKNOWN');
  if(following)return {status:'HOLD'};
  following=true;return {status:'QA784_EXACT_D1_COMMITTED',
   canonicalOperationId:ticket.canonicalOperationId,rowsWritten:1};
 },
 settleImmutableReceipt:async({ticket})=>{
  settlements++;stored={...ticket,ownerAuthEpoch:ownerEpoch};
  return {status:'QA_IMMUTABLE_SETTLED_ONLY',productionDeployAuthorized:false};
 },
});
const run=(body,method='PUT')=>router.handle({env,method,ownerUid,body});
const ordered=(id,rev)=>JSON.stringify({
 followOperationId:id,followExpectedRevision:rev});
const mustHold=async (label,body,reason)=>{
 const result=await run(body);
 assert.equal(result.status,'HOLD',label);
 if(reason)assert.equal(result.reason,reason,label);
 assert.equal(result.productionDeployAuthorized,false);
};
try {
 assert.equal(APP784_QA_UNIFIED_COMPILED_OPEN,false);
 assert.equal(createApp784QaUnifiedFollow(),null);
 assert.throws(()=>createApp784QaUnifiedFollow({enabled:true}));
 await mustHold('bad JSON','{','INVALID_OR_PARTIAL_ENVELOPE');
 await mustHold('partial','{"followOperationId":"x"}','INVALID_OR_PARTIAL_ENVELOPE');
 await mustHold('long',' '.repeat(513),'INVALID_OR_PARTIAL_ENVELOPE');
 const badEnv=await router.handle({env:{SORIDRAW_ENVIRONMENT:'production'},
  method:'PUT',ownerUid,body:'{}'});
 assert.equal(badEnv.status,'HOLD');assert.equal(claimed,0);
 certified=false;
 await mustHold('missing cutover proof','{}','QA_ACTOR_CUTOVER_UNVERIFIED');
 certified=true;fault=true;
 await mustHold('R2 503','{}','R2_ADMISSION_ACK_UNKNOWN');
 assert.equal(committed,0);fault=false;
 let first=await run('{}');
 assert.equal(first.status,'QA784_ONE_SYNTHETIC_CHANGE_SETTLED');
 assert.equal(first.kind,'legacy');assert.equal(first.operationId,initialId);
 assert.equal(first.d1RowsWritten,1);
 assert.equal(first.productionDeployAuthorized,false);
 assert.deepEqual([claimed,committed,settlements],[2,1,1]);
 let duplicate=await run(ordered(initialId,1));
 assert.equal(duplicate.status,'QA784_ORDERED_REPLAY_READ_ONLY');
 assert.deepEqual([claimed,committed,settlements],[2,1,1]);
 await mustHold('old empty after settled','{}','NO_CHANGE_WITHOUT_SETTLED_RECEIPT');
 // One empty request after follow+unfollow is ambiguous: must not turn into
 // a fresh follow merely by reading a newer pair revision.
 current=3;following=false;historyEmpty=false;stored=null;claim=null;
 await mustHold('old delayed ABA','{}','LEGACY_ABA_REPLAY_AMBIGUOUS');
 assert.deepEqual([claimed,committed,settlements],[2,1,1]);
 // On a fresh isolated pair, ordered format takes the SAME path.
 current=1;following=false;historyEmpty=true;
 first=await run(ordered(initialId,1));
 assert.equal(first.status,'QA784_ONE_SYNTHETIC_CHANGE_SETTLED');
 assert.equal(first.kind,'ordered');assert.equal(first.operationId,initialId);
 assert.deepEqual([claimed,committed,settlements],[3,2,2]);
 duplicate=await run(ordered(initialId,1));
 assert.equal(duplicate.status,'QA784_ORDERED_REPLAY_READ_ONLY');
 assert.deepEqual([claimed,committed,settlements],[3,2,2]);
 await mustHold('wrong ordered ID',
  ordered('qa784_wrong_operation_id_1234',1),
  'APP775_COMMON_IDENTITY_FENCE_UNPROVEN');
 assert.equal(claimed,3);
 console.log('APP784_LEGACY_AND_ORDERED_SAME_ID_SAME_QA_W1=PASS');
 console.log('APP784_ORDERED_IMMUTABLE_REPLAY_R0_W0=PASS');
 console.log('APP784_UNVERSIONED_ABA_AFTER_UNFOLLOW_HOLD=PASS');
 console.log('APP784_503_NO_RETRY_INVALID_ENVELOPE_HOLD=PASS');
 console.log('APP784_ACTUAL_PRODUCTION_WRITERS_GLOBAL_CUTOVER=NOT_TESTED');
}finally{globalThis.fetch=fetchBefore}

// APP788: isolated QA composition of the existing APP767 create-once intent,
// APP783 immutable settlement, and a per-owner R2 CAS revision floor.
// Deliberately NOT importable into the active Worker/PRODUCTION bundle.
// The independent floor survives a full owner-DO PITR but is not a substitute
// for a proved all-writers cutover or verified long-term erasure/retention.
import {createApp767IsolatedR2Admission} from './app767-r2-admission-candidate.mjs';
import {createApp783QaSettledHistory} from './app783-qa-immutable-settled-history.mjs';
export const APP788_QA_OWNER_HISTORY_DO_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/,ID=/^[A-Za-z0-9_-]{16,128}$/,EPOCH=/^[a-f0-9]{32}$/;
const rev=n=>Number.isSafeInteger(n)&&n>=0;
const hold=reason=>Object.freeze({status:'HOLD',reason,canonicalWriteAuthorized:false,
 ownerDoReserveAuthorized:false,ownerRelayAuthorized:false,productionDeployAuthorized:false});
const hash=async a=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',
 new TextEncoder().encode(JSON.stringify(a))))].map(v=>v.toString(16).padStart(2,'0')).join('');
const valid=a=>a&&UID.test(a.ownerUid||'')&&UID.test(a.actorUid||'')&&
 a.actorUid!==a.ownerUid&&ID.test(a.canonicalOperationId||'')&&
 EPOCH.test(a.authEpoch||'')&&typeof a.cutoverToken==='string'&&
 a.cutoverToken.length>=16&&a.cutoverToken.length<=128&&
 rev(a.expectedRevision)&&rev(a.priorR2Revision)&&typeof a.desired==='boolean'&&
 typeof a.beforeFollowing==='boolean'&&a.beforeFollowing!==a.desired;
const exact=(a,b)=>a&&b&&a.ownerUid===b.ownerUid&&a.actorUid===b.actorUid&&
 a.canonicalOperationId===b.canonicalOperationId&&
 a.authEpoch===b.authEpoch&&a.cutoverToken===b.cutoverToken&&
 a.expectedRevision===b.expectedRevision&&a.desired===b.desired;
const data=async obj=>{
 if(!obj)return null;
 const text=await obj.text();
 if(text.length>2048)throw Error('R2_OBJECT_OVERSIZED');
 const v=JSON.parse(text);
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('R2_OBJECT_INVALID');
 return v;
};
const certificate=(p,a)=>p?.source==='APP788_ISOLATED_SYNTHETIC_EPOCH_CERT'&&
 p.verified===true&&p.ownerUid===a.ownerUid&&p.actorUid===a.actorUid&&
 p.authEpoch===a.authEpoch&&p.cutoverToken===a.cutoverToken&&
 p.allActiveAndLegacyWritersCovered===true&&p.newEpochFromVerifiedGenesis===true&&
 p.noHistoricalNamespaceReuse===true&&p.ownerDoPitrIndependent===true&&
 p.retentionAndAccountDeletionReviewed===true&&
 p.physicalNamespaceIsolatedFromProduction===true&&
 rev(p.firstD1Revision)&&rev(p.firstR2Revision);
const validPending=p=>p===null||(p&&typeof p==='object'&&
 ID.test(p.canonicalOperationId||'')&&UID.test(p.actorUid||'')&&
 rev(p.expectedRevision)&&typeof p.desired==='boolean');
const floorValid=(f,a)=>f?.kind==='APP788_QA_OWNER_FLOOR_V1'&&
 f.ownerUid===a.ownerUid&&f.authEpoch===a.authEpoch&&
 f.cutoverToken===a.cutoverToken&&rev(f.d1Revision)&&rev(f.r2Revision)&&
 validPending(f.pending)&&
 typeof f.lastOperationId==='string'&&
 (f.lastOperationId===''||ID.test(f.lastOperationId));
const floorObj=(a,d1,r2,id='')=>({kind:'APP788_QA_OWNER_FLOOR_V1',
 ownerUid:a.ownerUid,authEpoch:a.authEpoch,cutoverToken:a.cutoverToken,
 d1Revision:d1,r2Revision:r2,lastOperationId:id,pending:null});
const options=onlyIf=>({onlyIf,httpMetadata:{contentType:'application/json'}});
export function createApp788QaOwnerHistoryWithDo({
 enabled=APP788_QA_OWNER_HISTORY_DO_COMPILED_OPEN,
 scope,bucket,ownerDo,verifyTrustedEpoch,verifySettledCanonical,
}={}){
 if(enabled!==true)return null;
 if(scope!=='APP788_ISOLATED_SYNTHETIC_QA'||!bucket||
  typeof bucket.get!=='function'||typeof bucket.put!=='function'||
  !ownerDo||typeof ownerDo.find!=='function'||typeof ownerDo.reserve!=='function'||
  typeof verifyTrustedEpoch!=='function'||typeof verifySettledCanonical!=='function')
  throw Error('APP788_REQUIRES_ISOLATED_QA_AND_REAL_R2_DO_ADAPTERS');
 const env={SORIDRAW_ENVIRONMENT:'isolated-qa'};
 const keys=async a=>({
  floor:'internal/qa788/owner-floor/'+await hash([a.cutoverToken,a.ownerUid,a.authEpoch]),
  admission:'internal/qa767/owner-follow-admissions/'+await hash([
   a.cutoverToken,a.ownerUid,a.actorUid,a.authEpoch,a.canonicalOperationId]),
  settled:'internal/qa783/owner-follow-settled/'+await hash([
   a.cutoverToken,a.ownerUid,a.actorUid,a.authEpoch,a.canonicalOperationId]),
 });
 async function guard(a){
  if(!valid(a))throw Error('BAD_OPERATION');
  const proof=await verifyTrustedEpoch(a);
  if(!certificate(proof,a))throw Error('EPOCH_OR_LEGACY_WRITER_CERTIFICATE_UNVERIFIED');
  return proof;
 }
 const claim=createApp767IsolatedR2Admission({
  enabled:true,scope:'APP767_ISOLATED_SYNTHETIC_QA',bucket,
  verifyTrustedCutover:async a=>{
   const p=await guard({...a,priorR2Revision:0,beforeFollowing:!a.desired});
   return {source:'SERVER_ATTESTED_NEW_EPOCH_ONLY_767',verified:true,
    ...a,completeBeforeFirstAcceptedOperation:p.newEpochFromVerifiedGenesis,
    canonicalWriterCoverageProven:p.allActiveAndLegacyWritersCovered,
    noLegacyIdNamespaceOverlap:p.noHistoricalNamespaceReuse,
    userDeletionLifecycleReviewed:p.retentionAndAccountDeletionReviewed,
    isolationFromOwnerDoPitrProven:p.ownerDoPitrIndependent};
  },
 });
 const settled=createApp783QaSettledHistory({enabled:true,
  scope:'APP783_ISOLATED_SYNTHETIC_QA',bucket,
  verifySettledCanonical});
 async function floorRead(a){
  const k=(await keys(a)).floor;
  const raw=await bucket.get(k);
  if(!raw)return {status:'absent',key:k};
  const value=await data(raw);
  if(!floorValid(value,a)||typeof raw.etag!=='string'||!raw.etag)
   throw Error('FLOOR_CORRUPT_OR_ETAG_MISSING');
  return {status:'found',key:k,value,etag:raw.etag};
 }
 const ready=Object.freeze({productionDeployAuthorized:false,
  additionalD1RowsWritten:0,realOwnerWorkerDeployed:false,
  fullHistoryFromAllPastClientsVerified:false});
 return Object.freeze({
  // One-time genesis for a *new verified namespace* only. Existing user
  // history is NOT silently backfilled or labeled complete-from-origin.
  async bootstrap(a){
   try{
    const p=await guard(a),f=await floorRead(a);
    const initial=floorObj(a,p.firstD1Revision,p.firstR2Revision);
    if(f.status==='found'){
     if(JSON.stringify(f.value)!==JSON.stringify(initial))
      return hold('GENESIS_ALREADY_ADVANCED_OR_CONFLICT');
     return {status:'QA788_GENESIS_ALREADY_VERIFIED_READ_ONLY',...ready};
    }
    let w;
    try{w=await bucket.put(f.key,JSON.stringify(initial),
      options({etagDoesNotMatch:'*'}));}
    catch{return hold('GENESIS_R2_ACK_UNCERTAIN')}
    if(!w?.etag)return hold('GENESIS_R2_WRITE_REJECTED_OR_UNCERTAIN');
    return {status:'QA788_SYNTHETIC_GENESIS_FLOOR_CREATED',...ready};
   }catch{return hold('GENESIS_CUTOVER_OR_FLOOR_UNVERIFIED')}
  },
  async reserve(a){
   try{
    await guard(a);
    const f=await floorRead(a);
    if(f.status!=='found'||f.value.d1Revision!==a.expectedRevision||
       f.value.r2Revision!==a.priorR2Revision)
      return hold('EXTERNAL_REVISION_FLOOR_NOT_AT_EXPECTED');
    const k=await keys(a);
    if(await bucket.get(k.admission)||await bucket.get(k.settled))
     return hold('EXACT_OPERATION_ALREADY_ADMITTED_OR_SETTLED');
    const found=await ownerDo.find(a);
    if(found?.status!=='absent'||found.authoritative!==true||
       found.ownerUid!==a.ownerUid||found.actorUid!==a.actorUid||
       found.canonicalOperationId!==a.canonicalOperationId)
     return hold('DO_RECEIPT_NOT_AUTHORITATIVELY_ABSENT');
    // Atomic owner-floor CAS is a single-flight fence shared by distinct
    // operation IDs for the same expected revision, including after DO PITR.
    // An uncertain CAS holds: no admission, DO or D1 operation may follow.
    const pending={actorUid:a.actorUid,canonicalOperationId:a.canonicalOperationId,
      expectedRevision:a.expectedRevision,desired:a.desired};
    if(f.value.pending!==null){
      // Same ID can resume only when its immutable admission AND DO
      // receipt are both authoritatively absent (checked above). This
      // repairs a lost ACK for the floor CAS without inventing a new ID.
      const prior=f.value.pending;
      if(prior.actorUid!==pending.actorUid||
         prior.canonicalOperationId!==pending.canonicalOperationId||
         prior.expectedRevision!==pending.expectedRevision||
         prior.desired!==pending.desired)
        return hold('OWNER_REVISION_HAS_DIFFERENT_PENDING_OPERATION');
    }else{
      let locked;
      try{locked=await bucket.put(f.key,JSON.stringify({...f.value,pending}),
         options({etagMatches:f.etag}));}
      catch{return hold('PENDING_FLOOR_CAS_ACK_UNKNOWN')}
      if(!locked?.etag)return hold('PENDING_FLOOR_CONCURRENT_CAS_OR_UNKNOWN');
    }
    const entry=await claim.claim({env,reservation:a});
    if(entry.status!=='ADMISSION_ONLY_NOT_D1_COMMIT')
     return hold('R2_ADMISSION_DUPLICATE_OR_OUTCOME_UNKNOWN');
    let receipt;
    try{receipt=await ownerDo.reserve(a)}catch{
     return hold('DO_RESERVE_UNKNOWN_AFTER_IMMUTABLE_R2_ADMISSION');
    }
    if(receipt?.durable!==true||receipt.ownerDoAlarmScheduled!==true||
       !exact(receipt,a)||!ID.test(receipt.operationId||'')||
       receipt.operationId===a.canonicalOperationId)
     return hold('DO_ATOMIC_RECEIPT_UNVERIFIED_AFTER_ADMISSION');
    return {status:'QA788_ADMITTED_AND_OWNER_DO_RESERVED',
     admission:entry,receipt,precommitOnly:true,
     canonicalCommitNotYetProven:true,...ready};
   }catch{return hold('R2_OR_TRUSTED_EPOCH_UNAVAILABLE')}
  },
  // Called ONLY after the canonical D1 mutation and the R2 projection are
  // independently proven for this exact operation. Never does D1 writes.
  // An uncertain floor CAS may be retried after an exact settled proof,
  // but canonical D1 must NEVER be executed again.
  async finalize({operation:a,admission,receipt}={}){
   try{
    await guard(a);
    if(!exact(receipt,a)||receipt.durable!==true||
       receipt.ownerDoAlarmScheduled!==true||!ID.test(receipt.operationId||'')||
       admission?.status!=='ADMISSION_ONLY_NOT_D1_COMMIT')
     return hold('RECEIPT_OR_ADMISSION_NOT_BOUND');
    const settledResult=await settled.settle({env,operation:a,admission});
    if(!['QA_IMMUTABLE_SETTLED_ONLY','EXACT_QA_SETTLED_REPLAY_READ_ONLY']
      .includes(settledResult.status))return hold('EXACT_CANONICAL_SETTLEMENT_NOT_PROVEN');
    const proof=await verifySettledCanonical(a);
    if(proof?.source!=='QA783_EXACT_D1_R2_SETTLED'||
       proof.verified!==true||proof.canonicalD1Committed!==true||
       proof.r2ProjectionSettled!==true||proof.ownerEpochVerified!==true||
       !exact(proof,a)||!rev(proof.committedRevision)||
       proof.committedRevision<=a.expectedRevision||
       !rev(proof.nextR2Revision)||proof.nextR2Revision<=a.priorR2Revision||
       proof.d1OperationId!==a.canonicalOperationId||
       proof.r2OperationId!==a.canonicalOperationId)
     return hold('EXACT_POSTCOMMIT_D1_R2_PROOF_UNAVAILABLE');
    const f=await floorRead(a);
    if(f.status!=='found')return hold('OWNER_FLOOR_MISSING_AFTER_SETTLEMENT');
    if(f.value.d1Revision===proof.committedRevision&&
       f.value.r2Revision===proof.nextR2Revision&&f.value.pending===null&&
       f.value.lastOperationId===a.canonicalOperationId)
     return {status:'QA788_FLOOR_ALREADY_SETTLED_NO_WRITE',
       canonicalRetryAuthorized:false,ownerDoAlarmMayVerifyExternal:true,...ready};
    if(f.value.d1Revision!==a.expectedRevision||
       f.value.r2Revision!==a.priorR2Revision)
     return hold('EXTERNAL_FLOOR_AHEAD_OR_CONCURRENT_COMMIT');
    const pending=f.value.pending;
    if(pending?.canonicalOperationId!==a.canonicalOperationId||
       pending.actorUid!==a.actorUid||pending.expectedRevision!==a.expectedRevision||
       pending.desired!==a.desired)
     return hold('EXPECTED_PENDING_OWNER_FLOOR_FENCE_MISSING');
    let saved;
    try{saved=await bucket.put(f.key,JSON.stringify(floorObj(a,
      proof.committedRevision,proof.nextR2Revision,a.canonicalOperationId)),
      options({etagMatches:f.etag}));}
    catch{return hold('R2_FLOOR_CAS_ACK_UNKNOWN')}
    if(!saved?.etag)return hold('R2_FLOOR_CONCURRENT_CAS_OR_ACK_UNKNOWN');
    return {status:'QA788_IMMUTABLE_SETTLED_AND_FLOOR_ADVANCED',
      canonicalRetryAuthorized:false,ownerDoAlarmMayVerifyExternal:true,...ready};
   }catch{return hold('FLOOR_OR_EXACT_CANONICAL_READ_UNAVAILABLE')}
  },
  async inspect(a){
   try{
    await guard(a);const f=await floorRead(a),k=await keys(a);
    if(f.status!=='found')return hold('FLOOR_ABSENT');
    const admission=await bucket.get(k.admission);
    const settled=await bucket.get(k.settled);
    // An absent exact key can never be called never-seen without full
    // writer coverage/retention proof and a matching external floor.
    return {status:'QA788_READ_ONLY_HISTORY',
      floorD1Revision:f.value.d1Revision,floorR2Revision:f.value.r2Revision,
      admitted:!!admission,settled:!!settled,pending:!!f.value.pending,
      completeFromOrigin:false,automaticReplayAuthorized:false,...ready};
   }catch{return hold('HISTORY_READ_OR_CUTOVER_UNAVAILABLE')}
  },
 });
}

// APP783: isolated QA implementation of an immutable, operation-scoped
// settled-follow receipt. Never used by a live or shared canonical Writer.
// Existing APP767 admission is required; R2 settlement alone is NOT a
// complete history, owner revision floor or automatic-retry permission.
export const APP783_QA_SETTLED_HISTORY_COMPILED_OPEN = false;
const OP = /^[A-Za-z0-9_-]{16,128}$/;
const UID = /^[A-Za-z0-9_-]{1,128}$/;
const EPOCH = /^[a-f0-9]{32}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const revision = n => Number.isSafeInteger(n) && n >= 0;
const deny = reason => Object.freeze({status:'HOLD',reason,
  canonicalWriteAuthorized:false,ownerDoReserveAuthorized:false,
  relayAuthorized:false,productionDeployAuthorized:false});
const digest = async values => {
  const raw = new TextEncoder().encode(JSON.stringify(values));
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256',raw));
  return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
};
const canonical = a => a && UID.test(a.ownerUid||'') &&
  UID.test(a.actorUid||'') && a.ownerUid!==a.actorUid &&
  OP.test(a.canonicalOperationId||'') && EPOCH.test(a.authEpoch||'') &&
  typeof a.cutoverToken==='string' && a.cutoverToken.length>=16 &&
  a.cutoverToken.length<=128 && revision(a.expectedRevision) &&
  typeof a.desired==='boolean';
const exact = (a,b) => !!b &&
  ['ownerUid','actorUid','canonicalOperationId','authEpoch',
   'cutoverToken','expectedRevision','desired'].every(key=>a[key]===b[key]);
const parse = async object => {
  if (!object) return null;
  const value=JSON.parse(await object.text());
  if(!value || typeof value!=='object' || Array.isArray(value))return null;
  return value;
};
const isSettled = (op,p) => p?.source==='QA783_EXACT_D1_R2_SETTLED' &&
  p.verified===true && p.changed===true && p.canonicalD1Committed===true &&
  p.r2ProjectionSettled===true && p.ownerEpochVerified===true &&
  exact(op,p) && revision(p.committedRevision) &&
  p.committedRevision>op.expectedRevision &&
  p.d1OperationId===op.canonicalOperationId &&
  p.r2OperationId===op.canonicalOperationId;
export function createApp783QaSettledHistory({
  enabled=APP783_QA_SETTLED_HISTORY_COMPILED_OPEN,
  scope='none',bucket,verifySettledCanonical,
}={}){
  if(enabled!==true)return null;
  if(scope!=='APP783_ISOLATED_SYNTHETIC_QA' ||
     !bucket || typeof bucket.get!=='function' ||
     typeof bucket.put!=='function' ||
     typeof verifySettledCanonical!=='function')
    throw Error('APP783_QA_SCOPE_OR_DEPENDENCIES_REQUIRED');
  async function keys(op){
    const hash=await digest([op.cutoverToken,op.ownerUid,op.actorUid,
      op.authEpoch,op.canonicalOperationId]);
    return {admission:'internal/qa767/owner-follow-admissions/'+hash,
      settled:'internal/qa783/owner-follow-settled/'+hash,hash};
  }
  const sameStored = (op,receipt)=>
    receipt?.kind==='APP783_IMMUTABLE_QA_SETTLED' && exact(op,receipt) &&
    revision(receipt.committedRevision) &&
    receipt.committedRevision>op.expectedRevision &&
    receipt.d1OperationId===op.canonicalOperationId &&
    receipt.r2OperationId===op.canonicalOperationId;
  return Object.freeze({
    async settle({env,operation,admission}={}){
      if(env?.SORIDRAW_ENVIRONMENT!=='isolated-qa'||!canonical(operation))
        return deny('QA_ENVIRONMENT_OR_OPERATION_UNVERIFIED');
      if(admission?.status!=='ADMISSION_ONLY_NOT_D1_COMMIT'||
         admission?.productionDeployAuthorized!==false||
         admission?.requiresCanonicalCommitProof!==true||
         admission?.d1AdditionalRowsWritten!==0||
         !DIGEST.test(admission?.keyDigest||''))
        return deny('APP767_ADMISSION_UNVERIFIED');
      let k,storedAdmission,existing,proof;
      try{
        k=await keys(operation);
        if(admission.keyDigest!==k.hash)
          return deny('ADMISSION_OPERATION_DIGEST_MISMATCH');
        storedAdmission=await parse(await bucket.get(k.admission));
        if(storedAdmission?.kind!=='APP767_ADMISSION_NOT_CANONICAL_COMMIT'||
           !exact(operation,storedAdmission))
          return deny('IMMUTABLE_ADMISSION_NOT_FOUND_OR_MISMATCH');
        existing=await parse(await bucket.get(k.settled));
      }catch{return deny('R2_EXACT_READ_UNAVAILABLE');}
      // Replayed exact settled receipt is readable, but never a permit to
      // modify canonical state or publish a new owner notification.
      if(existing){
        if(!sameStored(operation,existing))return deny('SETTLED_RECEIPT_CONFLICT');
        // A stored R2 body is not itself an independently verified current
        // canonical fact. In particular, a corrupt/wrong revision must HOLD.
        let replayProof;
        try{replayProof=await verifySettledCanonical(operation);}catch{
          return deny('REPLAY_CANONICAL_PROOF_UNAVAILABLE');
        }
        if(!isSettled(operation,replayProof)||
           replayProof.committedRevision!==existing.committedRevision)
          return deny('REPLAY_EXACT_CANONICAL_REVISION_MISMATCH');
        return Object.freeze({status:'EXACT_QA_SETTLED_REPLAY_READ_ONLY',
          committedRevision:existing.committedRevision,
          canonicalWriteAuthorized:false,ownerDoReserveAuthorized:false,
          relayAuthorized:false,productionDeployAuthorized:false});
      }
      try{proof=await verifySettledCanonical(operation);}catch{
        return deny('CANONICAL_PROOF_UNAVAILABLE');
      }
      if(!isSettled(operation,proof))return deny('EXACT_D1_R2_COMMIT_UNVERIFIED');
      // The exact canonical operation and settled revision must be written
      // once. A null/timeout/503 is UNKNOWN and cannot cause a retry write.
      const receipt={kind:'APP783_IMMUTABLE_QA_SETTLED',
        ownerUid:operation.ownerUid,actorUid:operation.actorUid,
        canonicalOperationId:operation.canonicalOperationId,
        authEpoch:operation.authEpoch,cutoverToken:operation.cutoverToken,
        expectedRevision:operation.expectedRevision,desired:operation.desired,
        committedRevision:proof.committedRevision,
        d1OperationId:proof.d1OperationId,r2OperationId:proof.r2OperationId};
      let saved;
      try{saved=await bucket.put(k.settled,JSON.stringify(receipt),{
        onlyIf:{etagDoesNotMatch:'*'},
        httpMetadata:{contentType:'application/json'},
      });}catch{return deny('SETTLED_WRITE_OUTCOME_UNKNOWN');}
      if(!saved||typeof saved.etag!=='string'||!saved.etag)
        return deny('SETTLED_WRITE_OUTCOME_UNKNOWN');
      return Object.freeze({status:'QA_IMMUTABLE_SETTLED_ONLY',
        committedRevision:proof.committedRevision,
        additionalD1RowsWritten:0,additionalR2ClassAOperations:1,
        completeHistoryFromOrigin:false,ownerRevisionFloorVerified:false,
        allLegacyWritersCovered:false,automaticRecoveryAuthorized:false,
        canonicalWriteAuthorized:false,ownerDoReserveAuthorized:false,
        relayAuthorized:false,productionDeployAuthorized:false});
    },
  });
}

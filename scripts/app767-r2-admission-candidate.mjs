// APP767 — SOURCE-ONLY, QA-SYNTHETIC R2 create-once admission escrow.
// NOT a canonical commit ledger, NOT a real APP765 trusted history callback.
// Never import or activate in any PREVIEW/TEST/PRODUCTION Worker. This fixture
// intentionally accepts only the isolated, in-memory QA scope.
export const APP767_R2_ADMISSION_COMPILED_OPEN=false;
const ID=/^[A-Za-z0-9_-]{16,128}$/;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const EPOCH=/^[a-f0-9]{32}$/;
const rev=x=>Number.isSafeInteger(x)&&x>=0;
const fail=reason=>({status:'HOLD',reason,d1AdditionalRowsWritten:0});
const hash=async v=>{
 const digest=await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(JSON.stringify(v)));
 return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
};
const verify=a=>!!a&&UID.test(a.ownerUid||'')&&UID.test(a.actorUid||'')&&
 a.actorUid!==a.ownerUid&&ID.test(a.canonicalOperationId||'')&&
 EPOCH.test(a.authEpoch||'')&&
 typeof a.cutoverToken==='string'&&a.cutoverToken.length>=16&&
 a.cutoverToken.length<=128&&rev(a.expectedRevision)&&
 typeof a.desired==='boolean';
const attest=(p,a)=>p?.source==='SERVER_ATTESTED_NEW_EPOCH_ONLY_767'&&
 p?.verified===true&&p?.ownerUid===a.ownerUid&&
 p?.actorUid===a.actorUid&&p?.authEpoch===a.authEpoch&&
 p?.cutoverToken===a.cutoverToken&&
 p?.completeBeforeFirstAcceptedOperation===true&&
 p?.canonicalWriterCoverageProven===true&&
 p?.noLegacyIdNamespaceOverlap===true&&
 p?.userDeletionLifecycleReviewed===true&&
 p?.isolationFromOwnerDoPitrProven===true&&
 p?.expectedRevision===a.expectedRevision;
// This is *admission* evidence only. It can never say D1 'committed' or
// APP765 'completeFromOrigin' on its own. A real backend still needs exact
// D1/R2 settle proof, Auth epoch and a separate monotonic revision floor.
export function createApp767IsolatedR2Admission({
 enabled=APP767_R2_ADMISSION_COMPILED_OPEN,
 bucket,verifyTrustedCutover,
 scope='none',
}={}){
 if(enabled!==true)return null;
 if(scope!=='APP767_ISOLATED_SYNTHETIC_QA'||
    typeof bucket?.put!=='function'||
    typeof verifyTrustedCutover!=='function')
  throw Error('APP767_OFF_SCOPE_OR_DEPENDENCIES_REQUIRED');
 return {
  async claim({env,reservation}={}){
   if(env?.SORIDRAW_ENVIRONMENT!=='isolated-qa'||!verify(reservation))
    return fail('SCOPE_OR_RESERVATION_UNVERIFIED');
   let proof;
   try{proof=await verifyTrustedCutover(reservation);}
   catch{return fail('INDEPENDENT_EPOCH_CUTOVER_UNAVAILABLE');}
   if(!attest(proof,reservation))
    return fail('INDEPENDENT_EPOCH_CUTOVER_UNPROVEN');
   // The key never contains raw UID/token. No bucket.list(), get() or
   // deletion is needed on the changed admission hot path.
   const key='internal/qa767/owner-follow-admissions/'+
    await hash([reservation.cutoverToken,reservation.ownerUid,
     reservation.actorUid,reservation.authEpoch,
     reservation.canonicalOperationId]);
   const payload=JSON.stringify({
    version:1,kind:'APP767_ADMISSION_NOT_CANONICAL_COMMIT',
    ownerUid:reservation.ownerUid,actorUid:reservation.actorUid,
    authEpoch:reservation.authEpoch,
    canonicalOperationId:reservation.canonicalOperationId,
    cutoverToken:reservation.cutoverToken,
    expectedRevision:reservation.expectedRevision,
    desired:reservation.desired,
   });
   try{
    const written=await bucket.put(key,payload,{
     onlyIf:{etagDoesNotMatch:'*'},
     httpMetadata:{contentType:'application/json'},
    });
    if(written===null)return fail('PRIOR_OR_CONCURRENT_CLAIM_REQUIRES_RECONCILIATION');
    if(!written||typeof written.etag!=='string'||!written.etag)
     return fail('INDETERMINATE_CLAIM_ACK');
    return {status:'ADMISSION_ONLY_NOT_D1_COMMIT',keyDigest:key.split('/').pop(),
     d1AdditionalRowsWritten:0,additionalR2ClassAOperations:1,
     requiresCanonicalCommitProof:true,productionDeployAuthorized:false};
   }catch{
    // A timeout might occur AFTER R2 accepted this key; never create a
    // second canonical reservation on the assumption it did not write.
    return fail('CLAIM_OUTCOME_UNCERTAIN');
   }
  },
 };
}
export function compareApp767HistoryOptions({
 canonicalD1RowsWrittenBaseline,appendOnlyD1LedgerRows=1,
 r2ClassAOverageUSDPerMillion=4.5,r2ClassBOverageUSDPerMillion=0.36,
 yearlyOperationsPerOwner=50,owners=100000,bytesPerR2Record=350,
}={}){
 if(![canonicalD1RowsWrittenBaseline,appendOnlyD1LedgerRows,yearlyOperationsPerOwner,
    owners,bytesPerR2Record].every(v=>Number.isSafeInteger(v)&&v>=0)||
    canonicalD1RowsWrittenBaseline>10||appendOnlyD1LedgerRows<1||
    yearlyOperationsPerOwner>1_000_000||owners>10_000_000)
  throw Error('APP767_COST_INPUT_UNVERIFIED');
 const total=owners*yearlyOperationsPerOwner;
 if(!Number.isSafeInteger(total))throw Error('APP767_COST_OVERFLOW');
 const perMonth=total/12;
 // This is a 12-month end storage approximation; Cloudflare bills average
 // GB-month. Shared account free allocation may be exhausted elsewhere.
 const volumeGB=total*bytesPerR2Record/1e9;
 const classAUSD=Math.ceil(Math.max(0,perMonth-1e6)/1e6)*r2ClassAOverageUSDPerMillion;
 const classBUSD=Math.ceil(Math.max(0,perMonth-1e7)/1e6)*r2ClassBOverageUSDPerMillion;
 const storageUSD=Math.ceil(Math.max(0,volumeGB-10))*0.015;
 return {
  status:'HYPOTHETICAL_NOT_BILLING_PROOF',
  d1AppendOnlyLedger:{
   estimatedMinRowsWritten:canonicalD1RowsWrittenBaseline+
    appendOnlyD1LedgerRows,
   withinW1W2:canonicalD1RowsWrittenBaseline+appendOnlyD1LedgerRows<=2,
   actualIndexedD1RowsWritten:'REQUIRES_INDEPENDENT_PHYSICAL_QA',
   sameD1TransactionPossibleButSchemaMigrationRequired:true,
  },
  r2Admission:{
   newClassAOperationsPerChange:1,
   existingClaimsStillClassAOnConditional412:true,
   additionalD1RowsWritten:0,
   endYearStorageGB:Math.round(volumeGB*1000)/1000,
   estimatedMonthlyNewClassA:Math.round(perMonth),
   paidOverageClassAUSD:Math.round(classAUSD*100)/100,
   paidOverageClassBUSD:Math.round(classBUSD*100)/100,
   paidOverageStorageUSD:Math.round(storageUSD*100)/100,
   additionalR2WritesMayBeBilledForPreconditionFail:true,
   livePitrProof:false,legacyHistoryCoverage:false,
   atomicWithCanonicalD1Commit:false,
  },
  productionDeployAuthorized:false,
 };
}

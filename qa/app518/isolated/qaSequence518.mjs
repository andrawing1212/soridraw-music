// APP518 one-song QA sequencing contract. No actual cloud adapter is bundled.
// A trusted bounded QA controller must implement these exact adapters only
// after verified release proof, isolated Worker/function staging and D1 schema.
import {
  QA518,assertQaProof518,createQaMeter518,seedEmptyQa518,cleanupQaR2518,
} from './qaGate518.mjs';

const fail=code=>{throw new Error(code);};
const NS=/^[0-9]{21}$/;
const kind=['saved','removed','saved'];
const versionNs=source=>{
  if(source?.origin!=='server-exact-read'||source.verifiedByServer!==true)
    fail('HOLD_QA_NOT_SERVER_CANONICAL');
  const m=/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?Z$/.exec(
    source.updateTime||'');
  if(!m)fail('HOLD_QA_BAD_SOURCE_TIME');
  const ms=Date.parse(m[1]+'Z');
  if(!Number.isSafeInteger(ms)||ms<=0||
    new Date(ms).toISOString().slice(0,19)!==m[1])
    fail('HOLD_QA_BAD_SOURCE_TIME');
  return (BigInt(ms)*1000000n+
    BigInt((m[2]||'').padEnd(9,'0')||'0')).toString().padStart(21,'0');
};
const checkSource=(source,pilot,expectedState,previous)=>{
  if(source?.uid!==pilot.uid||source.documentId!==pilot.documentId
    ||source.state!==expectedState)
    fail('HOLD_QA_WRONG_OWNER_DOCUMENT_OR_STATE');
  const version=versionNs(source);
  if(!NS.test(version)||version<=previous)
    fail('HOLD_QA_NONMONOTONIC_SOURCE_VERSION');
  return version;
};
const checkAck=(receipt,pilot,version,expectedState)=>{
  if(receipt?.uid!==pilot.uid||receipt.documentId!==pilot.documentId
    ||receipt?.sourceVersionNs!==version
    ||receipt?.d1AckVersionNs!==version
    ||receipt?.r2SourceVersionNs!==version
    ||receipt?.r2State!==expectedState
    ||receipt?.r2MembershipPresent!==(expectedState==='saved'))
    fail('HOLD_QA_R2_ACK_NOT_EXACT_SERVER_VERSION');
};
const expectedFunctions=[
 'applyCanonical','dispatchSigned','inspectExact','retryOnce',
 'injectOneR2Failure','stopExactTempWorker','cleanupPilotD1',
 'inspectCleanup','cleanupPilotFirestore',
];
export async function runBoundedQaOneSong518({
 proof,bucket,actions,now=Date.now,
}={}){
  assertQaProof518(proof,now());
  if(!actions||expectedFunctions.some(x=>typeof actions[x]!=='function')
    ||!bucket?.get||!bucket?.put||!bucket?.delete)
    fail('HOLD_QA_LIVE_ADAPTERS_NOT_INSTALLED');
  const budget=createQaMeter518(proof,{now});
  const pilot=proof.pilot;
  let workerTouched=false;
  let finished=false;
  let latest='000000000000000000000';
  let stage='UNSTARTED';
  const apply=async(state,index)=>{
    stage='MUTATE_'+index;
    budget.reserve('firestoreWrites',state==='removed'?2:1);
    const source=await actions.applyCanonical({
      uid:pilot.uid,documentId:pilot.documentId,
      state,mode:state==='removed'?'verified-hard-delete-receipt':'exact-pilot-save',
      previousVersionNs:latest,
    });
    const current=checkSource(source,pilot,state,latest);
    latest=current;
    budget.reserve('d1RowsWritten',24);
    budget.reserve('r2Reads',8);
    budget.reserve('r2Writes',1);
    budget.reserve('httpRequests',1);
    if(index===2){
      stage='INJECT_SINGLE_R2_FAILURE';
      budget.reserve('httpRequests',1);
      await actions.injectOneR2Failure({uid:pilot.uid,documentId:pilot.documentId});
    }
    stage='DISPATCH_'+index;
    const result=await actions.dispatchSigned({
      uid:pilot.uid,documentId:pilot.documentId,source,sourceVersionNs:current,
      oneRequestOnly:true,
    });
    if(result?.sourceVersionNs!==current)
      fail('HOLD_QA_DISPATCH_VERSION_MISMATCH');
    if(index===2){
      if(result.code!=='PERSISTED_RETRY_PENDING'||result.r2Acked!==false)
        fail('HOLD_QA_FAULT_INJECTION_NOT_OBSERVED');
      stage='RETRY_ONCE_AFTER_DEADLINE';
      budget.reserve('d1RowsWritten',16);
      budget.reserve('r2Reads',4);
      budget.reserve('r2Writes',1);
      budget.reserve('httpRequests',1);
      const retry=await actions.retryOnce({uid:pilot.uid,documentId:pilot.documentId,
        sourceVersionNs:current,onlyAfterPersistedDeadline:true,maxAttempts:1});
      if(retry?.code!=='EXACT_R2_ACKED')
        fail('HOLD_QA_BOUNDED_RETRY_DID_NOT_ACK');
    }else if(result.code!=='EXACT_R2_ACKED'){
      fail('HOLD_QA_REQUEST_NOT_ACKED');
    }
    stage='INSPECT_'+index;
    const actual=await actions.inspectExact({uid:pilot.uid,documentId:pilot.documentId});
    checkAck(actual,pilot,current,state);
    return {version:current,state};
  };
  try{
    stage='BOOTSTRAP_EXACT_EMPTY_R2';
    budget.reserve('r2Reads',2);
    budget.reserve('r2Writes',2);
    workerTouched=true; // even partial R2 seed must stop this exact temp Worker
    await seedEmptyQa518({proof,bucket,nowMs:now()});
    const results=[];
    for(let i=0;i<kind.length;i++)results.push(await apply(kind[i],i));
    stage='STALE_REPLAY';
    budget.reserve('httpRequests',1);
    const stale=await actions.dispatchSigned({
      uid:pilot.uid,documentId:pilot.documentId,
      sourceVersionNs:results[1].version,desiredState:'removed',
      action:'stale-replay',oneRequestOnly:true,
    });
    if(stale?.code!=='STALE_SIGNED_EVENT_NO_WRITE')
      fail('HOLD_QA_STALE_DELETE_NOT_REJECTED');
    checkAck(await actions.inspectExact({
      uid:pilot.uid,documentId:pilot.documentId,
    }),pilot,latest,'saved');
    stage='STOP_ONLY_TEMP_WORKER';
    const stopped=await actions.stopExactTempWorker({runId:proof.runId});
    if(stopped?.tempWorkerAbsent!==true
      ||stopped?.originalWorkerVersion!==QA518.originalVersion)
      fail('HOLD_QA_TEMP_WORKER_ORIGINAL_RESTORE_NOT_CONFIRMED');
    stage='CLEANUP_EXACT_D1';
    budget.reserve('d1RowsWritten',8);
    const d1Cleanup=await actions.cleanupPilotD1({
      uid:pilot.uid,documentId:pilot.documentId,
      preserveAccountDailyBudgetLedger:true,
    });
    if(d1Cleanup?.pilotRowsRemaining!==0||d1Cleanup?.unrelatedRowsDeleted!==0)
      fail('HOLD_QA_D1_PILOT_CLEANUP_NOT_EXACT');
    stage='CLEANUP_EXACT_R2';
    const cleanup=await cleanupQaR2518({
      proof,bucket,nowMs:now(),inspect:()=>actions.inspectCleanup({
        uid:pilot.uid,documentId:pilot.documentId,runId:proof.runId,
      }),
    });
    stage='CLEANUP_EXACT_FIRESTORE';
    budget.reserve('firestoreWrites',2);
    const firebaseCleanup=await actions.cleanupPilotFirestore({
      uid:pilot.uid,documentId:pilot.documentId,
      onlyExactFavoriteAndDeleteReceipt:true,
    });
    if(firebaseCleanup?.pilotDocsRemaining!==0
      ||firebaseCleanup?.unrelatedDocumentsDeleted!==0)
      fail('HOLD_QA_FIRESTORE_PILOT_CLEANUP_NOT_EXACT');
    stage='FINAL_NO_WRITER';
    const final=await actions.inspectCleanup({
      uid:pilot.uid,documentId:pilot.documentId,runId:proof.runId,
    });
    if(final?.tempWorkerAbsent!==true
      ||final?.originalWorkerVersion!==QA518.originalVersion
      ||final?.pilotD1Rows!==0||final?.otherQaR2Writers!==0
      ||final?.pilotFirestoreDocs!==0)
      fail('HOLD_QA_FINAL_CLEANUP_NOT_VERIFIED');
    finished=true;
    return {code:'QA518_ONE_SONG_ADAPTER_SEQUENCE_COMPLETE',
      pilot,result:results,cleanup:cleanup.code,limits:budget.snapshot()};
  }catch(error){
    // Never erase D1 pending or an R2 journal when a previous stage failed:
    // it is valuable evidence and arbitrary cleanup could delete newer data.
    // Best effort: stop only this unique QA Worker; no retries in a loop.
    let workerStop='NOT_ATTEMPTED';
    if(workerTouched){
      try{
        const x=await actions.stopExactTempWorker({runId:proof.runId});
        workerStop=x?.tempWorkerAbsent===true?'CONFIRMED':'HOLD';
      }catch{workerStop='HOLD';}
    }
    return {code:'HOLD_QA_EXACT_ONE_SONG_INCOMPLETE',stage,
      reason:String(error?.message||'HOLD_UNKNOWN').slice(0,100),
      workerStop,cleanup:'NOT_ATTEMPTED_PRESERVE_PILOT_EVIDENCE',
      limits:budget.snapshot()};
  }finally{
    if(!finished){
      // No implicit retry, no data backup overwrite, no other-user cleanup.
    }
  }
}

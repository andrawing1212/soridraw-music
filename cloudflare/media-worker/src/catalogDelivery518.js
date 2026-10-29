// app518 bounded exact-item drain candidate. Source-only; no live cron,
// queue, Worker handler, secrets or Firebase Function wiring in this PR.
// Actual R2 writer MUST prove exact source-version and owner-bound CAS.
// A returned HTTP 200 or ordinary legacy Catalog delta is NEVER an ACK.
import {parseFirestoreUpdateTimeNs518} from './catalogCanonicalFence518.js';
import {CatalogR2ContractError518} from './catalogR2Provider518.js';
import {CatalogFirebaseSourceHold518} from './catalogFirebaseFetcher518.js';
import {
 getDueFavoriteChanges518,enqueueVerifiedFavorite518,
 acknowledgeExactFavorite518,scheduleFailedFavorite518,holdExactFavorite518,
 deferPagedFavorite518,deferDailyBudgetFavorite518,
} from './catalogD1Outbox518.js';
const text=x=>typeof x==='string'?x.trim():'';
const isState=x=>x==='saved'||x==='removed';
// Only demonstrably non-retryable contract errors get a durable HOLD at
// first failure. Unknown IO/timeout errors use bounded retries before HOLD.
export const permanentDeliveryHoldReason518=code=>{
 if(code?.includes('HOLD_D1_DAILY_QUOTA'))return null;
 if(typeof code!=='string')return null;
 // Compaction's HOLD_RECOVERY_HEAD_MOVED means "do not publish this
 // snapshot", NOT "permanently stop this exact outbox version".
 // The next bounded attempt may rotate staging to a verified newer HEAD.
 if(code==='RETRYABLE_INDEX_RECOVERY_HOLD_RECOVERY_HEAD_MOVED')
  return null;
 if(code.startsWith('DENY_')||code.startsWith('HOLD_')
   ||code.startsWith('RETRYABLE_INDEX_DENY_')
   ||code.startsWith('RETRYABLE_INDEX_HOLD_')
   ||code.startsWith('RETRYABLE_INDEX_RECOVERY_DENY_')
   ||code.startsWith('RETRYABLE_INDEX_RECOVERY_HOLD_'))
  return 'INDEX_CONTRACT';
 return null;
};
const validRow=row=>row&&text(row.owner_uid)&&text(row.favorite_id)
 &&/^\d{16,21}$/.test(text(row.source_version_ns))
 &&isState(row.desired_state)
 &&Number.isSafeInteger(Number(row.attempt_count))
 &&Number(row.attempt_count)>=0;

export const deliverDueCanonicalFavorites518=async({
 db,nowMs,readExactCanonical,applyVersionedR2,maxItems=128,
}={})=>{
 if(!db||!Number.isSafeInteger(nowMs)||nowMs<0
   ||typeof readExactCanonical!=='function'
   ||typeof applyVersionedR2!=='function'
   ||!Number.isInteger(maxItems)||maxItems<1||maxItems>256)
   return {code:'DENY_DEPENDENCIES',attempted:0,acked:0,retry:0,drift:0};
 const fetched=await getDueFavoriteChanges518({db,nowMs,limit:maxItems});
 if(fetched.code!=='OK')return {code:'DENY_DUE_QUEUE',attempted:0,acked:0,retry:0,drift:0};
 const result={code:'OK',attempted:0,acked:0,retry:0,held:0,drift:0};
 const pauseForTomorrow=async({uid,id,version})=>{
  // No permanent HOLD/attempt increment for a daily quota. The tagged
  // control-lane UPDATE retains exact pending version until tomorrow UTC.
  try{
   const out=await deferDailyBudgetFavorite518({
    db,uid,documentId:id,sourceVersionNs:version,nowMs,
   });
   if(out.code==='DAILY_BUDGET_DEFERRED'){result.retry++;return true;}
   return out.code==='STALE_BUDGET_DEFER';
  }catch{return false;}
 };
 // Sequential by design in source prototype; final scheduler can apply
 // bounded concurrency once actual subrequest/CPU costs are measured.
 for(const row of fetched.rows){
   if(!validRow(row))return {...result,code:'DENY_CORRUPT_DUE_ROW'};
   result.attempted++;
   const uid=row.owner_uid,id=row.favorite_id,version=row.source_version_ns;
   try{
     // Exact current authenticated server-owned Firestore document only.
     const canonical=await readExactCanonical(uid,id);
     if(!canonical||canonical.verifiedByServer!==true
       ||canonical.uid!==uid||canonical.documentId!==id
       ||!isState(canonical.state)){
       throw new Error('SOURCE_UNVERIFIED');
     }
     const current=parseFirestoreUpdateTimeNs518(canonical.updateTime);
     if(!current)throw new Error('SOURCE_VERSION_UNDETERMINED');
     if(current!==version || canonical.state!==row.desired_state){
       // A newer canonical snapshot might have been saved while old async work
       // waited; requeue ONLY the latest verified source, never publish old.
       const next=await enqueueVerifiedFavorite518({
         db,uid,documentId:id,sourceUpdateTime:canonical.updateTime,
         state:canonical.state,verifiedByServer:true,nowMs,
       });
       if(next.code==='DENY_UNVERIFIED_OR_UNVERSIONED')throw new Error('SOURCE_CHANGED_UNVERIFIED');
       result.drift++;
       // Older canonical read than the queued version is not authoritative.
       // Delay instead of creating a hot loop on the always-due old row.
       if(BigInt(current)<BigInt(version)){
         const scheduled=await scheduleFailedFavorite518({
           db,uid,documentId:id,sourceVersionNs:version,nowMs,
           attemptCount:Number(row.attempt_count),
         });
         if(scheduled.code==='RETRY_SCHEDULED')result.retry++;
         if(scheduled.code==='HELD')result.held++;
       }
       continue;
     }
     // The interface intentionally requires the provider's durable per-song
     // source fence and R2 CAS proof; app518 prototype lacks this provider.
     const delivered=await applyVersionedR2({
       uid,documentId:id,sourceVersionNs:version,
       desiredState:row.desired_state,canonical,
     });
     // Only a successful, durable page advancement can request the next
     // scheduler tick. It is not a failed R2 write and must not exhaust the
     // eight-attempt IO retry budget while 50k songs are staged.
     if(['RETRYABLE_INDEX_PAGING_IN_PROGRESS',
       'RETRYABLE_INDEX_RECOVERY_PAGING_IN_PROGRESS']
        .includes(delivered?.code)){
       const next=await deferPagedFavorite518({
        db,uid,documentId:id,sourceVersionNs:version,nowMs,
       });
       if(next.code==='PAGE_CONTINUATION_SCHEDULED')result.retry++;
       continue;
     }
     if(!delivered||delivered.versionVerified!==true
       ||delivered.ownerVerified!==true
       ||delivered.casVerified!==true
       ||delivered.sourceVersionNs!==version
       ||!['APPLIED','ALREADY_APPLIED'].includes(delivered.code)){
       if(String(delivered?.code||'').includes('HOLD_D1_DAILY_QUOTA')){
        if(!await pauseForTomorrow({uid,id,version}))
         result.code='RETRYABLE_D1_BUDGET_PAUSE_UNSAVED';
        continue;
       }
       const permanent=permanentDeliveryHoldReason518(delivered?.code);
       if(permanent){
         const held=await holdExactFavorite518({
           db,uid,documentId:id,sourceVersionNs:version,nowMs,
           reason:permanent,
         });
         if(held.code==='HELD')result.held++;
         // Outbox retains the exact source/version; next genuinely newer
         // source clears HOLD on verified enqueue. No endless scheduled R/W.
         continue;
       }
       throw new Error('R2_UNVERIFIED_ACK');
     }
     const ack=await acknowledgeExactFavorite518({
       db,uid,documentId:id,sourceVersionNs:version,nowMs,
       r2VerifiedVersionNs:delivered.sourceVersionNs,
     });
     if(ack.code==='ACKED')result.acked++;
     // If a newer D1 row superseded the ACK, its task stays pending.
   }catch(error){
     if(String(error?.code||'').includes('HOLD_D1_DAILY_QUOTA')){
      if(!await pauseForTomorrow({uid,id,version}))
       result.code='RETRYABLE_D1_BUDGET_PAUSE_UNSAVED';
      continue;
     }
     // Also protect direct R2 provider calls (e.g. a READY index writer)
     // from downgrading foreign-owner/corrupt R2 authority to transient IO.
     if(error instanceof CatalogFirebaseSourceHold518){
       const held=await holdExactFavorite518({
         db,uid,documentId:id,sourceVersionNs:version,nowMs,
         reason:'SOURCE_CONTRACT',
       });
       if(held.code==='HELD')result.held++;
       continue;
     }
     if(error instanceof CatalogR2ContractError518){
       const held=await holdExactFavorite518({
         db,uid,documentId:id,sourceVersionNs:version,nowMs,
         reason:'INDEX_CONTRACT',
       });
       if(held.code==='HELD')result.held++;
       continue;
     }
     // Persist and retry; do not drop the last confirmed tombstone, and don't
     // send user content or secret tokens to logs.
     const scheduled=await scheduleFailedFavorite518({
       db,uid,documentId:id,sourceVersionNs:version,nowMs,
       attemptCount:Number(row.attempt_count),
     });
     if(scheduled.code==='RETRY_SCHEDULED')result.retry++;
     if(scheduled.code==='HELD')result.held++;
   }
 }
 return result;
};

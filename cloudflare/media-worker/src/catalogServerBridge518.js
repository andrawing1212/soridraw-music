// app518 INACTIVE Cloudflare server bridge. This is NOT imported by the
// current media Worker and has no route, timer, secret or D1 binding.
// Only a signed server event may reach here. The receiver still verifies
// the exact latest Firebase source before any D1 enqueue or R2 write.
// Existing 30s local-first save and all user-facing APIs are unchanged.
import {verifyServerRequest518} from './catalogServerAuth518.js';
import {parseFirestoreUpdateTimeNs518} from './catalogCanonicalFence518.js';
import {createOwnerR2Provider518} from './catalogR2Provider518.js';
import {enqueueVerifiedFavorite518,resumeExhaustedExactFavorite518} from './catalogD1Outbox518.js';
import {deliverDueCanonicalFavorites518} from './catalogDelivery518.js';
import {stageFirstChangedOwnerIndex518,INDEX_META_READ_518} from './catalogFirstChangeIndex518.js';
import {createR2BasePageReader518} from './catalogR2BasePages518.js';
import {advancePagedOwnerIndex518} from './catalogOwnerPagedIndex518.js';
import {applyIndexedCanonicalR2Delta518} from './catalogIndexedWriter518.js';

const deny=code=>({code,accepted:false});
const validItem=source=>source&&source.verifiedByServer===true
 &&typeof source.uid==='string'&&typeof source.documentId==='string'
 &&['saved','removed'].includes(source.state)
 &&typeof source.updateTime==='string';
export const createApp518ServerBridge=({
 env,sharedReleaseFencesVerified=false,
 readExactCanonical,projectItem,sortItems,
}={})=>{
 const db=env?.CATALOG_OUTBOX_518;
 const r2=createOwnerR2Provider518({env,sharedReleaseFencesVerified});
 const baseReader=createR2BasePageReader518({
  env,readOwnerHead:r2.readOwnerHead,sharedReleaseFencesVerified,projectItem,
 });
 const enabled=Boolean(r2.enabled&&db?.prepare&&db?.batch
   &&typeof readExactCanonical==='function'
   &&typeof projectItem==='function'&&typeof sortItems==='function'
   &&typeof env?.CATALOG_SERVER_HMAC_518==='string'
   &&env.CATALOG_SERVER_HMAC_518.length>=32);

 // This bridge enqueues one current server source. Event fields supplied
 // over HMAC are hints only, NOT proof of Firestore validity.
 const ingestSignedRequest=async({request,nowMs}={})=>{
  if(!enabled)return deny('HOLD_RELEASE_OR_SERVER_DEPENDENCIES');
  const verified=await verifyServerRequest518({
   request,secret:env.CATALOG_SERVER_HMAC_518,nowMs,
  });
  if(verified.code!=='VERIFIED_SERVER_REQUEST')return deny(verified.code);
  const payload=verified.payload;
  if(payload.action==='retry'){
   // Only an explicitly signed server request may manually resume one
   // exhausted generation. Verify owner/source before the conditional D1 W1.
   const current=await readExactCanonical(payload.uid,payload.documentId);
   if(!validItem(current)||current.uid!==payload.uid
     ||current.documentId!==payload.documentId)
    return deny('HOLD_RECOVERY_SOURCE_UNVERIFIED');
   const resumed=await resumeExhaustedExactFavorite518({
    db,uid:current.uid,documentId:current.documentId,
    sourceUpdateTime:current.updateTime,state:current.state,
    verifiedByServer:true,nowMs,
   });
   return {code:resumed.code,accepted:resumed.code==='RETRY_ARMED',
    d1Writes:resumed.d1Writes};
  }
  if(payload.action!=='enqueue')return deny('DENY_ACTION');
  const canonical=await readExactCanonical(payload.uid,payload.documentId);
  if(!validItem(canonical)||canonical.uid!==payload.uid
    ||canonical.documentId!==payload.documentId)
   return deny('HOLD_CANONICAL_UNVERIFIED');
  const fromVersion=payload.sourceVersionNs;
  const fromState=payload.desiredState;
  const currentVersion=parseFirestoreUpdateTimeNs518(canonical.updateTime);
  if(currentVersion!==fromVersion||canonical.state!==fromState)
   return {code:'STALE_SIGNED_EVENT_NO_WRITE',accepted:false};
  const queued=await enqueueVerifiedFavorite518({
   db,uid:canonical.uid,documentId:canonical.documentId,
   sourceUpdateTime:canonical.updateTime,state:canonical.state,
   verifiedByServer:true,nowMs,
  });
  return {code:queued.code,accepted:queued.code==='ENQUEUED',
   d1Writes:queued.d1Writes};
 };
 // Workers Free: one confirmed source per invocation. A 16-owner batch
 // could multiply the single-owner D1/R2 page budget past Free limits.
 const drainServerPending=async({nowMs,limit=1}={})=>{
  if(!enabled)return {code:'HOLD_RELEASE_OR_SERVER_DEPENDENCIES'};
  // One due batch only. Caller must be an authenticated server scheduler,
  // never the same public URL as browser GET/POST.
  return deliverDueCanonicalFavorites518({
   db,nowMs,maxItems:1,readExactCanonical,
   applyVersionedR2:async({uid,documentId,sourceVersionNs,
     desiredState,canonical})=>{
    // First confirmed mutation owner index; one-off full R2 read only when
    // D1 has no ready index. A ready index needs no R2 full list read.
    // A READY account never triggers an owner-wide R2 range scan. A new
    // owner above 20k (or its suspended paging stage) uses durable paging.
    const prior=await db.prepare(INDEX_META_READ_518).bind(uid).first();
    const ownerHead=prior?.status==='ready'?null:
      await r2.readOwnerHead(uid);
    const usePaging=prior?.status!=='ready'&&(
      prior?.expected_count>20000||ownerHead?.head?.itemCount>20000);
    const staged=usePaging?await advancePagedOwnerIndex518({
     db,uid,mode:'first',verifiedPendingMutation:true,nowMs,
     readOwnerHead:r2.readOwnerHead,baseReader,projectItem,
    }):await stageFirstChangedOwnerIndex518({
     db,uid,verifiedMutation:true,nowMs,
     loadMaterializedR2Once:async account=>
      r2.loadCompleteFencedOwnerR2({uid:account,projectItem,sortItems}),
     readR2HeadAgain:async account=>{
      const value=await r2.readOwnerHead(account);
      return {...value.head,etag:value.etag,
       verifiedByServer:value.verifiedByServer,ownerUid:value.ownerUid,
       fencedWritersVerified:value.fencedWritersVerified};
     },
    });
    // A moving R2 HEAD or temporary index IO must use bounded retry,
    // not the permanent D1 HOLD path. Truly invalid DENY/HOLD outcomes
    // remain terminal in catalogDelivery518's existing classifier.
    if(!['INDEX_READY','READY_REQUIRES_HEAD_CAS'].includes(staged.code))
     return {code:'RETRYABLE_INDEX_'+staged.code};
    return applyIndexedCanonicalR2Delta518({
     db,uid,documentId,sourceVersionNs,desiredState,
     readExactCanonical,readOwnerHead:r2.readOwnerHead,
     storeHeadIfEtag:r2.storeHeadIfEtag,
     compactVerifiedOwnerHead:args=>r2.compactVerifiedOwnerHead({
      ...args,projectItem,sortItems,baseReader,
     }),
     loadCompleteFencedOwnerR2:async account=>
      r2.loadCompleteFencedOwnerR2({uid:account,projectItem,sortItems}),
     projectItem,nowMs,
     pagedRecovery:async()=>advancePagedOwnerIndex518({
      db,uid,mode:'recovery',verifiedPendingMutation:true,nowMs,
      readOwnerHead:r2.readOwnerHead,baseReader,projectItem,
     }),
    });
   },
  });
 };
 return {enabled,ingestSignedRequest,drainServerPending};
};

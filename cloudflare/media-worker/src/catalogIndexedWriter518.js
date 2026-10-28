// app518 exact one-song indexed R2 CAS writer prototype. INACTIVE:
// requires authenticated server read, all shared legacy writers fenced,
// owner-verified R2 HEAD provider, D1 exact per-item index and outbox.
// No D1 binding, Cron, Function, endpoint or live R2 writes in this PR.
// D1 ACK is permitted only after R2 HEAD CAS AND D1 index replay both succeed.
import {appendCatalogJournalDelta,isValidCatalogJournal} from './catalogJournal.js';
import {parseFirestoreUpdateTimeNs518} from './catalogCanonicalFence518.js';
import {readIndexedMembership518} from './catalogFirstChangeIndex518.js';
import {reconcileIndexedHead518} from './catalogIndexAdvance518.js';

const txt=x=>typeof x==='string'?x.trim():'';
const valid=x=>txt(x).length>0&&txt(x).length<=240&&!/[\\/]/.test(txt(x));
const verifiedHead=(value,uid)=>{
 const head=value?.head;
 return value?.verifiedByServer===true&&value?.ownerUid===uid
  &&value?.fencedWritersVerified===true&&txt(value?.etag)
  &&head?.canonicalAuthority518===true
  &&isValidCatalogJournal(head,'musicNote');
};

export const applyIndexedCanonicalR2Delta518=async({
 db,uid,documentId,sourceVersionNs,desiredState,
 readExactCanonical,readOwnerHead,storeHeadIfEtag,projectItem,
 nowMs,
}={})=>{
 const deny=code=>({code,ownerVerified:false,versionVerified:false,casVerified:false});
 if(!db||typeof db.prepare!=='function'||typeof db.batch!=='function'
   ||!valid(uid)||!valid(documentId)||!/^\d{21}$/.test(txt(sourceVersionNs))
   ||!['saved','removed'].includes(desiredState)
   ||![readExactCanonical,readOwnerHead,storeHeadIfEtag,projectItem]
      .every(x=>typeof x==='function')
   ||!Number.isSafeInteger(nowMs)||nowMs<0)return deny('DENY_ARGUMENTS');
 const source=()=>readExactCanonical(uid,documentId);
 for(let attempt=0;attempt<3;attempt++){
  // A late or duplicate Firebase trigger must never be trusted as current.
  const canonical=await source();
  if(!canonical||canonical.verifiedByServer!==true||canonical.uid!==uid
    ||canonical.documentId!==documentId||canonical.state!==desiredState
    ||parseFirestoreUpdateTimeNs518(canonical.updateTime)!==sourceVersionNs)
    return deny('HOLD_CANONICAL_CHANGED_OR_UNVERIFIED');
  const queued=await db.prepare(
   'SELECT source_version_ns,desired_state FROM music_note_catalog_outbox_518 WHERE owner_uid=? AND favorite_id=?'
  ).bind(uid,documentId).first();
  if(queued?.source_version_ns!==sourceVersionNs
    ||queued?.desired_state!==desiredState)
    return deny('HOLD_OUTBOX_SUPERSEDED');
  const state=await readOwnerHead(uid);
  if(!verifiedHead(state,uid))return deny('DENY_UNFENCED_R2_HEAD');
  const head=state.head,etag=state.etag;
  const membership=await readIndexedMembership518({
   db,uid,documentId,r2Head:{
    headRevision:head.headRevision,itemCount:head.itemCount,etag,
   },
  });
  if(membership.code==='DENY_INDEX_HEAD_DRIFT'){
   const recovered=await reconcileIndexedHead518({
    db,uid,nowMs,loadVerifiedHead:readOwnerHead,
   });
   if(!['INDEX_ADVANCED','ALREADY_INDEXED'].includes(recovered.code))
    return deny('RETRYABLE_INDEX_'+recovered.code);
   continue;
  }
  if(membership.code!=='EXACT_MEMBERSHIP'
    ||membership.requiresSameHeadConditionalPut!==true)
    return deny('DENY_INDEX_'+membership.code);
  const item=desiredState==='saved'
   ?projectItem(canonical.item,documentId):null;
  if(desiredState==='saved'&&(!item||txt(item.id)!==documentId))
    return deny('DENY_BAD_PROJECTION');
  const mutationId='canonical518:'+documentId+':'+sourceVersionNs;
  if(head.recentMutations?.some(x=>x?.id===mutationId)){
   // Idempotent: R2 definitely contains the previous accepted mutation.
   // Current index matches the exact current R2 HEAD; no extra PUT.
   return {code:'ALREADY_APPLIED',ownerVerified:true,
    versionVerified:true,casVerified:true,sourceVersionNs,
    r2Puts:0};
  }
  const present=membership.present;
  const nextRevision=Math.max(nowMs,head.headRevision+1);
  const delta={
   mutationId,baseRevision:head.headRevision,baseItemCount:head.itemCount,
   revision:nextRevision,
   nextItemCount:head.itemCount+
    Number(desiredState==='saved'&&!present)-
    Number(desiredState==='removed'&&present),
   upserts:desiredState==='saved'?[item]:[],
   deletedIds:desiredState==='removed'&&present?[documentId]:[],
  };
  const added=appendCatalogJournalDelta({
   head,delta,serverRevision:nextRevision,now:nowMs,
  });
  if(!added.ok||added.duplicate)
   return deny('RETRYABLE_R2_APPEND_'+(added.reason||'DUPLICATE'));
  const nextHead={...added.head,canonicalAuthority518:true};
  // A CAS 412 is never proof. Retry from fresh Firestore + D1 + R2.
  const saved=await storeHeadIfEtag({uid,expectedEtag:etag,
   nextHead,sourceVersionNs,documentId});
  if(saved?.casCommitted!==true||saved?.ownerVerified!==true)
   continue;
  // R2 CAS was committed, but D1 may not have been advanced. Never ACK
  // the outbox until exact journal tail replay restores membership+meta.
  const replay=await reconcileIndexedHead518({
   db,uid,nowMs,loadVerifiedHead:readOwnerHead,
  });
  if(!['INDEX_ADVANCED','ALREADY_INDEXED'].includes(replay.code))
   return deny('RETRYABLE_INDEX_'+replay.code);
  return {code:'APPLIED',ownerVerified:true,versionVerified:true,
   casVerified:true,sourceVersionNs,r2Puts:1};
 }
 return deny('RETRYABLE_R2_CONFLICT');
};

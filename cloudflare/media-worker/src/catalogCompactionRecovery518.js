// app518 INACTIVE — compaction-gap recovery, not a live Worker import.
// A R2 compaction may erase deltas needed to catch D1 membership up.
// Rebuild ONLY for one owner with an authenticated, fenced, complete R2
// snapshot on an actual pending mutation. A new generation is staged in
// small D1 batches; readers cannot see it until the guarded meta swap.
// Never change Firestore originals and never treat R2 materialization as
// evidence that a newer pending canonical change was acknowledged.
import {INDEX_META_READ_518,INDEX_MEMBER_STAGE_518,INDEX_COUNT_518} from './catalogFirstChangeIndex518.js';
import {isValidCatalogJournal} from './catalogJournal.js';
const txt=x=>typeof x==='string'?x.trim():'';
const validUid=x=>txt(x).length>0&&txt(x).length<=128&&!/[\\/]/.test(txt(x));
const validId=x=>txt(x).length>0&&txt(x).length<=240&&txt(x)!=='.'&&txt(x)!=='..'&&!/[\\/]/.test(txt(x));
const validHead=h=>h&&isValidCatalogJournal(h,'musicNote')&&h.canonicalAuthority518===true
 &&Number.isSafeInteger(h.headRevision)&&h.headRevision>0
 &&Number.isSafeInteger(h.itemCount)&&h.itemCount>=0&&h.itemCount<=20000;
const same=(a,b)=>a&&b&&a.headRevision===b.headRevision&&a.itemCount===b.itemCount
 &&a.etag===b.etag;

export const RECOVERY_CLAIM_518=[
 'UPDATE music_note_catalog_index_meta_518',
 'SET recovery_generation=?,recovery_revision=?,recovery_etag=?,recovery_count=?',
 'WHERE owner_uid=? AND generation=? AND indexed_revision=? AND head_etag=?',
 "AND status='ready' AND recovery_generation IS NULL",
].join(' ');
export const RECOVERY_PROMOTE_518=[
 'UPDATE music_note_catalog_index_meta_518',
 'SET generation=recovery_generation,indexed_revision=recovery_revision,',
 'head_etag=recovery_etag,expected_count=recovery_count,checked_at_ms=?,',
 'recovery_generation=NULL,recovery_revision=NULL,recovery_etag=NULL,recovery_count=NULL',
 'WHERE owner_uid=? AND generation=? AND indexed_revision=? AND head_etag=?',
 "AND status='ready' AND recovery_generation=? AND recovery_revision=?",
 'AND recovery_etag=? AND recovery_count=?',
].join(' ');

export const recoverCompactedOwnerIndex518=async({
 db,uid,verifiedPendingMutation,loadCompleteFencedOwnerR2,readR2HeadAgain,nowMs,
}={})=>{
 const fail=(code,fullReads=0,d1Writes=0)=>({code,complete:false,fullReads,d1Writes});
 if(!db||typeof db.prepare!=='function'||typeof db.batch!=='function'
   ||!validUid(uid)||verifiedPendingMutation!==true
   ||typeof loadCompleteFencedOwnerR2!=='function'||typeof readR2HeadAgain!=='function'
   ||!Number.isSafeInteger(nowMs)||nowMs<0)return fail('DENY_UNVERIFIED_OR_INVALID');
 let fullReads=0,writes=0;
 try{
  const old=await db.prepare(INDEX_META_READ_518).bind(uid).first();
  if(old?.status!=='ready'||!Number.isSafeInteger(old.generation)
    ||!Number.isSafeInteger(old.indexed_revision)||!txt(old.head_etag))
    return fail('DENY_OLD_INDEX_NOT_READY');
  // The caller must only trigger after bounded delta recovery proves a
  // COMPACTION GAP, not merely because the HEAD changed normally.
  const snapshot=await loadCompleteFencedOwnerR2(uid);fullReads++;
  const target=snapshot?.head;
  if(snapshot?.verifiedByServer!==true||snapshot?.ownerUid!==uid
    ||snapshot?.fencedWritersVerified!==true||snapshot?.complete!==true
    ||snapshot?.kind!=='musicNote'||!validHead(target)
    ||!txt(snapshot.etag)||!Array.isArray(snapshot.items)
    ||snapshot.items.length!==target.itemCount)
    return fail('DENY_UNTRUSTED_OR_UNBOUNDED_SNAPSHOT',fullReads);
  if(target.baseRevision<=old.indexed_revision||target.headRevision<=old.indexed_revision)
    return fail('DENY_NOT_A_COMPACTION_GAP',fullReads);
  const nextGen=target.headRevision; // monotonic, never reuse an older generation
  if(nextGen<=old.generation)return fail('DENY_NON_MONOTONIC_GENERATION',fullReads);
  if(old.recovery_generation!=null &&
   (old.recovery_generation!==nextGen||old.recovery_revision!==target.headRevision
    ||old.recovery_etag!==snapshot.etag||old.recovery_count!==target.itemCount))
    return fail('HOLD_RECOVERY_TARGET_MOVED',fullReads);
  const seen=new Set();
  for(const item of snapshot.items){
   const id=txt(item?.id);
   if(!validId(id)||seen.has(id))return fail('DENY_BAD_OR_DUPLICATE_ID',fullReads);
   seen.add(id);
  }
  if(old.recovery_generation==null){
   const claimed=await db.prepare(RECOVERY_CLAIM_518).bind(
    nextGen,target.headRevision,snapshot.etag,target.itemCount,
    uid,old.generation,old.indexed_revision,old.head_etag).run();
   writes+=Number(claimed?.meta?.changes||0);
   if(Number(claimed?.meta?.changes)!==1)
    return fail('RETRYABLE_RECOVERY_CLAIM_RACE',fullReads,writes);
  }
  // A crash after any chunk is resumable with the same HEAD. A changed HEAD
  // is NEVER silently trusted; wait for an independently approved new epoch.
  const ids=[...seen];
  for(let i=0;i<ids.length;i+=128){
   const batch=ids.slice(i,i+128).map(id=>db.prepare(INDEX_MEMBER_STAGE_518)
    .bind(uid,nextGen,id));
   const result=await db.batch(batch);
   if(!Array.isArray(result)||result.length!==batch.length
      ||result.some(x=>x?.success!==true))
    return fail('RETRYABLE_RECOVERY_STAGE',fullReads,writes);
   writes+=result.reduce((n,x)=>n+Number(x?.meta?.changes||0),0);
  }
  const tally=await db.prepare(INDEX_COUNT_518).bind(uid,nextGen).first();
  if(Number(tally?.n)!==ids.length)
   return fail('DENY_INCOMPLETE_RECOVERY',fullReads,writes);
  const headNow=await readR2HeadAgain(uid);
  if(headNow?.verifiedByServer!==true||headNow?.ownerUid!==uid
     ||headNow?.fencedWritersVerified!==true
     ||!same({headRevision:target.headRevision,itemCount:target.itemCount,etag:snapshot.etag},
       {headRevision:headNow.head?.headRevision,itemCount:headNow.head?.itemCount,etag:headNow.etag}))
   return fail('HOLD_RECOVERY_HEAD_MOVED',fullReads,writes);
  const promoted=await db.prepare(RECOVERY_PROMOTE_518).bind(
   nowMs,uid,old.generation,old.indexed_revision,old.head_etag,
   nextGen,target.headRevision,snapshot.etag,target.itemCount).run();
  writes+=Number(promoted?.meta?.changes||0);
  if(Number(promoted?.meta?.changes)!==1)
   return fail('RETRYABLE_PROMOTION_RACE',fullReads,writes);
  // Old generations are kept until a separate bounded safe cleanup is
  // audited. Never delete member rows while an in-flight consumer may refer.
  return {code:'RECOVERY_PROMOTED',complete:true,fullReads,d1Writes:writes,
   revision:target.headRevision,memberCount:ids.length};
 }catch{
  return fail('RETRYABLE_RECOVERY_IO',fullReads,writes);
 }
};
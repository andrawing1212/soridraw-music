// app518 INACTIVE — compaction-gap recovery, not a live Worker import.
// A R2 compaction may erase deltas needed to catch D1 membership up.
// Rebuild ONLY for one owner with an authenticated, fenced, complete R2
// snapshot on an actual pending mutation. A new generation is staged in
// small D1 batches; readers cannot see it until the guarded meta swap.
// Never change Firestore originals and never treat R2 materialization as
// evidence that a newer pending canonical change was acknowledged.
import {INDEX_META_READ_518,INDEX_COUNT_518} from './catalogFirstChangeIndex518.js';
import {isValidCatalogJournal} from './catalogJournal.js';
import {CatalogR2ContractError518} from './catalogR2Provider518.js';
const txt=x=>typeof x==='string'?x.trim():'';
const validUid=x=>txt(x).length>0&&txt(x).length<=128&&!/[\\/]/.test(txt(x));
const validId=x=>txt(x).length>0&&txt(x).length<=240&&txt(x)!=='.'&&txt(x)!=='..'&&!/[\\/]/.test(txt(x));
const validHead=h=>h&&isValidCatalogJournal(h,'musicNote')&&h.canonicalAuthority518===true
 &&Number.isSafeInteger(h.headRevision)&&h.headRevision>0
 &&Number.isSafeInteger(h.itemCount)&&h.itemCount>=0;
const same=(a,b)=>a&&b&&a.headRevision===b.headRevision&&a.itemCount===b.itemCount
 &&a.etag===b.etag;

export const RECOVERY_CLAIM_518=[
 'UPDATE music_note_catalog_index_meta_518',
 'SET recovery_generation=?,recovery_revision=?,recovery_etag=?,recovery_count=?,',
 'recovery_checked_at_ms=?,recovery_restart_count=0',
 'WHERE owner_uid=? AND generation=? AND indexed_revision=? AND head_etag=?',
 "AND status='ready' AND recovery_generation IS NULL",
].join(' ');
// A verified newer R2 revision may replace only the invisible recovery
// claim. Never modify READY generation or change another owner's staging.
// Same-revision/different-ETag is HOLD, not permission to recycle a generation.
export const RECOVERY_ROTATE_518=[
 'UPDATE music_note_catalog_index_meta_518',
 'SET recovery_generation=?,recovery_revision=?,recovery_etag=?,recovery_count=?,',
 'recovery_checked_at_ms=?,recovery_restart_count=recovery_restart_count+1',
 'WHERE owner_uid=? AND generation=? AND indexed_revision=? AND head_etag=?',
 "AND status='ready' AND recovery_generation=? AND recovery_revision=?",
 'AND recovery_etag=? AND recovery_count=?',
 'AND recovery_restart_count<3 AND recovery_checked_at_ms<=?',
].join(' ');
// Old recovery pages are barred atomically after claim promotion/replacement.
export const RECOVERY_MEMBER_BULK_STAGE_GUARDED_518=[
 'INSERT OR IGNORE INTO music_note_catalog_member_518',
 '(owner_uid,generation,favorite_id)',
 'SELECT ?, ?, value FROM json_each(?)',
 'WHERE EXISTS (SELECT 1 FROM music_note_catalog_index_meta_518',
 "WHERE owner_uid=? AND status='ready' AND recovery_generation=?",
 'AND recovery_revision=? AND recovery_etag=? AND recovery_count=?)',
].join(' ');
export const RECOVERY_PROMOTE_518=[
 'UPDATE music_note_catalog_index_meta_518',
 'SET generation=recovery_generation,indexed_revision=recovery_revision,',
 'head_etag=recovery_etag,expected_count=recovery_count,checked_at_ms=?,',
 'recovery_generation=NULL,recovery_revision=NULL,recovery_etag=NULL,recovery_count=NULL,',
 'recovery_restart_count=0,recovery_checked_at_ms=NULL',
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
  // If a previous stage is incomplete, use a small, authenticated HEAD
  // read BEFORE an O(N) full materialization. A recently moved HEAD should
  // not cause a fresh N-row import on every scheduler tick.
  if(old.recovery_generation!=null){
   if(!Number.isSafeInteger(old.recovery_generation)
      ||!Number.isSafeInteger(old.recovery_revision)
      ||!Number.isSafeInteger(old.recovery_count)
      ||!Number.isSafeInteger(old.recovery_restart_count)
      ||!Number.isSafeInteger(old.recovery_checked_at_ms))
     return fail('HOLD_UNVERSIONED_RECOVERY_CLAIM');
   const probe=await readR2HeadAgain(uid);
   if(probe?.verifiedByServer!==true||probe?.ownerUid!==uid
      ||probe?.fencedWritersVerified!==true
      ||!validHead(probe.head)||!txt(probe.etag))
     return fail('DENY_RECOVERY_PROBE_UNVERIFIED');
   const sameClaim=probe.head.headRevision===old.recovery_revision
      &&probe.head.itemCount===old.recovery_count
      &&probe.etag===old.recovery_etag;
   if(!sameClaim){
     if(probe.head.headRevision<=old.recovery_revision
        ||probe.head.headRevision<=old.recovery_generation)
       return fail('HOLD_NON_MONOTONIC_RECOVERY_HEAD');
     if(old.recovery_restart_count>=3)
       return fail('HOLD_RECOVERY_RESTART_BUDGET_EXHAUSTED');
     if(nowMs-old.recovery_checked_at_ms<60000)
       return fail('RETRYABLE_RECOVERY_RESTART_COOLDOWN');
   }
  }
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
  const changedStage=old.recovery_generation!=null &&
   (old.recovery_generation!==nextGen||old.recovery_revision!==target.headRevision
    ||old.recovery_etag!==snapshot.etag||old.recovery_count!==target.itemCount);
  if(changedStage){
   if(nextGen<=old.recovery_generation||target.headRevision<=old.recovery_revision)
     return fail('HOLD_NON_MONOTONIC_RECOVERY_HEAD',fullReads);
   if(old.recovery_restart_count>=3)
     return fail('HOLD_RECOVERY_RESTART_BUDGET_EXHAUSTED',fullReads);
   if(!Number.isSafeInteger(old.recovery_checked_at_ms)
      ||nowMs-old.recovery_checked_at_ms<60000)
     return fail('RETRYABLE_RECOVERY_RESTART_COOLDOWN',fullReads);
  }
  const seen=new Set();
  for(const item of snapshot.items){
   const id=txt(item?.id);
   if(!validId(id)||seen.has(id))return fail('DENY_BAD_OR_DUPLICATE_ID',fullReads);
   seen.add(id);
  }
  if(old.recovery_generation==null || changedStage){
   const query=changedStage?RECOVERY_ROTATE_518:RECOVERY_CLAIM_518;
   const params=changedStage
    ?[nextGen,target.headRevision,snapshot.etag,target.itemCount,
      nowMs,uid,old.generation,old.indexed_revision,old.head_etag,
      old.recovery_generation,old.recovery_revision,old.recovery_etag,
      old.recovery_count,nowMs-60000]
    :[nextGen,target.headRevision,snapshot.etag,target.itemCount,
      nowMs,uid,old.generation,old.indexed_revision,old.head_etag];
   const claimed=await db.prepare(query).bind(...params).run();
   const changed=Number(claimed?.meta?.changes||0);
   writes+=Math.max(0,changed);
   if(changed!==1)
    return fail(changedStage?'RETRYABLE_RECOVERY_ROTATE_RACE':
      'RETRYABLE_RECOVERY_CLAIM_RACE',fullReads,writes);
  }
  // The previous incomplete generation is invisible; restarting creates a
  // distinct, greater generation under a bounded claim. No row is deleted.
  // Same-HEAD crash retries remain idempotent through INSERT OR IGNORE.
  const ids=[...seen],chunkSize=512;
  // Rebuild a new invisible generation with bounded, atomic SQL pages;
  // a failed retry never edits the previously published READY generation.
  for(let i=0;i<ids.length;i+=chunkSize){
   const result=await db.prepare(RECOVERY_MEMBER_BULK_STAGE_GUARDED_518)
     .bind(uid,nextGen,JSON.stringify(ids.slice(i,i+chunkSize)),
       uid,nextGen,target.headRevision,snapshot.etag,target.itemCount).run();
   const changed=Number(result?.meta?.changes);
   if(!Number.isSafeInteger(changed)||changed<0||changed>Math.min(chunkSize,ids.length-i))
    return fail('RETRYABLE_RECOVERY_STAGE',fullReads,writes);
   writes+=changed;
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
 }catch(error){
  // A verified foreign-owner/schema failure cannot be healed by retrying
  // the same canonical source. Preserve the DENY through writer->delivery.
  return fail(error?.code==='HOLD_D1_DAILY_QUOTA'
    ?error.code
    :error instanceof CatalogR2ContractError518
    ?'DENY_RECOVERY_R2_CONTRACT':'RETRYABLE_RECOVERY_IO',fullReads,writes);
 }
};
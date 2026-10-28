// app518 bounded, inactive R2 HEAD -> D1 membership replay.
// The full R2 base/items are never read. The immutable first-import
// generation stays stable; only indexed_revision/head_etag/count advance.
// Must run ONLY on confirmed source mutation or an existing pending outbox
// item, never on page entry. This is not a deployed Worker handler.
// Contract: all shared R2 writers are fenced; only a server-confirmed exact
// Firestore version can produce a canonical518 journal delta.
// A compacted/missing/untrusted chain fails closed: never guess membership.
import {isValidCatalogJournal,CATALOG_JOURNAL_HARD_MAX_DELTAS} from './catalogJournal.js';
import {INDEX_META_READ_518,INDEX_MEMBER_LOOKUP_518} from './catalogFirstChangeIndex518.js';

const txt=x=>typeof x==='string'?x.trim():'';
const validUid=x=>txt(x).length>0&&txt(x).length<=128&&!/[\\/]/.test(txt(x));
const validId=x=>txt(x).length>0&&txt(x).length<=240&&!/[\\/]/.test(txt(x));
const validVersion=x=>/^\d{21}$/.test(txt(x));
const num=x=>Number.isSafeInteger(x)&&x>=0;
const marker='canonical518:';

// D1 transaction: the member and index meta mutation share one atomic batch.
// All statements are conditional on the exact *previous* indexed HEAD.
// Zero matched rows means a competing delivery changed the index; the caller
// must reread the latest D1 + R2 and retry, not ACK stale work.
export const INDEX_INSERT_GUARDED_518=[
 'INSERT OR IGNORE INTO music_note_catalog_member_518(owner_uid,generation,favorite_id)',
 'SELECT owner_uid,generation,? FROM music_note_catalog_index_meta_518',
 "WHERE owner_uid=? AND generation=? AND indexed_revision=? AND head_etag=?",
 "AND expected_count=? AND status='ready'",
].join(' ');
export const INDEX_DELETE_GUARDED_518=[
 'DELETE FROM music_note_catalog_member_518',
 'WHERE owner_uid=? AND generation=? AND favorite_id=?',
 'AND EXISTS (SELECT 1 FROM music_note_catalog_index_meta_518',
 "WHERE music_note_catalog_index_meta_518.owner_uid=music_note_catalog_member_518.owner_uid",
 "AND music_note_catalog_index_meta_518.generation=music_note_catalog_member_518.generation",
 "AND indexed_revision=? AND head_etag=? AND expected_count=? AND status='ready')",
].join(' ');
export const INDEX_META_ADVANCE_GUARDED_518=[
 'UPDATE music_note_catalog_index_meta_518',
 'SET indexed_revision=?,head_etag=?,expected_count=?,checked_at_ms=?',
 'WHERE owner_uid=? AND generation=? AND indexed_revision=?',
 " AND head_etag=? AND expected_count=? AND status='ready'",
].join(' ');

const parseMutation=delta=>{
 const m=txt(delta?.mutationId);
 if(!m.startsWith(marker))return null;
 const tail=m.slice(marker.length);
 const at=tail.lastIndexOf(':');
 if(at<1)return null;
 const id=tail.slice(0,at),version=tail.slice(at+1);
 if(!validId(id)||!validVersion(version))return null;
 const ups=delta.upserts,del=delta.deletedIds;
 if(!Array.isArray(ups)||!Array.isArray(del)||ups.length+del.length>1)
   return null;
 if(ups.length===1&&(txt(ups[0]?.id)!==id||del.length>0))
   return null;
 if(del.length===1&&txt(del[0])!==id)return null;
 return {id,version,state:ups.length?'saved':'removed'};
};

export const reconcileIndexedHead518=async({
 db,uid,loadVerifiedHead,nowMs,
}={})=>{
 const reject=(code,reads=0,writes=0)=>({code,headReads:reads,d1Writes:writes});
 if(!db||typeof db.prepare!=='function'||typeof db.batch!=='function'
   ||!validUid(uid)||!num(nowMs)||typeof loadVerifiedHead!=='function')
   return reject('DENY_DEPENDENCIES');
 let headReads=0,writes=0;
 try{
  const meta=await db.prepare(INDEX_META_READ_518).bind(uid).first();
  if(meta?.status!=='ready'||!num(meta.generation)||!num(meta.indexed_revision)
   ||!num(meta.expected_count)||!txt(meta.head_etag))
   return reject('DENY_INDEX_NOT_READY');
  // Provider must verify uid, R2 object owner/key, HEAD ETag, source cutover,
  // and cross-environment legacy writer fencing. No old browser can forge it.
  const item=await loadVerifiedHead(uid);headReads++;
  const head=item?.head,etag=item?.etag;
  if(item?.ownerUid!==uid||item?.verifiedByServer!==true
   ||item?.fencedWritersVerified!==true||!txt(etag)
   ||head?.canonicalAuthority518!==true||!isValidCatalogJournal(head,'musicNote'))
   return reject('DENY_UNTRUSTED_OR_UNFENCED_HEAD',headReads);
  if(head.headRevision===meta.indexed_revision
   &&head.itemCount===meta.expected_count&&etag===meta.head_etag)
   return reject('ALREADY_INDEXED',headReads);
  if(head.headRevision<=meta.indexed_revision
   ||head.baseRevision>meta.indexed_revision
   ||!Array.isArray(head.deltas)
   ||head.deltas.length>CATALOG_JOURNAL_HARD_MAX_DELTAS)
   return reject('HOLD_COMPACTED_OR_DIVERGENT_HEAD',headReads);
  const tail=head.deltas.filter(x=>x.revision>meta.indexed_revision);
  if(!tail.length||tail.length>CATALOG_JOURNAL_HARD_MAX_DELTAS
   ||tail[0].baseRevision!==meta.indexed_revision
   ||tail[0].baseItemCount!==meta.expected_count)
   return reject('HOLD_MISSING_DELTA_CHAIN',headReads);
  let revision=meta.indexed_revision,count=meta.expected_count;
  const seen=new Map(),lastVersions=new Map(),effects=[];
  for(const delta of tail){
   if(delta.baseRevision!==revision||delta.baseItemCount!==count)
    return reject('DENY_DELTA_CHAIN_CONFLICT',headReads);
   const mutation=parseMutation(delta);
   if(!mutation)return reject('DENY_NON_CANONICAL_MUTATION',headReads);
   // Verify the pending canonical version before trusting a journal change.
   const outbox=await db.prepare(
    'SELECT source_version_ns,desired_state FROM music_note_catalog_outbox_518 WHERE owner_uid=? AND favorite_id=?'
   ).bind(uid,mutation.id).first();
   // R2 deltas were committed at their own verified source versions.
   // A later Firestore v2 can replace D1's single pending row while R2
   // still contains committed v1, so equality with the *latest* outbox is
   // NOT required for replay. Accept historical versions only when older
   // than D1's exact current source; a future/unrecorded version is unsafe.
   if(!/^\d{21}$/.test(txt(outbox?.source_version_ns))
     ||!['saved','removed'].includes(outbox?.desired_state)
     ||mutation.version>outbox.source_version_ns
     ||(mutation.version===outbox.source_version_ns
         &&outbox.desired_state!==mutation.state))
    return reject('HOLD_OUTBOX_VERSION_DRIFT',headReads);
   const previous=lastVersions.get(mutation.id);
   if(previous && mutation.version<=previous)
    return reject('DENY_NON_MONOTONIC_SOURCE_HISTORY',headReads);
   lastVersions.set(mutation.id,mutation.version);
   let present=seen.get(mutation.id);
   if(present===undefined){
    const row=await db.prepare(INDEX_MEMBER_LOOKUP_518)
     .bind(uid,meta.generation,mutation.id).first();
    present=!!row;
   }
   const after=mutation.state==='saved';
   const expectedCount=count+Number(after&&!present)-Number(!after&&present);
   if(expectedCount!==delta.nextItemCount)
    return reject('DENY_ITEM_COUNT_MISMATCH',headReads);
   if(after!==present)effects.push({id:mutation.id,present:after});
   seen.set(mutation.id,after);
   count=delta.nextItemCount;revision=delta.revision;
  }
  if(revision!==head.headRevision||count!==head.itemCount)
   return reject('DENY_FINAL_HEAD_MISMATCH',headReads);
  // Intermediate flips of the same ID do not need multiple D1 writes.
  const changed=[...seen].filter(([id,after])=>{
   const matched=effects.find(x=>x.id===id);
   return matched!==undefined; // optimized into final reconciliation below
  });
  const statements=[];
  // Compare final state to originally indexed state; avoid redundant writes
  // for saved->removed->saved within a bounded replay window.
  for(const [id,finalPresent] of changed){
   const start=await db.prepare(INDEX_MEMBER_LOOKUP_518)
    .bind(uid,meta.generation,id).first();
   if(!!start===finalPresent)continue;
   if(finalPresent){
    statements.push(db.prepare(INDEX_INSERT_GUARDED_518).bind(
     id,uid,meta.generation,meta.indexed_revision,
     meta.head_etag,meta.expected_count));
   }else{
    statements.push(db.prepare(INDEX_DELETE_GUARDED_518).bind(
     uid,meta.generation,id,
     meta.indexed_revision,meta.head_etag,meta.expected_count));
   }
  }
  statements.push(db.prepare(INDEX_META_ADVANCE_GUARDED_518).bind(
   head.headRevision,etag,head.itemCount,nowMs,uid,meta.generation,
   meta.indexed_revision,meta.head_etag,meta.expected_count));
  // D1 batch is a single transactional unit, but R2 is a separate system.
  // A crash before this batch leaves old meta and can replay the R2 deltas.
  const receipts=await db.batch(statements);
  if(!Array.isArray(receipts)||receipts.length!==statements.length
    ||receipts.some(x=>x?.success!==true))
   return reject('RETRYABLE_D1_BATCH_ERROR',headReads,writes);
  writes=receipts.reduce((n,x)=>n+Number(x?.meta?.changes||0),0);
  if(Number(receipts.at(-1)?.meta?.changes)!==1)
   return reject('RETRYABLE_CONCURRENT_INDEX_ADVANCE',headReads,writes);
  return {code:'INDEX_ADVANCED',headReads,d1Writes:writes,
   itemCount:head.itemCount,revision:head.headRevision,
   changedMembershipRows:writes-1,deltaCount:tail.length};
 }catch{
  return reject('RETRYABLE_INDEX_RECOVERY_IO',headReads,writes);
 }
};

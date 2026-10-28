// app518 first-confirmed-change membership import — INACTIVE and never called
// by the deployed Worker. Owner's already-materialized R2 Catalog is read
// exactly once for initial staging; Firestore favorites are NEVER scanned.
// Each staged D1 chunk is transactional. "building" is NEVER readable by
// a live per-item writer. A final exact R2 HEAD recheck is mandatory.
// This index is only a *membership hint*: source versions/deletions still
// come exclusively from verified Firestore -> D1 outbox.

const txt=x=>typeof x==='string'?x.trim():'';
const maxItems=20000,chunkSize=128;
const safeUid=x=>txt(x).length>0&&txt(x).length<=128&&!/[\\/]/.test(txt(x));
const safeId=x=>txt(x).length>0&&txt(x).length<=240&&!/[\\/]/.test(txt(x))
  &&txt(x)!=='.'&&txt(x)!=='..';
const safeHead=h=>h&&Number.isSafeInteger(h.headRevision)&&h.headRevision>0
 &&Number.isSafeInteger(h.itemCount)&&h.itemCount>=0
 &&txt(h.etag).length>0&&txt(h.etag).length<=256;
const sameHead=(a,b)=>safeHead(a)&&safeHead(b)
 &&a.headRevision===b.headRevision
 &&a.itemCount===b.itemCount&&a.etag===b.etag;

export const INDEX_META_READ_518=[
 'SELECT generation,indexed_revision,expected_count,head_etag,status,' +
 'recovery_generation,recovery_revision,recovery_etag,recovery_count,',
 'checked_at_ms,restart_count',
 'FROM music_note_catalog_index_meta_518 WHERE owner_uid=?',
].join(' ');
export const INDEX_META_BEGIN_518=[
 'INSERT OR IGNORE INTO music_note_catalog_index_meta_518',
 '(owner_uid,generation,indexed_revision,expected_count,head_etag,status,checked_at_ms)',
 "VALUES (?, ?, ?, ?, ?, 'building', ?)",
].join(' ');
// Only a verified NEWER R2 revision may replace an incomplete first import.
// The old generation stays invisible. At most 3 rotations, >=60s apart;
// old orphan member rows require separately audited bounded GC later.
export const INDEX_ROTATE_BUILDING_518=[
 'UPDATE music_note_catalog_index_meta_518',
 'SET generation=?,indexed_revision=?,expected_count=?,head_etag=?,',
 'checked_at_ms=?,restart_count=restart_count+1',
 'WHERE owner_uid=? AND generation=? AND indexed_revision=?',
 'AND expected_count=? AND head_etag=? AND status=\'building\'',
 'AND restart_count<3 AND checked_at_ms<=?',
].join(' ');
export const INDEX_MEMBER_STAGE_518=[
 'INSERT OR IGNORE INTO music_note_catalog_member_518',
 '(owner_uid,generation,favorite_id) VALUES (?, ?, ?)',
].join(' ');
export const INDEX_COUNT_518=[
 'SELECT COUNT(*) AS n FROM music_note_catalog_member_518',
 'WHERE owner_uid=? AND generation=?',
].join(' ');
export const INDEX_MARK_READY_518=[
 'UPDATE music_note_catalog_index_meta_518',
 "SET status='ready',checked_at_ms=?",
 "WHERE owner_uid=? AND generation=? AND expected_count=? AND head_etag=? AND status='building'",
].join(' ');
export const INDEX_MEMBER_LOOKUP_518=[
 'SELECT 1 AS present FROM music_note_catalog_member_518',
 'WHERE owner_uid=? AND generation=? AND favorite_id=?',
].join(' ');

// Never call on app open, read, page transition, or retry timer without an
// already SERVER-VERIFIED exact favorite canonical mutation.
export const stageFirstChangedOwnerIndex518=async({
 db,uid,verifiedMutation,loadMaterializedR2Once,readR2HeadAgain,nowMs,
}={})=>{
 const deny=code=>({code,complete:false,r2FullReads:0,d1RowsWritten:0});
 if(!db||typeof db.prepare!=='function'||typeof db.batch!=='function'
   ||!safeUid(uid)||verifiedMutation!==true
   ||typeof loadMaterializedR2Once!=='function'
   ||typeof readR2HeadAgain!=='function'
   ||!Number.isSafeInteger(nowMs)||nowMs<0)return deny('DENY_UNVERIFIED_OR_INVALID');
 let fullReads=0,writes=0;
 try{
   let previous=await db.prepare(INDEX_META_READ_518).bind(uid).first();
   if(previous?.status==='ready'){
     // A ready row MUST be reconciled against current R2 HEAD in the
     // *separate*, conditional per-item writer. Do not silently use its
     // membership after external legacy writes/compaction.
     return {code:'READY_REQUIRES_HEAD_CAS',complete:true,
       indexedRevision:previous.indexed_revision,expectedCount:previous.expected_count,
       headEtag:previous.head_etag,r2FullReads:0,d1RowsWritten:0};
   }
   if(previous?.status&&previous.status!=='building')return deny('DENY_UNKNOWN_STATUS');

   // This provider must itself verify same owner, schema 4, complete status,
   // and materialize BASE+HEAD at one exact HEAD ETag; not a local browser cache.
   const materialized=await loadMaterializedR2Once(uid);
   fullReads++;
   if(materialized?.verifiedByServer!==true||materialized.ownerUid!==uid
     ||materialized.kind!=='musicNote'||materialized.complete!==true
     ||!safeHead(materialized.head)||!Array.isArray(materialized.items)
     ||materialized.items.length!==materialized.head.itemCount
     ||materialized.items.length>maxItems)
     return {code:'DENY_UNVERIFIED_OR_OVERSIZED_SNAPSHOT',complete:false,
       r2FullReads:fullReads,d1RowsWritten:0};
   const head=materialized.head;
   if(previous?.status==='building'&&(previous.generation!==head.headRevision
     ||previous.indexed_revision!==head.headRevision
     ||previous.expected_count!==head.itemCount
     ||previous.head_etag!==head.etag)){
     // Never reuse the same R2 revision with a different ETag: this may
     // represent an untrusted older writer, not a monotonic source change.
     if(!Number.isSafeInteger(previous.generation)
       ||head.headRevision<=previous.generation)
       return {code:'HOLD_NON_MONOTONIC_STAGING_HEAD',complete:false,
         r2FullReads:fullReads,d1RowsWritten:writes};
     if(!Number.isSafeInteger(previous.restart_count)
       ||previous.restart_count>=3)
       return {code:'HOLD_STAGE_RESTART_BUDGET_EXHAUSTED',complete:false,
         r2FullReads:fullReads,d1RowsWritten:writes};
     if(!Number.isSafeInteger(previous.checked_at_ms)
       ||nowMs-previous.checked_at_ms<60000)
       return {code:'RETRYABLE_STAGE_RESTART_COOLDOWN',complete:false,
         r2FullReads:fullReads,d1RowsWritten:writes};
     const rotated=await db.prepare(INDEX_ROTATE_BUILDING_518).bind(
       head.headRevision,head.headRevision,head.itemCount,head.etag,nowMs,
       uid,previous.generation,previous.indexed_revision,
       previous.expected_count,previous.head_etag,nowMs-60000,
     ).run();
     const changed=Math.max(0,Number(rotated?.meta?.changes||0));
     writes+=changed;
     if(changed!==1)
       return {code:'RETRYABLE_CONCURRENT_STAGE_ROTATION',complete:false,
         r2FullReads:fullReads,d1RowsWritten:writes};
     // The old staged generation is never published or read. No deletion
     // of user originals, READY rows or another owner's index occurs.
     previous={generation:head.headRevision,
       indexed_revision:head.headRevision,expected_count:head.itemCount,
       head_etag:head.etag,status:'building',checked_at_ms:nowMs,
       restart_count:previous.restart_count+1};
   }
   const ids=[];
   const seen=new Set();
   for(const row of materialized.items){
     const id=txt(row?.id);
     if(!safeId(id)||seen.has(id))return {code:'DENY_DUPLICATE_OR_BAD_ID',
       complete:false,r2FullReads:fullReads,d1RowsWritten:0};
     seen.add(id);ids.push(id);
   }
   if(!previous){
     const result=await db.prepare(INDEX_META_BEGIN_518)
       .bind(uid,head.headRevision,head.headRevision,head.itemCount,head.etag,nowMs).run();
     writes+=Math.max(0,Number(result?.meta?.changes||0));
     const claim=await db.prepare(INDEX_META_READ_518).bind(uid).first();
     if(claim?.status!=='building'||claim.generation!==head.headRevision
       ||claim.indexed_revision!==head.headRevision
       ||claim.expected_count!==head.itemCount||claim.head_etag!==head.etag)
       return {code:'DENY_CONCURRENT_GENERATION',complete:false,
         r2FullReads:fullReads,d1RowsWritten:writes};
   }
   // All staging is scoped to this (uid,generation). D1 batch() is atomic
   // PER CHUNK. A crash leaves status='building' until safe same-revision retry.
   for(let i=0;i<ids.length;i+=chunkSize){
     const stmts=ids.slice(i,i+chunkSize).map(id=>db.prepare(INDEX_MEMBER_STAGE_518)
       .bind(uid,head.headRevision,id));
     const receipts=await db.batch(stmts);
     if(!Array.isArray(receipts)||receipts.length!==stmts.length
       ||receipts.some(x=>x?.success===false))
       return {code:'RETRYABLE_STAGE_INCOMPLETE',complete:false,
         r2FullReads:fullReads,d1RowsWritten:writes};
     writes+=receipts.reduce((n,x)=>n+Math.max(0,Number(x?.meta?.changes||0)),0);
   }
   const tally=await db.prepare(INDEX_COUNT_518)
     .bind(uid,head.headRevision).first();
   if(Number(tally?.n)!==ids.length)
     return {code:'DENY_INCOMPLETE_INDEX',complete:false,
       r2FullReads:fullReads,d1RowsWritten:writes};
   // A completed D1 index may be published only if unchanged R2 authority
   // is observed after every inserted chunk, not when a stale browser says so.
   const current=await readR2HeadAgain(uid);
   if(!sameHead(head,current))return {code:'RETRYABLE_R2_HEAD_MOVED',
     complete:false,r2FullReads:fullReads,d1RowsWritten:writes};
   const ready=await db.prepare(INDEX_MARK_READY_518).bind(
     nowMs,uid,head.headRevision,head.itemCount,head.etag).run();
   writes+=Math.max(0,Number(ready?.meta?.changes||0));
   if(Number(ready?.meta?.changes||0)!==1)
     return {code:'DENY_CONCURRENT_FINALIZE',complete:false,
       r2FullReads:fullReads,d1RowsWritten:writes};
   return {code:'INDEX_READY',complete:true,
     indexedRevision:head.headRevision,expectedCount:head.itemCount,
     headEtag:head.etag,r2FullReads:fullReads,d1RowsWritten:writes};
 }catch{
   return {code:'RETRYABLE_INDEX_IO_ERROR',complete:false,
     r2FullReads:fullReads,d1RowsWritten:writes};
 }
};

// Exact membership lookup requires the caller to compare both generation
// and ETag with R2 HEAD before any itemCount delta / conditional put.
// "building" and mismatched HEAD are never treated as "not present".
export const readIndexedMembership518=async({db,uid,documentId,r2Head}={})=>{
 if(!db||typeof db.prepare!=='function'||!safeUid(uid)||!safeId(documentId)
   ||!safeHead(r2Head))return {code:'DENY_UNVERIFIED'};
 try{
   const meta=await db.prepare(INDEX_META_READ_518).bind(uid).first();
   if(meta?.status!=='ready')return {code:'DENY_INDEX_NOT_READY'};
   if(meta.indexed_revision!==r2Head.headRevision||meta.head_etag!==r2Head.etag
     ||meta.expected_count!==r2Head.itemCount)
     return {code:'DENY_INDEX_HEAD_DRIFT'};
   const result=await db.prepare(INDEX_MEMBER_LOOKUP_518)
     .bind(uid,meta.generation,documentId).first();
   return {code:'EXACT_MEMBERSHIP',present:!!result,
     requiresSameHeadConditionalPut:true};
 }catch{return {code:'DENY_INDEX_READ_ERROR'};}
};

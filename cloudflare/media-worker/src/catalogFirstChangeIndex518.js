// app518 first-confirmed-change membership import — INACTIVE and never called
// by the deployed Worker. Owner's already-materialized R2 Catalog is read
// exactly once for initial staging; Firestore favorites are NEVER scanned.
// Each staged D1 chunk is transactional. "building" is NEVER readable by
// a live per-item writer. A final exact R2 HEAD recheck is mandatory.
// This index is only a *membership hint*: source versions/deletions still
// come exclusively from verified Firestore -> D1 outbox.

import {CatalogR2ContractError518} from './catalogR2Provider518.js';

const txt=x=>typeof x==='string'?x.trim():'';
// One parameterized SQLite JSON1 statement inserts a bounded page; each page
// is atomic and reduces D1 statements without limiting the owner's song count.
const chunkSize=512;
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
 'checked_at_ms,restart_count,recovery_restart_count,recovery_checked_at_ms',
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
// One atomic SQLite statement: a stale stage cannot insert AFTER a
// concurrent READY promotion or after its generation/HEAD was replaced.
export const INDEX_MEMBER_BULK_STAGE_518=[
 'INSERT OR IGNORE INTO music_note_catalog_member_518',
 '(owner_uid,generation,favorite_id)',
 'SELECT ?, ?, value FROM json_each(?)',
 'WHERE EXISTS (SELECT 1 FROM music_note_catalog_index_meta_518',
 "WHERE owner_uid=? AND generation=? AND indexed_revision=?",
 "AND head_etag=? AND expected_count=? AND status='building')",
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
 reserveWriteBudget,
}={})=>{
 const deny=code=>({code,complete:false,r2FullReads:0,d1RowsWritten:0});
 if(!db||typeof db.prepare!=='function'||typeof db.batch!=='function'
   ||!safeUid(uid)||verifiedMutation!==true
   ||typeof loadMaterializedR2Once!=='function'
   ||typeof readR2HeadAgain!=='function'
   ||!Number.isSafeInteger(nowMs)||nowMs<0)return deny('DENY_UNVERIFIED_OR_INVALID');
 if(typeof reserveWriteBudget!=='function')
  return deny('HOLD_D1_GLOBAL_WRITERS_UNVERIFIED');
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

   // P2: A suspended first import must cheaply verify the R2 HEAD before
   // materializing N songs. Same HEAD resumes the staged generation; a
   // changed HEAD cannot rotate within the 60s cooldown or after 3 tries.
   // Never trust caller-supplied/unverified owner or R2 authority.
   let checkedHead=null;
   if(previous?.status==='building'){
     checkedHead=await readR2HeadAgain(uid);
     if(checkedHead?.verifiedByServer!==true||checkedHead.ownerUid!==uid
       ||checkedHead.fencedWritersVerified!==true||!safeHead(checkedHead))
       return deny('DENY_UNVERIFIED_RESTART_HEAD');
     const unchanged=previous.generation===checkedHead.headRevision
       &&previous.indexed_revision===checkedHead.headRevision
       &&previous.expected_count===checkedHead.itemCount
       &&previous.head_etag===checkedHead.etag;
     if(!unchanged){
       if(!Number.isSafeInteger(previous.generation)
         ||checkedHead.headRevision<=previous.generation)
         return deny('HOLD_NON_MONOTONIC_STAGING_HEAD');
       if(!Number.isSafeInteger(previous.restart_count)
         ||previous.restart_count>=3)
         return deny('HOLD_STAGE_RESTART_BUDGET_EXHAUSTED');
       if(!Number.isSafeInteger(previous.checked_at_ms)
         ||nowMs-previous.checked_at_ms<60000)
         return deny('RETRYABLE_STAGE_RESTART_COOLDOWN');
     }
     // Never reject an authenticated owner solely for exceeding 20k songs.
     // Remaining capacity depends on worker resources, not an arbitrary count.
   }

   // This provider must itself verify same owner, schema 4, complete status,
   // and materialize BASE+HEAD at one exact HEAD ETag; not a local browser cache.
   const materialized=await loadMaterializedR2Once(uid);
   fullReads++;
   if(materialized?.verifiedByServer!==true||materialized.ownerUid!==uid
     ||materialized.kind!=='musicNote'||materialized.complete!==true
     ||!safeHead(materialized.head)||!Array.isArray(materialized.items)
     ||materialized.items.length!==materialized.head.itemCount)
     return {code:'DENY_UNVERIFIED_OR_OVERSIZED_SNAPSHOT',complete:false,
       r2FullReads:fullReads,d1RowsWritten:0};
   const head=materialized.head;
   // If R2 changed after our cheap HEAD check, never publish or rotate
   // against a different materialization. A later bounded attempt retries.
   if(checkedHead&&!sameHead(checkedHead,head))
     return {code:checkedHead.headRevision===head.headRevision
       ?'HOLD_NON_MONOTONIC_STAGING_HEAD':'RETRYABLE_R2_HEAD_MOVED',
       complete:false,r2FullReads:fullReads,d1RowsWritten:writes};
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
   // Direct first-index callers cannot bypass the shared daily budget.
   // Owners >256 take the bounded paged path in the server bridge.
   if(ids.length>256)return deny('HOLD_D1_FIRST_INDEX_REQUIRES_PAGING');
   const reservation=await reserveWriteBudget({
    nowMs,requestedRows:ids.length+4,
   });
   if(reservation?.reserved!==true)
    return deny(reservation?.code||'HOLD_D1_GLOBAL_WRITERS_UNVERIFIED');
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
   // A single parameterized SQLite JSON1 statement atomically stages each
   // bounded ID page. No per-song SQL statements or truncated owner index.
   // Crash leaves an invisible building generation; exact-HEAD retry is
   // idempotent and inserts only missing IDs.
   for(let i=0;i<ids.length;i+=chunkSize){
     const result=await db.prepare(INDEX_MEMBER_BULK_STAGE_518)
       .bind(uid,head.headRevision,JSON.stringify(ids.slice(i,i+chunkSize)),
         uid,head.headRevision,head.headRevision,head.etag,head.itemCount).run();
     const changed=Number(result?.meta?.changes);
     if(!Number.isSafeInteger(changed)||changed<0||changed>Math.min(chunkSize,ids.length-i))
       return {code:'RETRYABLE_STAGE_INCOMPLETE',complete:false,
         r2FullReads:fullReads,d1RowsWritten:writes};
     writes+=changed;
   }
   const tally=await db.prepare(INDEX_COUNT_518)
     .bind(uid,head.headRevision).first();
   if(Number(tally?.n)!==ids.length)
     return {code:'DENY_INCOMPLETE_INDEX',complete:false,
       r2FullReads:fullReads,d1RowsWritten:writes};
   // A completed D1 index may be published only if unchanged R2 authority
   // is observed after every inserted chunk, not when a stale browser says so.
   const current=await readR2HeadAgain(uid);
   if(current?.verifiedByServer!==true||current.ownerUid!==uid
     ||current.fencedWritersVerified!==true||!safeHead(current))
     return {code:'DENY_UNVERIFIED_RECHECK_HEAD',complete:false,
       r2FullReads:fullReads,d1RowsWritten:writes};
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
 }catch(error){
   return {code:error?.code?.startsWith('HOLD_D1_')?error.code:
   error instanceof CatalogR2ContractError518
     ?'DENY_R2_OWNER_OR_SCHEMA_CONTRACT':'RETRYABLE_INDEX_IO_ERROR',
     complete:false,r2FullReads:fullReads,d1RowsWritten:writes};
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

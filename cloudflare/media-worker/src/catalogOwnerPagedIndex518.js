// app518 inactive: durable per-owner large catalog staging, under Free D1
// per-invocation limits. Runs ONLY on a server-verified pending mutation;
// no page-open, migration, R2 rewrite, or user-original modification.
// Each invocation does <=4 BASE pages (256 IDs each), then returns a durable
// continuation. Existing READY generations are never modified before CAS.
import {
 INDEX_META_READ_518,INDEX_META_BEGIN_518,INDEX_ROTATE_BUILDING_518,
 INDEX_MEMBER_BULK_STAGE_518,INDEX_COUNT_518,INDEX_MARK_READY_518,
} from './catalogFirstChangeIndex518.js';
import {
 RECOVERY_CLAIM_518,RECOVERY_ROTATE_518,RECOVERY_PROMOTE_518,
} from './catalogCompactionRecovery518.js';
import {CatalogR2ContractError518} from './catalogR2Provider518.js';
import {isValidCatalogJournal} from './catalogJournal.js';
const t=x=>typeof x==='string'?x.trim():'';
const modeValid=x=>x==='first'||x==='recovery';
const uidValid=x=>t(x).length>0&&t(x).length<=128&&!/[\\/]/.test(t(x));
const idValid=x=>t(x).length>0&&t(x).length<=240&&t(x)!=='.'&&t(x)!=='..'&&!/[\\/]/.test(t(x));
const PAGE=256,MAX_PAGES=4,MAX_DELTAS=3;
const failure=code=>({code,complete:false});
const READ_PAGE_518='SELECT * FROM music_note_catalog_paged_stage_518 WHERE owner_uid=? AND generation=? AND mode=?';
const BEGIN_PAGE_518=[
 'INSERT OR IGNORE INTO music_note_catalog_paged_stage_518',
 '(owner_uid,generation,mode,head_revision,head_etag,head_count,base_key,base_etag,base_size,base_offset,base_seen,phase,delta_index,updated_at_ms)',
 "VALUES (?,?,?,?,?,?,?,?,?,0,0,'base',0,?)",
].join(' ');
// Every membership mutation must independently check the same page cursor
// AND the unpublished generation. A D1 batch transaction does NOT undo
// earlier statements when its final cursor CAS returns changes=0.
const cursorOwnerReady518=mode=>`EXISTS (
 SELECT 1 FROM music_note_catalog_paged_stage_518 AS p
 JOIN music_note_catalog_index_meta_518 AS m ON m.owner_uid=p.owner_uid
 WHERE p.owner_uid=? AND p.generation=? AND p.mode=? AND p.phase='${mode}'
 AND p.head_etag=?
 AND ((p.mode='first' AND m.status='building'
       AND m.generation=p.generation AND m.head_etag=p.head_etag)
   OR (p.mode='recovery' AND m.status='ready'
       AND m.recovery_generation=p.generation
       AND m.recovery_etag=p.head_etag))
`;
export const PAGED_BASE_INSERT_518=[
 'INSERT OR IGNORE INTO music_note_catalog_member_518',
 '(owner_uid,generation,favorite_id)',
 'SELECT ?,?,j.value FROM json_each(?) AS j WHERE',
 cursorOwnerReady518('base'),
 'AND p.base_offset=? AND p.base_seen=? AND p.base_etag=?)',
].join(' ');
export const PAGED_DELTA_INSERT_518=[
 'INSERT OR IGNORE INTO music_note_catalog_member_518',
 '(owner_uid,generation,favorite_id)',
 'SELECT ?,?,j.value FROM json_each(?) AS j WHERE',
 cursorOwnerReady518('delta'),
 'AND p.delta_index=?)',
].join(' ');
export const PAGED_DELTA_DELETE_518=[
 'DELETE FROM music_note_catalog_member_518',
 'WHERE owner_uid=? AND generation=?',
 'AND favorite_id IN (SELECT value FROM json_each(?))',
 'AND',cursorOwnerReady518('delta'),'AND p.delta_index=?)',
].join(' ');
export const ADVANCE_BASE_518=[
 'UPDATE music_note_catalog_paged_stage_518 SET',
 'base_offset=?,base_seen=?,phase=?,updated_at_ms=?',
 "WHERE owner_uid=? AND generation=? AND mode=? AND phase='base'",
 'AND base_offset=? AND base_seen=? AND head_etag=? AND base_etag=?',
 'AND EXISTS (SELECT 1 FROM music_note_catalog_index_meta_518 AS m',
 'WHERE m.owner_uid=? AND',
 "((mode='first' AND m.status='building' AND m.generation=music_note_catalog_paged_stage_518.generation AND m.head_etag=music_note_catalog_paged_stage_518.head_etag)",
 "OR (mode='recovery' AND m.status='ready' AND m.recovery_generation=music_note_catalog_paged_stage_518.generation AND m.recovery_etag=music_note_catalog_paged_stage_518.head_etag)))",
].join(' ');
export const ADVANCE_DELTA_518=[
 'UPDATE music_note_catalog_paged_stage_518 SET',
 'delta_index=?,phase=?,updated_at_ms=?',
 "WHERE owner_uid=? AND generation=? AND mode=? AND phase='delta'",
 'AND delta_index=? AND head_etag=?',
 'AND EXISTS (SELECT 1 FROM music_note_catalog_index_meta_518 AS m',
 'WHERE m.owner_uid=? AND',
 "((mode='first' AND m.status='building' AND m.generation=music_note_catalog_paged_stage_518.generation AND m.head_etag=music_note_catalog_paged_stage_518.head_etag)",
 "OR (mode='recovery' AND m.status='ready' AND m.recovery_generation=music_note_catalog_paged_stage_518.generation AND m.recovery_etag=music_note_catalog_paged_stage_518.head_etag)))",
].join(' ');
const sameHead=(a,b)=>a.headRevision===b.headRevision
 &&a.itemCount===b.itemCount&&a.etag===b.etag;
const trusted=(s,uid)=>s?.verifiedByServer===true&&s.ownerUid===uid
 &&s.fencedWritersVerified===true&&t(s.etag)
 &&isValidCatalogJournal(s.head,'musicNote')
 &&s.head.canonicalAuthority518===true;
const changed=r=>Number(r?.meta?.changes||0);
export const advancePagedOwnerIndex518=async({
 db,uid,mode,verifiedPendingMutation,nowMs,readOwnerHead,baseReader,projectItem,
 reserveWriteBudget,
}={})=>{
 if(!db?.prepare||!db?.batch||!uidValid(uid)||!modeValid(mode)
  ||verifiedPendingMutation!==true||!Number.isSafeInteger(nowMs)||nowMs<0
  ||typeof readOwnerHead!=='function'||typeof baseReader?.inspect!=='function'
  ||typeof baseReader?.page!=='function'||typeof projectItem!=='function')
  return failure('DENY_PAGED_ARGUMENTS');
 let writes=0,pages=0;
 try{
  const state=await readOwnerHead(uid);
  if(!trusted(state,uid))return failure('DENY_PAGED_HEAD_UNVERIFIED');
  const head=state.head,etag=state.etag,gen=head.headRevision;
  let previous=await db.prepare(INDEX_META_READ_518).bind(uid).first();
  if(mode==='first'&&previous?.status==='ready')
   return {code:'READY_REQUIRES_HEAD_CAS',complete:true};
  // 4*256 inserts plus cursor/meta/delta writes per bounded invocation.
  // Reserve BEFORE the first actual D1 write, across all owners, in the
  // account-wide budget. Old/unmetered writers invalidate attestation.
  if(typeof reserveWriteBudget!=='function')
   return failure('HOLD_D1_DAILY_BUDGET_UNVERIFIED');
  // Delta continuation performs <=3 bounded delta changes, not 1,024
  // membership inserts. Reserving 1,040 on every delta tick would strand
  // 50k owners under the Free daily cap without actually using rows.
  const priorCursor=await db.prepare(READ_PAGE_518).bind(uid,gen,mode).first();
  const requestedRows=priorCursor?.phase==='delta'?16:1040;
  const budget=await reserveWriteBudget({nowMs,requestedRows});
  if(budget?.reserved!==true)
   return failure(budget?.code||'HOLD_D1_DAILY_BUDGET_UNVERIFIED');
  if(mode==='first'){
   if(previous?.status&&previous.status!=='building')
    return failure('DENY_PAGED_INDEX_STATUS');
   if(previous){
    if(previous.generation!==gen||previous.head_etag!==etag
      ||previous.expected_count!==head.itemCount){
     if(gen<=previous.generation)return failure('HOLD_PAGED_NON_MONOTONIC_HEAD');
     if(previous.restart_count>=3)return failure('HOLD_PAGED_RESTART_EXHAUSTED');
     if(nowMs-previous.checked_at_ms<60000)return failure('RETRYABLE_PAGED_ROTATE_COOLDOWN');
     const rotate=await db.prepare(INDEX_ROTATE_BUILDING_518).bind(
      gen,gen,head.itemCount,etag,nowMs,uid,previous.generation,
      previous.indexed_revision,previous.expected_count,previous.head_etag,
      nowMs-60000).run();
     if(changed(rotate)!==1)return failure('RETRYABLE_PAGED_ROTATION_RACE');
     writes++;
    }
   }else{
    const claim=await db.prepare(INDEX_META_BEGIN_518)
     .bind(uid,gen,gen,head.itemCount,etag,nowMs).run();
    writes+=changed(claim);
   }
  }else{
   if(previous?.status!=='ready'
     ||!Number.isSafeInteger(previous.generation)
     ||!Number.isSafeInteger(previous.indexed_revision)
     ||head.baseRevision<=previous.indexed_revision
     ||gen<=previous.indexed_revision||gen<=previous.generation)
    return failure('DENY_PAGED_NOT_COMPACTION_GAP');
   if(previous.recovery_generation!=null){
    if(previous.recovery_generation!==gen
      ||previous.recovery_revision!==gen
      ||previous.recovery_etag!==etag
      ||previous.recovery_count!==head.itemCount){
     if(gen<=previous.recovery_revision)
      return failure('HOLD_PAGED_RECOVERY_NON_MONOTONIC');
     if(previous.recovery_restart_count>=3)
      return failure('HOLD_PAGED_RECOVERY_RESTART_EXHAUSTED');
     if(nowMs-previous.recovery_checked_at_ms<60000)
      return failure('RETRYABLE_PAGED_RECOVERY_COOLDOWN');
     const rotate=await db.prepare(RECOVERY_ROTATE_518).bind(
      gen,gen,etag,head.itemCount,nowMs,uid,previous.generation,
      previous.indexed_revision,previous.head_etag,
      previous.recovery_generation,previous.recovery_revision,
      previous.recovery_etag,previous.recovery_count,nowMs-60000).run();
     if(changed(rotate)!==1)return failure('RETRYABLE_PAGED_RECOVERY_RACE');
     writes++;
    }
   }else{
    const claim=await db.prepare(RECOVERY_CLAIM_518).bind(
     gen,gen,etag,head.itemCount,nowMs,uid,previous.generation,
     previous.indexed_revision,previous.head_etag).run();
    if(changed(claim)!==1)return failure('RETRYABLE_PAGED_RECOVERY_RACE');
    writes++;
   }
  }
  previous=await db.prepare(INDEX_META_READ_518).bind(uid).first();
  if(mode==='first'&&(previous?.status!=='building'
    ||previous.generation!==gen||previous.head_etag!==etag))
   return failure('RETRYABLE_PAGED_CLAIM_RACE');
  if(mode==='recovery'&&(previous?.status!=='ready'
    ||previous.recovery_generation!==gen||previous.recovery_etag!==etag))
   return failure('RETRYABLE_PAGED_CLAIM_RACE');
  const meta=await baseReader.inspect({uid,head});
  await db.prepare(BEGIN_PAGE_518).bind(
   uid,gen,mode,gen,etag,head.itemCount,meta.baseKey,meta.baseEtag,
   meta.baseSize,nowMs).run();
  let progress=await db.prepare(READ_PAGE_518).bind(uid,gen,mode).first();
  if(!progress||progress.head_etag!==etag||progress.head_count!==head.itemCount
    ||progress.base_key!==meta.baseKey||progress.base_etag!==meta.baseEtag
    ||progress.base_size!==meta.baseSize)
   return failure('HOLD_PAGED_PROGRESS_CONTRACT');
  while(progress.phase==='base'&&pages<MAX_PAGES){
   const next=await baseReader.page({
    uid,head,baseEtag:meta.baseEtag,baseSize:meta.baseSize,
    offset:progress.base_offset,seen:progress.base_seen,pageSize:PAGE,
   });
   if(next.offset<=progress.base_offset||next.seen<progress.base_seen
     ||next.seen-progress.base_seen>PAGE)
    return failure('HOLD_PAGED_CURSOR_INVALID');
   const phase=next.done?'delta':'base';
   const stmts=[
    db.prepare(PAGED_BASE_INSERT_518)
      .bind(uid,gen,JSON.stringify(next.ids),uid,gen,mode,etag,
        progress.base_offset,progress.base_seen,meta.baseEtag),
    db.prepare(ADVANCE_BASE_518).bind(next.offset,next.seen,phase,
      nowMs,uid,gen,mode,progress.base_offset,progress.base_seen,
      etag,meta.baseEtag,uid),
   ];
   const batch=await db.batch(stmts);
   if(!Array.isArray(batch)||batch.some(x=>x?.success===false)
     ||changed(batch[1])!==1)return failure('RETRYABLE_PAGED_BATCH_RACE');
   writes+=changed(batch[0])+1;
   pages++;
   progress={...progress,base_offset:next.offset,base_seen:next.seen,phase};
  }
  let deltas=0;
  while(progress.phase==='delta'&&deltas<MAX_DELTAS){
   const idx=progress.delta_index;
   if(idx>=head.deltas.length)break;
   const delta=head.deltas[idx];
   // Per-delta input bounded by the validated 768KiB HEAD; never use
   // untrusted browser IDs or overwrite the published READY generation.
   const deleted=delta.deletedIds.map(t);
   const added=[];
   for(const raw of delta.upserts){
    const id=t(raw?.id);
    if(!idValid(id))return failure('DENY_PAGED_DELTA_ID');
    const projected=projectItem(raw,id);
    if(projected){if(t(projected.id)!==id)
      return failure('DENY_PAGED_DELTA_PROJECTION');added.push(id);}
    else deleted.push(id);
   }
   if(deleted.some(x=>!idValid(x)))
    return failure('DENY_PAGED_DELTA_ID');
   const count=await db.prepare(INDEX_COUNT_518).bind(uid,gen).first();
   if(Number(count?.n)!==delta.baseItemCount)
    return failure('HOLD_PAGED_DELTA_BASE_COUNT');
   const batch=await db.batch([
    db.prepare(PAGED_DELTA_DELETE_518)
     .bind(uid,gen,JSON.stringify(deleted),uid,gen,mode,etag,idx),
    db.prepare(PAGED_DELTA_INSERT_518)
     .bind(uid,gen,JSON.stringify(added),uid,gen,mode,etag,idx),
    db.prepare(ADVANCE_DELTA_518).bind(idx+1,'delta',nowMs,
     uid,gen,mode,idx,etag,uid),
   ]);
   if(!Array.isArray(batch)||batch.some(x=>x?.success===false)
     ||changed(batch[2])!==1)return failure('RETRYABLE_PAGED_DELTA_RACE');
   writes+=changed(batch[0])+changed(batch[1])+1;
   const after=await db.prepare(INDEX_COUNT_518).bind(uid,gen).first();
   if(Number(after?.n)!==delta.nextItemCount)
    return failure('HOLD_PAGED_DELTA_COUNT');
   progress={...progress,delta_index:idx+1};
   deltas++;
  }
  if(progress.phase==='delta'&&progress.delta_index>=head.deltas.length){
   const finalCount=await db.prepare(INDEX_COUNT_518).bind(uid,gen).first();
   if(Number(finalCount?.n)!==head.itemCount)
    return failure('HOLD_PAGED_INCOMPLETE_MEMBER_COUNT');
   const finalHead=await readOwnerHead(uid);
   if(!trusted(finalHead,uid)||!sameHead(
      {...head,etag},{...finalHead.head,etag:finalHead.etag}))
    return failure('RETRYABLE_PAGED_HEAD_CHANGED');
   const sql=mode==='first'?INDEX_MARK_READY_518:RECOVERY_PROMOTE_518;
   const args=mode==='first'
    ?[nowMs,uid,gen,head.itemCount,etag]
    :[nowMs,uid,previous.generation,previous.indexed_revision,
      previous.head_etag,gen,gen,etag,head.itemCount];
   const publish=await db.prepare(sql).bind(...args).run();
   if(changed(publish)!==1)return failure('RETRYABLE_PAGED_FINAL_CAS');
   writes++;
   return {code:mode==='first'?'INDEX_READY':'RECOVERY_PROMOTED',
    complete:true,memberCount:head.itemCount,d1Writes:writes,pages};
  }
  return {code:'PAGING_IN_PROGRESS',complete:false,
   memberCount:progress.base_seen,d1Writes:writes,pages};
 }catch(error){
  return failure(error instanceof CatalogR2ContractError518
   ?'DENY_PAGED_R2_CONTRACT':'RETRYABLE_PAGED_IO');
 }
};

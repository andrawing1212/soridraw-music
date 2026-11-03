
import { isValidCatalogJournal } from './catalogJournal.js';

// Only rebase exact historical changes for DISJOINT item IDs. A full-row
// upsert has no trustworthy field-level intent and overlapping changes
// (including delete/re-add) MUST remain pending for manual resolution.
export const planCatalogCutoverReplayDelta = (head, delta) => {
  const hold = reason => ({status:'HOLD',reason});
  if (!delta || !['library','musicNote'].includes(delta.kind)
    || !Array.isArray(delta.upserts) || !Array.isArray(delta.deletedIds)
    || !Number.isSafeInteger(delta.baseRevision) || delta.baseRevision<=0
    || !Number.isSafeInteger(delta.baseItemCount) || delta.baseItemCount<0
    || !Number.isSafeInteger(delta.nextItemCount) || delta.nextItemCount<0
    || !isValidCatalogJournal(head,delta.kind))return hold('JOURNAL_OR_DELTA_INVALID');
  const touched=new Set();
  for(const id of delta.deletedIds){
    if(typeof id!=='string'||!id.trim()||touched.has(id.trim()))return hold('DUPLICATE_TOUCHED_ID');
    touched.add(id.trim());
  }
  for(const row of delta.upserts){
    const id=typeof row?.id==='string'?row.id.trim():'';
    if(!id || touched.has(id))return hold('DUPLICATE_TOUCHED_ID');
    touched.add(id);
  }
  if(!touched.size || delta.baseRevision>head.headRevision || delta.baseRevision<head.baseRevision)
    return hold('BASE_OUTSIDE_RETAINED_JOURNAL');
  if(delta.nextItemCount>delta.baseItemCount+delta.upserts.length
    ||delta.nextItemCount<Math.max(0,delta.baseItemCount-delta.deletedIds.length))
    return hold('ITEM_COUNT_INCONSISTENT');
  const rebased=delta.baseRevision!==head.headRevision;
  if(rebased){
    const start=head.deltas.findIndex(row=>row.baseRevision===delta.baseRevision);
    if(start<0||head.deltas[start].baseItemCount!==delta.baseItemCount)
      return hold('HISTORY_NOT_PROVABLE');
    let cursor=delta.baseRevision;
    for(const row of head.deltas.slice(start)){
      if(row.baseRevision!==cursor)return hold('JOURNAL_GAP');
      if(row.mutationId===delta.mutationId)return hold('DUPLICATE_RECEIPT_UNVERIFIED');
      for(const id of row.deletedIds)if(touched.has(id))return hold('OVERLAPPING_ITEM_CONFLICT');
      for(const item of row.upserts)if(touched.has(item.id))return hold('OVERLAPPING_ITEM_CONFLICT');
      cursor=row.revision;
    }
    if(cursor!==head.headRevision)return hold('JOURNAL_GAP');
  } else if(delta.baseItemCount!==head.itemCount)return hold('BASE_COUNT_MISMATCH');
  const nextItemCount=head.itemCount+delta.nextItemCount-delta.baseItemCount;
  const revision=Math.max(Number(delta.revision)||0,head.headRevision+1);
  if(!Number.isSafeInteger(nextItemCount)||nextItemCount<0||nextItemCount>20000
    ||!Number.isSafeInteger(revision))return hold('ADJUSTED_VALUE_INVALID');
  return {status:'READY',rebased,delta:{...delta,baseRevision:head.headRevision,
    baseItemCount:head.itemCount,nextItemCount,revision}};
};

// Staged/disabled shared-Catalog cutover guard. Never activate before ALL legacy
// Writers are fenced outside the Worker and a compatible rollback is pinned.
// A 503 is intentional: old clients must NEVER treat a queued intent as saved.
export const CUTOVER_PENDING_LIMIT = 32;
export const CUTOVER_PENDING_BYTES = 512 * 1024;
const text = value => typeof value === 'string' ? value.trim() : '';
const bytes = value => new TextEncoder().encode(value).length;
const fail = reason => { throw new Error('CATALOG_CUTOVER_' + reason); };
export const catalogCutoverHoldEnabled = env => String(env?.SORIDRAW_CATALOG_CUTOVER_HOLD_V1 || '') === '1';
export const cutoverOutboxKey = (uid, kind) => {
  if (!text(uid) || !['musicNote','library'].includes(kind)) fail('INVALID_SCOPE');
  return 'catalog/cutover/v1/' + encodeURIComponent(uid) + '/' + kind + '/pending.json';
};
const empty = (uid, kind) => ({ schemaVersion: 1, uid, kind, entries: [] });
const validate = (record, uid, kind) => {
  if (!record || record.schemaVersion !== 1 || record.uid !== uid
    || record.kind !== kind || !Array.isArray(record.entries)
    || record.entries.length > CUTOVER_PENDING_LIMIT) fail('OUTBOX_INVALID');
  const ids = new Set();
  for (const entry of record.entries) {
    const id = text(entry?.mutationId);
    if (!id || id.length > 240 || ids.has(id) || !entry.delta
      || entry.delta.mutationId !== id || entry.delta.kind !== kind
      || !['pending','committed'].includes(entry.status)) fail('OUTBOX_INVALID');
    if (entry.status === 'committed'
      && (!Number.isSafeInteger(entry.receiptRevision) || entry.receiptRevision <= 0)) fail('OUTBOX_INVALID');
    ids.add(id);
  }
  return record;
};
const read = async (bucket, uid, kind) => {
  if (!bucket?.get || !bucket?.put) fail('PRIVATE_CATALOG_UNAVAILABLE');
  const object = await bucket.get(cutoverOutboxKey(uid,kind));
  if (!object) return {record: empty(uid,kind),etag:null};
  let raw;
  try { raw = await object.text(); } catch { fail('OUTBOX_UNREADABLE'); }
  if (bytes(raw) > CUTOVER_PENDING_BYTES) fail('OUTBOX_OVERSIZED');
  let parsed;
  try { parsed = JSON.parse(raw); } catch { fail('OUTBOX_CORRUPT'); }
  return {record:validate(parsed,uid,kind),etag:text(object.etag)};
};
const put = async (bucket, uid, kind, record, etag) => {
  validate(record,uid,kind);
  const encoded=JSON.stringify(record);
  if (bytes(encoded)>CUTOVER_PENDING_BYTES) fail('OUTBOX_FULL');
  return bucket.put(cutoverOutboxKey(uid,kind),encoded,{
    httpMetadata:{contentType:'application/json; charset=utf-8',cacheControl:'private, no-store'},
    onlyIf: etag ? {etagMatches:etag} : {etagDoesNotMatch:'*'},
  });
};
// R2 must durably accept the exact authenticated mutation BEFORE returning
// even a retryable response. A failed CAS/write never yields a success ACK.
export const persistCatalogCutoverPending = async (bucket,uid,kind,delta) => {
  const id=text(delta?.mutationId);
  if (!id || id.length>240 || delta?.kind!==kind || !Number.isInteger(delta?.baseRevision)) fail('DELTA_INVALID');
  for(let attempt=0;attempt<4;attempt++){
    const {record,etag}=await read(bucket,uid,kind);
    const existing=record.entries.find(entry=>entry.mutationId===id);
    if(existing){
      if(JSON.stringify(existing.delta)!==JSON.stringify(delta)) fail('MUTATION_ID_REUSED');
      return {held:true,pendingCount:record.entries.filter(entry=>entry.status==='pending').length,duplicate:true};
    }
    // Retrying browsers may mint a new mutationId for the SAME pending
    // body after 503. Do not grow R2 outbox for an identical pending intent.
    const comparable = value => JSON.stringify({...value,mutationId:undefined,revision:undefined});
    if(record.entries.some(entry=>entry.status==='pending' && comparable(entry.delta)===comparable(delta)))
      return {held:true,pendingCount:record.entries.filter(entry=>entry.status==='pending').length,duplicate:true};
    if(record.entries.length>=CUTOVER_PENDING_LIMIT) fail('OUTBOX_FULL');
    const next={...record,entries:[...record.entries,{mutationId:id,status:'pending',delta}]};
    const stored=await put(bucket,uid,kind,next,etag);
    if(stored)return {held:true,pendingCount:next.entries.length,duplicate:false};
  }
  fail('OUTBOX_CAS_CONFLICT');
};
const isReceipt = (proof,id) => proof?.confirmed === true && proof.mutationId === id
  && Number.isSafeInteger(proof.revision) && proof.revision>0;
// Explicit operator-only replay building block; never called by HTTP/page load.
// Caller must verify old Writer ingress block and exact pinned versions itself.
// The queue is RETAINED even after confirmation; never automatically purge.
export const replayCatalogCutoverPending = async ({bucket,uid,kind,barrier,readReceipt,readJournalHead,commit}) => {
  // Operator-provided booleans are not Cloudflare control-plane proof.
  // No HTTP route invokes this code. Absent exclusive replay lease => HOLD.
  if (!barrier || barrier.allWritersFenced!==true || barrier.exactVersionsVerified!==true
    || barrier.rollbackVersionsPinned!==true || barrier.authorizedReplay!==true
    || barrier.exclusiveReplayLeaseVerified!==true
    || barrier.allPendingDiscoverableVerified!==true) fail('REPLAY_NOT_AUTHORIZED');
  if(typeof readReceipt!=='function'||typeof readJournalHead!=='function'
    ||typeof commit!=='function')fail('REPLAY_HANDLERS_MISSING');
  let {record}=await read(bucket,uid,kind);
  let confirmed=0;
  for(const item of record.entries){
    if(item.status==='committed')continue;
    // A missing/failed proof is NOT permission to drop or blindly rebase.
    let proof=await readReceipt(item.delta);
    if(!isReceipt(proof,item.mutationId)){
      const head=await readJournalHead(uid,kind);
      const plan=planCatalogCutoverReplayDelta(head,item.delta);
      if(plan.status!=='READY')return {status:'HOLD',reason:plan.reason,confirmed};
      // Exact mutationId is retained. Caller commit MUST use journal CAS.
      const result=await commit(plan.delta);
      if(result?.ok!==true||result?.conflict)return {status:'HOLD',reason:'REVISION_OR_WRITE_CONFLICT',confirmed};
      proof=await readReceipt(item.delta);
      if(!isReceipt(proof,item.mutationId))return {status:'HOLD',reason:'DURABLE_RECEIPT_UNCONFIRMED',confirmed};
    }
    let marked=false;
    for(let attempt=0;attempt<4;attempt++){
      const state=await read(bucket,uid,kind);
      const old=state.record.entries.find(entry=>entry.mutationId===item.mutationId);
      if(!old||JSON.stringify(old.delta)!==JSON.stringify(item.delta))fail('OUTBOX_CHANGED');
      if(old.status==='committed'){marked=true;break;}
      const next={...state.record,entries:state.record.entries.map(entry=>
        entry.mutationId===item.mutationId?{...entry,status:'committed',receiptRevision:proof.revision}:entry)};
      if(await put(bucket,uid,kind,next,state.etag)){marked=true;break;}
    }
    if(!marked)return {status:'HOLD',reason:'RECEIPT_CAS_UNCONFIRMED',confirmed};
    confirmed++;
  }
  return {status:'RETAINED_RECEIPTS',confirmed};
};

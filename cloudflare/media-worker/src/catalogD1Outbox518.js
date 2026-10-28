// app518 D1 durable per-song outbox; deliberately NOT imported by live Worker.
// No DB bindings, endpoints, shared writes, deployments or cron in this PR.
// No user song content stored. Authority: server-verified Firestore version only.
import {parseFirestoreUpdateTimeNs518} from './catalogCanonicalFence518.js';
const text=x=>typeof x==='string'?x.trim():'';
const okId=x=>text(x).length>0&&text(x).length<=240&&!/[\\/]/.test(text(x));
const okUid=x=>text(x).length>0&&text(x).length<=128&&!/[\\/]/.test(text(x));
const okState=x=>x==='saved'||x==='removed';
const epoch=x=>Number.isSafeInteger(x)&&x>=0;
const database=db=>db&&typeof db.prepare==='function';

export const UPSERT_CANONICAL_518=[
 'INSERT INTO music_note_catalog_outbox_518',
 '(owner_uid,favorite_id,source_version_ns,desired_state,ack_version_ns,attempt_count,next_attempt_ms,updated_at_ms,acked_at_ms)',
 'VALUES (?, ?, ?, ?, NULL, 0, 0, ?, NULL)',
 'ON CONFLICT(owner_uid,favorite_id) DO UPDATE SET',
 'source_version_ns=excluded.source_version_ns,',
 'desired_state=excluded.desired_state,',
 'attempt_count=0, next_attempt_ms=0, updated_at_ms=excluded.updated_at_ms',
 'WHERE excluded.source_version_ns > music_note_catalog_outbox_518.source_version_ns',
].join('\n');
export const SELECT_DUE_518=[
 'SELECT owner_uid,favorite_id,source_version_ns,desired_state,attempt_count',
 'FROM music_note_catalog_outbox_518',
 'WHERE (ack_version_ns IS NULL OR ack_version_ns != source_version_ns)',
 'AND next_attempt_ms <= ?',
 'ORDER BY next_attempt_ms,owner_uid,favorite_id LIMIT ?',
].join('\n');
export const ACK_EXACT_518=[
 'UPDATE music_note_catalog_outbox_518',
 'SET ack_version_ns=source_version_ns,acked_at_ms=?,attempt_count=0',
 'WHERE owner_uid=? AND favorite_id=? AND source_version_ns=?',
 'AND (ack_version_ns IS NULL OR ack_version_ns != source_version_ns)',
].join('\n');
export const REQUEUE_EXACT_518=[
 'UPDATE music_note_catalog_outbox_518',
 'SET attempt_count=attempt_count+1,next_attempt_ms=?,updated_at_ms=?',
 'WHERE owner_uid=? AND favorite_id=? AND source_version_ns=?',
 'AND (ack_version_ns IS NULL OR ack_version_ns != source_version_ns)',
 'AND attempt_count=?',
].join('\n');
export const READ_ONE_518=[
 'SELECT owner_uid,favorite_id,source_version_ns,desired_state,ack_version_ns,attempt_count,next_attempt_ms',
 'FROM music_note_catalog_outbox_518 WHERE owner_uid=? AND favorite_id=?',
].join('\n');

export const enqueueVerifiedFavorite518=async({
 db,uid,documentId,sourceUpdateTime,state,verifiedByServer,nowMs,
}={})=>{
 if(!database(db)||!okUid(uid)||!okId(documentId)||!okState(state)
   ||verifiedByServer!==true||!epoch(nowMs))
   return {code:'DENY_UNVERIFIED_OR_UNVERSIONED',d1Writes:0};
 const version=parseFirestoreUpdateTimeNs518(sourceUpdateTime);
 if(!version)return {code:'DENY_UNVERIFIED_OR_UNVERSIONED',d1Writes:0};
 const q=await db.prepare(UPSERT_CANONICAL_518)
   .bind(text(uid),text(documentId),version,state,nowMs).run();
 const writes=Math.max(0,Number(q?.meta?.changes||0));
 return {code:writes===1?'ENQUEUED':'STALE_OR_DUPLICATE',
   d1Writes:writes,sourceVersionNs:version};
};
export const getDueFavoriteChanges518=async({db,nowMs,limit=128}={})=>{
 if(!database(db)||!epoch(nowMs)||!Number.isInteger(limit)||limit<1||limit>256)
   return {code:'DENY_ARGUMENTS',rows:[]};
 const result=await db.prepare(SELECT_DUE_518).bind(nowMs,limit).all();
 return {code:'OK',rows:Array.isArray(result?.results)?result.results:[]};
};
// Success path D1 W1 enqueue + W1 ACK; no claim write.
// Concurrent deliveries are allowed ONLY if the eventual R2 writer has
// durable source-version CAS/idempotency and fresh canonical verification.
export const acknowledgeExactFavorite518=async({
 db,uid,documentId,sourceVersionNs,nowMs,r2VerifiedVersionNs,
}={})=>{
 if(!database(db)||!okUid(uid)||!okId(documentId)||!epoch(nowMs)
   ||!/^\d{16,21}$/.test(text(sourceVersionNs))
   ||r2VerifiedVersionNs!==sourceVersionNs)
   return {code:'DENY_UNVERIFIED_R2_ACK',d1Writes:0};
 const result=await db.prepare(ACK_EXACT_518).bind(
   nowMs,text(uid),text(documentId),sourceVersionNs).run();
 const writes=Math.max(0,Number(result?.meta?.changes||0));
 return {code:writes===1?'ACKED':'STALE_OR_ALREADY_ACKED',d1Writes:writes};
};
export const boundedRetryDelay518=attempts=>{
 if(!Number.isSafeInteger(attempts)||attempts<0)return null;
 return Math.min(3600000,5000*2**Math.min(10,attempts));
};
export const scheduleFailedFavorite518=async({
 db,uid,documentId,sourceVersionNs,nowMs,attemptCount,
}={})=>{
 if(!database(db)||!okUid(uid)||!okId(documentId)||!epoch(nowMs)
   ||!/^\d{16,21}$/.test(text(sourceVersionNs)))
   return {code:'DENY_ARGUMENTS',d1Writes:0};
 const delay=boundedRetryDelay518(attemptCount);
 if(delay===null||!Number.isSafeInteger(nowMs+delay))
   return {code:'DENY_ARGUMENTS',d1Writes:0};
 const next=nowMs+delay;
 const result=await db.prepare(REQUEUE_EXACT_518).bind(
   next,nowMs,text(uid),text(documentId),sourceVersionNs,attemptCount).run();
 const writes=Math.max(0,Number(result?.meta?.changes||0));
 return {code:writes===1?'RETRY_SCHEDULED':'STALE_OR_ALREADY_ACKED',
   d1Writes:writes,retryAtMs:writes?next:undefined};
};
// Exact admin-only diagnostic; never called on app open.
export const readExactOutbox518=async({db,uid,documentId}={})=>{
 if(!database(db)||!okUid(uid)||!okId(documentId))
   return {code:'DENY_ARGUMENTS'};
 const row=await db.prepare(READ_ONE_518).bind(
   text(uid),text(documentId)).first();
 return {code:'OK',row:row||null};
};

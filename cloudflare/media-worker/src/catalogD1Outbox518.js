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
 'attempt_count=0, manual_recovery_count=0, next_attempt_ms=0, hold_reason=NULL, updated_at_ms=excluded.updated_at_ms',
 'WHERE excluded.source_version_ns > music_note_catalog_outbox_518.source_version_ns',
].join('\n');
export const SELECT_DUE_518=[
 'SELECT owner_uid,favorite_id,source_version_ns,desired_state,attempt_count',
 'FROM music_note_catalog_outbox_518',
 'WHERE (ack_version_ns IS NULL OR ack_version_ns != source_version_ns)',
 'AND hold_reason IS NULL AND next_attempt_ms <= ?',
 'ORDER BY next_attempt_ms,owner_uid,favorite_id LIMIT ?',
].join('\n');
export const SELECT_DUE_PILOT_518=SELECT_DUE_518.replace(
 'ORDER BY next_attempt_ms,owner_uid,favorite_id LIMIT ?',
 'AND owner_uid=? AND favorite_id=? ORDER BY next_attempt_ms,owner_uid,favorite_id LIMIT ?'
);
export const ACK_EXACT_518=[
 'UPDATE music_note_catalog_outbox_518',
 'SET ack_version_ns=source_version_ns,acked_at_ms=?,attempt_count=0',
 'WHERE owner_uid=? AND favorite_id=? AND source_version_ns=?',
 'AND (ack_version_ns IS NULL OR ack_version_ns != source_version_ns)',
 'AND hold_reason IS NULL',
].join('\n');
export const REQUEUE_EXACT_518=[
 'UPDATE music_note_catalog_outbox_518',
 'SET attempt_count=attempt_count+1,next_attempt_ms=?,updated_at_ms=?',
 'WHERE owner_uid=? AND favorite_id=? AND source_version_ns=?',
 'AND (ack_version_ns IS NULL OR ack_version_ns != source_version_ns)',
 'AND attempt_count=? AND hold_reason IS NULL',
].join('\n');
// A successfully advancing multi-invocation owner import is NOT a network
// failure; schedule the next page without incrementing the eight-attempt
// IO failure budget. The cursor's atomic progress is already durable in D1.
export const DEFER_PAGED_518=[
 'UPDATE music_note_catalog_outbox_518',
 'SET next_attempt_ms=?,updated_at_ms=?',
 'WHERE owner_uid=? AND favorite_id=? AND source_version_ns=?',
 'AND (ack_version_ns IS NULL OR ack_version_ns != source_version_ns)',
 'AND hold_reason IS NULL AND next_attempt_ms <= ?',
].join('\n');
export const deferPagedFavorite518=async({
 db,uid,documentId,sourceVersionNs,nowMs,
}={})=>{
 if(!database(db)||!okUid(uid)||!okId(documentId)||!epoch(nowMs)
   ||!/^[0-9]{21}$/.test(text(sourceVersionNs)))
  return {code:'DENY_PAGED_DEFER_ARGUMENTS',d1Writes:0};
 // 10 seconds ensures a real scheduler boundary: no hot retry loop.
 const next=nowMs+10000;
 const result=await db.prepare(DEFER_PAGED_518)
  .bind(next,nowMs,text(uid),text(documentId),sourceVersionNs,nowMs).run();
 const writes=Math.max(0,Number(result?.meta?.changes||0));
 return {code:writes===1?'PAGE_CONTINUATION_SCHEDULED':'STALE_OR_ALREADY_DEFERRED',
  d1Writes:writes,retryAtMs:writes?next:undefined};
};
// Daily bulk-budget exhaustion is NOT a permanent source-contract HOLD.
// Only an exact pending version is deferred to next UTC day. The metered
// DB allows this tagged UPDATE using its separate bounded control reserve.
export const DEFER_DAILY_BUDGET_518=[
 '/* APP518_DAILY_PAUSE_CONTROL_518 */',
 'UPDATE music_note_catalog_outbox_518',
 'SET next_attempt_ms=?,updated_at_ms=?',
 'WHERE owner_uid=? AND favorite_id=? AND source_version_ns=?',
 'AND (ack_version_ns IS NULL OR ack_version_ns != source_version_ns)',
 'AND hold_reason IS NULL AND next_attempt_ms <= ?',
].join(' ');
export const deferDailyBudgetFavorite518=async({
 db,uid,documentId,sourceVersionNs,nowMs,
}={})=>{
 if(!database(db)||!okUid(uid)||!okId(documentId)||!epoch(nowMs)
   ||!/^[0-9]{21}$/.test(text(sourceVersionNs)))
  return {code:'DENY_BUDGET_DEFER_ARGUMENTS',d1Writes:0};
 const next=(Math.floor(nowMs/86400000)+1)*86400000+60000;
 const result=await db.prepare(DEFER_DAILY_BUDGET_518)
  .bind(next,nowMs,text(uid),text(documentId),sourceVersionNs,nowMs).run();
 const writes=Number(result?.meta?.changes||0);
 return {code:writes===1?'DAILY_BUDGET_DEFERRED':'STALE_BUDGET_DEFER',
  d1Writes:writes===1?1:0,retryAtMs:writes===1?next:undefined};
};
export const HOLD_EXACT_518=[
 'UPDATE music_note_catalog_outbox_518',
 'SET hold_reason=?,updated_at_ms=?',
 'WHERE owner_uid=? AND favorite_id=? AND source_version_ns=?',
 'AND (ack_version_ns IS NULL OR ack_version_ns != source_version_ns)',
 'AND hold_reason IS NULL',
].join('\n');
// Server-only, signed recovery: same version, owner, state and one attempt.
export const RESUME_EXHAUSTED_EXACT_518=[
 'UPDATE music_note_catalog_outbox_518',
 'SET hold_reason=NULL,attempt_count=0,manual_recovery_count=1,next_attempt_ms=?,updated_at_ms=?',
 'WHERE owner_uid=? AND favorite_id=? AND source_version_ns=?',
 'AND desired_state=? AND hold_reason=? AND manual_recovery_count=0',
 'AND (ack_version_ns IS NULL OR ack_version_ns != source_version_ns)',
].join('\n');
export const READ_ONE_518=[
 'SELECT owner_uid,favorite_id,source_version_ns,desired_state,ack_version_ns,attempt_count,next_attempt_ms,hold_reason,manual_recovery_count',
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
// Exact pilot owner/song restriction uses the indexed primary key only.
export const getDueFavoriteChanges518=async({
 db,nowMs,limit=128,pilotUid,pilotDocumentId,
}={})=>{
 if(!database(db)||!epoch(nowMs)||!Number.isInteger(limit)||limit<1||limit>256)
   return {code:'DENY_ARGUMENTS',rows:[]};
 const pilot=pilotUid!==undefined||pilotDocumentId!==undefined;
 if(pilot&&(!okUid(pilotUid)||!okId(pilotDocumentId)))
   return {code:'DENY_PILOT_SCOPE',rows:[]};
 const result=pilot
   ?await db.prepare(SELECT_DUE_PILOT_518).bind(nowMs,text(pilotUid),text(pilotDocumentId),limit).all()
   :await db.prepare(SELECT_DUE_518).bind(nowMs,limit).all();
 return {code:'OK',rows:Array.isArray(result?.results)?result.results:[]};
};
// Success path D1 W1 enqueue + W1 ACK; no claim write.
// Concurrent deliveries are allowed ONLY if the eventual R2 writer has
// durable source-version CAS/idempotency and fresh canonical verification.
export const acknowledgeExactFavorite518=async({
 db,uid,documentId,sourceVersionNs,nowMs,r2VerifiedVersionNs,
}={})=>{
 if(!database(db)||!okUid(uid)||!okId(documentId)||!epoch(nowMs)
   ||!/^\d{21}$/.test(text(sourceVersionNs))
   ||r2VerifiedVersionNs!==sourceVersionNs)
   return {code:'DENY_UNVERIFIED_R2_ACK',d1Writes:0};
 const result=await db.prepare(ACK_EXACT_518).bind(
   nowMs,text(uid),text(documentId),sourceVersionNs).run();
 const writes=Math.max(0,Number(result?.meta?.changes||0));
 return {code:writes===1?'ACKED':'STALE_OR_ALREADY_ACKED',d1Writes:writes};
};
export const resumeExhaustedExactFavorite518=async({
 db,uid,documentId,sourceUpdateTime,state,verifiedByServer,nowMs,
}={})=>{
 if(!database(db)||!okUid(uid)||!okId(documentId)
   ||!okState(state)||verifiedByServer!==true||!epoch(nowMs))
  return {code:'DENY_UNVERIFIED_RECOVERY',d1Writes:0};
 const version=parseFirestoreUpdateTimeNs518(sourceUpdateTime);
 if(!version||!Number.isSafeInteger(nowMs+60000))
  return {code:'DENY_UNVERIFIED_RECOVERY',d1Writes:0};
 const next=nowMs+60000;
 const result=await db.prepare(RESUME_EXHAUSTED_EXACT_518).bind(
  next,nowMs,text(uid),text(documentId),version,state,
  'RETRY_BUDGET_EXHAUSTED',
 ).run();
 const writes=Math.max(0,Number(result?.meta?.changes||0));
 return {code:writes===1?'RETRY_ARMED':'RECOVERY_NOT_ELIGIBLE',
  d1Writes:writes,retryAtMs:writes?next:undefined};
};
// Persistent source-outbox rows are never deleted. Once the bounded retry
// budget is exhausted the same version is HELD instead of polling hourly
// forever. A newer verified source version clears this HOLD automatically.
export const MAX_RETRY_ATTEMPTS_518=8;
const HOLD_CODES_518=new Set([
 'CANONICAL_FENCE','SOURCE_CONTRACT','INDEX_CONTRACT',
 'RETRY_BUDGET_EXHAUSTED','MANUAL_REVIEW_REQUIRED',
]);
export const holdExactFavorite518=async({
 db,uid,documentId,sourceVersionNs,nowMs,reason,
}={})=>{
 if(!database(db)||!okUid(uid)||!okId(documentId)||!epoch(nowMs)
   ||!/^[0-9]{21}$/.test(text(sourceVersionNs))
   ||!HOLD_CODES_518.has(reason))
   return {code:'DENY_HOLD_ARGUMENTS',d1Writes:0};
 const result=await db.prepare(HOLD_EXACT_518).bind(
   reason,nowMs,text(uid),text(documentId),sourceVersionNs).run();
 const writes=Math.max(0,Number(result?.meta?.changes||0));
 return {code:writes===1?'HELD':'STALE_OR_ALREADY_HELD',
   d1Writes:writes};
};
export const boundedRetryDelay518=attempts=>{
 if(!Number.isSafeInteger(attempts)||attempts<0)return null;
 return Math.min(3600000,5000*2**Math.min(10,attempts));
};
export const scheduleFailedFavorite518=async({
 db,uid,documentId,sourceVersionNs,nowMs,attemptCount,
}={})=>{
 if(!database(db)||!okUid(uid)||!okId(documentId)||!epoch(nowMs)
   ||!/^\d{21}$/.test(text(sourceVersionNs)))
   return {code:'DENY_ARGUMENTS',d1Writes:0};
 if(!Number.isSafeInteger(attemptCount)||attemptCount<0)
   return {code:'DENY_ARGUMENTS',d1Writes:0};
 if(attemptCount>=MAX_RETRY_ATTEMPTS_518)
   return holdExactFavorite518({
    db,uid,documentId,sourceVersionNs,nowMs,
    reason:'RETRY_BUDGET_EXHAUSTED',
   });
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

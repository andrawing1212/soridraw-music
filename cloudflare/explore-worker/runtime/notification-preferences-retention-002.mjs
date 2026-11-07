// Dormant server-side notification preference + retention candidate.
// A future authenticated Worker route may call these methods after shared D1
// migration/activation approval. No import from the active Worker/SPA.
const validUid = x => typeof x === 'string' && x.length > 0 && x.length <= 256 &&
  x === x.trim() && !/[\u0000-\u001f]/.test(x);
const fail = code => Object.assign(new Error(code), {code,status:409});
export const NOTIFICATION_RETENTION_MS_002 = 30 * 24 * 60 * 60 * 1000;
export const NOTIFICATION_DEFAULT_PREFS_002 = Object.freeze({
  master: true, like: true, follow: true, complete: true,
  announcement: true, message: true,
});
const keys = Object.keys(NOTIFICATION_DEFAULT_PREFS_002);

function parseRow(row) {
  if (!row) return {revision:0, ...NOTIFICATION_DEFAULT_PREFS_002};
  return {
    revision: Number(row.revision),
    master: row.master_enabled === 1, like: row.like_enabled === 1,
    follow: row.follow_enabled === 1, complete: row.complete_enabled === 1,
    announcement: row.announcement_enabled === 1, message: row.message_enabled === 1,
  };
}
async function resolveUid(authenticate) {
  if (typeof authenticate !== 'function') throw fail('NOTIFICATION_AUTH_REQUIRED');
  const uid = await authenticate();
  if (!validUid(uid)) throw fail('NOTIFICATION_AUTH_REQUIRED');
  return uid;
}
const requireDb = db => {
  if (!db || typeof db.prepare !== 'function') throw fail('NOTIFICATION_DB_UNAVAILABLE');
};
export async function readOwnNotificationPreferences002({
  db, authenticate, activated = false,
} = {}) {
  if (!activated) return {status:'inactive'};
  requireDb(db);
  const uid = await resolveUid(authenticate);
  const row = await db.prepare(`SELECT revision, master_enabled, like_enabled,
    follow_enabled, complete_enabled, announcement_enabled, message_enabled
    FROM soridraw_notification_preferences_002 WHERE user_uid=? LIMIT 1`)
    .bind(uid).first();
  return {status:'ok', preferences:parseRow(row)};
}

// One changed account setting -> 1 D1 UPSERT (W0 on retry/no change).
// CAS revision fences simultaneous PC/mobile settings, rejects stale writers.
// The caller must save the conflict's returned revision and ask user intent
// before retrying. A browser may not forge the account UID.
export async function saveOwnNotificationPreferences002({
  db, authenticate, activated = false, requested, now = Date.now(),
} = {}) {
  if (!activated) return {status:'inactive',rowsWritten:0};
  requireDb(db);
  const uid = await resolveUid(authenticate);
  if (!requested || typeof requested !== 'object' || Array.isArray(requested) ||
      Object.keys(requested).some(k=>!keys.includes(k) &&
        k!=='expectedRevision' && k!=='operationId') ||
      keys.some(k=>typeof requested[k]!=='boolean') ||
      !Number.isSafeInteger(requested.expectedRevision) || requested.expectedRevision<0 ||
      !/^[A-Za-z0-9_-]{16,128}$/.test(requested.operationId||'') ||
      !Number.isSafeInteger(now) || now<=0)
    throw fail('NOTIFICATION_PREFERENCES_INVALID');
  const wanted = Object.fromEntries(keys.map(k=>[k, requested[k]]));
  if (requested.expectedRevision === 0 &&
      keys.every(k=>wanted[k] === NOTIFICATION_DEFAULT_PREFS_002[k]))
    return {status:'unchanged',rowsWritten:0,preferences:{
      revision:0,...NOTIFICATION_DEFAULT_PREFS_002}};
  const bools=keys.map(k=>wanted[k]?1:0);
  // New account and existing account use different atomic statements.
  // A SELECT gated on expectedRevision=0 cannot execute an UPSERT for
  // revision>0: ON CONFLICT is never reached when the SELECT yields zero rows.
  // INSERT OR IGNORE and revision-fenced UPDATE each cost one D1 statement
  // on the successful changed-value path; no pre-read and no lost updates.
  const returning=` RETURNING revision,master_enabled,like_enabled,follow_enabled,
      complete_enabled,announcement_enabled,message_enabled`;
  let query;
  let args;
  if (requested.expectedRevision === 0) {
    query=`INSERT OR IGNORE INTO soridraw_notification_preferences_002(
      user_uid,master_enabled,like_enabled,follow_enabled,complete_enabled,
      announcement_enabled,message_enabled,revision,operation_id,updated_at)
      VALUES (?,?,?,?,?,?,?,1,?,?)`+returning;
    args=[uid,...bools,requested.operationId,now];
  } else {
    query=`UPDATE soridraw_notification_preferences_002 SET
      master_enabled=?,like_enabled=?,follow_enabled=?,complete_enabled=?,
      announcement_enabled=?,message_enabled=?,revision=revision+1,
      operation_id=?,updated_at=?
      WHERE user_uid=? AND revision=? AND operation_id<>?
      AND (master_enabled<>? OR like_enabled<>? OR follow_enabled<>?
        OR complete_enabled<>? OR announcement_enabled<>? OR message_enabled<>?)`+returning;
    args=[...bools,requested.operationId,now,uid,requested.expectedRevision,
      requested.operationId,...bools];
  }
  const updated=await db.prepare(query).bind(...args).all();
  if (!Array.isArray(updated?.results) || updated.results.length>1)
    throw fail('NOTIFICATION_PREFERENCES_WRITE_UNVERIFIED');
  if (updated.results.length===1)
    return {status:'saved',rowsWritten:1,preferences:parseRow(updated.results[0])};
  const current=await readOwnNotificationPreferences002({
    db,authenticate:async()=>uid,activated:true});
  const same=keys.every(k=>current.preferences[k]===wanted[k]);
  if (same) return {status:'unchanged',rowsWritten:0,preferences:current.preferences};
  return {status:'conflict',rowsWritten:0,preferences:current.preferences};
}

// One optional bounded global cleanup pass; no per-user polling or full scan.
// To enforce a 30-day physical expiry, later release must schedule a single
// controlled batch on a proven DB index and verify it drains backlog.
// The endpoint is never auto-invoked by app entry or a user's inbox read.
export async function cleanupExpiredNotificationInbox002({
  db, activated=false, now=Date.now(), limit=100,
}={}) {
  if (!activated) return {status:'inactive',rowsDeleted:0};
  requireDb(db);
  if(!Number.isSafeInteger(now)||now<=NOTIFICATION_RETENTION_MS_002||
     !Number.isSafeInteger(limit)||limit<1||limit>200)
    throw fail('NOTIFICATION_CLEANUP_INVALID');
  const cutoff=now-NOTIFICATION_RETENTION_MS_002;
  const result=await db.prepare(`DELETE FROM soridraw_notification_inbox_001
    WHERE (receiver_uid,bucket_ms,category,actor_uid,subject_id) IN (
      SELECT receiver_uid,bucket_ms,category,actor_uid,subject_id
      FROM soridraw_notification_inbox_001
      WHERE created_at < ? ORDER BY created_at ASC LIMIT ?)`)
    .bind(cutoff,limit).run();
  const deleted=result?.meta?.changes;
  if(!Number.isSafeInteger(deleted)||deleted<0||deleted>limit)
    throw fail('NOTIFICATION_CLEANUP_UNVERIFIED');
  return {status:'ok',rowsDeleted:deleted};
}

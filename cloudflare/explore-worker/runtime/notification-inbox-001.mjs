// SORIDRAW notification inbox candidate. NOT imported by any active Worker.
// Shared D1 migration and activation require a separate safety release gate.
const WINDOW_HOURS = new Set([1, 2, 3, 4, 6, 12, 24]);
const id = (v, n) => typeof v === 'string' && v.length > 0 && v.length <= n &&
  v.trim() === v && !/[\u0000-\u001f]/.test(v);
const invalid = code => Object.assign(new Error(code), {code, status: 403});
const MAX_WINDOW_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const NOTIFICATION_SHARED_ANNOUNCEMENT_KEY_001 = 'internal/notifications/global-announcements-v1.json';

// verifyFinalized MUST be a server-owned callback bound to actual canonical
// settlement, never a mapping of client claims or a batch intake ACK.
// This additive projection MUST NOT change the like/follow ACK behavior.
export async function recordConfirmedSocialNotification001({
  db, sourceEvent, verifyFinalized, activated = false, digestHours = 2,
  now = Date.now(),
} = {}) {
  if (!activated) return {status: 'inactive', rowsWritten: 0};
  if (!db?.prepare || typeof verifyFinalized !== 'function' ||
      !WINDOW_HOURS.has(digestHours) || !Number.isSafeInteger(now))
    throw invalid('NOTIFICATION_PROOF_OR_DB_UNAVAILABLE');
  const proof = await verifyFinalized(sourceEvent);
  // Ignore no-op, unlike, unfollow, or unsettled mutations.
  if (!proof || proof.settled !== true || proof.changed !== true || proof.enabled !== true)
    return {status: 'no-final-change', rowsWritten: 0};
  const {category, actorUid, receiverUid, subjectId, occurredAtMs} = proof;
  if (category !== 'like' && category !== 'follow')
    throw invalid('NOTIFICATION_INVALID_CATEGORY');
  if (!id(actorUid, 256) || !id(receiverUid, 256) ||
      !id(subjectId, 512) || !Number.isSafeInteger(occurredAtMs) ||
      occurredAtMs < now - MAX_WINDOW_AGE_MS || occurredAtMs > now + 5 * 60 * 1000)
    throw invalid('NOTIFICATION_INVALID_FINALIZED_IDENTITY');
  if (actorUid === receiverUid) return {status: 'self', rowsWritten: 0};
  const bucketMs = digestHours * 3600000;
  // Stable canonical timestamp, not retry arrival time, anchors the window.
  const bucket = Math.floor(occurredAtMs / bucketMs) * bucketMs;
  const actorName = id(proof.actorName, 80) ? proof.actorName : '사용자';
  const subjectTitle = id(proof.subjectTitle, 120) ? proof.subjectTitle : '';
  const result = await db.prepare(`INSERT OR IGNORE INTO soridraw_notification_inbox_001
    (receiver_uid, bucket_ms, category, actor_uid, subject_id, actor_name, subject_title, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      receiverUid, bucket, category, actorUid, subjectId, actorName, subjectTitle, occurredAtMs
    ).run();
  const changes = result?.meta?.changes;
  if (changes !== 0 && changes !== 1)
    throw invalid('NOTIFICATION_WRITE_ACK_UNKNOWN');
  return {status: changes === 1 ? 'recorded' : 'duplicate', rowsWritten: changes};
}

// authenticate MUST return the verified JWT user UID. Never trust a
// client-chosen recipient UID or list every user to discover alerts.
export async function readOwnNotificationInbox001({
  db, authenticate, activated = false, limit = 30, now=Date.now(),
} = {}) {
  if (!activated) return {status: 'inactive', items: []};
  if (!db?.prepare || typeof authenticate !== 'function' ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 30 ||
      !Number.isSafeInteger(now) || now<=0)
    throw invalid('NOTIFICATION_READ_UNAVAILABLE');
  const uid = await authenticate();
  if (!id(uid, 256)) throw invalid('NOTIFICATION_NOT_AUTHENTICATED');
  // Primary-key prefix is the signed-in UID. The 24h margin covers every
  // allowed digest bucket (1-24 hours) while the exact 30d cutoff hides old rows.
  const cutoff = now - 30*24*60*60*1000;
  const result = await db.prepare(`SELECT category, actor_uid AS actorUid,
    subject_id AS subjectId, actor_name AS actorName,
    subject_title AS subjectTitle, created_at AS createdAt
    FROM soridraw_notification_inbox_001
    WHERE receiver_uid = ? AND bucket_ms >= ? AND created_at >= ?
    ORDER BY bucket_ms DESC LIMIT ?`)
    .bind(uid, cutoff-24*60*60*1000, cutoff, limit).all();
  if (!Array.isArray(result?.results) || result.results.length > limit)
    throw invalid('NOTIFICATION_READ_INVALID');
  return {status: 'ok', items: result.results};
}

// One global row per announcement, never copied to every recipient.
// verifyAdmin MUST check server-side admin permission, not request claims.
export async function publishGlobalAnnouncement001({
  db, announcement, verifyAdmin, activated = false,
} = {}) {
  if (!activated) return {status: 'inactive', rowsWritten: 0};
  if (!db?.prepare || typeof verifyAdmin !== 'function' ||
      await verifyAdmin() !== true) throw invalid('NOTIFICATION_ADMIN_DENIED');
  const a = announcement;
  if (!a || !id(a.id, 128) || !id(a.title, 220) || !id(a.body, 4000) ||
      !Number.isSafeInteger(a.publishedAtMs) || a.publishedAtMs <= 0)
    throw invalid('NOTIFICATION_INVALID_ANNOUNCEMENT');
  const result = await db.prepare(`INSERT OR IGNORE INTO soridraw_global_announcements_001
    (id, title, body, published_at) VALUES (?, ?, ?, ?)`).bind(
      a.id, a.title, a.body, a.publishedAtMs).run();
  if (![0, 1].includes(result?.meta?.changes))
    throw invalid('NOTIFICATION_ANNOUNCEMENT_ACK_UNKNOWN');
  return {status: result.meta.changes === 1 ? 'published' : 'duplicate',
    rowsWritten: result.meta.changes};
}

// Bounded query for an eventual common edge/R2 snapshot publisher on change.
// Never call it once per recipient.
export async function readGlobalAnnouncements001({
  db, activated = false, limit = 10,
} = {}) {
  if (!activated) return {status: 'inactive', items: []};
  if (!db?.prepare || !Number.isSafeInteger(limit) || limit < 1 || limit > 20)
    throw invalid('NOTIFICATION_ANNOUNCEMENT_READ_UNAVAILABLE');
  const result = await db.prepare(`SELECT id, title, body,
    published_at AS publishedAt FROM soridraw_global_announcements_001
    ORDER BY published_at DESC LIMIT ?`).bind(limit).all();
  if (!Array.isArray(result?.results) || result.results.length > limit)
    throw invalid('NOTIFICATION_ANNOUNCEMENT_READ_INVALID');
  return {status: 'ok', items: result.results};
}

// Stage416: disabled candidate for a SHARED-D1 atomic per-UID private intake.
// Caller MUST authenticate uid; server assigns all clocks. Do not activate
// while old TEST/PRODUCTION writers can bypass the same canonical authority.
const CLOCK_PERIODS_416 = new Set([1, 3, 5, 10, 20]);
const MAX_PENDING_TRACKS_416 = 256;
const MAX_BATCH_416 = 50;
const TABLE_416 = 'explore_like_private_pending_416';
const ms416 = (minutes) => minutes * 60_000;

const finiteTime416 = (value) => Number.isSafeInteger(value) && value > 0;
const jsonPath416 = (trackId) => '$."' +
  trackId.replaceAll('\\', '\\\\').replaceAll('"', '\\"') + '"';
const validTrack416 = (trackId) => typeof trackId === 'string' &&
  trackId.length > 0 && trackId.length <= 512;
const validOp416 = (operationId) => typeof operationId === 'string' &&
  /^[0-9a-f-]{36}$/i.test(operationId);
const rows416 = (record) => {
  const object = JSON.parse(record.mutations_json);
  if (!object || typeof object !== 'object' || Array.isArray(object)) throw Error('416_BAD_PENDING');
  const rows = Object.entries(object).map(([trackId, value]) => {
    if (!validTrack416(trackId) || typeof value?.liked !== 'boolean' ||
        !validOp416(value?.operationId)) throw Error('416_BAD_PENDING');
    return { trackId, liked: value.liked };
  }).sort((a, b) => a.trackId.localeCompare(b.trackId));
  if (!rows.length || rows.length > MAX_PENDING_TRACKS_416 ||
      rows.length !== Number(record.pending_count)) throw Error('416_BAD_COUNT');
  return rows;
};
const id416 = async (uid, windowId, version, chunkIndex, chunk) => {
  const source = [uid, windowId, version, chunkIndex, JSON.stringify(chunk)].join('\n');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
};
// Exact one-record mutation per real click; page visits never invoke this.
// This is intentionally NOT a zero-cost design. Each click adds one D1 write.
export async function registerPrivateClick416(db, uid, input, serverNowMs, configuredMinutes = 5) {
  if (!uid || typeof uid !== 'string' || uid.length > 128 ||
      !validTrack416(input?.trackId) || typeof input?.liked !== 'boolean' ||
      !validOp416(input?.operationId) || !finiteTime416(serverNowMs) ||
      !CLOCK_PERIODS_416.has(configuredMinutes)) throw Error('416_BAD_CLICK');
  const trackId = input.trackId;
  const path = jsonPath416(trackId);
  const opPath = path + '.operationId';
  const windowId = crypto.randomUUID();
  const payload = JSON.stringify({ [trackId]: {
    liked: input.liked, operationId: input.operationId,
  } });
  const sql = [
    'INSERT INTO ' + TABLE_416 +
      '(user_uid,window_id,version,opened_at,last_click_at,deadline_at,minutes,pending_count,mutations_json)',
    'VALUES (?, ?, 1, ?, ?, ?, ?, 1, ?)',
    'ON CONFLICT(user_uid) DO UPDATE SET',
    'version=' + TABLE_416 + '.version+1,',
    'last_click_at=MAX(' + TABLE_416 + '.last_click_at+1,excluded.last_click_at),',
    'deadline_at=MAX(' + TABLE_416 + '.last_click_at+1,excluded.last_click_at)+' +
      TABLE_416 + '.minutes*60000,',
    'pending_count=' + TABLE_416 + '.pending_count +',
      'CASE WHEN json_type(' + TABLE_416 + '.mutations_json,?) IS NULL THEN 1 ELSE 0 END,',
    'mutations_json=json_patch(' + TABLE_416 + '.mutations_json,excluded.mutations_json)',
    'WHERE (' + TABLE_416 + '.pending_count < ? OR',
      'json_type(' + TABLE_416 + '.mutations_json,?) IS NOT NULL)',
    'AND json_extract(' + TABLE_416 + '.mutations_json,?) IS NOT ?',
    'RETURNING window_id,version,last_click_at,deadline_at,minutes,pending_count',
  ].join(' ');
  const row = await db.prepare(sql).bind(
    uid, windowId, serverNowMs, serverNowMs,
    serverNowMs + ms416(configuredMinutes), configuredMinutes, payload,
    path, MAX_PENDING_TRACKS_416, path, opPath, input.operationId,
  ).first();
  // Duplicate operation (or full bounded map) performs NO write.
  if (!row) return { accepted: false, reason: 'DUPLICATE_OR_LIMIT' };
  return { accepted: true, windowId: row.window_id, version: Number(row.version),
    deadlineAt: Number(row.deadline_at), minutes: Number(row.minutes),
    pendingCount: Number(row.pending_count) };
}
// This is the ACTUAL atomic D1 queue handoff candidate. A read-only snapshot
// is used to construct <=50-track batches; every INSERT and the conditional
// DELETE commit in one D1.batch transaction. A newer click between SELECT
// and batch is detected by window_id + version; it cannot be silently lost.
export async function commitPrivateWindow416(db, uid, serverNowMs) {
  if (!uid || typeof uid !== 'string' || uid.length > 128 ||
      !finiteTime416(serverNowMs)) throw Error('416_BAD_COMMIT');
  const snapshot = await db.prepare('SELECT * FROM ' + TABLE_416 +
    ' WHERE user_uid=? LIMIT 1').bind(uid).first();
  if (!snapshot) return { committed: false, reason: 'EMPTY' };
  if (serverNowMs < Number(snapshot.deadline_at)) return {
    committed: false, reason: 'NOT_DUE',
    retryAfterMs: Number(snapshot.deadline_at) - serverNowMs,
  };
  const mutations = rows416(snapshot);
  const chunks = [];
  for (let i = 0; i < mutations.length; i += MAX_BATCH_416) {
    chunks.push(mutations.slice(i, i + MAX_BATCH_416));
  }
  const baseAt = Math.max(serverNowMs, Number(snapshot.deadline_at));
  const statements = [];
  const batchIds = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const batchAt = baseAt + i;
    const digest = await id416(uid, snapshot.window_id, snapshot.version, i, chunks[i]);
    const batchId = 'l069_' + String(batchAt).padStart(13, '0') + '_' + digest;
    batchIds.push(batchId);
    statements.push(db.prepare(
      'INSERT OR IGNORE INTO explore_like_batches_069' +
      '(batch_id,user_uid,created_at,mutation_count,mutations_json)' +
      ' SELECT ?,user_uid,?,?,? FROM ' + TABLE_416 +
      ' WHERE user_uid=? AND window_id=? AND version=? AND deadline_at<=?'
    ).bind(batchId, batchAt, chunks[i].length,
      JSON.stringify(chunks[i]), uid, snapshot.window_id, snapshot.version, serverNowMs));
  }
  statements.push(db.prepare('DELETE FROM ' + TABLE_416 +
    ' WHERE user_uid=? AND window_id=? AND version=? AND deadline_at<=?' +
    ' RETURNING user_uid'
  ).bind(uid, snapshot.window_id, snapshot.version, serverNowMs));
  const result = await db.batch(statements);
  if (!Array.isArray(result) || result.length !== statements.length ||
      result.some((row) => row?.success === false)) throw Error('416_ATOMIC_BATCH_FAILED');
  const removed = Number(result.at(-1)?.results?.length || 0);
  const inserted = result.slice(0, -1).map((row) => Number(row?.meta?.changes || 0));
  if (!removed && inserted.every((n) => n === 0)) {
    return { committed: false, reason: 'STALE_VERSION' };
  }
  if (removed !== 1 || inserted.some((n) => n !== 1)) {
    throw Error('416_ATOMIC_QUEUE_PROOF_MISSING');
  }
  return { committed: true, batchIds, batchCount: chunks.length,
    trackCount: mutations.length, version: Number(snapshot.version) };
}

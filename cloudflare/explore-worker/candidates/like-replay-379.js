// SORIDRAW_LIKE_REPLAY_COMPAT_379_20261008
// Legacy ACK recovery reads current relation/queue authority, never receipt
// desired state. All queue seeks use receipt-proven PKs (<=1200 operations).
// One statement gives a consistent snapshot across queue settlement/deletion.
async function readLegacyLikeReplay379(env, uid, mutations, receipt) {
  const ids = mutations.map(row => row.trackId);
  if (!ids.length || ids.length > 50) {
    likeReceiptError390('LIKE_RECEIPT_UNAVAILABLE', 503);
  }
  const result = await env.DB.prepare(`
    WITH requested(track_id) AS (SELECT value FROM json_each(?)),
    pending AS MATERIALIZED (
      SELECT q.created_at, q.batch_id, json_extract(m.value,'$.trackId') AS track_id,
        json_extract(m.value,'$.liked') AS liked
      FROM explore_like_intake_receipts_390 proof
      JOIN json_each(proof.receipts_json) ids
      JOIN explore_like_batches_069 q ON q.batch_id = json_extract(ids.value,'$.batchId') AND q.user_uid = proof.user_uid
      JOIN json_each(q.mutations_json) m
      WHERE proof.user_uid=? AND json_extract(ids.value,'$.acceptedAt') >= ?
        AND json_extract(m.value,'$.trackId') IN (SELECT track_id FROM requested)
    ), ranked AS (
      SELECT track_id, liked, ROW_NUMBER() OVER (
        PARTITION BY track_id ORDER BY created_at DESC, batch_id DESC) AS n
      FROM pending
    )
    SELECT r.track_id,
      CASE WHEN t.is_public=1 AND t.status='published'
        THEN COALESCE(p.liked, CASE WHEN l.user_uid IS NULL THEN 0 ELSE 1 END)
        ELSE 0 END AS liked,
      MAX(0, COALESCE(s.like_count,0) + CASE
        WHEN t.is_public=1 AND t.status='published' AND p.track_id IS NOT NULL
        THEN p.liked - CASE WHEN l.user_uid IS NULL THEN 0 ELSE 1 END
        ELSE 0 END) AS like_count
    FROM requested r
    LEFT JOIN tracks t ON t.id=r.track_id
    LEFT JOIN likes l ON l.track_id=r.track_id AND l.user_uid=?
    LEFT JOIN track_stats s ON s.track_id=r.track_id
    LEFT JOIN ranked p ON p.track_id=r.track_id AND p.n=1
  `).bind(JSON.stringify(ids), uid, receipt.acceptedAt, uid).all();
  if (result?.success !== true || !Array.isArray(result.results) || result.results.length !== ids.length ||
      new Set(result.results.map(row => row.track_id)).size !== ids.length ||
      result.results.some(row => !ids.includes(row.track_id) || ![0, 1].includes(row.liked) ||
        !Number.isSafeInteger(row.like_count) || row.like_count < 0)) {
    likeReceiptError390('LIKE_RECEIPT_UNAVAILABLE', 503);
  }
  // app379's frozen conflict branch clears the matching outbox without sending
  // personal/public signals. Omit revision: legacy likes has no revision owner.
  return result.results.map(row => ({ trackId: row.track_id, liked: row.liked === 1,
    likeCount: row.like_count, status: 'revision-conflict' }));
}

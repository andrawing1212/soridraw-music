// SORIDRAW_LIKE_ACCEPTANCE_RECEIPT_390_20261008
// Only intake identity lives here. Never synthesize canonical state from it.
function likeReceiptError390(code, status = 409) {
  throwApi(code, '좋아요 접수 상태를 확인해 주세요. 오래된 변경은 최신 상태 확인 후 다시 조작해 주세요.', status);
}
async function likeReceiptDigest390(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
}
async function prepareLikeReceipt390(uid, mutations) {
  if (!uid || !Array.isArray(mutations) || !mutations.length || mutations.length > 50 ||
      new Set(mutations.map(row => row.trackId)).size !== mutations.length ||
      new Set(mutations.map(row => row.operationId)).size !== mutations.length ||
      mutations.some(row => typeof row.trackId !== 'string' || !row.trackId || row.trackId.length > 512 ||
        typeof row.liked !== 'boolean' || !/^[a-zA-Z0-9_-]{16,128}$/.test(row.operationId || '') ||
        !Number.isSafeInteger(row.expectedRevision) || row.expectedRevision < 0 ||
        !Number.isSafeInteger(row.mutationAt) || row.mutationAt <= 0)) {
    likeReceiptError390('INVALID_SOCIAL_INTENT', 400);
  }
  const canonical = mutations.map(row => [row.operationId, row.trackId, row.liked, row.expectedRevision, row.mutationAt])
    .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  return {
    id: await likeReceiptDigest390([uid, canonical]),
    operations: await Promise.all(canonical.map(async row => [row[0], await likeReceiptDigest390(row)])),
    minAt: Math.min(...mutations.map(row => row.mutationAt)),
    maxAt: Math.max(...mutations.map(row => row.mutationAt)),
    payload: JSON.stringify(mutations.map(({ trackId, liked }) => ({ trackId, liked }))),
  };
}
async function readLikeReceipt390(env, uid, intent) {
  const row = await env.DB.prepare('SELECT generation,receipts_json FROM explore_like_intake_receipts_390 WHERE user_uid=?')
    .bind(uid).first();
  let entries = [];
  if (row) {
    try { entries = JSON.parse(row.receipts_json); } catch { likeReceiptError390('LIKE_RECEIPT_UNAVAILABLE', 503); }
    if (!Number.isSafeInteger(row.generation) || row.generation < 1 || !Array.isArray(entries) || entries.length > 1200 ||
        entries.some(entry => !/^[a-f0-9]{64}$/.test(entry.id || '') || !Number.isSafeInteger(entry.acceptedAt) ||
          !Number.isSafeInteger(entry.expiresAt) || !/^l069_\d{13}_[a-f0-9]{64}$/.test(entry.batchId || '') ||
          !Array.isArray(entry.operations) || entry.operations.length < 1 || entry.operations.length > 50 ||
          entry.operations.some(op => !Array.isArray(op) || op.length !== 2 ||
            !/^[a-zA-Z0-9_-]{16,128}$/.test(op[0]) || !/^[a-f0-9]{64}$/.test(op[1]))) ||
        entries.reduce((sum, entry) => sum + entry.operations.length, 0) > 1200) {
      likeReceiptError390('LIKE_RECEIPT_UNAVAILABLE', 503);
    }
  }
  const operations = new Map(entries.flatMap(entry => entry.operations));
  for (const [id, hash] of intent.operations) {
    if (operations.has(id) && operations.get(id) !== hash) likeReceiptError390('SOCIAL_OPERATION_CONFLICT');
  }
  const receipt = entries.find(entry => entry.id === intent.id);
  if (!receipt && intent.operations.some(([id]) => operations.has(id))) likeReceiptError390('LIKE_RECEIPT_BATCH_CONFLICT');
  return { generation: row?.generation || 0, entries, receipt };
}
async function acceptLikeReceipt390(env, uid, mutations, intent, initial, now = Date.now()) {
  let state = initial;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (state.receipt) return { ...state.receipt, inserted: false, replay: true, queue: '069' };
    // Check AFTER exact receipt lookup: a retained proof still acknowledges an
    // old batch. Once pruned, its unchanged timestamp can never become new work.
    if (intent.minAt <= now - 86_400_000) likeReceiptError390('LIKE_RECEIPT_EXPIRED');
    if (intent.maxAt > now + 300_000) likeReceiptError390('LIKE_RECEIPT_CLOCK_SKEW');
    const entries = state.entries.filter(entry => entry.expiresAt >= now);
    if (entries.reduce((sum, entry) => sum + entry.operations.length, 0) + mutations.length > 1200) {
      likeReceiptError390('LIKE_RECEIPT_CAPACITY', 429);
    }
    const acceptedAt = Math.max(now, ...state.entries.map(entry => entry.acceptedAt + 1));
    const receipt = { id: intent.id, operations: intent.operations, acceptedAt,
      expiresAt: intent.maxAt + 86_400_000,
      batchId: 'l069_' + String(acceptedAt).padStart(13, '0') + '_' + intent.id };
    const result = await env.DB.prepare(`INSERT INTO explore_like_intake_receipts_390
      (user_uid,generation,receipts_json,queue_id,accepted_at,mutation_count,mutations_json)
      VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_uid) DO UPDATE SET
      generation=excluded.generation,receipts_json=excluded.receipts_json,queue_id=excluded.queue_id,
      accepted_at=excluded.accepted_at,mutation_count=excluded.mutation_count,mutations_json=excluded.mutations_json
      WHERE explore_like_intake_receipts_390.generation=?
      RETURNING generation`).bind(uid, state.generation + 1, JSON.stringify([...entries, receipt]),
        receipt.batchId, acceptedAt, mutations.length, intent.payload, state.generation).all();
    if (result?.success !== true) likeReceiptError390('LIKE_RECEIPT_UNAVAILABLE', 503);
    if (result.results?.length === 1) return { ...receipt, inserted: true, replay: false, queue: '069' };
    state = await readLikeReceipt390(env, uid, intent);
  }
  likeReceiptError390('LIKE_RECEIPT_CONTESTED', 503);
}

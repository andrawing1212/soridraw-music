import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { prove390, runtime390 } from './lib/like-receipt-390-fixture.mjs';
const db = new DatabaseSync(':memory:');
try {
  await prove390(async (sql, params = []) => {
    const before = db.prepare('SELECT total_changes() n').get().n;
    const statement = db.prepare(sql);
    const results = statement.all(...params);
    const written = db.prepare('SELECT total_changes() n').get().n - before;
    return { success: true, results, meta: { rows_written: written } };
  });
  // Bounded storage/capacity fixture only, never reported as remote billing.
  const { context: c, env } = runtime390(async (sql, params = []) => ({
    success: true, results: db.prepare(sql).all(...params),
  }));
  const now = Date.now();
  const entries = Array.from({ length: 1200 }, (_, i) => {
    const id = i.toString(16).padStart(64, '0');
    return { id, acceptedAt: now, expiresAt: now + 86_400_000,
      batchId: 'l069_' + now + '_' + id,
      operations: [[i.toString(16).padStart(128, '0'), id]] };
  });
  const encoded = JSON.stringify(entries);
  assert.ok(encoded.length <= 600000);
  db.prepare('INSERT INTO explore_like_intake_receipts_390 VALUES(?,?,?,?,?,?,?)')
    .run('capacity', 1, encoded, entries[0].batchId, now, 1, '[]');
  const rows = [{ trackId: 'fresh', liked: true, expectedRevision: 0, mutationAt: now,
    operationId: 'fresh_operation_123456789' }];
  const intent = await c.prepareLikeReceipt390('capacity', rows);
  const state = await c.readLikeReceipt390(env, 'capacity', intent);
  const before = db.prepare('SELECT total_changes() n').get().n;
  await assert.rejects(() => c.acceptLikeReceipt390(env, 'capacity', rows, intent, state, now),
    error => error.code === 'LIKE_RECEIPT_CAPACITY');
  assert.equal(db.prepare('SELECT total_changes() n').get().n, before);
  rows[0].mutationAt = now + 86_400_001;
  const fresh = await c.prepareLikeReceipt390('capacity', rows);
  await c.acceptLikeReceipt390(env, 'capacity', rows, fresh, state, rows[0].mutationAt);
  const saved = db.prepare('SELECT receipts_json FROM explore_like_intake_receipts_390 WHERE user_uid=?').get('capacity');
  assert.equal(JSON.parse(saved.receipts_json).length, 1);
  assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='index' AND tbl_name='explore_like_intake_receipts_390' AND sql IS NOT NULL").get().n, 0);
  console.log('390_BOUNDED_1200_IDENTITIES_CAPACITY_W0_AND_EXPIRY_RECOVERY=PASS');
} finally { db.close(); }

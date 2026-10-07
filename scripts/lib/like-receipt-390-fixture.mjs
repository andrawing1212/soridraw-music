import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

export const schema390 = () => readFileSync('cloudflare/explore-worker/candidates/390-like-acceptance-receipt.sql', 'utf8')
  .match(/CREATE TABLE[\s\S]+?;\n|CREATE TRIGGER[\s\S]+?\nEND;/g);
export function runtime390(query) {
  const context = vm.createContext({ crypto: webcrypto, TextEncoder, console,
    throwApi(code, message, status) { throw Object.assign(Error(message), { code, status }); },
  });
  vm.runInContext(readFileSync('cloudflare/explore-worker/candidates/like-acceptance-390.js', 'utf8'), context);
  const prepare = (sql, params = []) => ({ bind: (...values) => prepare(sql, values),
    all: () => query(sql, params), first: async () => (await query(sql, params)).results[0] || null });
  return { context, env: { DB: { prepare } } };
}
export async function prove390(query, { remote = false } = {}) {
  await query(readFileSync('cloudflare/explore-worker/migrations/20260912_01_explore_like_w1_queue.sql', 'utf8'));
  await query('CREATE TABLE explore_like_cutover_control_174(id INTEGER PRIMARY KEY,phase TEXT)');
  await query("INSERT INTO explore_like_cutover_control_174 VALUES(1,'open')");
  for (const sql of schema390()) await query(sql);
  let work = [];
  const { context: c, env } = runtime390(async (sql, params) => {
    const result = await query(sql, params); work.push(result); return result;
  });
  let now = Date.now();
  const mutation = (id, at = now) => ({ trackId: 'track-' + id, liked: true,
    operationId: 'operation_' + String(id).padStart(16, '0'), expectedRevision: 0, mutationAt: at });
  const prepare = async (uid, rows) => {
    const intent = await c.prepareLikeReceipt390(uid, rows);
    const state = await c.readLikeReceipt390(env, uid, intent);
    return { intent, state };
  };
  const accept = async (uid, rows, at = now) => {
    const { intent, state } = await prepare(uid, rows);
    return c.acceptLikeReceipt390(env, uid, rows, intent, state, at);
  };
  const metric = async (label, expected, action, code) => {
    work = [];
    const result = code ? await assert.rejects(action, error => error.code === code) : await action();
    assert.ok(work.length > 0, label + ': execute actual DB read/write, never a canned answer');
    const written = work.reduce((sum, x) => {
      assert.ok(Number.isSafeInteger(x.meta?.rows_written), 'missing rows_written');
      return sum + x.meta.rows_written;
    }, 0);
    assert.equal(written, expected, label);
    console.log('390_' + (remote ? 'REMOTE_D1' : 'SQLITE_FIXTURE_NOT_BILLING') + '_' + label + '=rows_written:' + written);
    return result;
  };
  const a = [mutation(1), mutation(2)];
  const first = await metric('NEW_BATCH', 2, () => accept('actor', a));
  assert.equal(first.replay, false);
  const replay = await metric('ACK_LOSS_REPLAY', 0, () => accept('actor', [...a].reverse()));
  assert.equal(replay.replay, true); assert.equal(replay.batchId, first.batchId);
  for (const [field, value] of [['trackId', 'changed'], ['liked', false], ['expectedRevision', 1], ['mutationAt', now + 1]]) {
    await metric('CONFLICT_' + field, 0, () => accept('actor', [{ ...a[0], [field]: value }, a[1]]), 'SOCIAL_OPERATION_CONFLICT');
  }
  await metric('PARTIAL_BATCH_CONFLICT', 0, () => accept('actor', [a[0]]), 'LIKE_RECEIPT_BATCH_CONFLICT');
  await query('DELETE FROM explore_like_batches_069 WHERE user_uid=?', ['actor']); // isolated processor fixture
  await metric('PROCESSED_QUEUE_REPLAY', 0, () => accept('actor', a));
  assert.equal((await query('SELECT count(*) n FROM explore_like_batches_069 WHERE user_uid=?', ['actor'])).results[0].n, 0);
  // Both requests intentionally observe the same generation before the race.
  const b = [mutation(3)];
  const [one, two] = await Promise.all([prepare('race', b), prepare('race', b)]);
  const race = await metric('CONCURRENT_SAME_BATCH_TOTAL', 2, () => Promise.all([
    c.acceptLikeReceipt390(env, 'race', b, one.intent, one.state, now),
    c.acceptLikeReceipt390(env, 'race', b, two.intent, two.state, now),
  ]));
  assert.equal(race.filter(x => x.inserted).length, 1);
  assert.equal(race.filter(x => x.replay).length, 1);
  assert.equal((await query('SELECT count(*) n FROM explore_like_batches_069 WHERE user_uid=?', ['race'])).results[0].n, 1);
  const before = (await query('SELECT receipts_json FROM explore_like_intake_receipts_390 WHERE user_uid=?', ['actor'])).results[0].receipts_json;
  await query("UPDATE explore_like_cutover_control_174 SET phase='closed'");
  await assert.rejects(() => accept('fenced', [mutation(4)]), /LIKE_RECEIPT_FENCE_CLOSED/);
  await assert.rejects(() => accept('actor', [mutation(4)]), /LIKE_RECEIPT_FENCE_CLOSED/);
  assert.equal((await query('SELECT count(*) n FROM explore_like_intake_receipts_390 WHERE user_uid=?', ['fenced'])).results[0].n, 0);
  assert.equal((await query('SELECT receipts_json FROM explore_like_intake_receipts_390 WHERE user_uid=?', ['actor'])).results[0].receipts_json, before);
  assert.equal((await query('SELECT count(*) n FROM explore_like_batches_069 WHERE user_uid=?', ['fenced'])).results[0].n, 0);
  await query("UPDATE explore_like_cutover_control_174 SET phase='open'");
  console.log('390_FENCE_INSERT_AND_UPDATE_ROLLBACK_NO_RECEIPT=PASS');
  const collisionRows = [mutation(5)];
  const collision = await prepare('collision', collisionRows);
  const collisionId = 'l069_' + String(now).padStart(13, '0') + '_' + collision.intent.id;
  await query('INSERT INTO explore_like_batches_069 VALUES(?,?,?,?,?)', [collisionId, 'fixture', now, 1, '[]']);
  await assert.rejects(() => c.acceptLikeReceipt390(env, 'collision', collisionRows, collision.intent, collision.state, now), /UNIQUE constraint/);
  assert.equal((await query('SELECT count(*) n FROM explore_like_intake_receipts_390 WHERE user_uid=?', ['collision'])).results[0].n, 0);
  console.log('390_QUEUE_INSERT_FAILURE_ROLLBACK_NO_RECEIPT=PASS');
  now += 86_400_001;
  await metric('FRESH_ACTION_AFTER_RETENTION', 2, () => accept('actor', [mutation(6)]));
  await metric('EVICTED_OLD_REPLAY', 0, () => accept('actor', a), 'LIKE_RECEIPT_EXPIRED');
  const stored = JSON.parse((await query('SELECT receipts_json FROM explore_like_intake_receipts_390 WHERE user_uid=?', ['actor'])).results[0].receipts_json);
  assert.equal(stored.length, 1);
  await metric('FRESH_ACTION_AFTER_EXPIRED_REJECTION', 2, () => accept('actor', [mutation(7)]));
  console.log('390_BOUNDED_RETENTION_EXPIRED_REPLAY_W0_FRESH_ACTION_RECOVERY=PASS');
  return { first, replay };
}

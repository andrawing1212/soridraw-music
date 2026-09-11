import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const root = 'cloudflare/explore-worker/';
const migration035 = readFileSync(root + 'migrations/20260911_01_explore_like_deferred_batches.sql', 'utf8');
const migration066 = readFileSync(root + 'migrations/20260911_02_explore_like_compact_queue.sql', 'utf8');
const patch039 = readFileSync(root + 'patches/039-explore-like-stable-dual-queue-boundary.mjs', 'utf8');
const manifest = JSON.parse(readFileSync(root + 'release-patches.json', 'utf8'));

assert.equal(manifest.patches.at(-1), '039-explore-like-stable-dual-queue-boundary.mjs');
for (const required of [
  'selectExploreLikeAggregateBoundary039',
  'exploreLikeAggregateSnapshotCte039',
  'boundary.createdAt',
  'boundary.batchId',
  'boundary.queueKind',
  'DELETE FROM explore_like_batches_035',
  'DELETE FROM explore_like_batches_066',
  'SORIDRAW_EXPLORE_LIKE_STABLE_DUAL_QUEUE_BOUNDARY_039_20260911',
]) {
  assert.ok(patch039.includes(required), `039 patch missing ${required}`);
}

const db = new DatabaseSync(':memory:');
db.exec(migration035);
db.exec(migration066);
const payload = JSON.stringify([{ trackId: 't', liked: true }]);
const insert = (table, id, createdAt) => db.prepare(
  `INSERT INTO ${table}(batch_id,user_uid,created_at,mutation_count,mutations_json) VALUES(?,?,?,?,?)`
).run(id, 'u', createdAt, 1, payload);

// Global queue order: old-100, new-200, old-300. A cap of 2 must freeze at new-200.
insert('explore_like_batches_035', 'old-100', 100);
insert('explore_like_batches_066', 'new-200', 200);
insert('explore_like_batches_035', 'old-300', 300);

const allQueues = `
  SELECT batch_id, created_at, mutation_count, '035' AS queue_kind FROM explore_like_batches_035
  UNION ALL
  SELECT batch_id, created_at, mutation_count, '066' AS queue_kind FROM explore_like_batches_066
`;
const boundarySql = `
WITH all_batches AS (${allQueues}),
limited AS (
  SELECT batch_id, created_at, mutation_count, queue_kind
  FROM all_batches
  WHERE created_at <= ?
  ORDER BY created_at ASC, batch_id ASC, queue_kind ASC
  LIMIT 50000
),
ordered AS (
  SELECT batch_id, created_at, queue_kind,
    SUM(mutation_count) OVER (
      ORDER BY created_at ASC, batch_id ASC, queue_kind ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_mutations
  FROM limited
)
SELECT created_at, batch_id, queue_kind
FROM ordered
WHERE running_mutations <= ?
ORDER BY created_at DESC, batch_id DESC, queue_kind DESC
LIMIT 1
`;
const boundary = db.prepare(boundarySql).get(999, 2);
assert.equal(String(boundary?.batch_id), 'new-200');
assert.equal(String(boundary?.queue_kind), '066');

const eligibleSql = `
WITH boundary(created_at,batch_id,queue_kind) AS (VALUES(?,?,?)),
all_batches AS (${allQueues})
SELECT a.batch_id, a.queue_kind
FROM all_batches a, boundary b
WHERE a.created_at <= ?
  AND (
    a.created_at < b.created_at
    OR (a.created_at = b.created_at AND a.batch_id < b.batch_id)
    OR (a.created_at = b.created_at AND a.batch_id = b.batch_id AND a.queue_kind <= b.queue_kind)
  )
ORDER BY a.created_at ASC, a.batch_id ASC, a.queue_kind ASC
`;
const args = [Number(boundary.created_at), String(boundary.batch_id), String(boundary.queue_kind), 999];
let eligible = db.prepare(eligibleSql).all(...args).map((row) => `${row.queue_kind}:${row.batch_id}`);
assert.deepEqual(eligible, ['035:old-100', '066:new-200']);

// Simulate the first queue delete in a sequential D1 batch. A recomputed LIMIT would now
// pull old-300 into capacity; the frozen boundary must not.
db.prepare("DELETE FROM explore_like_batches_035 WHERE batch_id='old-100'").run();
eligible = db.prepare(eligibleSql).all(...args).map((row) => `${row.queue_kind}:${row.batch_id}`);
assert.deepEqual(eligible, ['066:new-200']);
assert.equal(Number(db.prepare("SELECT COUNT(*) AS n FROM explore_like_batches_035 WHERE batch_id='old-300'").get()?.n), 1);
console.log('PASS boundary: deleting one queue cannot make a later queue delete over-drain beyond the preselected mutation cap');

const generatedWorker = String(process.env.SORIDRAW_GENERATED_WORKER || '').trim();
if (generatedWorker) {
  const worker = readFileSync(generatedWorker, 'utf8');
  assert.match(worker, /SORIDRAW_EXPLORE_LIKE_STABLE_DUAL_QUEUE_BOUNDARY_039_20260911/);
  assert.match(worker, /async function selectExploreLikeAggregateBoundary039\(/);
  assert.match(worker, /function exploreLikeAggregateSnapshotCte039\(/);
  assert.match(worker, /const boundary = await selectExploreLikeAggregateBoundary039/);
  assert.match(worker, /const prefix = \[boundary\.createdAt, boundary\.batchId, boundary\.queueKind, cutoff\]/);
  console.log('PASS generated Worker: stable mixed-queue boundary is selected once before transactional mutations');
} else {
  console.log('INFO generated Worker check skipped; preparation supplies SORIDRAW_GENERATED_WORKER');
}

console.log('PASS Explore like 066 stable-boundary verifier');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const root = 'cloudflare/explore-worker/';
const migration035 = readFileSync(root + 'migrations/20260911_01_explore_like_deferred_batches.sql', 'utf8');
const migration066 = readFileSync(root + 'migrations/20260911_02_explore_like_compact_queue.sql', 'utf8');
const patch038 = readFileSync(root + 'patches/038-explore-like-compact-queue.mjs', 'utf8');
const manifest = JSON.parse(readFileSync(root + 'release-patches.json', 'utf8'));

const functionText = (source, needle) => {
  const start = source.indexOf(needle);
  assert.ok(start >= 0, `missing function anchor: ${needle}`);
  const brace = source.indexOf('{', start);
  assert.ok(brace >= 0, `missing function body: ${needle}`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let comment = '';
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (comment === 'line') { if (char === '\n') comment = ''; continue; }
    if (comment === 'block') { if (char === '*' && next === '/') { comment = ''; index += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') { comment = 'line'; index += 1; continue; }
    if (char === '/' && next === '*') { comment = 'block'; index += 1; continue; }
    if ('"\'`'.includes(char)) { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unterminated function: ${needle}`);
};

const compactPatchIndex = manifest.patches.indexOf('038-explore-like-compact-queue.mjs');
assert.ok(compactPatchIndex >= 0, 'compact queue patch must be in release manifest');
const stableBoundaryIndex = manifest.patches.indexOf('039-explore-like-stable-dual-queue-boundary.mjs');
if (stableBoundaryIndex >= 0) {
  assert.ok(compactPatchIndex < stableBoundaryIndex, 'stable boundary patch must run after compact queue patch');
}
assert.match(migration066, /CREATE TABLE IF NOT EXISTS explore_like_batches_066/);
assert.match(migration066, /\) WITHOUT ROWID;/);
assert.match(migration066, /CREATE INDEX IF NOT EXISTS idx_explore_like_batches_066_created\s+ON explore_like_batches_066\(created_at, batch_id\)/);
const compactMigration = migration066.replace(/--.*$/gm, ' ').replace(/\s+/g, ' ').trim();
assert.doesNotMatch(compactMigration, /\b(?:DROP|ALTER|UPDATE|DELETE)\b/i, '066 migration must stay additive');
assert.doesNotMatch(
  compactMigration,
  /\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?(?:tracks|track_stats|likes|public_profiles|profile_stats|explore_derived_tracks|explore_derived_changes)\b/i,
  '066 migration must not rewrite canonical user/content rows',
);

const db = new DatabaseSync(':memory:');
db.exec(migration035);
db.exec(migration066);

const oldSql = String(db.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name='explore_like_batches_035'").get()?.sql || '');
const compactSql = String(db.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name='explore_like_batches_066'").get()?.sql || '');
assert.ok(oldSql && compactSql);
assert.doesNotMatch(oldSql, /WITHOUT ROWID/i);
assert.match(compactSql, /WITHOUT ROWID/i);

const oldIndexes = db.prepare("PRAGMA index_list('explore_like_batches_035')").all().map((row) => String(row.name || ''));
const compactIndexes = db.prepare("PRAGMA index_list('explore_like_batches_066')").all().map((row) => String(row.name || ''));
assert.ok(oldIndexes.includes('idx_explore_like_batches_035_created'));
assert.ok(oldIndexes.some((name) => name.startsWith('sqlite_autoindex_explore_like_batches_035')));
assert.ok(compactIndexes.includes('idx_explore_like_batches_066_created'));

const compactPlan = db.prepare(`
  EXPLAIN QUERY PLAN
  SELECT batch_id, user_uid, created_at, mutation_count, mutations_json
  FROM explore_like_batches_066
  WHERE created_at <= ?
  ORDER BY created_at ASC, batch_id ASC
  LIMIT 50000
`).all(999999).map((row) => String(row.detail || '')).join('\n');
assert.match(compactPlan, /idx_explore_like_batches_066_created/i, '066 queue age lookup must stay indexed');
assert.doesNotMatch(compactPlan, /USE TEMP B-TREE/i, '066 queue age lookup may not require a temp sort');
console.log('PASS schema: 035 rowid queue kept intact; 066 adds WITHOUT ROWID queue with indexed chronological lookup');

// Mixed old/new queues must be resolved together by created_at. This protects shared-data rollout:
// older TEST/PRODUCTION Workers may still enqueue 035 while PREVIEW already enqueues 066.
db.exec(`
  CREATE TABLE likes(
    track_id TEXT NOT NULL,
    user_uid TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY(track_id, user_uid)
  );
  CREATE TABLE track_stats(
    track_id TEXT PRIMARY KEY,
    like_count INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,
    play_count INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
  );
  INSERT INTO track_stats(track_id, like_count) VALUES('t', 0);
`);

const combinedCte = `
WITH all_batches AS (
  SELECT batch_id, user_uid, created_at, mutation_count, mutations_json, '035' AS queue_kind
  FROM explore_like_batches_035
  UNION ALL
  SELECT batch_id, user_uid, created_at, mutation_count, mutations_json, '066' AS queue_kind
  FROM explore_like_batches_066
),
ordered AS (
  SELECT batch_id, user_uid, created_at, mutation_count, mutations_json, queue_kind,
    SUM(mutation_count) OVER (
      ORDER BY created_at ASC, batch_id ASC, queue_kind ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_mutations
  FROM (
    SELECT batch_id, user_uid, created_at, mutation_count, mutations_json, queue_kind
    FROM all_batches
    WHERE created_at <= ?
    ORDER BY created_at ASC, batch_id ASC, queue_kind ASC
    LIMIT 50000
  )
),
eligible AS (
  SELECT batch_id, user_uid, created_at, mutation_count, mutations_json, queue_kind
  FROM ordered
  WHERE running_mutations <= ?
),
expanded AS (
  SELECT e.batch_id, e.user_uid, e.created_at, e.queue_kind,
    TRIM(CAST(json_extract(j.value, '$.trackId') AS TEXT)) AS track_id,
    CASE WHEN json_extract(j.value, '$.liked') THEN 1 ELSE 0 END AS desired_liked
  FROM eligible e, json_each(e.mutations_json) AS j
),
latest AS (
  SELECT user_uid, track_id, desired_liked, created_at, batch_id, queue_kind
  FROM (
    SELECT expanded.*,
      ROW_NUMBER() OVER (
        PARTITION BY user_uid, track_id
        ORDER BY created_at DESC, batch_id DESC, queue_kind DESC
      ) AS rn
    FROM expanded
    WHERE track_id <> ''
  )
  WHERE rn = 1
),
deltas AS (
  SELECT latest.*,
    CASE
      WHEN latest.desired_liked = 1 AND existing.user_uid IS NULL THEN 1
      WHEN latest.desired_liked = 0 AND existing.user_uid IS NOT NULL THEN -1
      ELSE 0
    END AS delta
  FROM latest
  LEFT JOIN likes existing
    ON existing.track_id = latest.track_id AND existing.user_uid = latest.user_uid
)
`;

const insertQueue = (table, batchId, uid, createdAt, liked) => {
  db.prepare(`INSERT INTO ${table}(batch_id,user_uid,created_at,mutation_count,mutations_json) VALUES(?,?,?,?,?)`).run(
    batchId, uid, createdAt, 1, JSON.stringify([{ trackId: 't', liked }]),
  );
};

// Old worker says LIKE first, new worker later says UNLIKE. Latest state must win globally.
insertQueue('explore_like_batches_035', 'old-like', 'u', 100, true);
insertQueue('explore_like_batches_066', 'new-unlike', 'u', 200, false);
const latestMixed = db.prepare(combinedCte + 'SELECT desired_liked, delta, queue_kind FROM deltas WHERE user_uid=? AND track_id=?').get(999999, 50000, 'u', 't');
assert.equal(Number(latestMixed?.desired_liked), 0);
assert.equal(Number(latestMixed?.delta), 0);
assert.equal(String(latestMixed?.queue_kind), '066');

db.prepare("DELETE FROM explore_like_batches_035").run();
db.prepare("DELETE FROM explore_like_batches_066").run();
db.prepare("INSERT INTO likes(track_id,user_uid,created_at) VALUES('t','u',1)").run();
db.prepare("UPDATE track_stats SET like_count=1 WHERE track_id='t'").run();

// Old worker says UNLIKE first, new worker later says LIKE. Latest state must remain liked.
insertQueue('explore_like_batches_035', 'old-unlike', 'u', 300, false);
insertQueue('explore_like_batches_066', 'new-like', 'u', 400, true);
const latestReverse = db.prepare(combinedCte + 'SELECT desired_liked, delta, queue_kind FROM deltas WHERE user_uid=? AND track_id=?').get(999999, 50000, 'u', 't');
assert.equal(Number(latestReverse?.desired_liked), 1);
assert.equal(Number(latestReverse?.delta), 0);
assert.equal(String(latestReverse?.queue_kind), '066');
console.log('PASS rollout: old 035 + new 066 batches share one chronological latest-state decision');

for (const required of [
  'SORIDRAW_EXPLORE_LIKE_COMPACT_QUEUE_038_20260911',
  'INSERT OR IGNORE INTO explore_like_batches_066',
  'INSERT OR IGNORE INTO explore_like_batches_035',
  'UNION ALL',
  'DELETE FROM explore_like_batches_035',
  'DELETE FROM explore_like_batches_066',
  'hasExploreLikeQueue066038',
]) {
  assert.ok(patch038.includes(required), `038 patch missing ${required}`);
}

const generatedWorker = String(process.env.SORIDRAW_GENERATED_WORKER || '').trim();
if (generatedWorker) {
  const worker = readFileSync(generatedWorker, 'utf8');
  assert.match(worker, /SORIDRAW_EXPLORE_LIKE_COMPACT_QUEUE_038_20260911/);
  const enqueue = functionText(worker, 'async function enqueueExploreLikeBatch035(');
  const cte = functionText(worker, 'function exploreLikeAggregateCte035(');
  const wave = functionText(worker, 'async function processExploreLikeAggregateWave035(');
  const processor = functionText(worker, 'async function processExploreLikeBatches035(');
  assert.match(enqueue, /explore_like_batches_066/);
  assert.match(enqueue, /explore_like_batches_035/);
  assert.match(cte, /UNION ALL/);
  assert.match(cte, /queue_kind/);
  assert.match(wave, /DELETE FROM explore_like_batches_035/);
  assert.match(wave, /DELETE FROM explore_like_batches_066/);
  assert.match(processor, /hasExploreLikeQueue066038/);
  assert.match(processor, /includeQueue066/);
  console.log('PASS generated Worker: compact enqueue + dual-queue chronological drain present');
} else {
  console.log('INFO generated Worker check skipped; PREVIEW preparation supplies SORIDRAW_GENERATED_WORKER');
}

console.log('PASS Explore like 066 compact-queue verifier; D1 live rows_written W2 remains PREVIEW measurement, not a fixture claim');

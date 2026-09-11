import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const root = 'cloudflare/explore-worker/';
const service = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const migration033 = readFileSync(root + 'migrations/20260910_03_explore_like_write_optimization.sql', 'utf8');
const migration035 = readFileSync(root + 'migrations/20260911_01_explore_like_deferred_batches.sql', 'utf8');
const manifest = JSON.parse(readFileSync(root + 'release-patches.json', 'utf8'));

const functionText = (source, needle) => {
  const start = source.indexOf(needle);
  assert.ok(start >= 0, `missing function anchor: ${needle}`);
  const arrow = needle.startsWith('export const ') ? source.indexOf('=>', start) : -1;
  const brace = arrow >= 0 ? source.indexOf('{', arrow + 2) : source.indexOf('{', start);
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

// PREVIEW is intentionally shortened to one minute for fast iteration.
// TEST/PRODUCTION retain the four-minute default until separately approved.
assert.match(service, /SORIDRAW_EXPLORE_LIKE_BATCH_034_20260911/);
assert.match(service, /SORIDRAW_EXPLORE_LIKE_PREVIEW_1MIN_TEST_037_20260911/);
assert.match(service, /SORIDRAW_EXPLORE_LIKE_ACCOUNT_COUNT_REPLAY_065_20260911/);
assert.match(service, /const EXPLORE_LIKE_BATCH_WINDOW_PREVIEW_MS = 60_000;/);
assert.match(service, /const EXPLORE_LIKE_BATCH_WINDOW_DEFAULT_MS = 4 \* 60_000;/);
assert.match(service, /EXPLORE_ENVIRONMENT === 'preview'/);
assert.match(service, /const EXPLORE_LIKE_BATCH_MAX = 50;/);
assert.match(service, /EXPLORE_LIKE_OUTBOX_CACHE_KEY = 'explore-like-outbox'/);
assert.match(service, /EXPLORE_LIKE_ACCOUNT_PATCH_CACHE_KEY = 'explore-like-account-patches'/);
assert.match(service, /rememberAccountSyncResults\(uid, signal\.results\)/);
assert.match(service, /replayAccountSyncPatches\(user\.uid, normalized\)/);
const queueFunction = functionText(service, 'export const setExploreTrackLike = async');
assert.match(queueFunction, /schedulePendingLikes\(user\)/);
assert.doesNotMatch(queueFunction, /requestExploreLike\(/, 'UI queue function must not call the server immediately');
const flushFunction = functionText(service, 'const flushPendingLikes = async');
assert.match(flushFunction, /'\/v1\/me\/likes\/batch'/);
assert.match(flushFunction, /mutations: batchEntries\.map/);
assert.match(flushFunction, /const accountSyncResults: ExploreLikeBatchResult\[\] = \[\]/);
assert.match(flushFunction, /accountSyncResults\.push\(visibleResult\)/);
assert.match(flushFunction, /publishExploreLikeAccountSyncSignal\(user, batchEntries, accountSyncResults\)/);
assert.doesNotMatch(service, /const EXPLORE_LIKE_IDLE_MS = 5_000;/, 'old per-track 5s flush must stay retired');
assert.match(page, /setExploreTrackLike\(user, track\.id, !currentLiked, track\.likeCount, track\.ownerUid\)/);
console.log('PASS client: one-minute PREVIEW outbox + same-account visible count replay survives page/background gaps');

assert.ok(Array.isArray(manifest.patches));
assert.deepEqual(manifest.patches.slice(-3), [
  '034-explore-like-user-batch.mjs',
  '035-explore-like-deferred-aggregate.mjs',
  '036-explore-like-derived-intake.mjs'
]);
assert.equal((migration033.match(/UPDATE explore_derived_state\s+SET seq = seq \+ 1/g) || []).length, 1);
assert.match(migration035, /CREATE TABLE IF NOT EXISTS explore_like_batches_035/);
assert.match(migration035, /CREATE TABLE IF NOT EXISTS explore_like_processor_035/);
assert.match(migration035, /mutation_count INTEGER NOT NULL CHECK \(mutation_count BETWEEN 1 AND 50\)/);
const compact035 = migration035.replace(/--.*$/gm, ' ').replace(/\s+/g, ' ').trim();
assert.doesNotMatch(
  compact035,
  /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP)\s+(?:INTO\s+|FROM\s+)?(?:tracks|track_stats|likes|public_profiles|profile_stats|explore_derived_tracks|explore_derived_changes)\b/i,
  '035 migration must not rewrite canonical or existing derived user rows'
);
console.log('PASS migration: additive pending-batch + processor lease tables only; canonical rows untouched');

const aggregateCte = `
WITH ordered AS (
  SELECT batch_id, user_uid, created_at, mutation_count, mutations_json,
    SUM(mutation_count) OVER (
      ORDER BY created_at ASC, batch_id ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_mutations
  FROM (
    SELECT batch_id, user_uid, created_at, mutation_count, mutations_json
    FROM explore_like_batches_035
    WHERE created_at <= ?
    ORDER BY created_at ASC, batch_id ASC
    LIMIT 50000
  )
),
eligible AS (
  SELECT batch_id, user_uid, created_at, mutation_count, mutations_json
  FROM ordered
  WHERE running_mutations <= ?
),
expanded AS (
  SELECT e.batch_id, e.user_uid, e.created_at,
    TRIM(CAST(json_extract(j.value, '$.trackId') AS TEXT)) AS track_id,
    CASE WHEN json_extract(j.value, '$.liked') THEN 1 ELSE 0 END AS desired_liked
  FROM eligible e, json_each(e.mutations_json) AS j
  WHERE json_type(j.value, '$.trackId') = 'text'
    AND json_type(j.value, '$.liked') IN ('true', 'false')
),
latest AS (
  SELECT user_uid, track_id, desired_liked, created_at, batch_id
  FROM (
    SELECT expanded.*,
      ROW_NUMBER() OVER (
        PARTITION BY user_uid, track_id
        ORDER BY created_at DESC, batch_id DESC
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
    ON existing.track_id = latest.track_id
   AND existing.user_uid = latest.user_uid
)
`;

const runAggregateFixture = (db, cutoff = 999999, maxMutations = 50000, now = 999999) => {
  db.exec('BEGIN;');
  try {
    db.prepare(aggregateCte + `
      INSERT INTO track_stats(track_id, like_count, comment_count, play_count, updated_at)
      SELECT track_id, SUM(delta), 0, 0, ?
      FROM deltas
      GROUP BY track_id
      HAVING SUM(delta) > 0
      ON CONFLICT(track_id) DO UPDATE SET
        like_count = track_stats.like_count + excluded.like_count,
        updated_at = excluded.updated_at
    `).run(cutoff, maxMutations, now);
    db.prepare(aggregateCte + `
      UPDATE track_stats
      SET like_count = MAX(0, like_count + COALESCE((
            SELECT SUM(d.delta) FROM deltas d WHERE d.track_id = track_stats.track_id
          ), 0)),
          updated_at = ?
      WHERE track_id IN (
        SELECT track_id FROM deltas GROUP BY track_id HAVING SUM(delta) < 0
      )
    `).run(cutoff, maxMutations, now);
    db.prepare(aggregateCte + `
      INSERT OR IGNORE INTO likes(track_id, user_uid, created_at)
      SELECT track_id, user_uid, created_at FROM latest WHERE desired_liked = 1
    `).run(cutoff, maxMutations);
    db.prepare(aggregateCte + `
      DELETE FROM likes
      WHERE (track_id, user_uid) IN (
        SELECT track_id, user_uid FROM latest WHERE desired_liked = 0
      )
    `).run(cutoff, maxMutations);
    const deleted = db.prepare(aggregateCte + `
      DELETE FROM explore_like_batches_035
      WHERE batch_id IN (SELECT batch_id FROM eligible)
    `).run(cutoff, maxMutations).changes;
    db.exec('COMMIT;');
    return deleted;
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
};

const derivedIntakeSql = (count) => `
  WITH requested(track_id) AS (VALUES ${Array.from({ length: count }, () => '(?)').join(',')})
  SELECT
    r.track_id,
    CASE
      WHEN t.id IS NOT NULL AND t.active = 1 AND p.uid IS NOT NULL AND p.active = 1 THEN 1
      ELSE 0
    END AS valid_track,
    COALESCE(t.likes, 0) AS like_count,
    CASE WHEN l.user_uid IS NULL THEN 0 ELSE 1 END AS canonical_liked
  FROM requested r
  LEFT JOIN explore_derived_tracks t ON t.id = r.track_id
  LEFT JOIN explore_derived_profiles p ON p.uid = t.owner_uid
  LEFT JOIN likes l ON l.track_id = r.track_id AND l.user_uid = ?
`;

const readDerivedIntakeFixture = (db, trackIds, uid) => db.prepare(derivedIntakeSql(trackIds.length)).all(...trackIds, uid);

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(root + 'scripts/fixtures/canonical-schema.sql', 'utf8'));
db.exec(`
  CREATE TABLE likes(
    track_id TEXT NOT NULL,
    user_uid TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY(track_id,user_uid)
  );
  INSERT INTO public_profiles(uid,nickname,handle,created_at,updated_at)
  VALUES('owner','Owner','owner',1,1);
  INSERT INTO profile_stats(uid,follower_count,following_count,updated_at)
  VALUES('owner',0,0,1);
  INSERT INTO tracks(
    id,owner_uid,source_type,source_id,title,suno_url_primary,
    is_public,status,published_at,created_at,updated_at
  ) VALUES('t','owner','suno_library','t','Track','audio/t',1,'published',1,1,1);
  INSERT INTO track_stats(track_id,like_count,comment_count,play_count,updated_at)
  VALUES('t',0,0,0,1);
  CREATE TABLE explore_derived_state(
    id INTEGER PRIMARY KEY CHECK(id=1),seq INTEGER NOT NULL DEFAULT 0,seeded INTEGER NOT NULL DEFAULT 1
  );
  INSERT INTO explore_derived_state(id,seq,seeded) VALUES(1,0,1);
  CREATE TABLE explore_derived_changes(
    scope TEXT NOT NULL,kind TEXT NOT NULL,id TEXT NOT NULL,seq INTEGER NOT NULL,
    PRIMARY KEY(scope,kind,id)
  );
  CREATE TABLE explore_derived_profiles(
    uid TEXT PRIMARY KEY,active INTEGER NOT NULL DEFAULT 1,row_json TEXT NOT NULL DEFAULT '{}',
    followers INTEGER NOT NULL DEFAULT 0,following INTEGER NOT NULL DEFAULT 0,track_count INTEGER NOT NULL DEFAULT 1
  );
  INSERT INTO explore_derived_profiles(uid) VALUES('owner');
  CREATE TABLE explore_derived_tracks(
    id TEXT PRIMARY KEY,owner_uid TEXT NOT NULL,active INTEGER NOT NULL,
    published_at INTEGER NOT NULL,pinned INTEGER NOT NULL,likes INTEGER NOT NULL,row_json TEXT NOT NULL
  );
  INSERT INTO explore_derived_tracks VALUES('t','owner',1,1,0,0,'{}');
  CREATE TRIGGER explore032_stats_update AFTER UPDATE ON track_stats BEGIN
    UPDATE explore_derived_tracks SET likes=NEW.like_count WHERE id=NEW.track_id;
  END;
`);
db.exec(migration033);
db.exec(migration035);

const intakePublic = readDerivedIntakeFixture(db, ['t'], 'probe').at(0);
assert.equal(Number(intakePublic.valid_track), 1);
assert.equal(Number(intakePublic.like_count), 0);
assert.equal(Number(intakePublic.canonical_liked), 0);
db.prepare("UPDATE explore_derived_profiles SET active=0 WHERE uid='owner'").run();
assert.equal(Number(readDerivedIntakeFixture(db, ['t'], 'probe').at(0).valid_track), 0, 'private profile must be rejected');
db.prepare("UPDATE explore_derived_profiles SET active=1 WHERE uid='owner'").run();
db.prepare("UPDATE explore_derived_tracks SET active=0 WHERE id='t'").run();
assert.equal(Number(readDerivedIntakeFixture(db, ['t'], 'probe').at(0).valid_track), 0, 'private/unpublished track must be rejected');
db.prepare("UPDATE explore_derived_tracks SET active=1 WHERE id='t'").run();
db.prepare("INSERT INTO likes(track_id,user_uid,created_at) VALUES('t','probe',1)").run();
assert.equal(Number(readDerivedIntakeFixture(db, ['t'], 'probe').at(0).canonical_liked), 1, 'canonical personal relation stays authoritative');
db.prepare("DELETE FROM likes WHERE track_id='t' AND user_uid='probe'").run();
const planText = db.prepare('EXPLAIN QUERY PLAN ' + derivedIntakeSql(1)).all('t', 'probe').map((row) => String(row.detail || '')).join('\n');
assert.match(planText, /explore_derived_tracks/i);
assert.match(planText, /explore_derived_profiles/i);
assert.match(planText, /likes/i);
console.log('PASS intake fixture: keyed derived track/profile validation + canonical personal-like relation');

// One user batch can carry multiple tracks in one durable queue row.
db.prepare(`
  INSERT INTO explore_like_batches_035(batch_id,user_uid,created_at,mutation_count,mutations_json)
  VALUES('one-batch','probe',10,3,?)
`).run(JSON.stringify([
  { trackId: 'x', liked: true },
  { trackId: 'y', liked: true },
  { trackId: 'z', liked: true }
]));
assert.equal(db.prepare("SELECT COUNT(*) AS c FROM explore_like_batches_035 WHERE batch_id='one-batch'").get().c, 1);
db.prepare("DELETE FROM explore_like_batches_035 WHERE batch_id='one-batch'").run();

// 100 logical likes on the same track should create 100 canonical relations but only
// one track_stats row update, which means the existing 032 derived trigger advances once.
for (let index = 0; index < 100; index += 1) {
  db.prepare(`
    INSERT INTO explore_like_batches_035(batch_id,user_uid,created_at,mutation_count,mutations_json)
    VALUES(?,?,?,?,?)
  `).run(`like-${index}`, `u${index}`, 100 + index, 1, JSON.stringify([{ trackId: 't', liked: true }]));
}
const seqBefore = Number(db.prepare('SELECT seq FROM explore_derived_state WHERE id=1').get().seq);
assert.equal(runAggregateFixture(db), 100);
const seqAfter = Number(db.prepare('SELECT seq FROM explore_derived_state WHERE id=1').get().seq);
assert.equal(db.prepare("SELECT like_count FROM track_stats WHERE track_id='t'").get().like_count, 100);
assert.equal(db.prepare("SELECT COUNT(*) AS c FROM likes WHERE track_id='t'").get().c, 100);
assert.equal(seqAfter - seqBefore, 1, '100 same-track likes must produce one derived track update, not 100');

// Net-zero public count change: 50 old users unlike while 50 new users like in the same
// aggregate window. Canonical relations change, but track_stats/Feed/Profile need no write.
for (let index = 0; index < 50; index += 1) {
  db.prepare(`INSERT INTO explore_like_batches_035 VALUES(?,?,?,?,?)`).run(
    `unlike-${index}`, `u${index}`, 500 + index, 1,
    JSON.stringify([{ trackId: 't', liked: false }])
  );
  db.prepare(`INSERT INTO explore_like_batches_035 VALUES(?,?,?,?,?)`).run(
    `swap-${index}`, `new${index}`, 600 + index, 1,
    JSON.stringify([{ trackId: 't', liked: true }])
  );
}
const seqZeroBefore = Number(db.prepare('SELECT seq FROM explore_derived_state WHERE id=1').get().seq);
assert.equal(runAggregateFixture(db), 100);
const seqZeroAfter = Number(db.prepare('SELECT seq FROM explore_derived_state WHERE id=1').get().seq);
assert.equal(db.prepare("SELECT like_count FROM track_stats WHERE track_id='t'").get().like_count, 100);
assert.equal(db.prepare("SELECT COUNT(*) AS c FROM likes WHERE track_id='t'").get().c, 100);
assert.equal(seqZeroAfter, seqZeroBefore, 'net-zero same-track cohort must not touch derived count/feed/profile');
console.log('PASS D1 fixture: 100 same-track likes -> one count/derived update; net-zero cohort -> zero count/derived writes');

const generatedWorker = String(process.env.SORIDRAW_GENERATED_WORKER || '').trim();
if (generatedWorker) {
  const worker = readFileSync(generatedWorker, 'utf8');
  assert.match(worker, /SORIDRAW_EXPLORE_LIKE_USER_BATCH_034_20260911/);
  assert.match(worker, /SORIDRAW_EXPLORE_LIKE_DEFERRED_AGGREGATE_035_20260911/);
  assert.match(worker, /SORIDRAW_EXPLORE_LIKE_DERIVED_INTAKE_036_20260911/);
  assert.match(worker, /async scheduled\(controller, env, ctx\)/);
  const intakeBody = functionText(worker, 'async function readExploreLikeBatchStates035(');
  assert.match(intakeBody, /LEFT JOIN explore_derived_tracks/);
  assert.match(intakeBody, /LEFT JOIN explore_derived_profiles/);
  assert.match(intakeBody, /LEFT JOIN likes/);
  assert.doesNotMatch(intakeBody, /LEFT JOIN tracks /);
  assert.doesNotMatch(intakeBody, /LEFT JOIN public_profiles /);
  assert.doesNotMatch(intakeBody, /LEFT JOIN track_stats /);
  const batchBody = functionText(worker, 'async function handleLikeBatch034(');
  assert.match(batchBody, /enqueueExploreLikeBatch035/);
  assert.match(batchBody, /readExploreLikeBatchStates035/);
  assert.match(batchBody, /syncExploreLikeR2AfterBatch034/);
  assert.doesNotMatch(batchBody, /adjustExploreLikeCounterDelta/, '035 intake may not mutate canonical likes/track_stats per track');
  assert.doesNotMatch(batchBody, /patchExploreFeedR2LikeCount|patchExploreProfileR2Like020|patchExploreFirstViewLikeCount/);
  const processor = functionText(worker, 'async function processExploreLikeAggregateWave035(');
  assert.match(processor, /SUM\(delta\)/);
  assert.match(processor, /INSERT OR IGNORE INTO likes/);
  assert.match(processor, /DELETE FROM likes/);
  assert.match(processor, /DELETE FROM explore_like_batches_035/);
  assert.equal((processor.match(/env\.DB\.batch/g) || []).length, 1, 'one transactional D1 batch per aggregate wave');
  console.log('PASS generated Worker: derived intake + deferred set-based transactional aggregation');
} else {
  console.log('INFO generated Worker check skipped; canonical Worker release supplies SORIDRAW_GENERATED_WORKER');
}

console.log('PASS Explore like 036 verifier; live D1 rows remain PREVIEW-deployment measurement only');

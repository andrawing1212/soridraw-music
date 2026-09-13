import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const likeService = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const socialService = readFileSync('src/services/exploreSocialService.ts', 'utf8');
const socialSnapshotService = readFileSync('src/services/exploreSocialSnapshotService.ts', 'utf8');
const profileService = readFileSync('src/services/exploreProfileFirstViewService.ts', 'utf8');
const profileTypes = readFileSync('src/services/exploreSocialService.ts', 'utf8');
const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));
const runtime = readFileSync('cloudflare/explore-worker/runtime/social-snapshot-042.js', 'utf8');
const generatedWorkerPath = String(process.env.SORIDRAW_GENERATED_WORKER || 'cloudflare/explore-worker/canonical/preview-worker.js').trim();
const worker = readFileSync(generatedWorkerPath, 'utf8');

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

// Unified personal state: one account-scoped snapshot contains both likes and follows.
assert.match(socialSnapshotService, /SORIDRAW_SOCIAL_SNAPSHOT_075_20260913/);
assert.match(socialSnapshotService, /likedTrackIds: string\[\]/);
assert.match(socialSnapshotService, /followingUids: string\[\]/);
assert.match(socialSnapshotService, /cacheKey: EXPLORE_SOCIAL_SNAPSHOT_CACHE_KEY/);
assert.match(socialSnapshotService, /uid: normalizedUid/);
assert.match(socialSnapshotService, /EXPLORE_SOCIAL_SNAPSHOT_PATH = '\/v1\/me\/social-snapshot'/);
assert.match(likeService, /getExploreSocialSnapshot\(user\)/);
assert.match(likeService, /rememberExploreSocialLike\(user\.uid, normalizedTrackId, liked\)/);
assert.match(likeService, /invalidateExploreSocialSnapshot\(uid\)/);
assert.match(socialService, /getExploreSocialSnapshot\(user\)/);
assert.match(socialService, /rememberExploreSocialFollow\(user\.uid, normalizedUid, result\.isFollowing\)/);
console.log('PASS 075 client: account-scoped likes + follows share one persistent social snapshot');

// Current public-profile first-view snapshot must continue to carry every public field
// currently rendered by the app plus its representative track window.
for (const field of [
  'avatarUrl',
  'backgroundUrl',
  'bio',
  'handle',
  'genres',
  'socialLinks',
  'followerCount',
  'followingCount',
  'trackCount',
]) {
  assert.match(profileTypes, new RegExp(`\\b${field}\\b`), `public profile field missing: ${field}`);
}
assert.match(profileTypes, /spotify:/);
assert.match(profileTypes, /instagram:/);
assert.match(profileTypes, /tiktok:/);
assert.match(profileService, /profile:/);
assert.match(profileService, /tracks:/);
assert.match(profileService, /nextCursor/);
console.log('PASS 075 public profile: full profile information remains bundled with representative tracks');

// Worker contract: transient queue is R2, D1 remains canonical only.
assert.equal(manifest.patches.at(-1), '042-explore-social-snapshot-r2-queue.mjs');
assert.match(runtime, /EXPLORE_LIKE_R2_QUEUE_PREFIX_042/);
assert.match(runtime, /bucket\.list\(/);
assert.match(runtime, /bucket\.delete\(row\.key\)/);
assert.match(runtime, /handleMySocialSnapshot042/);
assert.match(worker, /SORIDRAW_EXPLORE_SOCIAL_SNAPSHOT_R2_QUEUE_042_20260913/);
assert.match(worker, /url\.pathname === "\/v1\/me\/social-snapshot"/);

const enqueue = functionText(worker, 'async function enqueueExploreLikeBatch035(');
assert.match(enqueue, /bucket\.put\(exploreLikeR2QueueKey042/);
assert.match(enqueue, /queue: 'r2-042'/);
assert.doesNotMatch(enqueue, /env\.DB\./);
assert.doesNotMatch(enqueue, /explore_like_batches_069/);

const scheduled = functionText(worker, 'async function processExploreLikeBatches035(');
const firstR2Check = scheduled.indexOf('readExploreLikeR2QueueWave042');
const firstLease = scheduled.indexOf('acquireExploreLikeProcessor035');
assert.ok(firstR2Check >= 0 && firstLease > firstR2Check, 'R2 queue check must happen before any D1 lease write');
assert.match(scheduled, /d1Idle: true/);
assert.doesNotMatch(scheduled, /hasExploreLikeQueue069040/);
assert.doesNotMatch(scheduled, /explore_like_batches_069/);

const aggregate = functionText(worker, 'async function processExploreLikeR2QueueWave042(');
assert.equal((aggregate.match(/env\.DB\.batch/g) || []).length, 1);
assert.match(aggregate, /INSERT OR IGNORE INTO likes/);
assert.match(aggregate, /DELETE FROM likes/);
assert.match(aggregate, /SUM\(delta\)/);
assert.doesNotMatch(aggregate, /explore_like_batches_035|explore_like_batches_066|explore_like_batches_069/);
console.log('PASS 075 Worker: idle D1 R0/W0 path + R2 transient queue + canonical set-based aggregate');

// SQLite fixture mirrors the 042 D1 canonical aggregate. It proves that many users
// hitting one track update the public count once while retaining exact per-user state.
const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE likes(
    track_id TEXT NOT NULL,
    user_uid TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY(track_id,user_uid)
  );
  CREATE TABLE track_stats(
    track_id TEXT PRIMARY KEY,
    like_count INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,
    play_count INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE derived_touch(track_id TEXT PRIMARY KEY, touches INTEGER NOT NULL DEFAULT 0);
  INSERT INTO track_stats(track_id,like_count,updated_at) VALUES('t',0,1);
  INSERT INTO derived_touch(track_id,touches) VALUES('t',0);
  CREATE TRIGGER count_track_update AFTER UPDATE OF like_count ON track_stats
  WHEN OLD.like_count IS NOT NEW.like_count
  BEGIN
    UPDATE derived_touch SET touches=touches+1 WHERE track_id=NEW.track_id;
  END;
`);

const cte = `
WITH expanded AS (
  SELECT
    TRIM(CAST(json_extract(j.value, '$.batchId') AS TEXT)) AS batch_id,
    TRIM(CAST(json_extract(j.value, '$.userUid') AS TEXT)) AS user_uid,
    CAST(json_extract(j.value, '$.createdAt') AS INTEGER) AS created_at,
    TRIM(CAST(json_extract(j.value, '$.trackId') AS TEXT)) AS track_id,
    CASE WHEN CAST(json_extract(j.value, '$.desiredLiked') AS INTEGER) <> 0 THEN 1 ELSE 0 END AS desired_liked
  FROM json_each(?) AS j
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
    WHERE user_uid <> '' AND track_id <> ''
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

const applyPayload = (rows, now) => {
  const payload = JSON.stringify(rows);
  db.exec('BEGIN;');
  try {
    const positive = db.prepare(cte + `
      INSERT INTO track_stats(track_id,like_count,comment_count,play_count,updated_at)
      SELECT track_id,SUM(delta),0,0,? FROM deltas
      GROUP BY track_id HAVING SUM(delta)>0
      ON CONFLICT(track_id) DO UPDATE SET
        like_count=track_stats.like_count+excluded.like_count,
        updated_at=excluded.updated_at
    `).run(payload, now).changes;
    const negative = db.prepare(cte + `
      UPDATE track_stats
      SET like_count=MAX(0,like_count+COALESCE((SELECT SUM(d.delta) FROM deltas d WHERE d.track_id=track_stats.track_id),0)),
          updated_at=?
      WHERE track_id IN (SELECT track_id FROM deltas GROUP BY track_id HAVING SUM(delta)<0)
    `).run(payload, now).changes;
    const inserted = db.prepare(cte + `
      INSERT OR IGNORE INTO likes(track_id,user_uid,created_at)
      SELECT track_id,user_uid,created_at FROM latest WHERE desired_liked=1
    `).run(payload).changes;
    const deleted = db.prepare(cte + `
      DELETE FROM likes WHERE (track_id,user_uid) IN (
        SELECT track_id,user_uid FROM latest WHERE desired_liked=0
      )
    `).run(payload).changes;
    db.exec('COMMIT;');
    return { positive, negative, inserted, deleted };
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
};

const hundredLikes = Array.from({ length: 100 }, (_, index) => ({
  batchId: `b${String(index).padStart(3, '0')}`,
  userUid: `u${index}`,
  createdAt: 1000 + index,
  trackId: 't',
  desiredLiked: 1,
}));
const first = applyPayload(hundredLikes, 2000);
assert.equal(first.inserted, 100);
assert.equal(first.positive, 1);
assert.equal(first.negative, 0);
assert.equal(db.prepare("SELECT like_count AS c FROM track_stats WHERE track_id='t'").get().c, 100);
assert.equal(db.prepare("SELECT COUNT(*) AS c FROM likes WHERE track_id='t'").get().c, 100);
assert.equal(db.prepare("SELECT touches FROM derived_touch WHERE track_id='t'").get().touches, 1);

const netZero = [];
for (let index = 0; index < 50; index += 1) {
  netZero.push({ batchId: `off${index}`, userUid: `u${index}`, createdAt: 3000 + index, trackId: 't', desiredLiked: 0 });
  netZero.push({ batchId: `on${index}`, userUid: `n${index}`, createdAt: 3100 + index, trackId: 't', desiredLiked: 1 });
}
const second = applyPayload(netZero, 4000);
assert.equal(second.positive, 0);
assert.equal(second.negative, 0);
assert.equal(second.inserted, 50);
assert.equal(second.deleted, 50);
assert.equal(db.prepare("SELECT like_count AS c FROM track_stats WHERE track_id='t'").get().c, 100);
assert.equal(db.prepare("SELECT touches FROM derived_touch WHERE track_id='t'").get().touches, 1);

// Reversal ordering: latest intent per user+track wins inside one aggregate window.
const reversalOff = [
  { batchId: 'rev-a', userUid: 'rev', createdAt: 5000, trackId: 't', desiredLiked: 1 },
  { batchId: 'rev-b', userUid: 'rev', createdAt: 5001, trackId: 't', desiredLiked: 0 },
];
applyPayload(reversalOff, 5100);
assert.equal(db.prepare("SELECT COUNT(*) AS c FROM likes WHERE track_id='t' AND user_uid='rev'").get().c, 0);
const reversalOn = [
  { batchId: 'rev-c', userUid: 'rev', createdAt: 5200, trackId: 't', desiredLiked: 0 },
  { batchId: 'rev-d', userUid: 'rev', createdAt: 5201, trackId: 't', desiredLiked: 1 },
];
applyPayload(reversalOn, 5300);
assert.equal(db.prepare("SELECT COUNT(*) AS c FROM likes WHERE track_id='t' AND user_uid='rev'").get().c, 1);
console.log('PASS 075 D1 fixture: 100 users => 100 exact relations + one count touch; net-zero count => zero public touch; reversals converge');

console.log('PASS SORIDRAW 075 social snapshot / R2 queue verifier');

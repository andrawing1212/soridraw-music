import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const root = 'cloudflare/explore-worker/';
const service = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const migration = readFileSync(root + 'migrations/20260910_03_explore_like_write_optimization.sql', 'utf8');
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

assert.match(service, /SORIDRAW_EXPLORE_LIKE_BATCH_034_20260911/);
assert.match(service, /const EXPLORE_LIKE_BATCH_WINDOW_MS = 4 \* 60_000;/);
assert.match(service, /const EXPLORE_LIKE_BATCH_MAX = 50;/);
assert.match(service, /EXPLORE_LIKE_OUTBOX_CACHE_KEY = 'explore-like-outbox'/);
assert.match(service, /queuedAt:/);
assert.match(service, /dirty: true/);
assert.match(service, /resumePendingLikes\(user\)/);
assert.match(service, /EXPLORE_LIKE_SYNC_ERROR_EVENT/);
const queueFunction = functionText(service, 'export const setExploreTrackLike = async');
assert.match(queueFunction, /schedulePendingLikes\(user\)/);
assert.doesNotMatch(queueFunction, /requestExploreLike\(/, 'UI queue function must not call the server immediately');
const flushFunction = functionText(service, 'const flushPendingLikes = async');
assert.match(flushFunction, /'\/v1\/me\/likes\/batch'/);
assert.match(flushFunction, /mutations: batchEntries\.map/);
assert.doesNotMatch(service, /const EXPLORE_LIKE_IDLE_MS = 5_000;/, 'old per-track 5s flush must be retired');
assert.doesNotMatch(service, /schedulePendingLike\(user, normalizedTrackId/, 'per-track timers must be retired');
assert.match(page, /setExploreTrackLike\(user, track\.id, !currentLiked, track\.likeCount, track\.ownerUid\)/);
assert.match(page, /EXPLORE_LIKE_SYNC_EVENT/);
assert.match(page, /EXPLORE_LIKE_SYNC_ERROR_EVENT/);
console.log('PASS client: immediate optimistic result + durable 4-minute user-level multi-track outbox');

assert.ok(Array.isArray(manifest.patches));
assert.equal(manifest.patches.at(-1), '034-explore-like-user-batch.mjs');
assert.equal((migration.match(/UPDATE explore_derived_state\s+SET seq = seq \+ 1/g) || []).length, 1);
assert.match(migration, /WHERE OLD\.owner_uid IS NOT NEW\.owner_uid\s+ON CONFLICT/);
assert.match(migration, /OLD\.active IS NOT NEW\.active/);
console.log('PASS source contract: one seq bump; old-owner journal/count work is conditional');

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(root + 'scripts/fixtures/canonical-schema.sql', 'utf8'));
db.exec(`
  INSERT INTO public_profiles(uid,nickname,handle,created_at,updated_at)
  VALUES('u','Owner','owner',1,1);
  INSERT INTO profile_stats(uid,follower_count,following_count,updated_at)
  VALUES('u',0,0,1);
  INSERT INTO tracks(
    id,owner_uid,source_type,source_id,title,suno_url_primary,
    is_public,status,published_at,created_at,updated_at
  ) VALUES('t','u','suno_library','t','Track','audio/t',1,'published',1,1,1);
  INSERT INTO track_stats(track_id,like_count,comment_count,play_count,updated_at)
  VALUES('t',0,0,0,1);
`);
db.exec(readFileSync(root + 'migrations/20260910_01_explore_derived_state.sql', 'utf8'));
db.exec('BEGIN;' + readFileSync(root + 'migrations/20260910_02_explore_derived_seed.sql', 'utf8') + 'COMMIT;');
db.exec(migration);

const seqBefore = Number(db.prepare('SELECT seq FROM explore_derived_state WHERE id=1').get().seq);
const countBefore = Number(db.prepare("SELECT track_count FROM explore_derived_profiles WHERE uid='u'").get().track_count);
db.prepare("UPDATE track_stats SET like_count=1, updated_at=2 WHERE track_id='t'").run();
const seqAfter = Number(db.prepare('SELECT seq FROM explore_derived_state WHERE id=1').get().seq);
const countAfter = Number(db.prepare("SELECT track_count FROM explore_derived_profiles WHERE uid='u'").get().track_count);
assert.equal(seqAfter - seqBefore, 1, 'one like projection must advance global derived seq exactly once');
assert.equal(countAfter, countBefore, 'like-only update must not rewrite logical track count');
const feedChange = db.prepare("SELECT seq FROM explore_derived_changes WHERE scope='feed' AND kind='track' AND id='t'").get();
const profileChange = db.prepare("SELECT seq FROM explore_derived_changes WHERE scope='profile:u' AND kind='track' AND id='t'").get();
assert.equal(Number(feedChange.seq), seqAfter);
assert.equal(Number(profileChange.seq), seqAfter);
assert.equal(db.prepare("SELECT COUNT(*) AS c FROM explore_derived_changes WHERE id='t' AND kind='track'").get().c, 2);
console.log('PASS D1 fixture: like-only derived update = seq +1, feed + owner journal, track_count unchanged');

const generatedWorker = String(process.env.SORIDRAW_GENERATED_WORKER || '').trim();
if (generatedWorker) {
  const worker = readFileSync(generatedWorker, 'utf8');
  assert.match(worker, /SORIDRAW_EXPLORE_LIKE_DEFERRED_DERIVED_SYNC_033_20260910/);
  assert.match(worker, /SORIDRAW_EXPLORE_LIKE_USER_BATCH_034_20260911/);
  assert.match(worker, /url\.pathname === "\/v1\/me\/likes\/batch"/);
  assert.match(worker, /async function syncExploreLikeR2AfterMutation\(/, 'single-route compatibility must remain');
  const batchBody = functionText(worker, 'async function handleLikeBatch034(');
  assert.match(batchBody, /adjustExploreLikeCounterDelta/);
  assert.match(batchBody, /syncExploreLikeR2AfterBatch034/);
  assert.doesNotMatch(batchBody, /patchExploreFeedR2LikeCount|patchExploreProfileR2Like020|patchExploreFirstViewLikeCount/,
    'batch route must defer public Feed/Profile derived updates');
  const batchR2 = functionText(worker, 'async function syncExploreLikeR2AfterBatch034(');
  assert.equal((batchR2.match(/readExploreLikeR2Bundle/g) || []).length, 1);
  assert.equal((batchR2.match(/writeExploreR2Json/g) || []).length, 1);
  const batchRate = functionText(worker, 'async function enforceExploreLikeBatchRateLimit034(');
  assert.match(batchRate, /exploreRateDb031/);
  assert.match(batchRate, /excluded\.count/);
  for (const name of ['patchExploreFeedR2LikeCount', 'patchExploreProfileR2Like020']) {
    const body = functionText(worker, `async function ${name}(`);
    assert.doesNotMatch(body, /syncDerived|readExploreR2Json|writeExploreR2Json/);
  }
  console.log('PASS generated Worker: one authenticated multi-track batch + one user R2 sync; public Feed/Profile derived work deferred');
} else {
  console.log('INFO generated Worker check skipped; canonical Worker release supplies SORIDRAW_GENERATED_WORKER');
}

console.log('PASS Explore like 034 batch optimization static/fixture verifier; live batch cost remains PREVIEW-measurement only');

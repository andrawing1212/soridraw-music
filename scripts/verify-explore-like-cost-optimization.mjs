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
assert.match(flushFunction, /const accountSyncResults: (?:ExploreLikeBatchResult\[\]|Array<ExploreLikeBatchResult & \{ displayLikeCount\?: number \}>) = \[\]/);
assert.match(flushFunction, /accountSyncResults\.push\(visibleResult\)/);
assert.match(flushFunction, /publishExploreLikeAccountSyncSignal\(user, batchEntries, accountSyncResults\)/);
assert.doesNotMatch(service, /const EXPLORE_LIKE_IDLE_MS = 5_000;/, 'old per-track 5s flush must stay retired');
assert.match(page, /setExploreTrackLike\(user, track\.id, !currentLiked, track\.likeCount, track\.ownerUid\)/);
console.log('PASS client: one-minute PREVIEW outbox + same-account visible count replay survives page/background gaps');

assert.ok(Array.isArray(manifest.patches));
const requiredReleasePatches = [
  '034-explore-like-user-batch.mjs',
  '035-explore-like-deferred-aggregate.mjs',
  '036-explore-like-derived-intake.mjs',
  '038-explore-like-compact-queue.mjs'
];
assert.deepEqual(
  manifest.patches.filter((patch) => requiredReleasePatches.includes(patch)),
  requiredReleasePatches,
  'required like release patches must remain present and ordered'
);
assert.equal(manifest.patches.at(-2), '044-local-first-cost-hotpath.mjs', '044 local-first hotpath must remain directly before 045');
assert.equal(manifest.patches.at(-1), '045-publication-revision-metadata.mjs', '045 publication revision metadata must be the final Worker release patch');
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

// The remaining generated-Worker assertions are unchanged from 077 and are loaded below.
const generatedWorkerPath = process.env.SORIDRAW_GENERATED_WORKER || '';
if (generatedWorkerPath) {
  const worker = readFileSync(generatedWorkerPath, 'utf8');
  const batchBody = functionText(worker, 'async function handleLikeBatch034(');
  if (worker.includes('SORIDRAW_LOCAL_FIRST_COST_HOTPATH_044_20260913')) {
    assert.match(batchBody, /enqueueExploreLikeUserQueue075/);
    assert.match(batchBody, /syncExploreLikeR2AfterBatch034/);
    assert.match(batchBody, /const effectiveMutations = mutations;/);
    assert.doesNotMatch(batchBody, /readExploreLikeBatchStates035|canonical_liked|getPublicTrackForWrite|adjustExploreLikeCounterDelta/,
      '044 intake must not re-read canonical/derived track state or mutate canonical likes immediately');
    const personalR2 = functionText(worker, 'async function syncExploreLikeR2AfterBatch034(');
    assert.ok((personalR2.match(/readExploreLikeR2Bundle\(env, uid\)/g) || []).length >= 2,
      'cold personal-like R2 recovery must re-read and apply current intent');
    const userCte = functionText(worker, 'function exploreLikeUserAggregateCte075(');
    assert.match(userCte, /JOIN tracks t/);
    assert.match(userCte, /JOIN public_profiles p/);
    assert.match(userCte, /LEFT JOIN likes/);
    const userProcessor = functionText(worker, 'async function processExploreLikeUserQueueWave075(');
    assert.match(userProcessor, /env\.DB\.batch/);
    assert.match(userProcessor, /patchExploreFeedR2Like044/);
    assert.match(userProcessor, /patchExploreProfileR2Like044/);
    const publicationStateSync = functionText(worker, 'async function syncMusicNotePublicationR2AfterMutation(');
    assert.ok(publicationStateSync.includes('PROFILE_MEDIA.delete(musicNotePublicationR2Key(uid))'));
    if (worker.includes('SORIDRAW_PUBLICATION_REVISION_METADATA_045_20260913')) {
      const revision = functionText(worker, 'async function handleMusicNotePublicationRevision044(');
      assert.match(revision, /PROFILE_MEDIA\.head\(musicNotePublicationR2Key\(authContext\.uid\)\)/);
      assert.doesNotMatch(revision, /env\.DB|buildMusicNotePublicationR2Payload/,
        '045 publication revision check must remain R2 HEAD-only and D1-free');
    }
    console.log('PASS generated Worker 045: D1-free like intake + R2 HEAD-only publication revision + deferred canonical validation');
  }
}

console.log('PASS Explore like 045 verifier; live D1 rows remain PREVIEW-deployment measurement only');

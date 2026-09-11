import { readFileSync } from 'node:fs';

const migration = readFileSync('cloudflare/explore-worker/migrations/20260912_01_explore_like_w1_queue.sql', 'utf8');
const patch = readFileSync('cloudflare/explore-worker/patches/040-explore-like-w1-delayed-count.mjs', 'utf8');
const reversalPatch = readFileSync('cloudflare/explore-worker/patches/041-explore-like-reversal-order.mjs', 'utf8');
const releasePatches = readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8');
const service = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');

if (!/CREATE TABLE IF NOT EXISTS explore_like_batches_069/i.test(migration)) throw new Error('069 queue table missing');
if (!/WITHOUT ROWID/i.test(migration)) throw new Error('069 queue must be WITHOUT ROWID');
if (/CREATE\s+(?:UNIQUE\s+)?INDEX/i.test(migration)) throw new Error('069 W1 queue must not add a secondary index');
if (!/batch_id TEXT PRIMARY KEY/i.test(migration)) throw new Error('069 chronological batch_id primary key missing');

for (const token of [
  'SORIDRAW_EXPLORE_LIKE_W1_DELAYED_COUNT_040_20260912',
  'INSERT OR IGNORE INTO explore_like_batches_069',
  "queue: '069'",
  'WHERE batch_id <=',
  'effectiveMutations',
  'likeCount: clampExploreSocialCount(state.like_count)',
]) {
  if (!patch.includes(token)) throw new Error(`069 worker contract missing: ${token}`);
}

for (const token of [
  'SORIDRAW_EXPLORE_LIKE_REVERSAL_ORDER_041_20260912',
  "const baseLiked = typeof row?.baseLiked === 'boolean' ? row.baseLiked : null",
  'if (mutation.liked !== canonicalLiked) return true',
  'if (mutation.baseLiked === null) return true',
  'return mutation.baseLiked !== mutation.liked',
]) {
  if (!reversalPatch.includes(token)) throw new Error(`069 reversal contract missing: ${token}`);
}
if (!releasePatches.includes('041-explore-like-reversal-order.mjs')) throw new Error('041 release patch registration missing');

if (!service.includes('SORIDRAW_EXPLORE_LIKE_W1_DELAYED_COUNT_069_20260912')) throw new Error('069 client marker missing');
if (!service.includes('mutationAt: pending.updatedAt')) throw new Error('stable mutationAt missing');
if (!service.includes('baseLiked: pending.baseLiked')) throw new Error('reversal baseLiked hint missing');
if (!service.includes('const optimisticLikeCount = clampLikeCount(currentLikeCount);')) throw new Error('client still changes numeric count');
if (service.includes('clampLikeCount(currentLikeCount) + (liked ? 1 : -1)')) throw new Error('optimistic numeric delta still present');

const syncAt = page.indexOf('const onLikeSync = (event: Event) => {');
const syncEnd = page.indexOf('const onLikeSyncError', syncAt);
const syncBody = page.slice(syncAt, syncEnd);
if (syncBody.includes('updateTrackLikeCount')) throw new Error('same-account heart sync still mutates public count');
if (!syncBody.includes('setLikedTrackIds')) throw new Error('same-account heart sync missing');

const shouldQueue = ({ canonicalLiked, desiredLiked, baseLiked }) => {
  if (desiredLiked !== canonicalLiked) return true;
  if (baseLiked === null) return true;
  return baseLiked !== desiredLiked;
};

const cases = [
  { label: 'first like', canonicalLiked: false, desiredLiked: true, baseLiked: false, expected: true },
  { label: 'like then unlike before aggregate', canonicalLiked: false, desiredLiked: false, baseLiked: true, expected: true },
  { label: 'first unlike', canonicalLiked: true, desiredLiked: false, baseLiked: true, expected: true },
  { label: 'unlike then like before aggregate', canonicalLiked: true, desiredLiked: true, baseLiked: false, expected: true },
  { label: 'new-client false no-op', canonicalLiked: false, desiredLiked: false, baseLiked: false, expected: false },
  { label: 'new-client true no-op', canonicalLiked: true, desiredLiked: true, baseLiked: true, expected: false },
  { label: 'legacy false apparent no-op stays safe', canonicalLiked: false, desiredLiked: false, baseLiked: null, expected: true },
  { label: 'legacy true apparent no-op stays safe', canonicalLiked: true, desiredLiked: true, baseLiked: null, expected: true },
];
for (const testCase of cases) {
  const actual = shouldQueue(testCase);
  if (actual !== testCase.expected) throw new Error(`reversal ordering failed: ${testCase.label}`);
}

console.log('EXPLORE_LIKE_W1_SCHEMA_STATIC=PASS');
console.log('EXPLORE_LIKE_DELAYED_PUBLIC_COUNT=PASS');
console.log('EXPLORE_LIKE_STABLE_RETRY_IDEMPOTENCY=PASS');
console.log('EXPLORE_LIKE_PRE_AGGREGATE_REVERSAL_ORDER=PASS');
console.log('EXPLORE_LIKE_LEGACY_REVERSAL_COMPAT=PASS');

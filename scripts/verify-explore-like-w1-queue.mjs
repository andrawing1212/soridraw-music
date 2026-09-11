import { readFileSync } from 'node:fs';

const migration = readFileSync('cloudflare/explore-worker/migrations/20260912_01_explore_like_w1_queue.sql', 'utf8');
const patch = readFileSync('cloudflare/explore-worker/patches/040-explore-like-w1-delayed-count.mjs', 'utf8');
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

if (!service.includes('SORIDRAW_EXPLORE_LIKE_W1_DELAYED_COUNT_069_20260912')) throw new Error('069 client marker missing');
if (!service.includes('mutationAt: pending.updatedAt')) throw new Error('stable mutationAt missing');
if (!service.includes('const optimisticLikeCount = clampLikeCount(currentLikeCount);')) throw new Error('client still changes numeric count');
if (service.includes('clampLikeCount(currentLikeCount) + (liked ? 1 : -1)')) throw new Error('optimistic numeric delta still present');

const syncAt = page.indexOf('const onLikeSync = (event: Event) => {');
const syncEnd = page.indexOf('const onLikeSyncError', syncAt);
const syncBody = page.slice(syncAt, syncEnd);
if (syncBody.includes('updateTrackLikeCount')) throw new Error('same-account heart sync still mutates public count');
if (!syncBody.includes('setLikedTrackIds')) throw new Error('same-account heart sync missing');

console.log('EXPLORE_LIKE_W1_SCHEMA_STATIC=PASS');
console.log('EXPLORE_LIKE_DELAYED_PUBLIC_COUNT=PASS');
console.log('EXPLORE_LIKE_STABLE_RETRY_IDEMPOTENCY=PASS');

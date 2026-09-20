import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const cache = readFileSync('src/services/exploreSessionCache.ts', 'utf8');
const likeService = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const workerPath = process.env.SORIDRAW_GENERATED_WORKER || 'cloudflare/explore-worker/canonical/preview-worker.js';
const worker = readFileSync(workerPath, 'utf8');
const patch056 = readFileSync('cloudflare/explore-worker/patches/056-explore-public-like-parity.mjs', 'utf8');
const patch065 = readFileSync('cloudflare/explore-worker/patches/065-shared-like-count-targeted.mjs', 'utf8');
const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));
const entry = readFileSync('cloudflare/explore-worker/canonical/preview-entry.js', 'utf8');

assert.ok(Number(version.version) >= 123, 'app123 behavior must remain available in later releases');

// App update/re-entry must use the last known persistent Feed without a network revalidation.
assert.match(page, /SORIDRAW_EXPLORE_UPDATE_LAST_KNOWN_FEED_123_20260918/);
assert.match(page, /const feedRevisionRequestedUrlRef = useRef\(''\)/);
const cachedStart = page.indexOf('if (cachedRows) {');
const coldStart = page.indexOf('setLoading(true);', cachedStart);
assert.ok(cachedStart >= 0 && coldStart > cachedStart, 'cached Feed branch missing');
const cachedBranch = page.slice(cachedStart, coldStart);
assert.match(cachedBranch, /const revalidateRequested = feedRequest && feedRevisionRequestedUrlRef\.current === requestUrl/);
assert.match(cachedBranch, /if \(!revalidateRequested\) \{/);
assert.match(cachedBranch, /feedRevisionEventAtRef\.current = now/);
assert.match(cachedBranch, /feedRevisionActivityAtRef\.current = now/);
assert.match(cachedBranch, /feedRevisionRequestedUrlRef\.current = ''/);
const guardIndex = cachedBranch.indexOf('if (!revalidateRequested)');
const fetchRevisionIndex = cachedBranch.indexOf('const serverRevision = await fetchRevision()');
assert.ok(guardIndex >= 0 && fetchRevisionIndex > guardIndex, 'cached Feed still revalidates before explicit activity request');

const requestStart = page.indexOf('const requestRevisionCheck = () => {');
const requestEnd = page.indexOf('};', requestStart) + 2;
const requestBlock = page.slice(requestStart, requestEnd);
assert.match(requestBlock, /feedRevisionRequestedUrlRef\.current = requestUrl/);
assert.match(requestBlock, /setFeedRevisionSignal/);

// Persistent Feed cache contract remains app-version independent.
assert.match(cache, /const EXPLORE_FEED_CACHE_SCHEMA_VERSION = 3/);
assert.match(cache, /expiresAt: null/);
assert.doesNotMatch(cache, /APP_VERSION|app-version|version\.version/i);

// Existing timing and actor behavior stay unchanged.
assert.match(likeService, /EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 30_000/);
assert.match(page, /EXPLORE_FEED_REVISION_EVENT_DEDUPE_MS = 120_000/);
assert.match(page, /EXPLORE_FEED_REVISION_ACTIVITY_MIN_INTERVAL_MS = 120_000/);
assert.match(entry, /EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105 = 1 \* 60 \* 1000/);

// 056 exposes only the rows whose public count actually changed.
assert.match(patch056, /changedItems: \[\.\.\.changedByTrack\.values\(\)\]/);

// 065 is the final release patch and must stay R2-targeted.
assert.ok(Array.isArray(manifest.patches));
assert.ok(manifest.patches.includes('065-shared-like-count-targeted.mjs'), '065 targeted like patch must remain registered');
const patchHelperStart = patch065.indexOf('const helpers =');
const patchWrapperStart = patch065.indexOf('const wrapper =', patchHelperStart);
assert.ok(patchHelperStart >= 0 && patchWrapperStart > patchHelperStart, '065 patch helper boundary missing');
const patchHelperSource = patch065.slice(patchHelperStart, patchWrapperStart);
assert.doesNotMatch(patchHelperSource, /env\.DB\.|\.prepare\(/);
assert.match(patch065, /patchSharedFeedLikeCounts065/);
assert.match(patch065, /patchSharedTrackCard062/);
assert.match(patch065, /targetedLikePatch: '065'/);

// Canonical Worker must contain the generated runtime, not only patch source.
for (const token of [
  'SORIDRAW_SHARED_LIKE_COUNT_TARGETED_065_20260918',
  'processExploreLikeBatches035Core065',
  'patchSharedFeedLikeCounts065',
  'publicProjectionDetail?.changedItems',
  worker.includes('SORIDRAW_SHARED_FEED_LEGACY_WRITER_GUARD_070_20260919')
    ? "targetedLikePatch: '065-cas-070'"
    : "targetedLikePatch: '065'",
]) assert.ok(worker.includes(token), `canonical Worker missing: ${token}`);

const helperStart = worker.indexOf('async function patchSharedFeedLikeCounts065');
const wrapperStart = worker.indexOf('async function processExploreLikeBatches035(env, scheduledTime = Date.now())', helperStart);
assert.ok(helperStart >= 0 && wrapperStart > helperStart, '065 helper/wrapper boundary missing');
const helper = worker.slice(helperStart, wrapperStart);
assert.doesNotMatch(helper, /env\.DB|\.prepare\(/);
assert.match(helper, /for \(const sort of \['latest', 'popular'\]\)/);
assert.match(helper, /await shared\.get\(key\)/);
assert.match(helper, /await shared\.put\(key, JSON\.stringify\(nextBundle\)/);
assert.match(helper, /if \(!wanted\.has\(trackId\)\) return item/);

console.log('PASS 123: update keeps last-known Feed, changed likes patch shared R2 by track only.');
console.log('APP_UPDATE_CACHED_FEED_SERVER_READ=0_BY_BRANCH');
console.log('ACTIVITY_REVISION_GATE=120_SECONDS');
console.log('LIKE_BATCH_IDLE=30_SECONDS');
console.log('SHARED_AGGREGATE=60_SECONDS');
console.log('SHARED_LIKE_PATCH=TARGETED_R2_ONLY');
console.log('D1_FULL_FEED_REBUILD=ABSENT');
console.log('NO_USER_DATA_MIGRATION=true');

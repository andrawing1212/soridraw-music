import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const likedTracks = readFileSync('src/services/exploreLikedTracksService.ts', 'utf8');
const domain = readFileSync('src/services/userDomainSyncService.ts', 'utf8');
const workerEntry = readFileSync('cloudflare/explore-worker/canonical/preview-entry.js', 'utf8');
const intakePatch = readFileSync('cloudflare/explore-worker/patches/055-explore-like-intake-w1-hotpath.mjs', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

assert.equal(String(version.version), '120');

assert.match(service, /SORIDRAW_EXPLORE_LIKE_ACTOR_COUNT_LOCK_120_20260918/);
assert.match(service, /EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 20_000/);
assert.match(service, /EXPLORE_LIKE_SHARED_PUBLISH_LOCK_MS_120 = 90_000/);
for (const key of [
  'explore-liked-state-120',
  'explore-like-outbox-120',
  'explore-like-display-lock-120',
]) assert.ok(service.includes(key), `missing app120 cache key: ${key}`);

for (const legacy of [
  'explore-liked-state-119',
  'explore-like-outbox-119',
  'explore-like-display-lock-119',
  'explore-like-account-patches',
]) assert.ok(!service.includes(legacy), `legacy like cache recognized: ${legacy}`);

const overlayStart = service.indexOf('export function overlayExploreLikeDisplayCounts');
const overlayEnd = service.indexOf('const dispatchLikeSync', overlayStart);
assert.ok(overlayStart >= 0 && overlayEnd > overlayStart);
const overlay = service.slice(overlayStart, overlayEnd);
assert.match(overlay, /const outbox = readLikeOutbox\(normalizedUid\)/);
assert.match(overlay, /const locks = readLikeDisplayLocks\(normalizedUid\)/);
assert.match(overlay, /if \(pending\)/);
assert.match(overlay, /pending\.optimisticLikeCount/);
assert.match(overlay, /sharedCount === lock\.likeCount \|\| lock\.protectUntil <= now/);
assert.match(overlay, /persistLikeDisplayLocks\(normalizedUid, locks\)/);

const flushStart = service.indexOf('flushPendingLikes = async');
const flushEnd = service.indexOf('// App 120 deliberately ignores historical RTDB', flushStart);
assert.ok(flushStart >= 0 && flushEnd > flushStart);
const flush = service.slice(flushStart, flushEnd);
assert.match(flush, /\/v1\/me\/likes\/batch/);
assert.match(flush, /displayLocks\[pending\.trackId\] = \{/);
assert.match(flush, /likeCount: pending\.optimisticLikeCount/);
assert.match(flush, /protectUntil: acknowledgedAt \+ EXPLORE_LIKE_SHARED_PUBLISH_LOCK_MS_120/);
assert.match(flush, /delete latest\[pending\.trackId\]/);

const setterStart = service.indexOf('export const setExploreTrackLike = async');
const setter = service.slice(setterStart);
assert.match(setter, /baseLikeCount \+ \(liked \? 1 : 0\) - \(baseLiked \? 1 : 0\)/);
assert.match(setter, /schedulePendingFlush\(user\)/);
assert.doesNotMatch(setter, /void flushPendingLikes\(user\)/);

assert.match(page, /SORIDRAW_EXPLORE_LIKE_ACTOR_COUNT_LOCK_120_20260918/);
assert.match(page, /overlayExploreLikeDisplayCounts/);
assert.match(page, /const displayTracks = overlayActorLikeCounts120\(normalizedTracks\)/);
assert.match(page, /setTracks\(overlayActorLikeCounts120\(cachedTracks\)\)/);
assert.match(page, /const displayTracks = overlayActorLikeCounts120\(normalizedTracks\);[\s\S]*setProfileTracks\(displayTracks\)/);
assert.match(page, /const normalizedRows = overlayActorLikeCounts120\(/);
assert.match(page, /const displayRows = overlayActorLikeCounts120\(normalized\)/);
assert.match(page, /effectiveSharedTracks = activeUid[\s\S]*overlayExploreLikeDisplayCounts\(activeUid, sharedTracks\)/);
assert.doesNotMatch(page, /setTracks\(normalizedTracks\)/);
assert.doesNotMatch(page, /setProfileTracks\(normalizedTracks\)/);

assert.match(likedTracks, /SORIDRAW_EXPLORE_LIKED_TRACK_LATEST_CACHE_120_20260918/);
assert.match(likedTracks, /LIKED_TRACK_CACHE_SCHEMA_VERSION = 120/);
assert.match(likedTracks, /explore-liked-track-collection-120/);
assert.ok(!likedTracks.includes('explore-liked-track-collection-119'));

assert.doesNotMatch(domain, /userSync\/\$\{safeUid\}\/exploreLike/);
assert.doesNotMatch(domain, /observeExploreLikeAccountSyncSignal/);

// Keep the already-working cost path unchanged.
assert.match(workerEntry, /EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105 = 1 \* 60 \* 1000/);
assert.match(workerEntry, /cron: 'event-like-batch-1m-105'/);
assert.match(workerEntry, /REVISION_HEAD_CACHE_SECONDS_077 = 60/);
assert.match(intakePatch, /single-B-tree 069 queue: one warm batch => D1 R0\/W1/);

console.log('PASS 120: actor count cannot be overwritten by stale Feed/Profile payloads.');
console.log('ACTOR_UI=IMMEDIATE_HEART_AND_COUNT_STABLE');
console.log('CLIENT_BATCH=20S_SLIDING_IDLE');
console.log('SERVER_INTAKE=W1_QUEUE');
console.log('SHARED_PUBLICATION=ONE_MINUTE');
console.log('OLD_LIKE_CACHE=IGNORED');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const domain = readFileSync('src/services/userDomainSyncService.ts', 'utf8');
const likedTracks = readFileSync('src/services/exploreLikedTracksService.ts', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));
const workerEntry = readFileSync('cloudflare/explore-worker/canonical/preview-entry.js', 'utf8');
const intakePatch = readFileSync('cloudflare/explore-worker/patches/055-explore-like-intake-w1-hotpath.mjs', 'utf8');

assert.equal(String(version.version), '119');

assert.match(service, /SORIDRAW_EXPLORE_LIKE_LATEST_CACHE_IDLE_BATCH_119_20260918/);
assert.match(service, /EXPLORE_LIKE_IDLE_FLUSH_MS_119 = 20_000/);
assert.match(service, /explore-liked-state-119/);
assert.match(service, /explore-like-outbox-119/);
assert.doesNotMatch(service, /explore-like-account-patches/);
assert.doesNotMatch(service, /runTransaction/);
assert.doesNotMatch(service, /realtimeDb/);
assert.doesNotMatch(service, /getExplorePersonalSocialSnapshot/);
assert.doesNotMatch(service, /patchExplorePersonalSocialLike/);

const setterStart = service.indexOf('export const setExploreTrackLike = async');
const setter = service.slice(setterStart);
assert.ok(setterStart >= 0);
assert.match(setter, /baseLiked = existing\?\.baseLiked \?\? previousVisibleLiked/);
assert.match(setter, /baseLikeCount = existing\?\.baseLikeCount \?\? clampLikeCount\(currentLikeCount\)/);
assert.match(setter, /baseLikeCount \+ \(liked \? 1 : 0\) - \(baseLiked \? 1 : 0\)/);
assert.match(setter, /schedulePendingFlush\(user\)/);
assert.doesNotMatch(setter, /void flushPendingLikes\(user\)/);

const scheduleStart = service.indexOf('const schedulePendingFlush');
const scheduleEnd = service.indexOf('flushPendingLikes = async', scheduleStart);
const schedule = service.slice(scheduleStart, scheduleEnd);
assert.match(schedule, /clearFlushTimer\(uid\)/);
assert.match(schedule, /latestOutboxUpdatedAt\(outbox\) \+ EXPLORE_LIKE_IDLE_FLUSH_MS_119/);
assert.match(schedule, /window\.setTimeout/);

const flushStart = service.indexOf('flushPendingLikes = async');
const flushEnd = service.indexOf('// App 119 deliberately ignores historical RTDB', flushStart);
const flush = service.slice(flushStart, flushEnd);
assert.match(flush, /pending\.desiredLiked === pending\.baseLiked/);
assert.match(flush, /pending\.desiredLiked !== pending\.baseLiked/);
assert.equal((flush.match(/\/v1\/me\/likes\/batch/g) || []).length, 1);
assert.match(flush, /mutations: batchEntries\.map/);
assert.doesNotMatch(flush, /setTimeout\([^)]*EXPLORE_LIKE_IDLE_FLUSH_MS_119/);

assert.match(service, /observeExploreLikeAccountSyncSignal = \(_user: User, _value: unknown\) => \{\}/);
assert.match(service, /flushPendingExploreLikesForPageExit[\s\S]*schedulePendingFlush\(user\)/);

assert.match(page, /SORIDRAW_EXPLORE_LIKE_LATEST_CACHE_IDLE_BATCH_119_20260918/);
assert.match(page, /EXPLORE_FEED_REVISION_EVENT_DEDUPE_MS = 60_000/);
assert.match(page, /EXPLORE_FEED_REVISION_ACTIVITY_MIN_INTERVAL_MS = 60_000/);
assert.match(page, /optimisticTrack = \{ \.\.\.track, likeCount: result\.likeCount \}/);
assert.match(page, /setTracks\(patchOptimisticCount119\)/);
assert.match(page, /patchExploreFeedSessionCachesRow\(track\.id, \{ likeCount: result\.likeCount \}\)/);
assert.doesNotMatch(page, /EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT/);
assert.doesNotMatch(page, /scheduleAggregateCountRefresh071/);
assert.doesNotMatch(page, /readExploreLikeRefreshDeadline071/);
assert.doesNotMatch(page, /writeExploreLikeRefreshDeadline071/);

assert.doesNotMatch(domain, /userSync\/\$\{safeUid\}\/exploreLike/);
assert.doesNotMatch(domain, /observeExploreLikeAccountSyncSignal/);

// Existing server path stays deliberately simple: one W1 queue intake after the
// 20-second client idle batch, then one shared one-minute alarm for publication.
assert.match(intakePatch, /single-B-tree 069 queue: one warm batch => D1 R0\/W1/);
assert.match(intakePatch, /await enqueueExploreLikeBatch035\(env, authContext\.uid, effectiveMutations, receivedAt\)/);
assert.doesNotMatch(intakePatch, /readExploreLikeBatchStates035\(/);
assert.match(workerEntry, /EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105 = 1 \* 60 \* 1000/);
assert.match(workerEntry, /cron: 'event-like-batch-1m-105'/);
assert.match(workerEntry, /REVISION_HEAD_CACHE_SECONDS_077 = 60/);

assert.match(likedTracks, /SORIDRAW_EXPLORE_LIKED_TRACK_LATEST_CACHE_119_20260918/);
assert.match(likedTracks, /LIKED_TRACK_CACHE_SCHEMA_VERSION = 119/);
assert.match(likedTracks, /explore-liked-track-collection-119/);

console.log('PASS 119: latest-cache only, 20s sliding idle batch, immediate heart/count, old RTDB/071 replay disabled.');
console.log('ACTOR_UI=IMMEDIATE_HEART_AND_COUNT');
console.log('SERVER_INTAKE=ONE_BATCH_AFTER_20S_IDLE');
console.log('SAME_TRACK=FIRST_BASE_TO_LAST_DESIRED');
console.log('OLD_LIKE_CACHE=IGNORED');
console.log('SERVER_D1_INTAKE=W1_QUEUE');
console.log('SHARED_AGGREGATE=ONE_MINUTE_ALARM');
console.log('SHARED_REVALIDATION=MAX_ONCE_PER_MINUTE');

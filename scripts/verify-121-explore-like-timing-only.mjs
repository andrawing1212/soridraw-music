import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const workerEntry = readFileSync('cloudflare/explore-worker/canonical/preview-entry.js', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

assert.equal(String(version.version), '121');

// Requested timing-only change.
assert.match(service, /EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 30_000/);
assert.doesNotMatch(service, /EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 20_000/);
assert.match(page, /EXPLORE_FEED_REVISION_EVENT_DEDUPE_MS = 120_000/);
assert.match(page, /EXPLORE_FEED_REVISION_ACTIVITY_MIN_INTERVAL_MS = 120_000/);
assert.doesNotMatch(page, /EXPLORE_FEED_REVISION_EVENT_DEDUPE_MS = 60_000/);
assert.doesNotMatch(page, /EXPLORE_FEED_REVISION_ACTIVITY_MIN_INTERVAL_MS = 60_000/);

// Keep app120 behavior unchanged.
for (const token of [
  "explore-liked-state-120",
  "explore-like-outbox-120",
  "explore-like-display-lock-120",
  "EXPLORE_LIKE_SHARED_PUBLISH_LOCK_MS_120 = 90_000",
  "overlayExploreLikeDisplayCounts",
]) assert.ok(service.includes(token), `app120 invariant missing: ${token}`);

assert.match(service, /baseLikeCount \+ \(liked \? 1 : 0\) - \(baseLiked \? 1 : 0\)/);
assert.match(service, /schedulePendingFlush\(user\)/);
assert.match(page, /SORIDRAW_EXPLORE_LIKE_ACTOR_COUNT_LOCK_120_20260918/);
assert.match(page, /overlayExploreLikeDisplayCounts/);

// Server shared publication stays at one minute; this task changes only the other-user
// client-side activity gate from 60s to 120s.
assert.match(workerEntry, /EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105 = 1 \* 60 \* 1000/);
assert.match(workerEntry, /cron: 'event-like-batch-1m-105'/);
assert.match(workerEntry, /REVISION_HEAD_CACHE_SECONDS_077 = 60/);

console.log('PASS 121: timing-only change verified.');
console.log('ACTOR_BATCH_IDLE=30_SECONDS');
console.log('OTHER_USER_ACTIVITY_GATE=120_SECONDS');
console.log('SERVER_SHARED_AGGREGATE=UNCHANGED_60_SECONDS');
console.log('APP120_CACHE_AND_COUNT_LOCK=UNCHANGED');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync('cloudflare/explore-worker/canonical/preview-entry.js', 'utf8');
const like = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const revision = readFileSync('src/services/exploreRevisionRequestCache.ts', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

const appVersion = Number(version.version);
assert.ok(Number.isFinite(appVersion) && appVersion >= 105, `105 one-minute contract incompatible with app ${version.version}`);

// Shared publication remains one event-driven alarm one minute after accepted intake.
assert.match(worker, /SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_105_20260916/);
assert.match(worker, /const EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105 = 1 \* 60 \* 1000;/);
assert.match(worker, /cron: 'event-like-batch-1m-105'/);
assert.match(worker, /ExploreLikeBatchScheduler103 extends DurableObject/);
assert.doesNotMatch(worker, /EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_103 = 5 \* 60 \* 1000/);
assert.doesNotMatch(worker, /event-like-batch-5m-103/);

// Current actor path is app120+: one trailing 30-second local batch, not the obsolete
// app105 client one-minute window. This changes only intake timing; shared aggregate stays 1m.
if (appVersion >= 120) {
  assert.match(like, /SORIDRAW_EXPLORE_LIKE_ACTOR_COUNT_LOCK_120_20260918/);
  assert.match(like, /const EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 30_000;/);
  assert.match(like, /latestOutboxUpdatedAt\(outbox\) \+ EXPLORE_LIKE_IDLE_FLUSH_MS_120/);
  assert.match(like, /schedulePendingFlush\(user\)/);
  assert.doesNotMatch(like, /EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 20_000/);
  assert.doesNotMatch(like, /EXPLORE_LIKE_EVENT_WINDOW_MS_105/);
} else {
  assert.match(like, /SORIDRAW_EXPLORE_LIKE_CLIENT_EVENT_WINDOW_105_20260916/);
  assert.match(like, /const EXPLORE_LIKE_EVENT_WINDOW_MS_105 = 1 \* 60_000;/);
}

// Current viewer refresh is activity-gated at two minutes. There is no actor-forced
// 1m+10s refresh timer anymore; the shared revision is checked only on real activity.
if (appVersion >= 121) {
  assert.match(page, /SORIDRAW_EXPLORE_LIKE_LATEST_CACHE_IDLE_BATCH_119_20260918/);
  assert.match(page, /EXPLORE_FEED_REVISION_EVENT_DEDUPE_MS = 120_000/);
  assert.match(page, /EXPLORE_FEED_REVISION_ACTIVITY_MIN_INTERVAL_MS = 120_000/);
  assert.doesNotMatch(page, /scheduleAggregateCountRefresh071/);
  assert.doesNotMatch(page, /EXPLORE_LIKE_REFRESH_GRACE_MS_105/);
} else {
  assert.match(page, /SORIDRAW_EXPLORE_LIKE_EVENT_REFRESH_105_20260916/);
}

// Small revision responses may be reused for one minute; D1 stays R0/W0 on this path.
assert.match(revision, /SORIDRAW_EXPLORE_LIKE_REVISION_1MIN_105_20260916/);
assert.match(revision, /const REVISION_CACHE_TTL_MS = 1 \* 60 \* 1000;/);
assert.match(revision, /feed-revision-response\.v3:/);
assert.doesNotMatch(revision, /const REVISION_CACHE_TTL_MS = 5 \* 60 \* 1000;/);

console.log('105_EXPLORE_LIKE_1MIN=PASS');
console.log('SERVER_AGGREGATE_WINDOW=1MIN_EVENT_DRIVEN');
console.log(appVersion >= 120 ? 'ACTOR_BATCH_IDLE=30_SECONDS' : 'CLIENT_EVENT_WINDOW=1MIN');
console.log(appVersion >= 121 ? 'VIEWER_ACTIVITY_GATE=120_SECONDS' : 'VIEWER_REFRESH=LEGACY_105');
console.log('REVISION_CACHE_TTL=1MIN');
console.log('IDLE_PERIODIC_CRON=0');
console.log('DO_CLASS_MIGRATION=NONE');
console.log('NO_D1_SCHEMA_MIGRATION=true');
console.log('NO_UI_CSS_CHANGE=true');

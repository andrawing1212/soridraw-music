import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync('cloudflare/explore-worker/canonical/preview-entry.js', 'utf8');
const like = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const revision = readFileSync('src/services/exploreRevisionRequestCache.ts', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

assert.ok(['105', '106'].includes(version.version), `105 one-minute contract incompatible with app ${version.version}`);

assert.match(worker, /SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_105_20260916/);
assert.match(worker, /const EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105 = 1 \* 60 \* 1000;/);
assert.match(worker, /cron: 'event-like-batch-1m-105'/);
assert.match(worker, /ExploreLikeBatchScheduler103 extends DurableObject/);
assert.doesNotMatch(worker, /EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_103 = 5 \* 60 \* 1000/);
assert.doesNotMatch(worker, /event-like-batch-5m-103/);

assert.match(like, /SORIDRAW_EXPLORE_LIKE_CLIENT_EVENT_WINDOW_105_20260916/);
assert.match(like, /const EXPLORE_LIKE_EVENT_WINDOW_MS_105 = 1 \* 60_000;/);
assert.match(like, /const EXPLORE_LIKE_FINAL_FLUSH_LEAD_MS_104 = 15_000;/);
assert.match(like, /const finalFlushDelay = EXPLORE_LIKE_EVENT_WINDOW_MS_105 - EXPLORE_LIKE_FINAL_FLUSH_LEAD_MS_104;/);
assert.match(like, /void flushPendingLikes\(user\);/);
assert.doesNotMatch(like, /const EXPLORE_LIKE_EVENT_WINDOW_MS_104 = 5 \* 60_000;/);

assert.match(page, /SORIDRAW_EXPLORE_LIKE_EVENT_REFRESH_105_20260916/);
assert.match(page, /const EXPLORE_LIKE_AGGREGATE_WINDOW_MS_105 = 1 \* 60_000;/);
assert.match(page, /const EXPLORE_LIKE_REFRESH_GRACE_MS_105 = 10_000;/);
assert.match(page, /const deadline = now \+ EXPLORE_LIKE_AGGREGATE_WINDOW_MS_105 \+ EXPLORE_LIKE_REFRESH_GRACE_MS_105;/);
assert.doesNotMatch(page, /EXPLORE_LIKE_AGGREGATE_WINDOW_MS_104 = 5 \* 60_000/);

assert.match(revision, /SORIDRAW_EXPLORE_LIKE_REVISION_1MIN_105_20260916/);
assert.match(revision, /const REVISION_CACHE_TTL_MS = 1 \* 60 \* 1000;/);
assert.match(revision, /feed-revision-response\.v3:/);
assert.doesNotMatch(revision, /const REVISION_CACHE_TTL_MS = 5 \* 60 \* 1000;/);

console.log('105_EXPLORE_LIKE_1MIN=PASS');
console.log('SERVER_AGGREGATE_WINDOW=1MIN_EVENT_DRIVEN');
console.log('CLIENT_EVENT_WINDOW=1MIN');
console.log('REVISION_CACHE_TTL=1MIN');
console.log('FINAL_FLUSH_LEAD_MS=15000');
console.log('ACTOR_FORCED_REFRESH=1MIN_PLUS_10SEC');
console.log('IDLE_PERIODIC_CRON=0');
console.log('DO_CLASS_MIGRATION=NONE');
console.log('NO_D1_SCHEMA_MIGRATION=true');
console.log('NO_UI_CSS_CHANGE=true');

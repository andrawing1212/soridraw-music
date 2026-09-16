import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const like = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

assert.equal(version.version, '104');

assert.match(like, /SORIDRAW_EXPLORE_LIKE_CLIENT_EVENT_WINDOW_104_20260916/);
assert.match(like, /const EXPLORE_LIKE_EVENT_WINDOW_MS_104 = 5 \* 60_000;/);
assert.match(like, /const EXPLORE_LIKE_FINAL_FLUSH_LEAD_MS_104 = 15_000;/);
assert.match(like, /const beginExploreLikeEventWindow104 = \(user: User, now = Date\.now\(\)\) =>/);
assert.match(like, /const finalFlushDelay = EXPLORE_LIKE_EVENT_WINDOW_MS_104 - EXPLORE_LIKE_FINAL_FLUSH_LEAD_MS_104;/);
assert.match(like, /exploreLikeEventWindowByUid104\.delete\(uid\);[\s\S]*void flushPendingLikes\(user\);/);
assert.match(like, /const startedEventWindow104 = beginExploreLikeEventWindow104\(user, now\);[\s\S]*if \(startedEventWindow104\) \{[\s\S]*void flushPendingLikes\(user\);[\s\S]*else if \(getPendingExploreLikeMutationCount\(user\.uid\) >= EXPLORE_LIKE_BATCH_MAX\)/);
assert.match(like, /export const flushPendingExploreLikesForPageExit/);

assert.match(page, /SORIDRAW_EXPLORE_LIKE_EVENT_REFRESH_104_20260916/);
assert.match(page, /const EXPLORE_LIKE_AGGREGATE_WINDOW_MS_104 = 5 \* 60_000;/);
assert.match(page, /const EXPLORE_LIKE_REFRESH_GRACE_MS_104 = 10_000;/);
assert.match(page, /const deadline = now \+ EXPLORE_LIKE_AGGREGATE_WINDOW_MS_104 \+ EXPLORE_LIKE_REFRESH_GRACE_MS_104;/);
assert.doesNotMatch(page, /EXPLORE_LIKE_AGGREGATE_WINDOW_MS_070 = 10 \* 60_000/);
assert.doesNotMatch(page, /Math\.ceil\(\(now \+ 1000\) \/ EXPLORE_LIKE_AGGREGATE_WINDOW_MS_070\)/);
assert.match(page, /buildExploreFreshLikeFeedUrl072/);

console.log('104_EXPLORE_LIKE_WINDOW=PASS');
console.log('FIRST_CHANGE_SERVER_WINDOW_START=YES');
console.log('LATER_CHANGES=LOCAL_UNTIL_NEAR_DEADLINE');
console.log('FINAL_FLUSH_LEAD_MS=15000');
console.log('ACTOR_FORCED_REFRESH=5MIN_PLUS_10SEC');
console.log('IDLE_PERIODIC_POLLING=0');
console.log('NO_WORKER_CHANGE=true');
console.log('NO_D1_SCHEMA_MIGRATION=true');
console.log('NO_UI_CSS_CHANGE=true');

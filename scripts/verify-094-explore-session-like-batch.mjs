import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const display = readFileSync('src/services/exploreLikeDisplayStateService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const shell = readFileSync('src/components/explore/ExploreShell.tsx', 'utf8');

assert.match(service, /SORIDRAW_EXPLORE_SESSION_BATCH_094_20260915/);
assert.doesNotMatch(service, /5_000[^\n]*batch|BATCH_WINDOW|schedulePendingLikes|pendingTimers/);
assert.match(service, /getPendingExploreLikeMutationCount\(user\.uid\) >= EXPLORE_LIKE_BATCH_MAX/);
assert.match(service, /const acknowledgedDisplayLikeCount = clampLikeCount\(/);
assert.match(service, /pending\.baseLikeCount \+ Number\(result\.liked\) - Number\(pending\.baseLiked\)/);
assert.match(service, /displayLikeCount: acknowledgedDisplayLikeCount/);
assert.match(service, /retry timer: the durable outbox retries at the next meaningful boundary/);
assert.match(display, /confirmExploreLikeDisplayTransition094/);
assert.match(display, /rebaseExploreLikePendingDisplay094/);
assert.match(display, /aggregateCaughtUp/);
assert.match(page, /const flushExploreLikeBoundary094 = async/);
assert.equal((page.match(/await flushExploreLikeBoundary094\(\)/g) || []).length, 2, 'enter/leave public profile must both flush');
const tabs = page.slice(page.indexOf("['recommended', '추천']"), page.indexOf("['recommended', '추천']") + 1400);
assert.doesNotMatch(tabs, /flushExploreLikeBoundary094|flushPendingExploreLikesForPageExit/);
assert.match(shell, /visibilityState !== 'hidden'/);
assert.match(shell, /await flushSoridrawPageSync\(user, 'route-change'\)/);
assert.doesNotMatch(service, /from ['\"]firebase\/firestore['\"]/, 'Explore like service must not import Firestore writes');
assert.doesNotMatch(service, /\b(?:updateDoc|setDoc|addDoc|deleteDoc)\s*\(/, 'Explore like sync must not call Firestore write APIs');
console.log('PASS 094: session-boundary like batching, durable local browsing, max-50 safety flush, RTDB acknowledged count replay, and no Firestore sync write.');

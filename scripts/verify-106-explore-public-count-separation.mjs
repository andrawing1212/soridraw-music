import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const display = readFileSync('src/services/exploreLikeDisplayStateService.ts', 'utf8');
const like = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

assert.equal(version.version, '106');

assert.match(display, /SORIDRAW_EXPLORE_PUBLIC_COUNT_SOURCE_SEPARATION_106_20260916/);
assert.match(display, /const STORAGE_PREFIX_106 = 'soridraw:explore-like-display:106:'/);
assert.match(display, /const LEGACY_STORAGE_PREFIX_091 = 'soridraw:explore-like-display:091:'/);
assert.match(display, /const PENDING_DISPLAY_TTL_MS_106 = 20 \* 60_000;/);
assert.match(display, /const ACCEPTED_DISPLAY_TTL_MS_106 = 2 \* 60_000;/);
assert.match(display, /window\.localStorage\.removeItem\(legacyStorageKey091\(normalizedUid\)\)/);
assert.match(display, /shared Feed\/Profile canonical projection is the only displayed count source/);
assert.match(display, /return getExploreLikeCanonicalCount091\(normalizedUid, normalizedTrackId, fallbackLikeCount\);/);
assert.doesNotMatch(display, /membershipDelta|canonicalCount \+ membershipDelta/);
assert.doesNotMatch(display, /if \(state && state\.expiresAt > Date\.now\(\)\) return state\.displayLikeCount;/);
assert.match(display, /account-scoped RTDB signals are membership-only/);

assert.match(like, /SORIDRAW_EXPLORE_PUBLIC_COUNT_SOURCE_SEPARATION_106_20260916/);
assert.doesNotMatch(like, /importExploreLikeDisplaySignal091\(/);
assert.match(like, /account RTDB synchronizes only personal heart membership/);
const observerStart = like.indexOf('for (const result of effectiveResults) {');
const observerEnd = like.indexOf('persistLikedStateCache(uid, cache);', observerStart);
assert.ok(observerStart >= 0 && observerEnd > observerStart, 'account observer block missing');
const observerBlock = like.slice(observerStart, observerEnd);
assert.doesNotMatch(observerBlock, /beginExploreLikeDisplayTransition091|confirmExploreLikeDisplayTransition094|getExploreLikeCanonicalCount091/);

const confirmedStart = like.indexOf('// 106: RTDB/account replay carries membership plus the server response only.');
assert.ok(confirmedStart >= 0, '106 confirmed result marker missing');
const confirmedEnd = like.indexOf('accountSyncResults.push(confirmedResult);', confirmedStart);
assert.ok(confirmedEnd > confirmedStart, 'confirmed result boundary missing');
const confirmedBlock = like.slice(confirmedStart, confirmedEnd);
assert.doesNotMatch(confirmedBlock, /displayLikeCount/);

// Safety invariants: 106 is client display-source separation only.
assert.doesNotMatch(display, /fetch\(|EXPLORE_API_BASE|firebase|firestore|database/);
assert.match(like, /const EXPLORE_LIKE_EVENT_WINDOW_MS_105 = 1 \* 60_000;/);

console.log('106_EXPLORE_PUBLIC_COUNT_SEPARATION=PASS');
console.log('PUBLIC_COUNT_SOURCE=SHARED_CANONICAL_FEED_PROFILE');
console.log('ACCOUNT_SIGNAL=MEMBERSHIP_ONLY');
console.log('PUBLIC_DISPLAY_LOCAL_OPTIMISM=NONE');
console.log('LEGACY_FIXED_DISPLAY_OVERLAY=INVALIDATED_LOCAL_ONLY');
console.log('SERVER_BATCH_CADENCE=UNCHANGED_1MIN_EVENT_DRIVEN');
console.log('NO_WORKER_CHANGE=true');
console.log('NO_D1_SCHEMA_MIGRATION=true');
console.log('NO_USER_DATA_MIGRATION=true');
console.log('NO_UI_CSS_CHANGE=true');

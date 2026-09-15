import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const like = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

assert.ok(Number(version.version) >= 88, `expected app version 088+, got ${version.version}`);
assert.match(like, /SORIDRAW_EXPLORE_SAME_SESSION_PENDING_LIKE_088_20260914/);
assert.doesNotMatch(like, /const replayAccountSyncPatches =/);
assert.doesNotMatch(like, /replayAccountSyncPatches\(user\.uid, normalized\)/);
assert.match(like, /const optimisticLikedCache = getLikedStateCache\(user\.uid\);/);
assert.match(like, /optimisticLikedCache\.set\(normalizedTrackId, liked\);/);
assert.match(like, /persistLikedStateCache\(user\.uid, optimisticLikedCache\);/);
assert.match(like, /const accountReplayResults: ExploreLikeAccountSyncResult\[\] = \[\];/);
assert.match(like, /accountReplayResults\.push\(\{ \.\.\.visibleResult, ownerUid \}\);/);
assert.match(like, /rememberAccountSyncResults\(uid, accountReplayResults\);/);
assert.match(like, /return normalized\.filter\(\(trackId\) => outbox\[trackId\]\?\.desiredLiked \?\? cache\.get\(trackId\) === true\);/);

assert.match(page, /profileUid === user\?\.uid \? previous : \[\]/);
assert.match(page, /const normalizedLikedRows = normalizedRows;/);
assert.match(page, /previous\.forEach\(\(track\) => \{/);
assert.match(page, /!effectiveLikedSet\.has\(track\.id\) \|\| merged\.has\(track\.id\)/);
assert.match(page, /merged\.set\(track\.id, track\);/);

const setLikeStart = like.indexOf('export const setExploreTrackLike');
const setLikeEnd = like.indexOf('\n};', setLikeStart) + 3;
const setLikeBody = like.slice(setLikeStart, setLikeEnd);
assert.doesNotMatch(setLikeBody, /fetch\(|requestExploreLike\(|updateDoc\(/);

console.log('PASS 088: same-session pending like remains authoritative across Explore -> own profile -> liked tab; stale account replay cannot turn the heart off; no new server read/write path.');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const overlay = readFileSync('src/services/exploreLikeAccountOverlay.ts', 'utf8');
const revision = readFileSync('src/services/exploreRevisionRequestCache.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

assert.ok(Number(version.version) >= 117, `expected app version 117+, got ${String(version.version)}`);

assert.match(overlay, /SORIDRAW_EXPLORE_PUBLIC_COUNT_PERSONAL_CACHE_SEPARATION_117_20260918/);
assert.match(overlay, /sessionStorage/);
assert.match(overlay, /LIKE_REVISION_GRACE_STORAGE_PREFIX/);
assert.doesNotMatch(overlay, /soridrawPersistentCache/);
assert.doesNotMatch(overlay, /explore-like-account-patches/);
assert.doesNotMatch(overlay, /ACCOUNT_PATCH_SCHEMA_VERSION/);
assert.doesNotMatch(overlay, /\blikeCount\s*:/);
assert.doesNotMatch(overlay, /\.likeCount\b/);

assert.doesNotMatch(revision, /overlayExploreAccountLikeCounts/);
assert.doesNotMatch(revision, /overlayServerFeedResponse/);
assert.match(revision, /return originalFetch\(input, init\);/);
assert.match(revision, /items: nextRows/);

assert.match(page, /Only server-confirmed\/shared payloads may become public-count authority/);
assert.match(page, /syncSharedPublicCountsToLocal110/);

// App155 regression: the server-confirmed public count is the only value
// written into persistent Feed and public-profile caches. Optimistic and
// same-account RTDB counts remain UI/account-local, even across sign-out.
const sharedStart = page.indexOf('const syncSharedPublicCountsToLocal110 =');
const sharedEnd = page.indexOf('\n  useEffect(', sharedStart);
assert.ok(sharedStart >= 0 && sharedEnd > sharedStart);
const sharedWriter = page.slice(sharedStart, sharedEnd);
assert.match(sharedWriter, /sharedTracks\.forEach\(\(track\) =>/);
assert.doesNotMatch(sharedWriter, /effectiveSharedTracks\.forEach/);
assert.match(sharedWriter, /patchExploreFeedSessionCachesRow\(track\.id, \{ likeCount: track\.likeCount \}\)/);
assert.match(sharedWriter, /patchExplorePublicProfileFirstViewTrack\(track\.ownerUid, track\.id, \{ likeCount: track\.likeCount \}\)/);
assert.match(sharedWriter, /patchExploreLikedTrackCachedCount091\(\s*activeUid, track\.id, countByTrackId\.get\(track\.id\) \?\? track\.likeCount/);

const remoteStart = page.indexOf('const onRemote = (detail:');
const remoteEnd = page.indexOf('const onGap = (event:', remoteStart);
assert.ok(remoteStart >= 0 && remoteEnd > remoteStart);
const remoteWriter = page.slice(remoteStart, remoteEnd);
assert.doesNotMatch(remoteWriter, /patchExploreFeedSessionCachesRow/);
assert.doesNotMatch(remoteWriter, /patchExplorePublicProfileFirstViewTrack/);
assert.match(remoteWriter, /patchExploreLikedTrackCachedCount091/);

const toggleStart = page.indexOf('const toggleLike = async (track: ExploreTrack)');
const toggleEnd = page.indexOf('const toggleFollow = async', toggleStart);
assert.ok(toggleStart >= 0 && toggleEnd > toggleStart);
const toggleWriter = page.slice(toggleStart, toggleEnd);
assert.doesNotMatch(toggleWriter, /patchExploreFeedSessionCachesRow/);
assert.doesNotMatch(toggleWriter, /patchExplorePublicProfileFirstViewTrack/);
assert.match(toggleWriter, /patchExploreLikedTrackCachedCount091/);
assert.match(toggleWriter, /setTracks\(patchOptimisticCount120\)/);
assert.doesNotMatch(page, /getExploreLikeDisplayCount091/);
// App129+ sends the atomic normalized heart/count pair to the card.
assert.match(page, /track=\{displayTrack129\}/);
assert.match(page, /liked=\{pair129\.liked\}/);

console.log('PASS 117: public likeCount is shared-server authority only; account cache can affect heart membership/revision grace, never the public count.');

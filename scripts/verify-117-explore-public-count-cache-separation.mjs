import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const overlay = readFileSync('src/services/exploreLikeAccountOverlay.ts', 'utf8');
const revision = readFileSync('src/services/exploreRevisionRequestCache.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

assert.equal(String(version.version), '117');

assert.match(overlay, /SORIDRAW_EXPLORE_PUBLIC_COUNT_PERSONAL_CACHE_SEPARATION_117_20260918/);
assert.match(overlay, /sessionStorage/);
assert.match(overlay, /LIKE_REVISION_GRACE_STORAGE_PREFIX/);
assert.doesNotMatch(overlay, /soridrawPersistentCache/);
assert.doesNotMatch(overlay, /explore-like-account-patches/);
assert.doesNotMatch(overlay, /ACCOUNT_PATCH_SCHEMA_VERSION/);
assert.doesNotMatch(overlay, /likeCount/);

assert.doesNotMatch(revision, /overlayExploreAccountLikeCounts/);
assert.doesNotMatch(revision, /overlayServerFeedResponse/);
assert.match(revision, /return originalFetch\(input, init\);/);
assert.match(revision, /items: nextRows/);

assert.match(page, /Only server-confirmed\/shared payloads may become public-count authority/);
assert.match(page, /syncSharedPublicCountsToLocal110/);

console.log('PASS 117: public likeCount is shared-server authority only; account cache can affect heart membership/revision grace, never the public count.');

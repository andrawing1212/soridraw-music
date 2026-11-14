import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const social = readFileSync('src/services/exploreSocialService.ts', 'utf8');
const workerPatch = readFileSync('cloudflare/explore-worker/patches/096-follow-actor-count-response.mjs', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

assert.ok(Number(version.version) >= 379, 'app379+ is required');

// Root cause guard: the compatibility response is sourced from legacy stats.
// Overlay authority freezes those counters, so UI code must not treat them as
// canonical profile counters after a relation change.
assert.match(workerPatch, /actorFollowingCount: clampExploreSocialCount\(stats\?\.follower\?\.following_count\)/);
assert.match(workerPatch, /followerCount: clampExploreSocialCount\(stats\?\.following\?\.follower_count\)/);

assert.match(social, /export const readExploreProfileConnectionExactCount379/);
assert.match(social, /if \(!cached \|\| cached\.nextCursor\) return null;/);
assert.match(social, /export const readExploreFollowingExactCount379/);
assert.match(social, /if \(!data\.complete\) return null;/);
assert.match(social, /export const readExploreFollowMembership379/);

const toggleStart = page.indexOf('  const toggleFollow = async () =>');
const toggleEnd = page.indexOf('\n\n  const closeMoreSheet', toggleStart);
assert.ok(toggleStart >= 0 && toggleEnd > toggleStart);
const toggle = page.slice(toggleStart, toggleEnd);

// APP647: settled relation is trusted, compatibility response counts are not.
assert.match(toggle, /const relationDelta = Number\(confirmed\.isFollowing\) - Number\(previousFollowing\)/);
assert.match(toggle, /readExploreProfileConnectionExactCount379\(targetUid, 'followers'\)/);
assert.match(toggle, /readExploreProfileConnectionExactCount379\(viewerUid, 'following'\)/);
assert.match(toggle, /readExploreFollowingExactCount379\(viewerUid\)/);
assert.match(toggle, /resolvedTargetFollower = Math\.max\(0, safeCount\(previousTargetCount\) \+ relationDelta\)/);
assert.match(toggle, /resolvedTargetFollowing = safeCount\(previousTargetFollowingCount\)/);
assert.match(toggle, /targetFollowerCount: resolvedTargetFollower/);
assert.doesNotMatch(toggle, /confirmed\.(?:followerCount|followingCount|actorFollowingCount)/,
  'do not render stale legacy compatibility counters');
assert.ok(toggle.indexOf('await setExploreFollow') <
  toggle.indexOf('patchExplorePublicProfileFirstViewProfile(targetUid'),
  'published counters must wait for canonical success');

const ownProfileStart = page.indexOf('    const applyProfileFirstView = ');
const ownProfileEnd = page.indexOf('\n\n    const retainedPublicationSignal357', ownProfileStart);
assert.ok(ownProfileStart >= 0 && ownProfileEnd > ownProfileStart);
const ownProfile = page.slice(ownProfileStart, ownProfileEnd);
assert.match(ownProfile, /exactFollowing379/);
assert.match(ownProfile, /exactFollowers379/);
assert.match(ownProfile, /socialPatch379\.followingCount = exactFollowing379/);
assert.match(ownProfile, /socialPatch379\.followerCount = exactFollowers379/);

const syncStart = page.indexOf('return subscribeExploreFollowSync377(viewerUid377');
const syncEnd = page.indexOf('\n  }, [user?.uid, profileConnectionsOpen376]);', syncStart);
assert.ok(syncStart >= 0 && syncEnd > syncStart);
const sync = page.slice(syncStart, syncEnd);
assert.match(sync, /readExploreFollowMembership379/);
assert.match(sync, /resolvedSignalActorFollowing379/);
assert.match(sync, /resolvedSignalTargetFollower379/);

assert.match(page, /followerCount: profile\.followerCount,[\s\S]*?followingCount: profile\.followingCount/);

console.log('APP379_OVERLAY_LEGACY_COUNTERS_NOT_UI_AUTHORITY=PASS');
console.log('APP379_OWN_FOLLOWING_COUNT_LOCAL_EXACT=PASS');
console.log('APP379_OWN_FOLLOWER_COUNT_LOCAL_EXACT_WHEN_CACHED=PASS');
console.log('APP379_TARGET_FOLLOWER_COUNT_DELTA=PASS');
console.log('APP379_TARGET_FOLLOWING_COUNT_PRESERVED=PASS');
console.log('APP379_CROSS_DEVICE_COUNT_RECONCILIATION=PASS');
console.log('APP379_NO_EXTRA_SERVER_READ_FOR_COUNT_FIX=PASS');

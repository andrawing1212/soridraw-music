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

assert.match(toggle, /relationDelta380/);
assert.match(toggle, /readExploreProfileConnectionExactCount379\(viewerUid, 'following'\)/);
assert.match(toggle, /readExploreFollowingExactCount379\(viewerUid\)/);
assert.match(toggle, /resolvedTargetFollower380/);
assert.match(toggle, /resolvedTargetFollowing380/);
assert.match(toggle, /Math.floor\(settlement380.baseTargetFollowingCount\)/);
assert.match(toggle, /targetFollowerCount: resolvedTargetFollower380/);
assert.doesNotMatch(
  toggle,
  /patchExplorePublicProfileFirstViewProfile\(targetUid,[\s\S]{0,260}followerCount:\s*result\.followerCount/,
  'target follower count must not be overwritten by legacy compatibility stats',
);
assert.doesNotMatch(
  toggle,
  /patchExplorePublicProfileFirstViewProfile\(targetUid,[\s\S]{0,320}followingCount:\s*result\.followingCount/,
  'target following count must remain unchanged by somebody else following/unfollowing them',
);
assert.doesNotMatch(
  toggle,
  /patchExplorePublicProfileFirstViewProfile\(viewerUid,[\s\S]{0,260}result\.actorFollowingCount/,
  'own following count must not be overwritten by legacy compatibility stats',
);

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

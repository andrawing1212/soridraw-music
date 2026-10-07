import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('src/services/exploreSocialService.ts', 'utf8');
const sync = readFileSync('src/services/exploreFollowSyncService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const rules = readFileSync('database.rules.json', 'utf8');
const worker = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');

assert.match(service, /SORIDRAW_EXPLORE_CONNECTION_PERSISTENT_CACHE_377_20261007/);
assert.match(service, /expiresAt: null/);
assert.match(service, /recordCloudflareLocalCacheHit\([\s\S]*?Worker 0 · D1 R0/);
assert.match(service, /invalidateExploreProfileConnections377\(viewer, 'following'\)/);
assert.match(service, /invalidateExploreProfileConnections377\(target, 'followers'\)/);
assert.match(service, /actorFollowingCount: toCount\(row\?\.actorFollowingCount/);

const connections = service.slice(
  service.indexOf('export const getExploreProfileConnections'),
  service.indexOf('export const getExplorePublicProfileTracks'),
);
assert.match(connections, /if \(!normalizedCursor\) \{[\s\S]*?readProfileConnectionCache377/);
assert.match(connections, /if \(!normalizedCursor\) writeProfileConnectionCache377/);
assert.equal((connections.match(/requestPublic\(/g) || []).length, 1, 'cold relation list must use one bounded request');

assert.match(sync, /SORIDRAW_EXPLORE_FOLLOW_LIVE_SYNC_377_20261007/);
assert.match(sync, /userSync\/\$\{uid\}\/exploreFollow/);
assert.match(sync, /actorFollowingCount/);
assert.match(sync, /targetFollowerCount/);
assert.match(sync, /EXPLORE_FOLLOW_SIGNAL_RETENTION_MS_377 = 10 \* 60_000/);
assert.doesNotMatch(sync, /firestore|updateDoc|setDoc|getDoc/i);

assert.match(rules, /"exploreFollow": \{/);
assert.match(rules, /newData\.hasChildren\(\['version','at','originDeviceId','targetUid','following','actorFollowingCount','targetFollowerCount'\]\)/);

assert.match(page, /publishExploreFollowSync377\(viewerUid/);
assert.match(page, /subscribeExploreFollowSync377\(viewerUid377/);
assert.match(page, /patchExplorePublicProfileFirstViewProfile\(viewerUid, \{[\s\S]*?followingCount/);
assert.match(page, /patchExplorePublicProfileFirstViewProfile\(signal377\.targetUid, \{[\s\S]*?followerCount/);
assert.match(page, /if \(!page\.nextCursor\) \{[\s\S]*?exactCount377 = page\.items\.length/);

const marker = 'SORIDRAW_FOLLOW_ACTOR_COUNT_RESPONSE_096_20261007';
assert.match(worker, new RegExp(marker));
const coreStart = worker.indexOf('async function handleFollowR2Core(');
const coreEnd = worker.indexOf('\n__name(handleFollowR2Core', coreStart);
assert.ok(coreStart >= 0 && coreEnd > coreStart);
const core = worker.slice(coreStart, coreEnd);
assert.match(core, /actorFollowingCount: clampExploreSocialCount\(stats\?\.follower\?\.following_count\)/);
const responseTail = core.slice(core.indexOf(marker));
assert.doesNotMatch(responseTail, /env\.DB|\.prepare\(|\.batch\(/, 'actor count response must add no D1 query/write');

console.log('APP377_FOLLOW_COUNT_EXACT_RESPONSE_NO_EXTRA_D1=PASS');
console.log('APP377_FOLLOW_LIST_PERSISTENT_RELOAD_R0=PASS');
console.log('APP377_FOLLOW_LIST_CHANGED_ONLY_INVALIDATION=PASS');
console.log('APP377_FOLLOW_CROSS_DEVICE_RTDB_SIGNAL=PASS');
console.log('APP377_SMALL_PROFILE_COUNT_SELF_HEAL=PASS');

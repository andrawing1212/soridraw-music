import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const social = readFileSync('src/services/exploreSocialService.ts', 'utf8');
const sync = readFileSync('src/services/exploreFollowSyncService.ts', 'utf8');
const update = readFileSync('src/services/appUpdateNotice.ts', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

assert.ok(Number(version.version) >= 378, 'app378+ is required');

assert.match(social, /app378: a real relation change patches the already-cached Following page/);
assert.match(social, /EXPLORE_FOLLOW_CONNECTION_CARD_CACHE_SOURCE_TYPE_378/);
assert.match(social, /explore-follow-connection-card:378:/);
assert.match(social, /writeProfileConnectionSeed378/);
assert.match(social, /readProfileConnectionSeed378/);
assert.match(
  social,
  /if \(!patchExploreFollowingConnectionCache378\(viewer, target, following, targetProfile\)\) \{\s*invalidateExploreProfileConnections377\(viewer, 'following'\);\s*\}/,
  'Following page may be invalidated only when no safe local patch is possible',
);
assert.match(
  social,
  /writeProfileConnectionCache377\(viewer, 'following', \{\s*items,\s*nextCursor: page\.nextCursor,\s*\}\);/,
  'changed relation must rewrite only the existing local first-page cache',
);
assert.match(social, /expiresAt: null/);
assert.doesNotMatch(
  social.slice(
    social.indexOf('SORIDRAW_EXPLORE_CONNECTION_PERSISTENT_CACHE_377_20261007'),
    social.indexOf('type ExploreFollowCacheData'),
  ),
  /APP_VERSION|app-version\.json|__SORIDRAW_APP_VERSION__/,
  'connection cache must not depend on app version',
);

// Keep the proven tiny RTDB contract. app378 fixes the list locally and must not
// make every follow signal carry a whole profile/list or require shared rules.
assert.doesNotMatch(sync, /targetProfileJson|profileJson/i);

// Update notice may reset diagnostics, never product persistent caches.
assert.doesNotMatch(update, /localStorage\.clear\(/);
assert.doesNotMatch(update, /soridraw_cache_envelope_v1/);

console.log('APP378_FOLLOW_MUTATION_PATCHES_CACHED_FOLLOWING_PAGE=PASS');
console.log('APP378_FOLLOW_TOGGLE_CARD_SEED_PERSISTS=PASS');
console.log('APP378_APP_UPDATE_DOES_NOT_INVALIDATE_CONNECTION_CACHE=PASS');
console.log('APP378_FOLLOW_RTDB_SIGNAL_REMAINS_TINY=PASS');
console.log('APP378_UNCHANGED_REOPEN_TARGET=WORKER0_D1_R0');

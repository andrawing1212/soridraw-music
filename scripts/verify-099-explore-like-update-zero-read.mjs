import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const liked = readFileSync('src/services/exploreLikedTracksService.ts', 'utf8');
const persistent = readFileSync('src/lib/soridrawPersistentCache.ts', 'utf8');

assert.ok(service.includes('SORIDRAW_EXPLORE_UPDATE_ZERO_READ_099_20260916'));
assert.ok(!service.includes('invalidateExploreLikedTrackCollection'));
assert.ok(!service.includes('clearExplorePersonalSocialSnapshot'));

const observerStart = service.indexOf('export const observeExploreLikeAccountSyncSignal');
assert.ok(observerStart >= 0);
const observerSeen = service.indexOf('setSeenAccountSignalVersion(uid, signal.version);', observerStart);
assert.ok(observerSeen > observerStart);
const observerEnd = service.indexOf('\n};', observerSeen);
assert.ok(observerEnd > observerSeen);
const observer = service.slice(observerStart, observerEnd + 3);
assert.ok(observer.includes('const cache = getLikedStateCache(uid);'));
assert.ok(!observer.includes('cache.clear()'));
assert.ok(!observer.includes('missedSignal'));
assert.ok(!observer.includes('invalidateExploreLikedTrackCollection'));
assert.ok(!observer.includes('clearExplorePersonalSocialSnapshot'));
assert.ok(!observer.includes('EXPLORE_LIKE_ACCOUNT_INVALIDATION_EVENT'));
assert.ok(observer.includes('rememberAccountSyncResults(uid, effectiveResults)'));
assert.ok(observer.includes('patchExploreLikedTrackMembership(uid, result.trackId, result.liked)'));
assert.ok(!observer.includes('fetch('));
assert.ok(!observer.includes('requestLikedTracks'));

const getterStart = liked.indexOf('export const getExploreLikedTracks');
assert.ok(getterStart >= 0);
const getter = liked.slice(getterStart);
assert.ok(getter.includes('if (cache.canonicalLikedTrackIds === null)'));
assert.ok(getter.includes('requestLikedTracks(user, [])'));
assert.ok(liked.includes('patchExploreLikedTrackMembership'));

assert.ok(persistent.includes("const CACHE_STORAGE_PREFIX = 'soridraw_cache_envelope_v1'"));
assert.ok(!persistent.includes('app-version.json'));
assert.ok(!persistent.includes('APP_VERSION'));

console.log('PASS 099: app update/wake version gaps preserve liked membership/card caches; no full liked-track verification or D1/Firestore read is introduced by reconnect.');

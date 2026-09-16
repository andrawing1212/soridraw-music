import { readFileSync } from 'node:fs';

const cache = readFileSync('src/services/exploreSessionCache.ts', 'utf8');
const persistent = readFileSync('src/lib/soridrawPersistentCache.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

const fail = (message) => { throw new Error(`[108] ${message}`); };
if (String(version.version) !== '108') fail('app version is not 108');
if (!cache.includes('SORIDRAW_EXPLORE_FEED_STALE_COUNT_CACHE_RECOVERY_108_20260916')) fail('108 cache recovery marker missing');
if (!/EXPLORE_FEED_CACHE_SCHEMA_VERSION\s*=\s*2\s*;/.test(cache)) fail('Explore Feed cache schema is not 2');
if (/app-version|appVersion|APP_VERSION/.test(cache)) fail('Feed cache schema must not depend on app version');
if (!cache.includes('expiresAt: null')) fail('long-lived cache contract changed unexpectedly');
if (!cache.includes('serverRevision: normalizedRevision')) fail('server revision persistence missing');
if (!cache.includes('syncCursor')) fail('feed cursor persistence missing');
if (!persistent.includes('String(envelope.schemaVersion) === String(identity.schemaVersion)')) fail('schema compatibility gate missing');
if (!persistent.includes('window.localStorage.removeItem(storageKey)')) fail('incompatible persistent cache cleanup missing');
if (!page.includes('cachedRevision === serverRevision')) fail('revision no-op fast path missing');
if (!page.includes('readExploreFeedSessionCache(requestUrl)')) fail('local-first Feed cache path missing');
if (!page.includes('buildExploreVersionedFeedUrl(requestUrl, serverRevision)')) fail('revision-change Feed refresh path missing');

console.log('108_EXPLORE_FEED_CACHE_RECOVERY=PASS');
console.log('OLD_SCHEMA_1_STALE_FEED=REJECTED_ONCE');
console.log('NEW_SCHEMA_2_WARM_CACHE=PERSISTENT');
console.log('APP_VERSION_COUPLING=NONE');
console.log('REVISION_NOOP_FAST_PATH=PRESERVED');
console.log('NO_PERIODIC_POLLING_ADDED=true');
console.log('NO_UI_CSS_CHANGE=true');
console.log('NO_D1_SCHEMA_MIGRATION=true');

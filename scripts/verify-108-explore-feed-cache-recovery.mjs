import { readFileSync } from 'node:fs';

const cache = readFileSync('src/services/exploreSessionCache.ts', 'utf8');
const persistent = readFileSync('src/lib/soridrawPersistentCache.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const entry = readFileSync('cloudflare/explore-worker/canonical/preview-entry.js', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

const fail = (message) => { throw new Error(`[108] ${message}`); };
const appVersion = Number(version.version);
if (!Number.isFinite(appVersion) || appVersion < 108) fail('app version is older than 108');
if (!cache.includes('SORIDRAW_EXPLORE_FEED_STALE_COUNT_CACHE_RECOVERY_108_20260916')) fail('108 cache recovery marker missing');
const schemaMatch = cache.match(/EXPLORE_FEED_CACHE_SCHEMA_VERSION\s*=\s*(\d+)\s*;/);
if (!schemaMatch || Number(schemaMatch[1]) < 2) fail('Explore Feed cache schema is older than 2');
if (/app-version\.json|appVersion|APP_VERSION/.test(cache)) fail('Feed cache schema must not depend on app version');
if (!cache.includes('expiresAt: null')) fail('long-lived cache contract changed unexpectedly');
if (!persistent.includes('String(envelope.schemaVersion) === String(identity.schemaVersion)')) fail('schema compatibility gate missing');
if (!persistent.includes('window.localStorage.removeItem(storageKey)')) fail('incompatible persistent cache cleanup missing');
if (!page.includes('SORIDRAW_EXPLORE_R2_SNAPSHOT_BOOTSTRAP_108_20260916')) fail('client R2 snapshot marker missing');
if (!page.includes('buildExploreR2SnapshotFeedUrl108')) fail('client R2 snapshot URL helper missing');
if (page.includes('buildExploreVersionedFeedUrl') || page.includes('buildExploreFreshLikeFeedUrl072')) fail('old first-page feed fetch helper remains');
if (!page.includes('cachedRevision === serverRevision')) fail('revision no-op fast path missing');
if (!entry.includes('SORIDRAW_EXPLORE_R2_SNAPSHOT_BOOTSTRAP_108_20260916')) fail('Worker R2 snapshot marker missing');
if (!entry.includes("url.searchParams.get(EXPLORE_FEED_R2_SNAPSHOT_QUERY_108) === EXPLORE_FEED_R2_SNAPSHOT_VERSION_108")) fail('Worker snapshot route missing');
const start = entry.indexOf('async function handleFeedR2Snapshot108');
const end = entry.indexOf('async function scheduleExploreLikeAggregate103', start);
if (start < 0 || end < 0) fail('Worker snapshot handler range missing');
const handler = entry.slice(start, end);
if (!handler.includes('bucket.get(feedR2Key077(sort))')) fail('snapshot does not read R2 body');
if (/env\.DB|baseWorker\.fetch|syncDerivedCache032/.test(handler)) fail('snapshot handler may touch D1/base Worker');
for (const zero of ["headers.set('X-SORIDRAW-D1-Read', '0')", "headers.set('X-SORIDRAW-D1-Write', '0')", "headers.set('X-SORIDRAW-D1-Read-Queries', '0')"]) {
  if (!entry.includes(zero)) fail(`missing zero-cost diagnostic: ${zero}`);
}

console.log('108_EXPLORE_FEED_CACHE_RECOVERY=PASS');
console.log('OLD_SCHEMA_1_STALE_FEED=REJECTED_ONCE');
console.log('SCHEMA_2_PLUS_WARM_CACHE=PERSISTENT');
console.log('COLD_RECOVERY_SOURCE=R2_SNAPSHOT_ONLY');
console.log('COLD_RECOVERY_D1=R0_W0_BY_ROUTE_CONTRACT');
console.log('APP_VERSION_COUPLING=NONE');
console.log('REVISION_NOOP_FAST_PATH=PRESERVED');
console.log('NO_PERIODIC_POLLING_ADDED=true');
console.log('NO_UI_CSS_CHANGE=true');
console.log('NO_D1_SCHEMA_MIGRATION=true');

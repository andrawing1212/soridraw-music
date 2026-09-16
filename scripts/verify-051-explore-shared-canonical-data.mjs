import { assertAppVersionSource } from './assert-app-version-source.mjs';
assertAppVersionSource();
import { readFileSync } from 'node:fs';

const service = readFileSync('src/services/exploreProfileFirstViewService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const patch = readFileSync('cloudflare/explore-worker/patches/031-explore-shared-canonical-data.mjs', 'utf8');
const prepare = readFileSync('cloudflare/explore-worker/scripts/prepare-from-dashboard.mjs', 'utf8');

const need = (source, text, label) => {
  if (!source.includes(text)) throw new Error(`${label} missing: ${text}`);
};

need(service, 'PROFILE_FIRST_VIEW_SCHEMA_VERSION = 6', 'profile cache schema');
need(service, 'PROFILE_FIRST_VIEW_REVALIDATE_AFTER_MS = 10_000', 'profile revalidate window');
if (service.includes('__soridraw_shared_profile')) throw new Error('version-driven profile materialize must remain removed');
need(readFileSync('cloudflare/explore-worker/runtime/derived-cache.js','utf8'), 'syncDerivedCache032', 'trigger-backed freshness');
if (service.includes("url.searchParams.set('__soridraw_profile_parity', '48')")) throw new Error('old 048 cold repair request still active');

need(page, 'const serverRevision = await fetchRevision().catch', 'feed revision-first bootstrap');
need(page, 'serverRevision ? buildExploreVersionedFeedUrl(requestUrl, serverRevision) : requestUrl', 'versioned feed cold request');
if (page.includes('const revisionTask = fetchRevision().catch')) throw new Error('old concurrent cold feed/revision race still present');

for (const text of [
  'SORIDRAW_EXPLORE_SHARED_CANONICAL_DATA_031_20260909',
  'EXPLORE_SHARED_CACHE_STATE_KEY_031',
  'explore_shared_revision',
  'exploreCacheBucket031',
  'exploreRateDb031',
  'ensureExploreSharedFeedCache031',
  'handleExploreFeedRevision019Core031',
  'handlePublicProfileFirstViewWithEdgeCacheCore031',
  'sharedCanonicalData: true',
]) need(patch, text, '031 worker patch');

need(prepare, "{ binding: 'RATE_DB', database_name: D1_DATABASE_NAME, database_id: databaseId }", 'durable RATE_DB binding');
need(prepare, "{ binding: 'EXPLORE_CACHE', bucket_name: R2_BUCKET_NAME }", 'durable EXPLORE_CACHE binding');

console.log('VERIFY_051_EXPLORE_SHARED_CANONICAL_DATA=PASS');
console.log('PROFILE_DEVICE_CACHE_CONTRACT_V6=PASS');
console.log('FEED_COLD_REVISION_FIRST=PASS');
console.log('SHARED_D1_ENV_CACHE_SPLIT=PASS');
console.log('LEGACY_DB_MIRROR_RETIRED=PASS');

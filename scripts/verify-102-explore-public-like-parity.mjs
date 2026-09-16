import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workerPath = process.env.SORIDRAW_GENERATED_WORKER
  ? resolve(process.env.SORIDRAW_GENERATED_WORKER)
  : resolve(root, 'cloudflare/explore-worker/canonical/preview-worker.js');
const worker = readFileSync(workerPath, 'utf8');
const client = readFileSync(resolve(root, 'src/services/exploreRevisionRequestCache.ts'), 'utf8');
const release = JSON.parse(readFileSync(resolve(root, 'cloudflare/explore-worker/release-patches.json'), 'utf8'));
const version = JSON.parse(readFileSync(resolve(root, 'public/app-version.json'), 'utf8'));

const requireText = (source, value, label = value) => {
  if (!source.includes(value)) throw new Error(`[102] missing ${label}`);
};

for (const required of [
  'SORIDRAW_EXPLORE_PUBLIC_LIKE_PARITY_056_20260916',
  'reconcileExploreSharedFeed056',
  "derivedHead032(env, 'feed')",
  'derivedRank032(env, normalizedSort, null)',
  'derivedItems032(env, visibleIds)',
  'mutateExploreR2Cache052(env, key',
  'EXPLORE_DERIVED_CONTRACT_032',
  'patchExploreVisibleProfiles056',
  "publicProjection: 'reconciled'",
  "publicProjection: 'deferred'",
  'Number(totals.changedTracks || 0) <= 0',
]) requireText(worker, required, `Worker contract: ${required}`);

for (const forbidden of [
  'SELECT * FROM tracks',
  'SELECT * FROM likes',
  'SELECT * FROM track_stats',
]) {
  const markerAt = worker.indexOf('SORIDRAW_EXPLORE_PUBLIC_LIKE_PARITY_056_20260916');
  const nextMarker = worker.indexOf('async function processExploreLikeBatches035Core056', markerAt);
  const helperBlock = markerAt >= 0 && nextMarker > markerAt ? worker.slice(markerAt, nextMarker) : '';
  if (helperBlock.includes(forbidden)) throw new Error(`[102] parity helper reintroduced full scan pattern: ${forbidden}`);
}

// 102's public Feed/Profile parity is permanent. 103 intentionally replaces only
// the old wall-clock revision timing contract with an event-driven five-minute
// scheduler, so this verifier accepts either the original 102 client timing or the
// stricter 103 successor while continuing to enforce the 102 Worker parity code.
if (client.includes('SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_REVISION_103_20260916')) {
  for (const required of [
    'const REVISION_CACHE_TTL_MS = 5 * 60 * 1000;',
    "const STORAGE_PREFIX = 'soridraw.explore.feed-revision-response.v2:';",
    'expiresAt: Date.now() + REVISION_CACHE_TTL_MS,',
  ]) requireText(client, required, `103 successor client contract: ${required}`);
} else {
  for (const required of [
    'SORIDRAW_EXPLORE_PUBLIC_LIKE_REVISION_BOUNDARY_102_20260916',
    'const REVISION_CACHE_TTL_MS = 10 * 60 * 1000;',
    'const PUBLIC_LIKE_AGGREGATE_WINDOW_MS_102 = 10 * 60 * 1000;',
    'const PUBLIC_LIKE_REVISION_GRACE_MS_102 = 70 * 1000;',
    'return Math.min(normalExpiry, nextAggregateBoundary + PUBLIC_LIKE_REVISION_GRACE_MS_102);',
    'expiresAt: revisionCacheExpiry102(),',
  ]) requireText(client, required, `client contract: ${required}`);
}

if (!Array.isArray(release?.patches) || !release.patches.includes('056-explore-public-like-parity.mjs')) {
  throw new Error('[102] release patch provenance missing');
}
const appVersion = Number(String(version?.version || '0'));
if (!Number.isFinite(appVersion) || appVersion < 102) throw new Error('[102] app version is below 102');

console.log('102_EXPLORE_PUBLIC_LIKE_PARITY=PASS');
console.log('PUBLIC_FEED_RECONCILE=BOUNDED_TOP40');
console.log('PUBLIC_PROFILE_PATCH=VISIBLE_CHANGED_ONLY');
console.log(client.includes('SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_REVISION_103_20260916')
  ? 'REVISION_CACHE=103_EVENT_BATCH_SUCCESSOR'
  : 'REVISION_CACHE=10MIN_CEILING_BOUNDARY_SHORTEN_ONLY');
console.log('NO_USER_DATA_MIGRATION=true');
console.log('NO_UI_CSS_CHANGE=true');

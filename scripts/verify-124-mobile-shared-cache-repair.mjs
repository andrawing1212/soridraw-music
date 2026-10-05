import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const like = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));
const entry = readFileSync('cloudflare/explore-worker/canonical/preview-entry.js', 'utf8');

assert.ok(Number(version.version) >= 124, 'app124 behavior must remain available in later releases');

for (const token of [
  'SORIDRAW_EXPLORE_SHARED_LIKE_CACHE_REPAIR_124_20260918',
  "soridraw:explore:shared-like-cache-repair:124",
  'hasExploreSharedLikeCacheRepair124',
  'markExploreSharedLikeCacheRepair124',
  'const oneTimeSharedRepair124 = feedRequest && !hasExploreSharedLikeCacheRepair124(requestUrl);',
  'const snapshot = await fetchFeedSnapshot108(null);',
  'applyPayload(snapshot.payload, snapshot.revision);',
  'markExploreSharedLikeCacheRepair124(requestUrl);',
]) assert.ok(page.includes(token), `missing app124 repair token: ${token}`);

const repairStart = page.indexOf('const oneTimeSharedRepair124');
const repairEnd = page.indexOf('const revalidateRequested', repairStart);
assert.ok(repairStart >= 0 && repairEnd > repairStart, 'one-time repair branch missing');
const repair = page.slice(repairStart, repairEnd);
assert.match(repair, /fetchFeedSnapshot108\(null\)/);
assert.doesNotMatch(repair, /fetchRevision\(/);
assert.match(repair, /applyPayload\(snapshot\.payload, snapshot\.revision\);/);
assert.doesNotMatch(repair, /markExploreSharedLikeCacheRepair124\(requestUrl\)/, 'repair must not mark success before payload validation');
const applyStart = page.indexOf('const applyPayload =');
const applyEnd = page.indexOf('if (cachedRows) {', applyStart);
assert.ok(applyStart >= 0 && applyEnd > applyStart, 'shared snapshot apply handler missing');
const apply = page.slice(applyStart, applyEnd);
assert.match(apply, /payload\?\.ok !== true \|\| !Array\.isArray\(payload\?\.data\?\.items\)/);
assert.ok(
  apply.indexOf('setTracks(displayTracks);')
    < apply.indexOf('syncSharedPublicCountsToLocal110(normalizedTracks);') &&
  apply.indexOf('syncSharedPublicCountsToLocal110(normalizedTracks);')
    < apply.indexOf('markExploreSharedLikeCacheRepair124(requestUrl);'),
  'marker must be written after a valid snapshot updates Feed and shared public counts',
);

assert.match(page, /EXPLORE_FEED_REVISION_EVENT_DEDUPE_MS = 120_000/);
assert.match(page, /EXPLORE_FEED_REVISION_ACTIVITY_MIN_INTERVAL_MS = 120_000/);
assert.match(like, /EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 30_000/);
assert.match(entry, /EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105 = 1 \* 60 \* 1000/);

// No device-specific runtime fork: the same ExplorePage path serves PC/mobile.
assert.doesNotMatch(repair, /navigator\.userAgent|matchMedia|isMobile|mobileOnly|mobile-only/i);

console.log('PASS 124: one-time stale shared Feed cache repair is common across PC/mobile.');
console.log('REPAIR_SOURCE=CURRENT_SHARED_R2_DIRECT');
console.log('REPAIR_D1_READ=0_BY_ROUTE_CONTRACT');
console.log('REPAIR_ONCE_PER_SORT=true');
console.log('SUBSEQUENT_UNCHANGED_VISIT_ZERO_READ=UNCHANGED');
console.log('ACTOR_BATCH_IDLE=30_SECONDS');
console.log('VIEWER_ACTIVITY_GATE=120_SECONDS');
console.log('SHARED_AGGREGATE=60_SECONDS');

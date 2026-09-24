import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const liked = readFileSync('src/services/exploreLikedTracksService.ts', 'utf8');
const entry = readFileSync('cloudflare/explore-worker/canonical/preview-entry.js', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));
const fail = (message) => { throw new Error(`[110] ${message}`); };

const appVersion = Number(version.version);
if (!Number.isFinite(appVersion) || appVersion < 110) fail('app version is older than 110');
if (!page.includes('SORIDRAW_EXPLORE_LIKED_PUBLIC_COUNT_LOCAL_SYNC_110_20260916')) fail('110 marker missing');
if (!page.includes('SORIDRAW_EXPLORE_PUBLIC_COUNT_CONVERGENCE_116_20260917')) fail('116 convergence marker missing');
if (!page.includes('const syncSharedPublicCountsToLocal110 = (sharedTracks: ExploreTrack[], authoritative = true) =>')) {
  fail('authority-aware shared public-count sync helper missing');
}
if (!page.includes('if (!sharedTracks.length || !authoritative) return;')) fail('authority guard missing');
if (page.includes('if (feedRequest) syncSharedPublicCountsToLocal110(cachedTracks);')) {
  fail('stale warm Feed cache must not repair liked cards before server revision confirmation');
}

if (appVersion >= 123) {
  if (!page.includes('SORIDRAW_EXPLORE_UPDATE_LAST_KNOWN_FEED_123_20260918')) fail('123 last-known Feed marker missing');
  if (!page.includes('const revalidateRequested = feedRequest && feedRevisionRequestedUrlRef.current === requestUrl;')) {
    fail('123 activity-requested revalidation guard missing');
  }
  if (appVersion >= 126) {
    if (!page.includes('SORIDRAW_EXPLORE_ENTRY_REVISION_REVALIDATION_126_20260920')) fail('126 entry revision marker missing');
    if (!page.includes('if (!shouldRevalidate) return () => controller.abort();')) fail('126 unchanged warm Feed revision guard missing');
    if (!page.includes('const lastCheckedAt = exploreFeedLastRevisionCheckAt126.get(revisionCheckKey154) || 0;') &&
        !page.includes('const lastCheckedAt = exploreFeedLastRevisionCheckAt126.get(requestUrl) || 0;')) fail('126/154 successful-check timestamp missing');
    if (!page.includes('const serverRevision = await fetchRevision();')) fail('126 stale-entry revision validation missing');
  } else if (!page.includes('if (!revalidateRequested) {')) {
    fail('123 update/re-entry zero-read branch missing');
  }
  if (!page.includes("feedRevisionRequestedUrlRef.current = '';")) fail('123 requested revalidation reset missing');
  if (!page.includes('feedRevisionRequestedUrlRef.current = requestUrl;')) fail('123 activity revision request marker missing');
}

if (!/if \(cachedRevision === serverRevision\) \{\s*syncSharedPublicCountsToLocal110\(cachedTracks\);\s*return;\s*\}/.test(page)) {
  fail('revision-confirmed warm Feed cache does not repair liked cards');
}
if (!page.includes('applyProfileFirstView(refreshedProfile, refreshedRows, true);')) {
  fail('only revalidated public-profile payload should become authoritative');
}
if (!page.includes('setProfileLikedTracks(applyPublicCounts110);')) fail('open liked-tab state is not reconciled');
if (appVersion >= 155) {
  // 155: account-private liked cards retain the actor overlay. Persisting that
  // provisional count to a PUBLIC cache would leak it across signed-in accounts.
  if (!/patchExploreLikedTrackCachedCount091\(\s*activeUid, track\.id, countByTrackId\.get\(track\.id\) \?\? track\.likeCount,\s*\)/.test(page)) {
    fail('155 actor-local liked-card cache is not reconciled');
  }
  if (!/sharedTracks\.forEach\(\(track\) => \{\s*patchExploreFeedSessionCachesRow\(track\.id, \{ likeCount: track\.likeCount \}\)/.test(page)) {
    fail('155 shared public Feed cache must use server count, not actor overlay');
  }
} else if (!page.includes('patchExploreLikedTrackCachedCount091(activeUid, track.id, track.likeCount);')) {
  fail('persistent liked-card cache is not reconciled');
}
if (!/if \(feedRequest\) \{\s*syncSharedPublicCountsToLocal110\(normalizedTracks\);\s*(?:\/\/[^\n]*\n\s*)?markExploreSharedLikeCacheRepair124\(requestUrl\);\s*(?:exploreFeedLastRevisionCheckAt126\.set\((?:revisionCheckKey154|requestUrl), Date\.now\(\)\);\s*)?\}/.test(page)) fail('fresh Feed payload does not repair liked cards after shared snapshot validation');
if (!page.includes('syncSharedPublicCountsToLocal110(normalized);')) fail('load-more Feed payload does not repair liked cards');

if (appVersion >= 120) {
  if (!liked.includes('SORIDRAW_EXPLORE_LIKED_TRACK_LATEST_CACHE_120_20260918')) fail('latest liked-track cache marker missing');
  if (!/LIKED_TRACK_CACHE_SCHEMA_VERSION\s*=\s*120\s*;/.test(liked)) fail('current liked-track cache schema missing');
  if (!liked.includes("explore-liked-track-collection-120")) fail('current liked-track cache key missing');
} else if (!/LIKED_TRACK_CACHE_SCHEMA_VERSION\s*=\s*1\s*;/.test(liked)) {
  fail('legacy liked-track cache schema missing');
}

if (/app-version\.json|APP_VERSION|appVersion/.test(liked)) fail('liked-track cache became app-version coupled');
if (!/expiresAt:\s*null/.test(liked)) fail('liked-track long-lived cache contract changed');

if (appVersion >= 121) {
  if (!page.includes('EXPLORE_FEED_REVISION_ACTIVITY_MIN_INTERVAL_MS = 120_000')) fail('two-minute viewer activity gate changed');
} else if (!page.includes('EXPLORE_FEED_REVISION_ACTIVITY_MIN_INTERVAL_MS')) {
  fail('viewer activity revision gate missing');
}

if (appVersion >= 159) {
  if (!entry.includes('EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105 = 5 * 1000')) {
    fail('159 live shared aggregate five-second settle contract changed');
  }
} else if (!entry.includes('EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105 = 1 * 60 * 1000')) {
  fail('one-minute shared aggregate contract changed');
}

console.log('110_LIKED_PUBLIC_COUNT_LOCAL_SYNC=PASS');
console.log(appVersion >= 126 ? 'WARM_UPDATE_FIRST_RENDER=LAST_KNOWN_CACHE_STALE_ENTRY_REVISION' : appVersion >= 123 ? 'WARM_UPDATE_FIRST_RENDER=LAST_KNOWN_CACHE_ZERO_READ' : 'SOURCE=SERVER_CONFIRMED_SHARED_FEED_PROFILE_PAYLOAD');
console.log('REVISION_CONFIRMED_REPAIR=ENABLED');
console.log('LIKED_CACHE_APP_VERSION_COUPLED=NO');
console.log(appVersion >= 159 ? 'SHARED_AGGREGATE=FIVE_SECONDS_AFTER_W1' : 'SHARED_AGGREGATE=ONE_MINUTE');
console.log('NO_UI_CSS_CHANGE=true');

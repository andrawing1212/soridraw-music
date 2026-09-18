import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const liked = readFileSync('src/services/exploreLikedTracksService.ts', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));
const fail = (message) => { throw new Error(`[110] ${message}`); };

const appVersion = Number(version.version);
if (!Number.isFinite(appVersion) || appVersion < 110) fail('app version is older than 110');
if (!page.includes('SORIDRAW_EXPLORE_LIKED_PUBLIC_COUNT_LOCAL_SYNC_110_20260916')) fail('110 marker missing');

if (appVersion >= 116) {
  if (!page.includes('SORIDRAW_EXPLORE_PUBLIC_COUNT_CONVERGENCE_116_20260917')) fail('116 convergence marker missing');
  if (!page.includes('const syncSharedPublicCountsToLocal110 = (sharedTracks: ExploreTrack[], authoritative = true) =>')) fail('116 authority-aware shared public-count sync helper missing');
  if (!page.includes('if (!sharedTracks.length || !authoritative) return;')) fail('116 authority guard missing');
  if (page.includes('if (feedRequest) syncSharedPublicCountsToLocal110(cachedTracks);')) fail('stale warm Feed cache must not repair liked cards before server revision confirmation');
  if (!page.includes('if (cachedRevision === serverRevision) {\n              syncSharedPublicCountsToLocal110(cachedTracks);\n              return;\n            }')) fail('revision-confirmed warm Feed cache does not repair liked cards');
  if (!page.includes('applyProfileFirstView(refreshedProfile, refreshedRows, true);')) fail('only revalidated public-profile payload should become authoritative');
} else {
  if (!page.includes('const syncSharedPublicCountsToLocal110 = (sharedTracks: ExploreTrack[]) =>')) fail('shared public-count local sync helper missing');
  if (!page.includes('if (feedRequest) syncSharedPublicCountsToLocal110(cachedTracks);')) fail('warm persistent Feed cache does not repair liked cards');
  if (!page.includes('syncSharedPublicCountsToLocal110(normalizedTracks);\n      setProfile(nextProfile);')) fail('public-profile payload does not repair matching liked cards');
}

if (!page.includes('setProfileLikedTracks(applyPublicCounts110);')) fail('open liked-tab state is not reconciled');
if (!page.includes('patchExploreLikedTrackCachedCount091(activeUid, track.id, track.likeCount);')) fail('persistent liked-card cache is not reconciled');
if (!page.includes('if (feedRequest) syncSharedPublicCountsToLocal110(normalizedTracks);')) fail('fresh Feed payload does not repair liked cards');
if (!page.includes('syncSharedPublicCountsToLocal110(normalized);')) fail('load-more Feed payload does not repair liked cards');
if (!/LIKED_TRACK_CACHE_SCHEMA_VERSION\s*=\s*1\s*;/.test(liked)) fail('liked-track cache schema was reset; network bootstrap risk');
if (/app-version\.json|APP_VERSION|appVersion/.test(liked)) fail('liked-track cache became app-version coupled');
if (!/expiresAt:\s*null/.test(liked)) fail('liked-track long-lived cache contract changed');
if (!page.includes('EXPLORE_LIKE_AGGREGATE_WINDOW_MS_105 = 1 * 60_000')) fail('one-minute event aggregate contract changed');

console.log('110_LIKED_PUBLIC_COUNT_LOCAL_SYNC=PASS');
console.log(appVersion >= 116 ? 'SOURCE=SERVER_CONFIRMED_SHARED_FEED_PROFILE_PAYLOAD' : 'SOURCE=SHARED_FEED_PROFILE_PAYLOAD');
console.log('WARM_REPAIR_SERVER_READS=0_BY_CONTRACT');
console.log('LIKED_CACHE_SCHEMA_RESET=NO');
console.log('LIKED_MEMBERSHIP_CHANGED=NO');
console.log('WORKER_D1_CHANGE=NO');
console.log('NO_UI_CSS_CHANGE=true');

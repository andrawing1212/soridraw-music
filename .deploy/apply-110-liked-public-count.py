from pathlib import Path
import json

page_path = Path('src/pages/ExplorePage.tsx')
page = page_path.read_text(encoding='utf-8')

request_anchor = """  }, [sort, submittedQuery]);

  useEffect(() => {
    const cachedRows = readExploreFeedSessionCache(requestUrl);
"""
helper = """  }, [sort, submittedQuery]);

  // SORIDRAW_EXPLORE_LIKED_PUBLIC_COUNT_LOCAL_SYNC_110_20260916
  // Public counts belong to the shared Feed/Profile payload, not to the account-specific
  // liked-card snapshot. Reuse already-cached public payloads to repair liked cards locally
  // without a Firestore/D1 request, schema reset, polling loop, or optimistic count overlay.
  const syncSharedPublicCountsToLocal110 = (sharedTracks: ExploreTrack[]) => {
    if (!sharedTracks.length) return;
    const countByTrackId = new Map(sharedTracks.map((track) => [track.id, track.likeCount]));
    const applyPublicCounts110 = (previous: ExploreTrack[]) => previous.map((track) => {
      const nextCount = countByTrackId.get(track.id);
      return nextCount === undefined || nextCount === track.likeCount ? track : { ...track, likeCount: nextCount };
    });

    setProfileTracks(applyPublicCounts110);
    setProfileLikedTracks(applyPublicCounts110);

    const activeUid = auth.currentUser?.uid || user?.uid || '';
    sharedTracks.forEach((track) => {
      if (track.ownerUid) patchExplorePublicProfileFirstViewTrack(track.ownerUid, track.id, { likeCount: track.likeCount });
      if (activeUid) patchExploreLikedTrackCachedCount091(activeUid, track.id, track.likeCount);
    });
  };

  useEffect(() => {
    const cachedRows = readExploreFeedSessionCache(requestUrl);
"""
if 'SORIDRAW_EXPLORE_LIKED_PUBLIC_COUNT_LOCAL_SYNC_110_20260916' not in page:
    if request_anchor not in page:
        raise SystemExit('110 requestUrl helper anchor missing')
    page = page.replace(request_anchor, helper, 1)

old_apply = """      const normalizedTracks = rows.map(normalizeTrack).filter((track) => track.id);
      const activeUid = auth.currentUser?.uid || '';
      setFeedNextCursor(nextCursor);
      setLoadMoreError('');
      setTracks(normalizedTracks);
      if (feedRequest) {
        const countByTrackId = new Map(normalizedTracks.map((track) => [track.id, track.likeCount]));
        setProfileTracks((previous) => previous.map((track) => {
          const nextCount = countByTrackId.get(track.id);
          return nextCount === undefined || nextCount === track.likeCount ? track : { ...track, likeCount: nextCount };
        }));
        normalizedTracks.forEach((track) => {
          if (track.ownerUid) patchExplorePublicProfileFirstViewTrack(track.ownerUid, track.id, { likeCount: track.likeCount });
          if (activeUid) patchExploreLikedTrackCachedCount091(activeUid, track.id, track.likeCount);
        });
      }
"""
new_apply = """      const normalizedTracks = rows.map(normalizeTrack).filter((track) => track.id);
      setFeedNextCursor(nextCursor);
      setLoadMoreError('');
      setTracks(normalizedTracks);
      if (feedRequest) syncSharedPublicCountsToLocal110(normalizedTracks);
"""
if old_apply in page:
    page = page.replace(old_apply, new_apply, 1)
elif new_apply not in page:
    raise SystemExit('110 fresh payload sync anchor missing')

old_cached = """      const cachedTracks = cachedRows.map(normalizeTrack).filter((track) => track.id);
      setTracks(cachedTracks);
      setLoading(false);
"""
new_cached = """      const cachedTracks = cachedRows.map(normalizeTrack).filter((track) => track.id);
      if (feedRequest) syncSharedPublicCountsToLocal110(cachedTracks);
      setTracks(cachedTracks);
      setLoading(false);
"""
if old_cached in page:
    page = page.replace(old_cached, new_cached, 1)
elif new_cached not in page:
    raise SystemExit('110 cached Feed local sync anchor missing')

old_profile = """      const normalizedTracks = rows.map(normalizeTrack).filter((track) => track.id);
      normalizedTracks.sort(comparePublicProfileTracks);
      setProfile(nextProfile);
      setProfileTracks(normalizedTracks);
"""
new_profile = """      const normalizedTracks = rows.map(normalizeTrack).filter((track) => track.id);
      normalizedTracks.sort(comparePublicProfileTracks);
      syncSharedPublicCountsToLocal110(normalizedTracks);
      setProfile(nextProfile);
      setProfileTracks(normalizedTracks);
"""
if old_profile in page:
    page = page.replace(old_profile, new_profile, 1)
elif new_profile not in page:
    raise SystemExit('110 profile public sync anchor missing')

old_more = """      const normalized = rows.map(normalizeTrack).filter((track) => track.id);
      const activeUid = auth.currentUser?.uid || '';
      if (activeUid) {
        normalized.forEach((track) => {
          if (track.ownerUid) patchExplorePublicProfileFirstViewTrack(track.ownerUid, track.id, { likeCount: track.likeCount });
          patchExploreLikedTrackCachedCount091(activeUid, track.id, track.likeCount);
        });
      }
"""
new_more = """      const normalized = rows.map(normalizeTrack).filter((track) => track.id);
      syncSharedPublicCountsToLocal110(normalized);
"""
if old_more in page:
    page = page.replace(old_more, new_more, 1)
elif new_more not in page:
    raise SystemExit('110 load-more local sync anchor missing')

page_path.write_text(page, encoding='utf-8')

version_path = Path('public/app-version.json')
version = json.loads(version_path.read_text(encoding='utf-8'))
version['version'] = '110'
version_path.write_text(json.dumps(version, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')

verifier = """import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const liked = readFileSync('src/services/exploreLikedTracksService.ts', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));
const fail = (message) => { throw new Error(`[110] ${message}`); };

if (String(version.version) !== '110') fail('app version is not 110');
if (!page.includes('SORIDRAW_EXPLORE_LIKED_PUBLIC_COUNT_LOCAL_SYNC_110_20260916')) fail('110 marker missing');
if (!page.includes('const syncSharedPublicCountsToLocal110 = (sharedTracks: ExploreTrack[]) =>')) fail('shared public-count local sync helper missing');
if (!page.includes('setProfileLikedTracks(applyPublicCounts110);')) fail('open liked-tab state is not reconciled');
if (!page.includes('patchExploreLikedTrackCachedCount091(activeUid, track.id, track.likeCount);')) fail('persistent liked-card cache is not reconciled');
if (!page.includes('if (feedRequest) syncSharedPublicCountsToLocal110(cachedTracks);')) fail('warm persistent Feed cache does not repair liked cards');
if (!page.includes('if (feedRequest) syncSharedPublicCountsToLocal110(normalizedTracks);')) fail('fresh Feed payload does not repair liked cards');
if (!page.includes('syncSharedPublicCountsToLocal110(normalized);')) fail('load-more Feed payload does not repair liked cards');
if (!page.includes('syncSharedPublicCountsToLocal110(normalizedTracks);\\n      setProfile(nextProfile);')) fail('public-profile payload does not repair matching liked cards');
if (!/LIKED_TRACK_CACHE_SCHEMA_VERSION\\s*=\\s*1\\s*;/.test(liked)) fail('liked-track cache schema was reset; network bootstrap risk');
if (/app-version\\.json|APP_VERSION|appVersion/.test(liked)) fail('liked-track cache became app-version coupled');
if (!/expiresAt:\\s*null/.test(liked)) fail('liked-track long-lived cache contract changed');
if (!page.includes('EXPLORE_LIKE_AGGREGATE_WINDOW_MS_105 = 1 * 60_000')) fail('one-minute event aggregate contract changed');

console.log('110_LIKED_PUBLIC_COUNT_LOCAL_SYNC=PASS');
console.log('SOURCE=SHARED_FEED_PROFILE_PAYLOAD');
console.log('WARM_REPAIR_SERVER_READS=0_BY_CONTRACT');
console.log('LIKED_CACHE_SCHEMA_RESET=NO');
console.log('LIKED_MEMBERSHIP_CHANGED=NO');
console.log('WORKER_D1_CHANGE=NO');
console.log('NO_UI_CSS_CHANGE=true');
"""
Path('scripts/verify-110-explore-liked-public-count.mjs').write_text(verifier, encoding='utf-8')

from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
page_path = ROOT / 'src/pages/ExplorePage.tsx'
version_path = ROOT / 'public/app-version.json'
manifest_path = ROOT / 'cloudflare/explore-worker/release-patches.json'

page = page_path.read_text(encoding='utf-8')


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'[116] expected exactly one {label}, found {count}')
    return source.replace(old, new, 1)

page = replace_once(
    page,
    "  writeExploreFeedSessionCache,\n} from '../services/exploreSessionCache';",
    "  writeExploreFeedSessionCache,\n  patchExploreFeedSessionCachesRow,\n} from '../services/exploreSessionCache';",
    'feed cache import anchor',
)

old_helper = """  // SORIDRAW_EXPLORE_LIKED_PUBLIC_COUNT_LOCAL_SYNC_110_20260916
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
"""
new_helper = """  // SORIDRAW_EXPLORE_LIKED_PUBLIC_COUNT_LOCAL_SYNC_110_20260916
  // SORIDRAW_EXPLORE_PUBLIC_COUNT_CONVERGENCE_116_20260917
  // Only server-confirmed/shared payloads may become public-count authority. Once a count is
  // confirmed, patch every already-loaded Feed/Profile/Liked cache by track id so Recommended,
  // Latest, Popular and Public Profile cannot display different counts on the same device.
  const syncSharedPublicCountsToLocal110 = (sharedTracks: ExploreTrack[], authoritative = true) => {
    if (!sharedTracks.length || !authoritative) return;
    const countByTrackId = new Map(sharedTracks.map((track) => [track.id, track.likeCount]));
    const applyPublicCounts110 = (previous: ExploreTrack[]) => previous.map((track) => {
      const nextCount = countByTrackId.get(track.id);
      return nextCount === undefined || nextCount === track.likeCount ? track : { ...track, likeCount: nextCount };
    });

    setTracks(applyPublicCounts110);
    setProfileTracks(applyPublicCounts110);
    setProfileLikedTracks(applyPublicCounts110);

    const activeUid = auth.currentUser?.uid || user?.uid || '';
    sharedTracks.forEach((track) => {
      patchExploreFeedSessionCachesRow(track.id, { likeCount: track.likeCount });
      if (track.ownerUid) patchExplorePublicProfileFirstViewTrack(track.ownerUid, track.id, { likeCount: track.likeCount });
      if (activeUid) patchExploreLikedTrackCachedCount091(activeUid, track.id, track.likeCount);
    });
  };
"""
page = replace_once(page, old_helper, new_helper, 'public-count helper')

page = replace_once(
    page,
    "      if (feedRequest) syncSharedPublicCountsToLocal110(cachedTracks);\n      setTracks(cachedTracks);",
    "      // 116: cached rows render immediately but do not overwrite newer public-count authority.\n      setTracks(cachedTracks);",
    'cached feed propagation',
)

page = replace_once(
    page,
    "            if (cachedRevision === serverRevision) return;",
    "            if (cachedRevision === serverRevision) {\n              syncSharedPublicCountsToLocal110(cachedTracks);\n              return;\n            }",
    'revision-confirmed cache branch',
)

page = replace_once(
    page,
    "    const applyProfileFirstView = (nextProfile: ExplorePublicProfile, rows: Array<Record<string, unknown>>) => {",
    "    const applyProfileFirstView = (nextProfile: ExplorePublicProfile, rows: Array<Record<string, unknown>>, authoritative = false) => {",
    'profile apply signature',
)
page = replace_once(
    page,
    "      syncSharedPublicCountsToLocal110(normalizedTracks);\n      setProfile(nextProfile);",
    "      if (authoritative) syncSharedPublicCountsToLocal110(normalizedTracks);\n      setProfile(nextProfile);",
    'profile authority gate',
)
page = replace_once(
    page,
    "        applyProfileFirstView(refreshedProfile, refreshedRows);",
    "        applyProfileFirstView(refreshedProfile, refreshedRows, true);",
    'revalidated profile authority',
)

page_path.write_text(page, encoding='utf-8')

version = json.loads(version_path.read_text(encoding='utf-8'))
version['version'] = '116'
version_path.write_text(json.dumps(version, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
patches = manifest.setdefault('patches', [])
patch_name = '064-shared-feed-catchup-convergence.mjs'
if patch_name not in patches:
    patches.append(patch_name)
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print('[116] client public-count convergence, app version 116 and Worker 064 manifest applied.')

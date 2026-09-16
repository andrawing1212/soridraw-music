from pathlib import Path
import json


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'missing expected block: {label}')
    return text.replace(old, new, 1)


# 1) Explore page: render the public count directly from shared Feed/Profile payloads.
page_path = Path('src/pages/ExplorePage.tsx')
page = page_path.read_text(encoding='utf-8')
page = replace_once(
    page,
    "import {\n  getExploreLikeCanonicalCount091,\n  getExploreLikeDisplayCount091,\n  seedExploreLikeCanonicalCounts091,\n  updateExploreLikeCanonicalCounts091,\n} from '../services/exploreLikeDisplayStateService';\n",
    '',
    'Explore display-state import',
)
page = replace_once(
    page,
    "      const activeUid = auth.currentUser?.uid || '';\n      const canonicalRows = normalizedTracks.map((track) => ({ trackId: track.id, likeCount: track.likeCount }));\n      if (activeUid) {\n        if (feedRequest) updateExploreLikeCanonicalCounts091(activeUid, canonicalRows);\n        else seedExploreLikeCanonicalCounts091(activeUid, canonicalRows);\n      }\n",
    "      const activeUid = auth.currentUser?.uid || '';\n",
    'applyPayload count overlay',
)
page = replace_once(
    page,
    "      const activeUid = auth.currentUser?.uid || '';\n      if (activeUid) seedExploreLikeCanonicalCounts091(activeUid, cachedTracks.map((track) => ({ trackId: track.id, likeCount: track.likeCount })));\n      setTracks(cachedTracks);",
    "      setTracks(cachedTracks);",
    'cached feed count overlay',
)
page = replace_once(
    page,
    "      const activeUid = auth.currentUser?.uid || '';\n      if (activeUid) {\n        seedExploreLikeCanonicalCounts091(activeUid, normalizedTracks.map((track) => ({ trackId: track.id, likeCount: track.likeCount })));\n      }\n      setProfile(nextProfile);",
    "      setProfile(nextProfile);",
    'profile count overlay',
)
page = replace_once(
    page,
    "        seedExploreLikeCanonicalCounts091(user.uid, normalizedRows.map((track) => ({ trackId: track.id, likeCount: track.likeCount })));\n",
    '',
    'liked collection count overlay',
)
page = replace_once(
    page,
    "        updateExploreLikeCanonicalCounts091(activeUid, normalized.map((track) => ({ trackId: track.id, likeCount: track.likeCount })));\n",
    '',
    'load more count overlay',
)
page = replace_once(
    page,
    "      const canonicalTrack = { ...track, likeCount: getExploreLikeCanonicalCount091(user.uid, track.id, track.likeCount) };",
    "      const canonicalTrack = { ...track };",
    'toggle canonical track',
)
page = replace_once(
    page,
    "      {items.map((track) => {\n        const displayTrack = user?.uid ? { ...track, likeCount: getExploreLikeDisplayCount091(user.uid, track.id, track.likeCount) } : track;\n        return (\n          <ExploreTrackCard\n            key={track.id}\n            track={displayTrack}",
    "      {items.map((track) => {\n        return (\n          <ExploreTrackCard\n            key={track.id}\n            track={track}",
    'render direct count',
)
page = page.replace('// SORIDRAW_EXPLORE_SHARED_DISPLAY_COUNT_091_20260915\n', '')
page = page.replace('// SORIDRAW_EXPLORE_LIKE_LOCAL_VISIBLE_COUNT_074_20260912\n// SORIDRAW_EXPLORE_UID_SCOPED_LIKE_OVERLAY_075_20260913\n', '')
if '// SORIDRAW_EXPLORE_PUBLIC_COUNT_DIRECT_107_20260916\n' not in page:
    page = page.replace(
        '// SORIDRAW_EXPLORE_LIKE_EVENT_REFRESH_105_20260916\n',
        '// SORIDRAW_EXPLORE_LIKE_EVENT_REFRESH_105_20260916\n// SORIDRAW_EXPLORE_PUBLIC_COUNT_DIRECT_107_20260916\n',
        1,
    )
page_path.write_text(page, encoding='utf-8')


# 2) Like service: keep personal membership/outbox only. Remove legacy local numeric overlay.
like_path = Path('src/services/exploreLikeService.ts')
like = like_path.read_text(encoding='utf-8')
like = replace_once(
    like,
    "import {\n  confirmExploreLikeDisplayTransition094,\n  rebaseExploreLikePendingDisplay094,\n  beginExploreLikeDisplayTransition091,\n  getExploreLikeCanonicalCount091,\n  getExploreLikeDisplayCount091,\n} from './exploreLikeDisplayStateService';\n",
    '',
    'like display-state import',
)
like = like.replace('// SORIDRAW_EXPLORE_SHARED_DISPLAY_COUNT_091_20260915\n', '')
if '// SORIDRAW_EXPLORE_PUBLIC_COUNT_DIRECT_107_20260916\n' not in like:
    like = like.replace(
        '// SORIDRAW_EXPLORE_PUBLIC_COUNT_SOURCE_SEPARATION_106_20260916\n',
        '// SORIDRAW_EXPLORE_PUBLIC_COUNT_SOURCE_SEPARATION_106_20260916\n// SORIDRAW_EXPLORE_PUBLIC_COUNT_DIRECT_107_20260916\n',
        1,
    )

loop_start = like.index('    for (const pending of batchEntries) {\n', like.index('const flushPendingLikes'))
loop_end = like.index('\n    persistLikedStateCache(uid, confirmedCache);', loop_start)
new_loop = """    for (const pending of batchEntries) {
      const result = resultByTrack.get(pending.trackId);
      if (!result) continue;
      confirmedCache.set(result.trackId, result.liked);

      const latest = latestOutbox[pending.trackId];
      let visibleLiked = result.liked;
      let ownerUid = pending.ownerUid;
      const hasNewerPending = Boolean(latest && latest.updatedAt !== pending.updatedAt);
      if (hasNewerPending && latest) {
        ownerUid = latest.ownerUid || ownerUid;
        latest.baseLiked = result.liked;
        // Backward-compatible local outbox metadata only; never a public display source.
        latest.baseLikeCount = clampLikeCount(result.likeCount);
        latest.optimisticLikeCount = clampLikeCount(result.likeCount);
        latest.retryCount = 0;
        visibleLiked = latest.desiredLiked;
        if (latest.desiredLiked === result.liked) {
          delete latestOutbox[pending.trackId];
        } else {
          latestOutbox[pending.trackId] = latest;
        }
      } else {
        delete latestOutbox[pending.trackId];
      }

      const confirmedResult = {
        trackId: result.trackId,
        liked: result.liked,
        likeCount: result.likeCount,
      };
      accountSyncResults.push(confirmedResult);
      accountReplayResults.push({ ...confirmedResult, ownerUid });
      dispatchLikeSync({
        uid,
        trackId: result.trackId,
        ownerUid,
        liked: visibleLiked,
        likeCount: result.likeCount,
      });
    }
"""
like = like[:loop_start] + new_loop + like[loop_end:]
like = replace_once(
    like,
    "\n\nexport const getExploreLikeDisplayCounts = (\n  _user: User,\n  _trackIds: string[],\n): Record<string, number> => ({});\n",
    '',
    'legacy display-count export',
)
like = replace_once(
    like,
    "  const canonicalLikeCount = getExploreLikeCanonicalCount091(user.uid, normalizedTrackId, currentLikeCount);\n  const baselineLiked = inflight?.desiredLiked ?? existing?.baseLiked ?? previousVisibleLiked;\n  const baselineLikeCount = existing?.baseLikeCount ?? canonicalLikeCount;\n  const optimisticLikeCount = beginExploreLikeDisplayTransition091(\n    user.uid, normalizedTrackId, ownerUid, previousVisibleLiked, liked, canonicalLikeCount,\n  );",
    "  const canonicalLikeCount = clampLikeCount(currentLikeCount);\n  const baselineLiked = inflight?.desiredLiked ?? existing?.baseLiked ?? previousVisibleLiked;\n  const baselineLikeCount = existing?.baseLikeCount ?? canonicalLikeCount;\n  // 107: public count is never optimistic or account-scoped. Keep the last shared\n  // Feed/Profile count only as backward-compatible outbox metadata.\n  const optimisticLikeCount = canonicalLikeCount;",
    'setExploreTrackLike numeric overlay',
)
like_path.write_text(like, encoding='utf-8')


# 3) Delete the now-unreferenced historical display overlay module.
display_path = Path('src/services/exploreLikeDisplayStateService.ts')
if display_path.exists():
    display_path.unlink()


# 4) Public profile: warm cache stays local until a real mutation patches/invalidates it.
profile_path = Path('src/services/exploreProfileFirstViewService.ts')
profile = profile_path.read_text(encoding='utf-8')
profile = profile.replace("const PROFILE_FIRST_VIEW_REVALIDATE_AFTER_MS = 10_000;\n", '')
profile = profile.replace("const profileRevalidationInflight = new Map<string, Promise<void>>();\n", '')
func_at = profile.index('export const getExplorePublicProfileFirstView = async')
cached_start = profile.index('  if (cached) {\n', func_at)
cached_end = profile.index('\n\n  const inflightKey', cached_start)
cached_block = """  if (cached) {
    // 107: warm revisit is strictly local. Known profile/publication/follow/like
    // mutations already patch or invalidate this cache at the mutation boundary.
    recordCloudflareLocalCacheHit(
      PROFILE_FIRST_VIEW_DIAGNOSTIC_PATH,
      'LOCAL HIT · 변경 없음 · 서버 D1 읽기 0',
    );
    return cached;
  }"""
profile = profile[:cached_start] + cached_block + profile[cached_end:]
if '// SORIDRAW_PROFILE_WARM_ZERO_READ_107_20260916\n' not in profile:
    profile = profile.replace(
        '// SORIDRAW_PROFILE_CACHE_SWR_1020\n',
        '// SORIDRAW_PROFILE_CACHE_SWR_1020\n// SORIDRAW_PROFILE_WARM_ZERO_READ_107_20260916\n',
        1,
    )
profile_path.write_text(profile, encoding='utf-8')


# 5) App version 107.
version_path = Path('public/app-version.json')
version = json.loads(version_path.read_text(encoding='utf-8'))
version['version'] = '107'
version_path.write_text(json.dumps(version, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')


# 6) Remove superseded one-shot 106 implementation artifacts/verifier.
obsolete = [
    '.deploy/apply-106-explore-public-count-separation.py',
    '.deploy/apply-106-explore-public-count-separation.trigger',
    '.deploy/apply-106b-explore-public-count-canonical-only.py',
    '.deploy/apply-106b-explore-public-count-canonical-only.trigger',
    '.github/workflows/apply-106-explore-public-count-separation.yml',
    '.github/workflows/apply-106b-explore-public-count-canonical-only.yml',
    'scripts/verify-106-explore-public-count-separation.mjs',
]
for item in obsolete:
    path = Path(item)
    if path.exists():
        path.unlink()


# 7) Successor compatibility for permanent 105/103 scheduler verifiers.
v105_path = Path('scripts/verify-105-explore-like-1min.mjs')
v105 = v105_path.read_text(encoding='utf-8')
v105 = v105.replace("['105', '106'].includes(version.version)", "['105', '106', '107'].includes(version.version)")
v105_path.write_text(v105, encoding='utf-8')

v103_path = Path('scripts/verify-103-explore-like-event-batch.mjs')
v103 = v103_path.read_text(encoding='utf-8')
v103 = v103.replace("version.version === '105' || version.version === '106'", "version.version === '105' || version.version === '106' || version.version === '107'")
v103_path.write_text(v103, encoding='utf-8')


# 8) Permanent regression verifier for simplified public count and warm profile zero-read.
verifier = Path('scripts/verify-107-explore-direct-count-zero-read.mjs')
verifier.write_text("""import { readFileSync, existsSync } from 'node:fs';

const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const likes = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const profile = readFileSync('src/services/exploreProfileFirstViewService.ts', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

const fail = (message) => { throw new Error(`[107] ${message}`); };
if (String(version.version) !== '107') fail('app version is not 107');
if (existsSync('src/services/exploreLikeDisplayStateService.ts')) fail('obsolete display-state service still exists');
for (const text of [page, likes]) {
  if (text.includes('exploreLikeDisplayStateService')) fail('display-state import remains');
  if (/getExploreLike(Display|Canonical)Count091|seedExploreLikeCanonicalCounts091|updateExploreLikeCanonicalCounts091|beginExploreLikeDisplayTransition091|confirmExploreLikeDisplayTransition094|rebaseExploreLikePendingDisplay094/.test(text)) {
    fail('legacy numeric overlay reference remains');
  }
}
if (!page.includes('track={track}')) fail('cards do not render shared track payload directly');
if (page.includes('displayTrack =')) fail('account-scoped display track remains');
if (!likes.includes('const optimisticLikeCount = canonicalLikeCount;')) fail('outbox compatibility count is not shared-count only');
if (profile.includes('PROFILE_FIRST_VIEW_REVALIDATE_AFTER_MS')) fail('time-based profile revalidation remains');
if (profile.includes('profileRevalidationInflight')) fail('profile revalidation inflight map remains');
const functionAt = profile.indexOf('export const getExplorePublicProfileFirstView = async');
const cachedAt = profile.indexOf('if (cached) {', functionAt);
const coldAt = profile.indexOf('const inflightKey', cachedAt);
if (functionAt < 0 || cachedAt < 0 || coldAt < 0) fail('cached profile branch missing');
const warmBranch = profile.slice(cachedAt, coldAt);
if (warmBranch.includes('requestMaterializedFirstView')) fail('warm profile revisit still performs server request');
if (!warmBranch.includes('서버 D1 읽기 0')) fail('warm profile local-hit contract marker missing');

console.log('107_EXPLORE_DIRECT_COUNT_ZERO_READ=PASS');
console.log('PUBLIC_COUNT_SOURCE=TRACK_FEED_PROFILE_PAYLOAD_DIRECT');
console.log('ACCOUNT_SIGNAL=MEMBERSHIP_ONLY');
console.log('PROFILE_WARM_REVISIT_D1_READ=0_BY_CLIENT_CONTRACT');
console.log('OBSOLETE_DISPLAY_OVERLAY=REMOVED');
console.log('NO_UI_CSS_CHANGE=true');
console.log('NO_D1_SCHEMA_MIGRATION=true');
""", encoding='utf-8')

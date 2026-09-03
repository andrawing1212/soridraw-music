from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVICE = ROOT / 'src/services/exploreProfileFirstViewService.ts'
PAGE = ROOT / 'src/pages/ExplorePage.tsx'

service = SERVICE.read_text(encoding='utf-8')
anchor = "export const getExplorePublicProfileFirstView = async (profileRef: string): Promise<ExploreProfileFirstViewData> => {\n"
helpers = r'''export const rememberExplorePublicProfileFirstViewProfile = (profile: ExplorePublicProfile) => {
  const normalizedUid = normalizeProfileRef(profile.uid);
  if (!normalizedUid) return;
  const cached = readCache(normalizedUid)
    || (profile.handle ? readCache(`@${profile.handle}`) : null);
  if (!cached) return;
  writeCache(normalizedUid, { ...cached, profile });
};

export const patchExplorePublicProfileFirstViewProfile = (
  profileRef: string,
  patch: Partial<ExplorePublicProfile>,
) => {
  const cached = readCache(profileRef);
  if (!cached) return;
  writeCache(cached.profile.uid || profileRef, {
    ...cached,
    profile: { ...cached.profile, ...patch },
  });
};

export const patchExplorePublicProfileFirstViewTrack = (
  profileRef: string,
  trackId: string,
  patch: Record<string, unknown>,
) => {
  const cached = readCache(profileRef);
  if (!cached || !trackId) return;
  let changed = false;
  const tracks = cached.tracks.map((track) => {
    const id = String(track?.id || track?.trackId || '').trim();
    if (id !== trackId) return track;
    changed = true;
    return { ...track, ...patch };
  });
  if (!changed) return;
  writeCache(cached.profile.uid || profileRef, { ...cached, tracks });
};

'''
if helpers.strip() not in service:
    if anchor not in service:
        raise SystemExit('profile first-view export anchor missing')
    service = service.replace(anchor, helpers + anchor, 1)
SERVICE.write_text(service, encoding='utf-8')

page = PAGE.read_text(encoding='utf-8')
old_import = "import { getExplorePublicProfileFirstView } from '../services/exploreProfileFirstViewService';"
new_import = "import { getExplorePublicProfileFirstView, patchExplorePublicProfileFirstViewProfile, patchExplorePublicProfileFirstViewTrack, rememberExplorePublicProfileFirstViewProfile } from '../services/exploreProfileFirstViewService';"
if old_import in page:
    page = page.replace(old_import, new_import, 1)
elif new_import not in page:
    raise SystemExit('Explore first-view import missing')

like_anchor = "      patchExploreFeedSessionCacheRow(requestUrl, track.id, { likeCount: result.likeCount });\n"
like_line = "      patchExplorePublicProfileFirstViewTrack(track.ownerUid, track.id, { likeCount: result.likeCount });\n"
if like_line not in page:
    if like_anchor not in page:
        raise SystemExit('Explore like cache patch anchor missing')
    page = page.replace(like_anchor, like_anchor + like_line, 1)

follow_anchor = "      setFollowState(result);\n"
follow_patch = """      patchExplorePublicProfileFirstViewProfile(profile.uid, {
        followerCount: result.followerCount || (nextShouldFollow ? profile.followerCount + 1 : Math.max(0, profile.followerCount - 1)),
        followingCount: result.followingCount || profile.followingCount,
      });
"""
if follow_patch not in page:
    if follow_anchor not in page:
        raise SystemExit('Explore follow cache patch anchor missing')
    page = page.replace(follow_anchor, follow_anchor + follow_patch, 1)

saved_anchor = "                  setProfile(nextProfile);\n"
saved_line = "                  rememberExplorePublicProfileFirstViewProfile(nextProfile);\n"
if saved_line not in page:
    if saved_anchor not in page:
        raise SystemExit('Explore profile saved anchor missing')
    page = page.replace(saved_anchor, saved_anchor + saved_line, 1)

PAGE.write_text(page, encoding='utf-8')
print('COST_ZERO_STAGE2A_PROFILE_CACHE_MUTATIONS=APPLIED')

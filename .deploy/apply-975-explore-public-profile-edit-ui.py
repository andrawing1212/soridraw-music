from pathlib import Path

path = Path('src/pages/ExplorePage.tsx')
text = path.read_text(encoding='utf-8')
marker = '// SORIDRAW_EXPLORE_8E5_PROFILE_EDIT_UI_975'

if marker in text:
    print('apply-975: already applied')
    raise SystemExit(0)


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise RuntimeError(f'apply-975: anchor not found: {label}')
    text = text.replace(old, new, 1)

replace_once(
    "// SORIDRAW_EXPLORE_8E5_SOCIAL_PUBLIC_PROFILE\n",
    "// SORIDRAW_EXPLORE_8E5_SOCIAL_PUBLIC_PROFILE\n" + marker + "\n",
    'marker',
)
replace_once(
    "import { ArrowLeft, Compass, ExternalLink, Heart, Loader2, Music2, Pin, Search, UserCheck, UserPlus, X } from 'lucide-react';",
    "import { ArrowLeft, Compass, ExternalLink, Heart, Loader2, Music2, Pencil, Pin, Search, UserCheck, UserPlus, X } from 'lucide-react';",
    'Pencil import',
)
replace_once(
    "import '../components/explore/explore.css';",
    "import ExploreProfileEditModal from '../components/explore/ExploreProfileEditModal';\nimport '../components/explore/explore.css';",
    'modal import',
)
replace_once(
    "  ownerUid: string;\n  title: string;",
    "  ownerUid: string;\n  ownerHandle: string;\n  title: string;",
    'track owner handle type',
)
replace_once(
    "  ownerUid: safeText(row.ownerUid ?? row.owner_uid),\n  title:",
    "  ownerUid: safeText(row.ownerUid ?? row.owner_uid),\n  ownerHandle: safeText(row.ownerHandle ?? row.owner_handle).replace(/^@+/, ''),\n  title:",
    'track owner handle normalize',
)
replace_once(
    "  const [followBusy, setFollowBusy] = useState(false);\n",
    "  const [followBusy, setFollowBusy] = useState(false);\n  const [profileEditOpen, setProfileEditOpen] = useState(false);\n",
    'edit modal state',
)
replace_once(
    "      setFollowState(null);\n      return;",
    "      setFollowState(null);\n      setProfileEditOpen(false);\n      return;",
    'close modal on profile exit',
)
replace_once(
    "        if (user && user.uid !== profileUid) {\n          try {\n            const nextFollowState = await getExploreFollowState(user, profileUid);",
    "        if (user && user.uid !== nextProfile.uid) {\n          try {\n            const nextFollowState = await getExploreFollowState(user, nextProfile.uid);",
    'follow hydration resolved uid',
)
replace_once(
    "    setSearchParams({ profile: track.ownerUid });",
    "    setSearchParams({ profile: track.ownerHandle ? `@${track.ownerHandle}` : track.ownerUid });",
    'open handle profile when available',
)
replace_once(
    "    if (!profileUid || !profile) return;",
    "    if (!profileUid || !profile) return;",
    'toggle follow guard',
)
replace_once(
    "    if (user.uid === profileUid || followBusy) return;",
    "    if (user.uid === profile.uid || followBusy) return;",
    'self follow resolved uid',
)
replace_once(
    "      const result = await setExploreFollow(user, profileUid, nextShouldFollow);",
    "      const result = await setExploreFollow(user, profile.uid, nextShouldFollow);",
    'follow resolved uid',
)

old_head = '''            <section className="soridraw-explore-profile-head">\n              <div className="soridraw-explore-profile-avatar" aria-hidden="true">\n                {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" /> : profile.nickname.charAt(0).toUpperCase()}\n              </div>\n              <div className="soridraw-explore-profile-copy">\n                <div className="soridraw-explore-profile-name-line">\n                  <h1>{profile.nickname}</h1>\n                  {user?.uid === profileUid ? (\n                    <span className="soridraw-explore-own-profile">내 공개 프로필</span>\n                  ) : (\n                    <button\n                      type="button"\n                      onClick={toggleFollow}\n                      disabled={followBusy}\n                      className={`soridraw-explore-follow-button${followState?.isFollowing ? ' is-following' : ''}`}\n                    >\n                      {followBusy ? <Loader2 className="soridraw-explore-spinner" aria-hidden="true" /> : followState?.isFollowing ? <UserCheck aria-hidden="true" /> : <UserPlus aria-hidden="true" />}\n                      {followState?.isFollowing ? '팔로잉' : '팔로우'}\n                    </button>\n                  )}\n                </div>\n                {profile.bio && <p>{profile.bio}</p>}\n                <div className="soridraw-explore-profile-stats">\n                  <span>팔로워 <strong>{formatCount(profile.followerCount)}</strong></span>\n                  <span>팔로잉 <strong>{formatCount(profile.followingCount)}</strong></span>\n                  <span>공개곡 <strong>{formatCount(profile.trackCount || profileTracks.length)}</strong></span>\n                </div>\n              </div>\n            </section>'''

new_head = '''            <section className={`soridraw-explore-profile-head${profile.backgroundUrl ? ' has-background' : ''}`}>\n              {profile.backgroundUrl && (\n                <div className="soridraw-explore-profile-background" aria-hidden="true">\n                  <img src={profile.backgroundUrl} alt="" referrerPolicy="no-referrer" />\n                  <span />\n                </div>\n              )}\n              <div className="soridraw-explore-profile-content">\n                <div className="soridraw-explore-profile-avatar" aria-hidden="true">\n                  {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" /> : profile.nickname.charAt(0).toUpperCase()}\n                </div>\n                <div className="soridraw-explore-profile-copy">\n                  <div className="soridraw-explore-profile-name-line">\n                    <h1>{user?.uid === profile.uid && ['SORIDRAW 사용자', 'SORIDRAW User', 'SORiDRAW', 'SORIDRAW'].includes(profile.nickname) ? (user.displayName || user.email?.split('@')[0] || profile.nickname) : profile.nickname}</h1>\n                    {user?.uid === profile.uid ? (\n                      <button type="button" className="soridraw-explore-profile-edit-button" onClick={() => setProfileEditOpen(true)}>\n                        <Pencil aria-hidden="true" /> 편집\n                      </button>\n                    ) : (\n                      <button\n                        type="button"\n                        onClick={toggleFollow}\n                        disabled={followBusy}\n                        className={`soridraw-explore-follow-button${followState?.isFollowing ? ' is-following' : ''}`}\n                      >\n                        {followBusy ? <Loader2 className="soridraw-explore-spinner" aria-hidden="true" /> : followState?.isFollowing ? <UserCheck aria-hidden="true" /> : <UserPlus aria-hidden="true" />}\n                        {followState?.isFollowing ? '팔로잉' : '팔로우'}\n                      </button>\n                    )}\n                  </div>\n                  {profile.handle && <div className="soridraw-explore-profile-handle">@{profile.handle}</div>}\n                  {profile.bio && <p>{profile.bio}</p>}\n                  <div className="soridraw-explore-profile-stats">\n                    <span>팔로워 <strong>{formatCount(profile.followerCount)}</strong></span>\n                    <span>팔로잉 <strong>{formatCount(profile.followingCount)}</strong></span>\n                    <span>공개곡 <strong>{formatCount(profile.trackCount || profileTracks.length)}</strong></span>\n                  </div>\n                  {profile.genres.length > 0 && <div className="soridraw-explore-profile-genres">{profile.genres.map((genre) => <span key={genre}>{genre}</span>)}</div>}\n                  {(profile.socialLinks.spotify || profile.socialLinks.instagram || profile.socialLinks.tiktok) && (\n                    <div className="soridraw-explore-profile-social-links">\n                      {profile.socialLinks.spotify && <a href={profile.socialLinks.spotify} target="_blank" rel="noreferrer">Spotify</a>}\n                      {profile.socialLinks.instagram && <a href={profile.socialLinks.instagram} target="_blank" rel="noreferrer">Instagram</a>}\n                      {profile.socialLinks.tiktok && <a href={profile.socialLinks.tiktok} target="_blank" rel="noreferrer">TikTok</a>}\n                    </div>\n                  )}\n                </div>\n              </div>\n            </section>\n\n            {profileEditOpen && user?.uid === profile.uid && (\n              <ExploreProfileEditModal\n                user={user}\n                profile={profile}\n                onClose={() => setProfileEditOpen(false)}\n                onSaved={(nextProfile) => {\n                  setProfile(nextProfile);\n                  if (nextProfile.handle) setSearchParams({ profile: `@${nextProfile.handle}` }, { replace: true });\n                }}\n              />\n            )}'''

replace_once(old_head, new_head, 'profile head edit UI')

required = [
    marker,
    'ExploreProfileEditModal',
    'soridraw-explore-profile-edit-button',
    'profile.backgroundUrl',
    'profile.handle',
    'profile.genres',
    'profile.socialLinks.spotify',
    'getExploreFollowState(user, nextProfile.uid)',
    'setExploreFollow(user, profile.uid',
]
for fragment in required:
    if fragment not in text:
        raise RuntimeError(f'apply-975 verification failed: missing {fragment}')

path.write_text(text, encoding='utf-8')
print('apply-975: public profile edit modal + handle/background/genres/social UI applied')

from pathlib import Path

MARKER = '/* SORIDRAW_EXPLORE_SOCIAL_CSS_974 */'
css_path = Path('src/components/explore/explore.css')
css = css_path.read_text(encoding='utf-8')

if MARKER not in css:
    css = f"@import './exploreSocial.css';\n@import './exploreProfileEdit.css';\n{MARKER}\n" + css
    css_path.write_text(css, encoding='utf-8')

page = Path('src/pages/ExplorePage.tsx').read_text(encoding='utf-8')
service = Path('src/services/exploreSocialService.ts').read_text(encoding='utf-8')
social_css = Path('src/components/explore/exploreSocial.css').read_text(encoding='utf-8')
profile_edit_css = Path('src/components/explore/exploreProfileEdit.css').read_text(encoding='utf-8')

required_page = [
    'SORIDRAW_EXPLORE_8E5_SOCIAL_PUBLIC_PROFILE',
    'getExploreLikedTrackIds',
    'setExploreTrackLike',
    'getExplorePublicProfile',
    'getExplorePublicProfileTracks',
    'getExploreFollowState',
    'setExploreFollow',
    "searchParams.get('profile')",
    'soridraw-explore-follow-button',
]
for fragment in required_page:
    if fragment not in page:
        raise RuntimeError(f'apply-974: ExplorePage missing {fragment}')

required_service = [
    '/v1/profiles/',
    '/follow-state',
    '/follow',
    'X-Firebase-AppCheck',
]
for fragment in required_service:
    if fragment not in service:
        raise RuntimeError(f'apply-974: social service missing {fragment}')

if 'MessageCircle' in page or '댓글' in page:
    raise RuntimeError('apply-974: comments must stay excluded from Explore 8-E-5 UI')
if 'border:' in social_css and 'border:0!important' not in social_css:
    raise RuntimeError('apply-974: social UI must not introduce outer borders')
if 'soridraw-explore-profile-edit-modal' not in profile_edit_css or 'border:0!important' not in profile_edit_css:
    raise RuntimeError('apply-974: profile edit CSS missing or borderless contract broken')

print('apply-974: Explore social likes + public profile + follow UI verified')

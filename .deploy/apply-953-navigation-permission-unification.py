from pathlib import Path

MARKER = 'SORIDRAW_NAV_PERMISSION_UNIFICATION_953'


def replace_once(text: str, before: str, after: str, label: str) -> str:
    count = text.count(before)
    if count != 1:
        raise RuntimeError(f'953 {label} anchor mismatch: {count}')
    return text.replace(before, after, 1)


# -----------------------------------------------------------------------------
# 1) Admin App Settings: Explore becomes a first-class menu permission entry.
# Existing Firestore documents that do not contain `explore` are normalized by
# navigationVisibility.ts to the safe default (public), so this is backwards compatible.
# -----------------------------------------------------------------------------
admin_path = Path('src/pages/AdminAppSettingsPage.tsx')
admin = admin_path.read_text(encoding='utf-8')
admin_marker = '// SORIDRAW_NAV_PERMISSION_ADMIN_953'
if admin_marker not in admin:
    admin = replace_once(
        admin,
        "import { FlaskConical, Heart, Home, Library, Loader2, ShieldAlert, SlidersHorizontal, User as UserIcon, Zap } from 'lucide-react';",
        "import { Compass, FlaskConical, Heart, Home, Library, Loader2, ShieldAlert, SlidersHorizontal, User as UserIcon, Zap } from 'lucide-react';",
        'Admin Explore icon import',
    )
    admin = replace_once(
        admin,
        "    { key: 'home', label: '홈', description: '메인 홈 화면과 홈 메뉴를 관리합니다.', icon: Home },\n    { key: 'studio', label: '스튜디오', description: '가사·프롬프트 제작 화면을 관리합니다.', icon: Zap },",
        "    { key: 'home', label: '홈', description: '메인 홈 화면과 홈 메뉴를 관리합니다.', icon: Home },\n    { key: 'explore', label: '익스플로어', description: '공개 음악 탐색과 크리에이터 화면을 관리합니다.', icon: Compass },\n    { key: 'studio', label: '스튜디오', description: '가사·프롬프트 제작 화면을 관리합니다.', icon: Zap },",
        'Admin Explore menu row',
    )
    admin = admin.replace('export default function AdminAppSettingsPage()', admin_marker + '\nexport default function AdminAppSettingsPage()', 1)

for fragment in [
    "{ key: 'explore', label: '익스플로어'",
    'Compass, FlaskConical',
]:
    if fragment not in admin:
        raise RuntimeError(f'953 Admin verification failed: {fragment}')
admin_path.write_text(admin, encoding='utf-8')


# -----------------------------------------------------------------------------
# 2) App navigation is the single permission evaluator. Publish its already
# resolved access result to documentElement so every split/Explore rail can use
# the exact same decision without another Firestore read.
# -----------------------------------------------------------------------------
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')
app_marker = '// SORIDRAW_NAV_PERMISSION_ROOT_STATE_953'
if app_marker not in app:
    can_show_anchor = """  const canShowMenu = (key: NavigationMenuKey) => {
    if (!menuVisibility[key]) return false;
    if (menuAdminOnly[key] && !isAdminUser) return false;
    return true;
  };"""
    if can_show_anchor not in app:
        raise RuntimeError('953 App shared canShowMenu anchor missing')

    root_access_effect = r'''

  // 953: publish the resolved access decision once. Split rails and Explore
  // rails consume this result instead of inventing a second permission path.
  useEffect(() => {
    const root = document.documentElement;
    const accessMap: Array<[string, NavigationMenuKey]> = [
      ['home', 'home'],
      ['explore', 'explore'],
      ['studio', 'studio'],
      ['music-note', 'musicNote'],
      ['library', 'library'],
      ['lab', 'lab'],
      ['my-page', 'myPage'],
    ];

    accessMap.forEach(([datasetKey, menuKey]) => {
      root.setAttribute(`data-soridraw-nav-${datasetKey}`, canShowMenu(menuKey) ? 'show' : 'hide');
    });
  }, [menuVisibility, menuAdminOnly, isAdminUser]);
'''
    app = app.replace(can_show_anchor, can_show_anchor + root_access_effect, 1)
    app = app.replace(can_show_anchor, can_show_anchor, 1)
    marker_index = app.find(root_access_effect)
    app = app[:marker_index] + app_marker + '\n' + app[marker_index:]

app_checks = [
    "['explore', 'explore']",
    "['music-note', 'musicNote']",
    "['library', 'library']",
    "['lab', 'lab']",
    "['my-page', 'myPage']",
    "data-soridraw-nav-${datasetKey}",
]
for fragment in app_checks:
    if fragment not in app:
        raise RuntimeError(f'953 App verification failed: {fragment}')
app_path.write_text(app, encoding='utf-8')


# -----------------------------------------------------------------------------
# 3) Split/Explore left rail: label the entries with the shared menu key.
# CSS below hides only entries whose resolved App access says `hide`.
# Profile trigger stays available for theme/logout, while MyPage-only actions
# inside that menu follow the MyPage access setting.
# -----------------------------------------------------------------------------
rail_path = Path('src/components/studio/StudioLeftRail.tsx')
rail = rail_path.read_text(encoding='utf-8')
rail_marker = '// SORIDRAW_NAV_PERMISSION_RAIL_953'
if rail_marker not in rail:
    rail = replace_once(
        rail,
        "            <button\n              type=\"button\"\n              className={`soridraw-studio-rail-item${activeWorkspace === 'music-note' ? ' is-active' : ''}`}\n              onClick={onMusicNote}",
        "            <button\n              type=\"button\"\n              data-soridraw-menu-access=\"music-note\"\n              className={`soridraw-studio-rail-item${activeWorkspace === 'music-note' ? ' is-active' : ''}`}\n              onClick={onMusicNote}",
        'Music Note rail access key',
    )
    rail = replace_once(
        rail,
        "            <button\n              type=\"button\"\n              className={`soridraw-studio-rail-item${activeWorkspace === 'library' ? ' is-active' : ''}`}\n              onClick={onLibrary}",
        "            <button\n              type=\"button\"\n              data-soridraw-menu-access=\"library\"\n              className={`soridraw-studio-rail-item${activeWorkspace === 'library' ? ' is-active' : ''}`}\n              onClick={onLibrary}",
        'Library rail access key',
    )
    lab_anchor = """            <button
              type="button"
              className="soridraw-studio-rail-item soridraw-studio-rail-bottom-item"
              onClick={onLab}"""
    lab_target = """            <button
              type="button"
              data-soridraw-menu-access="lab"
              className="soridraw-studio-rail-item soridraw-studio-rail-bottom-item"
              onClick={onLab}"""
    rail = replace_once(rail, lab_anchor, lab_target, 'Labs rail access key')

    # MyPage-only actions inside the profile menu. Theme and logout deliberately
    # remain available even if the MyPage page itself is hidden.
    for action in ['onProfile', 'onSettings', 'onPlan', 'onBilling']:
        before = f'<button type="button" role="menuitem" onClick={{() => runMenuAction({action})}}>'
        after = f'<button type="button" role="menuitem" data-soridraw-menu-access="my-page" onClick={{() => runMenuAction({action})}}>'
        rail = replace_once(rail, before, after, f'{action} profile access key')

    rail = rail.replace('export default function StudioLeftRail', rail_marker + '\nexport default function StudioLeftRail', 1)

rail_checks = [
    'data-soridraw-menu-access="music-note"',
    'data-soridraw-menu-access="library"',
    'data-soridraw-menu-access="lab"',
    'data-soridraw-menu-access="my-page"',
]
for fragment in rail_checks:
    if fragment not in rail:
        raise RuntimeError(f'953 rail verification failed: {fragment}')
rail_path.write_text(rail, encoding='utf-8')


# -----------------------------------------------------------------------------
# 4) One common CSS rule family for every large split/Explore rail. No borders.
# -----------------------------------------------------------------------------
css_path = Path('src/components/studio/studioLayout.css')
css = css_path.read_text(encoding='utf-8')
css_marker = '/* SORIDRAW_NAV_PERMISSION_VISIBILITY_953 */'
if css_marker not in css:
    css += r'''

/* SORIDRAW_NAV_PERMISSION_VISIBILITY_953
   App navigation access is the single source of truth in dark/light/split.
   These selectors only mirror its resolved result into split-style left rails. */
:root[data-soridraw-nav-music-note='hide'] [data-soridraw-menu-access='music-note'],
:root[data-soridraw-nav-library='hide'] [data-soridraw-menu-access='library'],
:root[data-soridraw-nav-lab='hide'] [data-soridraw-menu-access='lab'],
:root[data-soridraw-nav-my-page='hide'] [data-soridraw-menu-access='my-page'] {
  display: none !important;
}
'''
css_path.write_text(css, encoding='utf-8')

print('apply-953: Explore settings + shared dark/light/split/mobile navigation permissions verified')

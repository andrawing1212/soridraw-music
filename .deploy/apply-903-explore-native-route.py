from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text(encoding='utf-8')
route_marker = '// SORIDRAW_EXPLORE_NATIVE_ROUTE_903'
nav_marker = '// SORIDRAW_EXPLORE_NATIVE_NAV_8C'
rail_less_marker = '// SORIDRAW_RAILLESS_MOBILE_NAV_8C'


def replace_once(source: str, target: str, label: str) -> None:
    global text
    if source not in text:
        raise RuntimeError(f'apply-903: anchor not found: {label}')
    text = text.replace(source, target, 1)


def add_nav_key_after_map(map_anchor: str, label: str) -> None:
    global text
    map_index = text.find(map_anchor)
    if map_index < 0:
        raise RuntimeError(f'apply-903: map anchor not found: {label}')
    key_index = text.find('key={item.path}', map_index)
    if key_index < 0 or key_index - map_index > 1800:
        raise RuntimeError(f'apply-903: key anchor not found near {label}')
    line_start = text.rfind('\n', 0, key_index) + 1
    line_end = text.find('\n', key_index)
    if line_end < 0:
        raise RuntimeError(f'apply-903: malformed key line near {label}')
    key_line = text[line_start:line_end]
    indent = key_line[:len(key_line) - len(key_line.lstrip())]
    data_line = f'{indent}data-soridraw-nav-key={{item.key}}'
    if data_line in text[line_start:line_end + len(data_line) + 4]:
        return
    text = text[:line_end] + '\n' + data_line + text[line_end:]


# Explore is mounted in the existing App router so every display mode keeps one header owner.
if route_marker not in text:
    lazy_anchor = "const FavoritesPageLazy = lazy(() => import('./pages/FavoritesPage'));\n"
    replace_once(
        lazy_anchor,
        lazy_anchor + "const ExploreShellLazy = lazy(() => import('./components/explore/ExploreShell'));\n" + route_marker + "\n",
        'Explore lazy route import',
    )

    route_anchor = '        <Route path="/studio" element={\n'
    replace_once(
        route_anchor,
        '        <Route path="/explore" element={<ExploreShellLazy />} />\n' + route_anchor,
        'Explore App route',
    )

# Explore is a native nav item shared by desktop/tablet/mobile.
if nav_marker not in text:
    lucide_anchor = "from 'lucide-react';"
    lucide_index = text.find(lucide_anchor)
    if lucide_index < 0:
        raise RuntimeError('apply-903: lucide-react import anchor not found')
    import_line_end = lucide_index + len(lucide_anchor)
    if 'ExploreCompass' not in text:
        text = text[:import_line_end] + "\nimport { Compass as ExploreCompass } from 'lucide-react';" + text[import_line_end:]

    replace_once(
        "  const canShowMenu = (key: NavigationMenuKey) => {\n    if (!menuVisibility[key]) return false;\n    if (menuAdminOnly[key] && !isAdminUser) return false;\n    return true;\n  };",
        "  const canShowMenu = (key: NavigationMenuKey | 'explore') => {\n    if (key === 'explore') return true;\n    if (!menuVisibility[key]) return false;\n    if (menuAdminOnly[key] && !isAdminUser) return false;\n    return true;\n  };",
        'navigation visibility function',
    )

    replace_once(
        "  const allTopNavItems: Array<{ key: NavigationMenuKey; path: string; label: string; icon: React.ElementType; clearSuno?: boolean }> = [\n    { key: 'home', path: '/', label: '홈', icon: HomeIcon },\n    { key: 'studio', path: '/studio', label: '스튜디오', icon: Zap },",
        "  const allTopNavItems: Array<{ key: NavigationMenuKey | 'explore'; path: string; label: string; icon: React.ElementType; clearSuno?: boolean }> = [\n    { key: 'home', path: '/', label: '홈', icon: HomeIcon },\n    { key: 'explore', path: '/explore', label: '익스플로어', icon: ExploreCompass },\n    { key: 'studio', path: '/studio', label: '스튜디오', icon: Zap },",
        'native Explore nav item',
    )

    add_nav_key_after_map('{topNavItems.map((item) => {', 'desktop top navigation')
    add_nav_key_after_map("{topNavItems.filter((item) => item.key !== 'myPage').map((item) => {", 'compact mobile navigation')

    replace_once(
        '          <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">',
        '          <div className="soridraw-compact-nav-scroll flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden">',
        'compact navigation overflow',
    )

    text = text.replace(route_marker, route_marker + "\n" + nav_marker, 1)

# When side rails do not exist (<1100px), every display mode uses the same
# compact top UI. Only split mode is allowed to translate Music Note/Library
# taps into Studio internal workspace changes. Dark/light always use real routes.
if rail_less_marker not in text:
    replace_once(
        "  const isCompactStudioMobileNavigation = studioCompactMobileLayout && Boolean(onStudioWorkspaceSelect);\n  const isCompactStudioRoute = isCompactStudioMobileNavigation && location.pathname === '/studio';",
        "  const isRailLessNavigationViewport = useMediaQuery('(max-width: 1099px)');\n  const isCompactStudioMobileNavigation = isRailLessNavigationViewport;\n  const shouldUseStudioWorkspaceMobileNavigation = displayMode === 'studio-black'\n    && studioCompactMobileLayout\n    && Boolean(onStudioWorkspaceSelect);\n  const isCompactStudioRoute = shouldUseStudioWorkspaceMobileNavigation && location.pathname === '/studio';",
        'rail-less UI versus split workspace routing',
    )

    replace_once(
        "    if (!isCompactStudioMobileNavigation || !onStudioWorkspaceSelect) {\n      goToTopNav(item.path, { clearSuno: item.clearSuno });\n      return;\n    }",
        "    if (!shouldUseStudioWorkspaceMobileNavigation || !onStudioWorkspaceSelect) {\n      goToTopNav(item.path, { clearSuno: item.clearSuno });\n      return;\n    }",
        'normal dark/light route preservation',
    )

    replace_once(
        "{topNavItems.filter((item) => item.key !== 'myPage').map((item) => {",
        "{topNavItems.filter((item) => item.key !== 'myPage' && !(isRailLessNavigationViewport && item.key === 'lab')).map((item) => {",
        'hide Labs from rail-less top navigation',
    )

    mobile_profile_anchor = '''                    {canShowMenu('myPage') && (
                      <button
                        type="button"
                        onClick={() => {
                          navigate('/my-page');
                          setIsProfileOpen(false);
                          setIsExpanded(false);
                        }}
                        className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-black text-white/78 transition-all hover:bg-[#FFB400]/12 hover:text-[#FFB400]"
                      >
                        <UserIcon className="h-5 w-5" />
                        마이페이지
                      </button>
                    )}
                    <div className="my-1 border-t border-white/10" />'''
    mobile_profile_replacement = '''                    {canShowMenu('myPage') && (
                      <button
                        type="button"
                        onClick={() => {
                          navigate('/my-page');
                          setIsProfileOpen(false);
                          setIsExpanded(false);
                        }}
                        className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-black text-white/78 transition-all hover:bg-[#FFB400]/12 hover:text-[#FFB400]"
                      >
                        <UserIcon className="h-5 w-5" />
                        마이페이지
                      </button>
                    )}
                    {isRailLessNavigationViewport && canShowMenu('lab') && (
                      <button
                        type="button"
                        onClick={() => {
                          navigate('/lab');
                          setIsProfileOpen(false);
                          setIsExpanded(false);
                        }}
                        className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-black text-white/78 transition-all hover:bg-[#FFB400]/12 hover:text-[#FFB400]"
                      >
                        <FlaskConical className="h-5 w-5" />
                        실험실
                      </button>
                    )}
                    <div className="my-1 border-t border-white/10" />'''
    replace_once(
        mobile_profile_anchor,
        mobile_profile_replacement,
        'Labs inside rail-less account menu',
    )

    text = text.replace(nav_marker, nav_marker + "\n" + rail_less_marker, 1)

required_fragments = [
    "path=\"/explore\"",
    "{ key: 'home', path: '/', label: '홈', icon: HomeIcon },\n    { key: 'explore', path: '/explore', label: '익스플로어', icon: ExploreCompass },\n    { key: 'studio', path: '/studio', label: '스튜디오', icon: Zap },",
    "soridraw-compact-nav-scroll",
    "const isRailLessNavigationViewport = useMediaQuery('(max-width: 1099px)');",
    "const isCompactStudioMobileNavigation = isRailLessNavigationViewport;",
    "const shouldUseStudioWorkspaceMobileNavigation = displayMode === 'studio-black'",
    "if (!shouldUseStudioWorkspaceMobileNavigation || !onStudioWorkspaceSelect)",
    "isRailLessNavigationViewport && item.key === 'lab'",
    "isRailLessNavigationViewport && canShowMenu('lab')",
]
for fragment in required_fragments:
    if fragment not in text:
        raise RuntimeError(f'apply-903: verification failed: {fragment}')
if text.count("key: 'explore', path: '/explore'") != 1:
    raise RuntimeError('apply-903: Explore native nav item must exist exactly once')
if text.count('data-soridraw-nav-key={item.key}') < 2:
    raise RuntimeError('apply-903: desktop/mobile nav mode keys are incomplete')
if text.count("navigate('/lab')") < 1:
    raise RuntimeError('apply-903: rail-less account Labs action missing')

path.write_text(text, encoding='utf-8')
print('apply-903: Explore nav UI and normal/split routing separation verified')

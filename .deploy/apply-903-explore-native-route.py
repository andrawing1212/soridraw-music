from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text(encoding='utf-8')
route_marker = '// SORIDRAW_EXPLORE_NATIVE_ROUTE_903'
nav_marker = '// SORIDRAW_EXPLORE_NATIVE_NAV_8C'


def replace_once(source: str, target: str, label: str) -> None:
    global text
    if source not in text:
        raise RuntimeError(f'apply-903: anchor not found: {label}')
    text = text.replace(source, target, 1)


# Route: Explore is a normal App route, not a second application shell.
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

# Navigation: use the same native item list for desktop, tablet and compact mobile.
if nav_marker not in text:
    # Use a dedicated alias so this remains safe even if App later imports Compass elsewhere.
    lucide_anchor = "from 'lucide-react';"
    lucide_index = text.find(lucide_anchor)
    if lucide_index < 0:
        raise RuntimeError('apply-903: lucide-react import anchor not found')
    import_line_start = text.rfind('import ', 0, lucide_index)
    import_line_end = lucide_index + len(lucide_anchor)
    lucide_import = text[import_line_start:import_line_end]
    if 'ExploreCompass' not in text:
        text = text[:import_line_end] + "\nimport { Compass as ExploreCompass } from 'lucide-react';" + text[import_line_end:]

    replace_once(
        "  const canShowMenu = (key: NavigationMenuKey) => {\n    if (!menuVisibility[key]) return false;\n    if (menuAdminOnly[key] && !isAdminUser) return false;\n    return true;\n  };",
        "  const canShowMenu = (key: NavigationMenuKey | 'explore') => {\n    if (key === 'explore') return true;\n    if (!menuVisibility[key]) return false;\n    if (menuAdminOnly[key] && !isAdminUser) return false;\n    return true;\n  };",
        'navigation visibility function',
    )

    replace_once(
        "  const allTopNavItems: Array<{ key: NavigationMenuKey; path: string; label: string; icon: React.ElementType; clearSuno?: boolean }> = [\n    { key: 'home', path: '/', label: '홈', icon: HomeIcon },\n    { key: 'studio', path: '/studio', label: '스튜디오', icon: Zap },",
        "  const allTopNavItems: Array<{ key: NavigationMenuKey | 'explore'; path: string; label: string; icon: React.ElementType; clearSuno?: boolean }> = [\n    { key: 'home', path: '/', label: '홈', icon: HomeIcon },\n    { key: 'studio', path: '/studio', label: '스튜디오', icon: Zap },\n    { key: 'explore', path: '/explore', label: '익스플로어', icon: ExploreCompass },",
        'native Explore nav item',
    )

    # Both native maps (desktop and compact mobile/tablet) receive a stable mode key.
    nav_key_anchor = "                  key={item.path}\n"
    nav_key_count = text.count(nav_key_anchor)
    if nav_key_count < 2:
        raise RuntimeError(f'apply-903: expected desktop/mobile nav key anchors, found {nav_key_count}')
    text = text.replace(
        nav_key_anchor,
        "                  key={item.path}\n                  data-soridraw-nav-key={item.key}\n",
        2,
    )

    # Compact navigation keeps its current geometry; when all items do not fit,
    # it becomes horizontally reachable instead of silently clipping later items.
    replace_once(
        '          <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">',
        '          <div className="soridraw-compact-nav-scroll flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden">',
        'compact navigation overflow',
    )

    # The existing compact Studio workspace switch only remaps Studio/Music Note/Library.
    # Explore intentionally falls through to its normal route behavior.
    text = text.replace(
        route_marker,
        route_marker + "\n" + nav_marker,
        1,
    )

# Build-time assertions: fail loudly rather than ship another partial navigation state.
required_fragments = [
    "path=\"/explore\"",
    "key: 'explore', path: '/explore', label: '익스플로어'",
    "data-soridraw-nav-key={item.key}",
    "soridraw-compact-nav-scroll",
]
for fragment in required_fragments:
    if fragment not in text:
        raise RuntimeError(f'apply-903: verification failed: {fragment}')
if text.count("key: 'explore', path: '/explore'") != 1:
    raise RuntimeError('apply-903: Explore native nav item must exist exactly once')
if text.count('data-soridraw-nav-key={item.key}') < 2:
    raise RuntimeError('apply-903: desktop/mobile nav mode keys are incomplete')

path.write_text(text, encoding='utf-8')
print('apply-903: Explore native route + desktop/tablet/mobile navigation verified')

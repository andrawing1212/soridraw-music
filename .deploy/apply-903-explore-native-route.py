from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text(encoding='utf-8')
marker = '// SORIDRAW_EXPLORE_NATIVE_ROUTE_903'

if marker not in text:
    lazy_anchor = "const FavoritesPageLazy = lazy(() => import('./pages/FavoritesPage'));\n"
    if lazy_anchor not in text:
        raise RuntimeError('apply-903: FavoritesPageLazy anchor not found')
    text = text.replace(
        lazy_anchor,
        lazy_anchor + "const ExploreShellLazy = lazy(() => import('./components/explore/ExploreShell'));\n" + f"{marker}\n",
        1,
    )
    route_anchor = '        <Route path="/studio" element={\n'
    if route_anchor not in text:
        raise RuntimeError('apply-903: /studio route anchor not found')
    text = text.replace(route_anchor, '        <Route path="/explore" element={<ExploreShellLazy />} />\n' + route_anchor, 1)
    path.write_text(text, encoding='utf-8')
    print('apply-903: Explore mounted inside native App router')
else:
    print('apply-903: already applied')

lines = text.splitlines()
print('--- EXPLORE 8C NAV MARKUP 3668-3915 START ---')
for n in range(3667, min(len(lines), 3915)):
    print(f'{n+1}: {lines[n]}')
print('--- EXPLORE 8C NAV MARKUP END ---')

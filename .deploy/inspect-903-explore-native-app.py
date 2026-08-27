from pathlib import Path

lines = Path('src/App.tsx').read_text(encoding='utf-8').splitlines()
needles = [
    'type NavigationMenuKey',
    'const DEFAULT_NAVIGATION_VISIBILITY',
    'const DEFAULT_NAVIGATION_ADMIN_ONLY',
    'const allTopNavItems',
    '<StudioPageFrame',
    'workspaceView=',
    "location.pathname === '/studio'",
    "location.pathname === '/history'",
    "location.pathname === '/suno-library'",
    'FavoritesPage',
]

print('--- SORIDRAW 903 APP INSPECT START ---')
for needle in needles:
    hits = [i for i, line in enumerate(lines) if needle in line]
    print(f'--- {needle!r} hits={len(hits)} ---')
    for i in hits[:8]:
        lo = max(0, i - 3)
        hi = min(len(lines), i + 8)
        print(f'--- lines {lo + 1}-{hi} ---')
        for n in range(lo, hi):
            print(f'{n + 1}: {lines[n]}')
print('--- SORIDRAW 903 APP INSPECT END ---')

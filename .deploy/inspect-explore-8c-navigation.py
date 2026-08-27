from pathlib import Path

path = Path('src/App.tsx')
lines = path.read_text(encoding='utf-8').splitlines()
needles = [
    'NavigationMenuKey',
    'navigationVisibility',
    'topNavItems',
    'soridraw-top-navigation',
    'studioCompactMobileLayout',
    'mobileNavigation',
    'MobileNav',
    'bottomNavigation',
    'bottom-nav',
    'isMobile',
]

print('--- EXPLORE 8C NAV INSPECT START ---')
printed = set()
for needle in needles:
    hits = [i for i, line in enumerate(lines) if needle in line]
    print(f'### {needle} hits={len(hits)}')
    for i in hits[:6]:
        key = (max(0, i-4), min(len(lines), i+8))
        if key in printed:
            continue
        printed.add(key)
        print(f'--- lines {key[0]+1}-{key[1]} ---')
        for n in range(key[0], key[1]):
            print(f'{n+1}: {lines[n]}')
print('--- EXPLORE 8C NAV INSPECT END ---')

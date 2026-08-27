from pathlib import Path

text = Path('src/App.tsx').read_text(encoding='utf-8')
patterns = [
    'type NavigationMenuKey',
    'allTopNavItems',
    'topNavItems',
    "path=\"/studio\"",
    "'/studio'",
    'StudioPageFrame',
    'StudioWorkspaceView',
    'studioWorkspaceView',
]

print('--- SORIDRAW 903 APP INSPECT START ---')
seen = set()
for pattern in patterns:
    start = 0
    count = 0
    while count < 4:
        idx = text.find(pattern, start)
        if idx < 0:
            break
        key = (pattern, idx)
        if key not in seen:
            seen.add(key)
            lo = max(0, idx - 900)
            hi = min(len(text), idx + 1800)
            snippet = text[lo:hi]
            print(f'--- PATTERN {pattern!r} @ {idx} ---')
            print(snippet)
        start = idx + len(pattern)
        count += 1
print('--- SORIDRAW 903 APP INSPECT END ---')

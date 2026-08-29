from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text(encoding='utf-8')
lines = text.splitlines()
needles = [
    "collection(db, 'favorites')",
    'collection(db, "favorites")',
    "doc(db, 'favorites'",
    'doc(db, "favorites"',
    'favoriteRemoved',
    'favoriteHidden',
    'trashedAt',
    'unsavedAt',
    'saved: false',
    'saved: true',
    'favoriteCount',
    'onSnapshot(userRef',
    'onSnapshot(doc(db, \'users\'',
    'setUserRole(',
    'setUserPlan(',
    'runV1MutationBoundary',
    'scheduleListBundleWrite',
    'musicNote_latest_20',
    'music_note_latest_20',
]

matches = []
seen = set()
for index, line in enumerate(lines):
    if any(needle in line for needle in needles):
        start = max(0, index - 8)
        end = min(len(lines), index + 14)
        key = (start, end)
        if key in seen:
            continue
        seen.add(key)
        matches.append((start, end))

coalesced = []
for start, end in matches:
    if coalesced and start <= coalesced[-1][1] + 3:
        coalesced[-1] = (coalesced[-1][0], max(coalesced[-1][1], end))
    else:
        coalesced.append((start, end))

print('READ_ONLY_MUSIC_NOTE_MUTATION_PATH_DIAGNOSTIC')
print(f'blocks={len(coalesced)}')
for block_no, (start, end) in enumerate(coalesced, 1):
    print(f'\n--- BLOCK {block_no} lines {start + 1}-{end} ---')
    for line_no in range(start, end):
        raw = lines[line_no]
        print(f'{line_no + 1:06d}: {raw[:260]}')
print('\nSAFETY: source scan only; Firestore reads=0 writes=0 deletes=0 deploys=0')

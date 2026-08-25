from pathlib import Path
import re
import subprocess

expected = {'src/App.tsx', 'src/pages/FavoritesPage.tsx', 'src/pages/SunoLibraryPage.tsx'}
changed = set(subprocess.check_output(['git', 'diff', '--name-only'], text=True).splitlines())
if changed != expected:
    raise SystemExit(f'2-A4b apply scope mismatch: changed={sorted(changed)} expected={sorted(expected)}')

app = Path('src/App.tsx').read_text(encoding='utf-8')
fav = Path('src/pages/FavoritesPage.tsx').read_text(encoding='utf-8')
lib = Path('src/pages/SunoLibraryPage.tsx').read_text(encoding='utf-8')
boundary = Path('src/data/v1MutationBoundary.ts').read_text(encoding='utf-8')

if 'BACKEND_V2_V1_MUTATION_MIRROR_ENABLED = false' not in boundary:
    raise SystemExit('V2 mirror gate is not OFF')
for forbidden in ["from 'firebase", 'from "firebase', 'indexedDbMirrorOutbox', 'v2LiveMutation', 'fetch(', 'axios']:
    if forbidden in boundary:
        raise SystemExit(f'boundary gained forbidden IO/V2 dependency: {forbidden}')

if app.count('runV1MutationBoundary(') != 19:
    raise SystemExit(f'App boundary count mismatch: {app.count("runV1MutationBoundary(")} != 19')
if fav.count('runV1MutationBoundary(') != 4:
    raise SystemExit(f'FavoritesPage boundary count mismatch: {fav.count("runV1MutationBoundary(")} != 4')
if lib.count('runV1MutationBoundary(') != 1:
    raise SystemExit(f'SunoLibraryPage boundary count mismatch: {lib.count("runV1MutationBoundary(")} != 1')

# All eight current Recent content writes must invoke the common boundary on the same expression line.
recent_write_lines = [
    line for line in app.splitlines()
    if 'setDoc(ref,' in line and ('songs:' in line or 'sanitizeForFirestore({ songs:' in line)
]
if len(recent_write_lines) != 8:
    raise SystemExit(f'unexpected current recent write count: {len(recent_write_lines)}')
if any('runV1MutationBoundary(' not in line for line in recent_write_lines):
    raise SystemExit('a current recent content write bypasses the V1 mutation boundary')

# Direct favorites content writes in the three known runtime files must be boundary-associated nearby.
for path, text in [('src/App.tsx', app), ('src/pages/FavoritesPage.tsx', fav), ('src/pages/SunoLibraryPage.tsx', lib)]:
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if not re.search(r"(?:updateDoc|deleteDoc|addDoc)\s*\([^\n]*(?:'favorites'|\"favorites\")", line):
            continue
        window = '\n'.join(lines[max(0, i - 5):min(len(lines), i + 6)])
        if 'runV1MutationBoundary(' not in window:
            raise SystemExit(f'direct favorites write bypass at {path}:{i + 1}: {line.strip()}')

required_ops = [
    "operation: 'clear'", "operation: 'delete-item'", "operation: 'save-batch'",
    "operation: 'regenerate'", "operation: 'add-lyrics-language'", "operation: 'edit'",
    "operation: 'pre-favorite-edit'", "operation: 'save'", "operation: 'restore'",
    "operation: 'unsave'", "operation: 'permanent-delete'", "operation: 'update'",
    "operation: 'recovery-update'", "operation: 'bulk-delete'", "operation: 'bulk-lock'",
    "operation: 'bulk-unlock'", "operation: 'folder-update'", "operation: 'shared-note-save'",
    "operation: 'folder-rename'", "operation: 'folder-delete'", "operation: 'color-sync'",
]
joined = app + '\n' + fav + '\n' + lib
missing = [op for op in required_ops if op not in joined]
if missing:
    raise SystemExit(f'missing mutation operation coverage: {missing}')

for runtime_path, text in [('App', app), ('FavoritesPage', fav), ('SunoLibraryPage', lib)]:
    for forbidden in ['indexedDbMirrorOutbox', 'enqueueMirrorMutation', 'v2LiveMutation', 'createSoridrawSongId']:
        if forbidden in text:
            raise SystemExit(f'{runtime_path} unexpectedly activates Step 2-A4a/V2 runtime: {forbidden}')

print('Step 2-A4b static scope/omission gate PASS: 8 Recent paths + known Music Note mutation categories; mirror OFF')

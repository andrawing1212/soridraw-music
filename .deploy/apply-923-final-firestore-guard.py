from pathlib import Path
import subprocess

MARKER = 'SORIDRAW_923_FINAL_FIRESTORE_GUARD'

library_path = Path('src/pages/SunoLibraryPage.tsx')
library = library_path.read_text(encoding='utf-8')
if MARKER not in library:
    group_pos = library.find("collectionGroup(db, 'tracks')")
    if group_pos >= 0:
        where_pos = library.find("where('isPublic', '==', true)", group_pos)
        close_pos = library.find(');', where_pos)
        if where_pos >= 0 and close_pos >= 0:
            segment = library[group_pos:close_pos]
            if 'limit(' not in segment:
                where_end = where_pos + len("where('isPublic', '==', true)")
                library = library[:where_end] + ',\n        limit(50)' + library[where_end:]
    first_const = library.find('const ')
    if first_const < 0:
        raise SystemExit('923 Library marker anchor missing')
    library = library[:first_const] + f'const {MARKER} = true;\n' + library[first_const:]
    library_path.write_text(library, encoding='utf-8')

app = Path('src/App.tsx').read_text(encoding='utf-8')
for forbidden in [
    "const legacyQuery = query(collection(db, 'favorites'), where('uid', '==', currentUser.uid));",
    "const fullSnapshot = await getDocs(query(collection(db, 'favorites'), where('uid', '==', currentUser.uid)));",
    "limit(100)\n        );\n        addCandidates(recentSnap.docs.map(mapFavoriteFirestoreDoc));",
]:
    if forbidden in app:
        raise SystemExit(f'923 forbidden high-read App path remains: {forbidden[:70]}')

library = library_path.read_text(encoding='utf-8')
if 'const fallbackQuery = query(tracksRef);' in library:
    raise SystemExit('923 unbounded Library fallback remains')

wrapper_path = Path('src/lib/firestoreMeasured.ts').resolve()
for path in Path('src').rglob('*'):
    if path.suffix not in {'.ts', '.tsx'} or path.resolve() == wrapper_path:
        continue
    text = path.read_text(encoding='utf-8')
    if "'firebase/firestore'" in text or '"firebase/firestore"' in text:
        raise SystemExit(f'923 unmeasured Firestore import remains: {path}')

print('SORIDRAW 923 Firestore path verification OK; running strict TypeScript check...')
result = subprocess.run(['npx', 'tsc', '--noEmit'], text=True, capture_output=True)
if result.returncode != 0:
    print(result.stdout)
    print(result.stderr)
    raise SystemExit(f'923 TypeScript check failed: {result.returncode}')
print('SORIDRAW 923 strict TypeScript check OK.')

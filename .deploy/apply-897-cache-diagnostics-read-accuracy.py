from pathlib import Path

MARKER = 'SORIDRAW_897_CACHE_DIAGNOSTICS_READ_ACCURACY'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')
if MARKER not in app:
    app = replace_once(
        app,
        "        markCacheDiagnostic('recentSongs', 'SYNC', 1);",
        "        markCacheDiagnostic('recentSongs', snap.metadata.fromCache ? 'CACHE' : 'SYNC', snap.metadata.fromCache ? 0 : 1);",
        'recent songs metadata accuracy',
    )
    app = replace_once(
        app,
        "          markCacheDiagnostic('musicNote', 'SYNC', snapshot.docs.length);",
        "          markCacheDiagnostic('musicNote', snapshot.metadata.fromCache ? 'CACHE' : 'SYNC', snapshot.metadata.fromCache ? 0 : Math.max(1, snapshot.docChanges().length));",
        'music note metadata accuracy',
    )
    app = app.replace(
        'const SORIDRAW_897_CACHE_DIAGNOSTICS_OVERLAY = true;\n',
        f'const {MARKER} = true;\nconst SORIDRAW_897_CACHE_DIAGNOSTICS_OVERLAY = true;\n',
        1,
    )
    app_path.write_text(app, encoding='utf-8')

library_path = Path('src/pages/SunoLibraryPage.tsx')
library = library_path.read_text(encoding='utf-8')
if MARKER not in library:
    library = replace_once(
        library,
        "        markCacheDiagnostic('library', 'SYNC', docs.length);",
        "        markCacheDiagnostic('library', snapshot.metadata.fromCache ? 'CACHE' : 'SYNC', snapshot.metadata.fromCache ? 0 : Math.max(1, snapshot.docChanges().length));",
        'library metadata accuracy',
    )
    library = library.replace(
        'const SORIDRAW_897_CACHE_DIAGNOSTICS_OVERLAY = true;\n',
        f'const {MARKER} = true;\nconst SORIDRAW_897_CACHE_DIAGNOSTICS_OVERLAY = true;\n',
        1,
    )
    library_path.write_text(library, encoding='utf-8')

print('Applied SORIDRAW 897 accuracy: cache snapshots stay CACHE 0; server listener updates count changed documents with a one-read floor.')

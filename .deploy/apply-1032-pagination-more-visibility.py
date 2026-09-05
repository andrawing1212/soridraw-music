from pathlib import Path

FILES = {
    'src/pages/FavoritesPage.tsx': {
        'marker': 'SORIDRAW_MUSIC_NOTE_MORE_VISIBILITY_1032',
        'old': """    hasMoreFavorites &&\n    filteredFavorites.length >= MUSIC_NOTE_VISIBLE_BATCH_SIZE\n  );""",
        'new': """    hasMoreFavorites\n  );""",
        'marker_anchor': "const MUSIC_NOTE_VISIBLE_BATCH_SIZE = 20;",
    },
    'src/pages/SunoLibraryPage.tsx': {
        'marker': 'SORIDRAW_LIBRARY_MORE_VISIBILITY_1032',
        'old': """    hasMoreWorkspaceServerTracks &&\n    filteredTracks.length >= WORKSPACE_PAGE_SIZE\n  );""",
        'new': """    hasMoreWorkspaceServerTracks\n  );""",
        'marker_anchor': "const WORKSPACE_PAGE_SIZE = 10;",
    },
}

for file_name, cfg in FILES.items():
    path = Path(file_name)
    source = path.read_text(encoding='utf-8')
    if cfg['marker'] in source:
        print(f"{file_name}: 1032 already applied")
        continue
    if cfg['old'] not in source:
        raise SystemExit(f"1032 anchor missing in {file_name}")
    if cfg['marker_anchor'] not in source:
        raise SystemExit(f"1032 marker anchor missing in {file_name}")

    source = source.replace(
        cfg['marker_anchor'],
        cfg['marker_anchor'] + f"\nconst {cfg['marker']} = true;",
        1,
    )
    source = source.replace(cfg['old'], cfg['new'], 1)
    path.write_text(source, encoding='utf-8')
    print(f"{file_name}: applied 1032")

# Safety contract: a server continuation flag is authoritative for button visibility.
# Filtered/visible row count can be below the raw page size because soft-removed,
# trashed, or legacy rows are filtered after a bounded server page is read.
fav = Path('src/pages/FavoritesPage.tsx').read_text(encoding='utf-8')
lib = Path('src/pages/SunoLibraryPage.tsx').read_text(encoding='utf-8')

fav_start = fav.index('  const canRequestMoreMusicNotePage = Boolean(')
fav_end = fav.index('  const shouldShowMusicNoteMoreButton', fav_start)
fav_block = fav[fav_start:fav_end]
if 'hasMoreFavorites' not in fav_block:
    raise SystemExit('1032 Music Note continuation flag missing')
if 'filteredFavorites.length >= MUSIC_NOTE_VISIBLE_BATCH_SIZE' in fav_block:
    raise SystemExit('1032 Music Note visible-count gate still present')

lib_start = lib.index('  const canRequestMoreWorkspacePage = Boolean(')
lib_end = lib.index('  const hasMoreWorkspaceTracks', lib_start)
lib_block = lib[lib_start:lib_end]
if 'hasMoreWorkspaceServerTracks' not in lib_block:
    raise SystemExit('1032 Library continuation flag missing')
if 'filteredTracks.length >= WORKSPACE_PAGE_SIZE' in lib_block:
    raise SystemExit('1032 Library visible-count gate still present')

print('SORIDRAW_1032_MORE_VISIBILITY=PASS')

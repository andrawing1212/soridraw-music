from pathlib import Path


def replace_exact(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one generated boundary, got {count}')
    p.write_text(s.replace(old, new, 1), encoding='utf-8')

replace_exact(
    'src/App.tsx',
    '        const hasCachedMusicNote =\n\n        const hasCachedMusicNote =',
    '        const hasCachedMusicNote =',
    'hasCachedMusicNote boundary',
)
replace_exact(
    'src/App.tsx',
    '        let musicNoteBundleMissingHandled = false;\n\n        let musicNoteBundleMissingHandled = false;',
    '        let musicNoteBundleMissingHandled = false;',
    'bundle missing boundary',
)
replace_exact(
    'src/App.tsx',
    '  const syncMusicNoteIncrementalFromRemoteVersion = useCallback(\n\n  const syncMusicNoteIncrementalFromRemoteVersion = useCallback(',
    '  const syncMusicNoteIncrementalFromRemoteVersion = useCallback(',
    'incremental sync boundary',
)
replace_exact(
    'src/pages/FavoritesPage.tsx',
    '  const musicNoteFilterCount =\n\n  const musicNoteFilterCount =',
    '  const musicNoteFilterCount =',
    'FavoritesPage filter boundary',
)
replace_exact(
    'src/lib/userDataEngine.ts',
    'export const readCatalogSnapshotCacheFirst = async (\n\nexport const readCatalogSnapshotCacheFirst = async (',
    'export const readCatalogSnapshotCacheFirst = async (',
    'catalog cache-first boundary',
)

print('1036 generated boundary syntax normalized')

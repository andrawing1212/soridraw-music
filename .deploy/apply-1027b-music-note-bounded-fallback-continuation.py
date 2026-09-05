from pathlib import Path

path = Path('src/App.tsx')
app = path.read_text(encoding='utf-8')
old = '''    if (favoritePaginationFallbackModeRef.current) {
      console.warn('Music Note legacy compatibility scanner is disabled; keeping persistent cache only.');
      favoritePaginationExhaustedRef.current = true;
      setHasMoreFavorites(false);
      return;
    }
'''
new = '''    if (favoritePaginationFallbackModeRef.current) {
      // The old mode flag may be left by the safe bounded first-page recovery.
      // Continue from its canonical createdAtMs cursor, but never revive the
      // historical multi-page compatibility scanner.
      favoritePaginationFallbackModeRef.current = false;
      favoriteLegacyPaginationCursorRef.current = null;
      favoriteLegacyPaginationExhaustedRef.current = true;
      favoriteLegacyPaginationBufferRef.current = [];
    }
'''
if old not in app:
    if new in app:
        print('1027b already applied')
        raise SystemExit(0)
    raise SystemExit('1027b anchor missing')
app = app.replace(old, new, 1)
path.write_text(app, encoding='utf-8')

block_start = app.index('  const loadMoreFavorites = useCallback(async () => {')
block_end = app.index('  const syncMusicNoteIncrementalFromRemoteVersion = useCallback', block_start)
block = app[block_start:block_end]
assert block.count('await getDocs(') == 1
assert 'while (' not in block
assert 'maxScanPages' not in block
assert 'loadCompatibilityTail' not in block
assert 'keeping persistent cache only' not in block
assert 'favoritePaginationFallbackModeRef.current = false;' in block
print('1027b bounded fallback continuation applied')

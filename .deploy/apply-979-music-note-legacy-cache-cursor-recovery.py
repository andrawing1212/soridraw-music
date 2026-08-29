from pathlib import Path

MARKER = 'SORIDRAW_979_MUSIC_NOTE_LEGACY_CACHE_CURSOR_RECOVERY'
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER in app:
    print('SORIDRAW 979 already applied; no-op')
    raise SystemExit(0)

if 'SORIDRAW_901_MUSIC_NOTE_10_INCREMENTAL_SYNC' not in app:
    raise SystemExit('979 requires SORIDRAW 901 incremental Music Note sync to run first')

before = '''        if (Array.isArray(cachedFavs) && cachedFavs.length > 0) {
          const persistedCursor = readMusicNotePaginationCursor(currentUser.uid);
          favoritePaginationCursorRef.current = persistedCursor;
          favoritePaginationExhaustedRef.current = !persistedCursor;
          setHasMoreFavorites(Boolean(persistedCursor));
          setIsFavoritesLoading(false);
          return;
        }
'''

after = '''        if (Array.isArray(cachedFavs) && cachedFavs.length > 0) {
          const persistedCursor = readMusicNotePaginationCursor(currentUser.uid);
          if (persistedCursor) {
            favoritePaginationCursorRef.current = persistedCursor;
            favoritePaginationExhaustedRef.current = false;
            setHasMoreFavorites(true);
            setIsFavoritesLoading(false);
            return;
          }

          // SORIDRAW_979_MUSIC_NOTE_LEGACY_CACHE_CURSOR_RECOVERY
          // Legacy devices can have a valid local cache created before the cursor
          // storage key existed. Keep the cache visible, but allow the bounded
          // first-page query below to rebuild the 10-item server cursor instead of
          // incorrectly treating pagination as exhausted.
          favoritePaginationCursorRef.current = null;
          favoritePaginationExhaustedRef.current = false;
          setHasMoreFavorites(true);
        }
'''

count = app.count(before)
if count != 1:
    raise SystemExit(f'979 legacy cache cursor anchor mismatch: {count}')

app = app.replace(before, after, 1)
app_path.write_text(app, encoding='utf-8')
print('Applied SORIDRAW 979: legacy Music Note cache without cursor now rebuilds a bounded first-page cursor.')

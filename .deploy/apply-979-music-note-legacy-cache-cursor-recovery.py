from pathlib import Path

MARKER = 'SORIDRAW_979_MUSIC_NOTE_LEGACY_CACHE_CURSOR_RECOVERY'
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER in app:
    print('SORIDRAW 979 already applied; no-op')
    raise SystemExit(0)

if 'SORIDRAW_902_LIST_BUNDLE_CACHE' not in app:
    raise SystemExit('979 requires SORIDRAW 902 list bundle cache to run first')
if 'SORIDRAW_937_MUSIC_NOTE_REFRESH_VERSION_GATE' not in app:
    raise SystemExit('979 requires SORIDRAW 937 Music Note version gate to run first')


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'979 {label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


# Read-only backend diagnostics verified that the live music_note_latest_20 bundle
# exists, hasMore=true and contains a valid cursor. The client bug is therefore
# only metadata hydration: a legacy local cache with no persisted cursor is marked
# exhausted before the healthy bundle is read.
cached_before = '''        const hasCachedMusicNote = Array.isArray(cachedFavs) && cachedFavs.length > 0;
        if (hasCachedMusicNote) {
          const persistedCursor = readMusicNotePaginationCursor(currentUser.uid);
          favoritePaginationCursorRef.current = persistedCursor;
          favoritePaginationExhaustedRef.current = !persistedCursor;
          setHasMoreFavorites(Boolean(persistedCursor));
          setIsFavoritesLoading(false);
        }
'''

cached_after = '''        const hasCachedMusicNote = Array.isArray(cachedFavs) && cachedFavs.length > 0;
        if (hasCachedMusicNote) {
          const persistedCursor = readMusicNotePaginationCursor(currentUser.uid);
          favoritePaginationCursorRef.current = persistedCursor;
          if (persistedCursor) {
            favoritePaginationExhaustedRef.current = false;
            setHasMoreFavorites(true);
            setIsFavoritesLoading(false);
          } else {
            // SORIDRAW_979_MUSIC_NOTE_LEGACY_CACHE_CURSOR_RECOVERY
            // Keep the free local cache visible, but do not declare EOF. The
            // one-document bundle verification below restores hasMore + cursor.
            favoritePaginationExhaustedRef.current = false;
            setHasMoreFavorites(true);
          }
        }
'''
app = replace_once(app, cached_before, cached_after, 'cached branch')

# 937 skips the bundle when content versions match. A missing cursor is pagination
# metadata damage, so it must force the same one-document bundle read even when
# content itself is current.
gate_before = '''        const shouldVerifyMusicNoteBundle = !hasCachedMusicNote
          || musicNoteLocalVersionAtBootstrap <= 0
          || musicNoteRemoteVersionAtBootstrap > musicNoteLocalVersionAtBootstrap;
'''
gate_after = '''        const shouldVerifyMusicNoteBundle = !hasCachedMusicNote
          || !favoritePaginationCursorRef.current
          || musicNoteLocalVersionAtBootstrap <= 0
          || musicNoteRemoteVersionAtBootstrap > musicNoteLocalVersionAtBootstrap;
'''
app = replace_once(app, gate_before, gate_after, '937 version gate')

# Do not alter the fallback/full-scan policies. The verified live bundle is the
# authoritative, bounded recovery source and its existing onData handler already
# restores favoritePaginationCursorRef + hasMore.
if MARKER not in app:
    raise SystemExit('979 safety failed: marker missing')
if '|| !favoritePaginationCursorRef.current' not in app:
    raise SystemExit('979 safety failed: missing-cursor verification gate missing')
if "favoritePaginationCursorRef.current = bundle.cursorCreatedAtMs > 0 ? new Date(bundle.cursorCreatedAtMs) : null;" not in app:
    raise SystemExit('979 safety failed: bundle cursor hydration path missing')
if 'setHasMoreFavorites(bundle.hasMore);' not in app:
    raise SystemExit('979 safety failed: bundle hasMore hydration path missing')

app_path.write_text(app, encoding='utf-8')
print('Applied SORIDRAW 979: missing legacy Music Note cursor now forces one healthy bundle read and restores pagination metadata.')

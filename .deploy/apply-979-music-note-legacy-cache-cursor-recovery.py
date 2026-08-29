from pathlib import Path

MARKER = 'SORIDRAW_979_MUSIC_NOTE_LEGACY_CACHE_CURSOR_RECOVERY'
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER in app:
    print('SORIDRAW 979 already applied; no-op')
    raise SystemExit(0)

if 'SORIDRAW_901_MUSIC_NOTE_10_INCREMENTAL_SYNC' not in app:
    raise SystemExit('979 requires SORIDRAW 901 incremental Music Note sync to run first')
if 'SORIDRAW_902_LIST_BUNDLE_CACHE' not in app:
    raise SystemExit('979 requires SORIDRAW 902 list bundle cache to run first')
if 'SORIDRAW_937_MUSIC_NOTE_REFRESH_VERSION_GATE' not in app:
    raise SystemExit('979 requires SORIDRAW 937 Music Note version gate to run first')


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'979 {label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


# 902 intentionally keeps the bundle listener alive for cached sessions, so the
# final generated shape is `hasCachedMusicNote` rather than the old 901 early-return
# block. A legacy device can still have a valid cache but no persisted cursor. In
# that case do NOT mark pagination exhausted; force one bounded verification path.
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
          if (persistedCursor) {
            favoritePaginationCursorRef.current = persistedCursor;
            favoritePaginationExhaustedRef.current = false;
            setHasMoreFavorites(true);
            setIsFavoritesLoading(false);
          } else {
            // SORIDRAW_979_MUSIC_NOTE_LEGACY_CACHE_CURSOR_RECOVERY
            // Old devices may have a valid local cache from before cursor storage
            // existed. Keep the cache visible, but allow one bounded latest-page
            // verification to rebuild the server cursor instead of declaring EOF.
            favoritePaginationCursorRef.current = null;
            favoritePaginationExhaustedRef.current = false;
            setHasMoreFavorites(true);
          }
        }
'''
app = replace_once(app, cached_before, cached_after, 'cached branch')

# The compatibility source bootstrap must remain disabled for normal cached
# sessions, but a cached session with NO cursor is precisely the recovery case.
app = replace_once(
    app,
    '          if (unsubFavs || hasCachedMusicNote) return;\n',
    '          if (unsubFavs || (hasCachedMusicNote && favoritePaginationCursorRef.current)) return;\n',
    'source bootstrap guard',
)

# 937 normally skips the bundle read when local/remote versions match. Cursor
# recovery is metadata repair, not content sync, so missing cursor must override
# that gate exactly once.
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

# If the bundle document is missing on an old account, do a single bounded source
# page read to rebuild the real Firestore cursor. Do not manufacture a cursor from
# stale local cache and never full-scan the collection.
missing_before = '''            if (hasCachedMusicNote) {
              scheduleListBundleWrite('musicNote', currentUser.uid, cachedFavs, {
                limit: 20,
                hasMore: cachedFavs.length >= 20,
                deletedIds: Array.from(getFavoriteDeletedTombstoneIds(currentUser.uid)),
              });
              setIsFavoritesLoading(false);
              return;
            }
            attachFavoritesSourceBootstrap902();
'''
missing_after = '''            if (hasCachedMusicNote) {
              if (!favoritePaginationCursorRef.current) {
                attachFavoritesSourceBootstrap902();
                return;
              }
              scheduleListBundleWrite('musicNote', currentUser.uid, cachedFavs, {
                limit: 20,
                hasMore: cachedFavs.length >= 20,
                deletedIds: Array.from(getFavoriteDeletedTombstoneIds(currentUser.uid)),
              });
              setIsFavoritesLoading(false);
              return;
            }
            attachFavoritesSourceBootstrap902();
'''
app = replace_once(app, missing_before, missing_after, 'bundle missing recovery')

app = replace_once(
    app,
    '            if (!hasCachedMusicNote) attachFavoritesSourceBootstrap902();\n',
    '            if (!hasCachedMusicNote || !favoritePaginationCursorRef.current) attachFavoritesSourceBootstrap902();\n',
    'bundle error recovery',
)

# Safety: recovery must stay bounded and must not reintroduce a collection-wide
# favorites read. Existing 921 source bootstrap uses FAVORITES_PAGE_SIZE only.
if 'if (unsubFavs || (hasCachedMusicNote && favoritePaginationCursorRef.current)) return;' not in app:
    raise SystemExit('979 safety failed: bounded source recovery guard missing')
if '|| !favoritePaginationCursorRef.current' not in app:
    raise SystemExit('979 safety failed: missing-cursor verification gate missing')
if MARKER not in app:
    raise SystemExit('979 safety failed: marker missing')

app_path.write_text(app, encoding='utf-8')
print('Applied SORIDRAW 979: legacy cached Music Note sessions rebuild a missing cursor with one bounded source-page verification.')

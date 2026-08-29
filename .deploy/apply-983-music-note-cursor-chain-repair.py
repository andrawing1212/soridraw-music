from pathlib import Path

MARKER = 'SORIDRAW_983_MUSIC_NOTE_CURSOR_CHAIN_REPAIR'
app_path = Path('src/App.tsx')
favorites_path = Path('src/pages/FavoritesPage.tsx')
app = app_path.read_text(encoding='utf-8')
favorites = favorites_path.read_text(encoding='utf-8')

if MARKER in app and MARKER in favorites:
    print('SORIDRAW 983 already applied; no-op')
    raise SystemExit(0)

if 'SORIDRAW_981_MUSIC_NOTE_LOAD_MORE_SELF_HEAL' not in app:
    raise SystemExit('983 requires SORIDRAW 981 to run first')
if 'SORIDRAW_982_MUSIC_NOTE_LOADED_METADATA_HYDRATION' not in app:
    raise SystemExit('983 requires SORIDRAW 982 to run first')


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'983 {label} anchor mismatch: {count}')
    return source.replace(before, after, 1)

# The page can display a newer local latest-20 cache while the bundle cursor still
# points to an older historical page. In that state, loadMore jumps months backward.
# Repair the chain once per app session by resolving the cursor from the canonical
# first Firestore page itself, then continue normal startAfter pagination.
anchor_before = '''  const favoritePaginationLoadingRef = useRef(false);\n  const favoritePaginationExhaustedRef = useRef(false);\n  const favoritePaginationFallbackModeRef = useRef(false);\n'''
anchor_after = '''  const favoritePaginationLoadingRef = useRef(false);\n  const favoritePaginationExhaustedRef = useRef(false);\n  const favoritePaginationFallbackModeRef = useRef(false);\n  // SORIDRAW_983_MUSIC_NOTE_CURSOR_CHAIN_REPAIR\n  const favoritePaginationCanonicalAnchorVerifiedRef = useRef(false);\n'''
app = replace_once(app, anchor_before, anchor_after, 'pagination refs')

load_start = app.index('  const loadMoreFavorites = useCallback(async () => {')
load_end = app.index('  const syncMusicNoteIncrementalFromRemoteVersion = useCallback', load_start)
load_block = app[load_start:load_end]

# Insert canonical first-page verification immediately after uid/loading guards and
# before 981 can trust the existing bundle cursor. This costs at most one 21-row
# read per app session and never scans the full favorites collection.
verify_before = '''    if (!currentUser?.uid) return;\n    if (favoritePaginationLoadingRef.current) return;\n\n    // SORIDRAW_981_MUSIC_NOTE_LOAD_MORE_SELF_HEAL\n    let cursor = favoritePaginationCursorRef.current;\n'''
verify_after = '''    if (!currentUser?.uid) return;\n    if (favoritePaginationLoadingRef.current) return;\n\n    // SORIDRAW_983_MUSIC_NOTE_CURSOR_CHAIN_REPAIR\n    // Never allow a historical bundle cursor to decide where page 2 starts. The\n    // first click verifies the canonical latest page and uses its 20th document\n    // as the exact continuation anchor. Subsequent clicks keep the normal cursor.\n    if (!favoritePaginationCanonicalAnchorVerifiedRef.current) {\n      favoritePaginationLoadingRef.current = true;\n      try {\n        const canonicalFirstPageQuery = query(\n          collection(db, 'favorites'),\n          where('userId', '==', currentUser.uid),\n          orderBy('createdAt', 'desc'),\n          limit(FAVORITES_PAGE_SIZE + 1)\n        );\n        const canonicalSnapshot = await getDocs(canonicalFirstPageQuery);\n        const canonicalDocs = canonicalSnapshot.docs.slice(0, FAVORITES_PAGE_SIZE);\n        const canonicalFavs = canonicalDocs.map(mapFavoriteFirestoreDoc);\n\n        if (canonicalDocs.length === 0) {\n          favoritePaginationCursorRef.current = null;\n          favoritePaginationExhaustedRef.current = true;\n          favoritePaginationFallbackModeRef.current = false;\n          setHasMoreFavorites(false);\n          favoritePaginationCanonicalAnchorVerifiedRef.current = true;\n          return;\n        }\n\n        const canonicalCursorDoc = canonicalDocs[canonicalDocs.length - 1];\n        favoritePaginationCursorRef.current = canonicalCursorDoc;\n        favoritePaginationExhaustedRef.current = canonicalSnapshot.docs.length <= FAVORITES_PAGE_SIZE;\n        favoritePaginationFallbackModeRef.current = false;\n        setHasMoreFavorites(canonicalSnapshot.docs.length > FAVORITES_PAGE_SIZE);\n        favoritePaginationCanonicalAnchorVerifiedRef.current = true;\n\n        // Replace only the visible first-page portion with canonical server rows,\n        // preserving any already-loaded older rows until page 2 is appended. This\n        // also hydrates saved colour/Suno metadata for the initial latest-20 rows.\n        setFavorites((prev) => {\n          const previous = Array.isArray(prev) ? prev : [];\n          const canonicalIds = new Set(canonicalFavs.map((favorite: any) => String(favorite?.id || '')));\n          const retainedOlder = previous.filter((favorite: any) => !canonicalIds.has(String(favorite?.id || '')));\n          const merged = mergeFavoritePages(canonicalFavs, retainedOlder);\n          writeFavoritesCache(currentUser.uid, merged);\n          favoritesStore.setFavorites(merged);\n          return merged;\n        });\n\n        if (typeof window !== 'undefined' && canonicalFavs.length > 0) {\n          const canonicalMetadata = canonicalFavs.map((favorite: any) => ({\n            id: String(favorite?.id || ''),\n            favoriteColorTag: favorite?.favoriteColorTag,\n            colorTag: favorite?.colorTag,\n            sunoLinks: favorite?.sunoLinks,\n            sunoShareLinks: favorite?.sunoShareLinks,\n            sunoShareUrl: favorite?.sunoShareUrl,\n            sunoUrl: favorite?.sunoUrl,\n            sunoSongUrl: favorite?.sunoSongUrl,\n            mainSunoIndex: favorite?.mainSunoIndex,\n            sunoLinkCount: favorite?.sunoLinkCount,\n            sunoCoverUrl: favorite?.sunoCoverUrl,\n            sunoTitle: favorite?.sunoTitle,\n            sunoDurationSeconds: favorite?.sunoDurationSeconds,\n            sunoDurationText: favorite?.sunoDurationText,\n            sunoCoverFetchedAt: favorite?.sunoCoverFetchedAt,\n            sunoShareUrlUpdatedAt: favorite?.sunoShareUrlUpdatedAt,\n          })).filter((item: any) => Boolean(item.id));\n          window.dispatchEvent(new CustomEvent('soridraw:music-note-page-metadata', { detail: { items: canonicalMetadata } }));\n        }\n\n        markCacheDiagnostic('musicNote', 'SYNC', canonicalSnapshot.docs.length);\n      } catch (canonicalError) {\n        console.warn('Music Note canonical first-page cursor verification failed.', canonicalError);\n        favoritePaginationCanonicalAnchorVerifiedRef.current = false;\n        setHasMoreFavorites(true);\n        return;\n      } finally {\n        favoritePaginationLoadingRef.current = false;\n      }\n    }\n\n    // SORIDRAW_981_MUSIC_NOTE_LOAD_MORE_SELF_HEAL\n    let cursor = favoritePaginationCursorRef.current;\n'''
load_block = replace_once(load_block, verify_before, verify_after, 'canonical first-page verification')
app = app[:load_start] + load_block + app[load_end:]

# Reset the one-session canonical anchor whenever the signed-in account changes so
# a cursor from one user can never carry into another user's Music Note session.
reset_before = '''        favoritePaginationCursorRef.current = null;\n        favoritePaginationExhaustedRef.current = false;\n        favoritePaginationFallbackModeRef.current = false;\n'''
reset_after = '''        favoritePaginationCursorRef.current = null;\n        favoritePaginationExhaustedRef.current = false;\n        favoritePaginationFallbackModeRef.current = false;\n        favoritePaginationCanonicalAnchorVerifiedRef.current = false;\n'''
if reset_before in app:
    app = app.replace(reset_before, reset_after, 1)

# Marker in FavoritesPage keeps build verification explicit without altering UI.
if MARKER not in favorites:
    marker_anchor = 'const SORIDRAW_982_MUSIC_NOTE_LOADED_METADATA_HYDRATION = true;\n'
    if marker_anchor in favorites:
        favorites = favorites.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)
    else:
        # 982 marker can live as an inline comment rather than a const depending on
        # generated source shape; add a harmless module-level marker near imports.
        first_import_end = favorites.find('\n', favorites.find('import '))
        if first_import_end < 0:
            raise SystemExit('983 Favorites marker anchor missing')
        favorites = favorites[:first_import_end + 1] + f'const {MARKER} = true;\n' + favorites[first_import_end + 1:]

required_app = [
    MARKER,
    'favoritePaginationCanonicalAnchorVerifiedRef',
    "collection(db, 'favorites')",
    "where('userId', '==', currentUser.uid)",
    "orderBy('createdAt', 'desc')",
    'limit(FAVORITES_PAGE_SIZE + 1)',
    'favoritePaginationCursorRef.current = canonicalCursorDoc',
    "new CustomEvent('soridraw:music-note-page-metadata'",
]
for fragment in required_app:
    if fragment not in app:
        raise SystemExit(f'983 App safety failed: missing {fragment}')
if MARKER not in favorites:
    raise SystemExit('983 Favorites safety failed: marker missing')

app_path.write_text(app, encoding='utf-8')
favorites_path.write_text(favorites, encoding='utf-8')
print('Applied SORIDRAW 983: Music Note page 2 now anchors to the canonical latest-20 server page and hydrates initial colour/Suno metadata without full scans or writes.')

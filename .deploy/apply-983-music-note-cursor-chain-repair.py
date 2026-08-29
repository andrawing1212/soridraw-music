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


# Insert 983 session state at a stable anchor that is created by the existing
# pagination build chain itself. Tracking uid here prevents one account's verified
# cursor from being reused after an in-app account switch.
load_anchor = '  const loadMoreFavorites = useCallback(async () => {'
load_state = '''  // SORIDRAW_983_MUSIC_NOTE_CURSOR_CHAIN_REPAIR
  const favoritePaginationCanonicalAnchorVerifiedRef = useRef(false);
  const favoritePaginationCanonicalAnchorUidRef = useRef('');

  const loadMoreFavorites = useCallback(async () => {'''
app = replace_once(app, load_anchor, load_state, 'loadMore state anchor')

load_start = app.index('  const loadMoreFavorites = useCallback(async () => {')
load_end = app.index('  const syncMusicNoteIncrementalFromRemoteVersion = useCallback', load_start)
load_block = app[load_start:load_end]

# Preserve canonical saved metadata directly from each Firestore page. This makes
# colour/Suno restoration independent of any legacy mapper fields that may omit an
# optional property. It is still read-only; no Firestore writes are added.
next_map_before = '''      const nextDocs = snapshot.docs.slice(0, FAVORITES_PAGE_SIZE);\n      const nextFavs = nextDocs.map(mapFavoriteFirestoreDoc);\n'''
next_map_after = '''      const nextDocs = snapshot.docs.slice(0, FAVORITES_PAGE_SIZE);\n      const nextFavs = nextDocs.map((docSnap: any) => {\n        const mapped: any = mapFavoriteFirestoreDoc(docSnap);\n        const raw: any = docSnap.data?.() || {};\n        return {\n          ...mapped,\n          favoriteColorTag: raw.favoriteColorTag ?? mapped?.favoriteColorTag,\n          colorTag: raw.colorTag ?? mapped?.colorTag,\n          sunoLinks: raw.sunoLinks ?? mapped?.sunoLinks,\n          sunoShareLinks: raw.sunoShareLinks ?? mapped?.sunoShareLinks,\n          sunoShareUrl: raw.sunoShareUrl ?? mapped?.sunoShareUrl,\n          sunoUrl: raw.sunoUrl ?? mapped?.sunoUrl,\n          sunoSongUrl: raw.sunoSongUrl ?? mapped?.sunoSongUrl,\n          mainSunoIndex: raw.mainSunoIndex ?? mapped?.mainSunoIndex,\n          sunoLinkCount: raw.sunoLinkCount ?? mapped?.sunoLinkCount,\n          sunoCoverUrl: raw.sunoCoverUrl ?? mapped?.sunoCoverUrl,\n          sunoTitle: raw.sunoTitle ?? mapped?.sunoTitle,\n          sunoDurationSeconds: raw.sunoDurationSeconds ?? mapped?.sunoDurationSeconds,\n          sunoDurationText: raw.sunoDurationText ?? mapped?.sunoDurationText,\n          sunoCoverFetchedAt: raw.sunoCoverFetchedAt ?? mapped?.sunoCoverFetchedAt,\n          sunoShareUrlUpdatedAt: raw.sunoShareUrlUpdatedAt ?? mapped?.sunoShareUrlUpdatedAt,\n        };\n      });\n'''
load_block = replace_once(load_block, next_map_before, next_map_after, 'paged raw metadata preservation')

verify_before = '''    if (!currentUser?.uid) return;\n    if (favoritePaginationLoadingRef.current) return;\n\n    // SORIDRAW_981_MUSIC_NOTE_LOAD_MORE_SELF_HEAL\n    let cursor = favoritePaginationCursorRef.current;\n'''
verify_after = '''    if (!currentUser?.uid) return;\n    if (favoritePaginationLoadingRef.current) return;\n\n    if (favoritePaginationCanonicalAnchorUidRef.current !== currentUser.uid) {\n      favoritePaginationCanonicalAnchorUidRef.current = currentUser.uid;\n      favoritePaginationCanonicalAnchorVerifiedRef.current = false;\n    }\n\n    // SORIDRAW_983_MUSIC_NOTE_CURSOR_CHAIN_REPAIR\n    // The visible latest 20 and the old list-bundle cursor can describe different\n    // moments in time. On the first More click, rebuild page 1 from canonical\n    // Firestore and derive page 2 from its real 20th document. This bounded query\n    // reads at most 21 favorites and never scans or mutates the collection.\n    if (!favoritePaginationCanonicalAnchorVerifiedRef.current) {\n      favoritePaginationLoadingRef.current = true;\n      try {\n        const canonicalFirstPageQuery = query(\n          collection(db, 'favorites'),\n          where('uid', '==', currentUser.uid),\n          orderBy('createdAt', 'desc'),\n          limit(FAVORITES_PAGE_SIZE + 1)\n        );\n        const canonicalSnapshot = await getDocs(canonicalFirstPageQuery);\n        const canonicalDocs = canonicalSnapshot.docs.slice(0, FAVORITES_PAGE_SIZE);\n        const canonicalFavs = canonicalDocs.map((docSnap: any) => {\n          const mapped: any = mapFavoriteFirestoreDoc(docSnap);\n          const raw: any = docSnap.data?.() || {};\n          return {\n            ...mapped,\n            favoriteColorTag: raw.favoriteColorTag ?? mapped?.favoriteColorTag,\n            colorTag: raw.colorTag ?? mapped?.colorTag,\n            sunoLinks: raw.sunoLinks ?? mapped?.sunoLinks,\n            sunoShareLinks: raw.sunoShareLinks ?? mapped?.sunoShareLinks,\n            sunoShareUrl: raw.sunoShareUrl ?? mapped?.sunoShareUrl,\n            sunoUrl: raw.sunoUrl ?? mapped?.sunoUrl,\n            sunoSongUrl: raw.sunoSongUrl ?? mapped?.sunoSongUrl,\n            mainSunoIndex: raw.mainSunoIndex ?? mapped?.mainSunoIndex,\n            sunoLinkCount: raw.sunoLinkCount ?? mapped?.sunoLinkCount,\n            sunoCoverUrl: raw.sunoCoverUrl ?? mapped?.sunoCoverUrl,\n            sunoTitle: raw.sunoTitle ?? mapped?.sunoTitle,\n            sunoDurationSeconds: raw.sunoDurationSeconds ?? mapped?.sunoDurationSeconds,\n            sunoDurationText: raw.sunoDurationText ?? mapped?.sunoDurationText,\n            sunoCoverFetchedAt: raw.sunoCoverFetchedAt ?? mapped?.sunoCoverFetchedAt,\n            sunoShareUrlUpdatedAt: raw.sunoShareUrlUpdatedAt ?? mapped?.sunoShareUrlUpdatedAt,\n          };\n        });\n\n        if (canonicalDocs.length === 0) {\n          favoritePaginationCursorRef.current = null;\n          favoritePaginationExhaustedRef.current = true;\n          favoritePaginationFallbackModeRef.current = false;\n          setHasMoreFavorites(false);\n          favoritePaginationCanonicalAnchorVerifiedRef.current = true;\n          setFavorites([]);\n          favoritesStore.setFavorites([]);\n          return;\n        }\n\n        const canonicalCursorDoc = canonicalDocs[canonicalDocs.length - 1];\n        favoritePaginationCursorRef.current = canonicalCursorDoc;\n        favoritePaginationExhaustedRef.current = canonicalSnapshot.docs.length <= FAVORITES_PAGE_SIZE;\n        favoritePaginationFallbackModeRef.current = false;\n        setHasMoreFavorites(canonicalSnapshot.docs.length > FAVORITES_PAGE_SIZE);\n        favoritePaginationCanonicalAnchorVerifiedRef.current = true;\n\n        // Remove the stale locally-paged June rows before rebuilding the chain.\n        // Only client list state changes here; canonical Firestore favorites remain\n        // untouched. The same click continues below and appends true page 2.\n        setFavorites(canonicalFavs);\n        favoritesStore.setFavorites(canonicalFavs);\n\n        // 982 handled later pages; hydrate the canonical first 20 as well.\n        if (typeof window !== 'undefined' && canonicalFavs.length > 0) {\n          const canonicalMetadata = canonicalFavs.map((favorite: any) => ({\n            id: String(favorite?.id || ''),\n            favoriteColorTag: favorite?.favoriteColorTag,\n            colorTag: favorite?.colorTag,\n            sunoLinks: favorite?.sunoLinks,\n            sunoShareLinks: favorite?.sunoShareLinks,\n            sunoShareUrl: favorite?.sunoShareUrl,\n            sunoUrl: favorite?.sunoUrl,\n            sunoSongUrl: favorite?.sunoSongUrl,\n            mainSunoIndex: favorite?.mainSunoIndex,\n            sunoLinkCount: favorite?.sunoLinkCount,\n            sunoCoverUrl: favorite?.sunoCoverUrl,\n            sunoTitle: favorite?.sunoTitle,\n            sunoDurationSeconds: favorite?.sunoDurationSeconds,\n            sunoDurationText: favorite?.sunoDurationText,\n            sunoCoverFetchedAt: favorite?.sunoCoverFetchedAt,\n            sunoShareUrlUpdatedAt: favorite?.sunoShareUrlUpdatedAt,\n          })).filter((item: any) => Boolean(item.id));\n          window.dispatchEvent(new CustomEvent('soridraw:music-note-page-metadata', { detail: { items: canonicalMetadata } }));\n        }\n\n        markCacheDiagnostic('musicNote', 'SYNC', canonicalSnapshot.docs.length);\n      } catch (canonicalError) {\n        console.warn('Music Note canonical first-page cursor verification failed.', canonicalError);\n        favoritePaginationCanonicalAnchorVerifiedRef.current = false;\n        favoritePaginationExhaustedRef.current = false;\n        setHasMoreFavorites(true);\n        return;\n      } finally {\n        favoritePaginationLoadingRef.current = false;\n      }\n    }\n\n    // SORIDRAW_981_MUSIC_NOTE_LOAD_MORE_SELF_HEAL\n    let cursor = favoritePaginationCursorRef.current;\n'''
load_block = replace_once(load_block, verify_before, verify_after, 'canonical first-page verification')
app = app[:load_start] + load_block + app[load_end:]

# Keep build verification explicit without changing visible FavoritesPage UI.
if MARKER not in favorites:
    color_resolver_anchor = '  const getFavoriteColorValue = (song: any): string => {'
    color_resolver_marked = f'  // {MARKER}\n' + color_resolver_anchor
    favorites = replace_once(favorites, color_resolver_anchor, color_resolver_marked, 'Favorites marker')

required_app = [
    MARKER,
    'favoritePaginationCanonicalAnchorVerifiedRef',
    'favoritePaginationCanonicalAnchorUidRef',
    "collection(db, 'favorites')",
    "where('uid', '==', currentUser.uid)",
    "orderBy('createdAt', 'desc')",
    'limit(FAVORITES_PAGE_SIZE + 1)',
    'favoritePaginationCursorRef.current = canonicalCursorDoc',
    'setFavorites(canonicalFavs);',
    'favoriteColorTag: raw.favoriteColorTag',
    'sunoLinks: raw.sunoLinks',
    "new CustomEvent('soridraw:music-note-page-metadata'",
]
for fragment in required_app:
    if fragment not in app:
        raise SystemExit(f'983 App safety failed: missing {fragment}')
if "where('userId', '==', currentUser.uid)" in app[load_start:load_end]:
    raise SystemExit('983 safety failed: wrong userId query remains in loadMore block')
if MARKER not in favorites:
    raise SystemExit('983 Favorites safety failed: marker missing')

app_path.write_text(app, encoding='utf-8')
favorites_path.write_text(favorites, encoding='utf-8')
print('Applied SORIDRAW 983: canonical latest-20 cursor chain + raw saved colour/Suno metadata restoration, with no full scan or Firestore mutation.')

from pathlib import Path

MARKER = 'SORIDRAW_982_MUSIC_NOTE_LOADED_METADATA_HYDRATION'
app_path = Path('src/App.tsx')
favorites_path = Path('src/pages/FavoritesPage.tsx')
app = app_path.read_text(encoding='utf-8')
favorites = favorites_path.read_text(encoding='utf-8')

if MARKER in app and MARKER in favorites:
    print('SORIDRAW 982 already applied; no-op')
    raise SystemExit(0)

if 'SORIDRAW_981_MUSIC_NOTE_LOAD_MORE_SELF_HEAL' not in app or 'SORIDRAW_981_MUSIC_NOTE_LOAD_MORE_SELF_HEAL' not in favorites:
    raise SystemExit('982 requires SORIDRAW 981 to run first')


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'982 {label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


# 1) Preserve the canonical metadata from each newly fetched Firestore page in a
# page-local event. This is read/display-only: it performs no Firestore write and
# carries only the metadata needed by card colour/Suno URL UI.
app_before = '''      const nextDocs = snapshot.docs.slice(0, FAVORITES_PAGE_SIZE);\n      const nextFavs = nextDocs.map(mapFavoriteFirestoreDoc);\n      if (nextDocs.length > 0) {\n'''
app_after = '''      const nextDocs = snapshot.docs.slice(0, FAVORITES_PAGE_SIZE);\n      const nextFavs = nextDocs.map(mapFavoriteFirestoreDoc);\n\n      // SORIDRAW_982_MUSIC_NOTE_LOADED_METADATA_HYDRATION\n      // Newly paged Music Note rows can arrive before the deferred local cache write.\n      // Forward only their canonical UI metadata so colour/Suno controls hydrate immediately.\n      if (typeof window !== 'undefined' && nextFavs.length > 0) {\n        const pageMetadata = nextFavs.map((favorite: any) => ({\n          id: String(favorite?.id || ''),\n          favoriteColorTag: favorite?.favoriteColorTag,\n          colorTag: favorite?.colorTag,\n          sunoLinks: favorite?.sunoLinks,\n          sunoShareLinks: favorite?.sunoShareLinks,\n          sunoShareUrl: favorite?.sunoShareUrl,\n          sunoUrl: favorite?.sunoUrl,\n          sunoSongUrl: favorite?.sunoSongUrl,\n          mainSunoIndex: favorite?.mainSunoIndex,\n          sunoLinkCount: favorite?.sunoLinkCount,\n          sunoCoverUrl: favorite?.sunoCoverUrl,\n          sunoTitle: favorite?.sunoTitle,\n          sunoDurationSeconds: favorite?.sunoDurationSeconds,\n          sunoDurationText: favorite?.sunoDurationText,\n          sunoCoverFetchedAt: favorite?.sunoCoverFetchedAt,\n          sunoShareUrlUpdatedAt: favorite?.sunoShareUrlUpdatedAt,\n        })).filter((item: any) => Boolean(item.id));\n        window.dispatchEvent(new CustomEvent('soridraw:music-note-page-metadata', { detail: { items: pageMetadata } }));\n      }\n\n      if (nextDocs.length > 0) {\n'''
app = replace_once(app, app_before, app_after, 'App loadMore metadata event')

# 2) Keep an in-memory metadata overlay for just-paged rows. This specifically
# bridges the small timing window between server page arrival and deferred cache persistence.
state_before = '''  const [favoriteColorMap, setFavoriteColorMap] = useState<Record<string, string>>({});\n  const [activeFavoriteColorMenuId, setActiveFavoriteColorMenuId] = useState<string | null>(null);\n'''
state_after = '''  const [favoriteColorMap, setFavoriteColorMap] = useState<Record<string, string>>({});\n  // SORIDRAW_982_MUSIC_NOTE_LOADED_METADATA_HYDRATION\n  const loadedFavoriteMetadataRef = useRef<Record<string, any>>({});\n  const [, setLoadedFavoriteMetadataVersion] = useState(0);\n  const [activeFavoriteColorMenuId, setActiveFavoriteColorMenuId] = useState<string | null>(null);\n'''
favorites = replace_once(favorites, state_before, state_after, 'Favorites metadata state')

# 3) Colour resolution: local user choice wins; then the current song object;
# only if that field is absent do we use the just-loaded server metadata overlay.
color_before = '''  const getFavoriteColorValue = (song: any): string => {\n    return favoriteColorMap[song?.id] || song?.favoriteColorTag || song?.colorTag || 'gray';\n  };\n'''
color_after = '''  const getFavoriteColorValue = (song: any): string => {\n    const songId = String(song?.id || '');\n    const loaded = loadedFavoriteMetadataRef.current[songId] || {};\n    const hasSongColorField = Boolean(song && (\n      Object.prototype.hasOwnProperty.call(song, 'favoriteColorTag')\n      || Object.prototype.hasOwnProperty.call(song, 'colorTag')\n    ));\n    const serverColor = hasSongColorField\n      ? (song?.favoriteColorTag || song?.colorTag)\n      : (loaded?.favoriteColorTag || loaded?.colorTag);\n    return favoriteColorMap[songId] || serverColor || 'gray';\n  };\n'''
favorites = replace_once(favorites, color_before, color_after, 'Favorites colour resolver')

# 4) Suno URL resolution uses the same overlay only when the current song object
# does not own the corresponding field. Explicit []/null after a user removal is
# therefore respected and can never resurrect a deleted URL.
suno_before = '''  const getFavoriteSunoLinks = (song: any): FavoriteSunoLink[] => {\n    const rawLinks = Array.isArray(song?.sunoLinks)\n      ? song.sunoLinks\n      : Array.isArray(song?.sunoShareLinks)\n        ? song.sunoShareLinks\n        : [];\n\n    const list = rawLinks.map((link: any, index: number) => normalizeFavoriteSunoLink(link, index)).filter(Boolean) as FavoriteSunoLink[];\n\n    if (list.length > 0) return list.slice(0, 2);\n\n    const legacyUrl = String(song?.sunoShareUrl || song?.sunoUrl || song?.sunoSongUrl || '').trim();\n'''
suno_after = '''  const getFavoriteSunoLinks = (song: any): FavoriteSunoLink[] => {\n    const songId = String(song?.id || '');\n    const loaded = loadedFavoriteMetadataRef.current[songId] || {};\n    const hasSongLinksField = Boolean(song && (\n      Object.prototype.hasOwnProperty.call(song, 'sunoLinks')\n      || Object.prototype.hasOwnProperty.call(song, 'sunoShareLinks')\n    ));\n    const rawLinks = hasSongLinksField\n      ? (Array.isArray(song?.sunoLinks) ? song.sunoLinks : (Array.isArray(song?.sunoShareLinks) ? song.sunoShareLinks : []))\n      : (Array.isArray(loaded?.sunoLinks) ? loaded.sunoLinks : (Array.isArray(loaded?.sunoShareLinks) ? loaded.sunoShareLinks : []));\n\n    const list = rawLinks.map((link: any, index: number) => normalizeFavoriteSunoLink(link, index)).filter(Boolean) as FavoriteSunoLink[];\n\n    if (list.length > 0) return list.slice(0, 2);\n\n    const hasSongLegacyUrlField = Boolean(song && (\n      Object.prototype.hasOwnProperty.call(song, 'sunoShareUrl')\n      || Object.prototype.hasOwnProperty.call(song, 'sunoUrl')\n      || Object.prototype.hasOwnProperty.call(song, 'sunoSongUrl')\n    ));\n    const legacyUrl = String(hasSongLegacyUrlField\n      ? (song?.sunoShareUrl || song?.sunoUrl || song?.sunoSongUrl || '')\n      : (loaded?.sunoShareUrl || loaded?.sunoUrl || loaded?.sunoSongUrl || '')\n    ).trim();\n'''
favorites = replace_once(favorites, suno_before, suno_after, 'Favorites Suno resolver')

# The legacy metadata returned with a URL should also fall back to the overlay.
legacy_before = '''      title: song?.sunoTitle || null,\n      coverUrl: song?.sunoCoverUrl || song?.sunoImageUrl || song?.sunoArtworkUrl || null,\n      durationSeconds: typeof song?.sunoDurationSeconds === 'number' ? song.sunoDurationSeconds : null,\n      durationText: song?.sunoDurationText || null,\n      rank: 1,\n      updatedAt: song?.sunoShareUrlUpdatedAt || undefined,\n      fetchedAt: song?.sunoCoverFetchedAt || undefined,\n'''
legacy_after = '''      title: song?.sunoTitle || loaded?.sunoTitle || null,\n      coverUrl: song?.sunoCoverUrl || song?.sunoImageUrl || song?.sunoArtworkUrl || loaded?.sunoCoverUrl || null,\n      durationSeconds: typeof song?.sunoDurationSeconds === 'number'\n        ? song.sunoDurationSeconds\n        : (typeof loaded?.sunoDurationSeconds === 'number' ? loaded.sunoDurationSeconds : null),\n      durationText: song?.sunoDurationText || loaded?.sunoDurationText || null,\n      rank: 1,\n      updatedAt: song?.sunoShareUrlUpdatedAt || loaded?.sunoShareUrlUpdatedAt || undefined,\n      fetchedAt: song?.sunoCoverFetchedAt || loaded?.sunoCoverFetchedAt || undefined,\n'''
favorites = replace_once(favorites, legacy_before, legacy_after, 'Favorites legacy Suno metadata')

# 5) Receive paged metadata immediately. Also hydrate the existing colour map only
# when the user has not already chosen a local colour for that id.
effect_before = '''  useEffect(() => {\n    favoritesRef.current = favorites || [];\n  }, [favorites]);\n\n  useEffect(() => {\n    if (!selectedSong?.id || isMusicNoteSharedView) return;\n'''
effect_after = '''  useEffect(() => {\n    favoritesRef.current = favorites || [];\n  }, [favorites]);\n\n  useEffect(() => {\n    if (isMusicNoteSharedView) return;\n    const handlePageMetadata = (event: Event) => {\n      const items = Array.isArray((event as CustomEvent<any>)?.detail?.items)\n        ? (event as CustomEvent<any>).detail.items\n        : [];\n      if (items.length === 0) return;\n\n      const nextOverlay = { ...loadedFavoriteMetadataRef.current };\n      let overlayChanged = false;\n      const serverColors: Record<string, string> = {};\n      items.forEach((item: any) => {\n        const id = String(item?.id || '').trim();\n        if (!id) return;\n        nextOverlay[id] = { ...(nextOverlay[id] || {}), ...item };\n        overlayChanged = true;\n        const color = String(item?.favoriteColorTag || item?.colorTag || '').trim();\n        if (color && color !== 'gray') serverColors[id] = color;\n      });\n\n      if (overlayChanged) {\n        loadedFavoriteMetadataRef.current = nextOverlay;\n        setLoadedFavoriteMetadataVersion((version) => version + 1);\n      }\n\n      if (Object.keys(serverColors).length > 0) {\n        setFavoriteColorMap((prev) => {\n          const next = { ...prev };\n          let changed = false;\n          Object.entries(serverColors).forEach(([id, color]) => {\n            if (!next[id]) {\n              next[id] = color;\n              changed = true;\n            }\n          });\n          return changed ? next : prev;\n        });\n      }\n    };\n\n    window.addEventListener('soridraw:music-note-page-metadata', handlePageMetadata as EventListener);\n    return () => window.removeEventListener('soridraw:music-note-page-metadata', handlePageMetadata as EventListener);\n  }, [isMusicNoteSharedView, user?.uid]);\n\n  useEffect(() => {\n    if (!selectedSong?.id || isMusicNoteSharedView) return;\n'''
favorites = replace_once(favorites, effect_before, effect_after, 'Favorites metadata event listener')

required_app = [
    MARKER,
    "new CustomEvent('soridraw:music-note-page-metadata'",
    'favoriteColorTag: favorite?.favoriteColorTag',
    'sunoLinks: favorite?.sunoLinks',
]
required_favorites = [
    MARKER,
    'loadedFavoriteMetadataRef',
    "window.addEventListener('soridraw:music-note-page-metadata'",
    'hasSongLinksField',
    'hasSongColorField',
]
for fragment in required_app:
    if fragment not in app:
        raise SystemExit(f'982 App safety failed: missing {fragment}')
for fragment in required_favorites:
    if fragment not in favorites:
        raise SystemExit(f'982 Favorites safety failed: missing {fragment}')

app_path.write_text(app, encoding='utf-8')
favorites_path.write_text(favorites, encoding='utf-8')
print('Applied SORIDRAW 982: newly loaded Music Note rows hydrate saved colour and Suno URL metadata immediately without user-data writes.')

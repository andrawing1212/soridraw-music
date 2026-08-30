from pathlib import Path
import re

MARKER = '__soridrawServerPaged'


def replace_once(path: Path, old: str, new: str, label: str):
    source = path.read_text(encoding='utf-8')
    if new in source:
        return
    if old not in source:
        raise SystemExit(f'987 {label} anchor not found in {path}')
    path.write_text(source.replace(old, new, 1), encoding='utf-8')


def regex_once(path: Path, pattern: str, replacement: str, label: str, flags=0):
    source = path.read_text(encoding='utf-8')
    updated, count = re.subn(pattern, replacement, source, count=1, flags=flags)
    if count == 0:
        if replacement in source:
            return
        raise SystemExit(f'987 {label} pattern not found in {path}')
    path.write_text(updated, encoding='utf-8')


app = Path('src/App.tsx')
favorites = Path('src/pages/FavoritesPage.tsx')
library = Path('src/pages/SunoLibraryPage.tsx')

# ---------------------------------------------------------------------------
# Music Note / App: keep the local cache for instant paint and secondary tabs,
# but mark only rows that were actually confirmed by the current server page
# chain. The canonical Note Space view can then ignore stale cache tails.
# ---------------------------------------------------------------------------
replace_once(
    app,
    "  const favoritePaginationFallbackModeRef = useRef(false);",
    "  const favoritePaginationFallbackModeRef = useRef(false);\n"
    "  const favoriteLegacyTailBufferRef = useRef<any[]>([]);\n"
    "  const favoriteLegacyTailScannedRef = useRef(false);",
    'favorite legacy tail refs',
)

replace_once(
    app,
    "        favoritePaginationFallbackModeRef.current = false;\n        setHasMoreFavorites(false);",
    "        favoritePaginationFallbackModeRef.current = false;\n"
    "        favoriteLegacyTailBufferRef.current = [];\n"
    "        favoriteLegacyTailScannedRef.current = false;\n"
    "        setHasMoreFavorites(false);",
    'favorite pagination reset',
)

# First page rows are server-confirmed. Keep the old cache in state only as a
# hidden compatibility pool for My/Shared note tabs.
replace_once(
    app,
    "          const firstPageFavs = firstPageDocs.map(mapFavoriteFirestoreDoc);",
    "          const firstPageFavs = firstPageDocs.map((favoriteDoc) => ({\n"
    "            ...mapFavoriteFirestoreDoc(favoriteDoc),\n"
    f"            {MARKER}: true,\n"
    "          }));",
    'favorite first page marker',
)

# If the ordered createdAt chain ends, keep More available for one read-only
# compatibility scan. That scan is delayed until the user reaches the tail;
# normal entry never reads the whole collection.
replace_once(
    app,
    "          setHasMoreFavorites(!favoritePaginationExhaustedRef.current);",
    "          setHasMoreFavorites(!favoritePaginationExhaustedRef.current || !favoriteLegacyTailScannedRef.current);",
    'favorite first page has-more',
)

# Do not run the previous 8-second full collection recovery during normal app
# entry. It mixed an arbitrary cache/full-list result into the paged list and
# caused the visible order/count to jump.
regex_once(
    app,
    r"\n\s*favoriteFullCacheRecoveryTimer = window\.setTimeout\(\(\) => \{\s*void runFavoritesFullCacheRecoveryOnce\(\);\s*\}, 8000\);",
    "\n        // 987: no automatic full-list recovery on normal entry.\n"
    "        // Legacy rows are checked only if the user actually reaches the ordered server tail.",
    'disable automatic favorite full recovery',
    flags=re.S,
)

# Replace the load-more function with a single server-first chain. The normal
# path requests 20+1 ordered rows. Only after that chain is exhausted do we do
# one read-only uid scan to discover legacy documents missing createdAt; those
# rows are then drained 20 at a time from memory.
pattern = r"  const loadMoreFavorites = useCallback\(async \(\) => \{.*?\n  \}, \[user\]\);"
replacement = r'''  const loadMoreFavorites = useCallback(async () => {
    const currentUser = user || auth.currentUser;
    if (!currentUser?.uid) return;
    if (favoritePaginationFallbackModeRef.current) return;
    if (favoritePaginationLoadingRef.current) return;

    const appendCanonicalPage = (page: any[]) => {
      if (page.length === 0) return;
      const markedPage = page.map((favorite) => ({ ...favorite, __soridrawServerPaged: true }));
      const pageIds = new Set(markedPage.map((favorite) => favorite?.id).filter(Boolean));
      setFavorites((prev) => {
        const retained = (prev || []).filter((favorite) => !pageIds.has(favorite?.id));
        const merged = mergeFavoritePages(markedPage, retained);
        writeFavoritesCache(currentUser.uid, merged);
        return merged;
      });
    };

    const drainLegacyTail = () => {
      const nextLegacyPage = favoriteLegacyTailBufferRef.current.slice(0, FAVORITES_PAGE_SIZE);
      favoriteLegacyTailBufferRef.current = favoriteLegacyTailBufferRef.current.slice(FAVORITES_PAGE_SIZE);
      appendCanonicalPage(nextLegacyPage);
      setHasMoreFavorites(favoriteLegacyTailBufferRef.current.length > 0);
    };

    // Ordered createdAt pages are the normal path. A legacy full-uid read is
    // deferred until this path is exhausted so app entry never performs a
    // 400+ document sync.
    if (favoritePaginationExhaustedRef.current) {
      if (favoriteLegacyTailBufferRef.current.length > 0) {
        drainLegacyTail();
        return;
      }
      if (favoriteLegacyTailScannedRef.current) {
        setHasMoreFavorites(false);
        return;
      }

      favoritePaginationLoadingRef.current = true;
      setIsLoadingMoreFavorites(true);
      try {
        const fullSnapshot = await getDocs(query(
          collection(db, 'favorites'),
          where('uid', '==', currentUser.uid)
        ));
        favoriteLegacyTailScannedRef.current = true;

        const fullFavorites = sortFavoriteList(
          fullSnapshot.docs
            .map(mapFavoriteFirestoreDoc)
            .filter((favorite) => !isFavoriteSoftRemoved(favorite))
        );
        const loadedIds = new Set(
          (favorites || [])
            .filter((favorite: any) => favorite?.__soridrawServerPaged === true)
            .map((favorite: any) => favorite?.id)
            .filter(Boolean)
        );
        const unseenLegacyFavorites = fullFavorites.filter((favorite: any) => !loadedIds.has(favorite?.id));
        const nextLegacyPage = unseenLegacyFavorites.slice(0, FAVORITES_PAGE_SIZE);
        favoriteLegacyTailBufferRef.current = unseenLegacyFavorites.slice(FAVORITES_PAGE_SIZE);
        appendCanonicalPage(nextLegacyPage);
        setHasMoreFavorites(favoriteLegacyTailBufferRef.current.length > 0);
      } catch (error) {
        console.warn('Favorites legacy tail compatibility scan failed. Keeping the current canonical pages.', error);
        setHasMoreFavorites(true);
      } finally {
        favoritePaginationLoadingRef.current = false;
        setIsLoadingMoreFavorites(false);
      }
      return;
    }

    const cursor = favoritePaginationCursorRef.current;
    if (!cursor) return;

    favoritePaginationLoadingRef.current = true;
    setIsLoadingMoreFavorites(true);
    try {
      const q = query(
        collection(db, 'favorites'),
        where('uid', '==', currentUser.uid),
        orderBy('createdAt', 'desc'),
        startAfter(cursor),
        limit(FAVORITES_PAGE_SIZE + 1)
      );
      const snapshot = await getDocs(q);
      const nextDocs = snapshot.docs.slice(0, FAVORITES_PAGE_SIZE);
      const nextFavs = nextDocs.map(mapFavoriteFirestoreDoc);
      if (nextDocs.length > 0) {
        favoritePaginationCursorRef.current = nextDocs[nextDocs.length - 1];
      }
      favoritePaginationExhaustedRef.current = snapshot.docs.length <= FAVORITES_PAGE_SIZE;
      appendCanonicalPage(nextFavs);
      setHasMoreFavorites(!favoritePaginationExhaustedRef.current || !favoriteLegacyTailScannedRef.current);
    } catch (error) {
      console.warn('Favorites additional page load failed. Keeping the current list instead of crashing the page.', error);
      setHasMoreFavorites(true);
    } finally {
      favoritePaginationLoadingRef.current = false;
      setIsLoadingMoreFavorites(false);
    }
  }, [user, favorites]);'''
regex_once(app, pattern, replacement, 'favorite canonical load more', flags=re.S)

# Manual sync also marks the first server page as canonical so it cannot expose
# the stale cache tail after a recovery action. This is the second occurrence.
source = app.read_text(encoding='utf-8')
manual_old = "      const firstPageFavs = firstPageDocs.map(mapFavoriteFirestoreDoc);"
manual_new = (
    "      const firstPageFavs = firstPageDocs.map((favoriteDoc) => ({\n"
    "        ...mapFavoriteFirestoreDoc(favoriteDoc),\n"
    f"        {MARKER}: true,\n"
    "      }));"
)
if manual_old in source:
    app.write_text(source.replace(manual_old, manual_new, 1), encoding='utf-8')

# Do not persist the current-session canonical marker into localStorage. The
# next launch must treat cache as cache until a fresh server page confirms it.
replace_once(
    app,
    "        localStorage.setItem(`soridraw_favorites_cache_${uid}`, JSON.stringify(safeList));",
    "        const persistedList = safeList.map(({ __soridrawServerPaged: _serverPaged, ...favorite }) => favorite);\n"
    "        localStorage.setItem(`soridraw_favorites_cache_${uid}`, JSON.stringify(persistedList));",
    'strip transient favorite marker from persistent cache',
)

# ---------------------------------------------------------------------------
# FavoritesPage: default Note Space uses only current-session server-confirmed
# rows after the first server response. Search/color/trash/My/Shared modes keep
# their existing local filtering behaviour.
# ---------------------------------------------------------------------------
replace_once(
    favorites,
    "  const filteredFavoriteBase = activeFavoriteSource.filter(song => {\n    if (isMusicNoteSharedView) return true;\n    return songMatchesMusicNoteSearch(song) && songMatchesMusicNoteFilters(song);\n  });",
    "  const isCanonicalMusicNoteServerMode = Boolean(\n"
    "    !isMusicNoteSharedView &&\n"
    "    musicNoteViewMode === 'noteSpace' &&\n"
    "    !deferredSearchQuery.trim() &&\n"
    "    favoriteColorFilter === 'all' &&\n"
    "    !favoriteTrashView &&\n"
    "    sortBy === 'latest'\n"
    "  );\n"
    "  const hasServerPagedMusicNoteRows = activeFavoriteSource.some((song: any) => song?.__soridrawServerPaged === true);\n"
    "  const useCanonicalMusicNoteRows = isCanonicalMusicNoteServerMode && !isFavoritesLoading && hasServerPagedMusicNoteRows;\n\n"
    "  const filteredFavoriteBase = activeFavoriteSource.filter(song => {\n"
    "    if (isMusicNoteSharedView) return true;\n"
    "    if (useCanonicalMusicNoteRows && song?.__soridrawServerPaged !== true) return false;\n"
    "    return songMatchesMusicNoteSearch(song) && songMatchesMusicNoteFilters(song);\n"
    "  });",
    'music note canonical source filter',
)

replace_once(
    favorites,
    "  const canShowCachedMusicNoteMore = visibleCount < filteredFavorites.length;\n  const canRequestMoreMusicNotePage = Boolean(\n    !isMusicNoteSharedView &&\n    !searchQuery.trim() &&\n    favoriteColorFilter === 'all' &&\n    !favoriteTrashView &&\n    hasMoreFavorites &&\n    filteredFavorites.length >= MUSIC_NOTE_VISIBLE_BATCH_SIZE\n  );",
    "  const canShowCachedMusicNoteMore = Boolean(\n"
    "    !isCanonicalMusicNoteServerMode &&\n"
    "    visibleCount < filteredFavorites.length\n"
    "  );\n"
    "  const canRequestMoreMusicNotePage = Boolean(\n"
    "    isCanonicalMusicNoteServerMode &&\n"
    "    hasMoreFavorites &&\n"
    "    filteredFavorites.length >= MUSIC_NOTE_VISIBLE_BATCH_SIZE\n"
    "  );",
    'music note single more path',
)

replace_once(
    favorites,
    "                  : canShowCachedMusicNoteMore\n                    ? `더보기 (${filteredFavorites.length - visibleCount}개 남음)`\n                    : musicNoteViewMode === 'noteSpace'\n                      ? '더보기 (20개 더 불러오기)'\n                      : '더보기'}",
    "                  : canShowCachedMusicNoteMore\n                    ? '더보기'\n                    : musicNoteViewMode === 'noteSpace'\n                      ? '더보기 (20개 더 불러오기)'\n                      : '더보기'}",
    'remove misleading music note cache remainder',
)

# ---------------------------------------------------------------------------
# Suno Library: cache is instant paint only. The first server page replaces the
# workspace list; subsequent More clicks always use the server cursor in the
# canonical workspace view. If ordered paging itself fails, the existing full
# server fallback remains locally pageable.
# ---------------------------------------------------------------------------
replace_once(
    library,
    "  const workspacePaginationFallbackRef = useRef(false);",
    "  const workspacePaginationFallbackRef = useRef(false);\n"
    "  const workspaceServerPageCountRef = useRef(0);",
    'library server page count ref',
)

replace_once(
    library,
    "      workspacePaginationFallbackRef.current = false;\n      setHasMoreWorkspaceServerTracks(false);",
    "      workspacePaginationFallbackRef.current = false;\n"
    "      workspaceServerPageCountRef.current = 0;\n"
    "      setHasMoreWorkspaceServerTracks(false);",
    'library pagination reset',
)

old_first_page = """        workspaceLastTrackDocRef.current = visibleDocs.length > 0 ? visibleDocs[visibleDocs.length - 1] : null;
        setHasMoreWorkspaceServerTracks(hasMore);

        const list = visibleDocs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setTracks((prev) => {
          const merged = mergeWorkspaceTracks(list, Array.isArray(prev) ? prev : []);
          saveWorkspaceTrackCache(resolvedUser.uid, merged);
          return merged;
        });
        setLoading(false);"""
new_first_page = """        const list = visibleDocs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        if (workspaceServerPageCountRef.current <= 1) {
          workspaceLastTrackDocRef.current = visibleDocs.length > 0 ? visibleDocs[visibleDocs.length - 1] : null;
          workspaceServerPageCountRef.current = 1;
          setHasMoreWorkspaceServerTracks(hasMore);
          setTracks(list);
          saveWorkspaceTrackCache(resolvedUser.uid, list);
          setWorkspaceVisibleCount(WORKSPACE_PAGE_SIZE);
        } else {
          // A live first-page update must not reset the cursor after the user
          // already loaded older pages. Refresh only those latest rows.
          setTracks((prev) => {
            const merged = mergeWorkspaceTracks(list, Array.isArray(prev) ? prev : []);
            saveWorkspaceTrackCache(resolvedUser.uid, merged);
            return merged;
          });
        }
        setLoading(false);"""
replace_once(library, old_first_page, new_first_page, 'library first server page canonical replace')

replace_once(
    library,
    "      setWorkspaceVisibleCount((prev) => prev + WORKSPACE_PAGE_SIZE);",
    "      workspaceServerPageCountRef.current += 1;\n"
    "      setWorkspaceVisibleCount((prev) => prev + WORKSPACE_PAGE_SIZE);",
    'library increment server page count',
)

replace_once(
    library,
    "  const canShowCachedWorkspaceMore = libraryViewMode === 'workspace' && workspaceVisibleCount < filteredTracks.length;\n  const canRequestMoreWorkspacePage = Boolean(\n    libraryViewMode === 'workspace' &&\n    !isSharedView &&\n    !deferredSearchTerm.trim() &&\n    filter === 'all' &&\n    workspaceColorFilter === 'all' &&\n    hasMoreWorkspaceServerTracks &&\n    filteredTracks.length >= WORKSPACE_PAGE_SIZE\n  );",
    "  const isCanonicalWorkspaceServerMode = Boolean(\n"
    "    libraryViewMode === 'workspace' &&\n"
    "    !isSharedView &&\n"
    "    !deferredSearchTerm.trim() &&\n"
    "    filter === 'all' &&\n"
    "    workspaceColorFilter === 'all'\n"
    "  );\n"
    "  const canShowCachedWorkspaceMore = Boolean(\n"
    "    libraryViewMode === 'workspace' &&\n"
    "    (!isCanonicalWorkspaceServerMode || workspacePaginationFallbackRef.current) &&\n"
    "    workspaceVisibleCount < filteredTracks.length\n"
    "  );\n"
    "  const canRequestMoreWorkspacePage = Boolean(\n"
    "    isCanonicalWorkspaceServerMode &&\n"
    "    hasMoreWorkspaceServerTracks &&\n"
    "    filteredTracks.length >= WORKSPACE_PAGE_SIZE\n"
    "  );",
    'library single more path',
)

replace_once(
    library,
    "                    : `더보기 (${Math.max(0, filteredTracks.length - workspaceVisibleCount) + (canRequestMoreWorkspacePage ? WORKSPACE_PAGE_SIZE : 0)}세트 남음)`}",
    "                    : canShowCachedWorkspaceMore\n"
    "                      ? '더보기'\n"
    "                      : '더보기 (20세트 더 불러오기)'}",
    'library truthful more label',
)

print('987 preview server-canonical pagination patch applied')

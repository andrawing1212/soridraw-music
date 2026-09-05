from pathlib import Path
import re

APP = Path('src/App.tsx')
FAVORITES = Path('src/pages/FavoritesPage.tsx')
app = APP.read_text(encoding='utf-8')
favorites = FAVORITES.read_text(encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 anchor, found {count}')
    return text.replace(old, new, 1)


def replace_all_present(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count < 1:
        raise SystemExit(f'{label}: anchor not found')
    print(f'{label}: replacing {count} anchor(s)')
    return text.replace(old, new)

payload_anchor = "const getMusicNotePayloadCacheKey = (uid: string) => `soridraw_favorites_cache_${uid}`;\n"
payload_insert = payload_anchor + r'''

// SORIDRAW_MUSIC_NOTE_BOUNDED_MORE_RECOVERY_1024
const readFavoritesHistoricalMaxCount = (uid: string): number => {
  if (!uid || typeof localStorage === 'undefined') return 0;
  try {
    const value = Number(localStorage.getItem(`soridraw_favorites_cache_max_count_${uid}`) || 0);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
};
'''
app = replace_once(app, payload_anchor, payload_insert, 'historical max helper')

app = replace_once(
    app,
    "  const favoritePaginationFallbackModeRef = useRef(false);",
    "  const favoritePaginationFallbackModeRef = useRef(false);\n"
    "  const favoriteLegacyPaginationCursorRef = useRef<any>(null);\n"
    "  const favoriteLegacyPaginationExhaustedRef = useRef(false);\n"
    "  const favoriteLegacyPaginationBufferRef = useRef<any[]>([]);",
    'legacy pagination refs',
)

reset_old = """        favoritePaginationCursorRef.current = null;
        favoritePaginationExhaustedRef.current = false;
        favoritePaginationLoadingRef.current = false;
        favoritePaginationFallbackModeRef.current = false;
        setHasMoreFavorites(false);"""
reset_new = """        favoritePaginationCursorRef.current = null;
        favoritePaginationExhaustedRef.current = false;
        favoritePaginationLoadingRef.current = false;
        favoritePaginationFallbackModeRef.current = false;
        favoriteLegacyPaginationCursorRef.current = null;
        favoriteLegacyPaginationExhaustedRef.current = false;
        favoriteLegacyPaginationBufferRef.current = [];
        setHasMoreFavorites(false);"""
app = replace_all_present(app, reset_old, reset_new, 'pagination reset')

cached_old = """        if (hasCachedMusicNote) {
          const persistedCursor = readMusicNotePaginationCursor(currentUser.uid);
          favoritePaginationCursorRef.current = persistedCursor;
          favoritePaginationExhaustedRef.current = !persistedCursor;
          setHasMoreFavorites(Boolean(persistedCursor));
          setIsFavoritesLoading(false);
        }"""
cached_new = """        if (hasCachedMusicNote) {
          const persistedCursor = readMusicNotePaginationCursor(currentUser.uid);
          const historicalMaxCount = readFavoritesHistoricalMaxCount(currentUser.uid);
          const cachedCount = Array.isArray(cachedFavs) ? cachedFavs.length : 0;
          const mayHaveMoreCachedHistory = historicalMaxCount > cachedCount || cachedCount >= FAVORITES_PAGE_SIZE;
          favoritePaginationCursorRef.current = persistedCursor;
          favoritePaginationExhaustedRef.current = !persistedCursor;
          setHasMoreFavorites(Boolean(persistedCursor) || mayHaveMoreCachedHistory);
          setIsFavoritesLoading(false);
        }"""
app = replace_once(app, cached_old, cached_new, 'cached bootstrap more gate')

pattern = r"  const loadMoreFavorites = useCallback\(async \(\) => \{.*?\n  \}, \[user\]\);"
replacement = r'''  const loadMoreFavorites = useCallback(async () => {
    const currentUser = user || auth.currentUser;
    if (!currentUser?.uid) return;
    if (favoritePaginationLoadingRef.current) return;

    const appendFavoritePage = (page: any[]) => {
      if (!Array.isArray(page) || page.length === 0) return;
      setFavorites((prev) => {
        const merged = mergeFavoritePages(prev || [], page);
        writeFavoritesCache(currentUser.uid, merged);
        return merged;
      });
    };

    const loadBoundedCompatibilityPage = async () => {
      if (favoriteLegacyPaginationBufferRef.current.length >= FAVORITES_PAGE_SIZE) {
        const buffered = favoriteLegacyPaginationBufferRef.current.slice(0, FAVORITES_PAGE_SIZE);
        favoriteLegacyPaginationBufferRef.current = favoriteLegacyPaginationBufferRef.current.slice(FAVORITES_PAGE_SIZE);
        appendFavoritePage(buffered);
        setHasMoreFavorites(
          favoriteLegacyPaginationBufferRef.current.length > 0 || !favoriteLegacyPaginationExhaustedRef.current,
        );
        return;
      }

      const loadedIds = new Set(
        (favoritesStore.getFavorites() || [])
          .map((favorite: any) => String(favorite?.id || favorite?.firestoreId || '').trim())
          .filter(Boolean),
      );
      const collected = [...favoriteLegacyPaginationBufferRef.current];
      favoriteLegacyPaginationBufferRef.current = [];
      let scanCursor = favoriteLegacyPaginationCursorRef.current;
      let exhausted = favoriteLegacyPaginationExhaustedRef.current;
      let scanCount = 0;

      while (!exhausted && collected.length < FAVORITES_PAGE_SIZE && scanCount < 5) {
        const fallbackQuery = scanCursor
          ? query(
              collection(db, 'favorites'),
              where('uid', '==', currentUser.uid),
              startAfter(scanCursor),
              limit(FAVORITES_PAGE_SIZE),
            )
          : query(
              collection(db, 'favorites'),
              where('uid', '==', currentUser.uid),
              limit(FAVORITES_PAGE_SIZE),
            );
        const snapshot = await getDocs(fallbackQuery);
        const docs = snapshot.docs.slice(0, FAVORITES_PAGE_SIZE);
        scanCount += 1;

        if (docs.length > 0) {
          scanCursor = docs[docs.length - 1];
          favoriteLegacyPaginationCursorRef.current = scanCursor;
        }
        if (docs.length < FAVORITES_PAGE_SIZE) {
          exhausted = true;
          favoriteLegacyPaginationExhaustedRef.current = true;
        }

        const mapped = filterDeletedFavoriteTombstones(
          currentUser.uid,
          docs.map(mapFavoriteFirestoreDoc).filter((favorite) => !isFavoriteSoftRemoved(favorite)),
        );
        for (const favorite of mapped) {
          const favoriteId = String(favorite?.id || favorite?.firestoreId || '').trim();
          if (favoriteId && loadedIds.has(favoriteId)) continue;
          if (favoriteId) loadedIds.add(favoriteId);
          collected.push(favorite);
        }
        if (docs.length === 0) break;
      }

      const nextPage = collected.slice(0, FAVORITES_PAGE_SIZE);
      favoriteLegacyPaginationBufferRef.current = collected.slice(FAVORITES_PAGE_SIZE);
      appendFavoritePage(nextPage);
      const hasMoreCompatibilityRows = favoriteLegacyPaginationBufferRef.current.length > 0 || !exhausted;
      setHasMoreFavorites(hasMoreCompatibilityRows);
      if (!hasMoreCompatibilityRows) clearMusicNotePaginationCursor(currentUser.uid);
    };

    favoritePaginationLoadingRef.current = true;
    setIsLoadingMoreFavorites(true);
    try {
      const cursor = favoritePaginationCursorRef.current;
      const canUseOrderedCursor = Boolean(
        cursor && !favoritePaginationFallbackModeRef.current && !favoritePaginationExhaustedRef.current,
      );

      if (!canUseOrderedCursor) {
        await loadBoundedCompatibilityPage();
        return;
      }

      try {
        const q = query(
          collection(db, 'favorites'),
          where('uid', '==', currentUser.uid),
          orderBy('createdAt', 'desc'),
          startAfter(cursor),
          limit(FAVORITES_PAGE_SIZE),
        );
        const snapshot = await getDocs(q);
        const nextDocs = snapshot.docs.slice(0, FAVORITES_PAGE_SIZE);
        const nextFavs = filterDeletedFavoriteTombstones(
          currentUser.uid,
          nextDocs.map(mapFavoriteFirestoreDoc).filter((favorite) => !isFavoriteSoftRemoved(favorite)),
        );

        if (nextDocs.length > 0) {
          favoritePaginationCursorRef.current = nextDocs[nextDocs.length - 1];
          writeMusicNotePaginationCursor(currentUser.uid, favoritePaginationCursorRef.current);
          appendFavoritePage(nextFavs);
        }

        favoritePaginationExhaustedRef.current = snapshot.docs.length < FAVORITES_PAGE_SIZE;
        // Keep the affordance until the bounded compatibility chain proves that
        // no legacy rows remain. This does not read anything on refresh.
        setHasMoreFavorites(true);
        if (nextDocs.length === 0) await loadBoundedCompatibilityPage();
      } catch (orderedError) {
        console.warn('Favorites ordered page unavailable; trying bounded compatibility pagination.', orderedError);
        favoritePaginationFallbackModeRef.current = true;
        await loadBoundedCompatibilityPage();
      }
    } catch (error) {
      console.warn('Favorites additional page load failed. Keeping the current list and retry affordance.', error);
      setHasMoreFavorites(true);
    } finally {
      favoritePaginationLoadingRef.current = false;
      setIsLoadingMoreFavorites(false);
    }
  }, [user]);'''
app, count = re.subn(pattern, replacement, app, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'load more callback: expected 1 match, found {count}')

favorites_old = """    hasMoreFavorites &&
    filteredFavorites.length >= MUSIC_NOTE_VISIBLE_BATCH_SIZE
  );"""
favorites_new = """    hasMoreFavorites &&
    filteredFavorites.length > 0
  );"""
favorites = replace_once(favorites, favorites_old, favorites_new, 'Music Note More visibility gate')

APP.write_text(app, encoding='utf-8')
FAVORITES.write_text(favorites, encoding='utf-8')

check = APP.read_text(encoding='utf-8')
for marker in (
    'SORIDRAW_MUSIC_NOTE_BOUNDED_MORE_RECOVERY_1024',
    'scanCount < 5',
    'favoriteLegacyPaginationCursorRef',
    'limit(FAVORITES_PAGE_SIZE)',
):
    if marker not in check:
        raise SystemExit(f'1024 verification missing: {marker}')
print('1024 Music Note bounded More pagination patch applied')

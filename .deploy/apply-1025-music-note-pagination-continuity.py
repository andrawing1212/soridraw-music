from pathlib import Path
import re

APP = Path("src/App.tsx")
FAVORITES = Path("src/pages/FavoritesPage.tsx")
MARKER = "SORIDRAW_MUSIC_NOTE_PAGINATION_CONTINUITY_1025"


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"1025 {label} anchor mismatch: {count}")
    return source.replace(old, new, 1)


def replace_after(source: str, anchor: str, old: str, new: str, label: str) -> str:
    start = source.find(anchor)
    if start < 0:
        raise SystemExit(f"1025 {label} parent anchor missing")
    pos = source.find(old, start)
    if pos < 0:
        raise SystemExit(f"1025 {label} anchor missing after parent")
    return source[:pos] + source[pos:].replace(old, new, 1)


app = APP.read_text(encoding="utf-8")
favorites = FAVORITES.read_text(encoding="utf-8")

if MARKER in app:
    if "totalFavoritesCount={favoriteTotalCount}" not in app:
        raise SystemExit("1025 marker exists but App.tsx is incomplete")
    if "version: 2, id: cursorId" not in app:
        raise SystemExit("1025 marker exists but persisted cursor v2 is incomplete")
    if "전체 ${musicNoteTotalCount}곡" not in favorites:
        raise SystemExit("1025 marker exists but FavoritesPage total-count label is missing")
    print("1025 already applied")
    raise SystemExit(0)

cursor_pattern = re.compile(
    r"const readMusicNotePaginationCursor = \(uid: string\): Date \| null => \{.*?\n\};\n\n"
    r"const writeMusicNotePaginationCursor = \(uid: string, docSnap: any \| null\) => \{.*?\n\};",
    re.S,
)
cursor_replacement = r'''type MusicNotePaginationCursorHint = {
  id: string;
  createdAtMs: number;
  legacy: boolean;
};

const readMusicNotePaginationCursor = (uid: string): MusicNotePaginationCursorHint | null => {
  if (!uid || typeof localStorage === 'undefined') return null;
  try {
    const raw = String(
      localStorage.getItem(getMusicNoteScopedStorageKey(MUSIC_NOTE_PAGINATION_CURSOR_STORAGE_BASE, uid)) || '',
    ).trim();
    if (!raw) return null;

    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw);
      const cursorId = String(parsed?.id || '').trim();
      const createdAtMs = Number(parsed?.createdAtMs || 0);
      if (cursorId) {
        return {
          id: cursorId,
          createdAtMs: Number.isFinite(createdAtMs) && createdAtMs > 0 ? createdAtMs : 0,
          legacy: false,
        };
      }
    }

    const legacyMs = Number(raw);
    return Number.isFinite(legacyMs) && legacyMs > 0
      ? { id: '', createdAtMs: legacyMs, legacy: true }
      : null;
  } catch {
    return null;
  }
};

const writeMusicNotePaginationCursor = (uid: string, docSnap: any | null) => {
  if (!uid || !docSnap || typeof localStorage === 'undefined') return;
  try {
    const cursorId = String(docSnap?.id || '').trim();
    if (!cursorId) return;
    const data = typeof docSnap.data === 'function' ? docSnap.data() : null;
    const createdAtMs = Number(data?.createdAtMs || 0) || getTimestampMs(data?.createdAt);
    localStorage.setItem(
      getMusicNoteScopedStorageKey(MUSIC_NOTE_PAGINATION_CURSOR_STORAGE_BASE, uid),
      JSON.stringify({ version: 2, id: cursorId, createdAtMs: createdAtMs > 0 ? createdAtMs : 0 }),
    );
  } catch {}
};'''
app, count = cursor_pattern.subn(cursor_replacement, app, count=1)
if count != 1:
    raise SystemExit(f"1025 cursor helper replacement mismatch: {count}")

app = replace_once(
    app,
    "const SORIDRAW_MUSIC_NOTE_BOUNDED_MORE_RECOVERY_1024 = true;",
    "const SORIDRAW_MUSIC_NOTE_BOUNDED_MORE_RECOVERY_1024 = true;\n"
    "const SORIDRAW_MUSIC_NOTE_PAGINATION_CONTINUITY_1025 = true;",
    "marker",
)

app = replace_once(
    app,
    "  const favoriteLegacyPaginationBufferRef = useRef<any[]>([]);\n"
    "  const [hasMoreFavorites, setHasMoreFavorites] = useState(false);\n"
    "  const [isLoadingMoreFavorites, setIsLoadingMoreFavorites] = useState(false);",
    "  const favoriteLegacyPaginationBufferRef = useRef<any[]>([]);\n"
    "  const favoritePaginationNeedsServerAnchorRef = useRef(false);\n"
    "  const [hasMoreFavorites, setHasMoreFavorites] = useState(false);\n"
    "  const [isLoadingMoreFavorites, setIsLoadingMoreFavorites] = useState(false);\n"
    "  const [favoriteTotalCount, setFavoriteTotalCount] = useState<number | null>(null);",
    "pagination refs",
)

app = replace_once(
    app,
    "        favoriteLegacyPaginationCursorRef.current = null;\n"
    "        favoriteLegacyPaginationExhaustedRef.current = false;\n"
    "        favoriteLegacyPaginationBufferRef.current = [];\n"
    "        setHasMoreFavorites(false);",
    "        favoriteLegacyPaginationCursorRef.current = null;\n"
    "        favoriteLegacyPaginationExhaustedRef.current = false;\n"
    "        favoriteLegacyPaginationBufferRef.current = [];\n"
    "        favoritePaginationNeedsServerAnchorRef.current = false;\n"
    "        setFavoriteTotalCount(null);\n"
    "        setHasMoreFavorites(false);",
    "login pagination reset",
)

app = replace_after(
    app,
    "unsubUserDoc = onSnapshot(userRef, { includeMetadataChanges: true }, (docSnap) => {",
    "            const data = docSnap.data();\n"
    "            writeUserProfileCache(currentUser.uid, data);",
    "            const data = docSnap.data();\n"
    "            const profileFavoriteCount = Number(data?.favoriteCount);\n"
    "            setFavoriteTotalCount(\n"
    "              Number.isFinite(profileFavoriteCount) && profileFavoriteCount >= 0\n"
    "                ? Math.floor(profileFavoriteCount)\n"
    "                : null,\n"
    "            );\n"
    "            writeUserProfileCache(currentUser.uid, data);",
    "profile total count",
)

app = replace_once(
    app,
    "          favoritePaginationCursorRef.current = persistedCursor;\n"
    "          favoritePaginationExhaustedRef.current = !persistedCursor;\n"
    "          setHasMoreFavorites(Boolean(persistedCursor) || mayHaveMoreCachedHistory);",
    "          const hasCachedContinuationHint = Boolean(persistedCursor) || mayHaveMoreCachedHistory;\n"
    "          favoritePaginationCursorRef.current = persistedCursor;\n"
    "          favoritePaginationExhaustedRef.current = !hasCachedContinuationHint;\n"
    "          favoritePaginationNeedsServerAnchorRef.current = Boolean(hasCachedContinuationHint && !persistedCursor?.id);\n"
    "          setHasMoreFavorites(hasCachedContinuationHint);",
    "cached continuation hint",
)

app = replace_after(
    app,
    "const attachFavoritesSourceBootstrap902 = () => {",
    "            favoritePaginationExhaustedRef.current = snapshot.docs.length < FAVORITES_PAGE_SIZE;\n"
    "            favoritePaginationFallbackModeRef.current = false;",
    "            favoritePaginationExhaustedRef.current = snapshot.docs.length < FAVORITES_PAGE_SIZE;\n"
    "            favoritePaginationFallbackModeRef.current = false;\n"
    "            favoritePaginationNeedsServerAnchorRef.current = false;",
    "first-page snapshot cursor",
)

app = replace_after(
    app,
    "const attachLegacyFavoritesFallback = async () => {",
    "          favoritePaginationFallbackModeRef.current = true;\n"
    "          setHasMoreFavorites(false);",
    "          favoritePaginationFallbackModeRef.current = true;\n"
    "          favoritePaginationNeedsServerAnchorRef.current = false;\n"
    "          setHasMoreFavorites(false);",
    "legacy first-page fallback reset",
)

bundle_old = (
    "              favoritePaginationCursorRef.current = bundle.cursorCreatedAtMs > 0 ? new Date(bundle.cursorCreatedAtMs) : null;\n"
    "              favoritePaginationExhaustedRef.current = !bundle.hasMore;\n"
    "              favoritePaginationFallbackModeRef.current = false;\n"
    "              setHasMoreFavorites(bundle.hasMore);"
)
bundle_new = (
    "              const bundleCursorFavorite = firstPageFavs[firstPageFavs.length - 1];\n"
    "              const bundleCursorId = String(bundleCursorFavorite?.id || bundleCursorFavorite?.firestoreId || '').trim();\n"
    "              favoritePaginationCursorRef.current = bundle.hasMore && bundleCursorId\n"
    "                ? { id: bundleCursorId, createdAtMs: Number(bundle.cursorCreatedAtMs || 0), legacy: false }\n"
    "                : null;\n"
    "              favoritePaginationExhaustedRef.current = !bundle.hasMore;\n"
    "              favoritePaginationFallbackModeRef.current = false;\n"
    "              favoritePaginationNeedsServerAnchorRef.current = Boolean(bundle.hasMore && !bundleCursorId);\n"
    "              setHasMoreFavorites(bundle.hasMore);"
)
app = replace_after(
    app,
    "onData: (bundle, meta) => {",
    bundle_old,
    bundle_new,
    "bundle cursor id",
)

load_more_pattern = re.compile(
    r"  const loadMoreFavorites = useCallback\(async \(\) => \{.*?\n  \}, \[user\]\);",
    re.S,
)
load_more_replacement = r'''  const loadMoreFavorites = useCallback(async () => {
    const currentUser = user || auth.currentUser;
    if (!currentUser?.uid) return;
    if (favoritePaginationLoadingRef.current) return;

    const getFavoriteId = (favorite: any) =>
      String(favorite?.id || favorite?.firestoreId || '').trim();

    const loadedIds = new Set(
      (favoritesStore.getFavorites() || [])
        .filter((favorite: any) => !isFavoriteSoftRemoved(favorite))
        .map(getFavoriteId)
        .filter(Boolean),
    );

    const getTrustedTotalCount = () => {
      if (
        typeof favoriteTotalCount !== 'number'
        || !Number.isFinite(favoriteTotalCount)
        || favoriteTotalCount < loadedIds.size
      ) {
        return null;
      }
      return Math.max(0, Math.floor(favoriteTotalCount));
    };

    const appendFavoritePage = (page: any[]) => {
      if (!Array.isArray(page) || page.length === 0) return;
      page.forEach((favorite) => {
        const favoriteId = getFavoriteId(favorite);
        if (favoriteId) loadedIds.add(favoriteId);
      });
      setFavorites((prev) => {
        const merged = mergeFavoritePages(prev || [], page);
        writeFavoritesCache(currentUser.uid, merged);
        return merged;
      });
    };

    const loadCompatibilityTail = async () => {
      const trustedTotalCount = getTrustedTotalCount();
      if (trustedTotalCount !== null && loadedIds.size >= trustedTotalCount) {
        favoriteLegacyPaginationExhaustedRef.current = true;
        setHasMoreFavorites(false);
        clearMusicNotePaginationCursor(currentUser.uid);
        return;
      }

      favoritePaginationFallbackModeRef.current = true;
      const collected: any[] = [];
      let scanCursor = favoriteLegacyPaginationCursorRef.current;
      let exhausted = favoriteLegacyPaginationExhaustedRef.current;
      const maxScanPages = Math.min(
        50,
        Math.max(5, Math.ceil((loadedIds.size + FAVORITES_PAGE_SIZE) / FAVORITES_PAGE_SIZE) + 1),
      );
      let scanCount = 0;
      let targetReached = false;

      while (!exhausted && !targetReached && scanCount < maxScanPages) {
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

        if (docs.length === 0) {
          exhausted = true;
          break;
        }

        for (const docSnap of docs) {
          scanCursor = docSnap;
          favoriteLegacyPaginationCursorRef.current = docSnap;
          const favorite = mapFavoriteFirestoreDoc(docSnap);
          if (isFavoriteSoftRemoved(favorite)) continue;
          if (isFavoriteDeletedTombstoned(currentUser.uid, getFavoriteId(favorite))) continue;
          const favoriteId = getFavoriteId(favorite);
          if (favoriteId && loadedIds.has(favoriteId)) continue;
          if (favoriteId) loadedIds.add(favoriteId);
          collected.push(favorite);
          if (collected.length >= FAVORITES_PAGE_SIZE) {
            targetReached = true;
            break;
          }
        }

        if (!targetReached && docs.length < FAVORITES_PAGE_SIZE) {
          exhausted = true;
        }
      }

      favoriteLegacyPaginationExhaustedRef.current = exhausted;
      appendFavoritePage(collected);

      const totalAfter = getTrustedTotalCount();
      const hasMoreByCount = totalAfter !== null ? loadedIds.size < totalAfter : !exhausted;
      const hasMore = targetReached || hasMoreByCount || !exhausted;
      setHasMoreFavorites(hasMore);
      if (!hasMore) clearMusicNotePaginationCursor(currentUser.uid);
    };

    const rehydrateCursorSnapshot = async (): Promise<any | null> => {
      const cursor = favoritePaginationCursorRef.current;
      if (cursor && typeof cursor.data === 'function' && String(cursor?.id || '').trim()) {
        return cursor;
      }

      const cursorId = String(cursor?.id || '').trim();
      if (!cursorId) return null;

      try {
        const snapshot = await getDoc(doc(db, 'favorites', cursorId));
        if (!snapshot.exists()) return null;
        const data = snapshot.data();
        if (String(data?.uid || '') !== currentUser.uid) return null;
        favoritePaginationCursorRef.current = snapshot;
        favoritePaginationNeedsServerAnchorRef.current = false;
        return snapshot;
      } catch (error) {
        console.warn('Favorite pagination cursor rehydrate failed; rebuilding ordered cursor.', error);
        return null;
      }
    };

    const loadOrderedUnseenPage = async (initialCursor: any | null) => {
      const collected: any[] = [];
      let scanCursor = initialCursor;
      let orderedExhausted = false;
      let targetReached = false;
      const maxScanPages = Math.min(
        50,
        Math.max(2, Math.ceil((loadedIds.size + FAVORITES_PAGE_SIZE) / FAVORITES_PAGE_SIZE) + 2),
      );
      let scanCount = 0;

      while (!orderedExhausted && !targetReached && scanCount < maxScanPages) {
        const orderedQuery = scanCursor
          ? query(
              collection(db, 'favorites'),
              where('uid', '==', currentUser.uid),
              orderBy('createdAt', 'desc'),
              startAfter(scanCursor),
              limit(FAVORITES_PAGE_SIZE),
            )
          : query(
              collection(db, 'favorites'),
              where('uid', '==', currentUser.uid),
              orderBy('createdAt', 'desc'),
              limit(FAVORITES_PAGE_SIZE),
            );

        const snapshot = await getDocs(orderedQuery);
        const docs = snapshot.docs.slice(0, FAVORITES_PAGE_SIZE);
        scanCount += 1;

        if (docs.length === 0) {
          orderedExhausted = true;
          break;
        }

        for (const docSnap of docs) {
          scanCursor = docSnap;
          const favorite = mapFavoriteFirestoreDoc(docSnap);
          if (isFavoriteSoftRemoved(favorite)) continue;
          if (isFavoriteDeletedTombstoned(currentUser.uid, getFavoriteId(favorite))) continue;
          const favoriteId = getFavoriteId(favorite);
          if (favoriteId && loadedIds.has(favoriteId)) continue;
          if (favoriteId) loadedIds.add(favoriteId);
          collected.push(favorite);
          if (collected.length >= FAVORITES_PAGE_SIZE) {
            targetReached = true;
            break;
          }
        }

        if (!targetReached && docs.length < FAVORITES_PAGE_SIZE) {
          orderedExhausted = true;
        }
      }

      if (scanCursor) {
        favoritePaginationCursorRef.current = scanCursor;
        writeMusicNotePaginationCursor(currentUser.uid, scanCursor);
        favoritePaginationNeedsServerAnchorRef.current = false;
      }

      appendFavoritePage(collected);
      favoritePaginationExhaustedRef.current = orderedExhausted;

      if (!orderedExhausted) {
        setHasMoreFavorites(true);
        return;
      }

      const trustedTotalCount = getTrustedTotalCount();
      if (trustedTotalCount !== null && loadedIds.size >= trustedTotalCount) {
        setHasMoreFavorites(false);
        clearMusicNotePaginationCursor(currentUser.uid);
        return;
      }

      if (collected.length === 0) {
        await loadCompatibilityTail();
        return;
      }

      setHasMoreFavorites(true);
    };

    favoritePaginationLoadingRef.current = true;
    setIsLoadingMoreFavorites(true);
    try {
      if (favoritePaginationFallbackModeRef.current) {
        await loadCompatibilityTail();
        return;
      }

      const cursorSnapshot = await rehydrateCursorSnapshot();
      if (!cursorSnapshot) {
        favoritePaginationNeedsServerAnchorRef.current = true;
      }
      await loadOrderedUnseenPage(cursorSnapshot);
    } catch (error) {
      console.warn('Favorites additional page load failed. Keeping the current list and retry affordance.', error);
      setHasMoreFavorites(true);
    } finally {
      favoritePaginationLoadingRef.current = false;
      setIsLoadingMoreFavorites(false);
    }
  }, [user, favoriteTotalCount]);'''
app, count = load_more_pattern.subn(load_more_replacement, app, count=1)
if count != 1:
    raise SystemExit(f"1025 loadMore replacement mismatch: {count}")

app = replace_after(
    app,
    "} else {\n        setFavorites([]);",
    "        favoritePaginationFallbackModeRef.current = false;\n"
    "        setIsFavoritesLoading(false);",
    "        favoritePaginationFallbackModeRef.current = false;\n"
    "        favoritePaginationNeedsServerAnchorRef.current = false;\n"
    "        setFavoriteTotalCount(null);\n"
    "        setIsFavoritesLoading(false);",
    "logout reset",
)

app = replace_once(
    app,
    "      hasMoreFavorites={hasMoreFavorites}\n"
    "      isLoadingMoreFavorites={isLoadingMoreFavorites}",
    "      hasMoreFavorites={hasMoreFavorites}\n"
    "      totalFavoritesCount={favoriteTotalCount}\n"
    "      isLoadingMoreFavorites={isLoadingMoreFavorites}",
    "FavoritesPage total prop",
)

favorites = replace_once(
    favorites,
    "  isFavoritesLoading = false,\n"
    "  hasMoreFavorites = false,\n"
    "  isLoadingMoreFavorites = false,",
    "  isFavoritesLoading = false,\n"
    "  hasMoreFavorites = false,\n"
    "  totalFavoritesCount = null,\n"
    "  isLoadingMoreFavorites = false,",
    "FavoritesPage prop default",
)

favorites = replace_once(
    favorites,
    "  isFavoritesLoading?: boolean;\n"
    "  hasMoreFavorites?: boolean;\n"
    "  isLoadingMoreFavorites?: boolean;",
    "  isFavoritesLoading?: boolean;\n"
    "  hasMoreFavorites?: boolean;\n"
    "  totalFavoritesCount?: number | null;\n"
    "  isLoadingMoreFavorites?: boolean;",
    "FavoritesPage prop type",
)

favorites = replace_once(
    favorites,
    "  const canShowCachedMusicNoteMore = visibleCount < filteredFavorites.length;\n"
    "  const canRequestMoreMusicNotePage = Boolean(",
    "  const musicNoteTotalCount = typeof totalFavoritesCount === 'number' && Number.isFinite(totalFavoritesCount)\n"
    "    ? Math.max(Math.max(0, Math.floor(totalFavoritesCount)), favorites.length)\n"
    "    : favorites.length;\n"
    "  const canShowCachedMusicNoteMore = visibleCount < filteredFavorites.length;\n"
    "  const canRequestMoreMusicNotePage = Boolean(",
    "Music Note total count",
)

favorites = replace_once(
    favorites,
    "                {isLoadingMoreFavorites\n"
    "                  ? '불러오는 중...'\n"
    "                  : canShowCachedMusicNoteMore\n"
    "                    ? `더보기 (${filteredFavorites.length - visibleCount}개 남음)`\n"
    "                    : musicNoteViewMode === 'noteSpace'\n"
    "                      ? '더보기 (20개 더 불러오기)'\n"
    "                      : '더보기'}",
    "                {isLoadingMoreFavorites\n"
    "                  ? `불러오는 중... (전체 ${musicNoteTotalCount}곡)`\n"
    "                  : canShowCachedMusicNoteMore\n"
    "                    ? `더보기 (${filteredFavorites.length - visibleCount}개 남음 · 전체 ${musicNoteTotalCount}곡)`\n"
    "                    : musicNoteViewMode === 'noteSpace'\n"
    "                      ? `더보기 (20개 더 불러오기 · 전체 ${musicNoteTotalCount}곡)`\n"
    "                      : `더보기 (전체 ${musicNoteTotalCount}곡)`}",
    "More button total label",
)

APP.write_text(app, encoding="utf-8")
FAVORITES.write_text(favorites, encoding="utf-8")

load_match = re.search(
    r"const loadMoreFavorites = useCallback\(async \(\) => \{(.*?)\n  \}, \[user, favoriteTotalCount\]\);",
    app,
    re.S,
)
if not load_match:
    raise SystemExit("1025 verification: loadMore block missing")
block = load_match.group(1)
if "orderBy('createdAt', 'desc')" not in block or "startAfter(scanCursor)" not in block:
    raise SystemExit("1025 verification: canonical ordered cursor chain missing")
if "bundle.cursorCreatedAtMs > 0 ? new Date" in app:
    raise SystemExit("1025 verification: timestamp-only bundle cursor still present")
if "JSON.stringify({ version: 2, id: cursorId" not in app:
    raise SystemExit("1025 verification: persisted cursor id missing")
if "totalFavoritesCount={favoriteTotalCount}" not in app:
    raise SystemExit("1025 verification: total count prop missing")
if "전체 ${musicNoteTotalCount}곡" not in favorites:
    raise SystemExit("1025 verification: total count button label missing")

print("1025 Music Note pagination continuity + total count patch applied")

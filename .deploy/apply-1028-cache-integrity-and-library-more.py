from pathlib import Path
import re

APP = Path('src/App.tsx')
LIB = Path('src/pages/SunoLibraryPage.tsx')
BUNDLE = Path('src/lib/listBundleCache.ts')

app = APP.read_text(encoding='utf-8')
lib = LIB.read_text(encoding='utf-8')
bundle = BUNDLE.read_text(encoding='utf-8')

MARKER = 'SORIDRAW_MUSIC_NOTE_CACHE_INTEGRITY_1028'
if MARKER in app:
    print('1028 already applied')
    raise SystemExit(0)

# Music Note: keep existing durable cache, but never let a stale/missing cursor
# trigger a multi-page scan. One explicit More click = one bounded 20-doc query.
marker_anchor = "const getMusicNotePayloadCacheKey = (uid: string) => `soridraw_favorites_cache_${uid}`;"
if marker_anchor not in app:
    raise SystemExit('1028 marker anchor missing')
app = app.replace(marker_anchor, marker_anchor + "\nconst SORIDRAW_MUSIC_NOTE_CACHE_INTEGRITY_1028 = true;", 1)

# Cached history must keep More available even when a later build damaged only
# pagination metadata. This does not perform a server read.
cached_pattern = re.compile(r"if \(hasCachedMusicNote\) \{\n\s+const persistedCursor = readMusicNotePaginationCursor\(currentUser\.uid\);\n\s+favoritePaginationCursorRef\.current = persistedCursor;\n\s+favoritePaginationExhaustedRef\.current = !persistedCursor;\n\s+setHasMoreFavorites\(Boolean\(persistedCursor\)\);\n\s+setIsFavoritesLoading\(false\);\n\s+\}")
m = cached_pattern.search(app)
if not m:
    raise SystemExit('1028 cached bootstrap anchor missing')
cached_new = """if (hasCachedMusicNote) {
          const persistedCursor = readMusicNotePaginationCursor(currentUser.uid);
          const cachedCount = Array.isArray(cachedFavs) ? cachedFavs.length : 0;
          let historicalMaxCount = cachedCount;
          try {
            historicalMaxCount = Math.max(
              cachedCount,
              Number(localStorage.getItem(`soridraw_favorites_cache_max_count_${currentUser.uid}`) || 0) || 0,
            );
          } catch {}
          const mayHaveCachedHistory = historicalMaxCount > cachedCount || cachedCount >= FAVORITES_PAGE_SIZE;
          favoritePaginationCursorRef.current = persistedCursor;
          favoritePaginationExhaustedRef.current = !persistedCursor && !mayHaveCachedHistory;
          setHasMoreFavorites(Boolean(persistedCursor) || mayHaveCachedHistory);
          setIsFavoritesLoading(false);
        }"""
app = app[:m.start()] + cached_new + app[m.end():]

# Canonical first-page source uses the same persisted chronological axis as More.
fetch_start = app.find('// Fetch favorites for the user.')
load_start = app.find('  const loadMoreFavorites = useCallback(async () => {', fetch_start)
if fetch_start < 0 or load_start < 0:
    raise SystemExit('1028 favorites region missing')
region = app[fetch_start:load_start]
region = region.replace("orderBy('createdAt', 'desc')", "orderBy('createdAtMs', 'desc')")
# The bounded fallback first page used to be unordered. Make only favorites fallback ordered.
region = region.replace(
    "where('uid', '==', currentUser.uid),\n              limit(FAVORITES_PAGE_SIZE),",
    "where('uid', '==', currentUser.uid),\n              orderBy('createdAtMs', 'desc'),\n              limit(FAVORITES_PAGE_SIZE),",
)
app = app[:fetch_start] + region + app[load_start:]

load_pattern = re.compile(r"  const loadMoreFavorites = useCallback\(async \(\) => \{.*?\n  \}, \[user\]\);", re.S)
load_new = r'''  const loadMoreFavorites = useCallback(async () => {
    const currentUser = user || auth.currentUser;
    if (!currentUser?.uid) return;
    if (favoritePaginationLoadingRef.current) return;

    const uid = currentUser.uid;
    const getFavoriteId = (favorite: any) => String(favorite?.id || favorite?.firestoreId || '').trim();
    const currentFavorites = (favoritesStore.getFavorites() || []).filter((favorite: any) => !isFavoriteSoftRemoved(favorite));
    const loadedIds = new Set(currentFavorites.map(getFavoriteId).filter(Boolean));

    const cursorValue: any = favoritePaginationCursorRef.current;
    const cursorData = cursorValue && typeof cursorValue?.data === 'function' ? cursorValue.data() : null;
    let cursorMs = cursorValue instanceof Date
      ? cursorValue.getTime()
      : Number(cursorData?.createdAtMs || cursorValue?.createdAtMs || 0);

    if (!Number.isFinite(cursorMs) || cursorMs <= 0) {
      cursorMs = currentFavorites.reduce((oldest: number, favorite: any) => {
        const explicit = Number(favorite?.createdAtMs || 0);
        const value = Number.isFinite(explicit) && explicit > 0 ? explicit : getTimestampMs(favorite?.createdAt);
        if (!Number.isFinite(value) || value <= 0) return oldest;
        return oldest <= 0 ? value : Math.min(oldest, value);
      }, 0);
    }

    if (!Number.isFinite(cursorMs) || cursorMs <= 0) {
      favoritePaginationExhaustedRef.current = true;
      setHasMoreFavorites(false);
      console.warn('Music Note 1028: no safe chronological cursor; refusing recovery scan.');
      return;
    }

    favoritePaginationLoadingRef.current = true;
    setIsLoadingMoreFavorites(true);
    try {
      const snapshot = await getDocs(query(
        collection(db, 'favorites'),
        where('uid', '==', uid),
        orderBy('createdAtMs', 'desc'),
        startAfter(cursorMs),
        limit(FAVORITES_PAGE_SIZE),
      ));
      const docs = snapshot.docs.slice(0, FAVORITES_PAGE_SIZE);
      const page: any[] = [];
      for (const docSnap of docs) {
        const favorite = mapFavoriteFirestoreDoc(docSnap);
        if (isFavoriteSoftRemoved(favorite)) continue;
        const favoriteId = getFavoriteId(favorite);
        if (favoriteId && isFavoriteDeletedTombstoned(uid, favoriteId)) continue;
        if (favoriteId && loadedIds.has(favoriteId)) continue;
        if (favoriteId) loadedIds.add(favoriteId);
        page.push(favorite);
      }

      if (page.length > 0) {
        setFavorites((prev) => {
          const merged = mergeFavoritePages(prev || [], page);
          writeFavoritesCache(uid, merged);
          return merged;
        });
      }

      if (docs.length > 0) {
        const lastDoc = docs[docs.length - 1];
        const lastData = lastDoc.data();
        const lastMs = Number(lastData?.createdAtMs || 0) || getTimestampMs(lastData?.createdAt);
        if (lastMs > 0) favoritePaginationCursorRef.current = new Date(lastMs);
        writeMusicNotePaginationCursor(uid, lastDoc);
      }

      const exhausted = docs.length < FAVORITES_PAGE_SIZE;
      favoritePaginationExhaustedRef.current = exhausted;
      setHasMoreFavorites(!exhausted);
      if (exhausted) clearMusicNotePaginationCursor(uid);
    } catch (error) {
      console.warn('Music Note 1028 bounded More failed; keeping cache.', error);
      setHasMoreFavorites(true);
    } finally {
      favoritePaginationLoadingRef.current = false;
      setIsLoadingMoreFavorites(false);
    }
  }, [user]);'''
app, n = load_pattern.subn(load_new, app, count=1)
if n != 1:
    raise SystemExit(f'1028 loadMore replacement mismatch: {n}')

# Library: a stale bundle hasMore=false must never erase older durable rows or
# hide More when a full page / older cache already proves continuation exists.
old_retained = """    if (!id || incomingIds.has(id)) return false;
    if (!hasMore) return false;
    const createdAtMs = getLibraryWorkspaceTrackCreatedAtMs(track);
    return cursorCreatedAtMs <= 0 || createdAtMs < cursorCreatedAtMs;"""
new_retained = """    if (!id || incomingIds.has(id)) return false;
    const createdAtMs = getLibraryWorkspaceTrackCreatedAtMs(track);
    return cursorCreatedAtMs <= 0 || createdAtMs < cursorCreatedAtMs;"""
if old_retained not in lib:
    raise SystemExit('1028 library retain anchor missing')
lib = lib.replace(old_retained, new_retained, 1)

old_bundle_more = """        session.lastDoc = bundle.cursorCreatedAtMs > 0 ? new Date(bundle.cursorCreatedAtMs) : null;
        session.hasMore = bundle.hasMore;
        session.paginationFallback = false;"""
new_bundle_more = """        session.lastDoc = bundle.cursorCreatedAtMs > 0 ? new Date(bundle.cursorCreatedAtMs) : null;
        const hasOlderCachedRows = session.tracks.length > list.length;
        session.hasMore = Boolean(bundle.hasMore || hasOlderCachedRows || list.length >= WORKSPACE_SERVER_PAGE_SIZE);
        session.paginationFallback = false;"""
if old_bundle_more not in lib:
    raise SystemExit('1028 library hasMore anchor missing')
lib = lib.replace(old_bundle_more, new_bundle_more, 1)

# Bundle writer: do not package soft-removed Music Note rows into latest-20 cache.
prepare_anchor = """const prepareItems = (kind: ListBundleKind, sourceItems: any[], limit: number): any[] => {
  const sorted = [...(Array.isArray(sourceItems) ? sourceItems : [])]
    .filter(Boolean)"""
prepare_new = """const prepareItems = (kind: ListBundleKind, sourceItems: any[], limit: number): any[] => {
  const sorted = [...(Array.isArray(sourceItems) ? sourceItems : [])]
    .filter(Boolean)
    .filter((item) => kind !== 'musicNote' || !(
      item?.favoriteRemoved === true
      || item?.saved === false
      || item?.hidden === true
      || item?.favoriteHidden === true
      || item?.deletedAt
      || item?.trashedAt
    ))"""
if prepare_anchor not in bundle:
    raise SystemExit('1028 bundle prepare anchor missing')
bundle = bundle.replace(prepare_anchor, prepare_new, 1)

APP.write_text(app, encoding='utf-8')
LIB.write_text(lib, encoding='utf-8')
BUNDLE.write_text(bundle, encoding='utf-8')

# Static guarantees.
app2 = APP.read_text(encoding='utf-8')
ls = app2.index('  const loadMoreFavorites = useCallback(async () => {')
le = app2.index('  const syncMusicNoteIncrementalFromRemoteVersion', ls)
block = app2[ls:le]
if block.count('await getDocs(') != 1:
    raise SystemExit(f'1028 guard: More getDocs count {block.count("await getDocs(")}')
for forbidden in ('while (', 'maxScanPages', 'loadCompatibilityTail'):
    if forbidden in block:
        raise SystemExit(f'1028 guard: forbidden scanner {forbidden}')
if "orderBy('createdAtMs', 'desc')" not in block or 'limit(FAVORITES_PAGE_SIZE)' not in block:
    raise SystemExit('1028 guard: canonical bounded query missing')
if "session.hasMore = Boolean(bundle.hasMore || hasOlderCachedRows || list.length >= WORKSPACE_SERVER_PAGE_SIZE);" not in LIB.read_text(encoding='utf-8'):
    raise SystemExit('1028 guard: library continuation missing')
print('1028 CACHE_INTEGRITY_MORE_LIBRARY=PASS')

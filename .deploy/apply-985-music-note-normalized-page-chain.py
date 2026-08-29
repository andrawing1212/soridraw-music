from pathlib import Path

MARKER = 'SORIDRAW_985_MUSIC_NOTE_NORMALIZED_PAGE_CHAIN'
path = Path('src/App.tsx')
text = path.read_text(encoding='utf-8')

if MARKER in text:
    print('SORIDRAW 985 already applied; no-op')
    raise SystemExit(0)

if 'SORIDRAW_983_MUSIC_NOTE_CURSOR_CHAIN_REPAIR' not in text:
    raise SystemExit('985 requires SORIDRAW 983 generated source first')

start_anchor = '  const loadMoreFavorites = useCallback(async () => {'
end_anchor = '  const syncMusicNoteIncrementalFromRemoteVersion = useCallback'
start = text.find(start_anchor)
end = text.find(end_anchor, start)
if start < 0 or end < 0:
    raise SystemExit(f'985 loadMore block anchor mismatch: start={start} end={end}')

replacement = r'''  const loadMoreFavorites = useCallback(async () => {
    const currentUser = user || auth.currentUser;
    if (!currentUser?.uid) return;
    if (favoritePaginationLoadingRef.current) return;

    // SORIDRAW_985_MUSIC_NOTE_NORMALIZED_PAGE_CHAIN
    // Legacy `createdAt` contains mixed Firestore value types, so it cannot be a
    // chronological pagination axis. `createdAtMs` is numeric for the legacy and
    // current rows and is backed by the dedicated uid + createdAtMs index.
    //
    // Each click returns 20 *active* saved songs. Soft-removed rows are consumed
    // only as cursor material and never count toward the visible 20-song batch.
    const fetchActivePage = async (startCursor: any) => {
      const activeItems: any[] = [];
      let scanCursor: any = startCursor || null;
      let lastConsumedCursor: any = startCursor || null;
      let hasMoreRaw = true;
      let pass = 0;

      while (activeItems.length < FAVORITES_PAGE_SIZE && hasMoreRaw && pass < 50) {
        pass += 1;
        const pageQuery = scanCursor
          ? query(
              collection(db, 'favorites'),
              where('uid', '==', currentUser.uid),
              orderBy('createdAtMs', 'desc'),
              startAfter(scanCursor),
              limit(FAVORITES_PAGE_SIZE + 1)
            )
          : query(
              collection(db, 'favorites'),
              where('uid', '==', currentUser.uid),
              orderBy('createdAtMs', 'desc'),
              limit(FAVORITES_PAGE_SIZE + 1)
            );

        const snapshot = await getDocs(pageQuery);
        const rawDocs = snapshot.docs.slice(0, FAVORITES_PAGE_SIZE);
        const batchHasMore = snapshot.docs.length > FAVORITES_PAGE_SIZE;
        if (rawDocs.length === 0) {
          hasMoreRaw = false;
          break;
        }

        let filledInsideBatch = false;
        for (let index = 0; index < rawDocs.length; index += 1) {
          const docSnap: any = rawDocs[index];
          lastConsumedCursor = docSnap;
          const mapped: any = mapFavoriteFirestoreDoc(docSnap);
          if (!isFavoriteSoftRemoved(mapped)) {
            activeItems.push(mapped);
            if (activeItems.length >= FAVORITES_PAGE_SIZE) {
              hasMoreRaw = index < rawDocs.length - 1 || batchHasMore;
              filledInsideBatch = true;
              break;
            }
          }
        }

        if (filledInsideBatch) break;
        scanCursor = rawDocs[rawDocs.length - 1];
        lastConsumedCursor = scanCursor;
        hasMoreRaw = batchHasMore;
      }

      if (pass >= 50 && activeItems.length < FAVORITES_PAGE_SIZE) {
        console.warn('Music Note normalized pagination safety pass limit reached.');
      }

      return {
        items: activeItems,
        cursor: lastConsumedCursor,
        hasMore: hasMoreRaw,
      };
    };

    favoritePaginationLoadingRef.current = true;
    setIsLoadingMoreFavorites(true);
    try {
      if (favoritePaginationCanonicalAnchorUidRef.current !== currentUser.uid) {
        favoritePaginationCanonicalAnchorUidRef.current = currentUser.uid;
        favoritePaginationCanonicalAnchorVerifiedRef.current = false;
      }

      let baseItems = favoritesStore.getFavorites();
      let cursor = favoritePaginationCursorRef.current;
      let canContinue = true;

      // First More click: throw away the stale local/bundle cursor and rebuild the
      // visible latest 20 from the normalized server axis. The same click then
      // appends the next active 20, so the UI moves 20 -> 40 in chronological order.
      if (!favoritePaginationCanonicalAnchorVerifiedRef.current) {
        const firstPage = await fetchActivePage(null);
        baseItems = firstPage.items;
        setFavorites(baseItems);
        writeFavoritesCache(currentUser.uid, baseItems);
        cursor = firstPage.cursor;
        favoritePaginationCursorRef.current = cursor;
        favoritePaginationCanonicalAnchorVerifiedRef.current = true;
        favoritePaginationFallbackModeRef.current = false;
        canContinue = firstPage.hasMore && Boolean(cursor);

        if (!canContinue) {
          favoritePaginationExhaustedRef.current = true;
          setHasMoreFavorites(false);
          markCacheDiagnostic('musicNote', 'SYNC', baseItems.length);
          return;
        }
      }

      const nextPage = await fetchActivePage(cursor);
      if (nextPage.items.length > 0) {
        const merged = mergeFavoritePages(baseItems, nextPage.items);
        setFavorites(merged);
        writeFavoritesCache(currentUser.uid, merged);
        baseItems = merged;
      }

      favoritePaginationCursorRef.current = nextPage.cursor || cursor;
      favoritePaginationFallbackModeRef.current = false;
      favoritePaginationExhaustedRef.current = !nextPage.hasMore;
      setHasMoreFavorites(nextPage.hasMore);
      markCacheDiagnostic('musicNote', 'SYNC', nextPage.items.length);
    } catch (error) {
      console.warn('Music Note normalized pagination failed; keeping retry available.', error);
      favoritePaginationExhaustedRef.current = false;
      favoritePaginationFallbackModeRef.current = false;
      setHasMoreFavorites(true);
    } finally {
      favoritePaginationLoadingRef.current = false;
      setIsLoadingMoreFavorites(false);
    }
  }, [user, setFavorites]);

'''

text = text[:start] + replacement + text[end:]

block_start = text.find(start_anchor)
block_end = text.find(end_anchor, block_start)
block = text[block_start:block_end]
required = [
    MARKER,
    "orderBy('createdAtMs', 'desc')",
    'const fetchActivePage = async (startCursor: any) => {',
    'if (!isFavoriteSoftRemoved(mapped))',
    'setFavorites(baseItems);',
    'const merged = mergeFavoritePages(baseItems, nextPage.items);',
    'favoritePaginationCursorRef.current = nextPage.cursor || cursor;',
]
for fragment in required:
    if fragment not in block:
        raise SystemExit(f'985 safety failed: missing {fragment}')
if "orderBy('createdAt', 'desc')" in block:
    raise SystemExit('985 safety failed: mixed-type createdAt pagination remains in loadMore block')

path.write_text(text, encoding='utf-8')
print('Applied SORIDRAW 985: normalized createdAtMs Music Note paging, 20 active songs per click, chronological append, no Firestore mutation.')

from pathlib import Path
import re

APP = Path('src/App.tsx')
VERIFY = Path('scripts/verify-music-note-pagination-order.mjs')
MARKER = 'SORIDRAW_MUSIC_NOTE_CACHE_FIRST_BOUNDED_MORE_1027'

app = APP.read_text(encoding='utf-8')

if MARKER not in app:
    anchor = "const SORIDRAW_MUSIC_NOTE_ORDER_AXIS_REPAIR_1026 = true;"
    if app.count(anchor) != 1:
        raise SystemExit(f'1027 marker anchor mismatch: {app.count(anchor)}')
    app = app.replace(anchor, anchor + f"\nconst {MARKER} = true;", 1)

    # Keep the deepest already-established pagination cursor when the latest-20
    # bundle refreshes. The bundle is a first-page cache, not pagination owner.
    bundle_old = '''              const bundleCursorFavorite = firstPageFavs[firstPageFavs.length - 1];
              const bundleCursorId = String(bundleCursorFavorite?.id || bundleCursorFavorite?.firestoreId || '').trim();
              favoritePaginationCursorRef.current = bundle.hasMore && bundleCursorId
                ? { id: bundleCursorId, createdAtMs: Number(bundle.cursorCreatedAtMs || 0), legacy: false }
                : null;
              favoritePaginationExhaustedRef.current = !bundle.hasMore;
              favoritePaginationFallbackModeRef.current = false;
              favoritePaginationNeedsServerAnchorRef.current = Boolean(bundle.hasMore && !bundleCursorId);
              setHasMoreFavorites(bundle.hasMore);'''
    bundle_new = '''              const bundleCursorFavorite = firstPageFavs[firstPageFavs.length - 1];
              const bundleCursorId = String(bundleCursorFavorite?.id || bundleCursorFavorite?.firestoreId || '').trim();
              const bundleCursorMs = Number(bundle.cursorCreatedAtMs || 0);
              const existingCursor = favoritePaginationCursorRef.current;
              const existingCursorData = typeof existingCursor?.data === 'function' ? existingCursor.data() : null;
              const existingCursorId = String(existingCursor?.id || '').trim();
              const existingCursorMs = Number(existingCursor?.createdAtMs || existingCursorData?.createdAtMs || 0);
              if (
                bundle.hasMore
                && bundleCursorId
                && bundleCursorMs > 0
                && (!existingCursorId || existingCursorMs <= 0 || bundleCursorMs < existingCursorMs)
              ) {
                favoritePaginationCursorRef.current = {
                  id: bundleCursorId,
                  createdAtMs: bundleCursorMs,
                  legacy: false,
                };
              }
              const effectiveCursorId = String(favoritePaginationCursorRef.current?.id || '').trim();
              favoritePaginationExhaustedRef.current = !bundle.hasMore && !effectiveCursorId;
              favoritePaginationFallbackModeRef.current = false;
              favoritePaginationNeedsServerAnchorRef.current = Boolean(bundle.hasMore && !effectiveCursorId);
              setHasMoreFavorites(Boolean(bundle.hasMore || effectiveCursorId));'''
    if app.count(bundle_old) != 1:
        raise SystemExit(f'1027 bundle cursor anchor mismatch: {app.count(bundle_old)}')
    app = app.replace(bundle_old, bundle_new, 1)

    load_pattern = re.compile(
        r"  const loadMoreFavorites = useCallback\(async \(\) => \{.*?\n  \}, \[user, favoriteTotalCount\]\);",
        re.S,
    )
    load_new = r'''  const loadMoreFavorites = useCallback(async () => {
    const currentUser = user || auth.currentUser;
    if (!currentUser?.uid) return;
    if (favoritePaginationLoadingRef.current) return;

    const uid = currentUser.uid;
    const getFavoriteId = (favorite: any) =>
      String(favorite?.id || favorite?.firestoreId || '').trim();
    const getFavoriteCreatedAtMsForPagination = (favorite: any) => {
      const explicitMs = Number(favorite?.createdAtMs || 0);
      if (Number.isFinite(explicitMs) && explicitMs > 0) return explicitMs;
      return getTimestampMs(favorite?.createdAt);
    };

    const currentFavorites = (favoritesStore.getFavorites() || [])
      .filter((favorite: any) => !isFavoriteSoftRemoved(favorite));
    const loadedIds = new Set(currentFavorites.map(getFavoriteId).filter(Boolean));

    const cachedProfile = readUserProfileCache(uid) as any;
    const stateTotal = Number(favoriteTotalCount);
    const cachedTotal = Number(cachedProfile?.favoriteCount);
    const trustedTotalCount = Number.isFinite(stateTotal) && stateTotal >= loadedIds.size
      ? Math.floor(stateTotal)
      : Number.isFinite(cachedTotal) && cachedTotal >= loadedIds.size
        ? Math.floor(cachedTotal)
        : null;

    if (trustedTotalCount !== null && loadedIds.size >= trustedTotalCount) {
      favoritePaginationExhaustedRef.current = true;
      setHasMoreFavorites(false);
      clearMusicNotePaginationCursor(uid);
      return;
    }

    // 1027: legacy compatibility scanning is intentionally disabled. One click
    // may issue at most one bounded page query (plus one exact cursor rehydrate).
    if (favoritePaginationFallbackModeRef.current) {
      console.warn('Music Note legacy compatibility scanner is disabled; keeping persistent cache only.');
      favoritePaginationExhaustedRef.current = true;
      setHasMoreFavorites(false);
      return;
    }

    let cursor: any = favoritePaginationCursorRef.current;
    let cursorId = String(cursor?.id || '').trim();

    // One-time local migration for devices that have a persistent history cache
    // but no v2 cursor. Use the oldest cached createdAtMs row as the continuation
    // anchor instead of replaying all already-cached pages from the server.
    if (!cursorId) {
      const localCursorCandidates = currentFavorites
        .map((favorite: any) => ({
          favorite,
          id: getFavoriteId(favorite),
          createdAtMs: getFavoriteCreatedAtMsForPagination(favorite),
        }))
        .filter((item: any) => item.id && item.createdAtMs > 0)
        .sort((a: any, b: any) => b.createdAtMs - a.createdAtMs);
      const oldestCached = localCursorCandidates[localCursorCandidates.length - 1];
      if (oldestCached) {
        cursor = { id: oldestCached.id, createdAtMs: oldestCached.createdAtMs, legacy: false };
        cursorId = oldestCached.id;
        favoritePaginationCursorRef.current = cursor;
      }
    }

    if (!cursorId) {
      favoritePaginationExhaustedRef.current = true;
      setHasMoreFavorites(false);
      console.warn('Music Note continuation cursor is unavailable; refusing an unbounded recovery scan.');
      return;
    }

    favoritePaginationLoadingRef.current = true;
    setIsLoadingMoreFavorites(true);
    try {
      let cursorSnapshot = cursor && typeof cursor.data === 'function' ? cursor : null;
      if (!cursorSnapshot) {
        const exactCursor = await getDoc(doc(db, 'favorites', cursorId));
        if (!exactCursor.exists()) {
          favoritePaginationExhaustedRef.current = true;
          setHasMoreFavorites(false);
          clearMusicNotePaginationCursor(uid);
          return;
        }
        const cursorData = exactCursor.data();
        if (String(cursorData?.uid || '') !== uid || Number(cursorData?.createdAtMs || 0) <= 0) {
          favoritePaginationExhaustedRef.current = true;
          setHasMoreFavorites(false);
          clearMusicNotePaginationCursor(uid);
          return;
        }
        cursorSnapshot = exactCursor;
      }

      const snapshot = await getDocs(query(
        collection(db, 'favorites'),
        where('uid', '==', uid),
        orderBy('createdAtMs', 'desc'),
        startAfter(cursorSnapshot),
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
        favoritePaginationCursorRef.current = lastDoc;
        writeMusicNotePaginationCursor(uid, lastDoc);
      }

      const exhausted = docs.length < FAVORITES_PAGE_SIZE;
      favoritePaginationExhaustedRef.current = exhausted;
      const hasMoreByCount = trustedTotalCount === null || loadedIds.size < trustedTotalCount;
      const hasMore = !exhausted && hasMoreByCount;
      setHasMoreFavorites(hasMore);

      if (!hasMore) {
        clearMusicNotePaginationCursor(uid);
      }
      if (exhausted && trustedTotalCount !== null && loadedIds.size < trustedTotalCount) {
        console.warn(
          `Music Note createdAtMs pagination ended at ${loadedIds.size}/${trustedTotalCount}; `
          + 'legacy full-scan recovery remains disabled for cost safety.',
        );
      }
    } catch (error) {
      console.warn('Favorites bounded additional page load failed. Keeping cache and retry affordance.', error);
      setHasMoreFavorites(true);
    } finally {
      favoritePaginationLoadingRef.current = false;
      setIsLoadingMoreFavorites(false);
    }
  }, [user, favoriteTotalCount]);'''
    app, count = load_pattern.subn(load_new, app, count=1)
    if count != 1:
        raise SystemExit(f'1027 loadMore replacement mismatch: {count}')

APP.write_text(app, encoding='utf-8')

VERIFY.write_text(r'''import fs from 'node:fs';
const app = fs.readFileSync('src/App.tsx', 'utf8');
if (!app.includes('SORIDRAW_MUSIC_NOTE_ORDER_AXIS_REPAIR_1026')) throw new Error('1026 marker missing');
if (!app.includes('SORIDRAW_MUSIC_NOTE_CACHE_FIRST_BOUNDED_MORE_1027')) throw new Error('1027 marker missing');

const fallbackStart = app.indexOf('const fallbackSnapshot = await getDocs(query(');
const fallbackEnd = app.indexOf('));', fallbackStart) + 3;
const fallback = app.slice(fallbackStart, fallbackEnd);
if (!fallback.includes("orderBy('createdAtMs', 'desc')")) throw new Error('bounded first-page fallback is unordered');

const bootstrapStart = app.indexOf('const attachFavoritesSourceBootstrap902 = () => {');
const bootstrapEnd = app.indexOf('let musicNoteBundleMissingHandled', bootstrapStart);
const bootstrap = app.slice(bootstrapStart, bootstrapEnd);
if (!bootstrap.includes("orderBy('createdAtMs', 'desc')")) throw new Error('bootstrap not createdAtMs ordered');
if (bootstrap.includes("orderBy('createdAt', 'desc')")) throw new Error('bootstrap still uses createdAt');

const loadStart = app.indexOf('  const loadMoreFavorites = useCallback(async () => {');
const loadEnd = app.indexOf('  const syncMusicNoteIncrementalFromRemoteVersion = useCallback', loadStart);
if (loadStart < 0 || loadEnd < 0) throw new Error('loadMoreFavorites block missing');
const block = app.slice(loadStart, loadEnd);
if (block.includes("orderBy('createdAt', 'desc')")) throw new Error('mixed createdAt order remains in loadMore');
if (!block.includes("orderBy('createdAtMs', 'desc')")) throw new Error('loadMore is not createdAtMs ordered');
if (!block.includes('startAfter(cursorSnapshot)')) throw new Error('loadMore cursor chain missing');
if (!block.includes('limit(FAVORITES_PAGE_SIZE)')) throw new Error('loadMore page limit missing');
if (!block.includes('readUserProfileCache(uid)')) throw new Error('cached profile total fallback missing');
if (block.includes('while (')) throw new Error('multi-page scan loop remains in loadMore');
if (block.includes('maxScanPages')) throw new Error('multi-page scan budget remains in loadMore');
if (block.includes('loadCompatibilityTail')) throw new Error('compatibility scanner remains in loadMore');
const getDocsCount = (block.match(/await getDocs\(/g) || []).length;
if (getDocsCount !== 1) throw new Error(`expected exactly one bounded getDocs in loadMore, got ${getDocsCount}`);
if (!app.includes('bundleCursorMs < existingCursorMs')) throw new Error('latest bundle can still reset deep pagination cursor');
console.log('MUSIC_NOTE_PAGINATION_ORDER_GUARD=PASS');
console.log('MUSIC_NOTE_1027_BOUNDED_MORE_GUARD=PASS');
''', encoding='utf-8')

final_app = APP.read_text(encoding='utf-8')
load_start = final_app.find('  const loadMoreFavorites = useCallback(async () => {')
load_end = final_app.find('  const syncMusicNoteIncrementalFromRemoteVersion = useCallback', load_start)
if load_start < 0 or load_end < 0:
    raise SystemExit('1027 static guard: loadMore block missing')
block = final_app[load_start:load_end]
if block.count('await getDocs(') != 1:
    raise SystemExit(f"1027 static guard: expected 1 getDocs, got {block.count('await getDocs(')}")
for forbidden in ('while (', 'maxScanPages', 'loadCompatibilityTail'):
    if forbidden in block:
        raise SystemExit(f'1027 static guard: forbidden scanner remains: {forbidden}')
if "orderBy('createdAtMs', 'desc')" not in block:
    raise SystemExit('1027 static guard: createdAtMs order missing')

print('1027 Music Note cache-first bounded pagination applied')

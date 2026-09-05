from pathlib import Path

APP = Path('src/App.tsx')
FAV = Path('src/pages/FavoritesPage.tsx')
LIB = Path('src/pages/SunoLibraryPage.tsx')
BUNDLE = Path('src/lib/listBundleCache.ts')

app = APP.read_text(encoding='utf-8')
fav = FAV.read_text(encoding='utf-8')
lib = LIB.read_text(encoding='utf-8')
bundle = BUNDLE.read_text(encoding='utf-8')

MARKER = 'SORIDRAW_MUSIC_NOTE_FIRST_BUNDLE_INTEGRITY_1029'
if MARKER in app:
    print('1029 already applied')
    raise SystemExit(0)

# ---------------------------------------------------------------------------
# Music Note: a fresh/incognito browser MUST read the one-document First Bundle.
# The old condition did the opposite: it verified only when a local payload cache
# already existed, so cacheless browsers skipped the First Bundle entirely.
# ---------------------------------------------------------------------------
anchor = "  const FAVORITES_PAGE_SIZE = 20;"
if anchor not in app:
    raise SystemExit('1029 page size anchor missing')
app = app.replace(anchor, anchor + "\n  const SORIDRAW_MUSIC_NOTE_FIRST_BUNDLE_INTEGRITY_1029 = true;", 1)

old = """        const shouldVerifyMusicNoteBundle = hasCachedMusicNote && (
          musicNoteLocalVersionAtBootstrap <= 0
          || musicNoteRemoteVersionAtBootstrap > musicNoteLocalVersionAtBootstrap
        );"""
new = """        const shouldVerifyMusicNoteBundle = !hasCachedMusicNote || (
          musicNoteLocalVersionAtBootstrap <= 0
          || musicNoteRemoteVersionAtBootstrap > musicNoteLocalVersionAtBootstrap
        );"""
if old not in app:
    raise SystemExit('1029 cacheless First Bundle condition missing')
app = app.replace(old, new, 1)

# Note Space visibility differs from soft-remove semantics: trash/hidden rows
# must remain in the local payload for Trash view, but must not count toward the
# 20 visible songs of the First Bundle.
old = """  const isFavoriteSoftRemoved = (favorite: any) => Boolean(
    favorite?.favoriteRemoved === true
    || favorite?.saved === false
    || favorite?.favoriteRemovedAt
    || favorite?.unlikedAt
    || favorite?.unsavedAt
  );"""
new = old + """
  const isFavoriteVisibleInNoteSpace = (favorite: any) => Boolean(
    favorite
    && !isFavoriteSoftRemoved(favorite)
    && favorite?.hidden !== true
    && favorite?.favoriteHidden !== true
    && !favorite?.deletedAt
    && !favorite?.trashedAt
  );"""
if old not in app:
    raise SystemExit('1029 favorite visibility anchor missing')
app = app.replace(old, new, 1)

# Allow a bounded source bootstrap to be forced only when the First Bundle is
# missing/corrupt and there is not enough trusted local cache. The cold recovery
# is fixed at 60 raw docs, once, with no loop/full scan. It immediately rebuilds
# a clean latest-20 First Bundle so later browsers return to one bundle read.
start = app.find('        const attachFavoritesSourceBootstrap902 = () => {')
end_marker = '\n\n        let musicNoteBundleMissingHandled = false;'
end = app.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('1029 source bootstrap block missing')
source_bootstrap = r'''        let favoritesSourceBootstrapInFlight1029 = false;
        const attachFavoritesSourceBootstrap902 = (forceRepair = false) => {
          if (favoritesSourceBootstrapInFlight1029 || unsubFavs || (!forceRepair && hasCachedMusicNote) || musicNoteCacheNeedsFullBootstrap) return;
          favoritesSourceBootstrapInFlight1029 = true;
          const recoveryLimit = FAVORITES_PAGE_SIZE * 3;
          void (async () => {
            try {
              const snapshot = await getDocs(query(
                collection(db, 'favorites'),
                where('uid', '==', currentUser.uid),
                orderBy('createdAtMs', 'desc'),
                limit(recoveryLimit),
              ));
              if (auth.currentUser?.uid !== currentUser.uid) return;
              const sourceDocs = snapshot.docs.slice(0, recoveryLimit);
              const localDeletedIds = getFavoriteDeletedTombstoneIds(currentUser.uid);
              const sourceFavorites = sourceDocs
                .map(mapFavoriteFirestoreDoc)
                .filter((favorite: any) => {
                  if (isFavoriteSoftRemoved(favorite)) return false;
                  const favoriteId = String(favorite?.id || favorite?.firestoreId || '').trim();
                  return !favoriteId || !localDeletedIds.has(favoriteId);
                });
              const visibleFavorites = sortFavoriteList(sourceFavorites.filter(isFavoriteVisibleInNoteSpace));

              const lastDoc = sourceDocs[sourceDocs.length - 1] || null;
              favoritePaginationCursorRef.current = lastDoc;
              if (lastDoc) writeMusicNotePaginationCursor(currentUser.uid, lastDoc);
              else clearMusicNotePaginationCursor(currentUser.uid);
              const exhausted = sourceDocs.length < recoveryLimit;
              favoritePaginationExhaustedRef.current = exhausted;
              favoritePaginationFallbackModeRef.current = false;
              setHasMoreFavorites(!exhausted);

              setFavorites((prev) => {
                const merged = mergeFavoriteFirstPageWithCache(sourceFavorites, Array.isArray(prev) ? prev : [], exhausted);
                writeFavoritesCache(currentUser.uid, merged);
                return merged;
              });

              // Only a validated 20-visible-row page may repair the shared First Bundle.
              if (visibleFavorites.length >= FAVORITES_PAGE_SIZE) {
                scheduleListBundleWrite('musicNote', currentUser.uid, visibleFavorites, {
                  limit: FAVORITES_PAGE_SIZE,
                  hasMore: !exhausted || visibleFavorites.length > FAVORITES_PAGE_SIZE,
                  deletedIds: Array.from(localDeletedIds),
                });
              }
              markCacheDiagnostic('musicNote', 'SYNC', sourceDocs.length);
            } catch (error) {
              console.warn('Music Note bounded cold repair failed. Keeping local cache without scanning.', error);
              setHasMoreFavorites(false);
            } finally {
              favoritesSourceBootstrapInFlight1029 = false;
              setIsFavoritesLoading(false);
            }
          })();
        };'''
app = app[:start] + source_bootstrap + app[end:]

# First Bundle integrity. If a bad bundle contains <20 rows that are actually
# visible in Note Space, heal from existing local cache at zero favorite reads.
# A truly cacheless browser does exactly ONE 20-doc continuation read from the
# bundle cursor, then rewrites the clean First Bundle. No repeated scan.
ondata_old = """              const firstPageFavs = (bundle.items || []).filter((favorite: any) => {
                if (isFavoriteSoftRemoved(favorite)) return false;
                const favoriteId = String(favorite?.id || favorite?.firestoreId || '').trim();
                return !favoriteId || !localDeletedIds.has(favoriteId);
              });
              favoritePaginationCursorRef.current = bundle.cursorCreatedAtMs > 0 ? new Date(bundle.cursorCreatedAtMs) : null;
              favoritePaginationExhaustedRef.current = !bundle.hasMore;
              favoritePaginationFallbackModeRef.current = false;
              setHasMoreFavorites(bundle.hasMore);"""
ondata_new = """              const firstPageFavs = (bundle.items || []).filter((favorite: any) => {
                if (isFavoriteSoftRemoved(favorite)) return false;
                const favoriteId = String(favorite?.id || favorite?.firestoreId || '').trim();
                return !favoriteId || !localDeletedIds.has(favoriteId);
              });
              const firstPageVisibleFavs = sortFavoriteList(firstPageFavs.filter(isFavoriteVisibleInNoteSpace));
              const cachedVisibleFavs = sortFavoriteList((cachedFavs || []).filter((favorite: any) => {
                if (!isFavoriteVisibleInNoteSpace(favorite)) return false;
                const favoriteId = String(favorite?.id || favorite?.firestoreId || '').trim();
                return !favoriteId || !localDeletedIds.has(favoriteId);
              }));

              if (firstPageVisibleFavs.length < FAVORITES_PAGE_SIZE) {
                if (cachedVisibleFavs.length >= FAVORITES_PAGE_SIZE) {
                  const repairedCache = mergeFavoritePages(cachedFavs || [], firstPageFavs);
                  setFavorites(repairedCache);
                  writeFavoritesCache(currentUser.uid, repairedCache);
                  favoritePaginationFallbackModeRef.current = false;
                  favoritePaginationExhaustedRef.current = false;
                  setHasMoreFavorites(true);
                  scheduleListBundleWrite('musicNote', currentUser.uid, cachedVisibleFavs, {
                    limit: FAVORITES_PAGE_SIZE,
                    hasMore: cachedVisibleFavs.length > FAVORITES_PAGE_SIZE,
                    deletedIds: Array.from(localDeletedIds),
                  });
                  markCacheDiagnostic('musicNote', meta.fromCache ? 'CACHE' : 'SYNC', meta.fromCache ? 0 : 1);
                  setIsFavoritesLoading(false);
                  return;
                }

                const repairCursorMs = Number(bundle.cursorCreatedAtMs || 0);
                if (repairCursorMs > 0) {
                  favoritePaginationFallbackModeRef.current = false;
                  setIsFavoritesLoading(true);
                  void (async () => {
                    try {
                      const repairSnapshot = await getDocs(query(
                        collection(db, 'favorites'),
                        where('uid', '==', currentUser.uid),
                        orderBy('createdAtMs', 'desc'),
                        startAfter(repairCursorMs),
                        limit(FAVORITES_PAGE_SIZE),
                      ));
                      if (auth.currentUser?.uid !== currentUser.uid) return;
                      const repairDocs = repairSnapshot.docs.slice(0, FAVORITES_PAGE_SIZE);
                      const repairFavs = repairDocs
                        .map(mapFavoriteFirestoreDoc)
                        .filter((favorite: any) => {
                          if (isFavoriteSoftRemoved(favorite)) return false;
                          const favoriteId = String(favorite?.id || favorite?.firestoreId || '').trim();
                          return !favoriteId || !localDeletedIds.has(favoriteId);
                        });
                      const repairedAll = mergeFavoritePages(firstPageFavs, repairFavs);
                      const repairedVisible = sortFavoriteList(repairedAll.filter(isFavoriteVisibleInNoteSpace));
                      const lastRepairDoc = repairDocs[repairDocs.length - 1] || null;
                      if (lastRepairDoc) {
                        favoritePaginationCursorRef.current = lastRepairDoc;
                        writeMusicNotePaginationCursor(currentUser.uid, lastRepairDoc);
                      } else {
                        favoritePaginationCursorRef.current = new Date(repairCursorMs);
                      }
                      const exhausted = repairDocs.length < FAVORITES_PAGE_SIZE;
                      favoritePaginationExhaustedRef.current = exhausted;
                      setHasMoreFavorites(!exhausted);
                      setFavorites((prev) => {
                        const merged = mergeFavoriteFirstPageWithCache(repairedAll, Array.isArray(prev) ? prev : [], exhausted);
                        writeFavoritesCache(currentUser.uid, merged);
                        return merged;
                      });
                      if (repairedVisible.length >= FAVORITES_PAGE_SIZE) {
                        scheduleListBundleWrite('musicNote', currentUser.uid, repairedVisible, {
                          limit: FAVORITES_PAGE_SIZE,
                          hasMore: !exhausted || repairedVisible.length > FAVORITES_PAGE_SIZE,
                          deletedIds: Array.from(localDeletedIds),
                        });
                      }
                      markCacheDiagnostic('musicNote', 'SYNC', repairDocs.length + (meta.fromCache ? 0 : 1));
                    } catch (repairError) {
                      console.warn('Music Note First Bundle continuation repair failed; using one bounded cold repair.', repairError);
                      attachFavoritesSourceBootstrap902(true);
                      return;
                    } finally {
                      setIsFavoritesLoading(false);
                    }
                  })();
                  return;
                }

                attachFavoritesSourceBootstrap902(true);
                return;
              }

              favoritePaginationCursorRef.current = bundle.cursorCreatedAtMs > 0 ? new Date(bundle.cursorCreatedAtMs) : null;
              favoritePaginationExhaustedRef.current = !bundle.hasMore;
              favoritePaginationFallbackModeRef.current = false;
              setHasMoreFavorites(bundle.hasMore);"""
if ondata_old not in app:
    raise SystemExit('1029 bundle onData anchor missing')
app = app.replace(ondata_old, ondata_new, 1)

# Never write a broken/missing bundle from an insufficient partial local cache.
onmissing_old = """              if (hasCachedMusicNote) {
                scheduleListBundleWrite('musicNote', currentUser.uid, cachedFavs, {
                  limit: 20,
                  hasMore: cachedFavs.length >= 20,
                  deletedIds: Array.from(getFavoriteDeletedTombstoneIds(currentUser.uid)),
                });
                setIsFavoritesLoading(false);
                return;
              }
              attachFavoritesSourceBootstrap902();"""
onmissing_new = """              if (hasCachedMusicNote) {
                const cachedVisibleFavs = sortFavoriteList((cachedFavs || []).filter(isFavoriteVisibleInNoteSpace));
                if (cachedVisibleFavs.length >= FAVORITES_PAGE_SIZE) {
                  scheduleListBundleWrite('musicNote', currentUser.uid, cachedVisibleFavs, {
                    limit: FAVORITES_PAGE_SIZE,
                    hasMore: cachedVisibleFavs.length > FAVORITES_PAGE_SIZE,
                    deletedIds: Array.from(getFavoriteDeletedTombstoneIds(currentUser.uid)),
                  });
                  setIsFavoritesLoading(false);
                  return;
                }
              }
              attachFavoritesSourceBootstrap902(true);"""
if onmissing_old not in app:
    raise SystemExit('1029 bundle missing anchor missing')
app = app.replace(onmissing_old, onmissing_new, 1)

onerror_old = """              console.warn('Music Note bundle unavailable; using legacy safe path.', error);
              if (!hasCachedMusicNote) attachFavoritesSourceBootstrap902();"""
onerror_new = """              console.warn('Music Note bundle unavailable; using bounded cache-first repair.', error);
              const cachedVisibleFavs = sortFavoriteList((cachedFavs || []).filter(isFavoriteVisibleInNoteSpace));
              if (cachedVisibleFavs.length < FAVORITES_PAGE_SIZE) attachFavoritesSourceBootstrap902(true);
              else setIsFavoritesLoading(false);"""
if onerror_old not in app:
    raise SystemExit('1029 bundle error anchor missing')
app = app.replace(onerror_old, onerror_new, 1)

# New unsaves must not rewrite the chronological creation axis. That old write
# pushed removed rows to the top of every ordered page and was the direct source
# of 20 raw docs becoming only ~8 visible songs.
unsave_old = """          createdAtMs: unsavedAt,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),"""
unsave_new = """          // 1029: preserve createdAt/createdAtMs on unsave; only mutation time changes.
          updatedAt: serverTimestamp(),"""
if unsave_old not in app:
    raise SystemExit('1029 unsave chronology anchor missing')
app = app.replace(unsave_old, unsave_new, 1)

# ---------------------------------------------------------------------------
# Bundle writer safety: never persist a Music Note First Bundle with fewer than
# 20 validated visible rows. A small/partial local payload must not poison every
# browser. Complete small accounts simply use the bounded source fallback.
# ---------------------------------------------------------------------------
schedule_old = """  const key = getBundleKey(kind, uid);
  const comparable = buildComparablePayload(kind, items, options);
  const payloadHash = makePayloadHash(comparable);"""
schedule_new = """  const key = getBundleKey(kind, uid);
  const comparable = buildComparablePayload(kind, items, options);
  if (kind === 'musicNote' && comparable.items.length < Math.max(1, options.limit)) {
    console.warn('[listBundleCache] partial Music Note First Bundle write blocked.');
    return;
  }
  const payloadHash = makePayloadHash(comparable);"""
if schedule_old not in bundle:
    raise SystemExit('1029 bundle writer anchor missing')
bundle = bundle.replace(schedule_old, schedule_new, 1)

# ---------------------------------------------------------------------------
# Library: a cacheless browser must not trust a stale <10 bundle and hide More.
# It performs the existing single bounded 10-doc source bootstrap once. Durable
# IndexedDB browsers continue to remain cache-first/zero-read when current.
# ---------------------------------------------------------------------------
lib_import_old = "import { subscribeListBundle, readLibraryBundleLocalSyncVersion, writeLibraryBundleLocalSyncVersion } from '../lib/listBundleCache';"
lib_import_new = "import { subscribeListBundle, scheduleListBundleWrite, readLibraryBundleLocalSyncVersion, writeLibraryBundleLocalSyncVersion } from '../lib/listBundleCache';"
if lib_import_old not in lib:
    raise SystemExit('1029 library bundle import anchor missing')
lib = lib.replace(lib_import_old, lib_import_new, 1)

# Repair a bad Library bundle once after the authoritative bounded fallback.
bootstrap_anchor = """      const persisted = await persistLibraryWorkspaceTrackCacheNow(uid, session.tracks);
      if (persisted) {"""
bootstrap_new = """      const persisted = await persistLibraryWorkspaceTrackCacheNow(uid, session.tracks);
      if (persisted && list.length >= WORKSPACE_SERVER_PAGE_SIZE) {
        scheduleListBundleWrite('library', uid, list, {
          limit: WORKSPACE_SERVER_PAGE_SIZE,
          hasMore: docs.length >= WORKSPACE_SERVER_PAGE_SIZE,
        });
      }
      if (persisted) {"""
if bootstrap_anchor not in lib:
    raise SystemExit('1029 library bootstrap persist anchor missing')
lib = lib.replace(bootstrap_anchor, bootstrap_new, 1)

lib_ondata_old = """        writeLibraryBundleLocalSyncVersion(uid, verifiedVersion);
        const list = Array.isArray(bundle.items) ? bundle.items : [];
        session.tracks = mergeLibraryLatestBundleWithCache("""
lib_ondata_new = """        const list = Array.isArray(bundle.items) ? bundle.items : [];
        const hadLocalLibraryRows = session.tracks.length > 0;
        if (!hadLocalLibraryRows && list.length < WORKSPACE_SERVER_PAGE_SIZE) {
          markCacheDiagnostic('library', meta.fromCache ? 'CACHE' : 'SYNC', meta.fromCache ? 0 : 1);
          void bootstrapCachelessLibraryFromServerOnce();
          return;
        }
        writeLibraryBundleLocalSyncVersion(uid, verifiedVersion);
        session.tracks = mergeLibraryLatestBundleWithCache("""
if lib_ondata_old not in lib:
    raise SystemExit('1029 library partial bundle anchor missing')
lib = lib.replace(lib_ondata_old, lib_ondata_new, 1)

# The old "N remaining" number was the local browser cache length, not account
# truth, so normal and incognito could display different fake totals.
fav_old = "? `더보기 (${filteredFavorites.length - visibleCount}개 남음)`"
fav_new = "? '더보기'"
if fav_old not in fav:
    raise SystemExit('1029 misleading remainder label anchor missing')
fav = fav.replace(fav_old, fav_new, 1)

APP.write_text(app, encoding='utf-8')
FAV.write_text(fav, encoding='utf-8')
LIB.write_text(lib, encoding='utf-8')
BUNDLE.write_text(bundle, encoding='utf-8')

# ---------------------------------------------------------------------------
# Static safety contracts.
# ---------------------------------------------------------------------------
app2 = APP.read_text(encoding='utf-8')
fav2 = FAV.read_text(encoding='utf-8')
lib2 = LIB.read_text(encoding='utf-8')
bundle2 = BUNDLE.read_text(encoding='utf-8')
assert MARKER in app2
assert 'const shouldVerifyMusicNoteBundle = !hasCachedMusicNote || (' in app2
assert 'FAVORITES_PAGE_SIZE * 3' in app2
assert 'favoritesSourceBootstrapInFlight1029' in app2
assert 'createdAtMs: unsavedAt' not in app2[app2.find("const unsaveUpdates"):app2.find("const unsaveUpdates") + 2200]
assert 'partial Music Note First Bundle write blocked' in bundle2
assert "scheduleListBundleWrite('library', uid, list" in lib2
assert 'hadLocalLibraryRows' in lib2
assert '개 남음' not in fav2[fav2.find('shouldShowMusicNoteMoreButton'):fav2.find('shouldShowMusicNoteMoreButton') + 5000]

more_start = app2.index('  const loadMoreFavorites = useCallback(async () => {')
more_end = app2.index('  const syncMusicNoteIncrementalFromRemoteVersion', more_start)
more = app2[more_start:more_end]
assert more.count('await getDocs(') == 1
for forbidden in ('while (', 'maxScanPages', 'loadCompatibilityTail'):
    assert forbidden not in more
assert "orderBy('createdAtMs', 'desc')" in more
assert 'limit(FAVORITES_PAGE_SIZE)' in more
print('1029_FIRST_BUNDLE_INTEGRITY=PASS')

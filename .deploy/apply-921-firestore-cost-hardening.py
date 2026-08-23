from pathlib import Path
import os

MARKER = 'SORIDRAW_921_FIRESTORE_COST_HARDENING'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


# -----------------------------------------------------------------------------
# 1) Bundle helper: manual sync needs a direct one-shot promise, not the lazy
# route-event subscription. This guarantees the UI can apply a timeout.
# -----------------------------------------------------------------------------
helper_path = Path('src/lib/listBundleCache.ts')
helper = helper_path.read_text(encoding='utf-8')
if MARKER not in helper:
    helper += r'''

export const readListBundleFromServerOnce = async (
  kind: ListBundleKind,
  uid: string,
): Promise<ListBundleSnapshot | null> => {
  if (!uid) return null;
  const snapshot = await getDocFromServer(getBundleRef(kind, uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() || {};
  const items = Array.isArray(data.items) ? data.items : [];
  const bundle: ListBundleSnapshot = {
    schemaVersion: Number(data.schemaVersion || 0),
    kind,
    items,
    itemCount: Number(data.itemCount || items.length || 0),
    cursorCreatedAtMs: Number(data.cursorCreatedAtMs || 0),
    hasMore: data.hasMore === true,
    deletedIds: normalizeDeletedIds(data.deletedIds),
    updatedAtMs: Number(data.updatedAtMs || 0),
  };
  rememberListBundleSnapshot(kind, uid, bundle, kind === 'musicNote' ? 20 : 10);
  return bundle;
};

const SORIDRAW_921_FIRESTORE_COST_HARDENING = true;
'''
    helper_path.write_text(helper, encoding='utf-8')


# -----------------------------------------------------------------------------
# 2) App: remove automatic unbounded favorites fallbacks/recovery.
# -----------------------------------------------------------------------------
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')
if MARKER not in app:
    app = replace_once(
        app,
        "import { scheduleListBundleWrite, subscribeListBundle } from './lib/listBundleCache';",
        "import { scheduleListBundleWrite, subscribeListBundle, readListBundleFromServerOnce } from './lib/listBundleCache';",
        '921 bundle direct-read import',
    )

    legacy_start = app.find('        const attachLegacyFavoritesFallback = () => {')
    legacy_end = app.find('\n\n        const hasCachedMusicNote =', legacy_start)
    if legacy_start < 0 or legacy_end < 0:
        raise SystemExit('921 favorites fallback/recovery anchors missing')
    bounded_fallback = r'''        const attachLegacyFavoritesFallback = async () => {
          // 921: Never attach an unbounded favorites listener. If local cache exists,
          // keep it. Otherwise perform at most one bounded 20-document recovery read.
          favoritePaginationCursorRef.current = null;
          favoritePaginationExhaustedRef.current = true;
          favoritePaginationLoadingRef.current = false;
          favoritePaginationFallbackModeRef.current = true;
          setHasMoreFavorites(false);
          setIsLoadingMoreFavorites(false);

          if (Array.isArray(cachedFavs) && cachedFavs.length > 0) {
            setIsFavoritesLoading(false);
            markCacheDiagnostic('musicNote', 'CACHE', 0);
            return;
          }

          try {
            const fallbackSnapshot = await getDocs(query(
              collection(db, 'favorites'),
              where('uid', '==', currentUser.uid),
              limit(FAVORITES_PAGE_SIZE),
            ));
            const fallbackFavs = sortFavoriteList(
              fallbackSnapshot.docs.map(mapFavoriteFirestoreDoc).filter((favorite) => !isFavoriteSoftRemoved(favorite)),
            );
            favoritePaginationCursorRef.current = fallbackSnapshot.docs[fallbackSnapshot.docs.length - 1] || null;
            favoritePaginationExhaustedRef.current = fallbackSnapshot.docs.length < FAVORITES_PAGE_SIZE;
            favoritePaginationFallbackModeRef.current = true;
            setHasMoreFavorites(false);
            setFavorites(fallbackFavs);
            writeFavoritesCache(currentUser.uid, fallbackFavs);
            markCacheDiagnostic('musicNote', 'SYNC', Math.max(1, fallbackSnapshot.docs.length));
          } catch (fallbackError) {
            console.warn('Bounded Music Note fallback failed. Keeping local cache only.', fallbackError);
          } finally {
            setIsFavoritesLoading(false);
          }
        };

        // 921: the old automatic full-collection recovery is intentionally dead.
        // Full collection reads are allowed only for explicit all-item operations.
        const runFavoritesFullCacheRecoveryOnce = async () => {};
'''
    app = app[:legacy_start] + bounded_fallback + app[legacy_end:]

    # Heart save/unsave: exact linked id -> favoriteKey -> one small title fallback.
    match_start = app.find('    const findServerMatchingFavorites = async (includeFullScan = false): Promise<any[]> => {')
    match_end = app.find('\n\n    const findServerExistingFavorite = async () => {', match_start)
    if match_start < 0 or match_end < 0:
        raise SystemExit('921 favorite lookup anchors missing')
    bounded_match = r'''    const findServerMatchingFavorites = async (_includeFullScan = false): Promise<any[]> => {
      const matches = new Map<string, any>();
      const addCandidates = (candidates: any[]) => {
        candidates.forEach((candidate) => {
          if (!candidate?.id) return;
          if (isFavoriteServerDuplicateCandidate(candidate, song, songIdentityKey)) {
            matches.set(candidate.id, candidate);
          }
        });
      };

      const exactFavoriteId = String(
        (song as any)?.favoriteFirestoreId
        || (song as any)?.firestoreId
        || (forceDeleteFavoriteById ? favoriteDeleteId : '')
        || '',
      ).trim();
      if (exactFavoriteId) {
        try {
          const exactSnap = await getDoc(doc(db, 'favorites', exactFavoriteId));
          if (exactSnap.exists()) addCandidates([mapFavoriteFirestoreDoc(exactSnap)]);
        } catch (error) {
          console.warn('Exact favorite lookup failed.', error);
        }
      }

      if (matches.size === 0 && songIdentityKey) {
        try {
          const keySnap = await getDocs(query(
            collection(db, 'favorites'),
            where('uid', '==', user.uid),
            where('favoriteKey', '==', songIdentityKey),
            limit(5),
          ));
          addCandidates(keySnap.docs.map(mapFavoriteFirestoreDoc));
        } catch (error) {
          console.warn('Favorite identity lookup by key failed.', error);
        }
      }

      if (matches.size === 0) {
        const titleCandidate = String(song.title || song.koreanTitle || song.englishTitle || '').trim();
        if (titleCandidate) {
          try {
            const titleSnap = await getDocs(query(
              collection(db, 'favorites'),
              where('uid', '==', user.uid),
              where('title', '==', titleCandidate),
              limit(5),
            ));
            addCandidates(titleSnap.docs.map(mapFavoriteFirestoreDoc));
          } catch (error) {
            console.warn('Favorite bounded title lookup failed.', error);
          }
        }
      }

      return Array.from(matches.values());
    };'''
    app = app[:match_start] + bounded_match + app[match_end:]

    # A legacy-id repair may still search, but it is capped instead of reading every favorite.
    app = app.replace(
        "const legacyIdSnap = await getDocs(query(collection(db, 'favorites'), where('uid', '==', user.uid)));",
        "const legacyIdSnap = await getDocs(query(collection(db, 'favorites'), where('uid', '==', user.uid), limit(20)));",
        1,
    )

    # Manual Sync: one direct bundle document read, always settles within 8s.
    manual_start = app.find("  const refreshFavoritesFromServerFirstPage = useCallback(async (): Promise<{ ok: boolean; limited?: boolean; message?: string }> => {")
    manual_end = app.find("\n\n  const showToast = useCallback", manual_start)
    if manual_start < 0 or manual_end < 0:
        raise SystemExit('921 manual sync anchors missing')
    manual = r'''  const refreshFavoritesFromServerFirstPage = useCallback(async (): Promise<{ ok: boolean; limited?: boolean; message?: string }> => {
    const currentUser = user || auth.currentUser;
    if (!currentUser?.uid) return { ok: false, message: '로그인이 필요합니다.' };

    const uid = currentUser.uid;
    const localVersion = readMusicNoteSyncVersion(MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE, uid);
    const remoteVersion = readMusicNoteSyncVersion(MUSIC_NOTE_REMOTE_SYNC_VERSION_STORAGE_BASE, uid);
    if (remoteVersion > 0 && localVersion >= remoteVersion) {
      markCacheDiagnostic('musicNote', 'CACHE', 0);
      return { ok: true, message: '변경된 뮤직노트가 없습니다.' };
    }

    let timeoutId: number | null = null;
    try {
      const timeoutPromise = new Promise<null>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error('MUSIC_NOTE_SYNC_TIMEOUT')), 8000);
      });
      const bundle = await Promise.race([
        readListBundleFromServerOnce('musicNote', uid),
        timeoutPromise,
      ]);
      if (!bundle) return { ok: false, message: '뮤직노트 변경 캐시가 아직 준비되지 않았습니다.' };

      const localDeletedIds = getFavoriteDeletedTombstoneIds(uid);
      if (bundle.deletedIds.length > 0) {
        rememberFavoriteDeletedTombstones(uid, bundle.deletedIds);
        bundle.deletedIds.forEach((id) => localDeletedIds.add(id));
      }
      const incoming = (bundle.items || []).filter((favorite: any) => {
        if (isFavoriteSoftRemoved(favorite)) return false;
        const favoriteId = String(favorite?.id || favorite?.firestoreId || '').trim();
        return !favoriteId || !localDeletedIds.has(favoriteId);
      });
      const previous = favoritesStore.getFavorites();
      const bundleVersion = Number(bundle.updatedAtMs || 0);
      const localNewer = (Array.isArray(previous) ? previous : []).filter((favorite: any) => {
        if (!favorite || isFavoriteSoftRemoved(favorite)) return false;
        const favoriteId = String(favorite?.id || favorite?.firestoreId || '').trim();
        if (favoriteId && localDeletedIds.has(favoriteId)) return false;
        const favoriteVersion = Number(favorite?.updatedAtMs || favorite?.createdAtMs || 0)
          || getTimestampMs(favorite?.updatedAt)
          || getTimestampMs(favorite?.createdAt)
          || 0;
        return bundleVersion > 0 && favoriteVersion > bundleVersion;
      });
      const mergedFirstPage = mergeFavoritePages(localNewer, incoming);
      const merged = mergeFavoriteFirstPageWithCache(
        mergedFirstPage,
        Array.isArray(previous) ? previous : [],
        !bundle.hasMore,
      );
      setFavorites(merged);
      writeFavoritesCache(uid, merged);
      favoritesStore.setFavorites(merged);
      favoritePaginationCursorRef.current = bundle.cursorCreatedAtMs > 0 ? new Date(bundle.cursorCreatedAtMs) : null;
      favoritePaginationExhaustedRef.current = !bundle.hasMore;
      favoritePaginationFallbackModeRef.current = false;
      setHasMoreFavorites(bundle.hasMore);
      const nextLocalVersion = Math.max(localVersion, bundleVersion);
      if (nextLocalVersion > 0) writeMusicNoteSyncVersion(MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE, uid, nextLocalVersion);
      markCacheDiagnostic('musicNote', 'SYNC', 1);
      return { ok: true, message: '변경된 뮤직노트만 동기화했습니다.' };
    } catch (error: any) {
      if (String(error?.message || '').includes('MUSIC_NOTE_SYNC_TIMEOUT')) {
        return { ok: false, message: '동기화 응답이 지연되어 중단했습니다. 다시 시도해주세요.' };
      }
      console.warn('Music Note one-document sync failed.', error);
      return { ok: false, message: '변경분 동기화에 실패했습니다.' };
    } finally {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    }
  }, [user]);'''
    app = app[:manual_start] + manual + app[manual_end:]

    marker_anchor = 'const SORIDRAW_919_RECENT_CACHE_PAYLOAD_SHAPE_FIX = true;\n'
    if marker_anchor in app:
        app = app.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)
    else:
        app = app.replace('const SORIDRAW_918_FAVORITE_MUTATION_SIGNAL_ORDER_FIX = true;\n', f'const {MARKER} = true;\nconst SORIDRAW_918_FAVORITE_MUTATION_SIGNAL_ORDER_FIX = true;\n', 1)

    app_path.write_text(app, encoding='utf-8')


# -----------------------------------------------------------------------------
# 3) Library: a failed paged query must never fall back to an unbounded listener.
# -----------------------------------------------------------------------------
library_path = Path('src/pages/SunoLibraryPage.tsx')
library = library_path.read_text(encoding='utf-8')
if MARKER not in library:
    fallback_start = library.find('  const startFallback = () => {')
    fallback_end = library.find('\n\n  session.unsubscribe = onSnapshot(pageQuery', fallback_start)
    if fallback_start < 0 or fallback_end < 0:
        raise SystemExit('921 library fallback anchors missing')
    fallback = r'''  const startFallback = () => {
    if (session.unsubscribeFallback) return;
    session.paginationFallback = true;
    session.hasMore = false;
    // Reserve the slot so repeated listener errors cannot start parallel fallbacks.
    session.unsubscribeFallback = () => {};
    const boundedFallbackQuery = query(tracksRef, limit(WORKSPACE_SERVER_FETCH_SIZE));
    void getDocs(boundedFallbackQuery)
      .then((snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        session.tracks = mergeLibraryWorkspaceSessionTracks(list, session.tracks);
        session.lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
        session.hasMore = false;
        session.ready = true;
        saveLibraryWorkspaceTrackCache(uid, session.tracks);
        markCacheDiagnostic('library', 'SYNC', Math.max(1, snapshot.docs.length));
        emitLibraryWorkspaceSession(session);
      })
      .catch((error) => {
        console.error('Bounded library fallback failed; keeping local cache.', error);
        session.ready = true;
        emitLibraryWorkspaceSession(session);
      });
    emitLibraryWorkspaceSession(session);
  };'''
    library = library[:fallback_start] + fallback + library[fallback_end:]
    marker_anchor = 'const SORIDRAW_900_LIBRARY_SESSION_CACHE = true;\n'
    if marker_anchor in library:
        library = library.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)
    else:
        first_const = library.find('const ')
        library = library[:first_const] + f'const {MARKER} = true;\n' + library[first_const:]
    library_path.write_text(library, encoding='utf-8')


# -----------------------------------------------------------------------------
# 4) Route every browser Firestore SDK call through the measured wrapper.
# This makes CACHE LIVE top-line reflect this browser's actual client SDK calls.
# -----------------------------------------------------------------------------
wrapper = (Path('src/lib/firestoreMeasured.ts')).resolve()
rewritten = 0
for path in sorted(Path('src').rglob('*')):
    if path.suffix not in {'.ts', '.tsx'}:
        continue
    if path.resolve() == wrapper:
        continue
    source = path.read_text(encoding='utf-8')
    if 'firebase/firestore' not in source:
        continue
    relative = os.path.relpath(wrapper.with_suffix(''), path.parent.resolve()).replace(os.sep, '/')
    if not relative.startswith('.'):
        relative = './' + relative
    next_source = source.replace("'firebase/firestore'", f"'{relative}'").replace('"firebase/firestore"', f'"{relative}"')
    if next_source != source:
        path.write_text(next_source, encoding='utf-8')
        rewritten += 1

print(f'Applied SORIDRAW 921: bounded Firestore fallbacks, bounded favorite matching, sync timeout, SDK accounting imports={rewritten}.')

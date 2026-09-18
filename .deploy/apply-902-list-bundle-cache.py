from pathlib import Path
import re

MARKER = 'SORIDRAW_902_LIST_BUNDLE_CACHE'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


def replace_all(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count < 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after)


# -----------------------------------------------------------------------------
# App.tsx — Music Note latest 20 as one bundle document + Library generation mirror
# -----------------------------------------------------------------------------
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    import_anchor = "import { markCacheDiagnostic } from './lib/cacheDiagnostics';"
    app = replace_once(
        app,
        import_anchor,
        import_anchor + "\nimport { scheduleListBundleWrite, subscribeListBundle } from './lib/listBundleCache';",
        'App list bundle import',
    )

    marker_anchor = 'const SORIDRAW_901_MUSIC_NOTE_SYNC_PERMISSION_HARDENING = true;\n'
    app = replace_once(
        app,
        marker_anchor,
        f'const {MARKER} = true;\nconst musicNoteBundleActiveUids = new Set<string>();\n' + marker_anchor,
        'App 902 marker',
    )

    # Music Note display/read unit is now latest 20. The bundle itself is one
    # Firestore document, while legacy fallback pagination remains item-based.
    app = replace_once(app, '  const FAVORITES_PAGE_SIZE = 10;', '  const FAVORITES_PAGE_SIZE = 20;', 'Music Note page size 20')

    # Any local Music Note cache mutation schedules one debounced latest-20 bundle
    # write. Future lyric revision history is explicitly excluded by listBundleCache.
    cache_anchor = '    favoritesInMemoryCache.set(uid, safeList);\n'
    app = replace_once(
        app,
        cache_anchor,
        cache_anchor + """    scheduleListBundleWrite('musicNote', uid, safeList, {
      limit: 20,
      hasMore: safeList.length >= 20,
      deletedIds: Array.from(getFavoriteDeletedTombstoneIds(uid)),
    });
""",
        'Music Note cache mirror to bundle',
    )

    # While a Music API job is already being tracked, reuse that existing 30-set
    # listener to refresh the Library latest-10-set bundle without adding reads.
    polling_anchor = """      const tracks = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setRecentSunoTracksForPolling(tracks);
"""
    app = replace_once(
        app,
        polling_anchor,
        polling_anchor + """      scheduleListBundleWrite('library', user.uid, tracks, {
        limit: 10,
        hasMore: tracks.length > 10,
      });
""",
        'Library generation mirror to bundle',
    )

    # The app-level auth effect owns the Music Note bundle listener alongside the
    # existing favorites/user listeners so account changes clean it up together.
    app = replace_once(
        app,
        '    let unsubFavs: (() => void) | null = null;\n',
        '    let unsubFavs: (() => void) | null = null;\n    let unsubMusicNoteBundle: (() => void) | null = null;\n',
        'Music Note bundle unsubscribe slot',
    )

    cleanup_block = """      if (unsubFavs) {
        unsubFavs();
        unsubFavs = null;
      }
"""
    if cleanup_block in app:
        app = app.replace(
            cleanup_block,
            cleanup_block + """      if (unsubMusicNoteBundle) {
        unsubMusicNoteBundle();
        unsubMusicNoteBundle = null;
      }
""",
            1,
        )

    app = replace_once(
        app,
        """      if (unsubFavs) unsubFavs();
      if (unsubUserDoc) unsubUserDoc();
""",
        """      if (unsubFavs) unsubFavs();
      if (unsubMusicNoteBundle) unsubMusicNoteBundle();
      if (unsubUserDoc) unsubUserDoc();
""",
        'Music Note bundle final cleanup',
    )

    cached_old = '''        if (Array.isArray(cachedFavs) && cachedFavs.length > 0) {
          const persistedCursor = readMusicNotePaginationCursor(currentUser.uid);
          favoritePaginationCursorRef.current = persistedCursor;
          favoritePaginationExhaustedRef.current = !persistedCursor;
          setHasMoreFavorites(Boolean(persistedCursor));
          setIsFavoritesLoading(false);
          return;
        }
'''
    cached_new = '''        const hasCachedMusicNote = Array.isArray(cachedFavs) && cachedFavs.length > 0;
        if (hasCachedMusicNote) {
          const persistedCursor = readMusicNotePaginationCursor(currentUser.uid);
          favoritePaginationCursorRef.current = persistedCursor;
          favoritePaginationExhaustedRef.current = !persistedCursor;
          setHasMoreFavorites(Boolean(persistedCursor));
          setIsFavoritesLoading(false);
        }
'''
    app = replace_once(app, cached_old, cached_new, 'Music Note cached branch keeps bundle listener alive')

    # Wrap the old per-document first-page listener as a compatibility bootstrap.
    # It is used only when the new bundle doc is missing or its additive rule has
    # not been deployed yet. Once a bundle exists, startup is one document read.
    source_pattern = re.compile(
        r"(?P<block>        const q = query\(\n          collection\(db, 'favorites'\),.*?\n        \}\);\n)(?=\n        const runFavoritesFullCacheRecoveryOnce)",
        re.S,
    )
    match = source_pattern.search(app)
    if not match:
        raise SystemExit('Music Note source bootstrap block missing')
    source_block = match.group('block')
    indented_source = ''.join(('  ' + line if line.strip() else line) for line in source_block.splitlines(True))
    bundle_block = '''        const attachFavoritesSourceBootstrap902 = () => {
          if (unsubFavs || hasCachedMusicNote) return;
''' + indented_source + '''        };

        let musicNoteBundleMissingHandled = false;
        unsubMusicNoteBundle = subscribeListBundle('musicNote', currentUser.uid, {
          onData: (bundle, meta) => {
            musicNoteBundleActiveUids.add(currentUser.uid);
            musicNoteFreshBootstrapUids.delete(currentUser.uid);
            if (bundle.deletedIds.length > 0) {
              rememberFavoriteDeletedTombstones(currentUser.uid, bundle.deletedIds);
            }
            const firstPageFavs = (bundle.items || []).filter((favorite: any) => !isFavoriteSoftRemoved(favorite));
            favoritePaginationCursorRef.current = bundle.cursorCreatedAtMs > 0 ? new Date(bundle.cursorCreatedAtMs) : null;
            favoritePaginationExhaustedRef.current = !bundle.hasMore;
            favoritePaginationFallbackModeRef.current = false;
            setHasMoreFavorites(bundle.hasMore);
            setFavorites((prev) => {
              const merged = mergeFavoriteFirstPageWithCache(firstPageFavs, prev || [], !bundle.hasMore);
              writeFavoritesCache(currentUser.uid, merged);
              return merged;
            });
            if (bundle.updatedAtMs > 0) {
              writeMusicNoteSyncVersion(MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE, currentUser.uid, bundle.updatedAtMs);
            }
            markCacheDiagnostic('musicNote', meta.fromCache ? 'CACHE' : 'SYNC', meta.fromCache ? 0 : 1);
            setIsFavoritesLoading(false);
          },
          onMissing: (meta) => {
            musicNoteBundleActiveUids.delete(currentUser.uid);
            if (meta.fromCache) return;
            if (musicNoteBundleMissingHandled) return;
            musicNoteBundleMissingHandled = true;
            if (hasCachedMusicNote) {
              scheduleListBundleWrite('musicNote', currentUser.uid, cachedFavs, {
                limit: 20,
                hasMore: cachedFavs.length >= 20,
                deletedIds: Array.from(getFavoriteDeletedTombstoneIds(currentUser.uid)),
              });
              setIsFavoritesLoading(false);
              return;
            }
            attachFavoritesSourceBootstrap902();
          },
          onError: (error) => {
            musicNoteBundleActiveUids.delete(currentUser.uid);
            console.warn('Music Note bundle unavailable; using legacy safe path.', error);
            if (!hasCachedMusicNote) attachFavoritesSourceBootstrap902();
          },
        });

'''
    app = app[:match.start()] + bundle_block + app[match.end():]

    # A live bundle replaces the old changed-document delta query. The delta path
    # stays as a compatibility fallback until the additive bundle rule is live.
    incremental_anchor = '''    const uid = currentUser.uid;
    const localVersion = readMusicNoteSyncVersion(MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE, uid);
'''
    app = replace_once(
        app,
        incremental_anchor,
        '''    const uid = currentUser.uid;
    if (musicNoteBundleActiveUids.has(uid)) {
      markCacheDiagnostic('musicNote', 'CACHE', 0);
      return;
    }
    const localVersion = readMusicNoteSyncVersion(MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE, uid);
''',
        'Music Note bundle disables delta reads',
    )

    app_path.write_text(app, encoding='utf-8')
    print('Applied SORIDRAW 902 App: Music Note latest 20 bundle + Library generation bundle mirror.')
else:
    print('SORIDRAW 902 App already applied.')


# -----------------------------------------------------------------------------
# FavoritesPage.tsx — Music Note visible batch follows latest-20 bundle
# -----------------------------------------------------------------------------
favorites_path = Path('src/pages/FavoritesPage.tsx')
favorites = favorites_path.read_text(encoding='utf-8')
if MARKER not in favorites:
    favorites = replace_once(
        favorites,
        'const MUSIC_NOTE_VISIBLE_BATCH_SIZE = 10;',
        'const MUSIC_NOTE_VISIBLE_BATCH_SIZE = 20;',
        'Music Note visible batch 20',
    )
    favorites = favorites.replace('곡을 10개 더 불러오거나 보여줍니다.', '곡을 20개 더 불러오거나 보여줍니다.')
    favorites = favorites.replace(
        'const SORIDRAW_897_CACHE_DIAGNOSTICS_OVERLAY = true;\n',
        f'const {MARKER} = true;\nconst SORIDRAW_897_CACHE_DIAGNOSTICS_OVERLAY = true;\n',
        1,
    )
    favorites_path.write_text(favorites, encoding='utf-8')
    print('Applied SORIDRAW 902 FavoritesPage: latest/More unit is 20 songs.')


# -----------------------------------------------------------------------------
# SunoLibraryPage.tsx — latest 10 generation sets (=20 songs) in one bundle doc
# -----------------------------------------------------------------------------
library_path = Path('src/pages/SunoLibraryPage.tsx')
library = library_path.read_text(encoding='utf-8')

if MARKER not in library:
    import_anchor = "import { markCacheDiagnostic } from '../lib/cacheDiagnostics';"
    library = replace_once(
        library,
        import_anchor,
        import_anchor + "\nimport { scheduleListBundleWrite, subscribeListBundle } from '../lib/listBundleCache';",
        'Library list bundle import',
    )

    library = replace_once(library, 'const WORKSPACE_PAGE_SIZE = 20;', 'const WORKSPACE_PAGE_SIZE = 10;', 'Library visible set batch 10')
    library = replace_once(library, 'const WORKSPACE_SERVER_PAGE_SIZE = 20;', 'const WORKSPACE_SERVER_PAGE_SIZE = 10;', 'Library server set batch 10')
    library = replace_once(
        library,
        'const WORKSPACE_SERVER_FETCH_SIZE = WORKSPACE_SERVER_PAGE_SIZE + 1;',
        'const WORKSPACE_SERVER_FETCH_SIZE = WORKSPACE_SERVER_PAGE_SIZE;',
        'Library exact 10 set fallback read',
    )
    library = library.replace('docs.length > WORKSPACE_SERVER_PAGE_SIZE', 'docs.length >= WORKSPACE_SERVER_PAGE_SIZE')

    merge_anchor = '''const mergeLibraryWorkspaceSessionTracks = (incoming: any[], previous: any[] = []): any[] => {
  const map = new Map<string, any>();
  (Array.isArray(previous) ? previous : []).forEach((track: any) => {
    const id = String(track?.id || '').trim();
    if (id) map.set(id, track);
  });
  (Array.isArray(incoming) ? incoming : []).forEach((track: any) => {
    const id = String(track?.id || '').trim();
    if (id) map.set(id, { ...(map.get(id) || {}), ...track });
  });
  return Array.from(map.values()).sort(
    (a: any, b: any) => getLibraryWorkspaceTrackCreatedAtMs(b) - getLibraryWorkspaceTrackCreatedAtMs(a)
  );
};
'''
    merge_extra = merge_anchor + '''
const mergeLibraryLatestBundleWithCache = (
  incoming: any[],
  previous: any[],
  cursorCreatedAtMs: number,
  hasMore: boolean,
): any[] => {
  const incomingIds = new Set((incoming || []).map((track: any) => String(track?.id || '')).filter(Boolean));
  const retained = (previous || []).filter((track: any) => {
    const id = String(track?.id || '');
    if (!id || incomingIds.has(id)) return false;
    if (!hasMore) return false;
    const createdAtMs = getLibraryWorkspaceTrackCreatedAtMs(track);
    return cursorCreatedAtMs <= 0 || createdAtMs < cursorCreatedAtMs;
  });
  return mergeLibraryWorkspaceSessionTracks(incoming, retained);
};
'''
    library = replace_once(library, merge_anchor, merge_extra, 'Library bundle authoritative first page merge')

    start_pattern = re.compile(
        r"  const tracksRef = collection\(db, 'suno_tracks', uid, 'tracks'\);\n  const pageQuery = query\(.*?\n\n  return session;",
        re.S,
    )
    start_match = start_pattern.search(library)
    if not start_match:
        raise SystemExit('Library session source block missing')

    session_source = '''  const tracksRef = collection(db, 'suno_tracks', uid, 'tracks');
  const pageQuery = query(
    tracksRef,
    orderBy('createdAt', 'desc'),
    limit(WORKSPACE_SERVER_FETCH_SIZE)
  );

  const startLegacyFullFallback = () => {
    if (session.unsubscribeFallback) return;
    session.paginationFallback = true;
    session.hasMore = false;
    const fallbackQuery = query(tracksRef);
    session.unsubscribeFallback = onSnapshot(fallbackQuery, (snapshot) => {
      const list = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      session.tracks = mergeLibraryWorkspaceSessionTracks(list, []);
      session.lastDoc = null;
      session.hasMore = false;
      session.ready = true;
      saveLibraryWorkspaceTrackCache(uid, session.tracks);
      markCacheDiagnostic(
        'library',
        snapshot.metadata.fromCache ? 'CACHE' : 'SYNC',
        snapshot.metadata.fromCache ? 0 : Math.max(1, snapshot.docChanges().length)
      );
      emitLibraryWorkspaceSession(session);
    }, (error) => {
      console.error('Error fetching tracks fallback:', error);
      session.ready = true;
      emitLibraryWorkspaceSession(session);
    });
    emitLibraryWorkspaceSession(session);
  };

  const startPagedSourceFallback = () => {
    try { session.unsubscribe?.(); } catch {}
    session.unsubscribe = null;
    session.paginationFallback = false;
    session.unsubscribe = onSnapshot(pageQuery, (snapshot) => {
      const docs = snapshot.docs;
      const hasMore = docs.length >= WORKSPACE_SERVER_PAGE_SIZE;
      const visibleDocs = docs.slice(0, WORKSPACE_SERVER_PAGE_SIZE);
      const list = visibleDocs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      session.lastDoc = visibleDocs.length > 0 ? visibleDocs[visibleDocs.length - 1] : null;
      session.hasMore = hasMore;
      session.paginationFallback = false;
      session.tracks = mergeLibraryLatestBundleWithCache(
        list,
        session.tracks,
        visibleDocs.length > 0 ? getLibraryWorkspaceTrackCreatedAtMs(list[list.length - 1]) : 0,
        hasMore,
      );
      session.ready = true;
      saveLibraryWorkspaceTrackCache(uid, session.tracks);
      scheduleListBundleWrite('library', uid, session.tracks, { limit: 10, hasMore });
      markCacheDiagnostic(
        'library',
        snapshot.metadata.fromCache ? 'CACHE' : 'SYNC',
        snapshot.metadata.fromCache ? 0 : Math.max(1, snapshot.docChanges().length)
      );
      emitLibraryWorkspaceSession(session);
    }, (error) => {
      console.error('Error fetching paged tracks:', error);
      session.ready = true;
      emitLibraryWorkspaceSession(session);
      startLegacyFullFallback();
    });
  };

  let bundleBootstrapStarted = false;
  const bootstrapBundleFromSourceOnce = async () => {
    if (bundleBootstrapStarted) return;
    bundleBootstrapStarted = true;
    try {
      const snapshot = await getDocs(pageQuery);
      const docs = snapshot.docs;
      const hasMore = docs.length >= WORKSPACE_SERVER_PAGE_SIZE;
      const visibleDocs = docs.slice(0, WORKSPACE_SERVER_PAGE_SIZE);
      const list = visibleDocs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      session.lastDoc = visibleDocs.length > 0 ? visibleDocs[visibleDocs.length - 1] : null;
      session.hasMore = hasMore;
      session.paginationFallback = false;
      session.tracks = mergeLibraryLatestBundleWithCache(
        list,
        session.tracks,
        visibleDocs.length > 0 ? getLibraryWorkspaceTrackCreatedAtMs(list[list.length - 1]) : 0,
        hasMore,
      );
      session.ready = true;
      saveLibraryWorkspaceTrackCache(uid, session.tracks);
      scheduleListBundleWrite('library', uid, session.tracks, { limit: 10, hasMore });
      markCacheDiagnostic('library', 'SYNC', snapshot.docs.length);
      emitLibraryWorkspaceSession(session);
    } catch (error) {
      console.warn('Library bundle bootstrap unavailable; using legacy safe listener.', error);
      startPagedSourceFallback();
    }
  };

  session.unsubscribe = subscribeListBundle('library', uid, {
    onData: (bundle, meta) => {
      const list = Array.isArray(bundle.items) ? bundle.items : [];
      session.tracks = mergeLibraryLatestBundleWithCache(
        list,
        session.tracks,
        bundle.cursorCreatedAtMs,
        bundle.hasMore,
      );
      session.lastDoc = bundle.cursorCreatedAtMs > 0 ? new Date(bundle.cursorCreatedAtMs) : null;
      session.hasMore = bundle.hasMore;
      session.paginationFallback = false;
      session.ready = true;
      saveLibraryWorkspaceTrackCache(uid, session.tracks);
      markCacheDiagnostic('library', meta.fromCache ? 'CACHE' : 'SYNC', meta.fromCache ? 0 : 1);
      emitLibraryWorkspaceSession(session);
    },
    onMissing: (meta) => {
      if (meta.fromCache) return;
      void bootstrapBundleFromSourceOnce();
    },
    onError: (error) => {
      console.warn('Library bundle unavailable; using legacy safe listener.', error);
      startPagedSourceFallback();
    },
  });

  return session;'''
    library = library[:start_match.start()] + session_source + library[start_match.end():]

    # Any local Library edit updates the latest-10-set bundle after a short debounce.
    user_ref_effect = '''  useEffect(() => {
    libraryUserRef.current = user;
  }, [user]);
'''
    library = replace_once(
        library,
        user_ref_effect,
        user_ref_effect + '''
  useEffect(() => {
    if (!user?.uid || isSharedView || !Array.isArray(tracks) || tracks.length === 0) return;
    const sessionHasOlder = libraryWorkspaceSession?.uid === user.uid
      ? (libraryWorkspaceSession.tracks.length > 10 || libraryWorkspaceSession.hasMore)
      : tracks.length > 10;
    scheduleListBundleWrite('library', user.uid, tracks, {
      limit: 10,
      hasMore: sessionHasOlder,
    });
  }, [tracks, user?.uid, isSharedView]);
''',
        'Library local edit bundle mirror',
    )

    library = library.replace(
        'const SORIDRAW_900_LIBRARY_SESSION_CACHE = true;\n',
        f'const {MARKER} = true;\nconst SORIDRAW_900_LIBRARY_SESSION_CACHE = true;\n',
        1,
    )
    library_path.write_text(library, encoding='utf-8')
    print('Applied SORIDRAW 902 Library: 10 sets/20 songs use one latest bundle document with safe legacy fallback.')
else:
    print('SORIDRAW 902 Library already applied.')

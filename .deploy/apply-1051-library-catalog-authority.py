from pathlib import Path

p = Path('src/pages/SunoLibraryPage.tsx')
s = p.read_text(encoding='utf-8')

def once(old: str, new: str, label: str) -> None:
    global s
    if old not in s:
        raise SystemExit(f'{label}: anchor missing')
    s = s.replace(old, new, 1)

once(
    "const SORIDRAW_923_FINAL_FIRESTORE_GUARD = true;\n",
    "const SORIDRAW_923_FINAL_FIRESTORE_GUARD = true;\nconst SORIDRAW_LIBRARY_FULL_CATALOG_AUTHORITY_1051 = true;\n",
    'marker',
)

start = s.index("  const tracksRef = collection(db, 'suno_tracks', uid, 'tracks');\n")
end = s.index("\n  let libraryBundleReadInFlight = false;", start)
s = s[:start] + "  // 1051: Library workspace no longer owns a Firestore page bootstrap.\n  // The shared server-authoritative Catalog is the only list source; durable cache is instant paint only.\n" + s[end:]

once(
'''        const list = Array.isArray(bundle.items) ? bundle.items : [];
        session.tracks = mergeLibraryLatestBundleWithCache(
          list,
          session.tracks,
          bundle.cursorCreatedAtMs,
          bundle.hasMore,
        );
        session.lastDoc = bundle.cursorCreatedAtMs > 0 ? new Date(bundle.cursorCreatedAtMs) : null;
        const hasOlderCachedRows = session.tracks.length > list.length;
        const isFullCatalogSnapshot = bundle.schemaVersion === 1001;
        session.hasMore = isFullCatalogSnapshot
          ? false
          : Boolean(bundle.hasMore || hasOlderCachedRows || list.length >= WORKSPACE_SERVER_PAGE_SIZE);
        session.paginationFallback = false;
        session.ready = true;
        saveLibraryWorkspaceTrackCache(uid, session.tracks);''',
'''        const list = Array.isArray(bundle.items) ? bundle.items : [];
        const isFullCatalogSnapshot = bundle.schemaVersion === 1001;
        session.tracks = isFullCatalogSnapshot
          ? mergeLibraryWorkspaceSessionTracks(list, [])
          : mergeLibraryLatestBundleWithCache(list, session.tracks, bundle.cursorCreatedAtMs, bundle.hasMore);
        session.lastDoc = null;
        session.hasMore = isFullCatalogSnapshot ? false : Boolean(bundle.hasMore);
        session.paginationFallback = false;
        session.ready = true;
        saveLibraryWorkspaceTrackCache(uid, session.tracks);''',
    'catalog onData authority',
)

once(
'''      onMissing: (meta) => {
        libraryBundleReadInFlight = false;
        if (meta.fromCache) return;
        void bootstrapCachelessLibraryFromServerOnce();
      },
      onError: (error) => {
        libraryBundleReadInFlight = false;
        console.warn('Library bundle unavailable; using bounded source fallback.', error);
        void bootstrapCachelessLibraryFromServerOnce();
      },''',
'''      onMissing: (meta) => {
        libraryBundleReadInFlight = false;
        if (meta.fromCache) return;
        session.hasMore = false;
        session.paginationFallback = false;
        session.ready = true;
        emitLibraryWorkspaceSession(session);
      },
      onError: (error) => {
        libraryBundleReadInFlight = false;
        console.warn('Library Catalog unavailable; keeping local cache without Firestore paging.', error);
        session.hasMore = false;
        session.paginationFallback = false;
        session.ready = true;
        emitLibraryWorkspaceSession(session);
      },''',
    'remove bounded fallback',
)

once(
'''        if (shouldVerifyLibraryBundle() && readRemoteLibraryVersion() > readLibraryBundleLocalSyncVersion(uid)) {
          startLibraryBundleVerification();
        }
        return;''',
'''        // Durable cache is paint-only until the shared Catalog verifies completeness.
        startLibraryBundleVerification();
        return;''',
    'always verify Catalog',
)

load_start = s.index("  const loadMoreWorkspaceTracks = async () => {\n")
load_end = s.index("\n  const playlistLiveModeActive", load_start)
s = s[:load_start] + '''  const loadMoreWorkspaceTracks = async () => {
    // 1051: UI pagination only. The full Library Catalog is already local.
    setWorkspaceVisibleCount((prev) => Math.min(prev + WORKSPACE_PAGE_SIZE, filteredTracks.length));
  };
''' + s[load_end:]

s = s.replace("const WORKSPACE_SERVER_PAGE_SIZE = 10;\nconst WORKSPACE_SERVER_FETCH_SIZE = WORKSPACE_SERVER_PAGE_SIZE;\n", "")

once(
'''        const oldestCachedTrack = session.tracks[session.tracks.length - 1] || null;
        const cachedCursorMs = getLibraryWorkspaceTrackCreatedAtMs(oldestCachedTrack);
        // Reconstruct a bounded cursor from the durable cache so browser/app
        // restart never forces a full collection rebuild. At worst an exact
        // 10-item terminal cache can cause one bounded empty-page check.
        session.lastDoc = cachedCursorMs > 0 ? new Date(cachedCursorMs) : null;
        session.hasMore = session.tracks.length >= WORKSPACE_SERVER_PAGE_SIZE && cachedCursorMs > 0;''',
'''        // Durable cache never manufactures a Firestore cursor or server-more state.
        session.lastDoc = null;
        session.hasMore = false;''',
    'remove durable cursor',
)

should_start = s.find("  const shouldVerifyLibraryBundle = () => {\n")
if should_start != -1:
    should_end = s.index("\n\n  let libraryHydrationStarted", should_start)
    s = s[:should_start] + s[should_end + 2:]

p.write_text(s, encoding='utf-8')
print('1051_LIBRARY_PATCH=PASS')

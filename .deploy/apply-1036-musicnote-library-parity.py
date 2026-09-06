from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, got {count}')
    return text.replace(old, new, 1)


def replace_between(text: str, start: str, end: str, replacement: str, label: str) -> str:
    a = text.find(start)
    if a < 0:
        raise SystemExit(f'{label}: start anchor missing')
    b = text.find(end, a)
    if b < 0:
        raise SystemExit(f'{label}: end anchor missing')
    return text[:a] + replacement + text[b:]


# -----------------------------------------------------------------------------
# App.tsx — Music Note must consume the same authoritative full-catalog contract
# that already makes Library relatively stable. 20 is UI render size only.
# -----------------------------------------------------------------------------
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if 'const musicNoteFullCatalogReadyUids = new Set<string>();' not in app:
    app = replace_once(
        app,
        'const musicNoteFreshBootstrapUids = new Set<string>();',
        'const musicNoteFreshBootstrapUids = new Set<string>();\nconst musicNoteFullCatalogReadyUids = new Set<string>(); // 1036: schema-1001 catalog is authoritative',
        'musicNote catalog-ready set',
    )

app = replace_once(
    app,
    "  const mergeFavoriteFirstPageWithCache = (firstPageFavs: any[], previous: any[], allServerFavoritesLoaded = false) => {\n    const firstPageIds",
    "  const mergeFavoriteFirstPageWithCache = (firstPageFavs: any[], previous: any[], allServerFavoritesLoaded = false) => {\n    // A schema-1001 catalog is the complete authority. Never preserve arbitrary\n    // stale rows from a partial/legacy local cache once that catalog arrives.\n    if (allServerFavoritesLoaded) return mergeFavoritePages([], firstPageFavs);\n    const firstPageIds",
    'full catalog authoritative merge',
)

app = replace_once(
    app,
    "    schedulePreviewAdaptiveListIndexPublishIfDirty('musicNote', uid, safeList, {\n      hasMore: safeList.length >= 20,\n      deletedIds: Array.from(getFavoriteDeletedTombstoneIds(uid)),\n    });",
    "    const fullCatalogReady = musicNoteFullCatalogReadyUids.has(uid);\n    schedulePreviewAdaptiveListIndexPublishIfDirty('musicNote', uid, safeList, {\n      hasMore: fullCatalogReady ? false : undefined,\n      complete: fullCatalogReady,\n      deletedIds: Array.from(getFavoriteDeletedTombstoneIds(uid)),\n    });",
    'Music Note catalog publish completeness',
)

# Remove the old client-side first-page recovery block. A cold device must ask the
# catalog engine first; it must not silently become a 20-document Firestore pager.
app = replace_between(
    app,
    '        const attachLegacyFavoritesFallback = async () => {',
    '\n\n        const hasCachedMusicNote =',
    "        // 1036: legacy 20-row Music Note recovery was removed. Cold/stale\n        // devices use the private full catalog; navigation itself never scans or pages favorites.\n\n        const hasCachedMusicNote =",
    'remove legacy Music Note fallback',
)

# A legacy localStorage cache can paint immediately, but it must never resurrect
# a server More cursor. The catalog verification below decides completeness.
app = replace_between(
    app,
    '        if (hasCachedMusicNote) {',
    '\n\n        const attachFavoritesSourceBootstrap902 =',
    "        if (hasCachedMusicNote) {\n          favoritePaginationCursorRef.current = null;\n          favoritePaginationExhaustedRef.current = true;\n          favoritePaginationFallbackModeRef.current = false;\n          clearMusicNotePaginationCursor(currentUser.uid);\n          setHasMoreFavorites(false);\n          setIsFavoritesLoading(false);\n        }\n\n        const attachFavoritesSourceBootstrap902 =",
    'disable cached Music Note server More',
)

# Delete the old paged onSnapshot source entirely.
app = replace_between(
    app,
    '        const attachFavoritesSourceBootstrap902 =',
    '\n\n        let musicNoteBundleMissingHandled = false;',
    "        // 1036: paged favorites onSnapshot removed; full catalog is the bootstrap source.\n\n        let musicNoteBundleMissingHandled = false;",
    'remove paged Music Note bootstrap',
)

# Replace the old conditional bundle/pager branch with a Library-style catalog-first
# branch. schemaVersion 1001 means full catalog => server hasMore is impossible.
new_catalog_branch = r'''        // 1036: always prepare the catalog reader. subscribeListBundle itself stays
        // route-gated and readCatalogSnapshotCacheFirst returns IndexedDB without network
        // when its revision is current, so page re-entry remains cache-first.
        const shouldVerifyMusicNoteBundle = true;

        if (shouldVerifyMusicNoteBundle) {
          unsubMusicNoteBundle = subscribeListBundle('musicNote', currentUser.uid, {
            onData: (bundle, meta) => {
              const isFullMusicNoteCatalog = bundle.schemaVersion === 1001;
              musicNoteBundleActiveUids.delete(currentUser.uid);
              musicNoteFreshBootstrapUids.delete(currentUser.uid);
              if (isFullMusicNoteCatalog) musicNoteFullCatalogReadyUids.add(currentUser.uid);
              else musicNoteFullCatalogReadyUids.delete(currentUser.uid);

              if (bundle.deletedIds.length > 0) {
                rememberFavoriteDeletedTombstones(currentUser.uid, bundle.deletedIds);
              }
              const localDeletedIds = getFavoriteDeletedTombstoneIds(currentUser.uid);
              const catalogFavorites = (bundle.items || []).filter((favorite: any) => {
                if (isFavoriteSoftRemoved(favorite)) return false;
                const favoriteId = String(favorite?.id || favorite?.firestoreId || '').trim();
                return !favoriteId || !localDeletedIds.has(favoriteId);
              });

              // Full catalog follows the same contract as Library: no server cursor,
              // no 20-row More, and all subsequent More clicks are local rendering only.
              favoritePaginationCursorRef.current = null;
              favoritePaginationExhaustedRef.current = true;
              favoritePaginationFallbackModeRef.current = false;
              clearMusicNotePaginationCursor(currentUser.uid);
              setHasMoreFavorites(false);

              setFavorites((prev) => {
                const previous = Array.isArray(prev) ? prev : [];
                const bundleVersion = Number(bundle.updatedAtMs || 0);
                const localNewer = previous.filter((favorite: any) => {
                  if (!favorite || isFavoriteSoftRemoved(favorite)) return false;
                  const favoriteId = String(favorite?.id || favorite?.firestoreId || '').trim();
                  if (favoriteId && localDeletedIds.has(favoriteId)) return false;
                  const favoriteVersion = Number(favorite?.updatedAtMs || favorite?.createdAtMs || 0)
                    || getTimestampMs(favorite?.updatedAt)
                    || getTimestampMs(favorite?.createdAt)
                    || 0;
                  return bundleVersion > 0 && favoriteVersion > bundleVersion;
                });
                const authoritative = isFullMusicNoteCatalog
                  ? mergeFavoritePages(catalogFavorites, localNewer)
                  : mergeFavoriteFirstPageWithCache(catalogFavorites, previous, false);
                writeFavoritesCache(currentUser.uid, authoritative);
                return authoritative;
              });

              if (bundle.updatedAtMs > 0) {
                const currentLocalVersion = readMusicNoteSyncVersion(
                  MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE,
                  currentUser.uid,
                );
                writeMusicNoteSyncVersion(
                  MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE,
                  currentUser.uid,
                  Math.max(currentLocalVersion, Number(bundle.updatedAtMs || 0)),
                );
              }
              markCacheDiagnostic('musicNote', meta.fromCache ? 'CACHE' : 'SYNC', meta.fromCache ? 0 : 1);
              setIsFavoritesLoading(false);
            },
            onMissing: (meta) => {
              if (meta.fromCache) return;
              musicNoteBundleMissingHandled = true;
              musicNoteFullCatalogReadyUids.delete(currentUser.uid);
              setHasMoreFavorites(false);
              setIsFavoritesLoading(false);
              markCacheDiagnostic('musicNote', hasCachedMusicNote ? 'CACHE' : 'WAIT', 0);
              console.warn('Music Note catalog unavailable; refusing legacy 20-row server pagination.');
            },
            onError: (error) => {
              musicNoteFullCatalogReadyUids.delete(currentUser.uid);
              setHasMoreFavorites(false);
              setIsFavoritesLoading(false);
              markCacheDiagnostic('musicNote', hasCachedMusicNote ? 'CACHE' : 'WAIT', 0);
              console.warn('Music Note catalog read failed; keeping local cache and refusing legacy pagination.', error);
            },
          });
        }
'''
app = replace_between(
    app,
    '        const shouldVerifyMusicNoteBundle =',
    '\n\n        // 901: delayed full-list recovery disabled; manual Sync owns full reconciliation.',
    new_catalog_branch,
    'Music Note catalog-first branch',
)

# Server paging must be impossible even if an old component accidentally calls the prop.
app = replace_between(
    app,
    '  const loadMoreFavorites = useCallback(async () => {',
    '\n\n  const syncMusicNoteIncrementalFromRemoteVersion = useCallback(',
    "  const loadMoreFavorites = useCallback(async () => {\n    // 1036: 20 is a render batch only. A Music Note More click must never read Firestore.\n    setHasMoreFavorites(false);\n    markCacheDiagnostic('musicNote', 'CACHE', 0);\n  }, []);\n\n  const syncMusicNoteIncrementalFromRemoteVersion = useCallback(",
    'remove Music Note server loadMore',
)

app_path.write_text(app, encoding='utf-8')


# -----------------------------------------------------------------------------
# FavoritesPage — only local rendering More remains.
# -----------------------------------------------------------------------------
fav_path = Path('src/pages/FavoritesPage.tsx')
fav = fav_path.read_text(encoding='utf-8')
fav = replace_between(
    fav,
    '  const canShowCachedMusicNoteMore = visibleCount < filteredFavorites.length;',
    '\n\n  const musicNoteFilterCount =',
    "  const canShowCachedMusicNoteMore = visibleCount < filteredFavorites.length;\n  // 1036: Music Note mirrors Library full-catalog behavior. More is local-only.\n  const shouldShowMusicNoteMoreButton = canShowCachedMusicNoteMore;\n\n  const musicNoteFilterCount =",
    'FavoritesPage local-only More state',
)
fav = replace_once(
    fav,
    "                  if (canRequestMoreMusicNotePage) {\n                    await onLoadMoreFavorites?.();\n                    setVisibleCount(prev => prev + MUSIC_NOTE_VISIBLE_BATCH_SIZE);\n                  }",
    "                  // Full catalog already contains every row; no server fallback exists here.",
    'FavoritesPage remove server More click',
)
fav = replace_once(
    fav,
    "                onMouseEnter={() => onHover({ id: 'load-more', label: '더보기', description: '곡을 20개 더 불러오거나 보여줍니다.' })}",
    "                onMouseEnter={() => onHover({ id: 'load-more', label: '더보기', description: '저장된 곡을 20개 더 보여줍니다.' })}",
    'FavoritesPage More tooltip',
)
old_label = """                {isLoadingMoreFavorites
                  ? '불러오는 중...'
                  : canShowCachedMusicNoteMore
                    ? `더보기 (${filteredFavorites.length - visibleCount}개 남음)`
                    : musicNoteViewMode === 'noteSpace'
                      ? '더보기 (20개 더 불러오기)'
                      : '더보기'}"""
new_label = """                {`더보기 (${Math.max(0, filteredFavorites.length - visibleCount)}개 남음)`}"""
fav = replace_once(fav, old_label, new_label, 'FavoritesPage More label')
fav_path.write_text(fav, encoding='utf-8')


# -----------------------------------------------------------------------------
# userDataEngine — invalidate prior possibly-partial V2 objects/caches and make
# cold-device App Check startup resilient instead of dropping into legacy paging.
# -----------------------------------------------------------------------------
engine_path = Path('src/lib/userDataEngine.ts')
engine = engine_path.read_text(encoding='utf-8')
engine = engine.replace('schemaVersion: 2;', 'schemaVersion: 3;')
engine = replace_once(engine, 'const CATALOG_SCHEMA_VERSION = 2 as const;', 'const CATALOG_SCHEMA_VERSION = 3 as const;', 'catalog schema bump')
engine = replace_once(engine, "const CATALOG_DB_NAME = 'soridraw_user_data_engine_v2';\nconst LEGACY_CATALOG_DB_NAME = 'soridraw_user_data_engine_v1';", "const CATALOG_DB_NAME = 'soridraw_user_data_engine_v3';\nconst LEGACY_CATALOG_DB_NAMES = ['soridraw_user_data_engine_v2', 'soridraw_user_data_engine_v1'];", 'catalog IndexedDB generation bump')
engine = replace_once(
    engine,
    "  try {\n    indexedDB.deleteDatabase(LEGACY_CATALOG_DB_NAME);\n  } catch {\n    // Best-effort cleanup only. The old DB is never read by V2.\n  }",
    "  for (const databaseName of LEGACY_CATALOG_DB_NAMES) {\n    try {\n      indexedDB.deleteDatabase(databaseName);\n    } catch {\n      // Best-effort cleanup only. Old catalog DBs are never read by V3.\n    }\n  }",
    'catalog legacy DB cleanup',
)

engine = replace_between(
    engine,
    'const authenticatedHeaders = async (): Promise<Record<string, string> | null> => {',
    '\n\nconst readRemoteCatalogSnapshot = async (',
    r'''const catalogWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const authenticatedHeaders = async (): Promise<Record<string, string> | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  const retryDelays = [0, 250, 800, 1600];
  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    if (retryDelays[attempt] > 0) await catalogWait(retryDelays[attempt]);
    try {
      const [idToken, appCheckToken] = await Promise.all([
        user.getIdToken(attempt >= 2),
        getFirebaseAppCheckToken(),
      ]);
      if (idToken && appCheckToken) {
        return {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
          'X-Firebase-AppCheck': appCheckToken,
        };
      }
    } catch (error) {
      if (attempt === retryDelays.length - 1) {
        console.warn('[userDataEngine] catalog auth headers unavailable after retry.', error);
      }
    }
  }
  return null;
};

const readRemoteCatalogSnapshot = async (''',
    'catalog auth retry',
)

# Replace the entire remote reader so transient App Check/Worker startup does not
# cause a permanent fallback. Security stays fail-closed; retries never omit tokens.
engine = replace_between(
    engine,
    'const readRemoteCatalogSnapshot = async (',
    '\n\nexport const readCatalogSnapshotCacheFirst = async (',
    r'''const readRemoteCatalogSnapshot = async (
  kind: SoridrawCatalogKind,
  uid: string,
  minimumRevision = 0,
): Promise<SoridrawCatalogSnapshot | null> => {
  if (!uid || !isPreviewCatalogEnabled()) return null;
  const user = auth.currentUser;
  if (!user || user.uid !== uid) return null;

  const retryDelays = [0, 350, 1000];
  let lastError: unknown = null;
  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    if (retryDelays[attempt] > 0) await catalogWait(retryDelays[attempt]);
    try {
      const headers = await authenticatedHeaders();
      if (!headers) throw new Error('CATALOG_AUTH_NOT_READY');
      const knownRemoteRevision = Math.max(readKnownRemoteCatalogRevision(kind, uid), Math.floor(minimumRevision || 0));
      if (knownRemoteRevision > 0) headers['X-Soridraw-Known-Revision'] = String(knownRemoteRevision);
      const response = await fetch(`${CATALOG_ENDPOINT}/v1/catalog/${kind}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      if (response.status === 404) throw new Error('CATALOG_NOT_MATERIALIZED');
      if (!response.ok) throw new Error(`CATALOG_READ_${response.status}`);
      const payload = await response.json();
      if (!isValidSnapshot(kind, payload)) throw new Error('CATALOG_PAYLOAD_INVALID');
      if (knownRemoteRevision > 0 && payload.revision < knownRemoteRevision) {
        throw new Error('CATALOG_REVISION_STALE');
      }
      await writeCatalogSnapshotToLocalCache(kind, uid, payload);
      return payload;
    } catch (error) {
      lastError = error;
    }
  }
  console.warn(`[userDataEngine] ${kind} catalog snapshot read unavailable after retry.`, lastError);
  return null;
};

export const readCatalogSnapshotCacheFirst = async (''',
    'catalog remote retry',
)
engine_path.write_text(engine, encoding='utf-8')


# -----------------------------------------------------------------------------
# Worker — schema/key generation bump forces one canonical rebuild and prevents a
# previously accepted partial R2 object from being trusted forever.
# -----------------------------------------------------------------------------
worker_path = Path('cloudflare/media-worker/src/index.js')
worker = worker_path.read_text(encoding='utf-8')
worker = replace_once(worker, 'const CATALOG_SCHEMA_VERSION = 2;', 'const CATALOG_SCHEMA_VERSION = 3;', 'worker catalog schema bump')
worker = replace_once(worker, "const catalogObjectKey = (uid, kind) => `catalog/v2/${encodeURIComponent(uid)}/${kind}.json`;", "const catalogObjectKey = (uid, kind) => `catalog/v3/${encodeURIComponent(uid)}/${kind}.json`;", 'worker R2 generation bump')
worker = replace_once(
    worker,
    "        automaticWavGeneration: false,",
    "        automaticWavGeneration: false,\n        catalogSchemaVersion: CATALOG_SCHEMA_VERSION,",
    'worker health catalog schema',
)
worker_path.write_text(worker, encoding='utf-8')

print('1036 Music Note / Library catalog parity patch applied')

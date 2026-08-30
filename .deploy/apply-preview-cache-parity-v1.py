#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else '.')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 anchor, found {count}')
    return text.replace(old, new, 1)


# -----------------------------------------------------------------------------
# Music Note
# Contract:
# - payload + schema are UID-scoped
# - outdated/missing cache is ignored and rebuilt from the user's complete
#   favorites collection exactly once (no orderBy / limit)
# - schema is marked current only after the complete payload is handed to the
#   existing cache writer
# - account changes clear active UI memory but never another UID's durable cache
# -----------------------------------------------------------------------------
app_path = ROOT / 'src/App.tsx'
app = app_path.read_text(encoding='utf-8')

music_note_marker_anchor = "const musicNoteFreshBootstrapUids = new Set<string>();\n"
music_note_helpers = r'''
const MUSIC_NOTE_CACHE_SCHEMA_VERSION = '3';
const MUSIC_NOTE_CACHE_SCHEMA_STORAGE_BASE = 'soridraw_music_note_cache_schema_v3';
let musicNoteActiveUiUid: string | null = null;

const getMusicNoteCacheSchemaKey = (uid: string) => `${MUSIC_NOTE_CACHE_SCHEMA_STORAGE_BASE}_${uid}`;
const getMusicNotePayloadCacheKey = (uid: string) => `soridraw_favorites_cache_${uid}`;

const hasMusicNotePayloadCache = (uid: string): boolean => {
  if (!uid) return false;
  if (favoritesInMemoryCache.has(uid)) return true;
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(getMusicNotePayloadCacheKey(uid)) !== null;
  } catch {
    return false;
  }
};

const isMusicNoteCacheSchemaCurrent = (uid: string): boolean => {
  if (!uid || typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(getMusicNoteCacheSchemaKey(uid)) === MUSIC_NOTE_CACHE_SCHEMA_VERSION;
  } catch {
    return false;
  }
};

const prepareMusicNoteCacheForUser = (uid: string): boolean => {
  if (!uid) return true;
  const schemaCurrent = isMusicNoteCacheSchemaCurrent(uid);
  if (!schemaCurrent) {
    favoritesInMemoryCache.delete(uid);
    const pendingTimer = favoritesCacheWriteTimers.get(uid);
    if (pendingTimer) {
      try { clearTimeout(pendingTimer); } catch {}
      favoritesCacheWriteTimers.delete(uid);
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(getMusicNotePayloadCacheKey(uid));
        localStorage.removeItem(`soridraw_favorites_cache_max_count_${uid}`);
        localStorage.removeItem(`${MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE}_${uid}`);
        localStorage.removeItem(`${MUSIC_NOTE_REMOTE_SYNC_VERSION_STORAGE_BASE}_${uid}`);
        localStorage.removeItem(`${MUSIC_NOTE_PAGINATION_CURSOR_STORAGE_BASE}_${uid}`);
        localStorage.removeItem(`soridraw_favorites_full_cache_recovery_v3_${uid}`);
      } catch (error) {
        console.warn('Music Note legacy cache invalidation failed:', error);
      }
    }
  }
  // Stored [] is a valid zero-item payload. Missing payload always rebuilds.
  return !schemaCurrent || !hasMusicNotePayloadCache(uid);
};

const markMusicNoteCacheSchemaCurrent = (uid: string) => {
  if (!uid || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getMusicNoteCacheSchemaKey(uid), MUSIC_NOTE_CACHE_SCHEMA_VERSION);
  } catch {}
};
'''
app = replace_once(
    app,
    music_note_marker_anchor,
    music_note_marker_anchor + music_note_helpers,
    'music-note-cache-schema-helpers',
)

app = replace_once(
    app,
    """    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
""",
    """    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      const nextMusicNoteUiUid = currentUser?.uid || null;
      if (musicNoteActiveUiUid !== nextMusicNoteUiUid) {
        // Never leave account A's active list visible while account B hydrates.
        // Durable caches remain separated by UID.
        setFavorites([]);
        musicNoteActiveUiUid = nextMusicNoteUiUid;
      }
""",
    'music-note-account-switch-memory-reset',
)

app = replace_once(
    app,
    """        // Fetch favorites for the user.
        // Server reads are paged, but the local cache is kept as a free UI fallback so My/Shared tabs do not appear empty while older pages are not loaded yet.
        const cachedFavs = getFavoritesCacheInMemoryOrLocalStorage(currentUser.uid);
        if (Array.isArray(cachedFavs) && cachedFavs.length > 0) {
          musicNoteFreshBootstrapUids.delete(currentUser.uid);
        } else {
          musicNoteFreshBootstrapUids.add(currentUser.uid);
        }

        if (Array.isArray(cachedFavs) && cachedFavs.length > 0) {
          markCacheDiagnostic('musicNote', 'CACHE', 0);
          // Do not slice the cache. It costs nothing and prevents existing My Note / Shared Note items from visually disappearing.
          setFavorites(sortFavoriteList(cachedFavs.filter((favorite) => !isFavoriteSoftRemoved(favorite))));
        } else {
          setFavorites([]);
        }
""",
    """        // Fetch favorites for the user.
        // A cache is trusted only when both its UID-scoped schema and payload are
        // current. Old/partial caches are discarded for this UID only.
        const musicNoteCacheNeedsFullBootstrap = prepareMusicNoteCacheForUser(currentUser.uid);
        const cachedFavs = getFavoritesCacheInMemoryOrLocalStorage(currentUser.uid);
        if (!musicNoteCacheNeedsFullBootstrap && hasMusicNotePayloadCache(currentUser.uid)) {
          musicNoteFreshBootstrapUids.delete(currentUser.uid);
        } else {
          musicNoteFreshBootstrapUids.add(currentUser.uid);
        }

        if (!musicNoteCacheNeedsFullBootstrap && hasMusicNotePayloadCache(currentUser.uid)) {
          markCacheDiagnostic('musicNote', 'CACHE', 0);
          // Do not slice the cache. It costs nothing and prevents existing My Note / Shared Note items from visually disappearing.
          setFavorites(sortFavoriteList(cachedFavs.filter((favorite) => !isFavoriteSoftRemoved(favorite))));
        } else {
          setFavorites([]);
        }
""",
    'music-note-versioned-cache-bootstrap',
)

app = replace_once(
    app,
    """        // 921: the old automatic full-collection recovery is intentionally dead.
        // Full collection reads are allowed only for explicit all-item operations.
        const runFavoritesFullCacheRecoveryOnce = async () => {};


        const hasCachedMusicNote = Array.isArray(cachedFavs) && cachedFavs.length > 0;
""",
    """        // Cache migration/new-device bootstrap: one complete read is the
        // authoritative source. No orderBy/limit means legacy rows without
        // createdAt are included too. No server data is written by this path.
        const runFavoritesFullCacheRecoveryOnce = async () => {
          if (!musicNoteCacheNeedsFullBootstrap) return;
          try {
            const fullSnapshot = await getDocs(query(
              collection(db, 'favorites'),
              where('uid', '==', currentUser.uid),
            ));
            if (auth.currentUser?.uid !== currentUser.uid) return;
            const fullFavorites = sortFavoriteList(
              fullSnapshot.docs
                .map(mapFavoriteFirestoreDoc)
                .filter((favorite) => !isFavoriteSoftRemoved(favorite)),
            );
            favoritePaginationCursorRef.current = null;
            clearMusicNotePaginationCursor(currentUser.uid);
            favoritePaginationExhaustedRef.current = true;
            favoritePaginationLoadingRef.current = false;
            favoritePaginationFallbackModeRef.current = true;
            setHasMoreFavorites(false);
            setIsLoadingMoreFavorites(false);
            setFavorites(fullFavorites);
            writeFavoritesCache(currentUser.uid, fullFavorites);
            favoritesStore.setFavorites(fullFavorites);
            markMusicNoteCacheSchemaCurrent(currentUser.uid);
            musicNoteFreshBootstrapUids.delete(currentUser.uid);
            markCacheDiagnostic('musicNote', 'SYNC', fullSnapshot.docs.length);
          } catch (bootstrapError) {
            console.warn('Cacheless Music Note full bootstrap failed.', bootstrapError);
          } finally {
            setIsFavoritesLoading(false);
          }
        };

        const hasCachedMusicNote = !musicNoteCacheNeedsFullBootstrap
          && hasMusicNotePayloadCache(currentUser.uid);
        if (musicNoteCacheNeedsFullBootstrap) {
          void runFavoritesFullCacheRecoveryOnce();
        }
""",
    'music-note-immediate-full-bootstrap',
)

app = replace_once(
    app,
    """        const attachFavoritesSourceBootstrap902 = () => {
          if (unsubFavs || hasCachedMusicNote) return;
""",
    """        const attachFavoritesSourceBootstrap902 = () => {
          if (unsubFavs || hasCachedMusicNote || musicNoteCacheNeedsFullBootstrap) return;
""",
    'music-note-no-paged-race-during-full-bootstrap',
)

app = replace_once(
    app,
    """        const shouldVerifyMusicNoteBundle = !hasCachedMusicNote
          || musicNoteLocalVersionAtBootstrap <= 0
          || musicNoteRemoteVersionAtBootstrap > musicNoteLocalVersionAtBootstrap;
""",
    """        const shouldVerifyMusicNoteBundle = hasCachedMusicNote && (
          musicNoteLocalVersionAtBootstrap <= 0
          || musicNoteRemoteVersionAtBootstrap > musicNoteLocalVersionAtBootstrap
        );
""",
    'music-note-skip-bundle-during-full-bootstrap',
)

app_path.write_text(app, encoding='utf-8')


# -----------------------------------------------------------------------------
# Library
# Same cache-first principle as Music Note, but the large payload is stored in
# IndexedDB rather than localStorage. localStorage keeps only small schema/
# version metadata. A missing/outdated payload performs exactly one complete
# user-owned suno_tracks read, then route re-entry/reload hydrates from cache.
# -----------------------------------------------------------------------------
library_path = ROOT / 'src/pages/SunoLibraryPage.tsx'
library = library_path.read_text(encoding='utf-8')

library_global_anchor = "let libraryWorkspaceAuthGuardStarted = false;\n"
library_helpers = r'''
const LIBRARY_WORKSPACE_CACHE_SCHEMA_VERSION = '3';
const LIBRARY_WORKSPACE_CACHE_SCHEMA_STORAGE_BASE = 'soridraw_library_workspace_cache_schema_v3';
const LIBRARY_WORKSPACE_CACHE_DB_NAME = 'soridraw_library_workspace_cache_v3';
const LIBRARY_WORKSPACE_CACHE_STORE = 'workspace';
let libraryActiveUiUid: string | null = null;
const libraryWorkspaceInMemoryCache = new Map<string, any[]>();
const libraryWorkspaceCacheWriteTimers = new Map<string, ReturnType<typeof setTimeout>>();
let libraryWorkspaceCacheDbPromise: Promise<IDBDatabase | null> | null = null;

const getLibraryWorkspaceCacheSchemaKey = (uid: string) => `${LIBRARY_WORKSPACE_CACHE_SCHEMA_STORAGE_BASE}_${uid}`;
const getLegacyLibraryWorkspacePayloadCacheKey = (uid: string) => `soridraw_suno_tracks_cache_${uid}`;

const isLibraryWorkspaceCacheSchemaCurrent = (uid: string): boolean => {
  if (!uid || typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(getLibraryWorkspaceCacheSchemaKey(uid)) === LIBRARY_WORKSPACE_CACHE_SCHEMA_VERSION;
  } catch {
    return false;
  }
};

const markLibraryWorkspaceCacheSchemaCurrent = (uid: string) => {
  if (!uid || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getLibraryWorkspaceCacheSchemaKey(uid), LIBRARY_WORKSPACE_CACHE_SCHEMA_VERSION);
  } catch {}
};

const openLibraryWorkspaceCacheDb = (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (libraryWorkspaceCacheDbPromise) return libraryWorkspaceCacheDbPromise;
  libraryWorkspaceCacheDbPromise = new Promise((resolve) => {
    let settled = false;
    const request = indexedDB.open(LIBRARY_WORKSPACE_CACHE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(LIBRARY_WORKSPACE_CACHE_STORE)) {
        database.createObjectStore(LIBRARY_WORKSPACE_CACHE_STORE, { keyPath: 'uid' });
      }
    };
    request.onsuccess = () => {
      settled = true;
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        libraryWorkspaceCacheDbPromise = null;
      };
      resolve(database);
    };
    request.onerror = () => {
      if (!settled) resolve(null);
    };
    request.onblocked = () => {
      if (!settled) resolve(null);
    };
  });
  return libraryWorkspaceCacheDbPromise;
};

const readLibraryWorkspaceTrackCacheFromIndexedDb = async (uid: string): Promise<any[] | null> => {
  if (!uid) return null;
  const database = await openLibraryWorkspaceCacheDb();
  if (!database) return null;
  try {
    return await new Promise<any[] | null>((resolve) => {
      const transaction = database.transaction(LIBRARY_WORKSPACE_CACHE_STORE, 'readonly');
      const request = transaction.objectStore(LIBRARY_WORKSPACE_CACHE_STORE).get(uid);
      request.onsuccess = () => {
        const record = request.result;
        resolve(record && Array.isArray(record.tracks) ? record.tracks : null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

const persistLibraryWorkspaceTrackCacheNow = async (uid: string, list: any[]): Promise<boolean> => {
  if (!uid) return false;
  const database = await openLibraryWorkspaceCacheDb();
  if (!database) return false;
  const safeList = Array.isArray(list) ? list : [];
  try {
    return await new Promise<boolean>((resolve) => {
      const transaction = database.transaction(LIBRARY_WORKSPACE_CACHE_STORE, 'readwrite');
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
      transaction.objectStore(LIBRARY_WORKSPACE_CACHE_STORE).put({
        uid,
        schemaVersion: LIBRARY_WORKSPACE_CACHE_SCHEMA_VERSION,
        tracks: safeList,
        savedAtMs: Date.now(),
      });
    });
  } catch {
    return false;
  }
};

const prepareLibraryWorkspaceCacheForUser = (uid: string): boolean => {
  if (!uid) return true;
  const schemaCurrent = isLibraryWorkspaceCacheSchemaCurrent(uid);
  if (!schemaCurrent) {
    libraryWorkspaceInMemoryCache.delete(uid);
    const pendingTimer = libraryWorkspaceCacheWriteTimers.get(uid);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      libraryWorkspaceCacheWriteTimers.delete(uid);
    }
    if (typeof localStorage !== 'undefined') {
      try {
        // Old Library payloads were large JSON blobs in localStorage. They are
        // deliberately retired so a partial/quota-failed payload cannot return.
        localStorage.removeItem(getLegacyLibraryWorkspacePayloadCacheKey(uid));
        localStorage.removeItem(`soridraw_library_local_sync_version_v1_${uid}`);
      } catch (error) {
        console.warn('Library legacy cache invalidation failed:', error);
      }
    }
  }
  return !schemaCurrent;
};
'''
library = replace_once(
    library,
    library_global_anchor,
    library_global_anchor + library_helpers,
    'library-v3-cache-helpers',
)

library = replace_once(
    library,
    r'''const readLibraryWorkspaceTrackCache = (uid: string): any[] => {
  try {
    const raw = localStorage.getItem(`soridraw_suno_tracks_cache_${uid}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to read shared library workspace cache:', error);
    return [];
  }
};

const saveLibraryWorkspaceTrackCache = (uid: string, list: any[]) => {
  try {
    localStorage.setItem(`soridraw_suno_tracks_cache_${uid}`, JSON.stringify(Array.isArray(list) ? list : []));
  } catch (error) {
    console.warn('Failed to save shared library workspace cache:', error);
  }
};
''',
    r'''const readLibraryWorkspaceTrackCache = (uid: string): any[] => {
  const cached = libraryWorkspaceInMemoryCache.get(uid);
  return Array.isArray(cached) ? cached : [];
};

const saveLibraryWorkspaceTrackCache = (uid: string, list: any[]) => {
  if (!uid) return;
  const safeList = Array.isArray(list) ? list : [];
  libraryWorkspaceInMemoryCache.set(uid, safeList);
  const pendingTimer = libraryWorkspaceCacheWriteTimers.get(uid);
  if (pendingTimer) clearTimeout(pendingTimer);
  const timer = setTimeout(() => {
    libraryWorkspaceCacheWriteTimers.delete(uid);
    void persistLibraryWorkspaceTrackCacheNow(uid, safeList).then((persisted) => {
      if (persisted) {
        markLibraryWorkspaceCacheSchemaCurrent(uid);
      } else {
        console.warn('Library IndexedDB cache write failed; schema remains unverified.');
      }
    });
  }, 500);
  libraryWorkspaceCacheWriteTimers.set(uid, timer);
};
''',
    'library-replace-localstorage-payload-cache',
)

library = replace_once(
    library,
    """  const cachedTracks = readLibraryWorkspaceTrackCache(uid);
  const session: LibraryWorkspaceSession = {
""",
    """  const libraryCacheNeedsFullBootstrap = prepareLibraryWorkspaceCacheForUser(uid);
  const cachedTracks = readLibraryWorkspaceTrackCache(uid);
  const session: LibraryWorkspaceSession = {
""",
    'library-prepare-versioned-cache',
)

library = replace_once(
    library,
    """  const tracksRef = collection(db, 'suno_tracks', uid, 'tracks');
  const pageQuery = query(
""",
    """  const tracksRef = collection(db, 'suno_tracks', uid, 'tracks');
  let libraryFullBootstrapStarted = false;
  const bootstrapCachelessLibraryFromServerOnce = async () => {
    if (libraryFullBootstrapStarted) return;
    libraryFullBootstrapStarted = true;
    try {
      const snapshot = await getDocs(tracksRef);
      if (libraryWorkspaceSession !== session || session.uid !== uid) return;
      const list = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      session.tracks = mergeLibraryWorkspaceSessionTracks(list, []);
      libraryWorkspaceInMemoryCache.set(uid, session.tracks);
      session.lastDoc = null;
      session.hasMore = false;
      session.paginationFallback = true;
      session.ready = true;
      const persisted = await persistLibraryWorkspaceTrackCacheNow(uid, session.tracks);
      if (persisted) {
        markLibraryWorkspaceCacheSchemaCurrent(uid);
        const remoteVersion = readRemoteLibraryVersion();
        if (remoteVersion > 0) writeLibraryBundleLocalSyncVersion(uid, remoteVersion);
      } else {
        console.warn('Library full bootstrap loaded server data but IndexedDB persistence failed.');
      }
      markCacheDiagnostic('library', 'SYNC', snapshot.docs.length);
      emitLibraryWorkspaceSession(session);
    } catch (bootstrapError) {
      console.warn('Cacheless Library full bootstrap failed.', bootstrapError);
      session.ready = true;
      emitLibraryWorkspaceSession(session);
    }
  };

  const pageQuery = query(
""",
    'library-full-bootstrap',
)

library = replace_once(
    library,
    """  const shouldVerifyLibraryBundle = () => {
    const localVersion = readLibraryBundleLocalSyncVersion(uid);
    const remoteVersion = readRemoteLibraryVersion();
    // localVersion === 0 is a one-time 936 migration check for existing caches.
    return cachedTracks.length === 0 || localVersion <= 0 || remoteVersion > localVersion;
  };

  const handleLibraryProfileVersion = (event: Event) => {
""",
    """  const shouldVerifyLibraryBundle = () => {
    const localVersion = readLibraryBundleLocalSyncVersion(uid);
    const remoteVersion = readRemoteLibraryVersion();
    return session.tracks.length === 0 || remoteVersion > localVersion;
  };

  let libraryHydrationStarted = false;
  const hydrateLibraryWorkspaceCacheThenSync = async () => {
    if (libraryHydrationStarted) return;
    libraryHydrationStarted = true;

    if (!libraryCacheNeedsFullBootstrap) {
      const durableTracks = await readLibraryWorkspaceTrackCacheFromIndexedDb(uid);
      if (libraryWorkspaceSession !== session || session.uid !== uid) return;
      // [] is a valid durable zero-track cache. null means missing/corrupt cache.
      if (durableTracks !== null) {
        libraryWorkspaceInMemoryCache.set(uid, durableTracks);
        session.tracks = mergeLibraryWorkspaceSessionTracks(durableTracks, []);
        session.lastDoc = null;
        session.hasMore = false;
        session.paginationFallback = true;
        session.ready = true;
        markCacheDiagnostic('library', 'CACHE', 0);
        emitLibraryWorkspaceSession(session);
        if (shouldVerifyLibraryBundle() && readRemoteLibraryVersion() > readLibraryBundleLocalSyncVersion(uid)) {
          startLibraryBundleVerification();
        }
        return;
      }
    }

    await bootstrapCachelessLibraryFromServerOnce();
  };

  const handleLibraryProfileVersion = (event: Event) => {
""",
    'library-cache-first-hydration',
)

library = replace_once(
    library,
    """  const handleLibraryProfileVersion = (event: Event) => {
    const detail = (event as CustomEvent<{ uid?: string }>).detail;
    if (!detail || detail.uid !== uid) return;
    if (readRemoteLibraryVersion() > readLibraryBundleLocalSyncVersion(uid)) {
      startLibraryBundleVerification();
    }
  };
""",
    """  const handleLibraryProfileVersion = (event: Event) => {
    const detail = (event as CustomEvent<{ uid?: string }>).detail;
    if (!detail || detail.uid !== uid) return;
    if (!session.ready) return;
    if (readRemoteLibraryVersion() > readLibraryBundleLocalSyncVersion(uid)) {
      startLibraryBundleVerification();
    }
  };
""",
    'library-version-event-ready-guard',
)

library = replace_once(
    library,
    """  if (shouldVerifyLibraryBundle()) {
    startLibraryBundleVerification();
  } else {
    session.ready = true;
    markCacheDiagnostic('library', 'CACHE', 0);
    emitLibraryWorkspaceSession(session);
  }
""",
    """  // Durable cache always gets first chance. Server is used only when the
  // UID cache is missing/outdated, or later when the profile version proves it changed.
  void hydrateLibraryWorkspaceCacheThenSync();
""",
    'library-cache-first-startup',
)

library = replace_once(
    library,
    r'''  const saveWorkspaceTrackCache = (uid: string, list: any[]) => {
    try {
      localStorage.setItem(`soridraw_suno_tracks_cache_${uid}`, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save suno_tracks to cache:', e);
    }
  };
''',
    r'''  const saveWorkspaceTrackCache = (uid: string, list: any[]) => {
    saveLibraryWorkspaceTrackCache(uid, list);
  };
''',
    'library-remove-duplicate-localstorage-writer',
)

library = replace_once(
    library,
    """      const resolvedUser = currentUser || appUser || auth.currentUser;
      setUser(resolvedUser);

      if (unsubscribeWorkspaceView) {
""",
    """      const resolvedUser = currentUser || appUser || auth.currentUser;
      setUser(resolvedUser);
      const nextLibraryUiUid = resolvedUser?.uid || null;
      if (libraryActiveUiUid !== nextLibraryUiUid) {
        // Account A/B active state must never cross even for one render.
        setTracks([]);
        setWorkspaceVisibleCount(WORKSPACE_PAGE_SIZE);
        libraryActiveUiUid = nextLibraryUiUid;
      }

      if (unsubscribeWorkspaceView) {
""",
    'library-account-switch-memory-reset',
)

library_path.write_text(library, encoding='utf-8')

print('PREVIEW_CACHE_PARITY_V1_APPLIED=true')
print('MUSIC_NOTE_UID_CACHE_SCHEMA_V3=true')
print('MUSIC_NOTE_CACHELESS_FULL_BOOTSTRAP=true')
print('LIBRARY_UID_CACHE_SCHEMA_V3=true')
print('LIBRARY_INDEXEDDB_DURABLE_CACHE=true')
print('LIBRARY_DUPLICATE_LOCALSTORAGE_WRITER_REMOVED=true')
print('ACCOUNT_SWITCH_MEMORY_RESET=true')

#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else 'app')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 anchor, found {count}')
    return text.replace(old, new, 1)


library_path = ROOT / 'src/pages/SunoLibraryPage.tsx'
library = library_path.read_text(encoding='utf-8')

old_helpers = r'''const LIBRARY_WORKSPACE_CACHE_SCHEMA_VERSION = '2';
const LIBRARY_WORKSPACE_CACHE_SCHEMA_STORAGE_BASE = 'soridraw_library_workspace_cache_schema_v2';
let libraryActiveUiUid: string | null = null;

const getLibraryWorkspaceCacheSchemaKey = (uid: string) => `${LIBRARY_WORKSPACE_CACHE_SCHEMA_STORAGE_BASE}_${uid}`;
const getLibraryWorkspacePayloadCacheKey = (uid: string) => `soridraw_suno_tracks_cache_${uid}`;

const hasLibraryWorkspacePayloadCache = (uid: string): boolean => {
  if (!uid || typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(getLibraryWorkspacePayloadCacheKey(uid)) !== null;
  } catch {
    return false;
  }
};

const isLibraryWorkspaceCacheSchemaCurrent = (uid: string): boolean => {
  if (!uid || typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(getLibraryWorkspaceCacheSchemaKey(uid)) === LIBRARY_WORKSPACE_CACHE_SCHEMA_VERSION;
  } catch {
    return false;
  }
};

const prepareLibraryWorkspaceCacheForUser = (uid: string): boolean => {
  if (!uid) return true;
  const schemaCurrent = isLibraryWorkspaceCacheSchemaCurrent(uid);
  if (!schemaCurrent && typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(getLibraryWorkspacePayloadCacheKey(uid));
      localStorage.removeItem(`soridraw_library_local_sync_version_v1_${uid}`);
    } catch (error) {
      console.warn('Library legacy cache invalidation failed:', error);
    }
  }
  return !schemaCurrent || !hasLibraryWorkspacePayloadCache(uid);
};

const markLibraryWorkspaceCacheSchemaCurrent = (uid: string) => {
  if (!uid || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getLibraryWorkspaceCacheSchemaKey(uid), LIBRARY_WORKSPACE_CACHE_SCHEMA_VERSION);
  } catch {}
};
'''

new_helpers = r'''const LIBRARY_WORKSPACE_CACHE_SCHEMA_VERSION = '3';
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
        const tracks = record && Array.isArray(record.tracks) ? record.tracks : null;
        resolve(tracks);
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
        // V1/V2 stored the complete Library JSON in localStorage. It is no longer
        // a payload source because large libraries can exceed localStorage quota.
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

library = replace_once(library, old_helpers, new_helpers, 'library-v3-cache-helpers')

old_cache_functions = r'''const readLibraryWorkspaceTrackCache = (uid: string): any[] => {
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
'''

new_cache_functions = r'''const readLibraryWorkspaceTrackCache = (uid: string): any[] => {
  const cached = libraryWorkspaceInMemoryCache.get(uid);
  return Array.isArray(cached) ? cached : [];
};

const saveLibraryWorkspaceTrackCache = (uid: string, list: any[]) => {
  if (!uid) return;
  const safeList = Array.isArray(list) ? list : [];
  // Same runtime contract as Music Note: memory updates immediately, durable
  // browser persistence is deferred so route changes stay fast.
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
'''

library = replace_once(library, old_cache_functions, new_cache_functions, 'library-v3-cache-read-write')

old_bootstrap = r'''  const tracksRef = collection(db, 'suno_tracks', uid, 'tracks');
  const cachelessLibraryBootstrap = libraryCacheNeedsFullBootstrap;
  const bootstrapCachelessLibraryFromServerOnce = async () => {
    if (!cachelessLibraryBootstrap) return;
    try {
      const snapshot = await getDocs(tracksRef);
      if (libraryWorkspaceSession !== session || session.uid !== uid) return;
      const list = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      session.tracks = mergeLibraryWorkspaceSessionTracks(list, []);
      session.lastDoc = null;
      session.hasMore = false;
      session.paginationFallback = true;
      session.ready = true;
      saveLibraryWorkspaceTrackCache(uid, session.tracks);
      markLibraryWorkspaceCacheSchemaCurrent(uid);
      markCacheDiagnostic('library', 'SYNC', snapshot.docs.length);
      emitLibraryWorkspaceSession(session);
    } catch (bootstrapError) {
      console.warn('Cacheless Library full bootstrap failed.', bootstrapError);
      session.ready = true;
      emitLibraryWorkspaceSession(session);
    }
  };

  const pageQuery = query(
'''

new_bootstrap = r'''  const tracksRef = collection(db, 'suno_tracks', uid, 'tracks');
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
'''

library = replace_once(library, old_bootstrap, new_bootstrap, 'library-v3-full-bootstrap')

old_should_verify = r'''  const shouldVerifyLibraryBundle = () => {
    const localVersion = readLibraryBundleLocalSyncVersion(uid);
    const remoteVersion = readRemoteLibraryVersion();
    // localVersion === 0 is a one-time 936 migration check for existing caches.
    return cachedTracks.length === 0 || localVersion <= 0 || remoteVersion > localVersion;
  };
'''

new_should_verify = r'''  const shouldVerifyLibraryBundle = () => {
    const localVersion = readLibraryBundleLocalSyncVersion(uid);
    const remoteVersion = readRemoteLibraryVersion();
    // Once a full durable cache exists, the root user-profile version signal is
    // enough to decide whether a one-document bundle verification is necessary.
    return session.tracks.length === 0 || remoteVersion > localVersion;
  };

  let libraryHydrationStarted = false;
  const hydrateLibraryWorkspaceCacheThenSync = async () => {
    if (libraryHydrationStarted) return;
    libraryHydrationStarted = true;

    if (!libraryCacheNeedsFullBootstrap) {
      const durableTracks = await readLibraryWorkspaceTrackCacheFromIndexedDb(uid);
      if (libraryWorkspaceSession !== session || session.uid !== uid) return;
      if (durableTracks !== null) {
        libraryWorkspaceInMemoryCache.set(uid, durableTracks);
        session.tracks = mergeLibraryWorkspaceSessionTracks(durableTracks, []);
        session.lastDoc = null;
        session.hasMore = false;
        session.paginationFallback = true;
        session.ready = true;
        markCacheDiagnostic('library', 'CACHE', 0);
        emitLibraryWorkspaceSession(session);
        if (readRemoteLibraryVersion() > readLibraryBundleLocalSyncVersion(uid)) {
          startLibraryBundleVerification();
        }
        return;
      }
    }

    // Missing/outdated durable cache: exactly one complete user-owned server read.
    await bootstrapCachelessLibraryFromServerOnce();
  };
'''

library = replace_once(library, old_should_verify, new_should_verify, 'library-v3-hydrate-cache')

old_profile_handler = r'''  const handleLibraryProfileVersion = (event: Event) => {
    const detail = (event as CustomEvent<{ uid?: string }>).detail;
    if (!detail || detail.uid !== uid) return;
    if (cachelessLibraryBootstrap) return;
    if (readRemoteLibraryVersion() > readLibraryBundleLocalSyncVersion(uid)) {
      startLibraryBundleVerification();
    }
  };
'''

new_profile_handler = r'''  const handleLibraryProfileVersion = (event: Event) => {
    const detail = (event as CustomEvent<{ uid?: string }>).detail;
    if (!detail || detail.uid !== uid) return;
    if (!session.ready) return;
    if (readRemoteLibraryVersion() > readLibraryBundleLocalSyncVersion(uid)) {
      startLibraryBundleVerification();
    }
  };
'''

library = replace_once(library, old_profile_handler, new_profile_handler, 'library-v3-profile-version-guard')

old_startup = r'''  if (cachelessLibraryBootstrap) {
    void bootstrapCachelessLibraryFromServerOnce();
  } else if (shouldVerifyLibraryBundle()) {
    startLibraryBundleVerification();
  } else {
    session.ready = true;
    markCacheDiagnostic('library', 'CACHE', 0);
    emitLibraryWorkspaceSession(session);
  }
'''

new_startup = r'''  // Hydrate durable Library cache before any server-list decision. This mirrors
  // Music Note's cache-first contract while using IndexedDB for the larger payload.
  void hydrateLibraryWorkspaceCacheThenSync();
'''

library = replace_once(library, old_startup, new_startup, 'library-v3-cache-first-startup')

old_component_writer = r'''  const saveWorkspaceTrackCache = (uid: string, list: any[]) => {
    try {
      localStorage.setItem(`soridraw_suno_tracks_cache_${uid}`, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save suno_tracks to cache:', e);
    }
  };
'''

new_component_writer = r'''  const saveWorkspaceTrackCache = (uid: string, list: any[]) => {
    saveLibraryWorkspaceTrackCache(uid, list);
  };
'''

library = replace_once(library, old_component_writer, new_component_writer, 'library-v3-remove-duplicate-localstorage-writer')

library_path.write_text(library, encoding='utf-8')

print('LIBRARY_CACHE_PARITY_V3_APPLIED=true')
print('LIBRARY_INDEXEDDB_DURABLE_CACHE=true')
print('LIBRARY_DUPLICATE_LOCALSTORAGE_WRITER_REMOVED=true')
print('LIBRARY_UID_ISOLATION_PRESERVED=true')

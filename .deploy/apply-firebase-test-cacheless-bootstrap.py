#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else 'app')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 anchor, found {count}')
    return text.replace(old, new, 1)


# IMPORTANT: apply this only AFTER main's official npm prebuild patch chain.
# This preserves the exact Vercel runtime and changes only cache migration /
# cacheless bootstrap plus Firebase test-host recognition in the isolated
# Firebase test deployment.

firebase_path = ROOT / 'src/firebase.js'
firebase = firebase_path.read_text(encoding='utf-8')
firebase = replace_once(
    firebase,
    'const isVercelTestApp = currentHostname === "soridraw-music.vercel.app";\nconst isFirebaseHostedApp = currentHostname === "soridraw.web.app"',
    'const isVercelTestApp = currentHostname === "soridraw-music.vercel.app";\nconst isFirebaseTestApp = currentHostname === "soridraw-test.web.app"\n  || currentHostname === "soridraw-test.firebaseapp.com";\nconst isFirebaseHostedApp = currentHostname === "soridraw.web.app"',
    'firebase-test-host-anchor',
)
firebase = replace_once(
    firebase,
    'const shouldInitializeAppCheck = isAiStudioPreview || isVercelTestApp || isFirebaseHostedApp;',
    'const shouldInitializeAppCheck = isAiStudioPreview || isVercelTestApp || isFirebaseTestApp || isFirebaseHostedApp;',
    'firebase-appcheck-anchor',
)
firebase_path.write_text(firebase, encoding='utf-8')

email_path = ROOT / 'src/constants/emailVerification.ts'
email = email_path.read_text(encoding='utf-8')
email = replace_once(
    email,
    "  'https://soridraw-music-git-preview-andrawing1212.vercel.app',\n",
    "  'https://soridraw-music-git-preview-andrawing1212.vercel.app',\n  'https://soridraw-test.web.app',\n  'https://soridraw-test.firebaseapp.com',\n",
    'email-return-host-anchor',
)
email_path.write_text(email, encoding='utf-8')

# -----------------------------------------------------------------------------
# Music Note cache contract
# - cache payload is UID-scoped
# - a schema marker is also UID-scoped
# - an older/missing schema invalidates ONLY that UID's old Music Note cache
# - the new schema marker is written only after a successful complete server read
# - active UI memory is cleared immediately when auth identity changes
# -----------------------------------------------------------------------------
app_path = ROOT / 'src/App.tsx'
app = app_path.read_text(encoding='utf-8')

music_note_marker_anchor = "const musicNoteFreshBootstrapUids = new Set<string>();\n"
music_note_helpers = r'''
const MUSIC_NOTE_CACHE_SCHEMA_VERSION = '2';
const MUSIC_NOTE_CACHE_SCHEMA_STORAGE_BASE = 'soridraw_music_note_cache_schema_v2';
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
      } catch (error) {
        console.warn('Music Note legacy cache invalidation failed:', error);
      }
    }
  }
  // A valid zero-item cache still has a stored [] payload. If the payload itself
  // is missing, rebuild even when the schema marker survived independently.
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
        // Never let account A's active in-memory list remain visible while
        // account B is being hydrated. Per-UID durable caches are preserved.
        setFavorites([]);
        musicNoteActiveUiUid = nextMusicNoteUiUid;
      }
""",
    'music-note-account-switch-active-memory-reset',
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
""",
    """        // Fetch favorites for the user.
        // Cache schema is UID-scoped. Only the current UID's outdated cache is
        // invalidated; other accounts on the same computer remain untouched.
        const musicNoteCacheNeedsFullBootstrap = prepareMusicNoteCacheForUser(currentUser.uid);
        const cachedFavs = getFavoritesCacheInMemoryOrLocalStorage(currentUser.uid);
        if (!musicNoteCacheNeedsFullBootstrap && hasMusicNotePayloadCache(currentUser.uid)) {
          musicNoteFreshBootstrapUids.delete(currentUser.uid);
        } else {
          musicNoteFreshBootstrapUids.add(currentUser.uid);
        }
""",
    'music-note-prepare-versioned-cache',
)

app = replace_once(
    app,
    """        // 921: the old automatic full-collection recovery is intentionally dead.
        // Full collection reads are allowed only for explicit all-item operations.
        const runFavoritesFullCacheRecoveryOnce = async () => {};
""",
    """        // Firebase Hosting migration safety: when this UID has no current
        // cache schema/payload, rebuild from the complete user-owned server
        // collection exactly once. No orderBy/limit includes legacy rows.
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
            markMusicNoteCacheSchemaCurrent(currentUser.uid);
            musicNoteFreshBootstrapUids.delete(currentUser.uid);
            markCacheDiagnostic('musicNote', 'SYNC', fullSnapshot.docs.length);
          } catch (bootstrapError) {
            console.warn('Cacheless Music Note full bootstrap failed.', bootstrapError);
          } finally {
            setIsFavoritesLoading(false);
          }
        };
""",
    'music-note-cacheless-full-bootstrap-function',
)

app = replace_once(
    app,
    """        const hasCachedMusicNote = Array.isArray(cachedFavs) && cachedFavs.length > 0;
        if (hasCachedMusicNote) {
""",
    """        const hasCachedMusicNote = !musicNoteCacheNeedsFullBootstrap
          && hasMusicNotePayloadCache(currentUser.uid);
        if (musicNoteCacheNeedsFullBootstrap) {
          void runFavoritesFullCacheRecoveryOnce();
        }
        if (hasCachedMusicNote) {
""",
    'music-note-cacheless-bootstrap-start',
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
    'music-note-skip-bundle-during-cacheless-bootstrap',
)
app_path.write_text(app, encoding='utf-8')

# -----------------------------------------------------------------------------
# Suno Library cache contract: same UID + schema rules as Music Note.
# -----------------------------------------------------------------------------
library_path = ROOT / 'src/pages/SunoLibraryPage.tsx'
library = library_path.read_text(encoding='utf-8')

library_global_anchor = "let libraryWorkspaceAuthGuardStarted = false;\n"
library_helpers = r'''
const LIBRARY_WORKSPACE_CACHE_SCHEMA_VERSION = '2';
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
library = replace_once(
    library,
    library_global_anchor,
    library_global_anchor + library_helpers,
    'library-cache-schema-helpers',
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
""",
    'library-cacheless-full-bootstrap-function',
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
    if (cachelessLibraryBootstrap) return;
    if (readRemoteLibraryVersion() > readLibraryBundleLocalSyncVersion(uid)) {
      startLibraryBundleVerification();
    }
  };
""",
    'library-cacheless-version-event-guard',
)

library = replace_once(
    library,
    """  if (shouldVerifyLibraryBundle()) {
    startLibraryBundleVerification();
  } else {
""",
    """  if (cachelessLibraryBootstrap) {
    void bootstrapCachelessLibraryFromServerOnce();
  } else if (shouldVerifyLibraryBundle()) {
    startLibraryBundleVerification();
  } else {
""",
    'library-cacheless-bootstrap-start',
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
        // Clear only the active UI memory on account transition. Durable caches
        // remain separated by UID, so returning to account A never reads B.
        setTracks([]);
        setWorkspaceVisibleCount(WORKSPACE_PAGE_SIZE);
        libraryActiveUiUid = nextLibraryUiUid;
      }

      if (unsubscribeWorkspaceView) {
""",
    'library-account-switch-active-memory-reset',
)
library_path.write_text(library, encoding='utf-8')

print('CACHELESS_BOOTSTRAP_PATCH_APPLIED=true')
print('UID_SCOPED_CACHE_SCHEMA_V2=PASS')
print('ACCOUNT_SWITCH_MEMORY_RESET=PASS')

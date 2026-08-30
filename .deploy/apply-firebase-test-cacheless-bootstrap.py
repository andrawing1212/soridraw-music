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
# This preserves the exact Vercel runtime and changes only cacheless bootstrap
# plus Firebase test-host recognition in the isolated Firebase test deployment.

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

# Music Note: main 921 intentionally disabled automatic unbounded recovery for
# normal cached sessions. For a brand-new host/device only, rebuild the local
# cache from the complete user-owned server collection exactly once. No orderBy
# or limit means legacy favorites without createdAt are included. Bundle/page
# bootstrap is skipped during this first cacheless session, so it cannot replace
# the complete snapshot with a 20-item subset.
app_path = ROOT / 'src/App.tsx'
app = app_path.read_text(encoding='utf-8')
app = replace_once(
    app,
    """        // 921: the old automatic full-collection recovery is intentionally dead.
        // Full collection reads are allowed only for explicit all-item operations.
        const runFavoritesFullCacheRecoveryOnce = async () => {};
""",
    """        // Firebase Hosting migration safety: a brand-new host/device has no
        // domain-scoped Music Note cache. In that one case rebuild the local cache
        // from the complete user-owned server collection exactly once.
        const runFavoritesFullCacheRecoveryOnce = async () => {
          if (Array.isArray(cachedFavs) && cachedFavs.length > 0) return;
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
            // writeFavoritesCache is local-only here because the cacheless path
            // deliberately never marks a Music Note bundle active in this session.
            writeFavoritesCache(currentUser.uid, fullFavorites);
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
    """        const hasCachedMusicNote = Array.isArray(cachedFavs) && cachedFavs.length > 0;
        if (!hasCachedMusicNote) {
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

# Suno Library: same cacheless rule. Read the complete user collection once with
# no orderBy/limit, sort locally, cache locally, and use the existing local More
# UI. No list-bundle write is scheduled during this bootstrap.
library_path = ROOT / 'src/pages/SunoLibraryPage.tsx'
library = library_path.read_text(encoding='utf-8')
library = replace_once(
    library,
    """  const tracksRef = collection(db, 'suno_tracks', uid, 'tracks');
  const pageQuery = query(
""",
    """  const tracksRef = collection(db, 'suno_tracks', uid, 'tracks');
  const cachelessLibraryBootstrap = cachedTracks.length === 0;
  const bootstrapCachelessLibraryFromServerOnce = async () => {
    if (!cachelessLibraryBootstrap) return;
    try {
      const snapshot = await getDocs(tracksRef);
      if (libraryWorkspaceSession !== session || session.uid !== uid) return;
      const list = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      session.tracks = mergeLibraryWorkspaceSessionTracks(list, []);
      session.lastDoc = null;
      session.hasMore = false;
      // Full server state is now local; More must reveal local rows only and must
      // never ask the createdAt cursor chain for another partial page this session.
      session.paginationFallback = true;
      session.ready = true;
      saveLibraryWorkspaceTrackCache(uid, session.tracks);
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
library_path.write_text(library, encoding='utf-8')

print('CACHELESS_BOOTSTRAP_PATCH_APPLIED=true')

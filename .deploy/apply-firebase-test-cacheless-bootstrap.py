#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else 'app')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 anchor, found {count}')
    return text.replace(old, new, 1)


# Firebase test host recognition only.
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

# Music Note: cacheless/new-host bootstrap must use the existing full un-ordered
# Firestore recovery immediately, rather than waiting for delayed idle recovery.
app_path = ROOT / 'src/App.tsx'
app = app_path.read_text(encoding='utf-8')
app = replace_once(
    app,
    """          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => {
              void performRecovery();
            });
          } else {
            setTimeout(() => {
              void performRecovery();
            }, 3000);
          }
""",
    """          if (!Array.isArray(cachedFavs) || cachedFavs.length === 0) {
            await performRecovery();
          } else if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => {
              void performRecovery();
            });
          } else {
            setTimeout(() => {
              void performRecovery();
            }, 3000);
          }
""",
    'favorites-recovery-schedule',
)
app = replace_once(
    app,
    """              if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(() => applyUpdates());
              } else {
                setTimeout(applyUpdates, 100);
              }
""",
    """              if (!Array.isArray(cachedFavs) || cachedFavs.length === 0) {
                applyUpdates();
              } else if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(() => applyUpdates());
              } else {
                setTimeout(applyUpdates, 100);
              }
""",
    'favorites-apply-schedule',
)
app = replace_once(
    app,
    """        favoriteFullCacheRecoveryTimer = window.setTimeout(() => {
          void runFavoritesFullCacheRecoveryOnce();
        }, 8000);
""",
    """        favoriteFullCacheRecoveryTimer = window.setTimeout(() => {
          void runFavoritesFullCacheRecoveryOnce();
        }, Array.isArray(cachedFavs) && cachedFavs.length > 0 ? 8000 : 0);
""",
    'favorites-recovery-timer',
)
app_path.write_text(app, encoding='utf-8')

# Suno Library: if this browser/host has no workspace cache, do one full server
# read with no orderBy/limit so legacy documents without createdAt are included.
library_path = ROOT / 'src/pages/SunoLibraryPage.tsx'
library = library_path.read_text(encoding='utf-8')
library = replace_once(
    library,
    """      const tracksRef = collection(db, 'suno_tracks', resolvedUser.uid, 'tracks');
      const pageQuery = query(
""",
    """      const tracksRef = collection(db, 'suno_tracks', resolvedUser.uid, 'tracks');
      const shouldBootstrapWorkspaceFromServer = !Array.isArray(cachedTracks) || cachedTracks.length === 0;
      if (shouldBootstrapWorkspaceFromServer) {
        let cancelled = false;
        workspacePaginationFallbackRef.current = true;
        setHasMoreWorkspaceServerTracks(false);
        void getDocs(tracksRef).then((snapshot) => {
          if (cancelled) return;
          const list = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          const sorted = mergeWorkspaceTracks(list, []);
          setTracks(sorted);
          setWorkspaceVisibleCount(WORKSPACE_PAGE_SIZE);
          saveWorkspaceTrackCache(resolvedUser.uid, sorted);
          setLoading(false);
        }).catch((error) => {
          if (cancelled) return;
          console.error('Cacheless workspace server bootstrap failed:', error);
          setLoading(false);
        });
        return () => {
          cancelled = true;
        };
      }

      const pageQuery = query(
""",
    'library-cacheless-bootstrap-anchor',
)
library_path.write_text(library, encoding='utf-8')

print('CACHELESS_BOOTSTRAP_PATCH_APPLIED=true')

#!/usr/bin/env python3
from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 anchor, found {count}')
    text = text.replace(old, new, 1)


payload_anchor = "const getMusicNotePayloadCacheKey = (uid: string) => `soridraw_favorites_cache_${uid}`;\n"
payload_insert = payload_anchor + r'''

// SORIDRAW_MUSIC_NOTE_PREVIEW_CACHE_RECOVERY_1023
// A failed Preview build could leave a partial durable Music Note payload in the
// browser. Never delete that payload. On Preview only, reopen the existing
// bounded first-page source once and merge authoritative server rows into the
// current cache. After a real server snapshot succeeds, later reloads return to
// the normal cache-first path.
const MUSIC_NOTE_PREVIEW_CACHE_RECOVERY_STORAGE_BASE = 'soridraw_music_note_preview_cache_recovery_20260906_v1';
const getMusicNotePreviewCacheRecoveryKey = (uid: string) => `${MUSIC_NOTE_PREVIEW_CACHE_RECOVERY_STORAGE_BASE}_${uid}`;
const isMusicNotePreviewHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = String(window.location.hostname || '').toLowerCase();
  return host === 'preview.soridraw.com'
    || host === 'soridraw-preview.web.app'
    || host === 'soridraw-preview.firebaseapp.com';
};
const needsMusicNotePreviewCacheRecovery = (uid: string): boolean => {
  if (!uid || !isMusicNotePreviewHost() || typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(getMusicNotePreviewCacheRecoveryKey(uid)) !== 'done';
  } catch {
    return true;
  }
};
const markMusicNotePreviewCacheRecoveryComplete = (uid: string) => {
  if (!uid || typeof localStorage === 'undefined') return;
  try { localStorage.setItem(getMusicNotePreviewCacheRecoveryKey(uid), 'done'); } catch {}
};
'''
replace_once(payload_anchor, payload_insert, 'recovery-helper')

bootstrap_anchor = "        const musicNoteCacheNeedsFullBootstrap = prepareMusicNoteCacheForUser(currentUser.uid);\n        const cachedFavs = getFavoritesCacheInMemoryOrLocalStorage(currentUser.uid);\n"
bootstrap_replacement = "        const musicNotePreviewCacheRecoveryNeeded = needsMusicNotePreviewCacheRecovery(currentUser.uid);\n        const musicNoteCacheNeedsFullBootstrap = prepareMusicNoteCacheForUser(currentUser.uid);\n        const cachedFavs = getFavoritesCacheInMemoryOrLocalStorage(currentUser.uid);\n"
replace_once(bootstrap_anchor, bootstrap_replacement, 'recovery-bootstrap-flag')

guard_anchor = "          if (unsubFavs || hasCachedMusicNote || musicNoteCacheNeedsFullBootstrap) return;\n"
guard_replacement = "          if (unsubFavs || (hasCachedMusicNote && !musicNotePreviewCacheRecoveryNeeded) || musicNoteCacheNeedsFullBootstrap) return;\n"
replace_once(guard_anchor, guard_replacement, 'recovery-source-guard')

bundle_anchor = "        const shouldVerifyMusicNoteBundle = hasCachedMusicNote && (\n"
bundle_replacement = "        const shouldVerifyMusicNoteBundle = !musicNotePreviewCacheRecoveryNeeded && hasCachedMusicNote && (\n"
replace_once(bundle_anchor, bundle_replacement, 'recovery-skip-bundle')

else_anchor = """        } else {
          // Cache is already current. Keep 901 delta sync available so a later
          // cross-device version event fetches only changed favorites.
          musicNoteBundleActiveUids.delete(currentUser.uid);
          markCacheDiagnostic('musicNote', 'CACHE', 0);
          setIsFavoritesLoading(false);
        }
"""
else_replacement = """        } else {
          // Cache is already current. Keep 901 delta sync available so a later
          // cross-device version event fetches only changed favorites.
          musicNoteBundleActiveUids.delete(currentUser.uid);
          if (musicNotePreviewCacheRecoveryNeeded) {
            // One bounded verification only on Preview. Existing cached rows stay
            // visible and are merged with the authoritative first server page.
            attachFavoritesSourceBootstrap902();
          } else {
            markCacheDiagnostic('musicNote', 'CACHE', 0);
            setIsFavoritesLoading(false);
          }
        }
"""
replace_once(else_anchor, else_replacement, 'recovery-cache-current-branch')

server_anchor = """            favoritePaginationFallbackModeRef.current = false;
            setHasMoreFavorites(!favoritePaginationExhaustedRef.current);
            setFavorites((prev) => {
"""
server_replacement = """            favoritePaginationFallbackModeRef.current = false;
            setHasMoreFavorites(!favoritePaginationExhaustedRef.current);
            if (!snapshot.metadata.fromCache) {
              markMusicNotePreviewCacheRecoveryComplete(currentUser.uid);
            }
            setFavorites((prev) => {
"""
replace_once(server_anchor, server_replacement, 'recovery-server-ack')

fallback_anchor = """            writeFavoritesCache(currentUser.uid, fallbackFavs);
            markCacheDiagnostic('musicNote', 'SYNC', Math.max(1, fallbackSnapshot.docs.length));
"""
fallback_replacement = """            writeFavoritesCache(currentUser.uid, fallbackFavs);
            markMusicNotePreviewCacheRecoveryComplete(currentUser.uid);
            markCacheDiagnostic('musicNote', 'SYNC', Math.max(1, fallbackSnapshot.docs.length));
"""
replace_once(fallback_anchor, fallback_replacement, 'recovery-fallback-ack')

path.write_text(text, encoding='utf-8')
print('[Music Note Recovery] patch applied')

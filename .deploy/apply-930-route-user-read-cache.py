from pathlib import Path

MARKER = 'SORIDRAW_930_ROUTE_USER_READ_CACHE'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'930 {label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


# -----------------------------------------------------------------------------
# 930 is based on the 929 runtime video, not aggregate totals:
# - entering Music Note repeatedly added ~3 users:getDoc reads per mount
# - entering Library repeatedly added ~1 users:getDoc read per mount
# - staying idle on either route added 0
# Therefore this pass targets only route-mount users/{uid} reads. It deliberately
# does NOT touch user_structures yet; that remains the next isolated step.
# -----------------------------------------------------------------------------

# Music Note / FavoritesPage
favorites_path = Path('src/pages/FavoritesPage.tsx')
favorites = favorites_path.read_text(encoding='utf-8')
if MARKER not in favorites:
    favorites = replace_once(
        favorites,
        "import { getResolvedGenre, resolveKeywordsForDisplay, getKeywordMeta } from '../lib/songUtils';",
        "import { getResolvedGenre, resolveKeywordsForDisplay, getKeywordMeta } from '../lib/songUtils';\nimport { readUserProfileCache, writeUserProfileCache } from '../lib/userProfileCache';",
        'Favorites profile cache import',
    )

    # Current signed-in profile: App's single root users listener already owns this
    # document and writes it into userProfileCache. Route remounts must reuse it.
    favorites = replace_once(
        favorites,
        """      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!cancelled) {
          const data: any | null = snap.exists() ? { uid: user.uid, ...snap.data() } : null;""",
        """      const cachedProfile = readUserProfileCache(user.uid);
      if (cachedProfile) {
        if (!cancelled) {
          setFavoriteUserProfile(cachedProfile);
          setIsFavoriteAdminUser(Boolean(cachedProfile.role === 'admin'));
        }
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!cancelled) {
          const data: any | null = snap.exists() ? { uid: user.uid, ...snap.data() } : null;
          if (data) writeUserProfileCache(user.uid, data);""",
        'Favorites current-user route read',
    )

    # Creator names were state-only. Unmounting Music Note erased the state, so the
    # same creator documents were read again on the next menu entry. Reuse the
    # shared per-user cache and seed it once for creators that are genuinely new.
    favorites = replace_once(
        favorites,
        """        try {
          const snap = await getDoc(doc(db, 'users', uid));
          if (!snap.exists()) return [uid, ''];
          const data: any = snap.data();
          return [uid, getCreatorNicknameFromProfile({ ...data, uid }, null)];""",
        """        try {
          const cachedProfile = readUserProfileCache(uid);
          if (cachedProfile) {
            return [uid, getCreatorNicknameFromProfile(cachedProfile, null)];
          }
          const snap = await getDoc(doc(db, 'users', uid));
          if (!snap.exists()) return [uid, ''];
          const data: any = snap.data();
          const cached = writeUserProfileCache(uid, { ...data, uid });
          return [uid, getCreatorNicknameFromProfile(cached, null)];""",
        'Favorites creator route reads',
    )

    first_const = favorites.find('const ')
    if first_const < 0:
        raise SystemExit('930 Favorites marker anchor missing')
    favorites = favorites[:first_const] + f'const {MARKER} = true;\n' + favorites[first_const:]
    favorites_path.write_text(favorites, encoding='utf-8')


# Library
library_path = Path('src/pages/SunoLibraryPage.tsx')
library = library_path.read_text(encoding='utf-8')
if MARKER not in library:
    library = replace_once(
        library,
        "import { Playlist, PlaylistItem } from '../types';",
        "import { Playlist, PlaylistItem } from '../types';\nimport { readUserProfileCache, writeUserProfileCache } from '../lib/userProfileCache';",
        'Library profile cache import',
    )

    # The 929 video showed exactly one users:getDoc on each Library entry. This
    # self-admin check is the direct mount-time call; use App's cached profile first.
    library = replace_once(
        library,
        """      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!cancelled) setIsLibraryAdminUser(snap.exists() && snap.data()?.role === 'admin');""",
        """      const cachedProfile = readUserProfileCache(user.uid);
      if (cachedProfile) {
        if (!cancelled) setIsLibraryAdminUser(cachedProfile.role === 'admin');
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!cancelled) {
          const data: any | null = snap.exists() ? { uid: user.uid, ...snap.data() } : null;
          if (data) writeUserProfileCache(user.uid, data);
          setIsLibraryAdminUser(Boolean(data && data.role === 'admin'));
        }""",
        'Library current-user route read',
    )

    # Shared-track owner labels may also request user documents. Keep a server
    # fallback only for previously unseen owners, then cache that profile so route
    # remounts do not pay for it again.
    library = replace_once(
        library,
        """          try {
            const userSnap = await getDoc(doc(db, 'users', uid));
            if (!userSnap.exists()) return;
            const data: any = userSnap.data();
            const displayName = data.nickname || data.displayName || data.name || data.email || uid;""",
        """          try {
            const cachedProfile = readUserProfileCache(uid);
            if (cachedProfile) {
              const displayName = cachedProfile.nickname || cachedProfile.displayName || (cachedProfile as any).name || cachedProfile.email || uid;
              if (displayName) nextMap[uid] = String(displayName);
              return;
            }
            const userSnap = await getDoc(doc(db, 'users', uid));
            if (!userSnap.exists()) return;
            const data: any = userSnap.data();
            const cached = writeUserProfileCache(uid, { ...data, uid });
            const displayName = cached.nickname || cached.displayName || (cached as any).name || cached.email || uid;""",
        'Library owner route reads',
    )

    first_const = library.find('const ')
    if first_const < 0:
        raise SystemExit('930 Library marker anchor missing')
    library = library[:first_const] + f'const {MARKER} = true;\n' + library[first_const:]
    library_path.write_text(library, encoding='utf-8')


# Build-time invariants for the exact 929 failure pattern.
final_favorites = favorites_path.read_text(encoding='utf-8')
if 'const cachedProfile = readUserProfileCache(user.uid);' not in final_favorites:
    raise SystemExit('930 safety failed: Music Note current-user cache guard missing')
if 'const cachedProfile = readUserProfileCache(uid);' not in final_favorites:
    raise SystemExit('930 safety failed: Music Note creator cache guard missing')

final_library = library_path.read_text(encoding='utf-8')
if 'const cachedProfile = readUserProfileCache(user.uid);' not in final_library:
    raise SystemExit('930 safety failed: Library current-user cache guard missing')
if 'const cachedProfile = readUserProfileCache(uid);' not in final_library:
    raise SystemExit('930 safety failed: Library owner cache guard missing')

print('Applied SORIDRAW 930: repeated Music Note/Library route mounts reuse cached user profiles; user_structures is intentionally untouched.')

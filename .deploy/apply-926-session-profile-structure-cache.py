from pathlib import Path

MARKER = 'SORIDRAW_926_SESSION_PROFILE_STRUCTURE_CACHE'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'926 {label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


# -----------------------------------------------------------------------------
# App.tsx — the existing root users/{uid} listener is the only ordinary-user
# Firestore profile listener. It publishes its already-paid snapshot to a local
# shared cache; screens consume that cache instead of attaching more listeners.
# -----------------------------------------------------------------------------
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')
if MARKER not in app:
    app = replace_once(
        app,
        "import { favoritesStore, useFavorites, useIsSongFavorited } from './hooks/useFavoritesStore';",
        "import { favoritesStore, useFavorites, useIsSongFavorited } from './hooks/useFavoritesStore';\nimport { writeUserProfileCache } from './lib/userProfileCache';",
        'App profile cache import',
    )

    app = replace_once(
        app,
        """          if (docSnap.exists()) {
            const data = docSnap.data();
            const sectionCustomVersion = Number(data?.syncVersions?.sectionCustom || 0);""",
        """          if (docSnap.exists()) {
            const data = docSnap.data();
            writeUserProfileCache(currentUser.uid, data);
            const sectionCustomVersion = Number(data?.syncVersions?.sectionCustom || 0);""",
        'root profile snapshot cache publish',
    )

    # A module/session-level verified version survives component remounts.
    app = replace_once(
        app,
        "const SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE = 'soridraw_section_custom_remote_version_v1';",
        "const SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE = 'soridraw_section_custom_remote_version_v1';\nconst sectionCustomVerifiedSessionVersions = new Map<string, number>();",
        'section custom session version map',
    )

    # 897 adds a diagnostic call inside this block. Keep it, but also remember the
    # verified version so another mount in the same SPA session cannot reread.
    app = replace_once(
        app,
        """    if (cacheVersionMatches) {
      markCacheDiagnostic('sectionCustom', 'CACHE', 0);
      customBackupLoadedRef.current = true;
      customBackupLoadingRef.current = false;
      return;
    }

    try {""",
        """    const sessionVerifiedVersion = Number(sectionCustomVerifiedSessionVersions.get(user.uid) || 0);
    const sessionVersionMatches = sessionVerifiedVersion > 0
      && (remoteVersion <= 0 || sessionVerifiedVersion === remoteVersion);

    if (cacheVersionMatches || sessionVersionMatches) {
      const verifiedVersion = localVersion || sessionVerifiedVersion || remoteVersion;
      if (verifiedVersion > 0) sectionCustomVerifiedSessionVersions.set(user.uid, verifiedVersion);
      markCacheDiagnostic('sectionCustom', 'CACHE', 0);
      customBackupLoadedRef.current = true;
      customBackupLoadingRef.current = false;
      return;
    }

    try {""",
        'section custom same-session zero-read guard',
    )

    app = replace_once(
        app,
        """        if (remoteVersion <= 0) {
          writeSectionCustomVersion(SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE, user.uid, checkedVersion);
        }
        return;
      }
""",
        """        if (remoteVersion <= 0) {
          writeSectionCustomVersion(SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE, user.uid, checkedVersion);
        }
        sectionCustomVerifiedSessionVersions.set(user.uid, checkedVersion);
        return;
      }
""",
        'section custom empty-state session verification',
    )

    app = replace_once(
        app,
        """      writeSectionCustomVersion(SECTION_CUSTOM_LOCAL_VERSION_STORAGE_BASE, user.uid, resolvedVersion);
      writeSectionCustomVersion(SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE, user.uid, resolvedVersion);
    } catch (error) {""",
        """      writeSectionCustomVersion(SECTION_CUSTOM_LOCAL_VERSION_STORAGE_BASE, user.uid, resolvedVersion);
      writeSectionCustomVersion(SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE, user.uid, resolvedVersion);
      sectionCustomVerifiedSessionVersions.set(user.uid, resolvedVersion);
    } catch (error) {""",
        'section custom fetched-state session verification',
    )

    # A successful local save is authoritative on this device; do not reread it.
    app = replace_once(
        app,
        """      writeSectionCustomVersion(SECTION_CUSTOM_LOCAL_VERSION_STORAGE_BASE, user.uid, nextSectionCustomVersion);
      writeSectionCustomVersion(SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE, user.uid, nextSectionCustomVersion);
      try {""",
        """      writeSectionCustomVersion(SECTION_CUSTOM_LOCAL_VERSION_STORAGE_BASE, user.uid, nextSectionCustomVersion);
      writeSectionCustomVersion(SECTION_CUSTOM_REMOTE_VERSION_STORAGE_BASE, user.uid, nextSectionCustomVersion);
      sectionCustomVerifiedSessionVersions.set(user.uid, nextSectionCustomVersion);
      try {""",
        'section custom save session verification',
    )

    # A genuinely different remote version invalidates only this tiny session key;
    # the existing loader then fetches user_structures exactly once.
    app = replace_once(
        app,
        """      const localVersion = readSectionCustomVersion(SECTION_CUSTOM_LOCAL_VERSION_STORAGE_BASE, user.uid);
      if (localVersion > 0 && localVersion === version) return;
      customBackupLoadedRef.current = false;
      void ensureCustomBackupLoaded();""",
        """      const localVersion = readSectionCustomVersion(SECTION_CUSTOM_LOCAL_VERSION_STORAGE_BASE, user.uid);
      const sessionVerifiedVersion = Number(sectionCustomVerifiedSessionVersions.get(user.uid) || 0);
      if ((localVersion > 0 && localVersion === version) || sessionVerifiedVersion === version) return;
      sectionCustomVerifiedSessionVersions.delete(user.uid);
      customBackupLoadedRef.current = false;
      void ensureCustomBackupLoaded();""",
        'section custom remote invalidation',
    )

    app = app.replace(
        'const SORIDRAW_896_SECTION_CUSTOM_SYNC_PERMISSION_HARDENING = true;\n',
        f"const {MARKER} = true;\nconst SORIDRAW_896_SECTION_CUSTOM_SYNC_PERMISSION_HARDENING = true;\n",
        1,
    )
    app_path.write_text(app, encoding='utf-8')


# -----------------------------------------------------------------------------
# MyPage.tsx — remove its duplicate users/{uid} onSnapshot. The root App listener
# already exists for auth/role/force-logout. MyPage now consumes the local shared
# profile snapshot and receives zero-Firestore in-tab update events.
# -----------------------------------------------------------------------------
my_path = Path('src/pages/MyPage.tsx')
my = my_path.read_text(encoding='utf-8')
if MARKER not in my:
    my = replace_once(
        my,
        "import { doc, onSnapshot, updateDoc } from 'firebase/firestore';",
        "import { doc, updateDoc } from 'firebase/firestore';",
        'MyPage remove duplicate onSnapshot import',
    )
    my = replace_once(
        my,
        "import { readGeminiAutoModelFallback, writeGeminiAutoModelFallback } from '../services/geminiModelPreferences';",
        "import { readGeminiAutoModelFallback, writeGeminiAutoModelFallback } from '../services/geminiModelPreferences';\nimport { USER_PROFILE_CACHE_EVENT, isUserProfileCacheStorageKey, readUserProfileCache } from '../lib/userProfileCache';",
        'MyPage profile cache import',
    )
    my = replace_once(
        my,
        " const [profile, setProfile] = useState<AppUserInfo | null>(null);",
        " const [profile, setProfile] = useState<AppUserInfo | null>(() => readUserProfileCache(auth.currentUser?.uid));",
        'MyPage cached initial profile',
    )

    old_effect = """ useEffect(() => {

 if (!user) {
 setProfile(null);
 return;
 }
 const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
 const nextProfile = snapshot.exists() ? ({ uid: user.uid, ...snapshot.data() } as AppUserInfo) : null;
 setProfile(nextProfile);
 }, (error) => {
 // 844 — Keep the last profile UI on transient Firestore failures instead of allowing
 // an operational data error to become a page-level failure.
 console.error('MyPage profile listener failed. Keeping the last available profile state.', error);
 });
 return () => unsubscribe();
 }, [user]);
"""
    new_effect = """ useEffect(() => {
 if (!user?.uid) {
 setProfile(null);
 return;
 }

 const uid = user.uid;
 const applyCachedProfile = () => {
 const cached = readUserProfileCache(uid);
 if (cached) setProfile(cached);
 };
 applyCachedProfile();

 const handleProfileCache = (event: Event) => {
 const detail = (event as CustomEvent<{ uid?: string; profile?: AppUserInfo }>).detail;
 if (!detail || detail.uid !== uid) return;
 if (detail.profile) setProfile(detail.profile);
 else applyCachedProfile();
 };
 const handleStorage = (event: StorageEvent) => {
 if (isUserProfileCacheStorageKey(event.key, uid)) applyCachedProfile();
 };

 window.addEventListener(USER_PROFILE_CACHE_EVENT, handleProfileCache as EventListener);
 window.addEventListener('storage', handleStorage);
 return () => {
 window.removeEventListener(USER_PROFILE_CACHE_EVENT, handleProfileCache as EventListener);
 window.removeEventListener('storage', handleStorage);
 };
 }, [user?.uid]);
"""
    my = replace_once(my, old_effect, new_effect, 'MyPage shared profile cache effect')
    my = my.replace(
        '// SORIDRAW_892_CACHE_SYNC_VERSION_FOUNDATION\n',
        f"// {MARKER}\n// SORIDRAW_892_CACHE_SYNC_VERSION_FOUNDATION\n",
        1,
    )
    my_path.write_text(my, encoding='utf-8')


# Build-time safety: ordinary MyPage must never regain its own Firestore user
# listener. The root App listener remains the single ordinary-user authority.
final_my = my_path.read_text(encoding='utf-8')
if "onSnapshot(doc(db, 'users', user.uid)" in final_my:
    raise SystemExit('926 safety failed: MyPage duplicate users listener still exists')
if "USER_PROFILE_CACHE_EVENT" not in final_my:
    raise SystemExit('926 safety failed: MyPage profile cache event missing')

print('Applied SORIDRAW 926: shared user profile cache + same-session section structure verification.')

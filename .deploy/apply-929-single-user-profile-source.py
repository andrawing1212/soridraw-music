from pathlib import Path

MARKER = 'SORIDRAW_929_SINGLE_USER_PROFILE_SOURCE'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'929 {label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


# -----------------------------------------------------------------------------
# App.tsx — login/redirect user-document maintenance may reuse the profile that
# the single root users/{uid} listener already cached. A real getDoc remains only
# as a missing-cache / missing-document fallback, so first login is still safe.
# -----------------------------------------------------------------------------
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')
if MARKER not in app:
    app = replace_once(
        app,
        "import { writeUserProfileCache } from './lib/userProfileCache';",
        "import { readUserProfileCache, writeUserProfileCache } from './lib/userProfileCache';",
        'App user profile cache import',
    )

    app = replace_once(
        app,
        """    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      await updateDoc(userRef, sessionData);
      return;
    }""",
        """    const cachedProfile = readUserProfileCache(authUser.uid);
    if (cachedProfile) {
      try {
        await updateDoc(userRef, sessionData);
        return;
      } catch (cachedUpdateError: any) {
        const code = String(cachedUpdateError?.code || '').toLowerCase();
        if (!code.includes('not-found')) throw cachedUpdateError;
      }
    }

    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      await updateDoc(userRef, sessionData);
      return;
    }""",
        'cache-first auth user maintenance',
    )

    marker_anchor = 'const SORIDRAW_927_MONOTONIC_SECTION_VERSION_AND_OP_TRACE = true;\n'
    if marker_anchor in app:
        app = app.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)
    else:
        first_const = app.find('const ')
        if first_const < 0:
            raise SystemExit('929 App marker anchor missing')
        app = app[:first_const] + f'const {MARKER} = true;\n' + app[first_const:]
    app_path.write_text(app, encoding='utf-8')


# -----------------------------------------------------------------------------
# AdminPageLayout.tsx — do not attach a second users/{uid} listener every time an
# admin page is mounted. App's root listener is authoritative and 926 already
# publishes each verified snapshot through userProfileCache.
# -----------------------------------------------------------------------------
layout_path = Path('src/components/AdminPageLayout.tsx')
layout = layout_path.read_text(encoding='utf-8')
if MARKER not in layout:
    layout = replace_once(
        layout,
        "import { doc, onSnapshot } from '../lib/firestoreMeasured';",
        "",
        'AdminPageLayout Firestore import removal',
    )
    layout = replace_once(
        layout,
        "import { auth, db } from '../firebase';",
        "import { auth } from '../firebase';",
        'AdminPageLayout db import removal',
    )
    layout = replace_once(
        layout,
        "import { cn } from '../lib/utils';",
        "import { cn } from '../lib/utils';\nimport { USER_PROFILE_CACHE_EVENT, isUserProfileCacheStorageKey, readUserProfileCache } from '../lib/userProfileCache';",
        'AdminPageLayout cache import',
    )

    old_effect = """  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    let unsubscribe: (() => void) | null = null;
    let retryTimer: number | null = null;
    let retryAttempt = 0;
    let disposed = false;

    const attach = () => {
      if (disposed || auth.currentUser?.uid !== uid) return;
      if (unsubscribe) {
        try { unsubscribe(); } catch {}
        unsubscribe = null;
      }

      unsubscribe = onSnapshot(doc(db, 'users', uid), (snapshot) => {
        retryAttempt = 0;
        if (retryTimer !== null) {
          window.clearTimeout(retryTimer);
          retryTimer = null;
        }
        const data = snapshot.exists() ? snapshot.data() : null;
        setStaffRole(normalizeStaffRole(data));
        setPermissions(normalizeAdminPermissions(data));
      }, (error: any) => {
        // 843 — Keep the last live/cached navigation state and reattach slowly.
        // Firestore does not continue a listener after its error callback fires.
        console.warn('[Admin layout] user permission listener unavailable; keeping last verified/cached layout state.', error);
        const code = String(error?.code || '').toLowerCase();
        const transient = ['resource-exhausted', 'unavailable', 'deadline-exceeded', 'aborted', 'internal']
          .some((candidate) => code.includes(candidate));
        if (!transient || disposed) return;
        const delays = [30_000, 60_000, 120_000, 300_000];
        const delay = delays[Math.min(retryAttempt, delays.length - 1)];
        retryAttempt += 1;
        if (retryTimer !== null) window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(() => {
          retryTimer = null;
          attach();
        }, delay);
      });
    };

    attach();
    return () => {
      disposed = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      if (unsubscribe) unsubscribe();
    };
  }, []);"""

    new_effect = """  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const applyCachedProfile = () => {
      const profile = readUserProfileCache(uid);
      if (!profile) return;
      setStaffRole(normalizeStaffRole(profile));
      setPermissions(normalizeAdminPermissions(profile));
    };

    applyCachedProfile();

    const handleProfileCache = (event: Event) => {
      const detail = (event as CustomEvent<{ uid?: string }>).detail;
      if (!detail || detail.uid !== uid) return;
      applyCachedProfile();
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
  }, []);"""
    layout = replace_once(layout, old_effect, new_effect, 'AdminPageLayout duplicate user listener')
    layout = layout.replace(
        'type AdminPageLayoutProps =',
        f'const {MARKER} = true;\n\ntype AdminPageLayoutProps =',
        1,
    )
    layout_path.write_text(layout, encoding='utf-8')


# -----------------------------------------------------------------------------
# AdminUserManagementPage.tsx — its fallback self-admin check used getDoc. The
# normal App route already passes isAdmin, but keep the fallback zero-read too.
# -----------------------------------------------------------------------------
users_path = Path('src/pages/AdminUserManagementPage.tsx')
users = users_path.read_text(encoding='utf-8')
if MARKER not in users:
    users = replace_once(
        users,
        "import { PRESENCE_DIAGNOSTIC_EVENT, readPresenceDiagnostic, type PresenceDiagnostic } from '../services/presenceService';",
        "import { PRESENCE_DIAGNOSTIC_EVENT, readPresenceDiagnostic, type PresenceDiagnostic } from '../services/presenceService';\nimport { USER_PROFILE_CACHE_EVENT, readUserProfileCache } from '../lib/userProfileCache';",
        'AdminUserManagement cache import',
    )
    users = replace_once(
        users,
        """  useEffect(() => {
    if (!auth.currentUser || isAdminProp !== undefined) return;
    getDoc(doc(db, 'users', auth.currentUser.uid))
      .then((snapshot) => setIsAdmin(normalizeStaffRole(snapshot.data()) !== null))
      .catch((error) => console.error('Admin check failed:', error));
  }, [isAdminProp]);""",
        """  useEffect(() => {
    if (!auth.currentUser || isAdminProp !== undefined) return;
    const uid = auth.currentUser.uid;
    const applyCachedAdmin = () => {
      const profile = readUserProfileCache(uid);
      if (profile) setIsAdmin(normalizeStaffRole(profile) !== null);
    };
    applyCachedAdmin();
    const handleProfileCache = (event: Event) => {
      const detail = (event as CustomEvent<{ uid?: string }>).detail;
      if (detail?.uid === uid) applyCachedAdmin();
    };
    window.addEventListener(USER_PROFILE_CACHE_EVENT, handleProfileCache as EventListener);
    return () => window.removeEventListener(USER_PROFILE_CACHE_EVENT, handleProfileCache as EventListener);
  }, [isAdminProp]);""",
        'AdminUserManagement current-user getDoc fallback',
    )
    first_const = users.find('const ')
    if first_const < 0:
        raise SystemExit('929 AdminUserManagement marker anchor missing')
    users = users[:first_const] + f'const {MARKER} = true;\n' + users[first_const:]
    users_path.write_text(users, encoding='utf-8')


# -----------------------------------------------------------------------------
# AdminVocalTones / AdminSectionTags — same future-proofing for fallback role
# listeners. Their normal routes pass isAdmin, but they should never create a
# second users/{uid} listener if reused elsewhere.
# -----------------------------------------------------------------------------
for relative_path, label in [
    ('src/pages/AdminVocalTonesPage.tsx', 'AdminVocalTones'),
    ('src/pages/AdminSectionTagsPage.tsx', 'AdminSectionTags'),
]:
    path = Path(relative_path)
    text = path.read_text(encoding='utf-8')
    if MARKER in text:
        continue
    admin_import = "import { normalizeStaffRole } from '../constants/adminPermissions';"
    text = replace_once(
        text,
        admin_import,
        admin_import + "\nimport { USER_PROFILE_CACHE_EVENT, readUserProfileCache } from '../lib/userProfileCache';",
        f'{label} cache import',
    )
    old_listener = """  useEffect(() => {
    if (!auth.currentUser || isAdminProp !== undefined) return;
    
    // Support real-time role check if prop wasn't passed or we want extra safety
    const unsub = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (normalizeStaffRole(data) !== null) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      }
    });
    return () => unsub();
  }, [isAdminProp]);"""
    new_listener = """  useEffect(() => {
    if (!auth.currentUser || isAdminProp !== undefined) return;
    const uid = auth.currentUser.uid;
    const applyCachedAdmin = () => {
      const profile = readUserProfileCache(uid);
      if (profile) setIsAdmin(normalizeStaffRole(profile) !== null);
    };
    applyCachedAdmin();
    const handleProfileCache = (event: Event) => {
      const detail = (event as CustomEvent<{ uid?: string }>).detail;
      if (detail?.uid === uid) applyCachedAdmin();
    };
    window.addEventListener(USER_PROFILE_CACHE_EVENT, handleProfileCache as EventListener);
    return () => window.removeEventListener(USER_PROFILE_CACHE_EVENT, handleProfileCache as EventListener);
  }, [isAdminProp]);"""
    text = replace_once(text, old_listener, new_listener, f'{label} duplicate user listener fallback')
    first_const = text.find('const ')
    if first_const < 0:
        raise SystemExit(f'929 {label} marker anchor missing')
    text = text[:first_const] + f'const {MARKER} = true;\n' + text[first_const:]
    path.write_text(text, encoding='utf-8')


# Build-time guarantees: admin shell/fallback checks must not attach/read the
# signed-in users document independently of App's single root listener.
final_layout = layout_path.read_text(encoding='utf-8')
if "onSnapshot(doc(db, 'users', uid)" in final_layout:
    raise SystemExit('929 safety failed: AdminPageLayout duplicate users listener remains')
final_users = users_path.read_text(encoding='utf-8')
if "getDoc(doc(db, 'users', auth.currentUser.uid))" in final_users:
    raise SystemExit('929 safety failed: AdminUserManagement current-user getDoc remains')
for relative_path in ['src/pages/AdminVocalTonesPage.tsx', 'src/pages/AdminSectionTagsPage.tsx']:
    final_text = Path(relative_path).read_text(encoding='utf-8')
    if "onSnapshot(doc(db, 'users', auth.currentUser.uid)" in final_text:
        raise SystemExit(f'929 safety failed: duplicate users listener remains in {relative_path}')

print('Applied SORIDRAW 929: App root users listener is the single current-user profile source for admin UI; login maintenance is cache-first.')

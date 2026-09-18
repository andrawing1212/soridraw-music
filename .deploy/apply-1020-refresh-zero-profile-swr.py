from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 anchor, found {count}')
    return text.replace(old, new, 1)

# -----------------------------------------------------------------------------
# 1) Persistent current-user server verification lease.
# -----------------------------------------------------------------------------
cache_path = Path('src/lib/userProfileCache.ts')
cache = cache_path.read_text(encoding='utf-8')
marker = 'SORIDRAW_USER_PROFILE_REFRESH_ZERO_1020'
if marker not in cache:
    cache = replace_once(
        cache,
        "const USER_PROFILE_CACHE_STORAGE_BASE = 'soridraw_user_profile_cache_v1';\n",
        "const USER_PROFILE_CACHE_STORAGE_BASE = 'soridraw_user_profile_cache_v1';\nconst USER_PROFILE_SERVER_VERIFIED_STORAGE_BASE = 'soridraw_user_profile_server_verified_v1';\n// SORIDRAW_USER_PROFILE_REFRESH_ZERO_1020\n",
        'cache constants',
    )
    cache = replace_once(
        cache,
        "const storageKey = (uid: string) => `${USER_PROFILE_CACHE_STORAGE_BASE}_${uid}`;\n",
        "const storageKey = (uid: string) => `${USER_PROFILE_CACHE_STORAGE_BASE}_${uid}`;\nconst verifiedStorageKey = (uid: string) => `${USER_PROFILE_SERVER_VERIFIED_STORAGE_BASE}_${uid}`;\n",
        'verified key',
    )
    insert_anchor = "export const writeUserProfileCache = (uid: string, value: Record<string, unknown>): AppUserInfo => {"
    helpers = """export const readUserProfileCacheStoredAt = (uid?: string | null): number => {
  const safeUid = String(uid || '').trim();
  if (!safeUid || typeof localStorage === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(storageKey(safeUid));
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    const cachedAt = Number(parsed?.cachedAt || 0);
    return Number.isFinite(cachedAt) && cachedAt > 0 ? cachedAt : 0;
  } catch {
    return 0;
  }
};

export const readUserProfileServerVerifiedAt = (uid?: string | null): number => {
  const safeUid = String(uid || '').trim();
  if (!safeUid || typeof localStorage === 'undefined') return 0;
  try {
    const value = Number(localStorage.getItem(verifiedStorageKey(safeUid)) || 0);
    if (Number.isFinite(value) && value > 0) return value;
    // One-time migration: a very recent v1 cache was normally written by the old
    // root server listener. It can seed the first lease so deployment itself does
    // not force an avoidable read on the next immediate refresh.
    return readUserProfileCacheStoredAt(safeUid);
  } catch {
    return 0;
  }
};

export const writeUserProfileServerVerifiedAt = (uid: string, verifiedAt = Date.now()): void => {
  const safeUid = String(uid || '').trim();
  if (!safeUid || typeof localStorage === 'undefined') return;
  try { localStorage.setItem(verifiedStorageKey(safeUid), String(Math.max(0, Number(verifiedAt || 0)))); } catch {}
};

"""
    cache = replace_once(cache, insert_anchor, helpers + insert_anchor, 'cache helper insert')
    cache = replace_once(
        cache,
        "    try { localStorage.removeItem(storageKey(safeUid)); } catch {}\n",
        "    try {\n      localStorage.removeItem(storageKey(safeUid));\n      localStorage.removeItem(verifiedStorageKey(safeUid));\n    } catch {}\n",
        'cache clear',
    )
cache_path.write_text(cache, encoding='utf-8')

# -----------------------------------------------------------------------------
# 2) App root: hydrate from cache and defer users/{uid} listener during a fresh
#    verification lease. This removes the unconditional 1 Firestore read on every
#    hard refresh while retaining bounded re-verification and live listening after
#    the lease expires.
# -----------------------------------------------------------------------------
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')
app_marker = 'SORIDRAW_ROOT_USER_REFRESH_ZERO_1020'
if app_marker not in app:
    app = replace_once(
        app,
        "import { readUserProfileCache, writeUserProfileCache } from './lib/userProfileCache';",
        "import {\n  readUserProfileCache,\n  readUserProfileServerVerifiedAt,\n  writeUserProfileCache,\n  writeUserProfileServerVerifiedAt,\n} from './lib/userProfileCache';",
        'App user cache import',
    )
    app = replace_once(
        app,
        "            writeUserProfileCache(currentUser.uid, data);\n",
        "            writeUserProfileCache(currentUser.uid, data);\n            writeUserProfileServerVerifiedAt(currentUser.uid);\n",
        'server verified timestamp',
    )
    app = replace_once(
        app,
        "        attachUserRoleListener();\n\n        // Fetch favorites for the user.",
        """        // SORIDRAW_ROOT_USER_REFRESH_ZERO_1020
        // Hard refresh is not a data mutation and must not bill one users/{uid}
        // read every time. Hydrate the last server-verified user document locally,
        // then reattach the live listener only after a short persistent lease.
        // Privileged backend operations remain server/rules enforced; this cache is
        // only the current client's UI/sync hydration source during the lease.
        const cachedUserProfileForRefresh = readUserProfileCache(currentUser.uid) as any;
        const USER_PROFILE_SERVER_REVERIFY_MS = 5 * 60 * 1000;
        const verifiedAt = readUserProfileServerVerifiedAt(currentUser.uid);
        const verifiedAgeMs = verifiedAt > 0 ? Math.max(0, Date.now() - verifiedAt) : Number.POSITIVE_INFINITY;

        if (cachedUserProfileForRefresh) {
          const cachedVerifiedRole = (cachedUserProfileForRefresh.role || cachedRole?.role || 'free') as UserRole;
          setUserRole(cachedVerifiedRole);
          setStaffRole(normalizeStaffRole(cachedUserProfileForRefresh));
          setAdminPermissions(normalizeAdminPermissions(cachedUserProfileForRefresh));
          setIsUserRoleReady(true);
          setEmailVerificationCycleKey(getEmailVerificationCycleKey(currentUser, cachedUserProfileForRefresh));
          setIsEmailVerificationCycleReady(true);
          setUserLyricClicheGuard({
            hardBanTerms: Array.isArray(cachedUserProfileForRefresh.lyricClicheGuard?.hardBanTerms)
              ? cachedUserProfileForRefresh.lyricClicheGuard.hardBanTerms
              : [],
            softBanTerms: Array.isArray(cachedUserProfileForRefresh.lyricClicheGuard?.softBanTerms)
              ? cachedUserProfileForRefresh.lyricClicheGuard.softBanTerms
              : [],
          });
          writeGeminiAutoModelFallback(cachedUserProfileForRefresh.generationPreferences?.autoModelFallback !== false, currentUser.uid);
          setIsUserLyricClicheGuardReady(true);
          applyFavoriteSyncSignal(currentUser.uid, cachedUserProfileForRefresh.favoriteSyncSignal);
          if (cachedUserProfileForRefresh.accountStatus) {
            const cachedStatus = cachedUserProfileForRefresh.accountStatus as AccountStatus;
            setUserStatus(cachedStatus);
            if (cachedStatus === 'banned') setIsBanModalOpen(true);
          }
          if (shouldProcessForceLogout(cachedUserProfileForRefresh, currentUser)) {
            hasCompletedForceLogoutReentryCheckRef.current = true;
            void performForcedLogout({ silent: true });
          }
        }

        if (cachedUserProfileForRefresh && verifiedAgeMs < USER_PROFILE_SERVER_REVERIFY_MS) {
          // A server-verified profile is already on this device. Repeated reloads in
          // this lease stay at Firestore read 0; one live listener resumes when the
          // lease expires and then receives only real changes.
          hasVerifiedCurrentUserRoleFromServerRef.current = true;
          if (!hasCompletedForceLogoutReentryCheckRef.current) {
            hasCompletedForceLogoutReentryCheckRef.current = true;
          }
          const remainingMs = Math.max(1_000, USER_PROFILE_SERVER_REVERIFY_MS - verifiedAgeMs);
          userRoleRetryTimer = window.setTimeout(() => {
            userRoleRetryTimer = null;
            attachUserRoleListener();
          }, remainingMs);
        } else {
          attachUserRoleListener();
        }

        // Fetch favorites for the user.""",
        'defer root user listener',
    )
app_path.write_text(app, encoding='utf-8')

# -----------------------------------------------------------------------------
# 3) Public profile: local-first + bounded revision SWR. Schema v3 clears the
#    indefinitely stale v2 cache once. Revalidation hits Edge/R2 first, so current
#    profiles stay D1-read 0 while cross-device publish/private changes converge.
# -----------------------------------------------------------------------------
profile_path = Path('src/services/exploreProfileFirstViewService.ts')
profile = profile_path.read_text(encoding='utf-8')
profile_marker = 'SORIDRAW_PROFILE_CACHE_SWR_1020'
if profile_marker not in profile:
    profile = replace_once(
        profile,
        "const PROFILE_FIRST_VIEW_SCHEMA_VERSION = 2;",
        "// SORIDRAW_PROFILE_CACHE_SWR_1020\nconst PROFILE_FIRST_VIEW_SCHEMA_VERSION = 3;\nconst PROFILE_FIRST_VIEW_REVALIDATE_AFTER_MS = 60_000;",
        'profile schema bump',
    )
    profile = replace_once(
        profile,
        "const coldLoadInflight = new Map<string, Promise<ExploreProfileFirstViewData>>();",
        "const coldLoadInflight = new Map<string, Promise<ExploreProfileFirstViewData>>();\nconst profileRevalidationInflight = new Map<string, Promise<void>>();",
        'profile revalidation map',
    )
    profile = replace_once(
        profile,
        "  _options: ExploreProfileFirstViewOptions = {},",
        "  options: ExploreProfileFirstViewOptions = {},",
        'profile options name',
    )
    old_cached = """  const cached = readCache(normalizedRef);
  if (cached) {
    recordCloudflareLocalCacheHit(
      PROFILE_FIRST_VIEW_DIAGNOSTIC_PATH,
      'LOCAL HIT · 변경 이벤트 전까지 서버 읽기 0',
    );
    return cached;
  }
"""
    new_cached = """  const cached = readCache(normalizedRef);
  if (cached) {
    recordCloudflareLocalCacheHit(
      PROFILE_FIRST_VIEW_DIAGNOSTIC_PATH,
      'LOCAL HIT · 서버 D1 읽기 0',
    );

    const ageMs = Math.max(0, Date.now() - Number(cached.validatedAt || 0));
    const revalidationKey = normalizedRef.toLowerCase();
    if (ageMs >= PROFILE_FIRST_VIEW_REVALIDATE_AFTER_MS && !profileRevalidationInflight.has(revalidationKey)) {
      const task = (async () => {
        try {
          const materialized = await requestMaterializedFirstView(normalizedRef, cached.revision);
          if (materialized.kind === 'updated') {
            writeCache(normalizedRef, materialized.data);
            options.onRevalidated?.(materialized.data);
            return;
          }
          if (materialized.kind === 'not-modified') {
            writeCache(normalizedRef, {
              ...cached,
              revision: materialized.revision || cached.revision,
              etag: materialized.etag || cached.etag,
              validatedAt: Date.now(),
            });
            return;
          }
          if (materialized.kind === 'not-found') {
            clearCache(normalizedRef, cached);
            options.onInvalidated?.(materialized.message);
            return;
          }
          writeCache(normalizedRef, { ...cached, validatedAt: Date.now() });
        } catch (error) {
          console.warn('[Explore profile first-view] background revision check failed; keeping local cache.', error);
        }
      })().finally(() => {
        if (profileRevalidationInflight.get(revalidationKey) === task) profileRevalidationInflight.delete(revalidationKey);
      });
      profileRevalidationInflight.set(revalidationKey, task);
    }
    return cached;
  }
"""
    profile = replace_once(profile, old_cached, new_cached, 'profile cached branch')
profile_path.write_text(profile, encoding='utf-8')

print('[1020] root refresh users read lease + profile revision SWR applied')

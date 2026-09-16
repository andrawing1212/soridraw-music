from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'109 {label}: expected 1 anchor, found {count}')
    return text.replace(old, new, 1)


# 1) Root users/{uid}: restore the already-designed local profile + RTDB revision gate.
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')
app = replace_once(
    app,
    "import { readUserProfileCache, writeUserProfileCache } from './lib/userProfileCache';",
    "import {\n  readUserProfileCache,\n  readUserProfileCacheStoredAt,\n  readUserProfileServerVerifiedAt,\n  writeUserProfileCache,\n  writeUserProfileServerVerifiedAt,\n} from './lib/userProfileCache';\nimport {\n  readSeenUserControlRevision,\n  subscribeUserControlRevision,\n  writeSeenUserControlRevision,\n} from './services/userControlRevisionService';",
    'profile cache imports',
)
app = replace_once(
    app,
    "    let unsubUserDoc: (() => void) | null = null;\n    let favoritesRetryTimer: number | null = null;",
    "    let unsubUserDoc: (() => void) | null = null;\n    let unsubUserControlRevision: (() => void) | null = null;\n    let userProfileSafetyReverifyTimer: number | null = null;\n    let favoritesRetryTimer: number | null = null;",
    'listener state',
)
app = replace_once(
    app,
    "      if (unsubUserDoc) {\n        unsubUserDoc();\n        unsubUserDoc = null;\n      }\n      if (favoritesRetryTimer !== null) {",
    "      if (unsubUserDoc) {\n        unsubUserDoc();\n        unsubUserDoc = null;\n      }\n      if (unsubUserControlRevision) {\n        unsubUserControlRevision();\n        unsubUserControlRevision = null;\n      }\n      if (userProfileSafetyReverifyTimer !== null) {\n        window.clearTimeout(userProfileSafetyReverifyTimer);\n        userProfileSafetyReverifyTimer = null;\n      }\n      if (favoritesRetryTimer !== null) {",
    'auth-change cleanup',
)
listener_anchor = "        // One listener is now the single source for role/status/force-logout. Its\n"
app = replace_once(
    app,
    listener_anchor,
    "        let activeUserControlRevision = readSeenUserControlRevision(currentUser.uid);\n\n" + listener_anchor,
    'control revision state',
)
app = replace_once(
    app,
    "            writeUserProfileCache(currentUser.uid, data);\n",
    "            writeUserProfileCache(currentUser.uid, data);\n            if (isServerSnapshot) {\n              writeUserProfileServerVerifiedAt(currentUser.uid);\n              if (activeUserControlRevision) {\n                writeSeenUserControlRevision(currentUser.uid, activeUserControlRevision);\n              }\n            }\n",
    'server profile verification',
)
old_attach = """        attachUserRoleListener();

        // Fetch favorites for the user."""
new_attach = r'''        // SORIDRAW_ROOT_USER_REFRESH_ZERO_109_20260916
        // A normal hard refresh trusts the last server-verified local profile and
        // only watches the tiny UID-scoped RTDB control revision. Firestore users/{uid}
        // is reopened only on cache miss, an actual admin/security revision, or the
        // bounded 24-hour safety verification. Repeated refresh itself is Firestore R0/W0.
        const cachedUserProfileForRefresh = readUserProfileCache(currentUser.uid) as any;
        if (cachedUserProfileForRefresh) {
          const cachedVerifiedRole = (cachedUserProfileForRefresh.role || 'free') as UserRole;
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
          } else if (!hasCompletedForceLogoutReentryCheckRef.current) {
            hasCompletedForceLogoutReentryCheckRef.current = true;
          }
        }

        const attachUserRoleListenerFromGate = () => {
          if (userProfileSafetyReverifyTimer !== null) {
            window.clearTimeout(userProfileSafetyReverifyTimer);
            userProfileSafetyReverifyTimer = null;
          }
          attachUserRoleListener();
        };

        const scheduleProfileSafetyVerification = () => {
          if (!cachedUserProfileForRefresh || userProfileSafetyReverifyTimer !== null || unsubUserDoc) return;
          const verifiedAt = readUserProfileServerVerifiedAt(currentUser.uid);
          const PROFILE_SAFETY_REVERIFY_MS = 24 * 60 * 60 * 1000;
          const age = verifiedAt > 0 ? Math.max(0, Date.now() - verifiedAt) : Number.POSITIVE_INFINITY;
          if (age >= PROFILE_SAFETY_REVERIFY_MS) {
            attachUserRoleListenerFromGate();
            return;
          }
          userProfileSafetyReverifyTimer = window.setTimeout(() => {
            userProfileSafetyReverifyTimer = null;
            attachUserRoleListener();
          }, Math.max(1_000, PROFILE_SAFETY_REVERIFY_MS - age));
        };

        if (!cachedUserProfileForRefresh) {
          attachUserRoleListenerFromGate();
        } else {
          scheduleProfileSafetyVerification();
        }

        unsubUserControlRevision = subscribeUserControlRevision(
          currentUser.uid,
          (revision) => {
            if (auth.currentUser?.uid !== currentUser.uid) return;
            const nextRevision = String(revision?.revision || '').trim();
            const revisionUpdatedAt = Math.max(0, Number(revision?.updatedAt || 0) || 0);
            activeUserControlRevision = nextRevision;

            const currentCache = readUserProfileCache(currentUser.uid);
            if (!currentCache) {
              attachUserRoleListenerFromGate();
              return;
            }
            if (!nextRevision) return;

            const seenRevision = readSeenUserControlRevision(currentUser.uid);
            if (seenRevision === nextRevision) return;

            const cachedAt = readUserProfileCacheStoredAt(currentUser.uid);
            if (revisionUpdatedAt > 0 && cachedAt >= revisionUpdatedAt) {
              writeSeenUserControlRevision(currentUser.uid, nextRevision);
              return;
            }

            attachUserRoleListenerFromGate();
          },
          (error) => {
            console.warn('User control revision unavailable; cached profile remains active until bounded safety verification.', error);
            if (!readUserProfileCache(currentUser.uid)) attachUserRoleListenerFromGate();
          },
        );

        // Fetch favorites for the user.'''
app = replace_once(app, old_attach, new_attach, 'root listener gate')
app = replace_once(
    app,
    "      if (unsubUserDoc) unsubUserDoc();\n      if (favoritesRetryTimer !== null) window.clearTimeout(favoritesRetryTimer);",
    "      if (unsubUserDoc) unsubUserDoc();\n      if (unsubUserControlRevision) unsubUserControlRevision();\n      if (userProfileSafetyReverifyTimer !== null) window.clearTimeout(userProfileSafetyReverifyTimer);\n      if (favoritesRetryTimer !== null) window.clearTimeout(favoritesRetryTimer);",
    'final cleanup',
)
app_path.write_text(app, encoding='utf-8')


# 2) Mobile stale public count recovery: one more DATA CONTRACT bump, not app-version coupling.
cache_path = Path('src/services/exploreSessionCache.ts')
cache = cache_path.read_text(encoding='utf-8')
cache = replace_once(
    cache,
    "// One-time cache contract bump only. Do not tie this schema to app-version updates.\nconst EXPLORE_FEED_CACHE_SCHEMA_VERSION = 2;",
    "// 108 rejected schema-1 once. Real mobile evidence showed a stale schema-2 public-count payload can survive,\n// so 109 performs one final contract bump. Keep this value stable across ordinary future app versions.\n// SORIDRAW_EXPLORE_MOBILE_STALE_PUBLIC_COUNT_RECOVERY_109_20260916\nconst EXPLORE_FEED_CACHE_SCHEMA_VERSION = 3;",
    'Explore feed schema contract',
)
cache_path.write_text(cache, encoding='utf-8')


# 3) Release version + 108 successor verifier compatibility.
version_path = Path('public/app-version.json')
version = version_path.read_text(encoding='utf-8')
version = replace_once(version, '"108"', '"109"', 'app version')
version_path.write_text(version, encoding='utf-8')

verify108_path = Path('scripts/verify-108-explore-feed-cache-recovery.mjs')
verify108 = verify108_path.read_text(encoding='utf-8')
verify108 = replace_once(
    verify108,
    "if (String(version.version) !== '108') fail('app version is not 108');",
    "const appVersion = Number(version.version);\nif (!Number.isFinite(appVersion) || appVersion < 108) fail('app version is older than 108');",
    '108 version compatibility',
)
verify108 = replace_once(
    verify108,
    "if (!/EXPLORE_FEED_CACHE_SCHEMA_VERSION\\s*=\\s*2\\s*;/.test(cache)) fail('Explore Feed cache schema is not 2');",
    "const schemaMatch = cache.match(/EXPLORE_FEED_CACHE_SCHEMA_VERSION\\s*=\\s*(\\d+)\\s*;/);\nif (!schemaMatch || Number(schemaMatch[1]) < 2) fail('Explore Feed cache schema is older than 2');",
    '108 schema compatibility',
)
verify108 = verify108.replace("console.log('NEW_SCHEMA_2_WARM_CACHE=PERSISTENT');", "console.log('SCHEMA_2_PLUS_WARM_CACHE=PERSISTENT');")
verify108_path.write_text(verify108, encoding='utf-8')


# 4) New static verifier for the exact 109 regression pair.
Path('scripts/verify-109-mobile-feed-refresh-zero.mjs').write_text(r'''import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.tsx', 'utf8');
const cache = readFileSync('src/services/exploreSessionCache.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const profileCache = readFileSync('src/lib/userProfileCache.ts', 'utf8');
const control = readFileSync('src/services/userControlRevisionService.ts', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

const fail = (message) => { throw new Error(`[109] ${message}`); };
if (String(version.version) !== '109') fail('app version is not 109');
if (!app.includes('SORIDRAW_ROOT_USER_REFRESH_ZERO_109_20260916')) fail('refresh-zero gate marker missing');
if (app.includes('        attachUserRoleListener();\n\n        // Fetch favorites for the user.')) fail('unconditional root users listener remains');
if (!app.includes('subscribeUserControlRevision(')) fail('UID RTDB control revision gate missing');
if (!app.includes('PROFILE_SAFETY_REVERIFY_MS = 24 * 60 * 60 * 1000')) fail('bounded safety verification missing');
if (!app.includes('writeUserProfileServerVerifiedAt(currentUser.uid)')) fail('server verification lease write missing');
if (!profileCache.includes('SORIDRAW_USER_PROFILE_REFRESH_ZERO_1020')) fail('persistent profile cache missing');
if (!control.includes("ref(realtimeDb, `userControls/${uid}`)")) fail('UID-scoped RTDB control node missing');
if (!cache.includes('SORIDRAW_EXPLORE_MOBILE_STALE_PUBLIC_COUNT_RECOVERY_109_20260916')) fail('mobile stale feed recovery marker missing');
if (!/EXPLORE_FEED_CACHE_SCHEMA_VERSION\s*=\s*3\s*;/.test(cache)) fail('Explore Feed cache schema is not 3');
if (/app-version\.json|appVersion|APP_VERSION/.test(cache)) fail('Explore Feed cache is coupled to app version');
if (!page.includes('buildExploreR2SnapshotFeedUrl108')) fail('R2-only cold refill path missing');
if (!page.includes('cachedRevision === serverRevision')) fail('warm revision no-op path missing');

console.log('109_MOBILE_FEED_REFRESH_ZERO=PASS');
console.log('MOBILE_STALE_SCHEMA_2=REJECTED_ONCE');
console.log('COLD_REFILL=R2_SNAPSHOT_ONLY_D1_R0_W0_CONTRACT');
console.log('WARM_REFRESH_FIRESTORE_USERS=R0_BY_GATE');
console.log('ROOT_CONTROL_SIGNAL=UID_RTDB_ONLY');
console.log('FUTURE_APP_VERSION_CACHE_COUPLING=NONE');
console.log('NO_UI_CSS_CHANGE=true');
console.log('NO_D1_SCHEMA_MIGRATION=true');
''', encoding='utf-8')


# Static boundaries.
final_app = app_path.read_text(encoding='utf-8')
final_cache = cache_path.read_text(encoding='utf-8')
if "        attachUserRoleListener();\n\n        // Fetch favorites for the user." in final_app:
    raise RuntimeError('109 unconditional users listener remains')
if 'EXPLORE_FEED_CACHE_SCHEMA_VERSION = 3;' not in final_cache:
    raise RuntimeError('109 Explore schema 3 missing')

print('109 patch applied')

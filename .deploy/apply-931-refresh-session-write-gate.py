from pathlib import Path

MARKER = 'SORIDRAW_931_REFRESH_SESSION_WRITE_GATE'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'931 {label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


# -----------------------------------------------------------------------------
# 931 — A browser refresh is not a new login.
#
# Before this pass ensureAuthUserDocument updated users/{uid} on every auth
# restoration. That produced an unnecessary Firestore write on refresh and then
# woke the users/{uid} listener(s), even though no account/profile data changed.
#
# Keep the real-time users/{uid} listener intact for cross-device sync/version
# signals. Only publish the legacy Firestore login/session fields when Firebase
# Auth reports a genuinely newer sign-in timestamp. Presence/last-seen activity
# continues to use the existing Realtime Database presence controller.
# -----------------------------------------------------------------------------
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    old_block = """    const cachedProfile = readUserProfileCache(authUser.uid);
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
    }"""

    new_block = """    const cachedProfile = readUserProfileCache(authUser.uid);
    const authSignInAt = Date.parse(authUser.metadata.lastSignInTime || '') || 0;
    const loginSyncStorageKey = `soridraw_user_login_sync_v1_${authUser.uid}`;

    const profileTimestampMs = (value: any): number => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (value && typeof value.toMillis === 'function') {
        const millis = Number(value.toMillis());
        return Number.isFinite(millis) ? millis : 0;
      }
      if (value && typeof value.seconds === 'number') {
        const millis = (Number(value.seconds) * 1000) + Math.floor(Number(value.nanoseconds || 0) / 1_000_000);
        return Number.isFinite(millis) ? millis : 0;
      }
      const numeric = Number(value || 0);
      return Number.isFinite(numeric) ? numeric : 0;
    };

    const cachedLoginAt = profileTimestampMs((cachedProfile as any)?.lastLoginAt);
    let lastSyncedAuthLoginAt = 0;
    try {
      lastSyncedAuthLoginAt = Number(localStorage.getItem(loginSyncStorageKey) || 0);
      if (!Number.isFinite(lastSyncedAuthLoginAt)) lastSyncedAuthLoginAt = 0;
    } catch {}

    const shouldPublishLoginSession = authSignInAt > 0
      && cachedLoginAt < authSignInAt
      && lastSyncedAuthLoginAt < authSignInAt;

    const rememberPublishedLoginSession = () => {
      if (authSignInAt <= 0) return;
      try { localStorage.setItem(loginSyncStorageKey, String(authSignInAt)); } catch {}
    };

    // Refresh/app restore with the same authenticated session: zero users/{uid}
    // write. The root listener below still reconnects and remains the small
    // cross-device version signal source.
    if (cachedProfile && !shouldPublishLoginSession) return;

    if (cachedProfile) {
      try {
        await updateDoc(userRef, sessionData);
        rememberPublishedLoginSession();
        return;
      } catch (cachedUpdateError: any) {
        const code = String(cachedUpdateError?.code || '').toLowerCase();
        if (!code.includes('not-found')) throw cachedUpdateError;
      }
    }

    // No local profile cache means a new device, cleared storage, or first login.
    // Keep one safe server existence check so existing accounts are never
    // overwritten and brand-new accounts can still be created correctly.
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      if (shouldPublishLoginSession) {
        await updateDoc(userRef, sessionData);
        rememberPublishedLoginSession();
      }
      return;
    }"""

    app = replace_once(app, old_block, new_block, 'refresh session write gate')

    marker_anchor = 'const SORIDRAW_929_SINGLE_USER_PROFILE_SOURCE = true;\n'
    if marker_anchor in app:
      app = app.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)
    else:
      first_const = app.find('const ')
      if first_const < 0:
        raise SystemExit('931 App marker anchor missing')
      app = app[:first_const] + f'const {MARKER} = true;\n' + app[first_const:]

    app_path.write_text(app, encoding='utf-8')


# Build-time safety checks.
final_app = app_path.read_text(encoding='utf-8')
if "if (cachedProfile) {\n      try {\n        await updateDoc(userRef, sessionData);" in final_app:
    raise SystemExit('931 safety failed: unconditional cached-profile refresh write remains')
if "if (userSnap.exists()) {\n      await updateDoc(userRef, sessionData);" in final_app:
    raise SystemExit('931 safety failed: unconditional existing-user refresh write remains')
if 'const shouldPublishLoginSession = authSignInAt > 0' not in final_app:
    raise SystemExit('931 safety failed: true-login gate missing')
if "unsubUserDoc = onSnapshot(userRef" not in final_app:
    raise SystemExit('931 safety failed: root users listener was removed')
if 'startUserPresence' not in final_app:
    raise SystemExit('931 safety failed: Realtime Database presence path missing')

print('Applied SORIDRAW 931: refresh keeps the root sync listener but skips users/{uid} writes unless Firebase Auth reports a genuinely newer login.')

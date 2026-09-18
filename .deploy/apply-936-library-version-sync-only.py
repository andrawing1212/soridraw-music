from pathlib import Path
import re

MARKER = 'SORIDRAW_936_LIBRARY_VERSION_SYNC_ONLY'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'936 {label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


# -----------------------------------------------------------------------------
# Shared Library bundle version.
# - user_list_caches remains the cached payload document.
# - users/{uid}.syncVersions.library is only a tiny invalidation token.
# - a successful Library bundle write advances the local marker first, then the
#   remote token, so the same device never rereads its own write.
# -----------------------------------------------------------------------------
helper_path = Path('src/lib/listBundleCache.ts')
helper = helper_path.read_text(encoding='utf-8')

if MARKER not in helper:
    import_pattern = re.compile(r"import \{(?P<names>[^}]*)\} from '(?P<module>\./firestoreMeasured|firebase/firestore)';")
    import_match = import_pattern.search(helper)
    if not import_match:
        raise SystemExit('936 listBundle Firestore import missing')
    names = [name.strip() for name in import_match.group('names').split(',') if name.strip()]
    if 'updateDoc' not in names:
        names.append('updateDoc')
    import_replacement = "import { " + ', '.join(names) + " } from '" + import_match.group('module') + "';"
    helper = helper[:import_match.start()] + import_replacement + helper[import_match.end():]

    key_anchor = "const getBundleKey = (kind: ListBundleKind, uid: string) => `${kind}:${uid}`;\n"
    version_helpers = r'''const LIBRARY_LOCAL_SYNC_VERSION_STORAGE_BASE = 'soridraw_library_local_sync_version_v1';

export const readLibraryBundleLocalSyncVersion = (uid: string): number => {
  if (!uid || typeof localStorage === 'undefined') return 0;
  try {
    const value = Number(localStorage.getItem(`${LIBRARY_LOCAL_SYNC_VERSION_STORAGE_BASE}_${uid}`) || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};

export const writeLibraryBundleLocalSyncVersion = (uid: string, version: number): void => {
  if (!uid || !Number.isFinite(version) || version <= 0 || typeof localStorage === 'undefined') return;
  try {
    const previous = readLibraryBundleLocalSyncVersion(uid);
    localStorage.setItem(
      `${LIBRARY_LOCAL_SYNC_VERSION_STORAGE_BASE}_${uid}`,
      String(Math.max(previous, Math.floor(version))),
    );
  } catch {}
};

'''
    helper = replace_once(helper, key_anchor, key_anchor + version_helpers, 'Library local version helpers')

    success_anchor = """      rememberPayloadHash(kind, uid, payloadHash);
"""
    success_replacement = """      rememberPayloadHash(kind, uid, payloadHash);
      if (kind === 'library') {
        const libraryVersion = Number(payload.updatedAtMs || Date.now());
        // Same-device cache must advance before the remote invalidation token.
        writeLibraryBundleLocalSyncVersion(uid, libraryVersion);
        try {
          await updateDoc(doc(db, 'users', uid), { 'syncVersions.library': libraryVersion });
        } catch (error) {
          // The Library payload itself is already safe. A failed token update must
          // not duplicate or roll back the bundle write.
          console.warn('[listBundleCache] Library sync version publish failed:', error);
        }
      }
"""
    helper = replace_once(helper, success_anchor, success_replacement, 'Library bundle signal publish')

    marker_anchor = "const SORIDRAW_906_NAVIGATION_NO_BUNDLE_WRITES = true;\n"
    if marker_anchor in helper:
        helper = helper.replace(marker_anchor, f"const {MARKER} = true;\n" + marker_anchor, 1)
    else:
        helper += f"\nconst {MARKER} = true;\n"

    helper_path.write_text(helper, encoding='utf-8')


# -----------------------------------------------------------------------------
# Library workspace startup.
# Before 936 every browser refresh recreated the module session and immediately
# called subscribeListBundle -> getDocFromServer(user_list_caches), even when the
# durable local track cache was already current.
#
# New rule:
# - local cache + no newer users.syncVersions.library => zero Library server read
# - first 936 migration / empty cache => one bundle verification
# - another device publishes a newer version => exactly one bundle verification
# - route navigation/remount remains memory/cache only
# -----------------------------------------------------------------------------
library_path = Path('src/pages/SunoLibraryPage.tsx')
library = library_path.read_text(encoding='utf-8')

if MARKER not in library:
    profile_import_old = "import { readUserProfileCache, writeUserProfileCache } from '../lib/userProfileCache';"
    profile_import_new = "import { USER_PROFILE_CACHE_EVENT, readUserProfileCache, writeUserProfileCache } from '../lib/userProfileCache';"
    library = replace_once(library, profile_import_old, profile_import_new, 'Library profile event import')

    bundle_import_pattern = re.compile(
        r"import \{(?P<names>[^}]*)\} from '../lib/listBundleCache';"
    )
    bundle_match = bundle_import_pattern.search(library)
    if not bundle_match:
        raise SystemExit('936 Library bundle import missing')
    bundle_names = [name.strip() for name in bundle_match.group('names').split(',') if name.strip()]
    for needed in ['readLibraryBundleLocalSyncVersion', 'writeLibraryBundleLocalSyncVersion']:
        if needed not in bundle_names:
            bundle_names.append(needed)
    bundle_replacement = "import { " + ', '.join(bundle_names) + " } from '../lib/listBundleCache';"
    library = library[:bundle_match.start()] + bundle_replacement + library[bundle_match.end():]

    type_anchor = """  unsubscribeFallback: (() => void) | null;
  subscribers: Set<(state: LibraryWorkspaceSessionView) => void>;
"""
    type_replacement = """  unsubscribeFallback: (() => void) | null;
  unsubscribeVersionSignal: (() => void) | null;
  subscribers: Set<(state: LibraryWorkspaceSessionView) => void>;
"""
    library = replace_once(library, type_anchor, type_replacement, 'Library session version cleanup slot')

    create_anchor = """    unsubscribe: null,
    unsubscribeFallback: null,
    subscribers: new Set(),
"""
    create_replacement = """    unsubscribe: null,
    unsubscribeFallback: null,
    unsubscribeVersionSignal: null,
    subscribers: new Set(),
"""
    library = replace_once(library, create_anchor, create_replacement, 'Library session version cleanup init')

    stop_anchor = """  try { session.unsubscribe?.(); } catch {}
  try { session.unsubscribeFallback?.(); } catch {}
  session.unsubscribe = null;
  session.unsubscribeFallback = null;
"""
    stop_replacement = """  try { session.unsubscribe?.(); } catch {}
  try { session.unsubscribeFallback?.(); } catch {}
  try { session.unsubscribeVersionSignal?.(); } catch {}
  session.unsubscribe = null;
  session.unsubscribeFallback = null;
  session.unsubscribeVersionSignal = null;
"""
    library = replace_once(library, stop_anchor, stop_replacement, 'Library version listener cleanup')

    # The 902 source block ends with exactly one bundle subscription followed by
    # `return session;`. Wrap only that subscription; leave all fallback/query and
    # pagination behavior intact.
    subscription_start = library.find("  session.unsubscribe = subscribeListBundle('library', uid, {")
    if subscription_start < 0:
        raise SystemExit('936 Library bundle subscription start missing')
    subscription_end = library.find("\n\n  return session;", subscription_start)
    if subscription_end < 0:
        raise SystemExit('936 Library bundle subscription end missing')

    original_subscription = library[subscription_start:subscription_end]
    if "onData: (bundle, meta) => {" not in original_subscription:
        raise SystemExit('936 Library onData anchor missing')
    if "onMissing: (meta) => {" not in original_subscription:
        raise SystemExit('936 Library onMissing anchor missing')
    if "onError: (error) => {" not in original_subscription:
        raise SystemExit('936 Library onError anchor missing')

    patched_subscription = original_subscription
    patched_subscription = patched_subscription.replace(
        "onData: (bundle, meta) => {",
        """onData: (bundle, meta) => {
      libraryBundleReadInFlight = false;
      const remoteVersion = Number((readUserProfileCache(uid) as any)?.syncVersions?.library || 0);
      const verifiedVersion = Math.max(
        remoteVersion,
        readLibraryBundleLocalSyncVersion(uid),
        Number(bundle.updatedAtMs || 0),
        1,
      );
      writeLibraryBundleLocalSyncVersion(uid, verifiedVersion);""",
        1,
    )
    patched_subscription = patched_subscription.replace(
        "onMissing: (meta) => {",
        """onMissing: (meta) => {
      libraryBundleReadInFlight = false;""",
        1,
    )
    patched_subscription = patched_subscription.replace(
        "onError: (error) => {",
        """onError: (error) => {
      libraryBundleReadInFlight = false;""",
        1,
    )

    # Indent the existing subscription inside a guarded starter.
    inner_subscription = '\n'.join(('  ' + line if line else line) for line in patched_subscription.split('\n'))
    guarded_subscription = r'''  let libraryBundleReadInFlight = false;

  const readRemoteLibraryVersion = () => Number(
    (readUserProfileCache(uid) as any)?.syncVersions?.library || 0
  );

  const startLibraryBundleVerification = () => {
    if (libraryBundleReadInFlight) return;
    libraryBundleReadInFlight = true;
    try { session.unsubscribe?.(); } catch {}
    session.unsubscribe = null;
''' + inner_subscription + r'''
  };

  const shouldVerifyLibraryBundle = () => {
    const localVersion = readLibraryBundleLocalSyncVersion(uid);
    const remoteVersion = readRemoteLibraryVersion();
    // localVersion === 0 is a one-time 936 migration check for existing caches.
    return cachedTracks.length === 0 || localVersion <= 0 || remoteVersion > localVersion;
  };

  const handleLibraryProfileVersion = (event: Event) => {
    const detail = (event as CustomEvent<{ uid?: string }>).detail;
    if (!detail || detail.uid !== uid) return;
    if (readRemoteLibraryVersion() > readLibraryBundleLocalSyncVersion(uid)) {
      startLibraryBundleVerification();
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(USER_PROFILE_CACHE_EVENT, handleLibraryProfileVersion as EventListener);
    session.unsubscribeVersionSignal = () => {
      window.removeEventListener(USER_PROFILE_CACHE_EVENT, handleLibraryProfileVersion as EventListener);
    };
  }

  if (shouldVerifyLibraryBundle()) {
    startLibraryBundleVerification();
  } else {
    session.ready = true;
    markCacheDiagnostic('library', 'CACHE', 0);
    emitLibraryWorkspaceSession(session);
  }
'''

    library = library[:subscription_start] + guarded_subscription + library[subscription_end:]

    first_const = library.find('const ')
    if first_const < 0:
        raise SystemExit('936 Library marker insertion anchor missing')
    library = library[:first_const] + f'const {MARKER} = true;\n' + library[first_const:]
    library_path.write_text(library, encoding='utf-8')


# -----------------------------------------------------------------------------
# Build-time invariants. 936 must not touch Studio route state, Favorites, or the
# recent-song path that passed 935.
# -----------------------------------------------------------------------------
final_helper = helper_path.read_text(encoding='utf-8')
final_library = library_path.read_text(encoding='utf-8')
if MARKER not in final_helper or MARKER not in final_library:
    raise SystemExit('936 safety failed: marker missing')
if "'syncVersions.library': libraryVersion" not in final_helper:
    raise SystemExit('936 safety failed: Library remote invalidation publish missing')
if 'readLibraryBundleLocalSyncVersion' not in final_library:
    raise SystemExit('936 safety failed: Library local version gate missing')
if 'USER_PROFILE_CACHE_EVENT' not in final_library:
    raise SystemExit('936 safety failed: Library cross-device profile event missing')
if "startLibraryBundleVerification" not in final_library:
    raise SystemExit('936 safety failed: guarded Library verification missing')
if "nextParams.set('view'" in final_library or 'recentFavoriteDetachedAt' in final_library:
    raise SystemExit('936 safety failed: unrelated Studio/Favorites logic leaked into Library patch')

print('Applied SORIDRAW 936: Library refresh is cache-first/change-only; one migration read, then remote-version invalidation only.')

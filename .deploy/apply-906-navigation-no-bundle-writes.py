from pathlib import Path

MARKER = 'SORIDRAW_906_NAVIGATION_NO_BUNDLE_WRITES'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


# -----------------------------------------------------------------------------
# Shared bundle helper: remember the comparable bundle signature durably.
# Navigation/remount/app restart must not rewrite an identical cache bundle.
# -----------------------------------------------------------------------------
helper_path = Path('src/lib/listBundleCache.ts')
helper = helper_path.read_text(encoding='utf-8')

if MARKER not in helper:
    helper = replace_once(
        helper,
        "const lastPayloadHashes = new Map<string, string>();\n",
        "const lastPayloadHashes = new Map<string, string>();\nconst LIST_BUNDLE_HASH_STORAGE_PREFIX = 'soridraw_list_bundle_hash_v1';\nconst SORIDRAW_906_NAVIGATION_NO_BUNDLE_WRITES = true;\n",
        '906 helper marker',
    )

    helper = replace_once(
        helper,
        "const getBundleKey = (kind: ListBundleKind, uid: string) => `${kind}:${uid}`;\n",
        """const getBundleKey = (kind: ListBundleKind, uid: string) => `${kind}:${uid}`;
const getBundleHashStorageKey = (kind: ListBundleKind, uid: string) => `${LIST_BUNDLE_HASH_STORAGE_PREFIX}:${kind}:${uid}`;

const readRememberedPayloadHash = (kind: ListBundleKind, uid: string): string => {
  const key = getBundleKey(kind, uid);
  const memoryHash = lastPayloadHashes.get(key);
  if (memoryHash) return memoryHash;
  if (typeof localStorage === 'undefined') return '';
  try {
    const stored = localStorage.getItem(getBundleHashStorageKey(kind, uid)) || '';
    if (stored) lastPayloadHashes.set(key, stored);
    return stored;
  } catch {
    return '';
  }
};

const rememberPayloadHash = (kind: ListBundleKind, uid: string, hash: string) => {
  if (!uid || !hash) return;
  lastPayloadHashes.set(getBundleKey(kind, uid), hash);
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getBundleHashStorageKey(kind, uid), hash);
  } catch {}
};
""",
        '906 durable bundle signature helpers',
    )

    helper = replace_once(
        helper,
        "  lastPayloadHashes.set(getBundleKey(kind, uid), makePayloadHash(comparable));\n",
        "  rememberPayloadHash(kind, uid, makePayloadHash(comparable));\n",
        '906 remember server bundle signature',
    )

    helper = replace_once(
        helper,
        "  if (lastPayloadHashes.get(key) === payloadHash) return;\n\n  const existingTimer = writeTimers.get(key);\n",
        "  if (readRememberedPayloadHash(kind, uid) === payloadHash) return;\n\n  const existingTimer = writeTimers.get(key);\n",
        '906 durable pre-write dedupe',
    )

    helper = replace_once(
        helper,
        "    if (lastPayloadHashes.get(key) === payloadHash) return;\n\n    const payload = {\n",
        "    if (readRememberedPayloadHash(kind, uid) === payloadHash) return;\n\n    const payload = {\n",
        '906 durable timer dedupe',
    )

    helper = replace_once(
        helper,
        "      lastPayloadHashes.set(key, payloadHash);\n",
        "      rememberPayloadHash(kind, uid, payloadHash);\n",
        '906 persist successful write signature',
    )

    helper_path.write_text(helper, encoding='utf-8')
    print('Applied SORIDRAW 906 helper: identical bundle payloads stay local across navigation/restart.')
else:
    print('SORIDRAW 906 helper already applied.')


# -----------------------------------------------------------------------------
# Music Note: generic local-cache persistence also runs during auth/bootstrap.
# Do not mirror that restore to Firestore before the Music Note bundle path is
# actually active. Real changes made before page entry remain in local favorites
# and are reconciled when Music Note is opened.
# -----------------------------------------------------------------------------
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

music_note_schedule = """    scheduleListBundleWrite('musicNote', uid, safeList, {
      limit: 20,
      hasMore: safeList.length >= 20,
      deletedIds: Array.from(getFavoriteDeletedTombstoneIds(uid)),
    });
"""
if music_note_schedule in app:
    app = app.replace(
        music_note_schedule,
        """    if (musicNoteBundleActiveUids.has(uid)) {
      scheduleListBundleWrite('musicNote', uid, safeList, {
        limit: 20,
        hasMore: safeList.length >= 20,
        deletedIds: Array.from(getFavoriteDeletedTombstoneIds(uid)),
      });
    }
""",
        1,
    )
    print('Applied SORIDRAW 906 App: Home/cache restore cannot write Music Note bundle.')
else:
    print('SORIDRAW 906 App: Music Note schedule anchor already changed or unavailable.')

app_path.write_text(app, encoding='utf-8')


# -----------------------------------------------------------------------------
# Library: remove the broad tracks-state mirror. It fired on hydration/remount,
# turning navigation into writes. Authoritative server-source paths introduced by
# 902 remain responsible for creating/updating the latest-10-set bundle.
# -----------------------------------------------------------------------------
library_path = Path('src/pages/SunoLibraryPage.tsx')
library = library_path.read_text(encoding='utf-8')

library_effect = """  useEffect(() => {
    if (!user?.uid || isSharedView || !Array.isArray(tracks) || tracks.length === 0) return;
    const sessionHasOlder = libraryWorkspaceSession?.uid === user.uid
      ? (libraryWorkspaceSession.tracks.length > 10 || libraryWorkspaceSession.hasMore)
      : tracks.length > 10;
    scheduleListBundleWrite('library', user.uid, tracks, {
      limit: 10,
      hasMore: sessionHasOlder,
    });
  }, [tracks, user?.uid, isSharedView]);
"""

if library_effect in library:
    library = library.replace(
        library_effect,
        """  // 906: route hydration/remount is cache-only. Do not mirror the visible
  // tracks state back to Firestore merely because the Library page mounted.
""",
        1,
    )
    print('Applied SORIDRAW 906 Library: route hydration no longer writes bundle cache.')
else:
    print('SORIDRAW 906 Library: broad hydration mirror already absent.')

library_path.write_text(library, encoding='utf-8')

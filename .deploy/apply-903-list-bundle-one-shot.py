from pathlib import Path

MARKER = 'SORIDRAW_903_LIST_BUNDLE_ONE_SHOT'
APP_MARKER = 'SORIDRAW_903_LIST_BUNDLE_ONE_SHOT_RUNTIME'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


# -----------------------------------------------------------------------------
# Shared helper — replace persistent onSnapshot with one server document read.
# This removes cache/server double callbacks and self-write echo reads.
# -----------------------------------------------------------------------------
helper_path = Path('src/lib/listBundleCache.ts')
helper = helper_path.read_text(encoding='utf-8')

if MARKER not in helper:
    helper = replace_once(
        helper,
        "import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';",
        "import { doc, getDocFromServer, serverTimestamp, setDoc } from 'firebase/firestore';",
        'one-shot Firestore import',
    )
    helper = replace_once(
        helper,
        "const LIST_BUNDLE_SCHEMA_VERSION = 1;\n",
        "const LIST_BUNDLE_SCHEMA_VERSION = 1;\nconst SORIDRAW_903_LIST_BUNDLE_ONE_SHOT = true;\n",
        'one-shot marker',
    )

    start = helper.find('export const subscribeListBundle = (')
    if start < 0:
        raise SystemExit('subscribeListBundle start missing')

    one_shot = '''export const subscribeListBundle = (
  kind: ListBundleKind,
  uid: string,
  callbacks: BundleListenerCallbacks,
) => {
  if (!uid) return () => {};

  let cancelled = false;

  void getDocFromServer(getBundleRef(kind, uid))
    .then((snapshot) => {
      if (cancelled) return;
      const meta = { fromCache: false };
      if (!snapshot.exists()) {
        callbacks.onMissing?.(meta);
        return;
      }

      const data = snapshot.data() || {};
      const items = Array.isArray(data.items) ? data.items : [];
      const bundle: ListBundleSnapshot = {
        schemaVersion: Number(data.schemaVersion || 0),
        kind,
        items,
        itemCount: Number(data.itemCount || items.length || 0),
        cursorCreatedAtMs: Number(data.cursorCreatedAtMs || 0),
        hasMore: data.hasMore === true,
        deletedIds: normalizeDeletedIds(data.deletedIds),
        updatedAtMs: Number(data.updatedAtMs || 0),
      };

      rememberListBundleSnapshot(kind, uid, bundle, kind === 'musicNote' ? 20 : 10);
      callbacks.onData(bundle, meta);
    })
    .catch((error) => {
      if (!cancelled) callbacks.onError?.(error);
    });

  return () => {
    cancelled = true;
  };
};
'''
    helper = helper[:start] + one_shot
    helper_path.write_text(helper, encoding='utf-8')
    print('Applied SORIDRAW 903 helper: bundle read is one server get, no persistent listener.')
else:
    print('SORIDRAW 903 helper already applied.')


# -----------------------------------------------------------------------------
# App.tsx — block 901 incremental query while the one-shot bundle bootstrap runs.
# If the bundle is missing/errors, 902 already removes this active flag and falls
# back to the safe legacy path.
# -----------------------------------------------------------------------------
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if APP_MARKER not in app:
    app = replace_once(
        app,
        'const SORIDRAW_902_LIST_BUNDLE_CACHE = true;\n',
        'const SORIDRAW_903_LIST_BUNDLE_ONE_SHOT_RUNTIME = true;\nconst SORIDRAW_902_LIST_BUNDLE_CACHE = true;\n',
        'App 903 marker',
    )
    app = replace_once(
        app,
        '''        let musicNoteBundleMissingHandled = false;\n        unsubMusicNoteBundle = subscribeListBundle('musicNote', currentUser.uid, {''',
        '''        let musicNoteBundleMissingHandled = false;\n        // 903: reserve the Music Note bundle path before the async one-shot read\n        // so the older 901 incremental query cannot race and add extra reads.\n        musicNoteBundleActiveUids.add(currentUser.uid);\n        unsubMusicNoteBundle = subscribeListBundle('musicNote', currentUser.uid, {''',
        'Music Note one-shot race guard',
    )
    app_path.write_text(app, encoding='utf-8')
    print('Applied SORIDRAW 903 App: Music Note one-shot bundle blocks delta-read race.')
else:
    print('SORIDRAW 903 App already applied.')

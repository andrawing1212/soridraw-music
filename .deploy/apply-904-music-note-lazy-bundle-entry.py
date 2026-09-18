from pathlib import Path

HELPER_MARKER = 'SORIDRAW_904_MUSIC_NOTE_LAZY_BUNDLE_ENTRY'
APP_MARKER = 'SORIDRAW_904_MUSIC_NOTE_LAZY_BUNDLE_ENTRY_RUNTIME'
EVENT_NAME = 'soridraw:music-note-bundle-page-entry'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


# -----------------------------------------------------------------------------
# Shared bundle helper — Music Note must not touch Firestore from Home.
# Library keeps the proven immediate one-shot behavior from 903.
# -----------------------------------------------------------------------------
helper_path = Path('src/lib/listBundleCache.ts')
helper = helper_path.read_text(encoding='utf-8')

if HELPER_MARKER not in helper:
    marker_anchor = "const LIST_BUNDLE_SCHEMA_VERSION = 1;\n"
    helper = replace_once(
        helper,
        marker_anchor,
        marker_anchor + f"const {HELPER_MARKER} = true;\nconst MUSIC_NOTE_BUNDLE_PAGE_ENTRY_EVENT = '{EVENT_NAME}';\n",
        '904 helper marker',
    )

    start = helper.find('export const subscribeListBundle = (')
    if start < 0:
        raise SystemExit('904 subscribeListBundle start missing')

    lazy_subscribe = '''export const subscribeListBundle = (
  kind: ListBundleKind,
  uid: string,
  callbacks: BundleListenerCallbacks,
) => {
  if (!uid) return () => {};

  let cancelled = false;
  let started = false;

  const runOneShotRead = () => {
    if (cancelled || started) return;
    started = true;

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
  };

  const handleMusicNotePageEntry = () => runOneShotRead();

  if (kind === 'musicNote') {
    // 904: Home/login startup only prepares this callback. No Firestore read happens
    // until the Music Note route explicitly announces that it is actually visible.
    if (typeof window !== 'undefined') {
      window.addEventListener(MUSIC_NOTE_BUNDLE_PAGE_ENTRY_EVENT, handleMusicNotePageEntry as EventListener);
      if ((window as any).__soridrawMusicNotePageActive === true) {
        runOneShotRead();
      }
    }
  } else {
    // Library behavior stays exactly as 903: one document read when Library starts.
    runOneShotRead();
  }

  return () => {
    cancelled = true;
    if (kind === 'musicNote' && typeof window !== 'undefined') {
      window.removeEventListener(MUSIC_NOTE_BUNDLE_PAGE_ENTRY_EVENT, handleMusicNotePageEntry as EventListener);
    }
  };
};
'''

    helper = helper[:start] + lazy_subscribe
    helper_path.write_text(helper, encoding='utf-8')
    print('Applied SORIDRAW 904 helper: Music Note bundle waits for actual page entry; Home reads zero.')
else:
    print('SORIDRAW 904 helper already applied.')


# -----------------------------------------------------------------------------
# App.tsx — the existing Music Note route wrapper emits the explicit page-entry
# signal. Nothing else in the app is changed.
# -----------------------------------------------------------------------------
app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if APP_MARKER not in app:
    app = replace_once(
        app,
        'const SORIDRAW_903_LIST_BUNDLE_ONE_SHOT_RUNTIME = true;\n',
        f'const {APP_MARKER} = true;\nconst SORIDRAW_903_LIST_BUNDLE_ONE_SHOT_RUNTIME = true;\n',
        '904 App marker',
    )

    old_effect = '''  useEffect(() => {
    if (new URLSearchParams(location.search).has('note')) return;
    markCacheDiagnostic('musicNote', 'CACHE', 0);
  }, [location.pathname, location.search]);
'''
    new_effect = '''  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__soridrawMusicNotePageActive = true;
      window.dispatchEvent(new Event('soridraw:music-note-bundle-page-entry'));
    }

    if (!new URLSearchParams(location.search).has('note')) {
      markCacheDiagnostic('musicNote', 'CACHE', 0);
    }

    return () => {
      if (typeof window !== 'undefined') {
        (window as any).__soridrawMusicNotePageActive = false;
      }
    };
  }, [location.pathname, location.search]);
'''
    app = replace_once(app, old_effect, new_effect, '904 Music Note route entry signal')
    app_path.write_text(app, encoding='utf-8')
    print('Applied SORIDRAW 904 App: Music Note page entry triggers its single bundle read.')
else:
    print('SORIDRAW 904 App already applied.')

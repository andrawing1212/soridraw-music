from pathlib import Path
import re

MARKER = 'SORIDRAW_937_MUSIC_NOTE_REFRESH_VERSION_GATE'

app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    # 902/903 kept a one-shot user_list_caches Music Note bundle read alive on
    # every app restart, even when the durable favorites cache was already current.
    # 901 already has the correct cross-device mechanism: users/{uid}.syncVersions.musicNote
    # -> MUSIC_NOTE_SYNC_VERSION_EVENT -> changed favorites query only when newer.
    # Therefore the bundle is only a bootstrap/migration fallback now.
    pattern = re.compile(
        r'''        let musicNoteBundleMissingHandled = false;\n'''
        r'''        // 903: reserve the Music Note bundle path before the async one-shot read\n'''
        r'''        // so the older 901 incremental query cannot race and add extra reads\.\n'''
        r'''        musicNoteBundleActiveUids\.add\(currentUser\.uid\);\n'''
        r'''        unsubMusicNoteBundle = subscribeListBundle\('musicNote', currentUser\.uid, \{.*?\n        \}\);\n''',
        re.S,
    )
    match = pattern.search(app)
    if not match:
        raise SystemExit('937 Music Note bundle bootstrap block missing')

    original = match.group(0)
    indented = ''.join(('  ' + line if line.strip() else line) for line in original.splitlines(True))
    replacement = '''        const musicNoteLocalVersionAtBootstrap = readMusicNoteSyncVersion(
          MUSIC_NOTE_LOCAL_SYNC_VERSION_STORAGE_BASE,
          currentUser.uid,
        );
        const musicNoteRemoteVersionAtBootstrap = readMusicNoteSyncVersion(
          MUSIC_NOTE_REMOTE_SYNC_VERSION_STORAGE_BASE,
          currentUser.uid,
        );
        const shouldVerifyMusicNoteBundle = !hasCachedMusicNote
          || musicNoteLocalVersionAtBootstrap <= 0
          || musicNoteRemoteVersionAtBootstrap > musicNoteLocalVersionAtBootstrap;

        if (shouldVerifyMusicNoteBundle) {
''' + indented + '''        } else {
          // Cached Music Note is already verified. Keep the 901 incremental path
          // available so a later users sync-version event can fetch only changed
          // favorites instead of forcing the whole bundle on every refresh.
          musicNoteBundleActiveUids.delete(currentUser.uid);
          markCacheDiagnostic('musicNote', 'CACHE', 0);
          setIsFavoritesLoading(false);
        }
'''
    app = app[:match.start()] + replacement + app[match.end():]

    marker_anchor = 'const SORIDRAW_936_LIBRARY_VERSION_SYNC_ONLY = true;\n'
    if marker_anchor in app:
        app = app.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)
    else:
        # 936 marker lives in Library/helper rather than App. Anchor to the latest
        # App marker that must exist in this chain.
        marker_anchor = 'const SORIDRAW_935_RECENT_VERSION_SYNC_ONLY = true;\n'
        if marker_anchor not in app:
            raise SystemExit('937 App marker anchor missing')
        app = app.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)

    app_path.write_text(app, encoding='utf-8')

final_app = app_path.read_text(encoding='utf-8')
if MARKER not in final_app:
    raise SystemExit('937 safety failed: marker missing')
if 'const shouldVerifyMusicNoteBundle = !hasCachedMusicNote' not in final_app:
    raise SystemExit('937 safety failed: Music Note change gate missing')
if 'musicNoteBundleActiveUids.delete(currentUser.uid);' not in final_app:
    raise SystemExit('937 safety failed: incremental path release missing')
if 'MUSIC_NOTE_SYNC_VERSION_EVENT' not in final_app:
    raise SystemExit('937 safety failed: 901 cross-device sync signal missing')
if "getDocs(q)" not in final_app:
    raise SystemExit('937 safety failed: changed-favorites incremental reader missing')
if "nextParams.set('view'" in final_app:
    raise SystemExit('937 safety failed: broken 933 route state reintroduced')

print('Applied SORIDRAW 937: unchanged Music Note refresh skips user_list_caches; cross-device changes still use 901 delta sync.')

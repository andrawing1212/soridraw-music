from pathlib import Path

MARKER = 'SORIDRAW_937_MUSIC_NOTE_REFRESH_VERSION_GATE'

app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    # 902/903 kept a one-shot user_list_caches Music Note bundle read alive on
    # every app restart, even when the durable favorites cache was already current.
    # 909 already removed premature bundle activation, and 901 owns the correct
    # cross-device route: users/{uid}.syncVersions.musicNote -> changed favorites
    # only when newer. Guard only the automatic bundle bootstrap; Manual Sync stays explicit.
    subscription_start = app.find(
        "        unsubMusicNoteBundle = subscribeListBundle('musicNote', currentUser.uid, {"
    )
    if subscription_start < 0:
        raise SystemExit('937 Music Note bundle subscription start missing')

    on_error = app.find('          onError:', subscription_start)
    if on_error < 0:
        raise SystemExit('937 Music Note bundle onError missing')
    close_start = app.find('\n        });', on_error)
    if close_start < 0:
        raise SystemExit('937 Music Note bundle subscription close missing')
    block_end = close_start + len('\n        });')

    original = app[subscription_start:block_end]
    indented = ''.join(('  ' + line if line.strip() else line) for line in original.splitlines(True))

    gate = '''        const musicNoteLocalVersionAtBootstrap = readMusicNoteSyncVersion(
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
''' + indented + '''
        } else {
          // Cache is already current. Keep 901 delta sync available so a later
          // cross-device version event fetches only changed favorites.
          musicNoteBundleActiveUids.delete(currentUser.uid);
          markCacheDiagnostic('musicNote', 'CACHE', 0);
          setIsFavoritesLoading(false);
        }'''

    app = app[:subscription_start] + gate + app[block_end:]

    marker_anchor = 'const SORIDRAW_935_RECENT_VERSION_SYNC_ONLY = true;\n'
    if marker_anchor not in app:
        marker_anchor = 'const SORIDRAW_932_REFRESH_ROOT_WRITE_AND_SECTION_ROUTE_GATE = true;\n'
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
if 'syncMusicNoteIncrementalFromRemoteVersion' not in final_app:
    raise SystemExit('937 safety failed: 901 incremental sync function missing')
if "nextParams.set('view'" in final_app:
    raise SystemExit('937 safety failed: broken 933 route state reintroduced')

print('Applied SORIDRAW 937: unchanged Music Note refresh skips user_list_caches; cross-device changes still use 901 delta sync.')

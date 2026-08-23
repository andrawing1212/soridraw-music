from pathlib import Path

MARKER = 'SORIDRAW_908_MUSIC_NOTE_NO_HOME_DELTA_READ'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    # 901's remote-version incremental sync is app-level and can run during Home
    # startup before the lazy Music Note bundle path has fully reserved the uid.
    # Keep the remote version signal cached, but never perform a favorites query
    # unless the user is actually on the Music Note route. The 902 bundle read on
    # /history remains the authoritative one-document refresh path.
    anchor = '''    const uid = currentUser.uid;
    if (musicNoteBundleActiveUids.has(uid)) {
'''
    replacement = '''    const uid = currentUser.uid;
    if (typeof window !== 'undefined' && window.location.pathname !== '/history') {
      return;
    }
    if (musicNoteBundleActiveUids.has(uid)) {
'''
    app = replace_once(app, anchor, replacement, '908 Music Note delta route gate')

    marker_anchor = 'const SORIDRAW_907_SESSION_READ_GUARDS = true;\n'
    if marker_anchor in app:
        app = app.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)
    else:
        app = app.replace(
            'const SORIDRAW_905_RECENT_SONGS_CACHE_LIVE_ACCOUNTING = true;\n',
            f'const {MARKER} = true;\nconst SORIDRAW_905_RECENT_SONGS_CACHE_LIVE_ACCOUNTING = true;\n',
            1,
        )

    app_path.write_text(app, encoding='utf-8')
    print('Applied SORIDRAW 908: Music Note incremental query is forbidden outside /history.')
else:
    print('SORIDRAW 908 already applied.')

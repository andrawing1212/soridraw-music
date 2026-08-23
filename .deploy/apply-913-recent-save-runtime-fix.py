from pathlib import Path

MARKER = 'SORIDRAW_913_RECENT_SAVE_RUNTIME_FIX'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    # 912 accidentally referenced a local cache ref/helper that do not exist in
    # App.tsx. Vite transpilation did not type-check that symbol, so production
    # build succeeded but both edit-confirm and heart threw at runtime.
    #
    # Keep the intended model:
    # - edit/confirm: React/history refs only, no Firestore write
    # - heart: queue current snapshot and flush user_recent_songs exactly once
    # - Music Note favorite remains handled by toggleFavorite independently
    app = replace_once(
        app,
        '''    // Local persistence only. No timer and no pagehide Firestore flush.\n    recentSongsCacheRef.current = nextSongs;\n    saveRecentSongsCache(uid, nextSongs);\n    recentSongTextWritePendingRef.current = { uid, songs: nextSongs };''',
        '''    // Local working copy only. No timer and no pagehide Firestore flush.\n    // historyRef/resultRef + React state above are the valid in-session cache.\n    recentSongTextWritePendingRef.current = { uid, songs: nextSongs };''',
        '913 remove invalid local cache calls from edit path',
    )

    app = replace_once(
        app,
        '''          // Heart is the only Firestore commit boundary for text edits.\n          // Store the recent-song bundle once with the exact post-toggle link state.\n          recentSongsCacheRef.current = nextCommittedHistory;\n          saveRecentSongsCache(user.uid, nextCommittedHistory);\n          recentSongTextWritePendingRef.current = {\n            uid: user.uid,\n            songs: nextCommittedHistory,\n          };\n          await flushRecentSongTextWrite();''',
        '''          // Heart is the only Firestore commit boundary for text edits.\n          // Queue the exact post-toggle snapshot, then write user_recent_songs once.\n          recentSongTextWritePendingRef.current = {\n            uid: user.uid,\n            songs: nextCommittedHistory,\n          };\n          await flushRecentSongTextWrite();''',
        '913 remove invalid local cache calls from heart path',
    )

    marker_anchor = 'const SORIDRAW_912_HEART_TRIGGERED_RECENT_SAVE = true;\n'
    if marker_anchor not in app:
        raise SystemExit('913 marker anchor missing')
    app = app.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)

    # Fail the build if the two accidental 912-only runtime symbols survive.
    if 'recentSongsCacheRef' in app or 'saveRecentSongsCache' in app:
        raise SystemExit('913 invalid recent cache runtime symbol still present')

    app_path.write_text(app, encoding='utf-8')
    print('Applied SORIDRAW 913: edit confirm is local-only; heart flushes recent songs once without invalid runtime cache calls.')
else:
    print('SORIDRAW 913 already applied.')

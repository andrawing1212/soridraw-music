from pathlib import Path

MARKER = 'SORIDRAW_913_RECENT_SAVE_RUNTIME_FIX'

# Step 2-A4c compatibility: preserve mirrorTargets while removing invalid cache ref.


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    # 912 introduced recentSongsCacheRef from the wrong scope. The existing
    # saveRecentSongsCache helper is valid and must remain: it is the local cache
    # persistence path. Vite transpilation did not catch the undefined ref, so
    # edit-confirm and heart both failed only at browser runtime.
    #
    # Keep the intended model:
    # - edit/confirm: React state + valid local cache only, Firestore write 0
    # - heart: persist the final local snapshot, then flush user_recent_songs once
    # - Music Note favorite remains handled by toggleFavorite independently
    app = replace_once(
        app,
        '''    // Local persistence only. No timer and no pagehide Firestore flush.\n    recentSongsCacheRef.current = nextSongs;\n    saveRecentSongsCache(uid, nextSongs);\n    recentSongTextWritePendingRef.current = { uid, songs: nextSongs, operation, mirrorTargets };''',
        '''    // Local persistence only. No timer and no pagehide Firestore flush.\n    saveRecentSongsCache(uid, nextSongs);\n    recentSongTextWritePendingRef.current = { uid, songs: nextSongs, operation, mirrorTargets };''',
        '913 remove invalid recent cache ref from edit path',
    )

    app = replace_once(
        app,
        '''          // Heart is the only Firestore commit boundary for text edits.\n          // Store the recent-song bundle once with the exact post-toggle link state.\n          recentSongsCacheRef.current = nextCommittedHistory;\n          saveRecentSongsCache(user.uid, nextCommittedHistory);\n          recentSongTextWritePendingRef.current = {\n            uid: user.uid,\n            songs: nextCommittedHistory,\n            operation: recentSongTextWritePendingRef.current?.operation || 'pre-favorite-edit',
            mirrorTargets: buildRecentMirrorTargets([nextCommittedSong], 'upsert'),\n          };\n          await flushRecentSongTextWrite();''',
        '''          // Heart is the only Firestore commit boundary for text edits.\n          // Persist the local snapshot, then write user_recent_songs exactly once.\n          saveRecentSongsCache(user.uid, nextCommittedHistory);\n          recentSongTextWritePendingRef.current = {\n            uid: user.uid,\n            songs: nextCommittedHistory,\n            operation: recentSongTextWritePendingRef.current?.operation || 'pre-favorite-edit',
            mirrorTargets: buildRecentMirrorTargets([nextCommittedSong], 'upsert'),\n          };\n          await flushRecentSongTextWrite();''',
        '913 remove invalid recent cache ref from heart path',
    )

    marker_anchor = 'const SORIDRAW_912_HEART_TRIGGERED_RECENT_SAVE = true;\n'
    if marker_anchor not in app:
        raise SystemExit('913 marker anchor missing')
    app = app.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)

    # The bad 912-only ref must be completely gone. saveRecentSongsCache is an
    # existing valid helper, so it is intentionally retained.
    remaining_ref = app.count('recentSongsCacheRef')
    if remaining_ref:
        raise SystemExit(f'913 invalid recentSongsCacheRef still present: {remaining_ref}')

    app_path.write_text(app, encoding='utf-8')
    print('Applied SORIDRAW 913: valid local recent cache kept; undefined ref removed; heart keeps one recent-song Firestore flush.')
else:
    print('SORIDRAW 913 already applied.')

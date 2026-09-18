from pathlib import Path
import re

MARKER = 'SORIDRAW_901_MUSIC_NOTE_SYNC_PERMISSION_HARDENING'

app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    # The currently deployed project rules may still predate the prepared
    # syncVersions.musicNote allowance. Keep cross-device sync on the already
    # authorized favoriteSyncSignalUpdatedAt field for now, so a preview build
    # cannot break existing favorite signal writes with permission-denied.
    app, removed = re.subn(
        r"\n\s*'syncVersions\.musicNote':\s*[^,\n]+,",
        '',
        app,
    )
    if removed < 1:
        raise SystemExit('901 syncVersions hardening found no staged writes to remove')

    app = app.replace(
        'const SORIDRAW_901_MUSIC_NOTE_10_INCREMENTAL_SYNC = true;\n',
        f'const {MARKER} = true;\nconst SORIDRAW_901_MUSIC_NOTE_10_INCREMENTAL_SYNC = true;\n',
        1,
    )
    app_path.write_text(app, encoding='utf-8')
    print(f'Applied SORIDRAW 901 permission hardening: removed {removed} staged syncVersions writes; favoriteSyncSignalUpdatedAt remains the live version source.')
else:
    print('SORIDRAW 901 permission hardening already applied.')

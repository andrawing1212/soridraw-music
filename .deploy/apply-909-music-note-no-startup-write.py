from pathlib import Path

MARKER = 'SORIDRAW_909_MUSIC_NOTE_NO_STARTUP_WRITE'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

if MARKER not in app:
    # 903 marked the Music Note bundle as active before the page was actually
    # entered. 906 then interpreted normal startup cache hydration as a real
    # bundle mutation and scheduled one Firestore write. Remove that premature
    # activation. 902 already marks the uid active when the actual bundle data
    # is returned on /history, which is the correct boundary.
    old = '''        // 903: reserve the Music Note bundle path before the async one-shot read
        // so the older 901 incremental query cannot race and add extra reads.
        musicNoteBundleActiveUids.add(currentUser.uid);
        unsubMusicNoteBundle = subscribeListBundle('musicNote', currentUser.uid, {'''
    new = '''        // 909: Home/login startup must stay local-only. Do not mark the bundle
        // active until the real /history bundle read succeeds in 902 onData.
        unsubMusicNoteBundle = subscribeListBundle('musicNote', currentUser.uid, {'''
    app = replace_once(app, old, new, '909 remove premature Music Note bundle activation')

    marker_anchor = 'const SORIDRAW_908_MUSIC_NOTE_NO_HOME_DELTA_READ = true;\n'
    if marker_anchor in app:
        app = app.replace(marker_anchor, f'const {MARKER} = true;\n' + marker_anchor, 1)
    else:
        app = app.replace(
            'const SORIDRAW_907_SESSION_READ_GUARDS = true;\n',
            f'const {MARKER} = true;\nconst SORIDRAW_907_SESSION_READ_GUARDS = true;\n',
            1,
        )

    app_path.write_text(app, encoding='utf-8')
    print('Applied SORIDRAW 909: Home cache hydration no longer writes Music Note bundle.')
else:
    print('SORIDRAW 909 already applied.')

# 910 keeps frequent recent-song text edits local first and merges them into one
# delayed server write. It also makes Studio heart unsave trust the exact active
# local favorite before any server duplicate lookup.
apply_910 = Path('.deploy/apply-910-recent-text-batch-unsave-fix.py')
if apply_910.exists():
    exec(compile(apply_910.read_text(encoding='utf-8'), str(apply_910), 'exec'), {'__name__': '__main__'})

# 911 extends the quiet window to 30 seconds and stores the exact Music Note
# Firestore id on the recent-song snapshot so save/unsave survives text edits.
apply_911 = Path('.deploy/apply-911-recent-heart-link-and-30s-batch.py')
if apply_911.exists():
    exec(compile(apply_911.read_text(encoding='utf-8'), str(apply_911), 'exec'), {'__name__': '__main__'})

# 912 removes the timer entirely. Recent text edits stay local until heart is
# pressed; heart commits the current recent-song version once and snapshots it to
# Music Note. Any later recent edit detaches and becomes a new unsaved version.
apply_912 = Path('.deploy/apply-912-heart-triggered-recent-save.py')
if apply_912.exists():
    exec(compile(apply_912.read_text(encoding='utf-8'), str(apply_912), 'exec'), {'__name__': '__main__'})

# 913 removes the accidental undefined cache symbols introduced by 912. Edit
# confirmation stays local-only and heart keeps the single recent-song flush.
apply_913 = Path('.deploy/apply-913-recent-save-runtime-fix.py')
if apply_913.exists():
    exec(compile(apply_913.read_text(encoding='utf-8'), str(apply_913), 'exec'), {'__name__': '__main__'})

# 915 makes a filled heart resolve the exact linked Music Note Firestore document
# before any content-based matching. Second click therefore unsaves that exact row.
apply_915 = Path('.deploy/apply-915-heart-explicit-unsave.py')
if apply_915.exists():
    exec(compile(apply_915.read_text(encoding='utf-8'), str(apply_915), 'exec'), {'__name__': '__main__'})

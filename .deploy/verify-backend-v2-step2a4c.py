from pathlib import Path
import subprocess
import sys

mode = sys.argv[1] if len(sys.argv) > 1 else 'source'
app = Path('src/App.tsx').read_text(encoding='utf-8')
mirror_path = Path('src/data/v2PreviewShadowMirror.ts')
if not mirror_path.exists():
    raise SystemExit('missing v2PreviewShadowMirror.ts')
mirror = mirror_path.read_text(encoding='utf-8')
boundary = Path('src/data/v1MutationBoundary.ts').read_text(encoding='utf-8')
outbox = Path('src/data/indexedDbMirrorOutbox.ts').read_text(encoding='utf-8')
patch910 = Path('.deploy/apply-910-recent-text-batch-unsave-fix.py').read_text(encoding='utf-8')
patch912 = Path('.deploy/apply-912-heart-triggered-recent-save.py').read_text(encoding='utf-8')
patch913 = Path('.deploy/apply-913-recent-save-runtime-fix.py').read_text(encoding='utf-8')

for marker in [
    "import './data/v2PreviewShadowMirror'",
    'ensureLiveSoridrawSongId',
    'soridrawSongId: favoriteSoridrawSongId',
    "operation: 'save-batch'",
    "operation: 'regenerate'",
    "operation: 'add-lyrics-language'",
    "operation: 'edit'",
    "operation: 'pre-favorite-edit'",
]:
    if marker not in app:
        raise SystemExit(f'missing App marker: {marker}')

for marker in [
    "BACKEND_V2_PREVIEW_SHADOW_HOST = 'soridraw-music-git-preview-andrawing1212.vercel.app'",
    'BACKEND_V2_PREVIEW_SHADOW_MAX_TARGETS_PER_MUTATION = 10',
    "targetKind: 'soridraw'",
    'processPendingOutbox',
    'runTransaction',
    'legacyRecentIndex',
    "startsWith('bulk-')",
]:
    if marker not in mirror:
        raise SystemExit(f'missing mirror marker: {marker}')
if 'deleteDoc(' in mirror or 'firebase-functions' in mirror:
    raise SystemExit('forbidden mirror mutation/dependency found')
if 'registerV1MutationPostSuccessHook' not in boundary:
    raise SystemExit('missing post-success hook')
if 'sourceDocumentId?: string' not in outbox:
    raise SystemExit('missing outbox source locator')
for marker in [
    'mirrorTargets: pending.mirrorTargets',
    'V1MutationMirrorTarget[]',
    'buildRecentMirrorTargets([nextSong]',
    'buildRecentMirrorTargets([nextHistory[currentIndex]]',
]:
    if marker not in patch910:
        raise SystemExit(f'missing 910 compatibility marker: {marker}')
for marker in [
    'Step 2-A4c compatibility: keep stable mirror targets through heart-triggered commit.',
    'mirrorTargets?: V1MutationMirrorTarget[]',
    "mirrorTargets: buildRecentMirrorTargets([nextCommittedSong], 'upsert')",
]:
    if marker not in patch912:
        raise SystemExit(f'missing 912 compatibility marker: {marker}')
for marker in [
    'Step 2-A4c compatibility: preserve mirrorTargets while removing invalid cache ref.',
    'songs: nextSongs, operation, mirrorTargets',
    "mirrorTargets: buildRecentMirrorTargets([nextCommittedSong], 'upsert')",
]:
    if marker not in patch913:
        raise SystemExit(f'missing 913 compatibility marker: {marker}')

if mode == 'built':
    for marker in [
        'SORIDRAW_910_RECENT_TEXT_BATCH_UNSAVE_FIX',
        'SORIDRAW_912_HEART_TRIGGERED_RECENT_SAVE',
        'SORIDRAW_913_RECENT_SAVE_RUNTIME_FIX',
        'mirrorTargets: pending.mirrorTargets',
        'mirrorTargets?: V1MutationMirrorTarget[]',
        "mirrorTargets: buildRecentMirrorTargets([nextCommittedSong], 'upsert')",
        "import './data/v2PreviewShadowMirror'",
    ]:
        if marker not in app:
            raise SystemExit(f'missing built App marker: {marker}')
    if 'recentSongsCacheRef' in app:
        raise SystemExit('913 invalid recentSongsCacheRef remains in built App')
    print('A4C_BUILT_RUNTIME_CONTRACT=PASS')
elif mode == 'final':
    rows = subprocess.check_output(['git', 'status', '--porcelain'], text=True).splitlines()
    changed = {row[3:] for row in rows if len(row) >= 4}
    expected = {
        'src/App.tsx',
        'src/data/v1MutationBoundary.ts',
        'src/data/indexedDbMirrorOutbox.ts',
        'src/data/v2PreviewShadowMirror.ts',
        '.deploy/apply-910-recent-text-batch-unsave-fix.py',
        '.deploy/apply-912-heart-triggered-recent-save.py',
        '.deploy/apply-913-recent-save-runtime-fix.py',
    }
    if changed != expected:
        raise SystemExit(f'2-A4c final scope mismatch: {sorted(changed)}')
    for protected in ['firestore.rules', 'firestore.indexes.json', 'database.rules.json', 'functions/src/index.ts', 'firebase.json']:
        if subprocess.run(['git', 'diff', '--quiet', 'HEAD', '--', protected]).returncode != 0:
            raise SystemExit(f'protected file changed: {protected}')
    print('A4C_FINAL_SCOPE=PASS')
else:
    print('A4C_STATIC_SAFETY=PASS')

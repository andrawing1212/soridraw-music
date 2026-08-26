from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 anchor, found {count}')
    return source.replace(old, new, 1)


# 910: preserve stable mirror targets through the delayed/local working-copy queue.
path = Path('.deploy/apply-910-recent-text-batch-unsave-fix.py')
text = path.read_text(encoding='utf-8')
compat_marker = '# Step 2-A4c compatibility: preserve mirror targets through the 910 delayed queue.'
if compat_marker not in text:
    marker = 'if MARKER not in app:\n'
    compat = r'''# Step 2-A4c compatibility: preserve mirror targets through the 910 delayed queue.
mirror_boundary_compat_pairs = [
    (
        "await runV1MutationBoundary({ domain: 'recent', operation: 'regenerate', uid: user.uid, affectedCount: 1, mirrorTargets: buildRecentMirrorTargets([nextSong], 'upsert') }, setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true }));\n      markCacheDiagnostic('recentSongs', 'SYNC', 0, 1);",
        "await setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true });\n      markCacheDiagnostic('recentSongs', 'SYNC', 0, 1);",
    ),
    (
        "await runV1MutationBoundary({ domain: 'recent', operation: 'edit', uid: user.uid, affectedCount: 1, mirrorTargets: buildRecentMirrorTargets([nextSong], 'upsert') }, setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true }));\n      markCacheDiagnostic('recentSongs', 'SYNC', 0, 1);",
        "await setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true });\n      markCacheDiagnostic('recentSongs', 'SYNC', 0, 1);",
    ),
    (
        "runV1MutationBoundary({ domain: 'recent', operation: 'pre-favorite-edit', uid: user.uid, affectedCount: 1, mirrorTargets: buildRecentMirrorTargets([nextHistory[currentIndex]], 'upsert') }, setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true }))\n          .then(() => markCacheDiagnostic('recentSongs', 'SYNC', 0, 1))\n          .catch((error) => {",
        "setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true })\n          .then(() => markCacheDiagnostic('recentSongs', 'SYNC', 0, 1))\n          .catch((error) => {",
    ),
]
for boundary_shape, legacy_shape in mirror_boundary_compat_pairs:
    if boundary_shape in app:
        app = app.replace(boundary_shape, legacy_shape, 1)

'''
    text = replace_once(text, marker, compat + marker, '910 2-A4c compatibility insertion')
    pairs = [
        (
            "const recentSongTextWritePendingRef = useRef<{ uid: string; songs: any[]; operation: 'regenerate' | 'edit' | 'pre-favorite-edit' } | null>(null);",
            "const recentSongTextWritePendingRef = useRef<{ uid: string; songs: any[]; operation: 'regenerate' | 'edit' | 'pre-favorite-edit'; mirrorTargets?: V1MutationMirrorTarget[] } | null>(null);",
            '910 pending mirror target type',
        ),
        (
            "await runV1MutationBoundary({ domain: 'recent', operation: pending.operation, uid: pending.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: pending.songs }), { merge: true }));",
            "await runV1MutationBoundary({ domain: 'recent', operation: pending.operation, uid: pending.uid, affectedCount: 1, mirrorTargets: pending.mirrorTargets }, setDoc(ref, sanitizeForFirestore({ songs: pending.songs }), { merge: true }));",
            '910 delayed boundary mirror target',
        ),
        (
            "const queueRecentSongTextWrite = useCallback((uid: string, songs: any[], operation: 'regenerate' | 'edit' | 'pre-favorite-edit') => {",
            "const queueRecentSongTextWrite = useCallback((uid: string, songs: any[], operation: 'regenerate' | 'edit' | 'pre-favorite-edit', mirrorTargets?: V1MutationMirrorTarget[]) => {",
            '910 queue mirror target signature',
        ),
        (
            'recentSongTextWritePendingRef.current = { uid, songs, operation };',
            'recentSongTextWritePendingRef.current = { uid, songs, operation, mirrorTargets };',
            '910 queue mirror target assignment',
        ),
        (
            "queueRecentSongTextWrite(user.uid, nextHistory, 'regenerate');",
            "queueRecentSongTextWrite(user.uid, nextHistory, 'regenerate', buildRecentMirrorTargets([nextSong], 'upsert'));",
            '910 regenerate mirror target',
        ),
        (
            "queueRecentSongTextWrite(user.uid, nextHistory, 'edit');",
            "queueRecentSongTextWrite(user.uid, nextHistory, 'edit', buildRecentMirrorTargets([nextSong], 'upsert'));",
            '910 edit mirror target',
        ),
        (
            "queueRecentSongTextWrite(user.uid, nextHistory, 'pre-favorite-edit');",
            "queueRecentSongTextWrite(user.uid, nextHistory, 'pre-favorite-edit', buildRecentMirrorTargets([nextHistory[currentIndex]], 'upsert'));",
            '910 pre-favorite mirror target',
        ),
    ]
    for old, new, label in pairs:
        text = replace_once(text, old, new, label)
    path.write_text(text, encoding='utf-8')
print('A4C_BUILD_COMPAT_910=PASS')


# 912: text edits stay local until heart; the heart commit carries the exact target.
path912 = Path('.deploy/apply-912-heart-triggered-recent-save.py')
text912 = path912.read_text(encoding='utf-8')
compat912 = '# Step 2-A4c compatibility: keep stable mirror targets through heart-triggered commit.'
if compat912 not in text912:
    text912 = text912.replace(
        "MARKER = 'SORIDRAW_912_HEART_TRIGGERED_RECENT_SAVE'\n",
        "MARKER = 'SORIDRAW_912_HEART_TRIGGERED_RECENT_SAVE'\n\n# Step 2-A4c compatibility: keep stable mirror targets through heart-triggered commit.\n",
        1,
    )
    pairs912 = [
        (
            "queue_old = '''  const queueRecentSongTextWrite = useCallback((uid: string, songs: any[], operation: 'regenerate' | 'edit' | 'pre-favorite-edit') => {",
            "queue_old = '''  const queueRecentSongTextWrite = useCallback((uid: string, songs: any[], operation: 'regenerate' | 'edit' | 'pre-favorite-edit', mirrorTargets?: V1MutationMirrorTarget[]) => {",
            '912 queue_old signature',
        ),
        (
            "    recentSongTextWritePendingRef.current = { uid, songs, operation };\n    if (recentSongTextWriteTimerRef.current !== null) {",
            "    recentSongTextWritePendingRef.current = { uid, songs, operation, mirrorTargets };\n    if (recentSongTextWriteTimerRef.current !== null) {",
            '912 queue_old pending target',
        ),
        (
            "queue_new = '''  const queueRecentSongTextWrite = useCallback((uid: string, songs: any[], operation: 'regenerate' | 'edit' | 'pre-favorite-edit') => {",
            "queue_new = '''  const queueRecentSongTextWrite = useCallback((uid: string, songs: any[], operation: 'regenerate' | 'edit' | 'pre-favorite-edit', mirrorTargets?: V1MutationMirrorTarget[]) => {",
            '912 queue_new signature',
        ),
        (
            '    recentSongTextWritePendingRef.current = { uid, songs: nextSongs, operation };\n  }, []);',
            '    recentSongTextWritePendingRef.current = { uid, songs: nextSongs, operation, mirrorTargets };\n  }, []);',
            '912 queue_new pending target',
        ),
        (
            "            operation: recentSongTextWritePendingRef.current?.operation || 'pre-favorite-edit',\n          };\n          await flushRecentSongTextWrite();",
            "            operation: recentSongTextWritePendingRef.current?.operation || 'pre-favorite-edit',\n            mirrorTargets: buildRecentMirrorTargets([nextCommittedSong], 'upsert'),\n          };\n          await flushRecentSongTextWrite();",
            '912 heart commit mirror target',
        ),
    ]
    for old, new, label in pairs912:
        text912 = replace_once(text912, old, new, label)
    path912.write_text(text912, encoding='utf-8')
print('A4C_BUILD_COMPAT_912=PASS')


# 913: remove only the invalid cache ref while preserving mirrorTargets in both
# old/new replacement anchors.
path913 = Path('.deploy/apply-913-recent-save-runtime-fix.py')
text913 = path913.read_text(encoding='utf-8')
compat913 = '# Step 2-A4c compatibility: preserve mirrorTargets while removing invalid cache ref.'
if compat913 not in text913:
    text913 = text913.replace(
        "MARKER = 'SORIDRAW_913_RECENT_SAVE_RUNTIME_FIX'\n",
        "MARKER = 'SORIDRAW_913_RECENT_SAVE_RUNTIME_FIX'\n\n# Step 2-A4c compatibility: preserve mirrorTargets while removing invalid cache ref.\n",
        1,
    )
    old_edit = 'recentSongTextWritePendingRef.current = { uid, songs: nextSongs, operation };'
    new_edit = 'recentSongTextWritePendingRef.current = { uid, songs: nextSongs, operation, mirrorTargets };'
    if text913.count(old_edit) != 2:
        raise SystemExit(f'913 edit anchor count mismatch: {text913.count(old_edit)}')
    text913 = text913.replace(old_edit, new_edit)

    old_heart = "            operation: recentSongTextWritePendingRef.current?.operation || 'pre-favorite-edit',\n          };"
    new_heart = "            operation: recentSongTextWritePendingRef.current?.operation || 'pre-favorite-edit',\n            mirrorTargets: buildRecentMirrorTargets([nextCommittedSong], 'upsert'),\n          };"
    if text913.count(old_heart) != 2:
        raise SystemExit(f'913 heart anchor count mismatch: {text913.count(old_heart)}')
    text913 = text913.replace(old_heart, new_heart)
    path913.write_text(text913, encoding='utf-8')
print('A4C_BUILD_COMPAT_913=PASS')

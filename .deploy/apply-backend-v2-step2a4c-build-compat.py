from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 anchor, found {count}')
    return source.replace(old, new, 1)


path = Path('.deploy/apply-910-recent-text-batch-unsave-fix.py')
text = path.read_text(encoding='utf-8')

compat_marker = '# Step 2-A4c compatibility: preserve mirror targets through the 910 delayed queue.'
if compat_marker not in text:
    marker = 'if MARKER not in app:\n'
    compat = r'''# Step 2-A4c compatibility: preserve mirror targets through the 910 delayed queue.
# 910 intentionally replaces these three immediate V1 writes with one delayed write;
# normalize their 2-A4c boundary shapes first, then re-attach the exact stable target
# to the delayed V1-first boundary below.
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

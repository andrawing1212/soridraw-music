from pathlib import Path


def replace_exact(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f"{label} simulator anchor mismatch: {count}")
    return source.replace(before, after, 1)


# -----------------------------------------------------------------------------
# 874: Gate A already produced the same TypeScript-safe semantic state.
# Accept either the old shape or the already-correct shape without weakening checks.
# -----------------------------------------------------------------------------
p = Path('.deploy/apply-874-build-safety.py')
s = p.read_text(encoding='utf-8')
old = """if GEMINI_MARKER not in gemini:
    anchor = "    appliedKeywords: { ...(result.appliedKeywords || {}) },"
    replacement = "    appliedKeywords: { ...result.appliedKeywords }, // SORIDRAW_874_BUILD_SAFETY_GEMINI"
    if gemini.count(anchor) != 1:
        raise SystemExit(f'874 gemini AppliedKeywords anchor mismatch: {gemini.count(anchor)}')
    gemini = gemini.replace(anchor, replacement, 1)
    gemini_path.write_text(gemini, encoding='utf-8')
"""
new = """if GEMINI_MARKER not in gemini:
    anchor = "    appliedKeywords: { ...(result.appliedKeywords || {}) },"
    corrected = "    appliedKeywords: { ...result.appliedKeywords },"
    replacement = "    appliedKeywords: { ...result.appliedKeywords }, // SORIDRAW_874_BUILD_SAFETY_GEMINI"
    if gemini.count(anchor) == 1:
        gemini = gemini.replace(anchor, replacement, 1)
        gemini_path.write_text(gemini, encoding='utf-8')
    elif gemini.count(corrected) == 1:
        print('SORIDRAW 874 Gemini fix already present; no-op')
    else:
        raise SystemExit(f'874 gemini semantic state mismatch: old={gemini.count(anchor)} corrected={gemini.count(corrected)}')
"""
s = replace_exact(s, old, new, '874 Gemini')
start = s.index('if APP_MARKER not in app:')
end = s.index("\n\nprint('Applied SORIDRAW 874:", start)
app_block = """if APP_MARKER not in app:
    import re
    old_pattern = re.compile(r":\s*mode === 'pure-pane'\s*\?\s*'pure-pane'\s*:\s*mode === 'pure-pane-hybrid'\s*\?\s*'pure-pane-hybrid'\s*:\s*mode === 'pure-pane-live'")
    corrected_pattern = re.compile(r":\s*mode === 'pure-pane'\s*\?\s*'pure-pane'\s*:\s*mode === 'pure-pane-live'")
    old_matches = list(old_pattern.finditer(app))
    corrected_matches = list(corrected_pattern.finditer(app))
    if len(old_matches) == 1:
        anchor = """ + "'''" + "                            : mode === 'pure-pane'\n                              ? 'pure-pane'\n                              : mode === 'pure-pane-hybrid'\n                                ? 'pure-pane-hybrid'\n                                : mode === 'pure-pane-live'" + "'''" + """
        replacement = """ + "'''" + "                            : mode === 'pure-pane'\n                              ? 'pure-pane'\n                              : mode === 'pure-pane-live' // SORIDRAW_874_BUILD_SAFETY_APP" + "'''" + """
        if app.count(anchor) != 1:
            raise SystemExit(f'874 App exact old anchor mismatch despite semantic match: {app.count(anchor)}')
        app = app.replace(anchor, replacement, 1)
        app_path.write_text(app, encoding='utf-8')
    elif len(corrected_matches) == 1:
        print('SORIDRAW 874 App fix already present; no-op')
    else:
        raise SystemExit(f'874 App semantic state mismatch: old={len(old_matches)} corrected={len(corrected_matches)}')
"""
p.write_text(s[:start] + app_block + s[end:], encoding='utf-8')


# -----------------------------------------------------------------------------
# 901: preserve Step 2-A4b Music Note mutation boundaries while adding 901
# updatedAt/sync-signal behavior.
# -----------------------------------------------------------------------------
p = Path('.deploy/apply-901-music-note-10-incremental-sync.py')
s = p.read_text(encoding='utf-8')
label_pos = s.index("'normal update updatedAtMs'")
call_start = s.rfind('    app = replace_once(', 0, label_pos)
call_end = s.index('\n    )', label_pos) + len('\n    )')
normal_compat = """    old_normal_update = "    try {\\n      await updateDoc(doc(db, 'favorites', id), sanitizedUpdates);\\n      const favoriteUpdatedAtMs = Date.now();"
    normal_update = "    try {\\n      const favoriteUpdatedAtMs = Date.now();\\n      sanitizedUpdates = sanitizeForFirestore({ ...sanitizedUpdates, updatedAtMs: favoriteUpdatedAtMs });\\n      await updateDoc(doc(db, 'favorites', id), sanitizedUpdates);"
    boundary_normal_update = "    try {\\n      await runV1MutationBoundary({ domain: 'musicNote', operation: 'update', uid: user?.uid || currentFavorite?.uid || '', documentIds: [id], affectedCount: 1 }, updateDoc(doc(db, 'favorites', id), sanitizedUpdates));\\n      const favoriteUpdatedAtMs = Date.now();"
    boundary_normal_update_with_version = "    try {\\n      const favoriteUpdatedAtMs = Date.now();\\n      sanitizedUpdates = sanitizeForFirestore({ ...sanitizedUpdates, updatedAtMs: favoriteUpdatedAtMs });\\n      await runV1MutationBoundary({ domain: 'musicNote', operation: 'update', uid: user?.uid || currentFavorite?.uid || '', documentIds: [id], affectedCount: 1 }, updateDoc(doc(db, 'favorites', id), sanitizedUpdates));"
    if app.count(old_normal_update) == 1 and app.count(boundary_normal_update) == 0:
        app = app.replace(old_normal_update, normal_update, 1)
    elif app.count(old_normal_update) == 0 and app.count(boundary_normal_update) == 1:
        app = app.replace(boundary_normal_update, boundary_normal_update_with_version, 1)
        print('SORIDRAW 901 normal update adapted to V1 mutation boundary')
    elif app.count(boundary_normal_update_with_version) == 1:
        print('SORIDRAW 901 normal update updatedAtMs already present; no-op')
    else:
        raise SystemExit('normal update updatedAtMs semantic mismatch')"""
s = s[:call_start] + normal_compat + s[call_end:]
clear_start = s.index('    clear_old = ')
clear_end = s.index("\n\n    app = app.replace(", clear_start)
clear_compat = """    clear_old = "      await batch.commit();\\n      showToast(`${unlockedDocs.length}개의 곡이 삭제되었습니다.`);"
    clear_boundary_old = "      await runV1MutationBoundary({ domain: 'musicNote', operation: 'bulk-delete', uid: user.uid, documentIds: unlockedDocs.map((docSnap) => docSnap.id), affectedCount: unlockedDocs.length }, batch.commit());\\n      showToast(`${unlockedDocs.length}개의 곡이 삭제되었습니다.`);"
    clear_new_body = """ + "'''" + "      const deletedAt = Date.now();\n      const deletedFavorites = unlockedDocs.map(mapFavoriteFirestoreDoc);\n      rememberFavoriteDeletedTombstones(user.uid, deletedFavorites.map((favorite) => favorite.id).filter(Boolean));\n      const deleteSignal = buildFavoriteSyncSignal('delete', deletedFavorites[0] || {}, deletedFavorites, deletedAt);\n      applyFavoriteSyncSignal(user.uid, deleteSignal);\n      await updateDoc(doc(db, 'users', user.uid), {\n        favoriteSyncSignal: deleteSignal,\n        favoriteSyncSignalUpdatedAt: deletedAt,\n        'syncVersions.musicNote': deletedAt,\n      });\n      showToast(`${unlockedDocs.length}개의 곡이 삭제되었습니다.`);" + "'''" + """
    clear_new = "      await batch.commit();\\n" + clear_new_body
    clear_boundary_new = "      await runV1MutationBoundary({ domain: 'musicNote', operation: 'bulk-delete', uid: user.uid, documentIds: unlockedDocs.map((docSnap) => docSnap.id), affectedCount: unlockedDocs.length }, batch.commit());\\n" + clear_new_body
    if app.count(clear_old) == 1 and app.count(clear_boundary_old) == 0:
        app = app.replace(clear_old, clear_new, 1)
    elif app.count(clear_old) == 0 and app.count(clear_boundary_old) == 1:
        app = app.replace(clear_boundary_old, clear_boundary_new, 1)
        print('SORIDRAW 901 clear-all adapted to V1 mutation boundary')
    else:
        raise SystemExit('clear all delete signal semantic mismatch')"""
s = s[:clear_start] + clear_compat + s[clear_end:]
p.write_text(s, encoding='utf-8')


# -----------------------------------------------------------------------------
# 905: accounting must be attached after successful boundary-wrapped Recent writes.
# -----------------------------------------------------------------------------
p = Path('.deploy/apply-905-recent-songs-cache-live-accounting.py')
s = p.read_text(encoding='utf-8')
old_fn = """def replace_all(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count < 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after)
"""
new_fn = r'''def replace_all(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count >= 1:
        return source.replace(before, after)

    diag = "markCacheDiagnostic('recentSongs', 'SYNC', 0, 1);"
    boundary_pairs = {
        'recent songs clear write accounting': [
            ("await runV1MutationBoundary({ domain: 'recent', operation: 'clear', uid: userRef.current.uid, affectedCount: 0 }, setDoc(ref, { songs: [] }, { merge: true }));", "await runV1MutationBoundary({ domain: 'recent', operation: 'clear', uid: userRef.current.uid, affectedCount: 0 }, setDoc(ref, { songs: [] }, { merge: true }));\n          " + diag),
            ("await runV1MutationBoundary({ domain: 'recent', operation: 'clear', uid: user.uid, affectedCount: 0 }, setDoc(ref, { songs: [] }, { merge: true }));", "await runV1MutationBoundary({ domain: 'recent', operation: 'clear', uid: user.uid, affectedCount: 0 }, setDoc(ref, { songs: [] }, { merge: true }));\n          " + diag),
        ],
        'recent songs delete write accounting': [("await runV1MutationBoundary({ domain: 'recent', operation: 'delete-item', uid: user.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: newHistory }), { merge: true }));", "await runV1MutationBoundary({ domain: 'recent', operation: 'delete-item', uid: user.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: newHistory }), { merge: true }));\n        " + diag)],
        'recent songs generation write accounting': [("await runV1MutationBoundary({ domain: 'recent', operation: 'save-batch', uid: user.uid, affectedCount: newSongs.length }, setDoc(ref, sanitizeForFirestore({ songs: updatedSongs }), { merge: true }));", "await runV1MutationBoundary({ domain: 'recent', operation: 'save-batch', uid: user.uid, affectedCount: newSongs.length }, setDoc(ref, sanitizeForFirestore({ songs: updatedSongs }), { merge: true }));\n      " + diag)],
        'recent songs edit write accounting': [
            ("await runV1MutationBoundary({ domain: 'recent', operation: 'regenerate', uid: user.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true }));", "await runV1MutationBoundary({ domain: 'recent', operation: 'regenerate', uid: user.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true }));\n      " + diag),
            ("await runV1MutationBoundary({ domain: 'recent', operation: 'edit', uid: user.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true }));", "await runV1MutationBoundary({ domain: 'recent', operation: 'edit', uid: user.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true }));\n      " + diag),
        ],
        'recent songs async language write accounting': [("runV1MutationBoundary({ domain: 'recent', operation: 'add-lyrics-language', uid: user.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: next }), { merge: true })).catch((error) => {", "runV1MutationBoundary({ domain: 'recent', operation: 'add-lyrics-language', uid: user.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: next }), { merge: true }))\n            .then(() => " + diag.replace(';','') + ")\n            .catch((error) => {")],
        'recent songs async studio edit write accounting': [("runV1MutationBoundary({ domain: 'recent', operation: 'pre-favorite-edit', uid: user.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true })).catch((error) => {", "runV1MutationBoundary({ domain: 'recent', operation: 'pre-favorite-edit', uid: user.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true }))\n          .then(() => " + diag.replace(';','') + ")\n          .catch((error) => {")],
    }
    pairs = boundary_pairs.get(label, [])
    matched = 0
    for old, new in pairs:
        n = source.count(old)
        if n:
            source = source.replace(old, new)
            matched += n
    if matched < 1:
        raise SystemExit(f'{label} anchor mismatch: raw={count} boundary={matched}')
    print(f'SORIDRAW 905 {label} adapted to V1 mutation boundary: {matched}')
    return source
'''
s = replace_exact(s, old_fn, new_fn, '905 replace_all')
p.write_text(s, encoding='utf-8')


# -----------------------------------------------------------------------------
# 910: its debounce helper becomes the one actual V1 write, so that helper must
# stay inside the common boundary. Normalize the three already-wrapped call sites
# only in the script's in-memory source so 910 can replace them with queued writes.
# -----------------------------------------------------------------------------
p = Path('.deploy/apply-910-recent-text-batch-unsave-fix.py')
s = p.read_text(encoding='utf-8')
s = replace_exact(
    s,
    "  const recentSongTextWritePendingRef = useRef<{ uid: string; songs: any[] } | null>(null);",
    "  const recentSongTextWritePendingRef = useRef<{ uid: string; songs: any[]; operation: 'regenerate' | 'edit' | 'pre-favorite-edit' } | null>(null);",
    '910 pending operation',
)
s = replace_exact(
    s,
    "      await setDoc(ref, sanitizeForFirestore({ songs: pending.songs }), { merge: true });",
    "      await runV1MutationBoundary({ domain: 'recent', operation: pending.operation, uid: pending.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: pending.songs }), { merge: true }));",
    '910 flush boundary',
)
s = replace_exact(
    s,
    "  const queueRecentSongTextWrite = useCallback((uid: string, songs: any[]) => {",
    "  const queueRecentSongTextWrite = useCallback((uid: string, songs: any[], operation: 'regenerate' | 'edit' | 'pre-favorite-edit') => {",
    '910 queue signature',
)
s = replace_exact(
    s,
    "    recentSongTextWritePendingRef.current = { uid, songs };",
    "    recentSongTextWritePendingRef.current = { uid, songs, operation };",
    '910 queue payload',
)
queue_call = "queueRecentSongTextWrite(user.uid, nextHistory);"
if s.count(queue_call) != 3:
    raise SystemExit(f'910 queue call count mismatch: {s.count(queue_call)}')
s = s.replace(queue_call, "queueRecentSongTextWrite(user.uid, nextHistory, 'regenerate');", 1)
s = s.replace(queue_call, "queueRecentSongTextWrite(user.uid, nextHistory, 'edit');", 1)
s = s.replace(queue_call, "queueRecentSongTextWrite(user.uid, nextHistory, 'pre-favorite-edit');", 1)

read_anchor = "app = app_path.read_text(encoding='utf-8')\n\n"
compat_code = r'''# M-009 / Step 2-A4b compatibility: 905 has already attached accounting to
# boundary-wrapped writes. 910 replaces these three writes with one queued helper;
# normalize only the shapes that 910 is about to remove. The final helper remains
# boundary-wrapped and preserves the original operation metadata.
boundary_compat_pairs = [
    (
        "await runV1MutationBoundary({ domain: 'recent', operation: 'regenerate', uid: user.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true }));\n      markCacheDiagnostic('recentSongs', 'SYNC', 0, 1);",
        "await setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true });\n      markCacheDiagnostic('recentSongs', 'SYNC', 0, 1);",
    ),
    (
        "await runV1MutationBoundary({ domain: 'recent', operation: 'edit', uid: user.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true }));\n      markCacheDiagnostic('recentSongs', 'SYNC', 0, 1);",
        "await setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true });\n      markCacheDiagnostic('recentSongs', 'SYNC', 0, 1);",
    ),
    (
        "runV1MutationBoundary({ domain: 'recent', operation: 'pre-favorite-edit', uid: user.uid, affectedCount: 1 }, setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true }))\n          .then(() => markCacheDiagnostic('recentSongs', 'SYNC', 0, 1))\n          .catch((error) => {",
        "setDoc(ref, sanitizeForFirestore({ songs: nextHistory }), { merge: true })\n          .then(() => markCacheDiagnostic('recentSongs', 'SYNC', 0, 1))\n          .catch((error) => {",
    ),
]
for boundary_shape, legacy_shape in boundary_compat_pairs:
    if boundary_shape in app:
        app = app.replace(boundary_shape, legacy_shape, 1)

'''
s = replace_exact(s, read_anchor, read_anchor + compat_code, '910 source normalization')
p.write_text(s, encoding='utf-8')

print('M009_DIAGNOSTIC_COMPAT_READY=874,901,905,910')

from pathlib import Path


def replace_n(source: str, before: str, after: str, expected: int, label: str) -> str:
    count = source.count(before)
    if count != expected:
        raise SystemExit(f'{label} simulator anchor mismatch: {count}, expected {expected}')
    return source.replace(before, after)


# 912 follows 910/911. Keep 2-A4b operation metadata while 912 removes the timer.
p = Path('.deploy/apply-912-heart-triggered-recent-save.py')
s = p.read_text(encoding='utf-8')
s = replace_n(
    s,
    "queue_old = '''  const queueRecentSongTextWrite = useCallback((uid: string, songs: any[]) => {",
    "queue_old = '''  const queueRecentSongTextWrite = useCallback((uid: string, songs: any[], operation: 'regenerate' | 'edit' | 'pre-favorite-edit') => {",
    1,
    '912 queue_old signature',
)
s = replace_n(
    s,
    "queue_new = '''  const queueRecentSongTextWrite = useCallback((uid: string, songs: any[]) => {",
    "queue_new = '''  const queueRecentSongTextWrite = useCallback((uid: string, songs: any[], operation: 'regenerate' | 'edit' | 'pre-favorite-edit') => {",
    1,
    '912 queue_new signature',
)
s = replace_n(s, 'recentSongTextWritePendingRef.current = { uid, songs };', 'recentSongTextWritePendingRef.current = { uid, songs, operation };', 1, '912 queue_old pending')
s = replace_n(s, 'recentSongTextWritePendingRef.current = { uid, songs: nextSongs };', 'recentSongTextWritePendingRef.current = { uid, songs: nextSongs, operation };', 1, '912 queue_new pending')
heart_pending = '''          recentSongTextWritePendingRef.current = {\n            uid: user.uid,\n            songs: nextCommittedHistory,\n          };'''
heart_pending_op = '''          recentSongTextWritePendingRef.current = {\n            uid: user.uid,\n            songs: nextCommittedHistory,\n            operation: recentSongTextWritePendingRef.current?.operation || 'pre-favorite-edit',\n          };'''
s = replace_n(s, heart_pending, heart_pending_op, 1, '912 heart pending')
p.write_text(s, encoding='utf-8')


# 913 stores replacement templates with literal \n escapes, so preserve those
# characters while adapting both the before/after heart templates.
p = Path('.deploy/apply-913-recent-save-runtime-fix.py')
s = p.read_text(encoding='utf-8')
s = replace_n(
    s,
    'recentSongTextWritePendingRef.current = { uid, songs: nextSongs };',
    'recentSongTextWritePendingRef.current = { uid, songs: nextSongs, operation };',
    2,
    '913 edit pending literals',
)
heart_tail = r"            songs: nextCommittedHistory,\n          };"
heart_tail_op = r"            songs: nextCommittedHistory,\n            operation: recentSongTextWritePendingRef.current?.operation || 'pre-favorite-edit',\n          };"
s = replace_n(s, heart_tail, heart_tail_op, 2, '913 heart pending literals')
p.write_text(s, encoding='utf-8')

print('M009_LATE_COMPAT_READY=912,913')

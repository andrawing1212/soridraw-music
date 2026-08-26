from pathlib import Path
import re

path = Path('.deploy/apply-backend-v2-step2a4c-build-compat.py')
text = path.read_text(encoding='utf-8')
pattern = re.compile(
    r'''    old_heart = .*?\n'''
    r'''    new_heart = .*?\n'''
    r'''    if text913\.count\(old_heart\) != 2:\n'''
    r'''        raise SystemExit\(f'913 heart anchor count mismatch: \{text913\.count\(old_heart\)\}'\)\n'''
    r'''    text913 = text913\.replace\(old_heart, new_heart\)''',
    re.S,
)
replacement = '''    old_heart = "operation: recentSongTextWritePendingRef.current?.operation || 'pre-favorite-edit',"\n    new_heart = old_heart + "\\n            mirrorTargets: buildRecentMirrorTargets([nextCommittedSong], 'upsert'),"\n    if text913.count(old_heart) != 2:\n        raise SystemExit(f'913 heart anchor count mismatch: {text913.count(old_heart)}')\n    text913 = text913.replace(old_heart, new_heart)'''
# Use a callable replacement so re.sub does not reinterpret backslash escapes.
text2, count = pattern.subn(lambda _match: replacement, text, count=1)
if count != 1:
    raise SystemExit(f'913 compat self-fix anchor mismatch: {count}')
path.write_text(text2, encoding='utf-8')
print('A4C_COMPAT_SELF_FIX_913=PASS')

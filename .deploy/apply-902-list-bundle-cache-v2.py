from pathlib import Path

base_path = Path('.deploy/apply-902-list-bundle-cache.py')
source = base_path.read_text(encoding='utf-8')

old = r'''        r"(?P<block>        const q = query\(\n          collection\(db, 'favorites'\),.*?\n        \}\);\n)(?=\n        const runFavoritesFullCacheRecoveryOnce)",'''
new = r'''        r"(?P<block>        const q = query\(.*?)(?=\n        const runFavoritesFullCacheRecoveryOnce)",'''

if old not in source:
    raise SystemExit('902 v2 source-pattern hotfix anchor missing')
source = source.replace(old, new, 1)

old_fail = "    if not match:\n        raise SystemExit('Music Note source bootstrap block missing')"
new_fail = "    if not match:\n        marker_pos = app.find('const runFavoritesFullCacheRecoveryOnce')\n        print('902 DEBUG MUSIC NOTE AROUND RECOVERY START')\n        print(app[max(0, marker_pos - 5000): marker_pos + 500])\n        print('902 DEBUG MUSIC NOTE AROUND RECOVERY END')\n        raise SystemExit('Music Note source bootstrap block missing')"
if old_fail not in source:
    raise SystemExit('902 v2 debug anchor missing')
source = source.replace(old_fail, new_fail, 1)

exec(compile(source, str(base_path), 'exec'), {'__name__': '__main__'})

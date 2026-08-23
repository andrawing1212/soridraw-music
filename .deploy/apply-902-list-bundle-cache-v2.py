from pathlib import Path

base_path = Path('.deploy/apply-902-list-bundle-cache.py')
source = base_path.read_text(encoding='utf-8')

old = r'''        r"(?P<block>        const q = query\(\n          collection\(db, 'favorites'\),.*?\n        \}\);\n)(?=\n        const runFavoritesFullCacheRecoveryOnce)",'''
new = r'''        r"(?P<block>        const q = query\(.*?)(?=\n        const runFavoritesFullCacheRecoveryOnce)",'''

if old not in source:
    raise SystemExit('902 v2 source-pattern hotfix anchor missing')
source = source.replace(old, new, 1)

exec(compile(source, str(base_path), 'exec'), {'__name__': '__main__'})

from pathlib import Path

app = Path('src/App.tsx').read_text(encoding='utf-8')

def dump(label: str, needle: str, before: int = 900, after: int = 2600):
    pos = app.find(needle)
    print(f'--- 918C DIAG {label} pos={pos} ---')
    if pos >= 0:
        print(app[max(0, pos-before):pos+after])

for label, needle in [
    ('mapFavoriteDoc', 'const mapFavoriteFirestoreDoc'),
    ('writeFavoritesCache', 'const writeFavoritesCache'),
    ('mergeFavoritePages', 'const mergeFavoritePages'),
    ('updateFavoriteCatch', "} catch (error: any) {\n      const code = String(error?.code || '');"),
    ('recoveryLookup', 'const recoverMissingFavoriteUpdateTargets'),
]:
    dump(label, needle)

print('SORIDRAW 918C diagnostic only: no runtime changes.')

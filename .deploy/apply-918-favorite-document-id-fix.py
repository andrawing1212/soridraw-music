from pathlib import Path

app = Path('src/App.tsx').read_text(encoding='utf-8')
favorites = Path('src/pages/FavoritesPage.tsx').read_text(encoding='utf-8')

def dump(label: str, source: str, needle: str, before: int = 1800, after: int = 2600):
    pos = source.find(needle)
    print(f'--- 918 DIAG {label} pos={pos} ---')
    if pos >= 0:
        print(source[max(0, pos-before):pos+after])

for label, needle in [
    ('favoriteDeleteId', 'const favoriteDeleteId'),
    ('updateFavorite', 'const updateFavorite'),
    ('newFavoriteRef', 'newFavoriteRef'),
    ('addDocFavorites', "addDoc(collection(db, 'favorites')"),
    ('favoritePayload', 'favoritePayload'),
    ('toggleFavorite', 'const toggleFavorite'),
]:
    dump(label, app, needle)

dump('trash', favorites, 'const moveSongsToFavoriteTrash')
dump('documentId', favorites, 'const getFavoriteDocumentId')
print('SORIDRAW 918 diagnostic only: no runtime changes.')

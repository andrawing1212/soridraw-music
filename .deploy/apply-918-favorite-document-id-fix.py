from pathlib import Path

app = Path('src/App.tsx').read_text(encoding='utf-8')
favorites = Path('src/pages/FavoritesPage.tsx').read_text(encoding='utf-8')

def dump(label: str, source: str, needle: str, before: int = 700, after: int = 1800):
    pos = source.find(needle)
    print(f'--- 918B DIAG {label} pos={pos} ---')
    if pos >= 0:
        print(source[max(0, pos-before):pos+after])

for label, needle in [
    ('existingFav', 'const existingFav ='),
    ('unsaveTargets', 'const unsaveTargets'),
    ('unsaveUpdate1', "updateDoc(doc(db, 'favorites', favoriteDeleteId"),
    ('unsaveUpdate2', "updateDoc(doc(db, 'favorites', existingFav.id"),
    ('updateFavoriteWrite', "await updateDoc(doc(db, 'favorites', id), sanitizedUpdates)"),
    ('updateFavoriteCatch', 'looksLikeMissingOrBadLocalFavorite'),
    ('mapFavoriteDoc', 'const mapFavoriteFirestoreDoc'),
]:
    dump(label, app, needle)

dump('trash', favorites, 'const moveSongsToFavoriteTrash')
dump('restore', favorites, 'const restoreSongsFromFavoriteTrash')
dump('docid', favorites, 'const getFavoriteDocumentId')
print('SORIDRAW 918B diagnostic only: no runtime changes.')

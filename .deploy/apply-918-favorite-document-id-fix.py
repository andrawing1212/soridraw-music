from pathlib import Path

app = Path('src/App.tsx').read_text(encoding='utf-8')
favorites = Path('src/pages/FavoritesPage.tsx').read_text(encoding='utf-8')

needle = 'favoritesStore.setFavorites'
start = 0
count = 0
while True:
    pos = app.find(needle, start)
    if pos < 0:
        break
    count += 1
    print(f'--- 918D STORE SYNC #{count} pos={pos} ---')
    print(app[max(0,pos-700):pos+1000])
    start = pos + len(needle)
print(f'918D total store sync calls={count}')

for label, source, needle2 in [
    ('trash', favorites, 'const moveSongsToFavoriteTrash'),
    ('restore', favorites, 'const restoreSongsFromFavoriteTrash'),
    ('docid', favorites, 'const getFavoriteDocumentId'),
]:
    pos=source.find(needle2)
    print(f'--- 918D {label} pos={pos} ---')
    if pos>=0: print(source[max(0,pos-500):pos+2200])

print('SORIDRAW 918D diagnostic only: no runtime changes.')

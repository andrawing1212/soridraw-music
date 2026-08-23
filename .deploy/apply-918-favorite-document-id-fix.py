from pathlib import Path

app = Path('src/App.tsx').read_text(encoding='utf-8')
for label, needle in [
    ('getStudioFavoriteSaveSnapshot', 'const getStudioFavoriteSaveSnapshot'),
    ('toggleCurrentStudioFavorite', 'const toggleCurrentStudioFavorite'),
    ('getFavoriteDocumentIdApp', 'favoriteFirestoreId'),
]:
    pos=app.find(needle)
    print(f'--- 918E {label} pos={pos} ---')
    if pos>=0: print(app[max(0,pos-1200):pos+4200])
print('SORIDRAW 918E diagnostic only: no runtime changes.')

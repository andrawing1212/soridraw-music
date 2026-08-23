from pathlib import Path
app=Path('src/App.tsx').read_text(encoding='utf-8')
for label,needle in [
 ('buildFavoriteSyncSignal','const buildFavoriteSyncSignal'),
 ('removeLocalFavorite','const removeLocalFavorite ='),
 ('patchFavoriteCache','const patchFavoriteCacheImmediately'),
 ('handleFirestoreError','const handleFirestoreError'),
]:
 pos=app.find(needle)
 print(f'--- 918F {label} pos={pos} ---')
 if pos>=0: print(app[max(0,pos-1000):pos+5000])
print('SORIDRAW 918F diagnostic only: no runtime changes.')

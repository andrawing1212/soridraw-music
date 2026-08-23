from pathlib import Path

app = Path('src/App.tsx').read_text(encoding='utf-8')
needle = 'saveRecentSongsCache'
positions = []
start = 0
while True:
    pos = app.find(needle, start)
    if pos < 0:
        break
    positions.append(pos)
    start = pos + len(needle)

print(f'--- 919 DIAG saveRecentSongsCache occurrences={len(positions)} ---')
for index, pos in enumerate(positions, 1):
    print(f'--- 919 DIAG #{index} pos={pos} ---')
    print(app[max(0, pos-900):pos+1400])

print('SORIDRAW 919 diagnostic only: inspect recent-song cache payload shape.')

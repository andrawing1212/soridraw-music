from pathlib import Path
import re

READ_APIS = ('getDoc(', 'getDocFromServer(', 'getDocs(', 'onSnapshot(')
WRITE_APIS = ('setDoc(', 'updateDoc(', 'deleteDoc(', 'addDoc(', 'writeBatch(')

print('--- SORIDRAW 920 FIRESTORE RUNTIME AUDIT START ---')
for path in sorted(Path('src').rglob('*')):
    if path.suffix not in {'.ts', '.tsx'}:
        continue
    try:
        text = path.read_text(encoding='utf-8')
    except Exception:
        continue
    hits = []
    for api in READ_APIS + WRITE_APIS:
        start = 0
        while True:
            pos = text.find(api, start)
            if pos < 0:
                break
            line = text.count('\n', 0, pos) + 1
            snippet = re.sub(r'\s+', ' ', text[max(0, pos-180):pos+260]).strip()
            hits.append((line, api[:-1], snippet))
            start = pos + len(api)
    if hits:
        print(f'--- {path} hits={len(hits)} ---')
        for line, api, snippet in sorted(hits):
            print(f'{path}:{line} [{api}] {snippet}')

app_lines = Path('src/App.tsx').read_text(encoding='utf-8').splitlines()
for start, end, label in [
    (8380, 8820, 'APP FAVORITES BOOTSTRAP'),
    (9190, 9310, 'APP FAVORITE LOOKUP'),
]:
    print(f'--- SORIDRAW 920 {label} {start}-{end} ---')
    for line_no in range(start, min(end, len(app_lines)) + 1):
        print(f'{line_no}: {app_lines[line_no-1]}')

lib_lines = Path('src/pages/SunoLibraryPage.tsx').read_text(encoding='utf-8').splitlines()
print('--- SORIDRAW 920 LIBRARY BOOTSTRAP 170-320 ---')
for line_no in range(170, min(320, len(lib_lines)) + 1):
    print(f'{line_no}: {lib_lines[line_no-1]}')

print('--- SORIDRAW 920 FIRESTORE RUNTIME AUDIT END ---')

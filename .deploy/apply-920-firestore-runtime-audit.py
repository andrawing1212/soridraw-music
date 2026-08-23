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
print('--- SORIDRAW 920 FIRESTORE RUNTIME AUDIT END ---')

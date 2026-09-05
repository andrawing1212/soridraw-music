from pathlib import Path
p=Path('.deploy/apply-1021-refresh-zero-firestore-listeners.py')
s=p.read_text(encoding='utf-8')
checks=[
    ('items: current.items,','items: snapshot.items,',2),
    ('updatedAtMs: current.updatedAtMs,','updatedAtMs: snapshot.updatedAtMs,',2),
    ('Object.keys(current.items).length','Object.keys(snapshot.items).length',1),
]
for old,new,expected in checks:
    count=s.count(old)
    if count!=expected:
        raise SystemExit(f'fix-1021 anchor {old!r}: expected {expected}, found {count}')
    s=s.replace(old,new)
p.write_text(s,encoding='utf-8')
print('fix-1021: card-state anchor updated to exit-only snapshot writer')

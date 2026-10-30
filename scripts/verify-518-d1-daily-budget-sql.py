"""Local sqlite enforcement proof: same ledger, all owners, legacy reservations.
No Cloudflare account or user data. Actual cross-database/old-writer
account-wide coverage still REQUIRES release attestation.
"""
import sqlite3
from pathlib import Path

db=sqlite3.connect(':memory:')
migration=Path('cloudflare/media-worker/migrations/518_music_note_catalog_daily_write_budget.sql').read_text()
db.executescript(migration)
sql=('INSERT INTO music_note_catalog_daily_budget_518 '
     '(day_utc,reserved_rows,updated_at_ms) '
     'SELECT ?,?,? WHERE ?<=? '
     'ON CONFLICT(day_utc) DO UPDATE SET '
     'reserved_rows=reserved_rows+excluded.reserved_rows, '
     'updated_at_ms=excluded.updated_at_ms '
     'WHERE reserved_rows+excluded.reserved_rows<=?')
def reserve(day, n, cap=80000):
    assert 0<n<=2049
    return db.execute(sql,(day,n,1000,n,cap,cap)).rowcount
def used(day):
    row=db.execute('SELECT reserved_rows FROM music_note_catalog_daily_budget_518 WHERE day_utc=?',(day,)).fetchone()
    return row[0] if row else 0

# One 50,001-song owner: 49 full invocations reserving 1,041 rows.
# Other owners and every legacy writer compete for the same daily ceiling.
day='2026-10-30'
for _ in range(49): assert reserve(day,1041)==1
assert used(day)==49*1041
# A legacy writer consumes 2,000 rows of the SAME verified pool.
assert reserve(day,2000)==1
assert used(day)==53009
# A second 50k owner is stopped BEFORE it can write all 50k index rows.
ok=0
for _ in range(49):
    if reserve(day,1041): ok+=1
    else: break
assert ok<49
assert used(day)<=80000
assert reserve(day,1041)==0
# Repeated rejected attempts must not change the ledger.
previous=used(day)
for _ in range(10): assert reserve(day,1041)==0
assert used(day)==previous
# After midnight the new day starts independently; old account usage remains.
assert reserve('2026-10-31',1041)==1
assert used(day)==previous and used('2026-10-31')==1041
print('APP518_D1_FREE_GLOBAL_PER_DAY_ALL_OWNER_AND_LEGACY_SQL=PASS')
print('APP518_D1_FREE_SECOND_50K_OWNER_HOLD_BEFORE_ROWS=PASS')

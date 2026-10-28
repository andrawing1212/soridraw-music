#!/usr/bin/env python3
"""Run the real app518 first-change D1 schema and SQL in sqlite memory, never cloud."""
import pathlib
import sqlite3
root=pathlib.Path(__file__).resolve().parents[1]
schema=(root/"cloudflare/media-worker/migrations/518_music_note_catalog_first_change_index.sql").read_text()
db=sqlite3.connect(":memory:")
db.executescript(schema)
uid="owner-A";gen=1793;etag='"verified-r2-etag"';ids=["song-%d"%i for i in range(301)]
def ch(sql,args):
    before=db.total_changes
    db.execute(sql,args)
    return db.total_changes-before
meta="SELECT generation,expected_count,head_etag,status FROM music_note_catalog_index_meta_518 WHERE owner_uid=?"
begin="INSERT OR IGNORE INTO music_note_catalog_index_meta_518 (owner_uid,generation,expected_count,head_etag,status,checked_at_ms) VALUES (?, ?, ?, ?, 'building', ?)"
stage="INSERT OR IGNORE INTO music_note_catalog_member_518 (owner_uid,generation,favorite_id) VALUES (?, ?, ?)"
count="SELECT COUNT(*) FROM music_note_catalog_member_518 WHERE owner_uid=? AND generation=?"
ready="UPDATE music_note_catalog_index_meta_518 SET status='ready',checked_at_ms=? WHERE owner_uid=? AND generation=? AND expected_count=? AND head_etag=? AND status='building'"
exact="SELECT 1 AS present FROM music_note_catalog_member_518 WHERE owner_uid=? AND generation=? AND favorite_id=?"
assert ch(begin,(uid,gen,len(ids),etag,1000))==1
assert ch(begin,(uid,gen,len(ids),etag,1000))==0
assert db.execute(meta,(uid,)).fetchone()[-1]=="building"
# A crash after 128 entries cannot make the index visible as READY.
for i in range(128):
    assert ch(stage,(uid,gen,ids[i]))==1
assert db.execute(count,(uid,gen)).fetchone()[0]==128
assert db.execute(meta,(uid,)).fetchone()[-1]=="building"
# Resume staging in 128-record chunks; OR IGNORE makes retries cheap.
for i in range(301):
    expect=0 if i<128 else 1
    assert ch(stage,(uid,gen,ids[i]))==expect
assert db.execute(count,(uid,gen)).fetchone()[0]==301
assert ch(ready,(2000,uid,gen,300,etag))==0,"wrong itemCount cannot finalize"
assert ch(ready,(2000,uid,gen,301,'"stale"'))==0,"stale etag cannot finalize"
assert ch(ready,(2000,uid,gen,301,etag))==1
assert ch(ready,(2001,uid,gen,301,etag))==0
assert db.execute(exact,(uid,gen,"song-300")).fetchone()[0]==1
assert db.execute(exact,(uid,gen,"missing-song")).fetchone() is None
assert db.execute(exact,("other-owner",gen,"song-300")).fetchone() is None
assert db.execute(count,(uid,gen)).fetchone()[0]==301
plan=" ".join(str(x[3]) for x in db.execute("EXPLAIN QUERY PLAN "+exact,(uid,gen,"song-300")))
assert "PRIMARY KEY" in plan or "INDEX" in plan,plan
forbidden=["lyrics","prompt","audio","media","title"]
for token in forbidden:assert token not in schema.lower(),"song contents should never be indexed"
print("APP518_D1_EXACT_INDEX_SQL_PARTIAL_CRASH_RESUME=PASS")
print("APP518_D1_INDEX_WRONG_ETAG_AND_REVISION_FINALIZE_DENIED=PASS")
print("APP518_D1_INDEX_OWNER_ISOLATION_AND_PRIMARY_KEY_COST=PASS")
print("APP518_D1_FIRST_INDEX_W_N_PLUS_TWO=303")
print("APP518_D1_INDEX_SQL_LIVE_CLOUD_WRITES=ZERO")

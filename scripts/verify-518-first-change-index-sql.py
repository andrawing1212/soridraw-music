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
meta="SELECT generation,indexed_revision,expected_count,head_etag,status FROM music_note_catalog_index_meta_518 WHERE owner_uid=?"
begin="INSERT OR IGNORE INTO music_note_catalog_index_meta_518 (owner_uid,generation,indexed_revision,expected_count,head_etag,status,checked_at_ms) VALUES (?, ?, ?, ?, ?, 'building', ?)"
stage="INSERT OR IGNORE INTO music_note_catalog_member_518 (owner_uid,generation,favorite_id) VALUES (?, ?, ?)"
count="SELECT COUNT(*) FROM music_note_catalog_member_518 WHERE owner_uid=? AND generation=?"
ready="UPDATE music_note_catalog_index_meta_518 SET status='ready',checked_at_ms=? WHERE owner_uid=? AND generation=? AND expected_count=? AND head_etag=? AND status='building'"
exact="SELECT 1 AS present FROM music_note_catalog_member_518 WHERE owner_uid=? AND generation=? AND favorite_id=?"
assert ch(begin,(uid,gen,gen,len(ids),etag,1000))==1
assert ch(begin,(uid,gen,gen,len(ids),etag,1000))==0
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
# An abandoned building generation can rotate to a newer, proven HEAD,
# but never modify an existing READY generation or a foreign owner's rows.
rotate=("UPDATE music_note_catalog_index_meta_518 "
 "SET generation=?,indexed_revision=?,expected_count=?,head_etag=?,"
 "checked_at_ms=?,restart_count=restart_count+1 "
 "WHERE owner_uid=? AND generation=? AND indexed_revision=? "
 "AND expected_count=? AND head_etag=? AND status='building' "
 "AND restart_count<3 AND checked_at_ms<=?")
other="owner-B"
assert ch(begin,(other,300,300,1,'"old"',100))==1
assert ch(stage,(other,300,"old-song"))==1
assert ch(rotate,(301,301,1,'"new"',60100,uid,300,300,1,'"old"',100))==0
assert ch(rotate,(301,301,1,'"new"',200,other,300,300,1,'"old"',-59800))==0
assert ch(rotate,(301,301,1,'"new"',60100,other,300,300,1,'"old"',100))==1
assert db.execute(count,(other,300)).fetchone()[0]==1
assert db.execute(count,(other,301)).fetchone()[0]==0
assert ch(rotate,(302,302,1,'"v2"',120100,other,301,301,1,'"new"',60100))==1
assert ch(rotate,(303,303,1,'"v3"',180100,other,302,302,1,'"v2"',120100))==1
assert ch(rotate,(304,304,1,'"v4"',240100,other,303,303,1,'"v3"',180100))==0
assert db.execute("SELECT restart_count,status,generation FROM music_note_catalog_index_meta_518 WHERE owner_uid=?",(other,)).fetchone()==(3,"building",303)
assert db.execute(meta,(uid,)).fetchone()==(gen,gen,301,etag,"ready")
plan=" ".join(str(x[3]) for x in db.execute("EXPLAIN QUERY PLAN "+exact,(uid,gen,"song-300")))
assert "PRIMARY KEY" in plan or "INDEX" in plan,plan
forbidden=["lyrics","prompt","audio","media","title"]
for token in forbidden:assert token not in schema.lower(),"song contents should never be indexed"
print("APP518_D1_EXACT_INDEX_SQL_PARTIAL_CRASH_RESUME=PASS")
print("APP518_D1_INDEX_WRONG_ETAG_AND_REVISION_FINALIZE_DENIED=PASS")
print("APP518_D1_INDEX_OWNER_ISOLATION_AND_PRIMARY_KEY_COST=PASS")
print("APP518_D1_FIRST_INDEX_W_N_PLUS_TWO=303")
print("APP518_D1_STALE_BUILDING_ROTATION_SQL_SAFE_AND_BOUNDED=PASS")
print("APP518_D1_INDEX_SQL_LIVE_CLOUD_WRITES=ZERO")

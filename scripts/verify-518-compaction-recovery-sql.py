#!/usr/bin/env python3
"""Execute actual compaction recovery D1 SQL on SQLite in-memory; no Cloudflare calls."""
import ast,pathlib,re,sqlite3,json
root=pathlib.Path(__file__).resolve().parents[1]
sql=(root/"cloudflare/media-worker/migrations/518_music_note_catalog_first_change_index.sql").read_text()
source=(root/"cloudflare/media-worker/src/catalogCompactionRecovery518.js").read_text()
def extract(name):
 m=re.search(r"export const "+name+r"=\[([\s\S]*?)\]\.join\(' '\);",source)
 assert m,name
 return ' '.join(ast.literal_eval(x.strip().rstrip(',')) for x in m.group(1).splitlines() if x.strip())
claim=extract("RECOVERY_CLAIM_518")
rotate=extract("RECOVERY_ROTATE_518")
promote=extract("RECOVERY_PROMOTE_518")
recovery_bulk=extract("RECOVERY_MEMBER_BULK_STAGE_GUARDED_518")
db=sqlite3.connect(":memory:")
db.executescript(sql)
uid="only-owner"
def changes(query,args):
 before=db.total_changes
 db.execute(query,args)
 return db.total_changes-before
db.execute("INSERT INTO music_note_catalog_index_meta_518(owner_uid,generation,indexed_revision,expected_count,head_etag,status,checked_at_ms) VALUES(?,?,?,?,?,'ready',?)",
 (uid,90,100,1,'"old"',1000))
db.execute("INSERT INTO music_note_catalog_member_518 VALUES (?,?,?)",(uid,90,"before"))
assert changes(claim,(110,110,'"new"',2,1000,"attacker",90,100,'"old"'))==0
assert changes(claim,(110,110,'"new"',2,1000,uid,90,100,'"stale"'))==0
assert changes(claim,(110,110,'"new"',2,1000,uid,90,100,'"old"'))==1
assert changes(claim,(110,110,'"new"',2,1000,uid,90,100,'"old"'))==0
assert db.execute("SELECT generation,status FROM music_note_catalog_index_meta_518 WHERE owner_uid=?",(uid,)).fetchone()==(90,'ready')
# The new HEAD may rotate only the uncommitted generation, once per
# cooldown window and at most 3 times. All predicates are owner+old-HEAD CAS.
assert changes(rotate,(111,111,'"next"',2,1010,uid,90,100,'"old"',110,110,'"new"',2,400))==0
assert changes(rotate,(111,111,'"next"',2,61001,"attacker",90,100,'"old"',110,110,'"new"',2,1000))==0
assert changes(rotate,(111,111,'"next"',2,61001,uid,90,100,'"old"',110,110,'"stale"',2,1000))==0
assert changes(rotate,(111,111,'"next"',2,61001,uid,90,100,'"old"',110,110,'"new"',2,1000))==1
assert db.execute("SELECT recovery_generation,recovery_restart_count,recovery_checked_at_ms FROM music_note_catalog_index_meta_518 WHERE owner_uid=?",(uid,)).fetchone()==(111,1,61001)
assert changes(rotate,(112,112,'"new2"',2,121002,uid,90,100,'"old"',111,111,'"next"',2,61001))==1
assert changes(rotate,(113,113,'"new3"',2,181003,uid,90,100,'"old"',112,112,'"new2"',2,121002))==1
assert changes(rotate,(114,114,'"new4"',2,241004,uid,90,100,'"old"',113,113,'"new3"',2,181003))==0
assert db.execute("SELECT recovery_restart_count,generation,status FROM music_note_catalog_index_meta_518 WHERE owner_uid=?",(uid,)).fetchone()==(3,90,'ready')

for song_id in ("fresh-a","fresh-b"):
 assert changes(recovery_bulk,(uid,113,json.dumps([song_id]),uid,113,113,'"new3"',2))==1
assert changes(recovery_bulk,(uid,113,json.dumps(["fresh-a"]),uid,113,113,'"new3"',2))==0
# The app's existing D1 membership lookup still sees the old generation while staging.
assert db.execute("SELECT favorite_id FROM music_note_catalog_member_518 WHERE owner_uid=? AND generation=?",(uid,90)).fetchall()==[("before",)]
assert changes(promote,(2000,uid,90,100,'"old"',113,113,'"stale"',2))==0
assert changes(promote,(2000,"attacker",90,100,'"old"',113,113,'"new3"',2))==0
assert changes(promote,(2000,uid,90,100,'"old"',113,113,'"new3"',2))==1
assert changes(promote,(2001,uid,90,100,'"old"',113,113,'"new3"',2))==0
assert changes(recovery_bulk,(uid,113,json.dumps(["stale-resurrect"]),uid,113,113,'"new3"',2))==0
assert db.execute("SELECT 1 FROM music_note_catalog_member_518 WHERE owner_uid=? AND generation=? AND favorite_id=?",(uid,113,"stale-resurrect")).fetchone() is None
meta=db.execute("SELECT generation,indexed_revision,expected_count,head_etag,recovery_generation,status FROM music_note_catalog_index_meta_518 WHERE owner_uid=?",(uid,)).fetchone()
assert meta==(113,113,2,'"new3"',None,'ready')
assert db.execute("SELECT count(*) FROM music_note_catalog_member_518 WHERE owner_uid=? AND generation=?",(uid,113)).fetchone()[0]==2
assert db.execute("SELECT count(*) FROM music_note_catalog_member_518 WHERE owner_uid=? AND generation=?",(uid,90)).fetchone()[0]==1
# The old generation is preserved, but is no longer visible through meta.
assert db.execute("SELECT favorite_id FROM music_note_catalog_member_518 WHERE owner_uid=? AND generation=?",(uid,meta[0])).fetchall()==[("fresh-a",),("fresh-b",)]
print("APP518_COMPACTION_ROTATE_SQL_OWNER_COOLDOWN_AND_BUDGET=PASS")
print("APP518_RECOVERY_SQL_OWNER_AND_OLD_HEAD_CAS=PASS")
print("APP518_RECOVERY_STAGE_INVISIBLE_UNTIL_GUARDED_PROMOTION=PASS")
print("APP518_RECOVERY_NO_USER_DATA_OR_LIVE_D1_IO=PASS")

# Real SQLite JSON1 bulk membership import on the exact new schema. 20,001
# is above the historical hard cap. Duplicate pages must not double-write;
# staging stays invisible until the exact HEAD is promoted by SQL CAS.
index_source=(root/"cloudflare/media-worker/src/catalogFirstChangeIndex518.js").read_text()
source=index_source
bulk=extract("INDEX_MEMBER_BULK_STAGE_518")
mark_ready=extract("INDEX_MARK_READY_518")
large_uid="owner-over-20k"
large_size=20001
db.execute("INSERT INTO music_note_catalog_index_meta_518(owner_uid,generation,indexed_revision,expected_count,head_etag,status,checked_at_ms) VALUES(?,?,?,?,?,'building',?)",
 (large_uid,300,300,large_size,'"large-head"',1000))
sql_calls=0
for start in range(0,large_size,512):
 ids=["song-"+str(i) for i in range(start,min(start+512,large_size))]
 assert changes(bulk,(large_uid,300,json.dumps(ids),large_uid,300,300,'"large-head"',large_size))==len(ids)
 sql_calls+=1
assert sql_calls==40
assert changes(bulk,(large_uid,300,json.dumps(["song-0","song-511"]),large_uid,300,300,'"large-head"',large_size))==0
assert db.execute("SELECT expected_count,status FROM music_note_catalog_index_meta_518 WHERE owner_uid=?",(large_uid,)).fetchone()==(large_size,'building')
assert db.execute("SELECT count(*) FROM music_note_catalog_member_518 WHERE owner_uid=? AND generation=?",(large_uid,300)).fetchone()[0]==large_size
assert changes(mark_ready,(1100,large_uid,300,large_size,'"wrong-head"'))==0
assert changes(mark_ready,(1100,"attacker",300,large_size,'"large-head"'))==0
assert changes(mark_ready,(1100,large_uid,300,large_size,'"large-head"'))==1
assert changes(mark_ready,(1101,large_uid,300,large_size,'"large-head"'))==0
assert changes(bulk,(large_uid,300,json.dumps(["stale-after-READY"]),large_uid,300,300,'"large-head"',large_size))==0
assert db.execute("SELECT 1 FROM music_note_catalog_member_518 WHERE owner_uid=? AND favorite_id=?",(large_uid,"stale-after-READY")).fetchone() is None
assert db.execute("SELECT status FROM music_note_catalog_index_meta_518 WHERE owner_uid=?",(large_uid,)).fetchone()==('ready',)
assert db.execute("SELECT count(*) FROM music_note_catalog_member_518 WHERE owner_uid=? AND generation=?",(uid,113)).fetchone()[0]==2
print("APP518_20001_SQLITE_JSON1_IMPORT_COUNT_CAS_AND_IDEMPOTENCE=PASS")

print('APP518_REAL_SQLITE_LATE_FIRST_AND_RECOVERY_INSERT_W0=PASS')

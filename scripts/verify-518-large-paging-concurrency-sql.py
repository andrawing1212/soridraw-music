"""app518 real SQLite concurrency: stale page/delta must mutate zero members.
Read-only isolated test DB, never touches Cloudflare or user data."""
import json, pathlib, sqlite3, subprocess, tempfile
root=pathlib.Path(__file__).resolve().parents[1]
module=(root/"cloudflare/media-worker/src/catalogOwnerPagedIndex518.js").as_posix()
js=("import {PAGED_BASE_INSERT_518,PAGED_DELTA_INSERT_518,"
    "PAGED_DELTA_DELETE_518,ADVANCE_BASE_518,ADVANCE_DELTA_518} "
    f"from {json.dumps('file://'+module)};"
    "console.log(JSON.stringify([PAGED_BASE_INSERT_518,PAGED_DELTA_INSERT_518,"
    "PAGED_DELTA_DELETE_518,ADVANCE_BASE_518,ADVANCE_DELTA_518]));")
base_add,delta_add,delta_delete,advance_base,advance_delta=json.loads(
 subprocess.check_output(["node","--input-type=module","-e",js],text=True))
migration=(root/"cloudflare/media-worker/migrations/518_music_note_catalog_first_change_index.sql").read_text()
uid,gen,etag,base_etag="race-owner",100,'"head-100"','"base-1"'
with tempfile.TemporaryDirectory() as tmp:
 path=tmp+"/race.db"
 admin=sqlite3.connect(path,isolation_level=None,timeout=10)
 admin.executescript(migration)
 admin.execute("INSERT INTO music_note_catalog_index_meta_518 "
 "(owner_uid,generation,indexed_revision,expected_count,head_etag,status,checked_at_ms)"
 "VALUES(?,?,?,?,?,'building',?)",(uid,gen,gen,2,etag,1))
 admin.execute("INSERT INTO music_note_catalog_paged_stage_518 "
 "(owner_uid,generation,mode,head_revision,head_etag,head_count,"
 "base_key,base_etag,base_size,base_offset,base_seen,phase,delta_index,updated_at_ms)"
 "VALUES(?,?, 'first',?,?,?,?,?,?,0,0,'base',0,1)",
 (uid,gen,gen,etag,2,'catalog/v5/race-owner/musicNote/bases/100.json',base_etag,1000))
 a=sqlite3.connect(path,isolation_level=None,timeout=10)
 b=sqlite3.connect(path,isolation_level=None,timeout=10)
 def apply(conn,*stmts):
  conn.execute("BEGIN IMMEDIATE")
  counts=[conn.execute(sql,args).rowcount for sql,args in stmts]
  conn.commit()
  return counts
 def add_base(ids,offset=0,seen=0):
  return (base_add,(uid,gen,json.dumps(ids),uid,gen,'first',etag,offset,seen,base_etag))
 def advance_page(nxt,count,phase,was,was_seen):
  return (advance_base,(nxt,count,phase,2,uid,gen,'first',
                        was,was_seen,etag,base_etag,uid))
 def delete_delta(ids,idx):
  return (delta_delete,(uid,gen,json.dumps(ids),uid,gen,'first',etag,idx))
 def add_delta(ids,idx):
  return (delta_add,(uid,gen,json.dumps(ids),uid,gen,'first',etag,idx))
 def advance_d(idx):
  return (advance_delta,(idx+1,'delta',3,uid,gen,'first',idx,etag,uid))
 def ids():
  return {r[0] for r in admin.execute(
   "SELECT favorite_id FROM music_note_catalog_member_518 WHERE owner_uid=? AND generation=?",
   (uid,gen))}
 # A and B read the same initial cursor; B wins page and publishes a later
 # delete, while A's already-prepared BASE page arrives after that delete.
 stale_page=(add_base(['deleted-song']),advance_page(100,1,'base',0,0))
 assert apply(b,add_base(['deleted-song']),advance_page(100,1,'base',0,0))==[1,1]
 assert apply(b,advance_page(200,1,'delta',100,1))==[1]
 assert apply(b,delete_delta(['deleted-song'],0),advance_d(0))==[1,1]
 assert 'deleted-song' not in ids()
 assert apply(a,*stale_page)==[0,0],"stale BASE cannot reinsert deleted song"
 assert 'deleted-song' not in ids()
 # A holds delta-index=1 delete, B completes delta1 then delta2 adds song.
 stale_delta=(delete_delta(['latest-song'],1),advance_d(1))
 assert apply(b,add_delta(['other'],1),advance_d(1))==[1,1]
 assert apply(b,add_delta(['latest-song'],2),advance_d(2))==[1,1]
 assert apply(a,*stale_delta)==[0,0],"stale delta must not remove newer save"
 assert 'latest-song' in ids()
 # Even a cursor matching the stale writer must be unable to touch any
 # generation once READY has been published.
 admin.execute("UPDATE music_note_catalog_index_meta_518 SET status='ready' WHERE owner_uid=?",(uid,))
 stale_after_ready=(delete_delta(['latest-song'],3),advance_d(3))
 assert apply(a,*stale_after_ready)==[0,0]
 assert 'latest-song' in ids()
 # Recovery staging: existing READY old gen and a different, unpublished
 # recovery generation must be guarded by the live recovery claim.
 admin.execute("UPDATE music_note_catalog_index_meta_518 SET "
 "generation=90,indexed_revision=90,head_etag='old-head',"
 "recovery_generation=200,recovery_revision=200,recovery_etag=?,"
 "recovery_count=2, status='ready' WHERE owner_uid=?",(etag,uid))
 admin.execute("INSERT INTO music_note_catalog_paged_stage_518 "
 "(owner_uid,generation,mode,head_revision,head_etag,head_count,"
 "base_key,base_etag,base_size,base_offset,base_seen,phase,delta_index,updated_at_ms)"
 "VALUES(?,?, 'recovery',?,?,?,?,?,?,0,0,'base',0,1)",
 (uid,200,200,etag,2,'catalog/v5/race-owner/musicNote/bases/100.json',base_etag,1000))
 recovery_base=(base_add,(uid,200,json.dumps(['recovered']),uid,200,
                          'recovery',etag,0,0,base_etag))
 recovery_advance=(advance_base,(100,1,'base',2,uid,200,'recovery',0,0,
                                 etag,base_etag,uid))
 assert apply(b,recovery_base,recovery_advance)==[1,1]
 admin.execute("UPDATE music_note_catalog_index_meta_518 "
 "SET generation=200,indexed_revision=200,head_etag=?,"
 "recovery_generation=NULL,recovery_revision=NULL,recovery_etag=NULL,"
 "recovery_count=NULL WHERE owner_uid=?",(etag,uid))
 assert apply(a,recovery_base,recovery_advance)==[0,0]
 assert ids()=={'latest-song','other'},"old READY generation changed"
 assert admin.execute("SELECT COUNT(*) FROM music_note_catalog_member_518 "
 "WHERE owner_uid=? AND generation=200 AND favorite_id='recovered'",
 (uid,)).fetchone()[0]==1
 a.close();b.close();admin.close()
print("APP518_SQLITE_STALE_BASE_NEVER_RESURRECTS_DELETED_SONG=PASS")
print("APP518_SQLITE_STALE_DELTA_NEVER_DELETES_LATER_SAVE=PASS")
print("APP518_SQLITE_POST_READY_MEMBER_WRITE_DENIED=PASS")
print("APP518_SQLITE_RECOVERY_PROMOTION_FENCES_LATE_WRITER=PASS")

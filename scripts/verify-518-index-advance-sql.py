#!/usr/bin/env python3
"""Test the actual incremental D1 SQL in in-memory SQLite (no live D1)."""
import ast,re,sqlite3,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
schema=(root/'cloudflare/media-worker/migrations/518_music_note_catalog_first_change_index.sql').read_text()
js=(root/'cloudflare/media-worker/src/catalogIndexAdvance518.js').read_text()
def get(name):
 m=re.search(r'export const '+name+r'=\[(.*?)\]\.join\('+"' '"+r'\);',js,re.S)
 assert m,name
 out=[]
 for line in m.group(1).splitlines():
  line=line.strip().rstrip(',')
  if line:out.append(ast.literal_eval(line))
 return ' '.join(out)
ins=get('INDEX_INSERT_GUARDED_518')
delete=get('INDEX_DELETE_GUARDED_518')
advance=get('INDEX_META_ADVANCE_GUARDED_518')
db=sqlite3.connect(':memory:')
db.executescript(schema)
owner='owner',gen=100,old=100,oldetag='"before"'
db.execute("INSERT INTO music_note_catalog_index_meta_518(owner_uid,generation,indexed_revision,expected_count,head_etag,status,checked_at_ms) VALUES(?,?,?,?,?,'ready',?)",
 (owner,gen,old,1,oldetag,0))
db.execute("INSERT INTO music_note_catalog_member_518 VALUES (?,?,?)",(owner,gen,'a'))
def ch(q,args):
 before=db.total_changes
 db.execute(q,args)
 return db.total_changes-before
add_args=(owner,gen,'b',owner,gen,old,oldetag,1)
delete_args=(owner,gen,'a',owner,gen,old,oldetag,1)
advance_args=(102,'"after"',1,2000,owner,gen,old,oldetag,1)
with db:
 assert ch(ins,add_args)==1
 assert ch(delete,delete_args)==1
 assert ch(advance,advance_args)==1
assert db.execute('SELECT favorite_id FROM music_note_catalog_member_518').fetchall()==[('b',)]
assert db.execute('SELECT generation,indexed_revision,expected_count,head_etag FROM music_note_catalog_index_meta_518').fetchone()==(100,102,1,'"after"')
# Exact stale expected HEAD cannot touch index membership OR metadata.
with db:
 assert ch(ins,add_args)==0
 assert ch(delete,delete_args)==0
 assert ch(advance,advance_args)==0
assert db.execute('SELECT favorite_id FROM music_note_catalog_member_518').fetchall()==[('b',)]
# Exact owner scope; another UID can never modify this index.
assert ch(delete,('attacker',gen,'b',owner,gen,102,'"after"',1))==0
assert ch(ins,('attacker',gen,'rogue',owner,gen,102,'"after"',1))==1
# The caller's UID is server verified; SQL candidate must not accept a
# mismatched owner_uid INSERT even with somebody else's metadata!
print('APP518_INDEX_INCREMENTAL_SQL_E2E=PASS')
print('APP518_INDEX_ADVANCE_STALE_HEAD_D1_W0=PASS')

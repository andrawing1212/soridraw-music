#!/usr/bin/env python3
"""Execute the actual app518 JS SQL against SQLite. Pure in-memory simulation."""
import ast
import pathlib
import re
import sqlite3

root=pathlib.Path(__file__).resolve().parents[1]
source=(root/"cloudflare/media-worker/src/catalogD1Outbox518.js").read_text()
schema=(root/"cloudflare/media-worker/migrations/518_music_note_catalog_outbox.sql").read_text()

def stmt(name):
    m=re.search(r"export const "+re.escape(name)+r"=\[(.*?)\]\.join\('\\n'\);",source,re.S)
    assert m, "SQL definition missing: "+name
    lines=re.findall(r"^\s*'([^']*)',?$",m.group(1),re.M)
    assert lines, "SQL lines missing"
    return "\n".join(lines)

db=sqlite3.connect(":memory:")
db.row_factory=sqlite3.Row
db.executescript(schema)
upsert=stmt("UPSERT_CANONICAL_518")
due=stmt("SELECT_DUE_518")
ack=stmt("ACK_EXACT_518")
retry=stmt("REQUEUE_EXACT_518")
exact=stmt("READ_ONE_518")
t1="1793152800000000001"
t2="1793152800000000002"
t3="1793152800000000003"
uid="owner-1"
song="song-1"

def changes(sql,params):
    start=db.total_changes
    db.execute(sql,params)
    return db.total_changes-start

def enqueue(version,state,owner=uid,doc=song):
    return changes(upsert,(owner,doc,version,state,1000))

assert enqueue(t1,"saved")==1
assert enqueue(t1,"saved")==0,"duplicates should not write"
assert enqueue(t2,"removed")==1
assert enqueue(t1,"saved")==0,"old save cannot supersede remove"
assert [dict(r)["source_version_ns"] for r in db.execute(due,(1000,32))]==[t2]
assert changes(ack,(2000,uid,song,t1))==0,"late ACK must not mask pending delete"
assert changes(retry,(6000,2000,uid,song,t1,0))==0,"late error must not delay newer delete"
assert changes(retry,(6000,2000,uid,song,t2,0))==1
assert changes(retry,(6000,2000,uid,song,t2,0))==0, 'same failed attempt must be W0'\nassert not list(db.execute(due,(5000,32))),"retry must honor due index"
assert len(list(db.execute(due,(6000,32))))==1
assert changes(ack,(7000,uid,song,t2))==1
assert changes(ack,(7000,uid,song,t2))==0,"idempotent ACK W0"
assert not list(db.execute(due,(9000,32))),"ACKed item is never polled"
assert enqueue(t1,"saved")==0,"ACKed deletion cannot be revived by stale event"
assert enqueue(t3,"saved")==1
assert changes(ack,(9000,uid,song,t2))==0
assert changes(ack,(10000,uid,song,t3))==1
assert db.execute(exact,(uid,song)).fetchone()["desired_state"]=="saved"

# Cross-owner isolation and no whole-user scan.
assert enqueue(t2,"removed","owner-2")==1
assert db.execute(exact,("owner-2",song)).fetchone()["desired_state"]=="removed"
assert db.execute(exact,(uid,song)).fetchone()["desired_state"]=="saved"
assert db.execute(exact,("owner-3",song)).fetchone() is None
assert "owner_uid=?" in exact and "favorite_id=?" in exact
assert "LIMIT ?" in due
assert "CREATE INDEX" in schema and "next_attempt_ms" in schema

# Index bounded even if many accounts have history; ACKed items won't schedule.
for i in range(500):
    doc=f"older-{i}"
    enqueue(t1,"saved","synthetic-owner",doc)
    changes(ack,(10000,"synthetic-owner",doc,t1))
assert len(list(db.execute(due,(6000,4))))<=4
plan=" ".join(str(row[3]) for row in db.execute(
    "EXPLAIN QUERY PLAN "+due,(20000,16)))
assert "idx_music_note_catalog_outbox_518_due" in plan,plan
# 1 meaningful change => 1 D1 insert/update + 1 D1 ACK, no source snapshot
# or per-song media stored; failure adds 1 D1 retry write.
assert "lyrics" not in schema and "prompt" not in schema and "audio_url" not in schema
print("APP518_D1_EXACT_SQL_SAVE_DELETE_STALE_ACK=PASS")
print("APP518_D1_IN_MEMORY_RETRY_DUE_PARTIAL_INDEX=PASS")
print("APP518_D1_OWNER_ISOLATION_AND_NO_SONG_PAYLOAD=PASS")
print("APP518_D1_W1_ENQUEUE_W1_ACK_SUCCESS_PATH=PASS")
print("APP518_SQLITE_SIMULATION_REAL_NETWORK_WRITES=ZERO")

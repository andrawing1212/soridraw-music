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
hold=stmt("HOLD_EXACT_518")
exact=stmt("READ_ONE_518")
resume=stmt("RESUME_EXHAUSTED_EXACT_518")
t1="1793152800000000001".zfill(21)
t2="1793152800000000002".zfill(21)
t3="1793152800000000003".zfill(21)
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
assert changes(retry,(6000,2000,uid,song,t2,0))==0, 'same failed attempt must be W0'
assert not list(db.execute(due,(5000,32))),"retry must honor due index"
assert len(list(db.execute(due,(6000,32))))==1
assert changes(ack,(7000,uid,song,t2))==1
assert changes(ack,(7000,uid,song,t2))==0,"idempotent ACK W0"
assert not list(db.execute(due,(9000,32))),"ACKed item is never polled"
assert enqueue(t1,"saved")==0,"ACKed deletion cannot be revived by stale event"
assert enqueue(t3,"saved")==1
assert changes(ack,(9000,uid,song,t2))==0
assert changes(ack,(10000,uid,song,t3))==1
assert db.execute(exact,(uid,song)).fetchone()["desired_state"]=="saved"


# P2: terminal problem writes one permanent HOLD and retains the versioned
# pending song without ever re-reading it from the "due" index.
assert enqueue(t3,"removed")==0,"same-version does not wake an existing row"
assert enqueue("1793152800000000004".zfill(21),"removed")==1
t4="1793152800000000004".zfill(21)
assert changes(hold,("INDEX_CONTRACT",11000,uid,song,t4))==1
assert changes(hold,("INDEX_CONTRACT",12000,uid,song,t4))==0,"repeat HOLD W0"
assert changes(retry,(15000,12000,uid,song,t4,0))==0,"held work cannot be requeued"
assert not any(row["owner_uid"]==uid and row["favorite_id"]==song
 for row in db.execute(due,(9999999999,256))),"permanent HOLD cannot poll"
held=db.execute(exact,(uid,song)).fetchone()
assert held["hold_reason"]=="INDEX_CONTRACT"
assert held["source_version_ns"]==t4 and held["desired_state"]=="removed"
assert changes(ack,(16000,uid,song,t4))==0,"held version cannot silently ACK"
assert enqueue("1793152800000000005".zfill(21),"saved")==1
assert db.execute(exact,(uid,song)).fetchone()["hold_reason"] is None
assert any(row["owner_uid"]==uid and row["favorite_id"]==song
 for row in db.execute(due,(9999999999,256))),"verified newer version wakes held row"
print("APP518_D1_TERMINAL_HOLD_ONCE_AND_NO_REPEAT_DUE=PASS")
print("APP518_D1_HELD_PENDING_PRESERVED_NEWER_SOURCE_REACTIVATES=PASS")

# Audit P2: one exact generation may restart only once after operator
# explicitly verifies the current source, never for INDEX/SOURCE contract.
t6="1793152800000000006".zfill(21)
assert enqueue(t6,"removed")==1
assert changes(hold,("RETRY_BUDGET_EXHAUSTED",20000,uid,song,t6))==1
assert changes(resume,(80000,20000,uid,song,t6,"removed","RETRY_BUDGET_EXHAUSTED"))==1
assert changes(resume,(80000,20000,uid,song,t6,"removed","RETRY_BUDGET_EXHAUSTED"))==0
assert db.execute(exact,(uid,song)).fetchone()["manual_recovery_count"]==1
assert not list(db.execute(due,(79999,32))),"manual recovery is delayed"
assert len(list(db.execute(due,(80000,32))))==1
assert changes(hold,("RETRY_BUDGET_EXHAUSTED",81000,uid,song,t6))==1
assert changes(resume,(141000,81000,uid,song,t6,"removed","RETRY_BUDGET_EXHAUSTED"))==0
assert changes(resume,(141000,81000,uid,song,t6,"saved","RETRY_BUDGET_EXHAUSTED"))==0
assert changes(resume,(141000,81000,uid,song,t4,"removed","RETRY_BUDGET_EXHAUSTED"))==0
assert enqueue("1793152800000000007".zfill(21),"saved")==1
assert db.execute(exact,(uid,song)).fetchone()["manual_recovery_count"]==0
assert changes(resume,(141000,81000,uid,song,t6,"removed","RETRY_BUDGET_EXHAUSTED"))==0
print("APP518_MANUAL_EXACT_SOURCE_ONE_RESTART_PER_VERSION=PASS")
print("APP518_PERMANENT_CONTRACT_HOLD_NOT_AUTO_RELEASED=PASS")

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

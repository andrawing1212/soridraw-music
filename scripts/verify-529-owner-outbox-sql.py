#!/usr/bin/env python3
"""APP529 source-only SQLite simulation: no shared Cloudflare D1 reads/writes."""
import sqlite3
from pathlib import Path
ddl=Path("cloudflare/explore-worker/candidates/529-owner-follower-durable-outbox.sql").read_text()
db=sqlite3.connect(":memory:")
db.executescript("""
CREATE TABLE profile_stats(
 uid TEXT PRIMARY KEY,
 follower_count INTEGER NOT NULL DEFAULT 0,
 following_count INTEGER NOT NULL DEFAULT 0,
 updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE follows(
 follower_uid TEXT NOT NULL,following_uid TEXT NOT NULL,
 PRIMARY KEY(follower_uid,following_uid)
);
INSERT INTO profile_stats(uid,follower_count)VALUES('A',0),('B',0),('C',0);
""")
db.executescript(ddl)
def records():
 return db.execute("""SELECT owner_uid,revision,follower_count,acked_revision,
                       attempts,next_attempt_at,delivered_at,dead_at
                       FROM explore_owner_follow_outbox_529 ORDER BY owner_uid""").fetchall()
assert db.execute("SELECT enabled FROM explore_owner_follow_control_529").fetchone()[0]==0
db.execute("UPDATE profile_stats SET follower_count=1 WHERE uid='A'")
assert records()==[], "inactive SQL must not produce outbox writes"
db.execute("UPDATE explore_owner_follow_control_529 SET enabled=1 WHERE id=1")
before=db.total_changes
db.execute("UPDATE profile_stats SET follower_count=2 WHERE uid='A'")
assert records()==[('A',1,2,0,0,0,0,0)]
assert db.total_changes-before==2, "count UPDATE + exactly one outbox UPSERT"
db.execute("UPDATE profile_stats SET follower_count=2 WHERE uid='A'")
assert records()[0][1]==1, "unchanged count must produce no owner revision"
db.execute("INSERT INTO follows(follower_uid,following_uid) VALUES('B','A')")
assert records()[0][1]==1, "membership-only writes cannot invent count signal"
db.execute("UPDATE profile_stats SET follower_count=1 WHERE uid='A'")
assert records()==[('A',2,1,0,0,0,0,0)]
db.execute("UPDATE profile_stats SET follower_count=1 WHERE uid='C'")
assert records()==[('A',2,1,0,0,0,0,0),('C',1,1,0,0,0,0,0)]
# An old success ACK cannot acknowledge A's newer revision.
assert db.execute("""UPDATE explore_owner_follow_outbox_529
 SET acked_revision=1 WHERE owner_uid='A' AND revision=1""").rowcount==0
db.execute("""UPDATE explore_owner_follow_outbox_529
 SET acked_revision=2,delivered_at=100 WHERE owner_uid='A' AND revision=2""")
assert records()[0][:4]==('A',2,1,2)
db.execute("UPDATE profile_stats SET follower_count=2 WHERE uid='A'")
assert records()[0][:4]==('A',3,2,2), "next change must remain pending after old ACK"
assert len(records())==2, "bounded: one row per owner, not one per mutation"
db.commit()
try:
 db.execute("BEGIN")
 db.execute("UPDATE profile_stats SET follower_count=99 WHERE uid='A'")
 raise RuntimeError("injected canonical failure")
except RuntimeError:
 db.rollback()
assert db.execute("SELECT follower_count FROM profile_stats WHERE uid='A'").fetchone()[0]==2
assert records()[0][1]==3, "rollback must include the outbox revision"
db.executescript("""
CREATE TRIGGER injected_outbox_fail_529 BEFORE UPDATE ON explore_owner_follow_outbox_529
BEGIN SELECT RAISE(ABORT,'simulated outbox failure'); END;
""")
try:
 db.execute("UPDATE profile_stats SET follower_count=5 WHERE uid='A'")
 raise AssertionError("unsafe canonical commit without outbox")
except sqlite3.DatabaseError:
 db.rollback()
assert db.execute("SELECT follower_count FROM profile_stats WHERE uid='A'").fetchone()[0]==2
assert records()[0][1]==3
try:
 db.execute("DELETE FROM explore_owner_follow_outbox_529 WHERE owner_uid='A'")
 raise AssertionError("ordering fence deletion must fail when enabled")
except sqlite3.DatabaseError:
 db.rollback()
db.execute("UPDATE explore_owner_follow_control_529 SET enabled=0 WHERE id=1")
db.execute("UPDATE profile_stats SET follower_count=4 WHERE uid='A'")
assert len(records())==2 and records()[0][1]==3
print("APP529_ATOMIC_CANONICAL_AND_OWNER_OUTBOX_ROLLBACK=PASS")
print("APP529_ONE_ROW_PER_OWNER_COALESCED_FINAL_COUNT=PASS")
print("APP529_STABLE_PER_OWNER_REVISION_CAS_AND_NOOP_W0=PASS")
print("APP529_OFF_MEANS_NO_OUTBOX_AND_PHYSICAL_D1_METERING_HOLD=PASS")

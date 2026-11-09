#!/usr/bin/env python3
"""APP529 isolated SQLite, no Cloudflare/shared D1 access."""
import sqlite3
from pathlib import Path

ddl = Path("cloudflare/explore-worker/candidates/529-owner-follower-durable-outbox.sql").read_text()
db=sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
db.executescript("""
CREATE TABLE profile_stats(
 uid TEXT PRIMARY KEY,
 follower_count INTEGER NOT NULL DEFAULT 0,
 following_count INTEGER NOT NULL DEFAULT 0,
 updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE follows(follower_uid TEXT NOT NULL,following_uid TEXT NOT NULL,
 PRIMARY KEY(follower_uid,following_uid));
INSERT INTO profile_stats(uid,follower_count)VALUES('A',0),('B',0),('C',0);
""")
db.executescript(ddl)
def records():
 return db.execute("SELECT event_id,owner_uid,follower_count,attempts,delivered_at FROM explore_owner_follow_outbox_529 ORDER BY event_id").fetchall()
assert db.execute("SELECT enabled FROM explore_owner_follow_control_529 WHERE id=1").fetchone()[0]==0
db.execute("UPDATE profile_stats SET follower_count=1 WHERE uid='A'")
assert records()==[], "Schema install and OFF state must create no events"
db.execute("UPDATE explore_owner_follow_control_529 SET enabled=1 WHERE id=1")
before=db.total_changes
db.execute("UPDATE profile_stats SET follower_count=2 WHERE uid='A'")
first=records()
assert len(first)==1 and first[0][1:3]==('A',2), first
assert db.total_changes-before==2, "One count UPDATE + exactly one outbox INSERT"
db.execute("UPDATE profile_stats SET follower_count=2 WHERE uid='A'")
assert len(records())==1, "Idempotent same-count UPDATE must not notify"
db.execute("INSERT INTO follows(follower_uid,following_uid)VALUES('B','A')")
assert len(records())==1, "Membership without committed count must not notify"
db.execute("UPDATE profile_stats SET follower_count=1 WHERE uid='A'")
db.execute("UPDATE profile_stats SET follower_count=1 WHERE uid='C'")
rows=records()
assert [(r[1],r[2]) for r in rows]==[('A',2),('A',1),('C',1)]
assert rows[0][0]<rows[1][0]<rows[2][0], "Source sequence is monotonically ordered"
db.commit()
try:
 db.execute("BEGIN")
 db.execute("UPDATE profile_stats SET follower_count=99 WHERE uid='A'")
 raise RuntimeError("simulated D1 transaction failure")
except RuntimeError:
 db.rollback()
assert db.execute("SELECT follower_count FROM profile_stats WHERE uid='A'").fetchone()[0]==1
assert len(records())==3, "Atomic DB rollback must also undo outbox"
# Corruption in outbox must abort caller's count mutation, not silently drop signal.
db.executescript("""
CREATE TRIGGER reject_outbox_insert_529 BEFORE INSERT ON explore_owner_follow_outbox_529
BEGIN SELECT RAISE(ABORT,'injected outbox failure'); END;
""")
try:
 db.execute("UPDATE profile_stats SET follower_count=5 WHERE uid='A'")
 raise AssertionError("COUNT COMMIT WITHOUT OUTBOX MUST NEVER SUCCEED")
except sqlite3.DatabaseError:
 db.rollback()
assert db.execute("SELECT follower_count FROM profile_stats WHERE uid='A'").fetchone()[0]==1
assert len(records())==3
db.execute("UPDATE explore_owner_follow_control_529 SET enabled=0 WHERE id=1")
db.execute("UPDATE profile_stats SET follower_count=4 WHERE uid='A'")
assert len(records())==3
assert db.execute("SELECT follower_count FROM profile_stats WHERE uid='A'").fetchone()[0]==4
assert "CREATE TRIGGER" in ddl and "AFTER UPDATE OF follower_count ON profile_stats" in ddl
print("APP529_ATOMIC_D1_COMMIT_AND_OUTBOX_OR_ROLLBACK=PASS")
print("APP529_CHANGED_COUNT_ONLY_NOOP_W0_OFF_W0=PASS")
print("APP529_SOURCE_EVENT_SEQUENCE_ORDER=PASS")
print("APP529_ADDITIONAL_D1_W1_PER_CHANGED_COUNT_REQUIRES_PHYSICAL_METERING=PASS")

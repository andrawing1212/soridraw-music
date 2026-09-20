#!/usr/bin/env python3
"""Read-only, isolated proof of the single-action D1 write lower bound.

This is NOT a live Cloudflare D1 billing measurement. Its SQLite sandbox
replays the row-level operations confirmed in the canonical Worker source.
The mandatory project release gate remains W1-W2 per single user mutation.
"""
from pathlib import Path
import sqlite3

worker = Path("cloudflare/explore-worker/canonical/preview-worker.js").read_text(encoding="utf-8")
intake_start = worker.index("async function enqueueExploreLikeBatch035(")
intake_end = worker.index("\n}", intake_start) + 2
intake = worker[intake_start:intake_end]
processor_start = worker.index("async function processExploreLikeAggregateWave035(")
processor_end = worker.index("\n}", processor_start) + 2
processor = worker[processor_start:processor_end]

checks = (
    ("069 durable enqueue", intake, "INSERT OR IGNORE INTO explore_like_batches_069("),
    ("stats update", processor, "ON CONFLICT(track_id) DO UPDATE SET like_count"),
    ("like relationship insert", processor, "INSERT OR IGNORE INTO likes(track_id, user_uid, created_at)"),
    ("like relationship delete", processor, "DELETE FROM likes WHERE (track_id, user_uid) IN"),
    ("069 durable queue deletion", processor, "DELETE FROM explore_like_batches_069 WHERE batch_id IN"),
)
for label, block, token in checks:
    if token not in block:
        raise AssertionError("Canonical Worker contract changed: " + label)
print("132_CANONICAL_069_SOURCE_OPERATIONS=PASS")

db = sqlite3.connect(":memory:")
db.executescript("""
    CREATE TABLE explore_like_batches_069(batch_id TEXT PRIMARY KEY, user_uid TEXT, created_at INTEGER);
    CREATE TABLE likes(track_id TEXT, user_uid TEXT, PRIMARY KEY(track_id, user_uid));
    CREATE TABLE track_stats(track_id TEXT PRIMARY KEY, like_count INTEGER);
    INSERT INTO track_stats VALUES('track-1', 0);
""")

def simulate_one_action(desired: bool, batch_id: str) -> int:
    before = db.total_changes
    db.execute("INSERT OR IGNORE INTO explore_like_batches_069 VALUES(?,?,?)",
               (batch_id, "account-1", 1))
    db.execute("UPDATE track_stats SET like_count = like_count + ? WHERE track_id = 'track-1'",
               (1 if desired else -1,))
    if desired:
        db.execute("INSERT OR IGNORE INTO likes VALUES('track-1', 'account-1')")
    else:
        db.execute("DELETE FROM likes WHERE track_id = 'track-1' AND user_uid = 'account-1'")
    db.execute("DELETE FROM explore_like_batches_069 WHERE batch_id=?", (batch_id,))
    return db.total_changes - before

like_writes = simulate_one_action(True, "single-like")
assert db.execute("SELECT like_count FROM track_stats").fetchone()[0] == 1
assert db.execute("SELECT count(*) FROM likes").fetchone()[0] == 1
unlike_writes = simulate_one_action(False, "single-unlike")
assert db.execute("SELECT like_count FROM track_stats").fetchone()[0] == 0
assert db.execute("SELECT count(*) FROM likes").fetchone()[0] == 0

assert like_writes == 4, like_writes
assert unlike_writes == 4, unlike_writes
print(f"132_SQLITE_SINGLE_LIKE_ROW_CHANGES={like_writes}")
print(f"132_SQLITE_SINGLE_UNLIKE_ROW_CHANGES={unlike_writes}")
print("132_D1_ROWS_WRITTEN_LIVE_METER=NOT_MEASURED")
print("132_D1_W1_W2_RELEASE_GATE=FAIL_BY_SOURCE_LEVEL_LOWER_BOUND")
print("132_AUDIT_TEST=PASS (release readiness deliberately remains FAIL)")
print("132_NO_LIVE_USER_DATA_OR_DEPLOY=PASS")

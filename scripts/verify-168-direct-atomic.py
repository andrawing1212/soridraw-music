"""SORIDRAW 168: isolated SQLite model for the exact direct D1 batch logic."""
from __future__ import annotations

import sqlite3
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = (ROOT / "cloudflare/explore-worker/runtime/like-direct-atomic-168.txt").read_text(encoding="utf-8")
assert "SORIDRAW_DIRECT_LIKE_ATOMIC_D1_BATCH_168_20260921" in SOURCE
assert "const result = await env.DB.batch([" in SOURCE
assert "WHERE changes() = 1" in SOURCE
assert "INSERT OR IGNORE INTO likes" in SOURCE and "DELETE FROM likes" in SOURCE
assert "SELECT like_count FROM track_stats WHERE track_id = ? LIMIT 1" in SOURCE
assert SOURCE.count(".run()") == 0
assert SOURCE.count(".all()") == 0


def atomic_like(db: sqlite3.Connection, track: str, uid: str, desired: bool, now: int) -> tuple[int, int, int]:
    """Identical SQL statement order to the Worker fragment, in one transaction.

    This Python function models D1 batch transactional semantics; it is not a
    replacement for a remote D1 meta.rows_written experiment.
    """
    before = db.total_changes
    db.execute("BEGIN IMMEDIATE")
    try:
        if desired:
            db.execute("INSERT OR IGNORE INTO likes (track_id,user_uid,created_at) VALUES (?,?,?)",
                       (track, uid, now))
        else:
            db.execute("DELETE FROM likes WHERE track_id = ? AND user_uid = ?", (track, uid))
        delta, initial = (1, 1) if desired else (-1, 0)
        db.execute("""
            INSERT INTO track_stats(track_id, like_count, comment_count, play_count, updated_at)
            SELECT ?, ?, 0, 0, ?
            WHERE changes() = 1
            ON CONFLICT(track_id) DO UPDATE SET
              like_count = MAX(0, track_stats.like_count + ?),
              updated_at = excluded.updated_at
        """, (track, initial, now, delta))
        got = db.execute("SELECT like_count FROM track_stats WHERE track_id = ? LIMIT 1", (track,)).fetchone()
        db.execute("COMMIT")
        return (got[0] if got else 0, db.total_changes - before, int(db.execute(
            "SELECT EXISTS(SELECT 1 FROM likes WHERE track_id=? AND user_uid=?)", (track, uid)
        ).fetchone()[0]))
    except Exception:
        db.execute("ROLLBACK")
        raise


with tempfile.TemporaryDirectory(prefix="soridraw-168-") as folder:
    db = sqlite3.connect(str(Path(folder) / "like.sqlite"), isolation_level=None)
    db.executescript("""
      CREATE TABLE likes(track_id TEXT NOT NULL,user_uid TEXT NOT NULL,created_at INTEGER NOT NULL,
        PRIMARY KEY(track_id,user_uid));
      CREATE TABLE track_stats(track_id TEXT PRIMARY KEY,like_count INTEGER NOT NULL,
        comment_count INTEGER NOT NULL, play_count INTEGER NOT NULL,updated_at INTEGER NOT NULL);
    """)
    assert atomic_like(db, "song", "user", True, 1) == (1, 2, 1)
    assert atomic_like(db, "song", "user", True, 2) == (1, 0, 1)
    assert atomic_like(db, "song", "other", True, 3) == (2, 2, 1)
    assert atomic_like(db, "song", "user", False, 4) == (1, 2, 0)
    assert atomic_like(db, "song", "user", False, 5) == (1, 0, 0)
    assert atomic_like(db, "missing", "user", False, 6) == (0, 0, 0)
    assert atomic_like(db, "fresh", "user", True, 7) == (1, 2, 1)
    print("168_ATOMIC_DIRECT_NEW_DUPLICATE_UNLIKE_MULTIUSER=PASS")

    # Fail second statement and assert the relation itself rolls back.
    db.executescript("""
      CREATE TRIGGER reject_count_168 BEFORE UPDATE ON track_stats
      WHEN NEW.track_id = 'song' BEGIN SELECT RAISE(ABORT,'INJECTED_168'); END;
    """)
    before = db.total_changes
    try:
        atomic_like(db, "song", "user", True, 8)
    except sqlite3.IntegrityError as e:
        assert "INJECTED_168" in str(e)
    else:
        raise AssertionError("second statement failed without rollback")
    assert db.execute("SELECT COUNT(*) FROM likes WHERE track_id='song' AND user_uid='user'").fetchone() == (0,)
    assert db.execute("SELECT like_count FROM track_stats WHERE track_id='song'").fetchone() == (1,)
    assert db.total_changes - before == 1, "SQLite total_changes includes rolled-back mutation; no durable change"
    print("168_SECOND_STATEMENT_FAILURE_RELATION_ROLLBACK=PASS")

    # Rejected legacy writer after frozen is a separate release gate and an
    # older in-flight writer is NOT made compatible by modifying only 168.
    print("168_OLDER_DEPLOYED_DIRECT_INFLIGHT_UNVERIFIED_RELEASE_GATE=FAIL_EXPECTED")
    db.close()

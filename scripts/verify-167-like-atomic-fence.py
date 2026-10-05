"""SORIDRAW 167: local-only SQLite barrier experiment. NEVER touches shared D1."""
from __future__ import annotations

import sqlite3
import tempfile
import threading
from pathlib import Path

FIXTURE = Path(__file__).parent / "fixtures" / "167-like-atomic-fence-isolated.sql"
QUEUE_TABLES = ("explore_like_batches_035", "explore_like_batches_066",
                "explore_like_batches_069", "explore_like_user_queue_075")


def connection(path: str) -> sqlite3.Connection:
    db = sqlite3.connect(path, timeout=10, isolation_level=None, check_same_thread=False)
    db.execute("PRAGMA busy_timeout=10000")
    return db


def expect_blocked(fn, label: str) -> None:
    try:
        fn()
    except sqlite3.IntegrityError as exc:
        assert "LIKE_CUTOVER_DRAINING_167" in str(exc) or "LIKE_LEGACY_FROZEN_167" in str(exc), (label, str(exc))
    else:
        raise AssertionError(f"{label}: bypassed database fence")


with tempfile.TemporaryDirectory(prefix="soridraw-167-isolated-") as root:
    path = str(Path(root) / "test.sqlite")
    db = connection(path)
    db.executescript(FIXTURE.read_text(encoding="utf-8"))
    assert db.execute("SELECT phase FROM like_cutover_control_167 WHERE id=1").fetchone() == ("open",)

    # Prior Worker versions do not read the R2 drain marker. D1 must guard
    # every queue INSERT itself, not rely on the code that called it.
    for kind in ("035", "066", "069"):
        db.execute(f"INSERT INTO explore_like_batches_{kind}(batch_id) VALUES (?)", (f"old-{kind}",))
    db.execute("INSERT INTO explore_like_user_queue_075 VALUES ('user-a',1)")
    db.execute("UPDATE explore_like_user_queue_075 SET updated_at=2 WHERE user_uid='user-a'")
    assert [db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] for table in QUEUE_TABLES] == [1] * 4
    db.execute("UPDATE like_cutover_control_167 SET phase='draining' WHERE id=1 AND phase='open'")
    assert db.total_changes == 7  # singleton seed + 4 queue inserts + 075 update + phase update.

    for kind in ("035", "066", "069"):
        expect_blocked(lambda kind=kind: db.execute(
            f"INSERT OR IGNORE INTO explore_like_batches_{kind}(batch_id) VALUES (?)", (f"late-{kind}",)),
            f"old worker queue {kind}")
    expect_blocked(lambda: db.execute(
        "INSERT INTO explore_like_user_queue_075 VALUES ('user-b',1)"), "old worker 075 insert")
    expect_blocked(lambda: db.execute(
        "UPDATE explore_like_user_queue_075 SET updated_at=3 WHERE user_uid='user-a'"),
        "old worker 075 update")
    assert [db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] for table in QUEUE_TABLES] == [1] * 4
    print("167_OLD_WORKER_QUEUE_INSERT_UPDATE_FENCED=PASS")

    # Stale R2 read / old request accepted before closure: pause just before
    # its actual DB write. It must fail after the closure, despite the old read.
    paused = threading.Event()
    resume = threading.Event()
    outcome = []
    db.execute("UPDATE like_cutover_control_167 SET phase='open' WHERE id=1")
    def stale_request() -> None:
        writer = connection(path)
        try:
            assert writer.execute("SELECT phase FROM like_cutover_control_167 WHERE id=1").fetchone() == ("open",)
            paused.set()
            if not resume.wait(5):
                raise AssertionError("stale request resume timed out")
            try:
                writer.execute("INSERT INTO explore_like_batches_069(batch_id) VALUES ('late-inflight')")
                outcome.append("UNSAFE")
            except sqlite3.IntegrityError:
                outcome.append("BLOCKED")
        finally:
            writer.close()

    job = threading.Thread(target=stale_request)
    job.start()
    assert paused.wait(5)
    db.execute("UPDATE like_cutover_control_167 SET phase='draining' WHERE id=1")
    resume.set()
    job.join(timeout=10)
    assert not job.is_alive()
    assert outcome == ["BLOCKED"], outcome
    assert db.execute("SELECT COUNT(*) FROM explore_like_batches_069 WHERE batch_id='late-inflight'").fetchone() == (0,)
    print("167_INFLIGHT_OLD_QUEUE_AFTER_CLOSURE_BLOCKED=PASS")

    # Reverse order: a valid intake that gets the SQLite writer transaction
    # first completes; the closure follows it. It will then be visible to drain.
    db.execute("UPDATE like_cutover_control_167 SET phase='open' WHERE id=1")
    db.execute("BEGIN IMMEDIATE")
    db.execute("INSERT INTO explore_like_batches_069(batch_id) VALUES ('accepted-before-close')")
    db.execute("COMMIT")
    db.execute("UPDATE like_cutover_control_167 SET phase='draining' WHERE id=1")
    assert db.execute("SELECT COUNT(*) FROM explore_like_batches_069 WHERE batch_id='accepted-before-close'").fetchone() == (1,)
    print("167_ACCEPTED_BEFORE_CLOSE_IS_DRAINABLE=PASS")

    # IMPORTANT: this does NOT solve the old direct two-write like route.
    # A direct request may commit likes and pause BEFORE its separate stats
    # mutation. Queue 0 does not show that pending second statement.
    db.execute("INSERT INTO likes(track_id,user_uid) VALUES ('song-direct','user-a')")
    assert db.execute("SELECT COUNT(*) FROM explore_like_batches_069 WHERE batch_id='late-inflight'").fetchone() == (0,)
    db.execute("UPDATE like_cutover_control_167 SET phase='frozen' WHERE id=1")
    expect_blocked(lambda: db.execute(
        "INSERT INTO likes(track_id,user_uid) VALUES ('song-late','user-b')"),
        "old direct legacy relation after final freeze")
    # This simulates the *already accepted* direct request's second statement.
    db.execute("INSERT INTO track_stats(track_id,like_count) VALUES ('song-direct',1)")
    assert db.execute("SELECT like_count FROM track_stats WHERE track_id='song-direct'").fetchone() == (1,)
    print("167_DIRECT_TWO_STATEMENT_INFLIGHT_STILL_UNFENCED=FAIL_EXPECTED")
    print("167_PRODUCT_CUTOVER_REMAINS_BLOCKED=PASS")
    db.close()

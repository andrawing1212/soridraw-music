#!/usr/bin/env python3
"""Isolated SQLite decision test for candidate direct D1 like writes.

Does NOT modify a repository, Cloudflare D1, Firebase, R2 or user data.
D1 batch()/changes() compatibility and billed rows must be validated against
an isolated D1 test account before using this SQL in any Worker.
"""
import sqlite3


def new_db():
    db = sqlite3.connect(":memory:", isolation_level=None)
    db.executescript("""
        CREATE TABLE likes(track_id TEXT NOT NULL, user_uid TEXT NOT NULL,
                           PRIMARY KEY(track_id,user_uid));
        CREATE TABLE track_stats(track_id TEXT PRIMARY KEY, like_count INTEGER NOT NULL DEFAULT 0
                                 CHECK(like_count >= 0));
        INSERT INTO track_stats(track_id,like_count) VALUES ('song-a',0),('song-b',0);
    """)
    return db


def direct_action(db, track, uid, desired):
    """Model one atomic D1 batch; D1 runtime compatibility is NOT assumed."""
    before = db.total_changes
    db.execute("BEGIN IMMEDIATE")
    try:
        if not db.execute("SELECT 1 FROM track_stats WHERE track_id=?", (track,)).fetchone():
            raise ValueError("canonical_track_stats_missing")
        if desired:
            db.execute("INSERT OR IGNORE INTO likes(track_id,user_uid) VALUES (?,?)", (track, uid))
            db.execute("UPDATE track_stats SET like_count=like_count+1 "
                       "WHERE track_id=? AND changes()=1", (track,))
        else:
            db.execute("DELETE FROM likes WHERE track_id=? AND user_uid=?", (track, uid))
            db.execute("UPDATE track_stats SET like_count=like_count-1 "
                       "WHERE track_id=? AND changes()=1", (track,))
        db.execute("COMMIT")
    except BaseException:
        db.execute("ROLLBACK")
        raise
    return db.total_changes-before


def count(db, track):
    return db.execute("SELECT like_count FROM track_stats WHERE track_id=?", (track,)).fetchone()[0]


def membership(db, track, uid):
    return bool(db.execute("SELECT 1 FROM likes WHERE track_id=? AND user_uid=?", (track, uid)).fetchone())


def consistent(db):
    for track, recorded in db.execute("SELECT track_id, like_count FROM track_stats").fetchall():
        actual = db.execute("SELECT count(*) FROM likes WHERE track_id=?", (track,)).fetchone()[0]
        assert recorded == actual, (track, recorded, actual)


def main():
    db = new_db()
    assert direct_action(db, "song-a", "pc", True) == 2
    assert count(db, "song-a") == 1 and membership(db, "song-a", "pc")
    print("133_DIRECT_FRESH_LIKE_SQLITE_ROWS=2")
    assert direct_action(db, "song-a", "pc", True) == 0
    assert count(db, "song-a") == 1
    print("133_DIRECT_DUPLICATE_LIKE_SQLITE_ROWS=0")
    assert direct_action(db, "song-a", "phone", True) == 2
    assert direct_action(db, "song-a", "pc", False) == 2
    assert count(db, "song-a") == 1 and membership(db, "song-a", "phone")
    print("133_DIRECT_OTHER_USERS_LIKES_PRESERVED=PASS")
    assert direct_action(db, "song-a", "pc", False) == 0
    assert count(db, "song-a") == 1
    print("133_DIRECT_DUPLICATE_UNLIKE_SQLITE_ROWS=0")
    assert direct_action(db, "song-a", "phone", False) == 2
    assert direct_action(db, "song-b", "pc", True) == 2
    consistent(db)
    print("133_DIRECT_DISTINCT_TRACK_AND_RELATION_COUNT=PASS")
    try:
        direct_action(db, "missing-song", "pc", True)
        assert False, "must fail closed on missing stats"
    except ValueError as exc:
        assert str(exc) == "canonical_track_stats_missing"
    assert not membership(db, "missing-song", "pc")
    consistent(db)
    print("133_DIRECT_MISSING_STATS_FAIL_CLOSED=PASS")

    # A valid old request can arrive AFTER a newer unlike. Without durable
    # per-UID/track ordering history, 2 SQL writes alone cannot reject it.
    replay = new_db()
    assert direct_action(replay, "song-a", "pc", True) == 2
    assert direct_action(replay, "song-a", "pc", False) == 2
    assert direct_action(replay, "song-a", "pc", True) == 2  # stale retry
    assert membership(replay, "song-a", "pc") and count(replay, "song-a") == 1
    print("133_UNFENCED_STALE_REPLAY_REVERSAL_REPRODUCED=PASS")
    print("133_DIRECT_TWO_ROWS_COMPLETE_CROSS_DEVICE_FIX=FAIL_NEEDS_DURABLE_FENCE")
    print("133_D1_LIVE_ROWS_WRITTEN_AND_CHANGES_BATCH=NOT_MEASURED")
    print("133_NO_LIVE_USER_DATA_OR_DEPLOY=PASS")


if __name__ == "__main__":
    main()

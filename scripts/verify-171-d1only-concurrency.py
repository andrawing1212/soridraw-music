"""SORIDRAW 171 source-only concurrency model for the D1-only W2 candidate."""
from __future__ import annotations
import sqlite3
import tempfile
from pathlib import Path

MIGRATION = Path("cloudflare/explore-worker/migrations/20260921_03_explore_like_d1only_v171_additive.sql")


def effective(db, uid, track):
    row = db.execute("""
      SELECT
        COALESCE((SELECT liked FROM explore_like_overrides_171 WHERE user_uid=? AND track_id=?),
                 EXISTS(SELECT 1 FROM likes WHERE track_id=? AND user_uid=?)) AS liked,
        COALESCE((SELECT revision FROM explore_like_overrides_171 WHERE user_uid=? AND track_id=?),0) AS revision,
        COALESCE((SELECT last_operation_id FROM explore_like_overrides_171 WHERE user_uid=? AND track_id=?),'') AS op,
        COALESCE((SELECT like_count FROM track_stats WHERE track_id=?),0) +
        COALESCE((SELECT delta FROM explore_like_count_deltas_171 WHERE track_id=?),0) AS like_count,
        COALESCE((SELECT generation FROM explore_like_count_deltas_171 WHERE track_id=?),0) AS generation
    """, (uid,track,track,uid,uid,track,uid,track,track,track,track)).fetchone()
    return dict(zip(("liked","revision","op","like_count","generation"), row))


def mutate(db, uid, track, desired, expected_revision, operation_id, at):
    prior = effective(db, uid, track)
    before = db.total_changes
    db.execute("BEGIN IMMEDIATE")
    try:
        # One relation row write maximum. Both the SELECT gate and conflict
        # WHERE require the caller's base revision; a stale request therefore
        # becomes W0 instead of overwriting a newer device.
        db.execute("""
          INSERT INTO explore_like_overrides_171(
            user_uid,track_id,liked,revision,last_operation_id,updated_at
          )
          SELECT ?,?,?,1,?,?
          WHERE
            COALESCE((SELECT liked FROM explore_like_overrides_171
                      WHERE user_uid=? AND track_id=?),
                     EXISTS(SELECT 1 FROM likes WHERE track_id=? AND user_uid=?)) != ?
            AND COALESCE((SELECT revision FROM explore_like_overrides_171
                          WHERE user_uid=? AND track_id=?),0) = ?
          ON CONFLICT(user_uid,track_id) DO UPDATE SET
            liked=excluded.liked,
            revision=explore_like_overrides_171.revision+1,
            last_operation_id=excluded.last_operation_id,
            updated_at=excluded.updated_at
          WHERE explore_like_overrides_171.revision = ?
            AND explore_like_overrides_171.liked != excluded.liked
        """, (
            uid, track, int(desired), operation_id, at,
            uid, track, track, uid, int(desired),
            uid, track, expected_revision,
            expected_revision,
        ))
        relation_changes = db.execute("SELECT changes()").fetchone()[0]
        delta = 1 if desired else -1
        db.execute("""
          INSERT INTO explore_like_count_deltas_171(track_id,delta,generation,updated_at)
          SELECT ?,?,1,? WHERE ? = 1
          ON CONFLICT(track_id) DO UPDATE SET
            delta=explore_like_count_deltas_171.delta+excluded.delta,
            generation=explore_like_count_deltas_171.generation+1,
            updated_at=excluded.updated_at
        """, (track, delta, at, relation_changes))
        count_changes = db.execute("SELECT changes()").fetchone()[0]
        db.execute("COMMIT")
    except Exception:
        db.execute("ROLLBACK")
        raise
    final = effective(db, uid, track)
    durable_changes = db.total_changes - before
    # SQLite total_changes counts table rows; both hot tables are WITHOUT ROWID.
    # Remote D1 billing is separately measured by measure-153-isolated-d1.mjs.
    assert relation_changes in (0, 1)
    assert count_changes == relation_changes
    if relation_changes:
        assert final["liked"] == int(desired)
        assert final["revision"] == expected_revision + 1
        assert final["op"] == operation_id
        assert final["generation"] == prior["generation"] + 1
        assert final["like_count"] == prior["like_count"] + delta
        assert durable_changes == 2
        return {"status":"applied", **final}
    assert durable_changes == 0
    if final["liked"] == int(desired):
        return {"status":"already-desired", **final}
    return {"status":"revision-conflict", **final}


with tempfile.TemporaryDirectory(prefix="soridraw-171-concurrency-") as folder:
    db = sqlite3.connect(str(Path(folder) / "test.sqlite"), isolation_level=None)
    db.executescript("""
      CREATE TABLE likes(track_id TEXT NOT NULL,user_uid TEXT NOT NULL,created_at INTEGER NOT NULL,
        PRIMARY KEY(track_id,user_uid));
      CREATE TABLE track_stats(track_id TEXT PRIMARY KEY,like_count INTEGER NOT NULL);
      INSERT INTO track_stats(track_id,like_count) VALUES ('song',0);
    """)
    db.executescript(MIGRATION.read_text(encoding="utf-8"))

    a = mutate(db,"user","song",True,0,"op-a",100)
    assert (a["status"],a["revision"],a["generation"],a["like_count"]) == ("applied",1,1,1)

    # Mobile based on old revision cannot undo PC's newer committed state.
    b_stale = mutate(db,"user","song",False,0,"op-b",101)
    assert b_stale["status"] == "revision-conflict"
    assert effective(db,"user","song")["like_count"] == 1

    # After explicit rebase, the still-current mobile intent may become the
    # next canonical operation. That is a deliberate arrival-order decision.
    b = mutate(db,"user","song",False,1,"op-b",102)
    assert (b["status"],b["revision"],b["generation"],b["like_count"]) == ("applied",2,2,0)

    # A network retry of the old PC operation cannot resurrect the like.
    a_retry = mutate(db,"user","song",True,0,"op-a",103)
    assert a_retry["status"] == "revision-conflict"
    assert effective(db,"user","song")["like_count"] == 0

    # Two devices ask for the same final state from the same base. One writes;
    # the second is W0 because the desired state is already satisfied.
    c = mutate(db,"user","song",True,2,"op-c",104)
    d = mutate(db,"user","song",True,2,"op-d",105)
    assert c["status"] == "applied"
    assert d["status"] == "already-desired"
    assert (d["revision"],d["generation"],d["like_count"]) == (3,3,1)

    c_retry = mutate(db,"user","song",True,2,"op-c",106)
    assert c_retry["status"] == "already-desired"
    assert effective(db,"user","song")["like_count"] == 1

    # Existing legacy-like baseline follows the same transition rule without
    # copying the old row into the new table.
    db.execute("INSERT INTO likes(track_id,user_uid,created_at) VALUES ('legacy','user',1)")
    db.execute("INSERT INTO track_stats(track_id,like_count) VALUES ('legacy',1)")
    legacy = mutate(db,"user","legacy",False,0,"op-legacy",200)
    assert (legacy["status"],legacy["like_count"],legacy["revision"]) == ("applied",0,1)

    print("171_PC_MOBILE_STALE_REVISION_CANNOT_OVERWRITE=PASS")
    print("171_EXPLICIT_REBASE_BECOMES_NEXT_ARRIVAL_ORDER_INTENT=PASS")
    print("171_SAME_DESIRED_CONCURRENT_SECOND_WRITE_W0_MODEL=PASS")
    print("171_LEGACY_BASELINE_NO_BACKFILL_MODEL=PASS")
    db.close()

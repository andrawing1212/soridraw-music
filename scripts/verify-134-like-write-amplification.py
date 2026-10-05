#!/usr/bin/env python3
"""Isolation-only counterexample to a two-D1-row claim with 032/033 triggers.

This is a conservative SQLite logical-row lower bound, NOT live D1 billing.
No databases outside in-memory SQLite are opened.
"""
from pathlib import Path
import sqlite3

MIGRATION_DIR = Path('cloudflare/explore-worker/migrations')
derived = (MIGRATION_DIR / '20260910_01_explore_derived_state.sql').read_text()
optimized = (MIGRATION_DIR / '20260910_03_explore_like_write_optimization.sql').read_text()
checks = {
    'stats fanout': 'CREATE TRIGGER IF NOT EXISTS explore032_stats_update AFTER UPDATE ON track_stats',
    'derived track fanout': 'CREATE TRIGGER explore032_derived_track_update',
    'derived seq': 'UPDATE explore_derived_state',
    'feed journal': "'feed'",
    'profile journal': "'profile:' || NEW.owner_uid",
    'popular index': 'idx_explore_rank_popular',
}
for label, needle in checks.items():
    target = optimized if label in ('derived track fanout','derived seq','feed journal','profile journal') else derived
    assert needle in target, f'missing schema dependency: {label}'
print('134_SOURCE_DEPENDENCY_GUARD=PASS')

db = sqlite3.connect(':memory:', isolation_level=None)
db.executescript("""
CREATE TABLE likes(track_id TEXT, user_uid TEXT, PRIMARY KEY(track_id,user_uid));
CREATE TABLE track_stats(track_id TEXT PRIMARY KEY, like_count INTEGER NOT NULL);
CREATE TABLE explore_derived_tracks(id TEXT PRIMARY KEY, owner_uid TEXT, likes INTEGER NOT NULL);
CREATE TABLE explore_derived_state(id INTEGER PRIMARY KEY, seq INTEGER NOT NULL);
CREATE TABLE explore_derived_changes(scope TEXT,kind TEXT,id TEXT,seq INTEGER,
 PRIMARY KEY(scope,kind,id));
CREATE INDEX idx_explore_rank_popular ON explore_derived_tracks(likes DESC,id DESC);
INSERT INTO track_stats VALUES('song',0);
INSERT INTO explore_derived_tracks VALUES('song','owner',0);
INSERT INTO explore_derived_state VALUES(1,0);
CREATE TRIGGER stats_like AFTER UPDATE ON track_stats BEGIN
 UPDATE explore_derived_tracks SET likes=NEW.like_count WHERE id=NEW.track_id;
END;
CREATE TRIGGER derived_like AFTER UPDATE ON explore_derived_tracks BEGIN
 UPDATE explore_derived_state SET seq=seq+1 WHERE id=1;
 INSERT INTO explore_derived_changes(scope,kind,id,seq)
 VALUES ('feed','track',NEW.id,(SELECT seq FROM explore_derived_state WHERE id=1))
 ON CONFLICT(scope,kind,id) DO UPDATE SET seq=excluded.seq;
 INSERT INTO explore_derived_changes(scope,kind,id,seq)
 VALUES ('profile:' || NEW.owner_uid,'track',NEW.id,(SELECT seq FROM explore_derived_state WHERE id=1))
 ON CONFLICT(scope,kind,id) DO UPDATE SET seq=excluded.seq;
END;
""")

def action(desired: bool) -> int:
    before = db.total_changes
    db.execute('BEGIN IMMEDIATE')
    try:
        if desired:
            db.execute('INSERT OR IGNORE INTO likes VALUES (?,?)',('song','user'))
            db.execute('UPDATE track_stats SET like_count=like_count+1 '
                       'WHERE track_id=? AND changes()=1', ('song',))
        else:
            db.execute('DELETE FROM likes WHERE track_id=? AND user_uid=?',('song','user'))
            db.execute('UPDATE track_stats SET like_count=like_count-1 '
                       'WHERE track_id=? AND changes()=1', ('song',))
        db.execute('COMMIT')
    except BaseException:
        db.execute('ROLLBACK')
        raise
    return db.total_changes-before

assert action(True) == 6
assert action(True) == 0
assert action(False) == 6
assert action(False) == 0
assert db.execute('SELECT like_count FROM track_stats').fetchone()[0] == 0
assert db.execute('SELECT likes FROM explore_derived_tracks').fetchone()[0] == 0
assert db.execute('SELECT seq FROM explore_derived_state').fetchone()[0] == 2
assert db.execute('SELECT count(*) FROM explore_derived_changes').fetchone()[0] == 2
print('134_SQLITE_LOGICAL_CHANGES_FRESH_LIKE=6')
print('134_SQLITE_LOGICAL_CHANGES_DUPLICATE_LIKE=0')
print('134_SQLITE_LOGICAL_CHANGES_FRESH_UNLIKE=6')
print('134_SQLITE_LOGICAL_CHANGES_DUPLICATE_UNLIKE=0')
print('134_INDEX_WRITE_CHARGE=EXCLUDED_FROM_SQLITE_TOTAL_CHANGES')
print('134_D1_LIVE_ROWS_WRITTEN=NOT_MEASURED')

# 145: Unfold the six logical changes into explicit per-table state deltas.
# This mirrors the actual 032/033 trigger graph, NOT the live D1 billing API.
# A 069 intake and its eventual DELETE add two more logical changes. Its
# WITHOUT ROWID primary key and other indexes need a real D1 meter to price.
assert db.execute('SELECT COUNT(*) FROM sqlite_schema WHERE type=\'index\' AND name=\'idx_explore_rank_popular\'').fetchone()[0] == 1
assert db.execute('SELECT COUNT(*) FROM sqlite_schema WHERE type=\'trigger\'').fetchone()[0] == 2
logical_breakdown = {
    'likes_relation': 1,
    'track_stats': 1,
    'explore_derived_tracks': 1,
    'explore_derived_state': 1,
    'feed_journal': 1,
    'profile_journal': 1,
}
assert sum(logical_breakdown.values()) == 6
assert sum(logical_breakdown.values()) + 2 == 8
print('145_DIRECT_CANONICAL_LOGICAL_BREAKDOWN=' + ','.join(
    f'{key}:{value}' for key, value in logical_breakdown.items()))
print('145_069_QUEUE_ENQUEUE_AND_DELETE_ADDITIONAL_LOGICAL_CHANGES=2')
print('145_069_SOURCE_MODEL_WITH_DERIVED_TRIGGER_LOGICAL_CHANGES=8')
print('145_INDEX_ENTRIES_AND_LIVE_D1_ROWS_WRITTEN=NOT_MEASURED')
print('145_DIRECT_RELATION_ONLY_CANDIDATE_REQUIRES_COUNT_AND_RANK_REDESIGN=TRUE')


# 148: Execute the 146 relation-only proposal against the SAME in-memory
# 032/033 trigger fixture. This deliberately leaves track_stats unchanged:
# old readers must be migrated BEFORE any real source cutover. No live data.
before_relation = db.total_changes
db.execute("INSERT OR IGNORE INTO likes VALUES('song','user')")
assert db.total_changes - before_relation == 1
assert db.execute("SELECT COUNT(*) FROM likes").fetchone()[0] == 1
assert db.execute("SELECT like_count FROM track_stats").fetchone()[0] == 0
assert db.execute("SELECT likes FROM explore_derived_tracks").fetchone()[0] == 0
assert db.execute("SELECT seq FROM explore_derived_state").fetchone()[0] == 2
before_duplicate = db.total_changes
db.execute("INSERT OR IGNORE INTO likes VALUES('song','user')")
assert db.total_changes - before_duplicate == 0
before_unlike = db.total_changes
db.execute("DELETE FROM likes WHERE track_id='song' AND user_uid='user'")
assert db.total_changes - before_unlike == 1
assert db.execute("SELECT COUNT(*) FROM likes").fetchone()[0] == 0
assert db.execute("SELECT like_count FROM track_stats").fetchone()[0] == 0
print('148_RELATION_ONLY_WITH_032_033_TRIGGERS_LOGICAL_LIKE=1')
print('148_RELATION_ONLY_WITH_032_033_TRIGGERS_LOGICAL_DUPLICATE=0')
print('148_RELATION_ONLY_WITH_032_033_TRIGGERS_LOGICAL_UNLIKE=1')
print('148_LEGACY_TRACK_STATS_AND_DERIVED_LIKES_NOT_UPDATED=CONFIRMED')
print('148_EXISTING_READERS_REQUIRE_COMPATIBILITY_CUTOVER=FAIL')
print('148_CLOUDFLARE_INDEX_ROWS_WRITTEN=NOT_MEASURED')

print('134_DIRECT_TWO_D1_ROWS_RELEASE_GATE=FAIL_TRIGGER_FANOUT')
print('134_USER_DATA_AND_DEPLOY=UNTOUCHED')

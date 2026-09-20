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
print('134_DIRECT_TWO_D1_ROWS_RELEASE_GATE=FAIL_TRIGGER_FANOUT')
print('134_USER_DATA_AND_DEPLOY=UNTOUCHED')

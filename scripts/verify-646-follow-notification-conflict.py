# APP646 synthetic-only proof of the actual D1 UPSERT + duplicate Follow
# notification error. Uses SQLite in memory; NEVER touches live shared D1.
import json
import sqlite3
import subprocess

fixtures = json.loads(subprocess.check_output(
    ['node', 'scripts/app646-follow-notification-conflict.mjs', '--fixture-json'],
    text=True
))
INSERT = 'soridraw_notification_follow_overlay_insert_002'
UPDATE = 'soridraw_notification_follow_overlay_update_002'
base = """
CREATE TABLE follows (
 follower_uid TEXT NOT NULL, following_uid TEXT NOT NULL, created_at INTEGER NOT NULL,
 PRIMARY KEY(follower_uid,following_uid)
);
CREATE TABLE explore_follow_overrides_348 (
 follower_uid TEXT NOT NULL, following_uid TEXT NOT NULL,
 following INTEGER NOT NULL CHECK(following IN(0,1)),
 baseline_following INTEGER NOT NULL CHECK(baseline_following IN(0,1)),
 updated_at INTEGER NOT NULL, mutation_id TEXT NOT NULL,
 PRIMARY KEY(follower_uid,following_uid),CHECK(follower_uid<>following_uid)
) WITHOUT ROWID;
CREATE TABLE public_profiles(uid TEXT PRIMARY KEY NOT NULL,
 nickname TEXT NOT NULL DEFAULT '', is_public INTEGER NOT NULL DEFAULT 1);
INSERT INTO public_profiles VALUES('ACTOR','Actor',1),('OWNER','Owner',1),('NEXT','Next',1);
CREATE TABLE soridraw_notification_activation_002 (
 id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 0);
INSERT INTO soridraw_notification_activation_002 VALUES(1,1);
CREATE TABLE soridraw_notification_inbox_001 (
 receiver_uid TEXT NOT NULL, bucket_ms INTEGER NOT NULL,
 category TEXT NOT NULL CHECK(category IN ('like','follow')),
 actor_uid TEXT NOT NULL, subject_id TEXT NOT NULL,
 actor_name TEXT NOT NULL, subject_title TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL,
 PRIMARY KEY(receiver_uid,bucket_ms,category,actor_uid,subject_id),
 CHECK(receiver_uid<>actor_uid)
) WITHOUT ROWID;
"""
write = """
WITH baseline(following) AS (
 SELECT EXISTS(SELECT 1 FROM follows WHERE follower_uid=? AND following_uid=?)
) INSERT INTO explore_follow_overrides_348(
 follower_uid,following_uid,following,baseline_following,updated_at,mutation_id
) SELECT ?,?,?,baseline.following,?,? FROM baseline
 WHERE baseline.following<>? OR EXISTS(
  SELECT 1 FROM explore_follow_overrides_348 WHERE follower_uid=? AND following_uid=?
 )
 ON CONFLICT(follower_uid,following_uid) DO UPDATE SET
 following=excluded.following,updated_at=excluded.updated_at,
 mutation_id=excluded.mutation_id
 WHERE explore_follow_overrides_348.updated_at<excluded.updated_at
   AND explore_follow_overrides_348.following<>excluded.following
"""

def conn(mode):
    d = sqlite3.connect(':memory:')
    d.executescript(base)
    for name in [INSERT, UPDATE]:
        d.executescript(fixtures[mode][name]+';')
    return d

def set_edge(d, uid, desired, revision):
    params = (uid,'OWNER',uid,'OWNER',desired,revision,
        'synthetic-id-'+str(revision), desired,uid,'OWNER')
    d.execute(write, params)

def rows(d):
    return d.execute('SELECT following,updated_at FROM explore_follow_overrides_348 '
        "WHERE follower_uid='ACTOR' AND following_uid='OWNER'").fetchone()

# Original defect must reproduce, proving the guard is meaningful.
for start_mode in ('insert','update'):
    old=conn('original')
    if start_mode=='insert':
        old.execute("""INSERT INTO soridraw_notification_inbox_001 VALUES
          ('OWNER',0,'follow','ACTOR','OWNER','Actor','',1)""")
    else:
        set_edge(old,'ACTOR',1,1)
        set_edge(old,'ACTOR',0,2)
    try:
        set_edge(old,'ACTOR',1,3)
        raise AssertionError('Original SQL unexpectedly did not fail')
    except sqlite3.IntegrityError as e:
        assert 'UNIQUE constraint failed' in str(e)
print('APP646_ORIGINAL_DUPLICATE_NOTIFICATION_REPRODUCED_INSERT_AND_UPDATE=PASS')

# Patched trigger: both changed relation and existing notification survive.
for start_mode in ('insert','update'):
    d=conn('patched')
    if start_mode=='insert':
        d.execute("""INSERT INTO soridraw_notification_inbox_001 VALUES
          ('OWNER',0,'follow','ACTOR','OWNER','Actor','',1)""")
    else:
        set_edge(d,'ACTOR',1,1)
        set_edge(d,'ACTOR',0,2)
    set_edge(d,'ACTOR',1,3)
    assert rows(d)==(1,3)
    assert d.execute("SELECT COUNT(*) FROM soridraw_notification_inbox_001").fetchone()[0]==1
    set_edge(d,'ACTOR',0,4)
    set_edge(d,'ACTOR',1,5)
    assert rows(d)==(1,5)
    assert d.execute("SELECT COUNT(*) FROM soridraw_notification_inbox_001").fetchone()[0]==1
print('APP646_DUPLICATE_REFOLLOW_SAVES_CANONICAL_EDGE_INSTEAD_OF_500=PASS')

# Existing notification for actor A must never suppress another actor's edge.
d=conn('patched')
set_edge(d,'ACTOR',1,1)
set_edge(d,'NEXT',1,1)
assert d.execute("SELECT COUNT(*) FROM soridraw_notification_inbox_001").fetchone()[0]==2
assert d.execute("SELECT COUNT(*) FROM explore_follow_overrides_348 WHERE following=1").fetchone()[0]==2
print('APP646_OTHER_FOLLOWERS_UNCHANGED_AND_NOTIFICATION_DEDUPED=PASS')

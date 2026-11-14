# APP650 isolated SQLite proof: inbox trigger writes must not count as
# second primary relation row. Only in-memory synthetic data is used.
import sqlite3
con=sqlite3.connect(':memory:')
con.executescript("""
CREATE TABLE follows(follower_uid TEXT,following_uid TEXT);
CREATE TABLE explore_follow_overrides_348(follower_uid TEXT,following_uid TEXT,
 following INTEGER,baseline_following INTEGER,updated_at INTEGER,mutation_id TEXT,
 UNIQUE(follower_uid,following_uid));
CREATE TABLE inbox(actor TEXT,target TEXT);
CREATE TRIGGER notify_insert AFTER INSERT ON explore_follow_overrides_348
 WHEN NEW.following=1 BEGIN INSERT INTO inbox VALUES(NEW.follower_uid,NEW.following_uid); END;
CREATE TRIGGER notify_refollow AFTER UPDATE OF following ON explore_follow_overrides_348
 WHEN OLD.following=0 AND NEW.following=1
 BEGIN INSERT INTO inbox VALUES(NEW.follower_uid,NEW.following_uid); END;
""")
sql="""WITH baseline(following) AS (
 SELECT EXISTS(SELECT 1 FROM follows WHERE follower_uid=? AND following_uid=?))
 INSERT INTO explore_follow_overrides_348(
 follower_uid,following_uid,following,baseline_following,updated_at,mutation_id)
 SELECT ?,?,?,baseline.following,?,? FROM baseline
 WHERE baseline.following <> ? OR EXISTS(
 SELECT 1 FROM explore_follow_overrides_348 WHERE follower_uid=? AND following_uid=?)
 ON CONFLICT(follower_uid,following_uid) DO UPDATE SET
 following=excluded.following,updated_at=excluded.updated_at,mutation_id=excluded.mutation_id
 WHERE explore_follow_overrides_348.updated_at < excluded.updated_at
 AND explore_follow_overrides_348.following <> excluded.following
 RETURNING 1 AS relation_changed"""
for i,(following,expected_total,expected_primary) in enumerate([(1,2,1),(0,1,1),(1,2,1),(1,0,0)]):
 before=con.total_changes
 args=('actor','target','actor','target',following,i+1,'id'+str(i),following,'actor','target')
 rows=con.execute(sql,args).fetchall()
 assert len(rows)==expected_primary, (i,rows)
 assert con.total_changes-before==expected_total,(i,con.total_changes-before)
assert con.execute('SELECT COUNT(*) FROM inbox').fetchone()[0]==2
assert con.execute('SELECT following FROM explore_follow_overrides_348').fetchone()[0]==1
print('APP650_FOLLOW_UNFOLLOW_REFOLLOW_NOOP_PRIMARY_ROW_RETURNING=PASS')
print('APP650_TRIGGER_SIDE_EFFECT_NOT_MISCOUNTED=PASS')

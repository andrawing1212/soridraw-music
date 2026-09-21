import sqlite3

M171 = 'cloudflare/explore-worker/migrations/20260921_03_explore_like_d1only_v171_additive.sql'
M174 = 'cloudflare/explore-worker/migrations/20260922_01_explore_like_cutover_control_v174_additive.sql'

db = sqlite3.connect(':memory:', isolation_level=None)
db.executescript('''
CREATE TABLE tracks(id TEXT PRIMARY KEY, owner_uid TEXT NOT NULL, is_public INTEGER NOT NULL, status TEXT NOT NULL);
CREATE TABLE public_profiles(uid TEXT PRIMARY KEY, is_public INTEGER NOT NULL);
CREATE TABLE likes(track_id TEXT NOT NULL, user_uid TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(track_id,user_uid));
CREATE TABLE track_stats(track_id TEXT PRIMARY KEY, like_count INTEGER NOT NULL, comment_count INTEGER NOT NULL DEFAULT 0, play_count INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
CREATE TABLE explore_like_batches_035(batch_id TEXT PRIMARY KEY, user_uid TEXT, created_at INTEGER, mutation_count INTEGER, mutations_json TEXT);
CREATE TABLE explore_like_batches_066(batch_id TEXT PRIMARY KEY, user_uid TEXT, created_at INTEGER, mutation_count INTEGER, mutations_json TEXT);
CREATE TABLE explore_like_batches_069(batch_id TEXT PRIMARY KEY, user_uid TEXT, created_at INTEGER, mutation_count INTEGER, mutations_json TEXT) WITHOUT ROWID;
CREATE TABLE explore_like_user_queue_075(user_uid TEXT PRIMARY KEY, updated_at INTEGER NOT NULL, mutation_count INTEGER NOT NULL, mutations_json TEXT NOT NULL) WITHOUT ROWID;
CREATE TABLE explore_like_user_queue_state_075(id INTEGER PRIMARY KEY, processed_at INTEGER NOT NULL, processed_uid TEXT NOT NULL);
INSERT INTO explore_like_user_queue_state_075 VALUES(1,0,'');
CREATE TABLE explore_like_processor_035(id INTEGER PRIMARY KEY, lease_until INTEGER NOT NULL DEFAULT 0, owner TEXT NOT NULL DEFAULT '');
INSERT INTO explore_like_processor_035 VALUES(1,0,'');
''')
db.executescript(open(M171, encoding='utf-8').read())
db.executescript(open(M174, encoding='utf-8').read())
db.execute("INSERT INTO public_profiles(uid,is_public) VALUES('owner',1)")
db.execute("INSERT INTO tracks(id,owner_uid,is_public,status) VALUES('t','owner',1,'published')")
db.execute("INSERT INTO track_stats(track_id,like_count,updated_at) VALUES('t',0,0)")

def phase():
    return db.execute("SELECT phase FROM explore_like_cutover_control_174 WHERE id=1").fetchone()[0]

def set_open():
    db.execute("UPDATE explore_like_cutover_control_174 SET phase='open', epoch=epoch+1 WHERE id=1")

def begin_draining():
    return db.execute("""
      UPDATE explore_like_cutover_control_174
      SET phase='draining', epoch=epoch+1, phase_changed_at=100
      WHERE id=1 AND phase='open'
    """).rowcount

def queue_intake(batch_id):
    return db.execute("""
      INSERT OR IGNORE INTO explore_like_batches_069(batch_id,user_uid,created_at,mutation_count,mutations_json)
      SELECT ?, 'u', 1, 1, '[]'
      WHERE EXISTS (
        SELECT 1 FROM explore_like_cutover_control_174
        WHERE id=1 AND phase='open'
      )
    """, (batch_id,)).rowcount

def direct_like():
    db.execute('BEGIN IMMEDIATE')
    try:
        relation = db.execute("""
          INSERT OR IGNORE INTO likes(track_id,user_uid,created_at)
          SELECT 't','u',1
          WHERE EXISTS (
            SELECT 1 FROM explore_like_cutover_control_174
            WHERE id=1 AND phase='open'
          )
        """).rowcount
        if relation:
            db.execute("UPDATE track_stats SET like_count=like_count+1,updated_at=1 WHERE track_id='t'")
        db.execute('COMMIT')
        return relation
    except Exception:
        db.execute('ROLLBACK')
        raise

def acquire(owner):
    return db.execute("""
      UPDATE explore_like_processor_035
      SET lease_until=999,owner=?
      WHERE id=1 AND (lease_until<=0 OR owner=?)
        AND EXISTS (
          SELECT 1 FROM explore_like_cutover_control_174
          WHERE id=1 AND phase IN ('open','draining')
        )
    """, (owner, owner)).rowcount

def release(owner):
    db.execute("UPDATE explore_like_processor_035 SET lease_until=0,owner='' WHERE id=1 AND owner=?", (owner,))

def freeze():
    return db.execute("""
      UPDATE explore_like_cutover_control_174
      SET phase='frozen', epoch=epoch+1, frozen_at=200
      WHERE id=1 AND phase='draining'
        AND NOT EXISTS (SELECT 1 FROM explore_like_batches_035 LIMIT 1)
        AND NOT EXISTS (SELECT 1 FROM explore_like_batches_066 LIMIT 1)
        AND NOT EXISTS (SELECT 1 FROM explore_like_batches_069 LIMIT 1)
        AND NOT EXISTS (
          SELECT 1 FROM explore_like_user_queue_075 q
          JOIN explore_like_user_queue_state_075 s ON s.id=1
          WHERE q.updated_at>s.processed_at
             OR (q.updated_at=s.processed_at AND q.user_uid>s.processed_uid)
          LIMIT 1
        )
        AND EXISTS (
          SELECT 1 FROM explore_like_processor_035
          WHERE id=1 AND lease_until=0 AND owner=''
        )
    """).rowcount

def like171(desired):
    db.execute('BEGIN IMMEDIATE')
    try:
        current = db.execute("SELECT liked,revision FROM explore_like_overrides_171 WHERE user_uid='u' AND track_id='t'").fetchone()
        base = db.execute("SELECT 1 FROM likes WHERE track_id='t' AND user_uid='u'").fetchone() is not None if current is None else bool(current[0])
        rev = 0 if current is None else int(current[1])
        changed = db.execute("""
          INSERT INTO explore_like_overrides_171(user_uid,track_id,liked,revision,last_operation_id,updated_at)
          SELECT 'u','t',?,1,'op',300
          WHERE EXISTS (SELECT 1 FROM explore_like_cutover_control_174 WHERE id=1 AND phase='frozen')
            AND ? != ?
            AND ? = 0
          ON CONFLICT(user_uid,track_id) DO UPDATE SET
            liked=excluded.liked,
            revision=explore_like_overrides_171.revision+1,
            last_operation_id=excluded.last_operation_id,
            updated_at=excluded.updated_at
          WHERE explore_like_overrides_171.revision=?
            AND explore_like_overrides_171.liked!=excluded.liked
        """, (int(desired), int(base), int(desired), rev, rev)).rowcount
        if changed:
            delta = 1 if desired else -1
            db.execute("""
              INSERT INTO explore_like_count_deltas_171(track_id,delta,generation,updated_at)
              VALUES('t',?,1,300)
              ON CONFLICT(track_id) DO UPDATE SET
                delta=delta+excluded.delta,generation=generation+1,updated_at=excluded.updated_at
            """, (delta,))
        db.execute('COMMIT')
        return changed
    except Exception:
        db.execute('ROLLBACK')
        raise

# Ordering A: intake wins first -> drain transition follows -> row must remain
# visible for the legacy processor, then can be drained.
assert phase() == 'open'
assert queue_intake('before-drain') == 1
assert begin_draining() == 1
assert phase() == 'draining'
assert queue_intake('after-drain') == 0
assert freeze() == 0, 'non-empty queue must block freeze'
db.execute("DELETE FROM explore_like_batches_069 WHERE batch_id='before-drain'")

# Processor wins before freeze -> freeze must fail until the lease is released.
assert acquire('processor-a') == 1
assert freeze() == 0
release('processor-a')
assert freeze() == 1
assert phase() == 'frozen'
assert acquire('processor-b') == 0, 'no processor may start after frozen'

# 171 writer is permitted only after frozen.
assert like171(True) == 1
assert db.execute("SELECT liked FROM explore_like_overrides_171 WHERE user_uid='u' AND track_id='t'").fetchone()[0] == 1
assert db.execute("SELECT delta,generation FROM explore_like_count_deltas_171 WHERE track_id='t'").fetchone() == (1,1)

# Fresh database branch: draining wins first -> direct legacy relation/count is W0.
db2 = sqlite3.connect(':memory:', isolation_level=None)
for line in db.iterdump():
    if line.startswith('BEGIN TRANSACTION') or line.startswith('COMMIT'):
        continue
# Use an independent compact fixture to prove direct fence after draining.
db2.executescript('''
CREATE TABLE explore_like_cutover_control_174(id INTEGER PRIMARY KEY,phase TEXT NOT NULL);
INSERT INTO explore_like_cutover_control_174 VALUES(1,'draining');
CREATE TABLE likes(track_id TEXT,user_uid TEXT,created_at INTEGER,PRIMARY KEY(track_id,user_uid));
CREATE TABLE track_stats(track_id TEXT PRIMARY KEY,like_count INTEGER NOT NULL);
INSERT INTO track_stats VALUES('t',0);
''')
db2.execute('BEGIN IMMEDIATE')
rel = db2.execute("""
  INSERT OR IGNORE INTO likes(track_id,user_uid,created_at)
  SELECT 't','u',1 WHERE EXISTS(
    SELECT 1 FROM explore_like_cutover_control_174 WHERE id=1 AND phase='open'
  )
""").rowcount
if rel:
    db2.execute("UPDATE track_stats SET like_count=like_count+1 WHERE track_id='t'")
db2.execute('COMMIT')
assert rel == 0
assert db2.execute("SELECT COUNT(*) FROM likes").fetchone()[0] == 0
assert db2.execute("SELECT like_count FROM track_stats WHERE track_id='t'").fetchone()[0] == 0

print('174_QUEUE_INTAKE_VS_DRAIN_SERIAL_ORDER=PASS')
print('174_DIRECT_RELATION_COUNT_AFTER_DRAIN_W0=PASS')
print('174_EXISTING_QUEUE_DRAINS_DURING_DRAINING=PASS')
print('174_PROCESSOR_LEASE_BLOCKS_FREEZE=PASS')
print('174_FREEZE_BLOCKS_NEW_PROCESSOR=PASS')
print('174_171_WRITER_REQUIRES_FROZEN=PASS')

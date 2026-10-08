import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

// SORIDRAW RTDB trusted-publisher Stage A (OFFLINE PROTOTYPE ONLY).
// NO Firebase/Cloudflare credentials, network calls, live D1 mutations, or app integration.
// Patch040's real D1 aggregate uses INSERT OR IGNORE and DELETE membership statements.
// Adding RETURNING track_id to EXISTING writes can report changed-item IDs without
// a standalone SELECT. This is NOT proof of Cloudflare D1 rows_read=0,
// Worker support, settled-count timing, or 100k-user cost safety.
function harness() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE likes(track_id TEXT NOT NULL, user_uid TEXT NOT NULL,
    created_at INTEGER NOT NULL, PRIMARY KEY(track_id,user_uid));`);
  const insert = db.prepare(`INSERT OR IGNORE INTO likes(track_id,user_uid,created_at)
    VALUES(?,?,?) RETURNING track_id`);
  const remove = db.prepare(`DELETE FROM likes WHERE track_id=? AND user_uid=?
    RETURNING track_id`);
  const apply = (changes, now) => {
    const affected = new Set();
    let writes = 0;
    for (const [uid, trackId, liked] of changes) {
      const rows = liked ? insert.all(trackId, uid, now) : remove.all(trackId, uid);
      writes += rows.length;
      for (const row of rows) affected.add(row.track_id);
    }
    return { affected: [...affected].sort(), writes };
  };
  return { db, apply };
}
function test(label, operation) {
  operation();
  console.log(`${label}=PASS`);
}
test('RETURNING_INSERT_ONLY_REAL_CHANGE', () => {
  const { db, apply } = harness();
  assert.deepEqual(apply([['A','track-1',true]], 1), { affected:['track-1'], writes:1 });
  assert.deepEqual(apply([['A','track-1',true]], 2), { affected:[], writes:0 });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM likes').get().n, 1);
  db.close();
});
test('RETURNING_DELETE_ONLY_EXISTING', () => {
  const { db, apply } = harness();
  assert.deepEqual(apply([['A','track-1',false]], 1), { affected:[], writes:0 });
  apply([['A','track-1',true]], 2);
  assert.deepEqual(apply([['A','track-1',false]], 3), { affected:['track-1'], writes:1 });
  assert.deepEqual(apply([['A','track-1',false]], 4), { affected:[], writes:0 });
  db.close();
});
test('RETURNING_BOUNDED_CHANGED_TRACKS_NOT_FIRST_PAGE', () => {
  const { db, apply } = harness();
  const batch = apply([
    ['A','unlisted-999',true], ['B','unlisted-999',true], ['A','other-1000',true],
  ], 1);
  assert.deepEqual(batch, { affected:['other-1000','unlisted-999'], writes:3 });
  assert.deepEqual(apply([['A','unlisted-999',false]], 2), {
    affected:['unlisted-999'], writes:1,
  });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM likes').get().n, 2);
  db.close();
});
test('RETURNING_NO_EXTRA_SELECT_SQL', () => {
  const { db, apply } = harness();
  assert.deepEqual(apply([], 1), { affected:[], writes:0 });
  assert.deepEqual(apply([
    ['A','track-2',true], ['A','track-2',true],
  ], 1), { affected:['track-2'], writes:1 });
  db.close();
});
console.log('SQLITE_PROOF_ONLY__D1_ROWS_READ_AND_LIVE_WORKER_NOT_VERIFIED');

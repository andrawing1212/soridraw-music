import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';

const path = 'cloudflare/explore-worker/canonical/preview-worker.js';
const current = readFileSync(path, 'utf8');
const baseline = execFileSync('git', ['show', '2817327ee17f04fe248df237a3daefa3cf5bf3c5:' + path], { encoding: 'utf8', maxBuffer: 10_000_000 });
function extract(source) {
  const start = source.indexOf('async function adjustExploreFollowCountersDelta(');
  const end = source.indexOf('\n__name(adjustExploreFollowCountersDelta', start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
}
function fixture() {
  const db = new DatabaseSync(':memory:');
  const root = 'cloudflare/explore-worker/';
  db.exec(readFileSync(root + 'scripts/fixtures/canonical-schema.sql', 'utf8'));
  db.exec(readFileSync(root + 'migrations/20260910_01_explore_derived_state.sql', 'utf8'));
  db.exec(readFileSync(root + 'migrations/20260930_01_profile_source_trigger_compaction.sql', 'utf8'));
  db.exec(`CREATE TABLE follows(follower_uid TEXT NOT NULL,following_uid TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(follower_uid,following_uid));
    CREATE INDEX idx_verify_following ON follows(following_uid,follower_uid);
    INSERT INTO public_profiles(uid,nickname,created_at,updated_at) VALUES('a','A',1,1),('b','B',1,1);
    INSERT INTO profile_stats(uid,updated_at) VALUES('a',1),('b',1);
    INSERT OR IGNORE INTO explore_derived_profiles(uid) VALUES('a'),('b');`);
  let writes = 0, reads = 0;
  const queries = [];
  const changes = () => Number(db.prepare('SELECT total_changes() AS n').get().n);
  const adapter = {
    prepare(sql) {
      assert.doesNotMatch(sql, /COUNT\s*\(|SELECT\s+\*/i, 'no whole relationship/profile reads');
      return { bind(...args) {
        const run = () => {
          queries.push(sql);
          if (/^\s*SELECT/i.test(sql)) reads++; else writes++;
          return { results: db.prepare(sql).all(...args) };
        };
        return { all: async () => run(), run };
      } };
    },
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const results = statements.map((statement) => statement.run());
        db.exec('COMMIT');
        return results;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
  return { db, changes, queries, env: { DB: adapter }, counters: () => ({ read: reads, write: writes }) };
}
async function measure(source, label) {
  const f = fixture();
  const mutate = vm.runInNewContext('(' + extract(source) + ')');
  const samples = [];
  const feedSeq = () => JSON.stringify(f.db.prepare("SELECT * FROM explore_derived_changes WHERE scope='feed' ORDER BY kind,id").all());
  const feedBefore = feedSeq();
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const following of [true, false]) {
      const before = f.changes(), counts = f.counters();
      const result = await mutate(f.env, 'a', 'b', following, 100 + cycle * 2);
      const after = f.counters();
      samples.push({ action: following ? 'follow' : 'unfollow', queryR: after.read - counts.read,
        queryW: after.write - counts.write, sqliteRowChanges: f.changes() - before });
      assert.equal(result.delta, following ? 1 : -1);
      assert.equal(result.follower.following_count, following ? 1 : 0);
      assert.equal(result.following.follower_count, following ? 1 : 0);
      assert.equal(f.db.prepare('SELECT following FROM explore_derived_profiles WHERE uid=?').get('a').following, following ? 1 : 0);
      assert.equal(f.db.prepare('SELECT followers FROM explore_derived_profiles WHERE uid=?').get('b').followers, following ? 1 : 0);
      assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM follows').get().n, following ? 1 : 0);
    }
  }
  assert.equal(feedSeq(), feedBefore, 'follow must not invalidate or rebuild the Feed');
  for (const sql of f.queries.filter((sql) => label === 'candidate' && /UPDATE profile_stats/.test(sql))) {
    const plan = f.db.prepare('EXPLAIN QUERY PLAN ' + sql).all('a','b',1,'a','b','a','b');
    if (label === 'candidate') assert.ok(plan.every((row) => !/SCAN (?:profile_stats|follows)/.test(row.detail)));
  }
  f.db.close();
  console.log(label, JSON.stringify(samples));
  return samples;
}
const old = await measure(baseline, 'baseline');
const next = await measure(current, 'candidate');
assert.ok(old.every((s) => s.queryR === 0 && s.queryW === 3));
assert.ok(next.every((s) => s.queryR === 0 && s.queryW === 2));
assert.deepEqual(next.map((s) => s.sqliteRowChanges), old.map((s) => s.sqliteRowChanges));
const duplicate = fixture();
const mutate = vm.runInNewContext('(' + extract(current) + ')');
await mutate(duplicate.env, 'a', 'b', true, 123);
let before = duplicate.changes();
assert.equal((await mutate(duplicate.env, 'a', 'b', true, 123)).delta, 0);
assert.equal(duplicate.changes() - before, 0, 'same-millisecond duplicate must not increment counters');
await mutate(duplicate.env, 'a', 'b', false, 124);
before = duplicate.changes();
assert.equal((await mutate(duplicate.env, 'a', 'b', false, 124)).delta, 0);
assert.equal(duplicate.changes() - before, 0);
duplicate.db.close();
// Simulated storage failure rolls the complete atomic batch back.
const rollback = fixture();
rollback.db.exec("CREATE TRIGGER verify_fail BEFORE UPDATE ON profile_stats WHEN NEW.uid='b' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;");
await assert.rejects(mutate(rollback.env, 'a', 'b', true, 130), /synthetic failure/);
assert.equal(rollback.db.prepare('SELECT COUNT(*) AS n FROM follows').get().n, 0);
assert.equal(rollback.db.prepare("SELECT following_count AS n FROM profile_stats WHERE uid='a'").get().n, 0);
rollback.db.close();
console.log('FOLLOW_FUNCTIONAL_3_CYCLES=PASS');
console.log('FOLLOW_LOGICAL_QUERY_W3_TO_W2=PASS');
console.log('FOLLOW_SQLITE_TRIGGER_AMPLIFICATION=UNRESOLVED');
console.log('FOLLOW_PHYSICAL_D1_ROWS_WORKER_R2=UNVERIFIED (SQLite total_changes is not D1 billing metadata)');

// Actual before/after request metrics must come from PREVIEW, not SQLite or
// hardcoded expected headers. Six isolated samples = 3 follow/unfollow cycles.
const liveIndex = process.argv.indexOf('--live');
if (liveIndex >= 0) {
  const evidence = JSON.parse(readFileSync(process.argv[liveIndex + 1], 'utf8'));
  assert.equal(evidence.environment, 'preview');
  assert.match(evidence.commit, /^[a-f0-9]{40}$/);
  assert.equal(evidence.samples.length, 6);
  evidence.samples.forEach((s, i) => {
    assert.equal(s.action, i % 2 ? 'unfollow' : 'follow');
    for (const key of ['queryR','queryW','rowsRead','rowsWritten','worker','r2A','r2B']) assert.ok(Number.isSafeInteger(s[key]) && s[key] >= 0, key);
    // Repository WORK_AUDIT_CHECKLIST physical W1-W2 hard gate. The current
    // candidate knowingly cannot pass it: do not weaken it to hide the cascade.
    assert.ok(s.queryR <= 1 && s.queryW <= 2 && s.rowsRead < 18 && s.rowsWritten <= 2);
    assert.equal(s.worker, 1);
    assert.ok(s.requestId && s.timestamp, 'traceable PREVIEW sample required');
  });
  console.log('FOLLOW_PREVIEW_COST_EVIDENCE=PASS');
} else if (process.argv.includes('--release')) {
  throw new Error('Release blocked: PREVIEW physical Rows Read/Written + Worker + R2 evidence missing');
}

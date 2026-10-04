import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const path='cloudflare/explore-worker/candidates/348-follow-overlay.sql';
const sql=readFileSync(path,'utf8');
assert.match(sql,/CREATE TABLE IF NOT EXISTS explore_follow_overrides_348/);
assert.match(sql,/PRIMARY KEY \(follower_uid, following_uid\)[\s\S]*?WITHOUT ROWID/);
assert.match(sql,/CREATE INDEX IF NOT EXISTS idx_explore_follow_overrides_348_active_reverse/);
assert.match(sql,/WHERE following = 1/);
assert.match(sql,/phase IN \('legacy','armed','overlay'\)/);
assert.doesNotMatch(sql,/\b(?:UPDATE|DELETE)\s+(?:follows|profile_stats)\b/i,'candidate must not mutate legacy user rows');
assert.doesNotMatch(sql,/INSERT\s+INTO\s+explore_follow_overrides_348\s+SELECT/i,'candidate must not backfill overlay');

const db=new DatabaseSync(':memory:');
db.exec(`
CREATE TABLE follows(
  follower_uid TEXT NOT NULL,
  following_uid TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(follower_uid,following_uid)
);
CREATE INDEX idx_follows_follower_created ON follows(follower_uid,created_at DESC,following_uid);
CREATE INDEX idx_follows_following_created ON follows(following_uid,created_at DESC,follower_uid);
INSERT INTO follows VALUES('a','legacy',1);
`);
db.exec(sql);
const objects=db.prepare("SELECT type,name,sql FROM sqlite_schema WHERE name LIKE 'explore_follow_%348%' ORDER BY type,name").all();
assert.ok(objects.some(x=>x.name==='explore_follow_overrides_348'&&/WITHOUT ROWID/i.test(x.sql)));
assert.ok(objects.some(x=>x.name==='idx_explore_follow_overrides_348_active_reverse'&&/WHERE following = 1/i.test(x.sql)));
assert.equal(db.prepare("SELECT phase FROM explore_follow_cutover_control_348 WHERE id=1").get().phase,'legacy');

const effective=(target)=>Number(db.prepare(`
SELECT COALESCE(
 (SELECT following FROM explore_follow_overrides_348 WHERE follower_uid='a' AND following_uid=?),
 EXISTS(SELECT 1 FROM follows WHERE follower_uid='a' AND following_uid=?)
) AS following`).get(target,target).following);

assert.equal(effective('legacy'),1);
db.prepare("INSERT INTO explore_follow_overrides_348 VALUES('a','legacy',0,2,'m1')").run();
assert.equal(effective('legacy'),0);
db.prepare("DELETE FROM explore_follow_overrides_348 WHERE follower_uid='a' AND following_uid='legacy'").run();
assert.equal(effective('legacy'),1);
db.prepare("INSERT INTO explore_follow_overrides_348 VALUES('a','new',1,3,'m2')").run();
assert.equal(effective('new'),1);

const pairPlan=db.prepare("EXPLAIN QUERY PLAN SELECT following FROM explore_follow_overrides_348 WHERE follower_uid='a' AND following_uid='new'").all().map(x=>String(x.detail)).join(' | ');
assert.match(pairPlan,/SEARCH explore_follow_overrides_348 USING PRIMARY KEY/);
const reversePlan=db.prepare("EXPLAIN QUERY PLAN SELECT follower_uid FROM explore_follow_overrides_348 INDEXED BY idx_explore_follow_overrides_348_active_reverse WHERE following_uid='new' AND following=1").all().map(x=>String(x.detail)).join(' | ');
assert.match(reversePlan,/SEARCH explore_follow_overrides_348 USING INDEX idx_explore_follow_overrides_348_active_reverse/);

console.log('FOLLOW348_SCHEMA_ADDITIVE_NO_BACKFILL=PASS');
console.log('FOLLOW348_EFFECTIVE_BASELINE_OVERLAY=PASS');
console.log('FOLLOW348_FORWARD_PK_REVERSE_PARTIAL_INDEX=PASS');
console.log('FOLLOW348_SHARED_MIGRATION_APPLIED=NO');
console.log('FOLLOW348_REMOTE_BILLING_PROOF_RUN=37175419175');

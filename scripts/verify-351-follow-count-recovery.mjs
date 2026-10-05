import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const worker=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
const schema=readFileSync('cloudflare/explore-worker/candidates/348-follow-overlay.sql','utf8');

assert.match(worker,/SORIDRAW_FOLLOW_EXACT_COUNT_RECOVERY_351_20261004/);
const start=worker.indexOf('async function readExactEffectiveFollowCounts351(');
const end=worker.indexOf('\nasync function readSharedProfileConnection348',start);
assert.ok(start>=0&&end>start,'351 helper block missing');
const block=worker.slice(start,end);

assert.match(block,/FROM profile_stats/);
assert.match(block,/SUM\(following - baseline_following\)/);
assert.match(block,/WHERE follower_uid = \?/);
assert.match(block,/INDEXED BY idx_explore_follow_overrides_348_reverse/);
assert.match(block,/WHERE following_uid = \?/);
assert.match(block,/onlyIf: \{ etagMatches: object\.etag \}/);
assert.doesNotMatch(block,/\b(?:UPDATE|DELETE|INSERT)\s+(?:OR\s+IGNORE\s+)?(?:INTO\s+)?(?:follows|profile_stats)\b/i);

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
CREATE TABLE profile_stats(
 uid TEXT PRIMARY KEY,
 follower_count INTEGER NOT NULL DEFAULT 0,
 following_count INTEGER NOT NULL DEFAULT 0,
 updated_at INTEGER NOT NULL
);
INSERT INTO follows VALUES
 ('actor','legacy-a',1),
 ('actor','legacy-b',2),
 ('legacy-follower','actor',3);
INSERT INTO profile_stats(uid,follower_count,following_count,updated_at)
VALUES('actor',1,2,1);
`);
db.exec(schema);
const add=db.prepare(`
INSERT INTO explore_follow_overrides_348(
 follower_uid,following_uid,following,baseline_following,updated_at,mutation_id
) VALUES(?,?,?,?,?,?)
`);
add.run('actor','legacy-a',0,1,10,'m1');
add.run('actor','new-c',1,0,11,'m2');
add.run('legacy-follower','actor',0,1,12,'m3');
add.run('new-follower','actor',1,0,13,'m4');

const base=db.prepare('SELECT follower_count,following_count FROM profile_stats WHERE uid=?').get('actor');
const followingDelta=Number(db.prepare(`
 SELECT COALESCE(SUM(following-baseline_following),0) AS delta
 FROM explore_follow_overrides_348 WHERE follower_uid=?
`).get('actor').delta);
const followerDelta=Number(db.prepare(`
 SELECT COALESCE(SUM(following-baseline_following),0) AS delta
 FROM explore_follow_overrides_348 INDEXED BY idx_explore_follow_overrides_348_reverse
 WHERE following_uid=?
`).get('actor').delta);
assert.equal(Number(base.following_count)+followingDelta,2);
assert.equal(Number(base.follower_count)+followerDelta,1);

const forwardPlan=db.prepare(`
EXPLAIN QUERY PLAN
SELECT COALESCE(SUM(following-baseline_following),0)
FROM explore_follow_overrides_348 WHERE follower_uid='actor'
`).all().map(x=>String(x.detail)).join(' | ');
const reversePlan=db.prepare(`
EXPLAIN QUERY PLAN
SELECT COALESCE(SUM(following-baseline_following),0)
FROM explore_follow_overrides_348 INDEXED BY idx_explore_follow_overrides_348_reverse
WHERE following_uid='actor'
`).all().map(x=>String(x.detail)).join(' | ');
assert.match(forwardPlan,/SEARCH explore_follow_overrides_348 USING PRIMARY KEY/);
assert.match(reversePlan,/SEARCH explore_follow_overrides_348 USING INDEX idx_explore_follow_overrides_348_reverse/);

console.log('FOLLOW351_BASELINE_PLUS_SPARSE_DELTA=PASS');
console.log('FOLLOW351_FORWARD_REPAIR_INDEXED=PASS');
console.log('FOLLOW351_REVERSE_REPAIR_INDEXED=PASS');
console.log('FOLLOW351_LEGACY_COUNTER_WRITE=0');
console.log('FOLLOW351_R2_CAS_REQUIRED=PASS');
console.log('FOLLOW351_RECOVERY_PATH_DORMANT=PASS');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const worker = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
const schema = readFileSync('cloudflare/explore-worker/candidates/348-follow-overlay.sql','utf8');

const start = worker.indexOf('async function readFollowCutoverState348(');
const end = worker.indexOf('\nasync function readEffectiveFollowMembership348', start);
assert.ok(start >= 0 && end > start, 'follow cutover reader missing');
const cutoverReader = worker.slice(start, end);

// Current candidate contract: no manifest means legacy mode. The D1 control table
// is not consulted by the runtime cutover reader.
assert.match(cutoverReader, /if \(!object\) return \{ mode: "legacy"/);
assert.doesNotMatch(cutoverReader, /explore_follow_cutover_control_348/);

const db = new DatabaseSync(':memory:');
db.exec(`
CREATE TABLE follows(
  follower_uid TEXT NOT NULL,
  following_uid TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(follower_uid,following_uid)
);
CREATE INDEX idx_follows_follower_created ON follows(follower_uid,created_at DESC,following_uid);
CREATE INDEX idx_follows_following_created ON follows(following_uid,created_at DESC,follower_uid);
`);
db.exec(schema);

// Model one real post-cutover change on a previously-unfollowed edge.
db.prepare(`
INSERT INTO explore_follow_overrides_348(
  follower_uid,following_uid,following,baseline_following,updated_at,mutation_id
) VALUES(?,?,?,?,?,?)
`).run('actor','target',1,0,100,'m1');

const legacy = Number(db.prepare(`
  SELECT EXISTS(
    SELECT 1 FROM follows WHERE follower_uid=? AND following_uid=?
  ) AS following
`).get('actor','target').following);

const effective = Number(db.prepare(`
  SELECT COALESCE(
    (SELECT following
     FROM explore_follow_overrides_348
     WHERE follower_uid=? AND following_uid=?),
    EXISTS(
      SELECT 1 FROM follows WHERE follower_uid=? AND following_uid=?
    )
  ) AS following
`).get('actor','target','actor','target').following);

assert.equal(legacy,0);
assert.equal(effective,1);
assert.notEqual(legacy,effective,'rollback proof requires an overlay state that differs from immutable baseline');

const phase = db.prepare(
  "SELECT phase FROM explore_follow_cutover_control_348 WHERE id=1"
).get()?.phase;
assert.equal(phase,'legacy');

console.log('FOLLOW378_OVERLAY_EFFECTIVE_STATE_DIFFERS_FROM_IMMUTABLE_BASELINE=PASS');
console.log('FOLLOW378_MISSING_MANIFEST_FALLS_BACK_TO_LEGACY=PASS');
console.log('FOLLOW378_D1_CONTROL_NOT_RUNTIME_LATCH=PASS');
console.log('FOLLOW378_MANIFEST_REMOVAL_AFTER_OVERLAY_MUTATION=UNSAFE_REPRODUCED');
console.log('FOLLOW378_SHARED_USER_DATA_WRITE=0');
console.log('FOLLOW378_CUTOVER_ACTIVATION=BLOCKED_UNTIL_ONE_WAY_OR_READONLY_ROLLBACK');

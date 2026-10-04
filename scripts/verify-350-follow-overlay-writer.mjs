import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const worker = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
const schema = readFileSync('cloudflare/explore-worker/candidates/348-follow-overlay.sql','utf8');

const start = worker.indexOf('async function mutateFollowOverlayRelation350(');
assert.ok(start >= 0, 'missing mutateFollowOverlayRelation350');
const end = worker.indexOf('\n// SORIDRAW_FOLLOW_R2_DELTA_CAS_352', start);
assert.ok(end > start, 'writer helper boundary missing');
const fn = worker.slice(start, end);

assert.match(worker,/SORIDRAW_FOLLOW_OVERLAY_RELATION_WRITER_350_20261004/);
assert.match(fn,/DELETE FROM explore_follow_overrides_348/);
assert.match(fn,/WITH baseline\(following\)/);
assert.match(fn,/SELECT EXISTS\([\s\S]*?FROM follows/);
assert.match(fn,/INSERT INTO explore_follow_overrides_348/);
assert.match(fn,/ON CONFLICT\(follower_uid, following_uid\) DO UPDATE/);
assert.match(fn,/changes > 1/);
assert.doesNotMatch(fn,/\b(?:INSERT|UPDATE|DELETE)\s+(?:OR\s+IGNORE\s+)?(?:INTO\s+)?follows\b/i);
assert.doesNotMatch(fn,/profile_stats/i);

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
INSERT INTO follows VALUES('actor','legacy',1);
`);
db.exec(schema);

const mutate=(target,desired,at)=>{
  const del=db.prepare(`
    DELETE FROM explore_follow_overrides_348
    WHERE follower_uid=? AND following_uid=? AND baseline_following=?
  `).run('actor',target,desired);
  const up=db.prepare(`
    WITH baseline(following) AS (
      SELECT EXISTS(
        SELECT 1 FROM follows
        WHERE follower_uid=? AND following_uid=?
      )
    )
    INSERT INTO explore_follow_overrides_348(
      follower_uid,following_uid,following,baseline_following,updated_at,mutation_id
    )
    SELECT ?,?,?,baseline.following,?,?
    FROM baseline
    WHERE baseline.following<>?
    ON CONFLICT(follower_uid,following_uid) DO UPDATE SET
      following=excluded.following,
      baseline_following=explore_follow_overrides_348.baseline_following,
      updated_at=excluded.updated_at,
      mutation_id=excluded.mutation_id
    WHERE explore_follow_overrides_348.following<>excluded.following
  `).run('actor',target,'actor',target,desired,at,'m:'+at,desired);
  const changes=Number(del.changes||0)+Number(up.changes||0);
  assert.ok(changes<=1,'more than one overlay row changed');
  const row=db.prepare(`
    SELECT COALESCE(
      (SELECT following FROM explore_follow_overrides_348
       WHERE follower_uid='actor' AND following_uid=?),
      EXISTS(SELECT 1 FROM follows WHERE follower_uid='actor' AND following_uid=?)
    ) AS following
  `).get(target,target);
  assert.equal(Number(row.following),desired);
  return changes;
};

assert.equal(mutate('new',1,10),1);
assert.equal(mutate('new',1,11),0);
assert.equal(mutate('new',0,12),1);
assert.equal(mutate('new',0,13),0);
assert.equal(mutate('legacy',0,14),1);
assert.equal(mutate('legacy',0,15),0);
assert.equal(mutate('legacy',1,16),1);
assert.equal(mutate('legacy',1,17),0);

assert.equal(db.prepare('SELECT COUNT(*) AS n FROM follows').get().n,1);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM explore_follow_overrides_348').get().n,0);

console.log('FOLLOW350_DORMANT_WRITER_PRESENT=PASS');
console.log('FOLLOW350_LEGACY_RELATION_IMMUTABLE=PASS');
console.log('FOLLOW350_ONE_OVERLAY_ROW_MAX=PASS');
console.log('FOLLOW350_DUPLICATE_W0_LOGIC=PASS');
console.log('FOLLOW350_PROFILE_STATS_WRITE=0');
console.log('FOLLOW350_OVERLAY_AUTHORITY_ACTIVE=NO');

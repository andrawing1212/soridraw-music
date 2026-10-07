import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const worker = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
const schema = readFileSync('cloudflare/explore-worker/candidates/348-follow-overlay.sql','utf8');

const fn = (name) => {
  const start = worker.indexOf('async function ' + name + '(');
  assert.ok(start >= 0, 'missing ' + name);
  const brace = worker.indexOf('{', start);
  let depth=0, quote='', escaped=false, line=false, block=false;
  for(let i=brace;i<worker.length;i++){
    const c=worker[i],n=worker[i+1];
    if(line){ if(c==='\n') line=false; continue; }
    if(block){ if(c==='*'&&n==='/'){block=false;i++;} continue; }
    if(quote){
      if(escaped) escaped=false;
      else if(c==='\\') escaped=true;
      else if(c===quote) quote='';
      continue;
    }
    if(c==='/'&&n==='/'){line=true;i++;continue;}
    if(c==='/'&&n==='*'){block=true;i++;continue;}
    if(c==="'"||c==='"'||c==='`'){quote=c;continue;}
    if(c==='{') depth++;
    else if(c==='}'&&--depth===0) return worker.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
};

assert.match(worker,/SORIDRAW_FOLLOW_OVERLAY_READER_COMPAT_348_20261004/);
assert.match(worker,/SORIDRAW_FOLLOW_STATE_OVERLAY_COMPAT_348_20261004/);

const cutover=fn('readFollowCutoverState348');
for(const required of [
  'relationMode === "overlay348"',
  'relationTable === "explore_follow_overrides_348"',
  'legacyRelationWritersFrozen === true',
  'legacyCounterWritersFrozen === true',
  'allEnvironmentReadersReady === true',
  'allEnvironmentWritersReady === true',
  'profileCountsR2Exact === true',
  'ownerProtocol === "follow-overlay-348"',
  'oneWayAuthority348 === true',
  'relationMode === "overlay348" && writeMode === "active"',
  'relationMode === "overlay348-readonly" && writeMode === "readonly"',
  'SORIDRAW_FOLLOW_AUTHORITY_LIFECYCLE_378',
]) assert.ok(cutover.includes(required), 'cutover manifest missing '+required);
assert.match(cutover,/readFollowCutoverControl348\(env\)/);
assert.match(cutover,/source: "d1-one-way-latch"/);
assert.match(cutover,/readOnly: true/);

const core=fn('handleFollowR2Core');
assert.ok(core.indexOf('readFollowCutoverState348') < core.indexOf('adjustExploreFollowCountersDelta'));
assert.match(core,/FOLLOW_OVERLAY_READONLY/);
assert.match(core,/return handleFollowOverlay354/);
assert.ok(core.indexOf('FOLLOW_OVERLAY_READONLY') < core.indexOf('return handleFollowOverlay354'));
assert.ok(core.indexOf('return handleFollowOverlay354') < core.indexOf('enforceUserRateLimit'));

const state=fn('handleFollowState');
assert.match(state,/readFollowStateSnapshot354/);
assert.match(fn('readFollowStateSnapshot354'),/readEffectiveFollowMembership348/);
assert.match(state,/followingState\?\.membershipComplete/);
assert.match(state,/FROM follows WHERE follower_uid = \? AND following_uid = \?/);

const batch=fn('handleMyFollowStates');
assert.match(batch,/explore_follow_overrides_348/);
assert.match(batch,/COALESCE\(/);
assert.match(batch,/FROM follows/);

const profileConnections=fn('handleProfileConnections');
assert.match(profileConnections,/readEffectiveFollowConnectionPage348/);
assert.match(profileConnections,/readSharedProfileConnection348/);
assert.match(profileConnections,/FROM follows f/);

const mine=fn('handleMyFollowing');
assert.match(mine,/readEffectiveFollowConnectionPage348/);
assert.match(mine,/readSharedProfileConnection348/);
assert.match(mine,/FROM follows f/);

const bundle=fn('handleMyFollowingR2Bundle');
assert.match(bundle,/SORIDRAW_FOLLOWING_BUNDLE_OVERLAY_COMPAT_353_20261004/);
assert.match(bundle,/readFollowCutoverState348/);
assert.match(bundle,/readOverlayFollowing355/);
assert.match(fn('readOverlayFollowing355'),/readEffectiveFollowConnectionPage348/);
assert.match(fn('readOverlayFollowing355'),/overlay348-d1-recovery/);
assert.match(fn('readOverlayFollowing355'),/followingComplete: !cursor && !truncated/);

const feed=fn('handleFollowingFeed');
assert.match(feed,/WITH effective_following AS/);
assert.match(feed,/explore_follow_overrides_348/);
assert.match(feed,/FROM follows f/);

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
INSERT INTO follows VALUES
 ('actor','legacy-keep',100),
 ('actor','legacy-remove',101),
 ('legacy-follower','creator',102);
`);
db.exec(schema);
db.prepare("INSERT INTO explore_follow_overrides_348(follower_uid,following_uid,following,baseline_following,updated_at,mutation_id) VALUES(?,?,?,?,?,?)")
  .run('actor','legacy-remove',0,1,200,'m-remove');
db.prepare("INSERT INTO explore_follow_overrides_348(follower_uid,following_uid,following,baseline_following,updated_at,mutation_id) VALUES(?,?,?,?,?,?)")
  .run('actor','new-add',1,0,201,'m-add');
db.prepare("INSERT INTO explore_follow_overrides_348(follower_uid,following_uid,following,baseline_following,updated_at,mutation_id) VALUES(?,?,?,?,?,?)")
  .run('new-follower','creator',1,0,202,'m-reverse');

const pair=(a,b)=>Number(db.prepare(`
SELECT COALESCE(
 (SELECT following FROM explore_follow_overrides_348 WHERE follower_uid=? AND following_uid=?),
 EXISTS(SELECT 1 FROM follows WHERE follower_uid=? AND following_uid=?)
) AS following`).get(a,b,a,b).following);
assert.equal(pair('actor','legacy-keep'),1);
assert.equal(pair('actor','legacy-remove'),0);
assert.equal(pair('actor','new-add'),1);

const forward=db.prepare(`
WITH effective AS (
 SELECT f.following_uid AS uid,f.created_at AS followed_at
 FROM follows f
 WHERE f.follower_uid=?
   AND NOT EXISTS(
     SELECT 1 FROM explore_follow_overrides_348 o
     WHERE o.follower_uid=f.follower_uid AND o.following_uid=f.following_uid
   )
 UNION ALL
 SELECT o.following_uid AS uid,o.updated_at AS followed_at
 FROM explore_follow_overrides_348 o
 WHERE o.follower_uid=? AND o.following=1
)
SELECT uid FROM effective ORDER BY followed_at DESC,uid DESC
`).all('actor','actor').map(x=>x.uid);
assert.deepEqual(forward,['new-add','legacy-keep']);

const reverse=db.prepare(`
WITH effective AS (
 SELECT f.follower_uid AS uid,f.created_at AS followed_at
 FROM follows f
 WHERE f.following_uid=?
   AND NOT EXISTS(
     SELECT 1 FROM explore_follow_overrides_348 o
     WHERE o.follower_uid=f.follower_uid AND o.following_uid=f.following_uid
   )
 UNION ALL
 SELECT o.follower_uid AS uid,o.updated_at AS followed_at
 FROM explore_follow_overrides_348 o
 WHERE o.following_uid=? AND o.following=1
)
SELECT uid FROM effective ORDER BY followed_at DESC,uid DESC
`).all('creator','creator').map(x=>x.uid);
assert.deepEqual(reverse,['new-follower','legacy-follower']);

const pairPlan=db.prepare("EXPLAIN QUERY PLAN SELECT following FROM explore_follow_overrides_348 WHERE follower_uid='actor' AND following_uid='new-add'").all().map(x=>String(x.detail)).join(' | ');
assert.match(pairPlan,/SEARCH explore_follow_overrides_348 USING PRIMARY KEY/);
const reversePlan=db.prepare("EXPLAIN QUERY PLAN SELECT follower_uid FROM explore_follow_overrides_348 INDEXED BY idx_explore_follow_overrides_348_reverse WHERE following_uid='creator'").all().map(x=>String(x.detail)).join(' | ');
assert.match(reversePlan,/SEARCH explore_follow_overrides_348 USING (?:COVERING )?INDEX idx_explore_follow_overrides_348_reverse/);

console.log('FOLLOW349_LEGACY_DEFAULT_FAIL_CLOSED_WRITER=PASS');
console.log('FOLLOW349_TARGETED_EFFECTIVE_MEMBERSHIP=PASS');
console.log('FOLLOW349_FORWARD_REVERSE_EFFECTIVE_LIST=PASS');
console.log('FOLLOW349_FOLLOWING_FEED_READER_COMPAT=PASS');
console.log('FOLLOW353_FOLLOWING_BUNDLE_READER_COMPAT=PASS');
console.log('FOLLOW349_PROFILE_COUNTS_SHARED_R2_CONTRACT=PASS');
console.log('FOLLOW349_OVERLAY_AUTHORITY_ACTIVE=NO');

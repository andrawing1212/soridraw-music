// APP551 isolated SQLite overlay source proof; NO live D1/Worker/RTDB I/O.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {
 INLINE_OWNER_FOLLOW_551_SELECT_SQL,normalizeOwnerFollowEpochEvent532,
 drainOwnerFollowAuthEpoch532,
} from '../cloudflare/explore-worker/runtime/owner-follow-auth-epoch-532.mjs';
const migration=readFileSync('cloudflare/explore-worker/candidates/546-owner-follow-epoch-floor-legacy-off.sql','utf8');
const upgrade=readFileSync('cloudflare/explore-worker/candidates/551-owner-follow-overlay-revision-off.sql','utf8');
assert.match(upgrade,/SOURCE-ONLY.*DO NOT APPLY TO SHARED D1/);
assert.equal((upgrade.match(/CREATE TRIGGER IF NOT EXISTS explore_owner_follow_overlay_/g)||[]).length,3);
assert.doesNotMatch(upgrade,/DROP TABLE|DELETE FROM follows|UPDATE follows|UPDATE explore_follow_overrides_348/i);
const db=new DatabaseSync(':memory:');
try {
 db.exec(`CREATE TABLE profile_stats (
  uid TEXT PRIMARY KEY,follower_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL DEFAULT 0
 );
 CREATE TABLE follows(follower_uid TEXT,following_uid TEXT,created_at INTEGER,
 PRIMARY KEY(follower_uid,following_uid));
 CREATE INDEX idx_follows_following_created ON follows(following_uid,created_at DESC,follower_uid);
 CREATE TABLE explore_follow_overrides_348 (
  follower_uid TEXT,following_uid TEXT,following INTEGER NOT NULL CHECK(following IN(0,1)),
  baseline_following INTEGER NOT NULL CHECK(baseline_following IN(0,1)),
  updated_at INTEGER,mutation_id TEXT,PRIMARY KEY(follower_uid,following_uid)
 );
 INSERT INTO profile_stats(uid,follower_count,updated_at) VALUES('A',3,0),('Z',0,1);
 INSERT INTO follows VALUES ('B','A',1),('E','A',1);`);
 db.exec(migration); db.exec(upgrade);
 const get=uid=>db.prepare('SELECT * FROM profile_stats WHERE uid=?').get(uid);
 const stats=()=>({rev:get('A').owner_follow_revision_530,
   count:get('A').follower_count+get('A').owner_follow_baseline_offset_551+get('A').owner_follow_overlay_delta_551});
 const insert=(who,following,baseline,n)=>db.prepare(
  "INSERT INTO explore_follow_overrides_348 VALUES(?,'A',?,?,?,?)"
 ).run(who,following,baseline,n,'op'+n);
 const remove=who=>db.prepare(
  "DELETE FROM explore_follow_overrides_348 WHERE follower_uid=? AND following_uid='A'"
 ).run(who);
 const update=(who,value)=>db.prepare(
  "UPDATE explore_follow_overrides_348 SET following=? WHERE follower_uid=? AND following_uid='A' AND following<>?"
 ).run(value,who,value);
 const truth=()=>db.prepare(
  "SELECT COUNT(*) AS n FROM follows WHERE following_uid='A'"
 ).get().n+db.prepare(
  "SELECT COALESCE(SUM(following-baseline_following),0) AS n FROM explore_follow_overrides_348 WHERE following_uid='A'"
 ).get().n;
 // Historical sparse override exists before enrollment; OFF emits no events.
 insert('B',0,1,1);
 assert.equal(get('A').owner_follow_revision_530,0);
 assert.equal(get('A').owner_follow_overlay_delta_551,0);
 // Enrolment must calibrate indexed owner-only override sum atomically.
 // In production it additionally MUST verify the original follows baseline
 // equals profile_stats.follower_count, or fail closed; NO bulk backfill.
 const baseline=db.prepare("SELECT COUNT(*) AS n FROM follows WHERE following_uid='A'").get().n;
 assert.equal(baseline,2); // historical stats=3; real follows baseline=2
 const epoch='0123456789abcdef0123456789abcdef';
 db.prepare(`UPDATE profile_stats SET owner_follow_auth_epoch_532=?,
 owner_follow_auth_created_at_ms_544=1800000000000,
 owner_follow_baseline_offset_551=(
   SELECT COUNT(*) FROM follows WHERE following_uid='A')-follower_count,
 owner_follow_overlay_delta_551=(
  SELECT COALESCE(SUM(following-baseline_following),0)
  FROM explore_follow_overrides_348 WHERE following_uid='A')
 WHERE uid='A'`).run(epoch);
 assert.deepEqual(stats(),{rev:0,count:1});
 db.prepare('UPDATE explore_owner_follow_control_530 SET enabled=1 WHERE id=1').run();
 remove('B');assert.deepEqual(stats(),{rev:1,count:2});
 insert('C',1,0,2);assert.deepEqual(stats(),{rev:2,count:3});
 const before=db.prepare('SELECT total_changes() AS n').get().n;
 update('C',1);assert.equal(db.prepare('SELECT total_changes() AS n').get().n,before);
 assert.deepEqual(stats(),{rev:2,count:3});
 update('C',0);assert.deepEqual(stats(),{rev:3,count:2});
 remove('C');assert.deepEqual(stats(),{rev:3,count:2});
 insert('B',0,1,3);assert.deepEqual(stats(),{rev:4,count:1});
 update('B',1);assert.deepEqual(stats(),{rev:5,count:2});
 remove('B');assert.deepEqual(stats(),{rev:5,count:2});
 assert.equal(stats().count,truth());
 assert.equal(get('A').follower_count,3,'historical profile stats not rewritten');
 assert.equal(get('A').owner_follow_baseline_offset_551,-1);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM follows').get().n,2);
 db.prepare("INSERT INTO explore_follow_overrides_348 VALUES ('X','Z',1,0,4,'z4')").run();
 assert.equal(get('Z').owner_follow_revision_530,0);
 db.prepare("INSERT INTO follows VALUES ('F','A',5)").run();
 db.prepare("UPDATE profile_stats SET follower_count=4 WHERE uid='A'").run();
 assert.deepEqual(stats(),{rev:6,count:3});
 assert.equal(stats().count,truth());

 // Owner webhook must receive the reconstructed effective canonical count,
 // never a stale legacy profile_stats value after the overlay cutover.
 const raw=db.prepare(INLINE_OWNER_FOLLOW_551_SELECT_SQL).get(1800000000200,12);
 assert.equal(get('A').updated_at,0,'original stale timestamp stays unchanged');
 assert.equal(raw.follower_count,3);
 assert.ok(raw.updated_at>0,'legacy timestamp zero must not invalidate a real owner revision');
 const normalized=normalizeOwnerFollowEpochEvent532(raw);
 assert.equal(normalized?.followerCount,3);
 assert.equal(normalized?.version,6);
 assert.equal(normalized?.authEpoch,epoch);
 const adapter={prepare:sql=>({bind:(...args)=>({
  all:async()=>({results:db.prepare(sql).all(...args)}),
  run:async()=>({meta:{changes:db.prepare(sql).run(...args).changes}}),
 })})};
 const delivered=[];
 const settled=await drainOwnerFollowAuthEpoch532({
  db:adapter,enabled:true,overlayRevisionSource:true,
  now:()=>1800000000300,
  deliver:async event=>{delivered.push(event);return true;},
 });
 assert.equal(settled.selected,1);
 assert.equal(settled.delivered,1);
 assert.equal(delivered[0].followerCount,3);
 assert.equal(get('A').owner_follow_acked_revision_530,6);
 const idle=await drainOwnerFollowAuthEpoch532({
  db:adapter,enabled:true,overlayRevisionSource:true,
  now:()=>1800000000400,deliver:async()=>{throw Error('duplicate send');},
 });
 assert.equal(idle.selected,0,'old owner event must not be replayed');

 console.log('APP551_ACTUAL_OVERLAY_INSERT_UPDATE_DELETE_CHANGED_ONLY=PASS');
 console.log('APP551_ENROLLED_LEGACY_AND_OVERLAY_REVISION_COHERENCE=PASS');
 console.log('APP551_UNENROLLED_AND_NOOP_NO_OWNER_SIGNAL=PASS');
 console.log('APP551_PHYSICAL_COST_REAL_DEPLOY=NOT_VERIFIED_NO_GO');
} finally {db.close()}

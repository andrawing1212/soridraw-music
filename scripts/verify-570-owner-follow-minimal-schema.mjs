// APP570: exact minimal OFF schema + old 3-Worker SQL compatibility.
// In-memory SQLite only; no Cloudflare/Firebase, user rows or shared writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const sql=readFileSync('cloudflare/explore-worker/candidates/570-owner-follow-do-epoch-minimal-off.sql','utf8');
const clean=sql.replace(/--.*$/gm,'').trim();
const parts=clean.split(';').map(x=>x.trim()).filter(Boolean);
assert.equal(parts.length,2,'EXACTLY_TWO_DORMANT_ADDITIVE_COLUMNS');
assert.ok(parts.every(x=>/^ALTER TABLE profile_stats ADD COLUMN owner_follow_auth_(epoch_532|created_at_ms_544)\b/i.test(x)));
assert.doesNotMatch(clean,/\b(CREATE TRIGGER|CREATE INDEX|UPDATE |INSERT |DELETE |DROP |PRAGMA |owner_follow_revision_530|owner_follow_overlay_delta_551)\b/i);
const db=new DatabaseSync(':memory:');
try{
 db.exec(`CREATE TABLE profile_stats(uid TEXT PRIMARY KEY,
   follower_count INTEGER NOT NULL DEFAULT 0,
   following_count INTEGER NOT NULL DEFAULT 0,
   updated_at INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE follows(follower_uid TEXT,following_uid TEXT,created_at INTEGER,
   PRIMARY KEY(follower_uid,following_uid));
 CREATE TABLE explore_follow_overrides_348(
   follower_uid TEXT,following_uid TEXT,following INTEGER NOT NULL,
   baseline_following INTEGER NOT NULL,updated_at INTEGER,mutation_id TEXT,
   PRIMARY KEY(follower_uid,following_uid));
 INSERT INTO profile_stats(uid,follower_count,following_count,updated_at)
   VALUES('A',3,1,100),('B',0,0,200);
 INSERT INTO follows VALUES('C','A',101);`);
 const before=db.prepare('SELECT total_changes() AS n').get().n;
 const savedOriginal=db.prepare('SELECT uid,follower_count,following_count,updated_at FROM profile_stats ORDER BY uid').all();
 db.exec(sql);
 assert.equal(db.prepare('SELECT total_changes() AS n').get().n,before,
  'SCHEMA_ADD_MUST_NOT_UPDATE_ORIGINAL_ROWS');
 const after=db.prepare('SELECT uid,follower_count,following_count,updated_at FROM profile_stats ORDER BY uid').all();
 assert.deepEqual(after,savedOriginal,'ORIGINAL_PUBLIC_STATS_IDENTICAL');
 const columns=db.prepare('PRAGMA table_info(profile_stats)').all().map(r=>r.name);
 assert.equal(columns.filter(x=>x.startsWith('owner_follow_')).length,2);
 const a=()=>db.prepare('SELECT * FROM profile_stats WHERE uid=\'A\'').get();
 assert.equal(a().owner_follow_auth_epoch_532,'');
 assert.equal(a().owner_follow_auth_created_at_ms_544,0);
 assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='trigger'").get().n,0);
 // The original PREVIEW, TEST and PRODUCTION Writer SQL must keep working
 // with no epoch registration, no extra derived updates, and no new triggers.
 db.prepare("INSERT INTO explore_follow_overrides_348 VALUES('D','A',1,0,250,'op1')").run();
 db.prepare("UPDATE explore_follow_overrides_348 SET following=0 WHERE follower_uid='D'").run();
 db.prepare("DELETE FROM explore_follow_overrides_348 WHERE follower_uid='D'").run();
 db.prepare("UPDATE profile_stats SET follower_count=follower_count+1,updated_at=300 WHERE uid='A'").run();
 db.prepare("INSERT INTO profile_stats(uid,follower_count,following_count,updated_at) VALUES('E',1,1,301)").run();
 assert.equal(a().follower_count,4);
 assert.equal(a().owner_follow_auth_epoch_532,'');
 assert.equal(db.prepare("SELECT count(*) AS n FROM follows").get().n,1);
 const e=db.prepare("SELECT owner_follow_auth_epoch_532 AS epoch,owner_follow_auth_created_at_ms_544 AS birth FROM profile_stats WHERE uid='E'").get();
 assert.deepEqual(e,{epoch:'',birth:0});
 // Only an explicit verified one-owner bind may write the generation fence.
 const epoch='0123456789abcdef0123456789abcdef',created=1800000000000;
 const bound=db.prepare(`UPDATE profile_stats SET
   owner_follow_auth_epoch_532=?,owner_follow_auth_created_at_ms_544=?
   WHERE uid=? AND owner_follow_auth_epoch_532=''
     AND (owner_follow_auth_created_at_ms_544=0 OR owner_follow_auth_created_at_ms_544<=?)
   RETURNING uid,owner_follow_auth_epoch_532 AS epoch`).get(epoch,created,'A',created);
 assert.deepEqual(bound,{uid:'A',epoch});
 assert.equal(a().follower_count,4);
 assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='trigger'").get().n,0);
 assert.equal(db.prepare("SELECT count(*) AS n FROM profile_stats").get().n,3);
 console.log('APP570_TWO_COLUMN_W2_DURABLE_MINIMAL_SCHEMA=PASS');
 console.log('APP570_OLD_THREE_WORKER_SQL_AND_OVERLAY_NOOP_UNCHANGED=PASS');
 console.log('APP570_AUTH_EPOCH_ONLY_EXPLICIT_BOUND_OWNER_NO_EXTRA_TRIGGER=PASS');
 console.log('APP570_SHARED_D1_RELEASE=NOT_PERFORMED');
}finally{db.close();}

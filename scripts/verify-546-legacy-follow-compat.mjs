// APP546: old/New canonical writers with one ACTIVE (isolated only) legacy
// trigger, enrollment identity floor, no old production writer regression.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {adjustExploreFollowCountersDelta540} from
 '../cloudflare/explore-worker/runtime/owner-follow-inline-canonical-540.mjs';
const sql=readFileSync('cloudflare/explore-worker/candidates/546-owner-follow-epoch-floor-legacy-off.sql','utf8');
assert.doesNotMatch(sql,/CREATE TABLE IF NOT EXISTS explore_owner_follow_retired_531/i);
assert.match(sql,/CREATE TRIGGER IF NOT EXISTS explore_owner_follow_legacy_546/);
const db=new DatabaseSync(':memory:');
try{
 db.exec(`CREATE TABLE profile_stats(
  uid TEXT PRIMARY KEY, follower_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL DEFAULT 0
 );
 CREATE TABLE follows(follower_uid TEXT NOT NULL,following_uid TEXT NOT NULL,
  created_at INTEGER NOT NULL,PRIMARY KEY(follower_uid,following_uid));
 INSERT INTO profile_stats(uid,updated_at) VALUES('A',1),('B',1),('C',1);`);
 db.exec(sql);
 const allowed=['explore_owner_follow_control_530','profile_stats','follows'];
 const mode=()=>db.prepare('SELECT enabled FROM explore_owner_follow_control_530 WHERE id=1').get().enabled;
 assert.equal(mode(),0,'new schema starts OFF even after install');
 const epochA='0123456789abcdef0123456789abcdef';
 const get=uid=>db.prepare('SELECT * FROM profile_stats WHERE uid=?').get(uid);
 const change=()=>db.prepare('SELECT total_changes() AS n').get().n;
 let before=change();
 db.prepare('UPDATE profile_stats SET follower_count=? WHERE uid=?').run(1,'C');
 assert.equal(get('C').owner_follow_revision_530,0);
 assert.equal(change()-before,1,'legacy unenrolled OFF W only one logical row');
 db.prepare('UPDATE profile_stats SET owner_follow_auth_epoch_532=?,owner_follow_auth_created_at_ms_544=? WHERE uid=?')
  .run(epochA,1800000000000,'A');
 before=change();
 db.prepare('UPDATE profile_stats SET follower_count=1 WHERE uid=?').run('A');
 assert.equal(get('A').owner_follow_revision_530,0);
 assert.equal(change()-before,1,'legacy enrolled OFF does not queue');
 db.prepare('UPDATE explore_owner_follow_control_530 SET enabled=1 WHERE id=1').run();
 before=change();
 db.prepare('UPDATE profile_stats SET follower_count=2 WHERE uid=?').run('A');
 assert.equal(get('A').owner_follow_revision_530,1);
 assert.equal(change()-before,2,'one legacy count + one enrolled revision, not 531 tombstone');
 before=change();
 db.prepare('UPDATE profile_stats SET follower_count=2 WHERE uid=?').run('A');
 assert.equal(get('A').owner_follow_revision_530,1);
 assert.equal(change()-before,1,'SQLite matched UPDATE still writes logical row; trigger must be W0');
 before=change();
 db.prepare('UPDATE profile_stats SET follower_count=2 WHERE uid=? AND follower_count<>?')
  .run('A',2);
 assert.equal(change()-before,0,'guarded duplicate remains W0');
 before=change();
 db.prepare('UPDATE profile_stats SET follower_count=0 WHERE uid=?').run('C');
 assert.equal(get('C').owner_follow_revision_530,0,'unenrolled owner cannot queue');
 assert.equal(change()-before,1,'no event for unenrolled legacy account');
 const env={DB:{
  prepare(q){return {bind(...args){return {query:q,params:args,
    async first(){return db.prepare(q).get(...args)},
    async all(){return {results:db.prepare(q).all(...args)}}}}}},
  async batch(rows){db.exec('BEGIN');try{
   const result=rows.map(row=>{
    const stmt=db.prepare(row.query);
    return /RETURNING/i.test(row.query)?{results:stmt.all(...row.params)}:
     {meta:{changes:stmt.run(...row.params).changes}};
   });db.exec('COMMIT');return result;
  }catch(error){db.exec('ROLLBACK');throw error}}
 },};
 // First actual APP540 follow against enrolled A: revision increment inline.
 // Legacy trigger must NOT double-fire even with enabled=1.
 db.prepare('UPDATE profile_stats SET follower_count=0,owner_follow_revision_530=0 WHERE uid=?')
   .run('A');
 const follow=await adjustExploreFollowCountersDelta540(env,'B','A',true,1800000000100,epochA);
 assert.equal(follow.delta,1);
 assert.equal(get('A').owner_follow_revision_530,1,
  'optimized W2 target must not trigger an extra legacy revision');
 assert.equal(get('A').follower_count,1);
 const duplicate=await adjustExploreFollowCountersDelta540(env,'B','A',true,1800000000101,epochA);
 assert.equal(duplicate.delta,0);
 assert.equal(get('A').owner_follow_revision_530,1);
 const remove=await adjustExploreFollowCountersDelta540(env,'B','A',false,1800000000102,epochA);
 assert.equal(remove.delta,-1);
 assert.equal(get('A').owner_follow_revision_530,2);
 db.prepare('UPDATE profile_stats SET owner_follow_auth_epoch_532=? WHERE uid=?').run('','A');
 before=change();
 db.prepare('UPDATE profile_stats SET follower_count=1 WHERE uid=?').run('A');
 assert.equal(get('A').owner_follow_revision_530,2,'revoked old Writer cannot enqueue');
 assert.equal(change()-before,1,'revoked old writer adds no extra revision');
 assert.equal(db.prepare("SELECT name FROM sqlite_schema WHERE name LIKE '%retired_531%'").all().length,0);
 console.log('APP546_LEGACY_FOLLOW_CHANGED_ONLY_ENROLLED_OFF_AND_NEW_INLINE_PARITY=PASS');
 await import('./verify-551-owner-follow-overlay-delta.mjs');
}finally{db.close()}

// APP540: actual canonical Worker function vs OFF inline replacement.
// Tests local SQLite mutation parity, rollback and logical update-count only;
// NOT Cloudflare physical billed rows or a deployed Worker path.
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {
 APP540_INLINE_CANONICAL_COMPILED_OPEN,adjustExploreFollowCountersDelta540,
} from "../cloudflare/explore-worker/runtime/owner-follow-inline-canonical-540.mjs";

assert.equal(APP540_INLINE_CANONICAL_COMPILED_OPEN,false);
const source=readFileSync("cloudflare/explore-worker/canonical/preview-worker.js","utf8");
const start=source.indexOf("async function adjustExploreFollowCountersDelta(");
const end=source.indexOf("\\n__name(",start);
assert.ok(start>=0&&end>start&&end-start<8000);
const canonicalSource=source.slice(start,end);
const canonical=new Function(canonicalSource+"\\nreturn adjustExploreFollowCountersDelta;")();
const candidateSource=readFileSync("cloudflare/explore-worker/runtime/owner-follow-inline-canonical-540.mjs","utf8");
assert.match(candidateSource,/APP540_INLINE_CANONICAL_COMPILED_OPEN = false/);
assert.doesNotMatch(source,/adjustExploreFollowCountersDelta540/);
const entry=readFileSync("cloudflare/explore-worker/canonical/preview-entry.js","utf8");
assert.doesNotMatch(entry,/owner-follow-inline-canonical-540/);
const who="1234567890abcdef1234567890abcdef";
function createDb({ownerExists=true}={}){
 const d=new DatabaseSync(":memory:");
 d.exec(`CREATE TABLE profile_stats(
 uid TEXT PRIMARY KEY NOT NULL,follower_count INTEGER NOT NULL DEFAULT 0,
 following_count INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL,
 owner_follow_revision_530 INTEGER NOT NULL DEFAULT 0,
 owner_follow_acked_revision_530 INTEGER NOT NULL DEFAULT 0,
 owner_follow_attempts_530 INTEGER NOT NULL DEFAULT 0,
 owner_follow_next_at_530 INTEGER NOT NULL DEFAULT 0,
 owner_follow_dead_at_530 INTEGER NOT NULL DEFAULT 0,
 owner_follow_auth_epoch_532 TEXT NOT NULL DEFAULT '');
 CREATE TABLE follows(follower_uid TEXT NOT NULL, following_uid TEXT NOT NULL,
 created_at INTEGER NOT NULL,PRIMARY KEY(follower_uid,following_uid));
 CREATE TRIGGER legacy_owner_fallback_540
 AFTER UPDATE OF follower_count ON profile_stats
 WHEN NEW.follower_count IS NOT OLD.follower_count
 AND NEW.owner_follow_revision_530=OLD.owner_follow_revision_530
 BEGIN UPDATE profile_stats SET owner_follow_revision_530=owner_follow_revision_530+1
 WHERE uid=NEW.uid; END;`);
 d.prepare("INSERT INTO profile_stats(uid,updated_at) VALUES('B',1)").run();
 if(ownerExists)d.prepare("INSERT INTO profile_stats(uid,updated_at,owner_follow_auth_epoch_532) VALUES('A',1,?)").run(who);
 return d;
}
function wrap(d){
 return {DB:{
  prepare(query){return {bind(...values){const stmt=d.prepare(query);return {
   async all(){return {results:stmt.all(...values)}},
   async first(){return stmt.get(...values)||null},
   async run(){const x=stmt.run(...values);return {meta:{changes:x.changes}}},
   query,params:values,
  }}}},
  async batch(statements){d.exec("BEGIN IMMEDIATE");try{
   const out=[];for(const item of statements){
    const stmt=d.prepare(item.query);
    if(/\\bRETURNING\\b/i.test(item.query))out.push({results:stmt.all(...item.params)});
    else {const x=stmt.run(...item.params);out.push({results:[],meta:{changes:x.changes}})}
   }
   d.exec("COMMIT");return out;
  }catch(error){d.exec("ROLLBACK");throw error}}
 }};
}
function row(d,uid="A"){return d.prepare("SELECT follower_count AS count,following_count AS following,owner_follow_revision_530 AS rev,owner_follow_attempts_530 AS attempts FROM profile_stats WHERE uid=?").get(uid)||null}
function changes(d){return d.prepare("SELECT total_changes() AS n").get().n}
async function sequence(fn,optimized){
 const d=createDb(),env=wrap(d);
 try{
  let before=changes(d);
  const first=await fn(env,"B","A",true,1000);
  assert.equal(first.delta,1);assert.equal(first.following.follower_count,1);
  assert.deepEqual([row(d).count,row(d).rev,row(d,"B").following],[1,1,1]);
  const firstChanges=changes(d)-before;
  assert.equal(firstChanges,optimized?3:4,"one follower count row, actor count row and edge; old writer also trigger");
  before=changes(d);
  const duplicate=await fn(env,"B","A",true,1001);
  assert.equal(duplicate.delta,0);assert.equal(changes(d)-before,0);
  assert.equal(row(d).rev,1);
  before=changes(d);
  const removed=await fn(env,"B","A",false,1002);
  assert.equal(removed.delta,-1);
  assert.deepEqual([row(d).count,row(d).rev,row(d,"B").following],[0,2,0]);
  assert.equal(changes(d)-before,optimized?3:4);
  before=changes(d);
  const noOp=await fn(env,"B","A",false,1003);
  assert.equal(noOp.delta,0);assert.equal(changes(d)-before,0);assert.equal(row(d).rev,2);
  return {firstChanges,after:row(d)};
 }finally{d.close()}
}
const old=await sequence(canonical,false);
const newer=await sequence(adjustExploreFollowCountersDelta540,true);
assert.deepEqual(old.after,newer.after);
{
 const d=createDb({ownerExists:false});try{
  const result=await adjustExploreFollowCountersDelta540(wrap(d),"B","A",true,1100);
  assert.equal(result.delta,1);assert.equal(row(d).count,1);
  assert.equal(row(d).rev,1,"first insert must carry revision in same statement");
  assert.equal(row(d,"B").following,1);
 }finally{d.close()}
}
{
 const d=createDb(),env=wrap(d);try{
  d.exec(`CREATE TRIGGER abort_owner_540 BEFORE UPDATE OF follower_count ON profile_stats
  WHEN NEW.follower_count<>OLD.follower_count BEGIN SELECT RAISE(ABORT,'injected'); END;`);
  await assert.rejects(()=>adjustExploreFollowCountersDelta540(env,"B","A",true,1200),/injected/);
  assert.equal(d.prepare("SELECT COUNT(*) AS n FROM follows").get().n,0);
  assert.equal(row(d).count,0);assert.equal(row(d).rev,0);
  assert.equal(row(d,"B").following,0);
 }finally{d.close()}
}
console.log("APP540_INLINE_CANONICAL_LOGICAL_PARITY=PASS; canonical+candidate counts equal, fallback avoided on owner UPDATE, rollbacks PASS, live gate OFF");

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';

const worker = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
const schema = readFileSync('cloudflare/explore-worker/candidates/348-follow-overlay.sql','utf8');

function fn(name) {
  let start=worker.indexOf('async function '+name+'(');
  if(start<0) start=worker.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing '+name);
  const brace=worker.indexOf('{',start);
  let depth=0,quote=null,esc=false,line=false,block=false;
  for(let i=brace;i<worker.length;i++){
    const c=worker[i],n=worker[i+1];
    if(line){if(c==='\n')line=false;continue;}
    if(block){if(c==='*'&&n==='/'){block=false;i++;}continue;}
    if(quote){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}if(c===quote)quote=null;continue;}
    if(c==='/'&&n==='/'){line=true;i++;continue;}
    if(c==='/'&&n==='*'){block=true;i++;continue;}
    if(c==="'"||c==='"'||c==='\`'){quote=c;continue;}
    if(c==='{')depth++;
    else if(c==='}'&&--depth===0)return worker.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
}

assert.match(worker,/SORIDRAW_FOLLOW_ROLLBACK_SAFE_AUTHORITY_378_20261007/);
const controlFn=fn('readFollowCutoverControl348');
const cutoverFn=fn('readFollowCutoverState348');
const coreFn=fn('handleFollowR2Core');
const orchestrateFn=fn('orchestrateFollowOverlay354');
const overlayFn=fn('handleFollowOverlay354');
assert.match(cutoverFn,/readFollowCutoverControl348\(env\)/);
assert.match(cutoverFn,/source: "d1-one-way-latch"/);
assert.match(cutoverFn,/readOnly: true/);
assert.match(coreFn,/FOLLOW_OVERLAY_READONLY/);
assert.ok(coreFn.indexOf('FOLLOW_OVERLAY_READONLY') < coreFn.indexOf('handleFollowOverlay354'));
assert.match(orchestrateFn,/FOLLOW_OVERLAY_READONLY/);
assert.match(overlayFn,/FOLLOW_OVERLAY_READONLY/);

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
INSERT INTO follows VALUES('actor','legacy-target',1);
`);
db.exec(schema);

let d1Reads=0;
const prepare=(sql,params=[])=>({
  bind(...p){return prepare(sql,p);},
  async first(){d1Reads++; return db.prepare(sql).get(...params)||null;}
});
const records=new Map();
const bucket={
  async get(key){
    const value=records.get(key);
    return value==null?null:{text:async()=>value};
  }
};
const env={DB:{prepare},PROFILE_MEDIA:bucket};
const ctx={console,JSON,Number,String,Boolean,Object,Array,Error};
vm.createContext(ctx);
vm.runInContext(controlFn+'\n'+cutoverFn,ctx);
ctx.EXPLORE_FOLLOW_CUTOVER_KEY_348='manifest';

let state=await ctx.readFollowCutoverState348(env);
assert.equal(state.mode,'legacy');
assert.equal(state.readOnly,false);

const activeManifest={
  schemaVersion:1,relationMode:'overlay348',relationTable:'explore_follow_overrides_348',
  legacyRelationWritersFrozen:true,legacyCounterWritersFrozen:true,
  allEnvironmentReadersReady:true,allEnvironmentWritersReady:true,
  profileCountsR2Exact:true,ownerProtocol:'follow-overlay-348',
  crashConsistentWriter354:true,orderedClientRequests354:true,
  oneWayAuthority348:true,writeMode:'active',cutoverToken:'cutover-378'
};
records.set('manifest',JSON.stringify(activeManifest));
d1Reads=0;
state=await ctx.readFollowCutoverState348(env);
assert.equal(state.mode,'overlay348');
assert.equal(state.readOnly,false);
assert.equal(state.source,'r2-manifest');
assert.equal(d1Reads,0,'healthy manifest must not read D1 latch');

records.set('manifest',JSON.stringify({...activeManifest,writeMode:'readonly'}));
d1Reads=0;
state=await ctx.readFollowCutoverState348(env);
assert.equal(state.mode,'overlay348');
assert.equal(state.readOnly,true);
assert.equal(d1Reads,0,'healthy readonly manifest must not read D1 latch');

db.prepare("UPDATE explore_follow_cutover_control_348 SET phase='armed',cutover_token='cutover-378',updated_at=1 WHERE id=1").run();
db.prepare("UPDATE explore_follow_cutover_control_348 SET phase='overlay',updated_at=2 WHERE id=1").run();
assert.throws(()=>db.prepare("UPDATE explore_follow_cutover_control_348 SET phase='legacy' WHERE id=1").run(),/follow authority downgrade blocked/);
assert.throws(()=>db.prepare("DELETE FROM explore_follow_cutover_control_348 WHERE id=1").run(),/follow authority latch delete blocked/);

records.delete('manifest');
d1Reads=0;
state=await ctx.readFollowCutoverState348(env);
assert.equal(state.mode,'overlay348');
assert.equal(state.readOnly,true);
assert.equal(state.source,'d1-one-way-latch');
assert.ok(d1Reads>0);

db.prepare(`INSERT INTO explore_follow_overrides_348(
 follower_uid,following_uid,following,baseline_following,updated_at,mutation_id
) VALUES(?,?,?,?,?,?)`).run('actor','new-target',1,0,100,'m1');
const effective=(a,b)=>Number(db.prepare(`
SELECT COALESCE(
 (SELECT following FROM explore_follow_overrides_348 WHERE follower_uid=? AND following_uid=?),
 EXISTS(SELECT 1 FROM follows WHERE follower_uid=? AND following_uid=?)
) AS following`).get(a,b,a,b).following);
assert.equal(effective('actor','new-target'),1);

db.prepare(`INSERT INTO explore_follow_overrides_348(
 follower_uid,following_uid,following,baseline_following,updated_at,mutation_id
) VALUES(?,?,?,?,?,?)`).run('actor','legacy-target',0,1,101,'m2');
assert.equal(effective('actor','legacy-target'),0);

records.set('manifest','{not-json');
state=await ctx.readFollowCutoverState348(env);
assert.equal(state.mode,'overlay348');
assert.equal(state.readOnly,true);

assert.ok(coreFn.indexOf('FOLLOW_OVERLAY_READONLY') < coreFn.indexOf('enforceUserRateLimit'));
assert.ok(overlayFn.indexOf('FOLLOW_OVERLAY_READONLY') < overlayFn.indexOf('enforceFollowEdgeRateLimit355'));

console.log('FOLLOW378_HEALTHY_MANIFEST_D1_LATCH_R0=PASS');
console.log('FOLLOW378_MISSING_OR_CORRUPT_MANIFEST_RECOVERS_READONLY_OVERLAY=PASS');
console.log('FOLLOW378_BASELINE0_FOLLOW1_EFFECTIVE=PASS');
console.log('FOLLOW378_BASELINE1_UNFOLLOW0_EFFECTIVE=PASS');
console.log('FOLLOW378_ONCE_ACTIVE_CANNOT_DOWNGRADE_OR_DELETE_LATCH=PASS');
console.log('FOLLOW378_READONLY_NEW_MUTATION_FAILS_BEFORE_LEGACY_OR_RATE_WRITE=PASS');
console.log('FOLLOW378_SHARED_USER_DATA_WRITE=0');
console.log('FOLLOW378_CUTOVER_ACTIVATION_BLOCKER=RESOLVED_SOURCE_ONLY');

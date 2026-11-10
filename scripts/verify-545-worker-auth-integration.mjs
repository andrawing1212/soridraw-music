// APP545: exact canonical Worker path + signed Firebase Admin registration.
// Runs ONLY in local Node SQLite with fake Admin; no network/creds/deploy.
// The earlier APP539 Firebase emulators and APP541 owned D1 physical meter
// remain their own PASS evidence; this validates the NEW connector specifically.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {composeOwnerFollowWorker543,CANONICAL_SHA_543} from
 '../cloudflare/explore-worker/candidates/compose-follow-worker-543.mjs';
import {resolveOwnerFollowWriter543,
 OWNER_FOLLOW_INLINE_543_COMPILED_OPEN} from
 '../cloudflare/explore-worker/runtime/owner-follow-writer-543.mjs';
import {handleOwnerEpochBinding544,APP544_OWNER_EPOCH_BIND_COMPILED_OPEN} from
 '../cloudflare/explore-worker/runtime/owner-follow-enrollment-544.mjs';
import {adjustExploreFollowCountersDelta540,
 APP540_INLINE_CANONICAL_COMPILED_OPEN} from
 '../cloudflare/explore-worker/runtime/owner-follow-inline-canonical-540.mjs';
const require=createRequire(import.meta.url);
const {enrollAndBindOwner544,sendOwnerEpochBinding544,
 revokeDeletedOwnerBinding544,APP544_ENROLLMENT_COMPILED_OPEN}=
 require('../functions/src/ownerFollowEnrollment544.ts');
assert.equal(OWNER_FOLLOW_INLINE_543_COMPILED_OPEN,false);
assert.equal(APP544_OWNER_EPOCH_BIND_COMPILED_OPEN,false);
assert.equal(APP540_INLINE_CANONICAL_COMPILED_OPEN,false);
assert.equal(APP544_ENROLLMENT_COMPILED_OPEN,false);
const baseline=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
const canonical=composeOwnerFollowWorker543(baseline);
assert.ok(!baseline.includes('resolveOwnerFollowWriter543'));
assert.equal(CANONICAL_SHA_543,'916550ff8534e5c0e0fb2378c1648e736b184854258b626113c7ad8f2f041f88');
const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
const functionsIndex=readFileSync('functions/src/index.ts','utf8');
assert.match(canonical,/const ownerEpoch543 = await resolveOwnerFollowWriter543/);
assert.match(canonical,/\? await adjustExploreFollowCountersDelta540\(/);
assert.match(canonical,/: await adjustExploreFollowCountersDelta\(/);
const core=canonical.slice(canonical.indexOf('async function handleFollowR2Core('),
 canonical.indexOf('__name(handleFollowR2Core'));
assert.ok(core.indexOf('return handleFollowOverlay354(')>=0);
assert.ok(core.indexOf('return handleFollowOverlay354(')<core.indexOf('resolveOwnerFollowWriter543('));
assert.match(entry,/APP544_OWNER_EPOCH_BIND_COMPILED_OPEN &&/);
assert.match(entry,/handleOwnerEpochBinding544\(\{request,env\}\)/);
assert.doesNotMatch(functionsIndex,/export\s*\{\s*enrollOwnerFollow544Candidate/);
const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE profile_stats (
 uid TEXT PRIMARY KEY NOT NULL, follower_count INTEGER NOT NULL DEFAULT 0,
 following_count INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL,
 owner_follow_revision_530 INTEGER NOT NULL DEFAULT 0,
 owner_follow_acked_revision_530 INTEGER NOT NULL DEFAULT 0,
 owner_follow_attempts_530 INTEGER NOT NULL DEFAULT 0,
 owner_follow_next_at_530 INTEGER NOT NULL DEFAULT 0,
 owner_follow_dead_at_530 INTEGER NOT NULL DEFAULT 0,
 owner_follow_delivered_at_530 INTEGER NOT NULL DEFAULT 0,
 owner_follow_auth_epoch_532 TEXT NOT NULL DEFAULT '',
 owner_follow_auth_created_at_ms_544 INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE follows (
 follower_uid TEXT NOT NULL,following_uid TEXT NOT NULL,created_at INTEGER NOT NULL,
 PRIMARY KEY(follower_uid,following_uid));
 INSERT INTO profile_stats(uid,updated_at) VALUES('B',1),('A',1);`);
const counters={queries:0,writes:0};
function adaptStmt(query){
 return {bind(...args){
  const statement=db.prepare(query);
  return {
   async first(){counters.queries++;return statement.get(...args)||null;},
   async all(){counters.queries++;return {results:statement.all(...args)};},
   async run(){counters.queries++;const x=statement.run(...args);
    counters.writes+=x.changes;return {meta:{changes:x.changes}};},
   query,params:args,
  };
 }};
}
const cloud={DB:{
 prepare:adaptStmt,
 async batch(statements){db.exec('BEGIN IMMEDIATE');try{
  const out=[];
  for(const item of statements){const stmt=db.prepare(item.query);
   if(/\bRETURNING\b/i.test(item.query)){
    const rows=stmt.all(...item.params);out.push({results:rows});
    counters.writes+=rows.length;
   }else{const x=stmt.run(...item.params);out.push({meta:{changes:x.changes}});
    counters.writes+=x.changes;}
  }
  db.exec('COMMIT');return out;
 }catch(e){db.exec('ROLLBACK');throw e}},
},SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_FOLLOW_BIND_544:'1',
 SORIDRAW_OWNER_FOLLOW_INLINE_543:'1'};
const epochA='0123456789abcdef0123456789abcdef';
const epochOld='fedcba9876543210fedcba9876543210';
const when=1800000000000,secret='APP545-test-secret-not-production-123456789';
let authBirth=when-600000,activeEpoch=epochA,accountExists=true;
const auth={
 async getUser(uid){
  assert.equal(uid,'A');
  if(!accountExists){const error=new Error('not found');
   error.code='auth/user-not-found';throw error;}
  return {uid,metadata:{creationTime:new Date(authBirth).toISOString()},
   customClaims:{soridrawFollowEpoch532:activeEpoch}};
 },
};
const liveState=()=>({ownerFollowLifecycle534:{
 phase:'active',epoch:activeEpoch,createdAtMs:authBirth,changedAtMs:when}});
const firestore={
 collection(name){
  assert.equal(name,'users');
  return {
   doc(uid){
    assert.equal(uid,'A');
    return {get:async()=>({
      data:liveState,
      get:key=>key==='authDeleted'?false:key==='accountStatus'?'active':undefined,
    })};
   },
  };
 },
};
const send=async (endpoint,options)=>{
 assert.equal(endpoint,
  'https://soridraw-explore-preview.andrawing1212.workers.dev/internal/owner-follow/epoch-544');
 return handleOwnerEpochBinding544({
  request:new Request(endpoint,options),
  env:{...cloud,SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544:secret},
  now:()=>when,enabled:true,verify:async({event})=>{
    if(event.action==='bind')return accountExists&&
      activeEpoch===event.authEpoch&&authBirth===event.authCreatedAtMs;
    return !accountExists||
      (authBirth>event.authCreatedAtMs&&activeEpoch!==event.authEpoch);
  },
 });
};
try{
 // OFF is a pure no-op; visits, focus, refresh never query D1.
 const q0=counters.queries;
 assert.equal(await resolveOwnerFollowWriter543({env:cloud,targetUid:'A',mode:'legacy'}),null);
 assert.equal(await resolveOwnerFollowWriter543({env:cloud,targetUid:'A',mode:'overlay348',enabled:true}),null);
 const denied=await handleOwnerEpochBinding544({
  request:new Request('https://example.test',{method:'POST'}),
  env:cloud,enabled:false});
 assert.equal(denied.status,503);assert.equal(counters.queries,q0);
 // Only the mock Admin issuer, never B's body, may bind A's verified epoch.
 const owner=await enrollAndBindOwner544({firestore,auth,uid:'A',secret,now:()=>when,send,
  enroll:async()=>({uid:'A',authEpoch:epochA,createdAtMs:authBirth,reused:false})});
 assert.equal(owner.authEpoch,epochA);
 const row=()=>db.prepare('SELECT * FROM profile_stats WHERE uid=?').get('A');
 assert.equal(row().owner_follow_auth_epoch_532,epochA);
 const beforeIdempotentReads=counters.queries;
 const beforeIdempotentWrites=db.prepare('SELECT total_changes() AS n').get().n;
 await enrollAndBindOwner544({firestore,auth,uid:'A',secret,now:()=>when,send,
  enroll:async()=>({uid:'A',authEpoch:epochA,createdAtMs:authBirth,reused:true})});
 assert.equal(row().owner_follow_auth_epoch_532,epochA);
 assert.equal(counters.queries-beforeIdempotentReads,2,
  'one INSERT-OR-CONFLICT no-op followed by one confirmation SELECT');
 assert.equal(db.prepare('SELECT total_changes() AS n').get().n-beforeIdempotentWrites,0,
  'duplicate binding must physically write zero rows');
 const enrolled=await resolveOwnerFollowWriter543({env:cloud,targetUid:'A',mode:'legacy',enabled:true});
 assert.equal(enrolled,epochA);
 // The actual APP540 function writes edge + actor + canonical owner revision
 // together in one D1 transaction. No duplicate revision on repeated intent.
 const first=await adjustExploreFollowCountersDelta540(cloud,'B','A',true,when,epochA);
 assert.equal(first.delta,1);assert.equal(row().follower_count,1);
 assert.equal(row().owner_follow_revision_530,1);
 assert.equal(db.prepare("SELECT following_count AS n FROM profile_stats WHERE uid='B'").get().n,1);
 const dup=await adjustExploreFollowCountersDelta540(cloud,'B','A',true,when+1,epochA);
 assert.equal(dup.delta,0);assert.equal(row().owner_follow_revision_530,1);
 const unfollow=await adjustExploreFollowCountersDelta540(cloud,'B','A',false,when+2,epochA);
 assert.equal(unfollow.delta,-1);assert.equal(row().follower_count,0);
 assert.equal(row().owner_follow_revision_530,2);
 // Wrong account or old-generation request must not mutate canonical state.
 await assert.rejects(()=>adjustExploreFollowCountersDelta540(
  cloud,'B','A',true,when+3,epochOld),/APP540_OWNER_EPOCH_MISMATCH/);
 assert.equal(row().owner_follow_revision_530,2);
 // Verify Worker refuses a direct unsigned/non-Firebase-admin write.
 const invalid=await handleOwnerEpochBinding544({request:new Request(
  'https://example.test',{method:'POST',body:JSON.stringify({action:'revoke',
   uid:'A',authEpoch:epochA,authCreatedAtMs:authBirth,at:when}),headers:{
   'X-Soridraw-Owner-Epoch-At':String(when),
   'X-Soridraw-Owner-Epoch-Signature':'0'.repeat(64)}}),
  env:{...cloud,SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544:secret},
  now:()=>when,enabled:true});
 assert.equal(invalid.status,403);
 assert.equal(row().owner_follow_auth_epoch_532,epochA);
 // Revocation is denied while Firebase still identifies an active account.
 await assert.rejects(()=>revokeDeletedOwnerBinding544({
  auth,uid:'A',authEpoch:epochA,authCreatedAtMs:authBirth,
  secret,now:()=>when,send}),/544_AUTH_USER_EXISTS/);
 accountExists=false;
 await revokeDeletedOwnerBinding544({
  auth,uid:'A',authEpoch:epochA,authCreatedAtMs:authBirth,
  secret,now:()=>when,send});
 assert.equal(row().owner_follow_auth_epoch_532,'');
 assert.equal(row().follower_count,0,'revoke must retain canonical profile data');
 // APP546: revocation is a durable generation fence on the retained row.
 // A delayed, still-valid old signed BIND cannot re-arm its cleared epoch.
 await assert.rejects(()=>sendOwnerEpochBinding544({
  event:{uid:'A',authEpoch:epochA,authCreatedAtMs:authBirth,action:'bind'},
  secret,now:()=>when,send}),/544_D1_BIND_HOLD_409/);
 assert.equal(row().owner_follow_auth_epoch_532,'');
 assert.equal(row().owner_follow_auth_created_at_ms_544,authBirth);
 const beforeMissing=db.prepare('SELECT total_changes() AS n').get().n;
 await assert.rejects(()=>sendOwnerEpochBinding544({
  event:{uid:'MissingOwner',authEpoch:epochA,authCreatedAtMs:authBirth,action:'bind'},
  secret,now:()=>when,send}),/544_D1_BIND_HOLD_409/);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM profile_stats WHERE uid=?')
   .get('MissingOwner').n,0,'missing profile must never be recreated');
 assert.equal(db.prepare('SELECT total_changes() AS n').get().n,beforeMissing);
 assert.equal(await resolveOwnerFollowWriter543({env:cloud,targetUid:'A',mode:'legacy',enabled:true}),null);
 // Old signed incarnation cannot overwrite a newly bound one.
 accountExists=true;activeEpoch=epochOld;authBirth+=100000;
 await enrollAndBindOwner544({firestore,auth,uid:'A',secret,now:()=>when,send,
  enroll:async()=>({uid:'A',authEpoch:epochOld,createdAtMs:authBirth,reused:false})});
 assert.equal(row().owner_follow_auth_epoch_532,epochOld);
 await assert.rejects(()=>sendOwnerEpochBinding544({
  event:{uid:'A',authEpoch:epochA,authCreatedAtMs:when-600000,action:'bind'},
  secret,now:()=>when,send}),/544_D1_BIND_HOLD_409/);
 assert.equal(row().owner_follow_auth_epoch_532,epochOld);
 assert.equal(row().owner_follow_auth_created_at_ms_544,authBirth);
 // A late REVOKE for the old epoch must not unbind a newly enrolled owner.
 await sendOwnerEpochBinding544({
  event:{uid:'A',authEpoch:epochA,authCreatedAtMs:when-600000,action:'revoke'},
  secret,now:()=>when,send});
 assert.equal(row().owner_follow_auth_epoch_532,epochOld);
 assert.equal(row().owner_follow_auth_created_at_ms_544,authBirth);
 console.log('APP545_REAL_CANONICAL_WORKER_AUTH_ADMIN_D1_CONNECTOR=PASS');
 console.log('APP545_OFF_IDLE_D1_R0_WRITES0_EPOCH_BIND_CAS_REVOKE_NO_ERASURE=PASS');
}finally{db.close()}

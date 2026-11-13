// APP547: physical D1 deletion/recreation + real HMAC-backed current Auth
// verification. Everything is in-memory; no Firebase/Cloudflare network call.
// This proves older signed events cannot re-arm a recreated blank profile.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHmac} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {verifyLiveOwnerEpoch547,OWNER_FOLLOW_AUTH_PROOF_547_COMPILED_OPEN} from
 '../cloudflare/explore-worker/runtime/owner-follow-current-auth-547.mjs';
import {handleOwnerEpochBinding544,APP544_OWNER_EPOCH_BIND_COMPILED_OPEN} from
 '../cloudflare/explore-worker/runtime/owner-follow-enrollment-544.mjs';
const require=createRequire(import.meta.url);
const {handleOwnerAuthProof547,isCurrentOwnerEpoch547,
 APP547_AUTH_PROOF_COMPILED_OPEN}=require('../functions/src/ownerFollowAuthProof547.ts');
assert.equal(OWNER_FOLLOW_AUTH_PROOF_547_COMPILED_OPEN,false);
assert.equal(APP544_OWNER_EPOCH_BIND_COMPILED_OPEN,false);
assert.equal(APP547_AUTH_PROOF_COMPILED_OPEN,true);
const proofSource=readFileSync('functions/src/ownerFollowAuthProof547.ts','utf8');
assert.match(proofSource,/process\.env\.SORIDRAW_OWNER_FOLLOW_READY_608!=='1'/);
assert.match(proofSource,/process\.env\.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574/);
assert.match(proofSource,/APP608_CANARY_SHA256/);
const index=readFileSync('functions/src/index.ts','utf8');
assert.ok(index.includes('export {verifyOwnerFollowEpoch547Candidate} from "./ownerFollowAuthProof547";'));
assert.ok(index.includes('export {publishExploreOwnerFollower542} from "./exploreOwnerFollowerWebhook542";'));
assert.ok(index.includes('export {enrollOwnerFollow544Candidate} from "./ownerFollowEnrollment544";'));
assert.doesNotMatch(index,/export.*publishExploreOwnerFollower529/);
const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
assert.match(entry,/APP544_OWNER_EPOCH_BIND_COMPILED_OPEN &&/);
const config=JSON.parse(readFileSync(
 'cloudflare/explore-worker/canonical/wrangler.preview.jsonc','utf8'));
assert.equal(config.vars?.SORIDRAW_OWNER_FOLLOW_AUTH_PROOF_547,undefined);
const secret='ISOLATED_ONLY_547_SHARED_SECRET_LEAST_32_CHARS';
const at=1800000000000;
let birth=at-100000,epoch='0123456789abcdef0123456789abcdef',exists=true;
const oldEpoch=epoch,oldBirth=birth;
let phase='active',deleted=false,pending=false,disabled=false;
let authReads=0,firestoreReads=0,allowRecovery=false;
const auth={async getUser(uid){
 authReads++;
 assert.equal(uid,'A');
 if(!exists){const e=Error('not found');e.code='auth/user-not-found';throw e}
 return {uid,disabled,metadata:{creationTime:new Date(birth).toISOString()},
  customClaims:{soridrawFollowEpoch532:epoch}};
}};
const firestore={
 collection(name){
  assert.equal(name,'users');
  return {
   doc(uid){
    assert.equal(uid,'A');
    return {
     async get(){
      firestoreReads++;
      return {
       data:()=>({ownerFollowLifecycle534:{
        phase,epoch,createdAtMs:birth,changedAtMs:at,
       }}),
       get:key=>({
        authDeleted:deleted,authDeletionPendingAt:pending,
        accountStatus:deleted?'banned':'active',
       })[key],
      };
     },
    };
   },
  };
 },
};
const realProof=async(uri,options)=>handleOwnerAuthProof547(
 new Request(uri,options),{auth,firestore,secret,now:()=>at});
const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE profile_stats (
 uid TEXT PRIMARY KEY, follower_count INTEGER NOT NULL DEFAULT 0,
 following_count INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL DEFAULT 0
);`);
db.exec(readFileSync('cloudflare/explore-worker/candidates/570-owner-follow-do-epoch-minimal-off.sql','utf8'));
db.exec("INSERT INTO profile_stats(uid,updated_at) VALUES('A',1)");
let writes=0,selects=0;
const cloud={SORIDRAW_ENVIRONMENT:'preview',
 SORIDRAW_OWNER_FOLLOW_BIND_544:'1',
 SORIDRAW_OWNER_FOLLOW_AUTH_PROOF_547:'1',
 SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',
 SORIDRAW_OWNER_FOLLOW_CANARY_UID_574:'A',
 SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544:secret,
 DB:{prepare(sql){return {bind(...args){return {
 async first(){selects++;const stmt=db.prepare(sql);
  if(/^\s*UPDATE/i.test(sql)){const rows=stmt.all(...args);
   writes+=rows.length;return rows[0]||null}
  return stmt.get(...args)||null;},
 async run(){const result=db.prepare(sql).run(...args);writes+=result.changes;
  return {meta:{changes:result.changes}};},
 };}}}}
};
const signer=(subject)=>{
 const raw=JSON.stringify({...subject,at});
 return new Request('https://soridraw-explore-preview.andrawing1212.workers.dev/internal/owner-follow/epoch-544',{
  method:'POST',body:raw,headers:{
   'X-Soridraw-Owner-Epoch-At':String(at),
   'X-Soridraw-Owner-Epoch-Signature':
    createHmac('sha256',secret).update(at+'.'+raw).digest('hex'),
  },
 });
};
const signed=async({action='bind',authEpoch=epoch,authCreatedAtMs=birth,verify}={})=>
 handleOwnerEpochBinding544({request:signer({
  action,uid:'A',authEpoch,authCreatedAtMs}),env:cloud,now:()=>at,
  enabled:true,verify:verify||((opts)=>verifyLiveOwnerEpoch547({
   ...opts,enabled:true,send:realProof,
  })),
 });
const owner=()=>db.prepare('SELECT * FROM profile_stats WHERE uid=?').get('A');
try{
 let r=await signed();assert.equal(r.status,200);
 assert.equal(owner().owner_follow_auth_epoch_532,oldEpoch);
 assert.equal(owner().owner_follow_auth_created_at_ms_544,oldBirth);
 const beforeMixed=writes;
 cloud.SORIDRAW_OWNER_FOLLOW_OVERLAY_551='1';
 r=await signed();
 assert.equal(r.status,503,'W2_DO_MUST_NOT_RUN_WITH_LEGACY_D1_OUTBOX');
 assert.equal(writes,beforeMixed,'TRANSPORT_CONFLICT_W0');
 delete cloud.SORIDRAW_OWNER_FOLLOW_OVERLAY_551;
 const q=selects,w=writes,a=authReads;
 const deniedOwner=await handleOwnerEpochBinding544({
  request:signer({action:'bind',uid:'A',authEpoch:oldEpoch,authCreatedAtMs:oldBirth}),
  env:{...cloud,SORIDRAW_OWNER_FOLLOW_CANARY_UID_574:'B'},
  now:()=>at,enabled:true,verify:async()=>{throw Error('CANARY_MUST_HOLD')},
 });
 assert.equal(deniedOwner.status,409);
 assert.equal(selects,q);assert.equal(writes,w);assert.equal(authReads,a);
 const denied=await handleOwnerEpochBinding544({
  request:signer({action:'bind',uid:'A',authEpoch:oldEpoch,authCreatedAtMs:oldBirth}),
  env:{...cloud,SORIDRAW_OWNER_FOLLOW_AUTH_PROOF_547:'0'},now:()=>at,enabled:true,
 });
 assert.equal(denied.status,503);
 assert.equal(selects,q);assert.equal(writes,w);
 assert.equal(authReads,a);
 // A trusted, signed request still cannot bind once Firebase Auth is deleted.
 exists=false;phase='deleted';deleted=true;
 r=await signed({action:'bind',authEpoch:oldEpoch,authCreatedAtMs:oldBirth});
 assert.equal(r.status,409);
 const noWritten=writes;
 // Canonical row is physically erased, then same UID is created by an
 // independent legacy profile writer (without an owner generation floor).
 db.prepare("DELETE FROM profile_stats WHERE uid='A'").run();
 db.prepare("INSERT INTO profile_stats(uid,updated_at) VALUES('A',2)").run();
 assert.equal(owner().owner_follow_auth_created_at_ms_544,0);
 exists=true;deleted=false;phase='active';
 birth+=10000;epoch='fedcba9876543210fedcba9876543210';
 r=await signed({action:'bind',authEpoch:oldEpoch,authCreatedAtMs:oldBirth});
 assert.equal(r.status,409,'old signed generation cannot bind recreated UID');
 assert.equal(owner().owner_follow_auth_epoch_532,'');
 assert.equal(owner().owner_follow_auth_created_at_ms_544,0);
 r=await signed();
 assert.equal(r.status,200);
 assert.equal(owner().owner_follow_auth_epoch_532,epoch);
 assert.equal(owner().owner_follow_auth_created_at_ms_544,birth);
 // Stale old revoke is safe (CAS only old epoch); verified newer account
 // permits cleanup of an older epoch when delayed server deletion arrives.
 r=await signed({action:'revoke',authEpoch:oldEpoch,authCreatedAtMs:oldBirth});
 assert.equal(r.status,200);
 assert.equal(owner().owner_follow_auth_epoch_532,epoch);
 // Remove row again; no Auth still old after recreation can resurrect it.
 db.prepare("DELETE FROM profile_stats WHERE uid='A'").run();
 r=await signed({action:'bind',authEpoch:oldEpoch,authCreatedAtMs:oldBirth});
 assert.equal(r.status,409);
 assert.equal(owner(),undefined);
 r=await signed();
 assert.equal(r.status,409,'enrolment cannot recreate deleted canonical profile');
 assert.equal(owner(),undefined);
 // Recreated profile after deletion and a current Auth proof: authorized.
 db.prepare("INSERT INTO profile_stats(uid,updated_at) VALUES('A',3)").run();
 let calls=0;
 r=await signed({verify:async()=>++calls===1});
 assert.equal(r.status,409,'Auth deleted during in-flight bind must undo CAS');
 assert.equal(owner().owner_follow_auth_epoch_532,'');
 assert.equal(owner().owner_follow_auth_created_at_ms_544,birth,
  'compensation retains exact Auth birth fence');
 // A verifier outage must never write D1.
 const oldW=writes,oldQ=selects;
 r=await signed({verify:async()=>{throw Error('Firebase unavailable')}});
 assert.equal(r.status,503);assert.equal(writes,oldW);assert.equal(selects,oldQ);
 // No valid response may be forged without shared HMAC and matching nonce.
 r=await signed({verify:opts=>verifyLiveOwnerEpoch547({...opts,
  enabled:true,send:async()=>new Response(
   JSON.stringify({ok:true,uid:'A',nonce:'0'.repeat(32)}),{status:200}),
 })});
 assert.equal(r.status,503);assert.equal(writes,oldW);
 // Current valid proof can recover the fenced newer account.
 r=await signed();assert.equal(r.status,200);
 assert.equal(owner().owner_follow_auth_epoch_532,epoch);
 assert.ok(authReads>0&&firestoreReads>0);
 console.log('APP547_PHYSICAL_PROFILE_DELETE_RECREATE_STALE_SIGNED_EVENT_DENIED=PASS');
 console.log('APP547_CURRENT_FIREBASE_ADMIN_HMAC_NONCE_PRE_POST_AUTH_PROOF=PASS');
 console.log('APP547_OFF_NO_D1_AUTH_READ_REPLAY_NO_ROW_RESURRECTION=PASS');
 console.log('APP574_WRONG_CANARY_OWNER_D1_R0_W0_AUTH_R0=PASS');
}finally{db.close()}

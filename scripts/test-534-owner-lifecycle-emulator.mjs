// APP534 source-only: genuine local Firebase Auth + Firestore + RTDB emulators.
// Never run with real credentials, non-demo project or non-loopback endpoints.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getDatabase} from 'firebase-admin/database';
import {getFirestore} from 'firebase-admin/firestore';
// The existing Functions tsconfig emits CommonJS. Node's ESM test runner
// imports its namespace via the default CJS interop binding.
const module534=await import('../functions/src/ownerFollowLifecycle534.ts');
const module535=await import('../functions/src/ownerFollowHoldRecovery535.ts');
const {
 APP535_HOLD_RECOVERY_COMPILED_OPEN,
 inspectOwnerFollowHold535,recoverOwnerFollowHold535,
}=module535.default||module535;
const {
 APP534_LIFECYCLE_DELETE_HOOK_COMPILED_OPEN,APP534_OWNER_CLAIM,
 enrollOwnerFollowEpoch534,prepareOwnerFollowDeletion534,
 finishOwnerFollowDeletion534,
}=module534.default||module534;
import {
 deliverOwnerFollower533,signReceiptForEmulator533,
} from '../functions/experiments/owner-follow-auth-533.mjs';
const PROJECT='demo-soridraw-owner-534',NS=PROJECT+'-default-rtdb';
const secret='emulator-only-owner-follow-534-HMAC-secret-test';
const UID='owner534',EMAIL='owner534@example.test',PASSWORD='emulator-test-534';
assert.equal(process.env.APP534_ISOLATED_ONLY,'yes');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9099');
assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,'127.0.0.1:9000');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8080');
assert.equal(process.env.GCLOUD_PROJECT,PROJECT);
assert.equal(process.env.FIREBASE_PROJECT_ID,PROJECT);
assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS,undefined);
assert.equal(process.env.FIREBASE_TOKEN,undefined);
assert.equal(APP534_LIFECYCLE_DELETE_HOOK_COMPILED_OPEN,false);
assert.equal(APP535_HOLD_RECOVERY_COMPILED_OPEN,false);
const source=readFileSync('functions/src/index.ts','utf8');
const trigger=source.indexOf('export const adminDeleteUserAccount = onCall(');
const scope=source.slice(trigger,source.indexOf('const APP_CHECK_STATUS_HEADER',trigger));
assert.ok(trigger>0);
assert.ok(scope.indexOf('prepareOwnerFollowDeletion534')<scope.indexOf('admin.auth().deleteUser(targetUid)'));
assert.ok(scope.indexOf('admin.auth().deleteUser(targetUid)')<scope.indexOf('finishOwnerFollowDeletion534'));
assert.ok(scope.indexOf('await cleanupBatch.commit()')<scope.indexOf('finishOwnerFollowDeletion534'));
assert.match(scope,/APP534_LIFECYCLE_DELETE_HOOK_COMPILED_OPEN/);
assert.match(source,/adminDeletionContentPolicy: "retain-user-content"/);
const sql=readFileSync('cloudflare/explore-worker/runtime/owner-follow-auth-epoch-532.mjs','utf8');
assert.match(sql,/OWNER_FOLLOW_AUTH_EPOCH_532_COMPILED_OPEN=false/);
assert.match(sql,/owner_follow_auth_epoch_532=\?/);
assert.match(readFileSync('scripts/emulator/app534.firebase.json','utf8'),/app534.firestore.rules/);
const app=initializeApp({projectId:PROJECT,databaseURL:'https://'+NS+'.firebaseio.com'},'isolated-534');
const auth=getAuth(app),firestore=getFirestore(app),database=getDatabase(app);
const doc=uid=>firestore.collection('users').doc(uid);
const marker=uid=>database.ref('ownerFollowerSync532/'+uid);
const assertHold=async(promise,re)=>assert.rejects(promise,re);
const delay=async(ms=30)=>new Promise(r=>setTimeout(r,ms));
function barrier(){
 let release,mark;
 const gate=new Promise(r=>release=r),reached=new Promise(r=>mark=r);
 return {gate,reached,release,mark};
}
function receipt(uid,epoch,version=1,count=2){
 const at=Date.now();
 const value={version:1,ownerUid:uid,authEpoch:epoch,revision:version,followerCount:count,updatedAt:at,at};
 const rawBody=JSON.stringify(value);
 return {auth,database,rawBody,at:String(at),
  signature:signReceiptForEmulator533(rawBody,at,secret),secret};
}
const stats={};
try{
 // Existing content survives opt-in and the Auth-only account-deletion contract.
 await auth.createUser({uid:UID,email:EMAIL,password:PASSWORD});
 await auth.setCustomUserClaims(UID,{role:'basic',subscription:'test'});
 await doc(UID).set({favoriteCount:17,accountStatus:'active',musicNote:'keep-existing'});
 const hold=barrier();
 let setterCount=0;
 const pausedAuth={
  getUser:(id)=>auth.getUser(id),
  setCustomUserClaims:async(id,claims)=>{
   setterCount++;
   hold.mark();await hold.gate;
   return auth.setCustomUserClaims(id,claims);
  },
 };
 const first=enrollOwnerFollowEpoch534({auth:pausedAuth,firestore,uid:UID});
 await hold.reached;
 await assertHold(enrollOwnerFollowEpoch534({auth,firestore,uid:UID}),
  /APP534_RESERVATION_HELD/);
 assert.equal(setterCount,1);
 hold.release();
 const issued=await first;
 assert.equal(issued.reused,false);
 assert.match(issued.authEpoch,/^[a-f0-9]{32}$/);
 const repeated=await enrollOwnerFollowEpoch534({auth,firestore,uid:UID});
 assert.equal(repeated.reused,true);
 assert.equal(repeated.authEpoch,issued.authEpoch);
 assert.equal((await doc(UID).get()).get('favoriteCount'),17);
 assert.equal((await doc(UID).get()).get('musicNote'),'keep-existing');
 assert.equal((await auth.getUser(UID)).customClaims.role,'basic');
 stats.singleIssuanceConcurrency='PASS';
 stats.otherClaimsAndContentPreserved='PASS';

 // Test a pending reserved claim after a simulated crash.
 const CRASH='reserved534',eCrash=randomBytes(16).toString('hex');
 await auth.createUser({uid:CRASH,email:'reserved534@example.test',password:PASSWORD});
 const birth=Date.parse((await auth.getUser(CRASH)).metadata.creationTime);
 await doc(CRASH).set({ownerFollowLifecycle534:{
  phase:'reserved',epoch:eCrash,createdAtMs:birth,changedAtMs:Date.now()}},{merge:true});
 await assertHold(enrollOwnerFollowEpoch534({auth,firestore,uid:CRASH}),
  /APP534_RESERVATION_HELD/);
 await auth.setCustomUserClaims(CRASH,{[APP534_OWNER_CLAIM]:eCrash});
 const rescued=await enrollOwnerFollowEpoch534({auth,firestore,uid:CRASH});
 assert.equal(rescued.authEpoch,eCrash);
 assert.equal((await doc(CRASH).get()).get('ownerFollowLifecycle534.phase'),'active');
 stats.reservedCrashExactRecovery='PASS';

 // Enrollment is an explicit opt-in. Legacy Auth-only forced deletion does not
 // write a lifecycle field or delete unrelated user content.
 const LEGACY='legacy534';
 await auth.createUser({uid:LEGACY,email:'legacy534@example.test',password:PASSWORD});
 await doc(LEGACY).set({favoriteCount:91});
 const noState=await prepareOwnerFollowDeletion534({firestore,auth,uid:LEGACY});
 assert.equal(noState.skipped,true);
 assert.equal((await doc(LEGACY).get()).get('favoriteCount'),91);
 await auth.deleteUser(LEGACY);
 stats.oldAccountNoOp='PASS';

 // Actual Auth + RTDB marker, then deletion fence before deleting Auth.
 const beforeDelete=await deliverOwnerFollower533(receipt(UID,issued.authEpoch,1,2));
 assert.equal(beforeDelete.accepted,true);
 assert.equal((await marker(UID).get()).val().authEpoch,issued.authEpoch);
 const oldCreationTime=(await auth.getUser(UID)).metadata.creationTime;
 const plan=await prepareOwnerFollowDeletion534({firestore,auth,uid:UID});
 assert.equal(plan.skipped,false);
 assert.equal(plan.epoch,issued.authEpoch);
 await assertHold(enrollOwnerFollowEpoch534({auth,firestore,uid:UID}),
  /APP534_DELETION_FENCE_ACTIVE/);
 await assertHold(finishOwnerFollowDeletion534({
  firestore,auth,database,uid:UID,epoch:plan.epoch,
 }),/APP534_AUTH_USER_STILL_EXISTS/);
 // Contract: deletion of Auth user does not alter Music Note / other user data.
 await auth.deleteUser(UID);
 const finished=await finishOwnerFollowDeletion534({
  firestore,auth,database,uid:UID,epoch:plan.epoch,
 });
 assert.equal(finished.finished,true);
 assert.equal((await marker(UID).get()).exists(),false);
 assert.equal((await doc(UID).get()).get('favoriteCount'),17);
 assert.equal((await doc(UID).get()).get('musicNote'),'keep-existing');
 assert.equal((await doc(UID).get()).get('ownerFollowLifecycle534.phase'),'deleted');
 stats.authOnlyDeleteFenceAndCleanup='PASS';

 // A real Auth account with SAME UID and SAME exposed creationTime must still
 // receive a different epoch after the recorded deletion boundary.
 await auth.createUser({uid:UID,email:EMAIL,password:PASSWORD});
 const forcedTime=oldCreationTime;
 const equalTimeAuth={
  getUser:async id=>{
   const raw=await auth.getUser(id);
   return {...raw,metadata:{...raw.metadata,creationTime:forcedTime}};
  },
  setCustomUserClaims:(id,claims)=>auth.setCustomUserClaims(id,claims),
 };
 const second=await enrollOwnerFollowEpoch534({auth:equalTimeAuth,firestore,uid:UID});
 assert.notEqual(second.authEpoch,issued.authEpoch);
 assert.equal(second.createdAtMs,issued.createdAtMs);
 assert.equal(second.createdAtMs,Date.parse(forcedTime));
 assert.equal((await doc(UID).get()).get('ownerFollowLifecycle534.phase'),'active');
 // The prior incarnation's authenticated relay cannot overwrite new generation.
 assert.equal((await deliverOwnerFollower533(receipt(UID,issued.authEpoch,3,9))).accepted,false);
 const newPublish=await deliverOwnerFollower533(receipt(UID,second.authEpoch,1,3));
 assert.equal(newPublish.accepted,true);
 assert.equal((await marker(UID).get()).val().followerCount,3);
 // Earlier finish is fenced by epoch: an old cleanup cannot touch a new marker.
 await assertHold(finishOwnerFollowDeletion534({
  firestore,auth,database,uid:UID,epoch:issued.authEpoch,
 }),/APP534_DELETE_FENCE_MISMATCH/);
 assert.equal((await marker(UID).get()).val().authEpoch,second.authEpoch);
 stats.sameTimestampNewEpoch='PASS';

 // A delete request concurrent with an in-progress reservation fences it.
 const RACE='race534';
 await auth.createUser({uid:RACE,email:'race534@example.test',password:PASSWORD});
 const held=barrier();
 const slowAuth={
  getUser:id=>auth.getUser(id),
  setCustomUserClaims:async(id,claims)=>{
   held.mark();await held.gate;
   return auth.setCustomUserClaims(id,claims);
  },
 };
 const stillIssuing=enrollOwnerFollowEpoch534({auth:slowAuth,firestore,uid:RACE});
 await held.reached;
 const during=await prepareOwnerFollowDeletion534({firestore,auth,uid:RACE});
 assert.equal(during.skipped,false);
 held.release();
 await assertHold(stillIssuing,/APP534_FENCE_CHANGED_AFTER_CLAIM/);
 await auth.deleteUser(RACE);
 await finishOwnerFollowDeletion534({firestore,auth,database,uid:RACE,epoch:during.epoch});
 assert.equal((await doc(RACE).get()).get('ownerFollowLifecycle534.phase'),'deleted');
 stats.deleteDuringClaimReservation='PASS';

 // APP535: reserved recovery is permitted only for an exact, already-issued
 // Auth claim. An unclaimed reservation must not auto expire/reissue.
 const HOLD='unclaimed535',EXACT='claimed535';
 for(const uid of [HOLD,EXACT]){
  await auth.createUser({uid,email:uid+'@example.test',password:PASSWORD});
  const stamp=Date.parse((await auth.getUser(uid)).metadata.creationTime);
  await doc(uid).set({favoriteCount:67,ownerFollowLifecycle534:{
   phase:'reserved',epoch:randomBytes(16).toString('hex'),
   createdAtMs:stamp,changedAtMs:Date.now(),
  }});
 }
 const heldInspection=await inspectOwnerFollowHold535({firestore,auth,uid:HOLD});
 assert.equal(heldInspection.action,'hold');
 assert.equal(heldInspection.reason,'RESERVATION_UNCLAIMED');
 const heldResult=await recoverOwnerFollowHold535({firestore,auth,database,uid:HOLD});
 assert.equal(heldResult.recovered,false);
 assert.equal((await doc(HOLD).get()).get('ownerFollowLifecycle534.phase'),'reserved');
 assert.equal((await auth.getUser(HOLD)).customClaims?.[APP534_OWNER_CLAIM],undefined);
 const exactEpoch=(await doc(EXACT).get()).get('ownerFollowLifecycle534.epoch');
 await auth.setCustomUserClaims(EXACT,{plan:'pro',[APP534_OWNER_CLAIM]:exactEpoch});
 assert.equal((await inspectOwnerFollowHold535({firestore,auth,uid:EXACT})).action,'recover-reserved');
 const resumed=await recoverOwnerFollowHold535({firestore,auth,database,uid:EXACT});
 assert.equal(resumed.recovered,true);
 assert.equal((await doc(EXACT).get()).get('ownerFollowLifecycle534.phase'),'active');
 assert.equal((await auth.getUser(EXACT)).customClaims.plan,'pro');
 assert.equal((await doc(EXACT).get()).get('favoriteCount'),67);
 assert.equal((await recoverOwnerFollowHold535({firestore,auth,database,uid:EXACT})).recovered,false);
 stats.reservedHeldAndExactRecovery535='PASS';

 // Auth vanished while a reservation is unclaimed: no time-based or
 // unauthorized recovery, even if a re-created Auth has same UID.
 await auth.deleteUser(HOLD);
 assert.equal((await inspectOwnerFollowHold535({firestore,auth,uid:HOLD})).reason,'RESERVED_AUTH_MISSING');
 await auth.createUser({uid:HOLD,email:HOLD+'@example.test',password:PASSWORD});
 assert.equal((await recoverOwnerFollowHold535({firestore,auth,database,uid:HOLD})).recovered,false);
 assert.equal((await doc(HOLD).get()).get('ownerFollowLifecycle534.phase'),'reserved');
 stats.reservedRecreationHeld535='PASS';

 // The existing admin path commits Auth deletion, personal API-key removal and
 // the retained-content policy BEFORE APP534 optional owner-signal cleanup.
 // Recovery cannot assume that an absent Auth user proves these writes.
 const PENDING='deleting535';
 await auth.createUser({uid:PENDING,email:PENDING+'@example.test',password:PASSWORD});
 await doc(PENDING).set({musicNote:'keep',favoriteCount:14,accountStatus:'active'});
 const enrolledPending=await enrollOwnerFollowEpoch534({firestore,auth,uid:PENDING});
 assert.equal((await deliverOwnerFollower533(receipt(PENDING,enrolledPending.authEpoch))).accepted,true);
 const pendingPlan=await prepareOwnerFollowDeletion534({firestore,auth,uid:PENDING});
 await auth.deleteUser(PENDING);
 const noCommit=await recoverOwnerFollowHold535({firestore,auth,database,uid:PENDING});
 assert.equal(noCommit.recovered,false);
 assert.equal(noCommit.reason,'ADMIN_DELETE_NOT_COMMITTED');
 assert.equal((await marker(PENDING).get()).exists(),true);
 await doc(PENDING).set({authDeleted:true,adminDeletionContentPolicy:'retain-user-content'},{merge:true});
 const completed=await recoverOwnerFollowHold535({firestore,auth,database,uid:PENDING});
 assert.equal(completed.recovered,true);
 assert.equal((await marker(PENDING).get()).exists(),false);
 assert.equal((await doc(PENDING).get()).get('ownerFollowLifecycle534.phase'),'deleted');
 assert.equal((await doc(PENDING).get()).get('favoriteCount'),14);
 assert.equal((await doc(PENDING).get()).get('musicNote'),'keep');
 const completedAgain=await recoverOwnerFollowHold535({firestore,auth,database,uid:PENDING});
 assert.equal(completedAgain.recovered,false);
 assert.equal(completedAgain.action,'settled');
 assert.equal(pendingPlan.epoch,enrolledPending.authEpoch);
 stats.deletingAdminCommitRequired535='PASS';

 // Even an Auth record with a *different* generation blocks finish. It may
 // be a recreated account after an uncoordinated delete; never erase its
 // marker or claim on behalf of the previous incarnation.
 const RECREATE='recreated535';
 await auth.createUser({uid:RECREATE,email:RECREATE+'@example.test',password:PASSWORD});
 await doc(RECREATE).set({favoriteCount:22});
 const firstGen=await enrollOwnerFollowEpoch534({firestore,auth,uid:RECREATE});
 await deliverOwnerFollower533(receipt(RECREATE,firstGen.authEpoch,1,11));
 await prepareOwnerFollowDeletion534({firestore,auth,uid:RECREATE});
 await doc(RECREATE).set({authDeleted:true,adminDeletionContentPolicy:'retain-user-content'},{merge:true});
 assert.equal((await inspectOwnerFollowHold535({firestore,auth,uid:RECREATE})).reason,'AUTH_PRESENT_AFTER_DELETE');
 await assertHold(finishOwnerFollowDeletion534({
  firestore,auth,database,uid:RECREATE,epoch:firstGen.authEpoch,
 }),/APP534_AUTH_USER_STILL_EXISTS/);
 await auth.deleteUser(RECREATE);
 await auth.createUser({uid:RECREATE,email:RECREATE+'@example.test',password:PASSWORD});
 const externalEpoch=randomBytes(16).toString('hex');
 await auth.setCustomUserClaims(RECREATE,{[APP534_OWNER_CLAIM]:externalEpoch});
 await marker(RECREATE).set({
  ownerUid:RECREATE,authEpoch:externalEpoch,version:1,followerCount:17,
  authCreatedAtMs:Date.parse((await auth.getUser(RECREATE)).metadata.creationTime),
 });
 assert.equal((await recoverOwnerFollowHold535({firestore,auth,database,uid:RECREATE})).recovered,false);
 await assertHold(finishOwnerFollowDeletion534({
  firestore,auth,database,uid:RECREATE,epoch:firstGen.authEpoch,
 }),/APP534_AUTH_USER_STILL_EXISTS/);
 assert.equal((await marker(RECREATE).get()).val().authEpoch,externalEpoch);
 stats.recreatedAuthCannotFinishOldDeletion535='PASS';

 // An external claim writer can overwrite APP534's whole custom-claims map.
 // Detect drift read-only and never auto replace the external writer's data.
 const DRIFT='claimdrift535';
 await auth.createUser({uid:DRIFT,email:DRIFT+'@example.test',password:PASSWORD});
 const ownedDrift=await enrollOwnerFollowEpoch534({firestore,auth,uid:DRIFT});
 await auth.setCustomUserClaims(DRIFT,{role:'admin-only-test'});
 const drift=await inspectOwnerFollowHold535({firestore,auth,uid:DRIFT});
 assert.equal(drift.action,'hold');
 assert.equal(drift.reason,'ACTIVE_AUTH_DRIFT');
 assert.equal((await recoverOwnerFollowHold535({firestore,auth,database,uid:DRIFT})).recovered,false);
 assert.equal((await auth.getUser(DRIFT)).customClaims.role,'admin-only-test');
 assert.equal((await doc(DRIFT).get()).get('ownerFollowLifecycle534.epoch'),ownedDrift.authEpoch);
 stats.otherClaimWriterDriftHeld535='PASS';

 // The app's current admin Auth operations are revokeRefreshTokens,
 // emailVerified updateUser, and Auth deletion; no custom-claim writer
 // is present in preview index. The current product callable stays OFF.
 const idx=readFileSync('functions/src/index.ts','utf8');
 assert.ok(idx.includes('admin.auth().updateUser(targetUid, { emailVerified: false })'));
 assert.ok(idx.includes('admin.auth().revokeRefreshTokens(targetUid)'));
 assert.ok(idx.includes('admin.auth().deleteUser(targetUid)'));
 assert.ok(!idx.includes('setCustomUserClaims('));
 stats.existingAuthWriterInventory535='PASS';

 // Admin Auth-only deletion leaves banned/disabled status. Auto login/claim
 // issuance must never revive that retained account without a deliberate
 // approved account-restoration contract.
 const BLOCK='banned535';
 await auth.createUser({uid:BLOCK,email:BLOCK+'@example.test',password:PASSWORD});
 await doc(BLOCK).set({accountStatus:'banned'});
 await assertHold(enrollOwnerFollowEpoch534({firestore,auth,uid:BLOCK}),
  /APP534_ACCOUNT_DELETION_STATUS_HOLD/);
 assert.equal((await auth.getUser(BLOCK)).customClaims?.[APP534_OWNER_CLAIM],undefined);
 stats.bannedAccountEnrollmentHeld535='PASS';

 console.log('APP535_FIREBASE_AUTH_FIRESTORE_RTDB_HOLD_RECOVERY=PASS');
 console.log(JSON.stringify({kind:'APP534_EMULATOR_LIFECYCLE',project:PROJECT,checks:stats,
  sharedWrites:0,hostingDeploys:0,d1W2:'unchanged previously verified APP532',
  caveats:['Current product deletion callable not invoked: compile-time guard OFF; source anchor order checked',
   'Existing Firestore users document is retained on Auth-only deletion; no new permanent UID table',
   'Other custom claim writers must serialize with this contract',
   'Cross-service Auth/Firestore/RTDB cannot be perfectly atomic, so source remains NO-GO']},null,2));
}finally{
 await deleteApp(app);
}

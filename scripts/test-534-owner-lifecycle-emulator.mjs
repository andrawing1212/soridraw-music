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
 }),/APP534_OLD_AUTH_STILL_EXISTS/);
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
 console.log('APP534_FIREBASE_AUTH_FIRESTORE_RTDB_ISOLATED=PASS');
 console.log(JSON.stringify({kind:'APP534_EMULATOR_LIFECYCLE',project:PROJECT,checks:stats,
  sharedWrites:0,hostingDeploys:0,d1W2:'unchanged previously verified APP532',
  caveats:['Current product deletion callable not invoked: compile-time guard OFF; source anchor order checked',
   'Existing Firestore users document is retained on Auth-only deletion; no new permanent UID table',
   'Other custom claim writers must serialize with this contract',
   'Cross-service Auth/Firestore/RTDB cannot be perfectly atomic, so source remains NO-GO']},null,2));
}finally{
 await deleteApp(app);
}

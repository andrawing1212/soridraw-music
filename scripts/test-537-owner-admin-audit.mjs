// APP537: real demo Firebase Auth/Firestore/RTDB emulator audit-fenced
// admin callable adapter. No live endpoint, credentials, network or deploy.
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {readFileSync} from "node:fs";
import {initializeApp,deleteApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
import {getDatabase} from "firebase-admin/database";
const M534=await import("../functions/src/ownerFollowLifecycle534.ts");
const {APP534_OWNER_CLAIM,enrollOwnerFollowEpoch534,
 prepareOwnerFollowDeletion534}=M534.default||M534;
const M536=await import("../functions/src/ownerFollowManualReview536.ts");
const {APP536_EXPLICIT_CONFIRMATION}=M536.default||M536;
const M537=await import("../functions/src/ownerFollowAdminAdapter537.ts");
const {APP537_ADMIN_RECOVERY_COMPILED_OPEN,APP537_AUDIT_COLLECTION,
 APP537_TARGET_GATE_COLLECTION,inspectOwnerFollowCallable537,
 confirmOwnerFollowCallable537,inspectOwnerFollowAttempt537}=M537.default||M537;
const PROJECT="demo-soridraw-owner-534",NS=PROJECT+"-default-rtdb";
const PASSWORD="isolated-537-password-only";
const KEY="APP537_LOCAL_ONLY_HMAC_SIGNING_KEY_32BYTES_DO_NOT_USE_LIVE";
assert.equal(process.env.APP534_ISOLATED_ONLY,"yes");
assert.equal(process.env.GCLOUD_PROJECT,PROJECT);
assert.equal(process.env.FIREBASE_PROJECT_ID,PROJECT);
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,"127.0.0.1:9099");
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,"127.0.0.1:8080");
assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,"127.0.0.1:9000");
assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS,undefined);
assert.equal(process.env.FIREBASE_TOKEN,undefined);
assert.equal(APP537_ADMIN_RECOVERY_COMPILED_OPEN,false);
const index=readFileSync("functions/src/index.ts","utf8");
assert.ok(index.includes("const requireAdminCaller ="));
assert.ok(index.includes('requireAdminCaller(request, "userManagement")'));
assert.ok(!index.includes("inspectOwnerFollowCallable537"));
assert.ok(!index.includes("confirmOwnerFollowCallable537"));
assert.ok(!index.includes("APP537_ADMIN_RECOVERY_COMPILED_OPEN"));
const app=initializeApp({projectId:PROJECT,
 databaseURL:"https://"+NS+".firebaseio.com"},"isolated-537");
const auth=getAuth(app),firestore=getFirestore(app),database=getDatabase(app);
const user=uid=>firestore.collection("users").doc(uid);
const gate=uid=>firestore.collection(APP537_TARGET_GATE_COLLECTION).doc(uid);
const audit=id=>firestore.collection(APP537_AUDIT_COLLECTION).doc(id);
const create=async (uid,extra={})=>{
 await auth.createUser({uid,email:uid+"@example.test",password:PASSWORD});
 await user(uid).set({musicNote:"keep-original",favoriteCount:73,...extra});
};
const token=async uid=>{
 const url="http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-537";
 const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({email:uid+"@example.test",password:PASSWORD,returnSecureToken:true})});
 const value=await r.json();
 assert.equal(r.status,200,JSON.stringify(value));return value.idToken;
};
const request=(actor,target,adminIdToken,more={})=>({
 auth:{uid:actor},data:{targetUid:target,adminIdToken,...more},
});
const deps={firestore,auth,database,signingKey:KEY};
const reserved=async uid=>{
 await create(uid);
 const epoch=randomBytes(16).toString("hex");
 await user(uid).set({ownerFollowLifecycle534:{
  phase:"reserved",epoch,createdAtMs:Date.parse((await auth.getUser(uid)).metadata.creationTime),
  changedAtMs:Date.now(),
 }},{merge:true});
 await auth.setCustomUserClaims(uid,{plan:"pro",[APP534_OWNER_CLAIM]:epoch});
 return epoch;
};
const confirmRequest=(actor,uid,idToken,ticket)=>request(actor,uid,idToken,{
 ticket,confirmation:APP536_EXPLICIT_CONFIRMATION,
});
const reject=async(p,re)=>assert.rejects(p,re);
const operator="operator537",other="other537",outsider="outsider537";
const checks={};
try{
 await create(operator,{role:"admin",staffRole:"admin",adminPermissions:{userManagement:true}});
 await create(other,{role:"admin",staffRole:"master"});
 await create(outsider,{role:"free"});
 const actorToken=await token(operator),otherToken=await token(other),
  outsiderToken=await token(outsider);

 // All entrypoints require authenticated callable identity matching a real
 // unrevoked Firebase token; no call can grant its own admin flag.
 const UNCLAIMED="unclaimed537";
 await create(UNCLAIMED);
 const preUser=(await user(UNCLAIMED).get()).updateTime.toMillis();
 await reject(inspectOwnerFollowCallable537(request(outsider,UNCLAIMED,outsiderToken),deps),
  /APP536_USER_MANAGEMENT_PERMISSION_REQUIRED/);
 await reject(inspectOwnerFollowCallable537(request(operator,UNCLAIMED,outsiderToken),deps),
  /APP537_CALLABLE_PRINCIPAL_MISMATCH/);
 await reject(inspectOwnerFollowCallable537({
  data:{targetUid:UNCLAIMED,adminIdToken:actorToken}},deps),
  /APP537_AUTHENTICATED_CALLABLE_REQUIRED/);
 await reject(inspectOwnerFollowCallable537(request(operator,other,actorToken),deps),
  /APP536_PROTECTED_STAFF_TARGET/);
 const result=await inspectOwnerFollowCallable537(request(operator,UNCLAIMED,actorToken),deps);
 assert.equal(result.recoverable,false);
 assert.equal(result.ticket,null);
 assert.equal((await user(UNCLAIMED).get()).updateTime.toMillis(),preUser);
 assert.equal((await gate(UNCLAIMED).get()).exists,false);
 checks.readOnlyPermissionAndProtectedTargets="PASS";

 // Explicit two-phase callback creates NO audit until a fully verified
 // confirmation. Only private server-controlled admin collections are written.
 const RES="reserved537";
 const epoch=await reserved(RES);
 const inspectReq=request(operator,RES,actorToken);
 const inspected=await inspectOwnerFollowCallable537(inspectReq,deps);
 assert.equal(inspected.action,"recover-reserved");
 assert.ok(inspected.ticket);
 assert.equal((await gate(RES).get()).exists,false);
 const confirmReq=confirmRequest(operator,RES,actorToken,inspected.ticket);
 await reject(confirmOwnerFollowCallable537({...confirmReq,
  data:{...confirmReq.data,confirmation:"yes"}},deps),
  /APP536_EXPLICIT_CONFIRMATION_REQUIRED/);
 assert.equal((await gate(RES).get()).exists,false);
 const accepted=await confirmOwnerFollowCallable537(confirmReq,deps);
 assert.equal(accepted.recovered,true);
 assert.equal(accepted.action,"recover-reserved");
 assert.equal((await gate(RES).get()).get("status"),"succeeded");
 assert.equal((await audit(accepted.attemptId).get()).get("status"),"succeeded");
 assert.equal((await audit(accepted.attemptId).get()).get("actorUid"),operator);
 assert.equal((await audit(accepted.attemptId).get()).get("targetUid"),RES);
 assert.equal((await audit(accepted.attemptId).get()).get("ticket"),undefined);
 assert.equal((await user(RES).get()).get("ownerFollowLifecycle534.phase"),"active");
 assert.equal((await user(RES).get()).get("musicNote"),"keep-original");
 assert.equal((await auth.getUser(RES)).customClaims[APP534_OWNER_CLAIM],epoch);
 await reject(confirmOwnerFollowCallable537(confirmReq,deps),
  /APP536_APPROVAL_STALE_OR_HELD/);
 const beforeAudit=(await audit(accepted.attemptId).get()).updateTime.toMillis();
 const status=await inspectOwnerFollowAttempt537({
  ...inspectReq,data:{...inspectReq.data,attemptId:accepted.attemptId}},deps);
 assert.equal(status.status,"succeeded");
 assert.equal(status.reviewAction,"settled");
 assert.equal((await audit(accepted.attemptId).get()).updateTime.toMillis(),beforeAudit);
 await reject(inspectOwnerFollowAttempt537({
  ...inspectReq,auth:{uid:other},data:{...inspectReq.data,
   adminIdToken:otherToken,attemptId:accepted.attemptId}},deps),
  /APP537_AUDIT_OPERATOR_MISMATCH/);
 checks.explicitAuditRecordedBeforeReplay="PASS";

 // If audit storage is unavailable, the recovery is NEVER attempted.
 const AUDITDOWN="auditdown537";
 await reserved(AUDITDOWN);
 const downRequest=request(operator,AUDITDOWN,actorToken);
 const downTicket=(await inspectOwnerFollowCallable537(downRequest,deps)).ticket;
 const unavailableDb={
  collection:name=>firestore.collection(name),
  runTransaction:async()=>{throw Error("AUDIT_UNAVAILABLE_537");},
 };
 await reject(confirmOwnerFollowCallable537(confirmRequest(operator,
  AUDITDOWN,actorToken,downTicket),{...deps,firestore:unavailableDb}),
  /AUDIT_UNAVAILABLE_537/);
 assert.equal((await user(AUDITDOWN).get()).get("ownerFollowLifecycle534.phase"),"reserved");
 assert.equal((await gate(AUDITDOWN).get()).exists,false);
 checks.auditWriteFailurePreventsRecovery="PASS";

 // Force a crash inside APP535 recovery AFTER audit start but BEFORE any
 // lifecycle transition. The attempt stays needs-review; a new ticket
 // cannot silently bypass its target gate.
 const FAIL="fail537";
 await reserved(FAIL);
 const failReq=request(operator,FAIL,actorToken);
 const failTicket=(await inspectOwnerFollowCallable537(failReq,deps)).ticket;
 let transactionCount=0;
 const failedDb={
  collection:name=>firestore.collection(name),
  runTransaction:async func=>{
   transactionCount++;
   if(transactionCount===2)throw Error("INJECTED_RECOVERY_FAILURE");
   return firestore.runTransaction(func);
  },
 };
 await reject(confirmOwnerFollowCallable537(confirmRequest(operator,
  FAIL,actorToken,failTicket),{...deps,firestore:failedDb}),
  /APP537_RECOVERY_FAILED_HELD/);
 assert.equal((await gate(FAIL).get()).get("status"),"needs-review");
 assert.equal((await user(FAIL).get()).get("ownerFollowLifecycle534.phase"),"reserved");
 const secondTicket=(await inspectOwnerFollowCallable537(failReq,deps)).ticket;
 await reject(confirmOwnerFollowCallable537(confirmRequest(operator,
  FAIL,actorToken,secondTicket),deps),
  /APP537_PREVIOUS_ATTEMPT_REQUIRES_REVIEW/);
 const heldStatus=await inspectOwnerFollowAttempt537(failReq,deps);
 assert.equal(heldStatus.status,"needs-review");
 assert.equal(heldStatus.errorCode,"APP537_UNCLASSIFIED_RECOVERY_FAILURE");
 assert.equal(heldStatus.reviewAction,"recover-reserved");
 checks.failedAttemptHeldWithoutAutoRetry="PASS";

 // If the *final* audit write fails AFTER successful recovery, never
 // return success. The STARTED gate and audit remain for operator triage.
 const AFTER="after537";
 await reserved(AFTER);
 const afterReq=request(operator,AFTER,actorToken);
 const afterTicket=(await inspectOwnerFollowCallable537(afterReq,deps)).ticket;
 let txn=0;
 const auditFinalizeDown={
  collection:name=>firestore.collection(name),
  runTransaction:async func=>{
   txn++;
   if(txn===4)throw Error("FINAL_AUDIT_UNAVAILABLE");
   return firestore.runTransaction(func);
  },
 };
 await reject(confirmOwnerFollowCallable537(confirmRequest(operator,
  AFTER,actorToken,afterTicket),{...deps,firestore:auditFinalizeDown}),
  /APP537_AUDIT_OUTCOME_UNKNOWN/);
 assert.equal((await user(AFTER).get()).get("ownerFollowLifecycle534.phase"),"active");
 assert.equal((await gate(AFTER).get()).get("status"),"started");
 const uncertain=await inspectOwnerFollowAttempt537(afterReq,deps);
 assert.equal(uncertain.status,"started");
 assert.equal(uncertain.reviewAction,"settled");
 await reject(confirmOwnerFollowCallable537(confirmRequest(operator,
  AFTER,actorToken,afterTicket),deps),/APP536_APPROVAL_STALE_OR_HELD/);
 checks.auditFinalizationFailureIsUncertain="PASS";

 // Two admins cannot concurrently execute different tickets against the
 // same target. Firestore's per-target transaction gate elects one.
 const CONCURRENT="concurrent537";
 await reserved(CONCURRENT);
 const aTicket=(await inspectOwnerFollowCallable537(request(operator,
  CONCURRENT,actorToken),deps)).ticket;
 const bTicket=(await inspectOwnerFollowCallable537(request(other,
  CONCURRENT,otherToken),deps)).ticket;
 const competing=await Promise.allSettled([
  confirmOwnerFollowCallable537(confirmRequest(operator,CONCURRENT,actorToken,aTicket),deps),
  confirmOwnerFollowCallable537(confirmRequest(other,CONCURRENT,otherToken,bTicket),deps),
 ]);
 assert.equal(competing.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(competing.filter(x=>x.status==="rejected").length,1);
 assert.equal((await gate(CONCURRENT).get()).get("status"),"succeeded");
 assert.equal((await user(CONCURRENT).get()).get("ownerFollowLifecycle534.phase"),"active");
 checks.concurrentAdminSingleTargetGate="PASS";

 // Deleting completion keeps canonical user contents, Auth deletion proof
 // and only removes the retired generation RTDB marker with approval.
 const DELETING="deleting537";
 await create(DELETING);
 const enrolled=await enrollOwnerFollowEpoch534({firestore,auth,uid:DELETING});
 await prepareOwnerFollowDeletion534({firestore,auth,uid:DELETING});
 await auth.deleteUser(DELETING);
 await user(DELETING).set({
  authDeleted:true,adminDeletionContentPolicy:"retain-user-content",
  accountStatus:"banned",
 },{merge:true});
 const deletingReq=request(operator,DELETING,actorToken);
 const deleteTicket=(await inspectOwnerFollowCallable537(deletingReq,deps)).ticket;
 assert.ok(deleteTicket);
 const deleteResult=await confirmOwnerFollowCallable537(confirmRequest(operator,
  DELETING,actorToken,deleteTicket),deps);
 assert.equal(deleteResult.action,"recover-deleting");
 assert.equal((await gate(DELETING).get()).get("status"),"succeeded");
 assert.equal((await user(DELETING).get()).get("ownerFollowLifecycle534.phase"),"deleted");
 assert.equal((await user(DELETING).get()).get("musicNote"),"keep-original");
 assert.equal((await user(DELETING).get()).get("favoriteCount"),73);
 assert.equal((await user(DELETING).get()).get("ownerFollowLifecycle534.epoch"),enrolled.authEpoch);
 checks.deletingCompletionAuditedAndContentPreserved="PASS";
 console.log("APP537_ADMIN_AUDIT_EMULATOR_E2E=PASS");
 console.log(JSON.stringify({project:PROJECT,checks,
  sharedWrites:0,deployments:0,liveCallablesRegistered:0,
  caveats:["Durable audit gate remains held on uncertain or failed outcome",
   "No operator unlock, auto retry, paid D1 or production audit collection enabled",
   "Active APP536/537 integration remains source-only and NO-GO"]},null,2));
}finally{await deleteApp(app);}

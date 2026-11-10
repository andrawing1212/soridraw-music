// APP536: source-only two-step admin diagnostics and explicit recovery.
// Only demo Firebase Auth + Firestore + RTDB emulators. Never live credentials.
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {readFileSync} from "node:fs";
import {initializeApp,deleteApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getDatabase} from "firebase-admin/database";
import {getFirestore} from "firebase-admin/firestore";
const module534=await import("../functions/src/ownerFollowLifecycle534.ts");
const {enrollOwnerFollowEpoch534,prepareOwnerFollowDeletion534,APP534_OWNER_CLAIM}=module534.default||module534;
const module536=await import("../functions/src/ownerFollowManualReview536.ts");
const {
 APP536_ADMIN_RECOVERY_COMPILED_OPEN,APP536_EXPLICIT_CONFIRMATION,
 inspectOwnerFollowAdmin536,confirmOwnerFollowAdmin536,
}=module536.default||module536;
import {deliverOwnerFollower533,signReceiptForEmulator533} from "../functions/experiments/owner-follow-auth-533.mjs";
const PROJECT="demo-soridraw-owner-534",NS=PROJECT+"-default-rtdb";
const PASSWORD="emulator-only-password-536";
const KEY="local-only-operator-approval-signing-536-test-0123456789";
const SECRET="local-only-hmac-relay-536-test-0123456789";
assert.equal(process.env.APP534_ISOLATED_ONLY,"yes");
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,"127.0.0.1:9099");
assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,"127.0.0.1:9000");
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,"127.0.0.1:8080");
assert.equal(process.env.GCLOUD_PROJECT,PROJECT);
assert.equal(process.env.FIREBASE_PROJECT_ID,PROJECT);
assert.equal(process.env.FIREBASE_TOKEN,undefined);
assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS,undefined);
assert.equal(APP536_ADMIN_RECOVERY_COMPILED_OPEN,false);
const index=readFileSync("functions/src/index.ts","utf8");
assert.ok(index.includes('const requireAdminCaller ='));
assert.ok(index.includes('const assertManageableTarget ='));
assert.ok(!index.includes("inspectOwnerFollowAdmin536"));
assert.ok(!index.includes("confirmOwnerFollowAdmin536"));
const app=initializeApp({
 projectId:PROJECT,databaseURL:"https://"+NS+".firebaseio.com",
},"app536-manual-emulator");
const auth=getAuth(app),firestore=getFirestore(app),database=getDatabase(app);
const doc=uid=>firestore.collection("users").doc(uid);
const marker=uid=>database.ref("ownerFollowerSync532/"+uid);
const uid=role=>"manual536"+role;
const admin=uid("admin"),another=uid("master"),viewer=uid("viewer");
const signIn=async uid=>{
 const host=process.env.FIREBASE_AUTH_EMULATOR_HOST;
 const url="http://"+host+"/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only";
 const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
  email:uid+"@example.test",password:PASSWORD,returnSecureToken:true,
 })});
 const value=await response.json();
 assert.equal(response.status,200,"AUTH_EMULATOR_"+JSON.stringify(value));
 return value.idToken;
};
const create=async(uid,fields={})=>{
 await auth.createUser({uid,email:uid+"@example.test",password:PASSWORD});
 await doc(uid).set({favoriteCount:19,musicNote:"preserved",...fields},{merge:true});
};
const ctx=(targetUid,adminIdToken,more={})=>({
 firestore,auth,database,targetUid,adminIdToken,signingKey:KEY,...more,
});
const reject=async(p,r)=>assert.rejects(p,r);
const approve=(args,ticket,extra={})=>confirmOwnerFollowAdmin536({
 ...args,ticket,confirmation:APP536_EXPLICIT_CONFIRMATION,...extra,
});
const stamp=async(uid)=>
 Date.parse((await auth.getUser(uid)).metadata.creationTime);
const fixtureReserved=async(uid,{claimed=true}={})=>{
 await create(uid);
 const epoch=randomBytes(16).toString("hex");
 await doc(uid).set({ownerFollowLifecycle534:{
  phase:"reserved",epoch,createdAtMs:await stamp(uid),changedAtMs:Date.now(),
 }},{merge:true});
 if(claimed)await auth.setCustomUserClaims(uid,{existingClaim:"preserved",[APP534_OWNER_CLAIM]:epoch});
 return epoch;
};
const signedReceipt=(uid,epoch)=>{
 const at=Date.now();
 const rawBody=JSON.stringify({version:1,ownerUid:uid,authEpoch:epoch,
  revision:1,followerCount:5,updatedAt:at,at});
 return {auth,database,rawBody,at:String(at),
  signature:signReceiptForEmulator533(rawBody,at,SECRET),secret:SECRET};
};
const stats={};
try{
 await create(admin,{role:"admin",staffRole:"admin",adminPermissions:{userManagement:true}});
 await create(another,{role:"admin",staffRole:"master"});
 await create(viewer,{role:"free"});
 const adminToken=await signIn(admin),masterToken=await signIn(another);
 const viewerToken=await signIn(viewer);

 // Diagnostics require a genuine Firebase-verified admin ID token, the
 // same Firestore userManagement permission and protected-target policy
 // as the existing admin callable. Client claims alone never authorize.
 const UNCLAIMED=uid("unclaimed");
 await fixtureReserved(UNCLAIMED,{claimed:false});
 await reject(inspectOwnerFollowAdmin536(ctx(UNCLAIMED,viewerToken)),
  /APP536_USER_MANAGEMENT_PERMISSION_REQUIRED/);
 await reject(inspectOwnerFollowAdmin536(ctx(UNCLAIMED,"forged.id.token")),
  /auth\/|decoding|token|JWT|argument/i);
 await reject(inspectOwnerFollowAdmin536(ctx(admin,adminToken)),
  /APP536_DENIED_SELF_OR_INVALID_ADMIN/);
 await reject(inspectOwnerFollowAdmin536(ctx(another,adminToken)),
  /APP536_PROTECTED_STAFF_TARGET/);
 const unclaimedCtx=ctx(UNCLAIMED,adminToken);
 const before=(await doc(UNCLAIMED).get()).updateTime.toMillis();
 const unread=await inspectOwnerFollowAdmin536(unclaimedCtx);
 assert.equal(unread.action,"hold");
 assert.equal(unread.reason,"RESERVATION_UNCLAIMED");
 assert.equal(unread.ticket,null);
 assert.equal(unread.recoverable,false);
 assert.equal((await doc(UNCLAIMED).get()).updateTime.toMillis(),before);
 assert.equal((await marker(UNCLAIMED).get()).exists(),false);
 stats.readOnlyAndAdminPermission="PASS";

 // Exact reserved claim + no conflicting admin status gives an expiring
 // scoped approval permit, not a write. Explicit second call required.
 const CLAIMED=uid("reserved");
 const reservedEpoch=await fixtureReserved(CLAIMED);
 const claimCtx=ctx(CLAIMED,adminToken);
 const readAt=(await doc(CLAIMED).get()).updateTime.toMillis();
 const inspected=await inspectOwnerFollowAdmin536(claimCtx);
 assert.equal(inspected.action,"recover-reserved");
 assert.equal(inspected.ticket!==null,true);
 assert.equal((await doc(CLAIMED).get()).updateTime.toMillis(),readAt);
 await reject(approve(claimCtx,inspected.ticket,{confirmation:"yes"}),
  /APP536_EXPLICIT_CONFIRMATION_REQUIRED/);
 await reject(approve(ctx(CLAIMED,viewerToken),inspected.ticket),
  /APP536_USER_MANAGEMENT_PERMISSION_REQUIRED/);
 await reject(approve(ctx(CLAIMED,masterToken),inspected.ticket),
  /APP536_APPROVAL_PRINCIPAL_MISMATCH/);
 await reject(approve(ctx(UNCLAIMED,adminToken),inspected.ticket),
  /APP536_APPROVAL_PRINCIPAL_MISMATCH/);
 await reject(approve(claimCtx,inspected.ticket.slice(0,-3)+"bad"),
  /APP536_(TAMPERED|INVALID)_APPROVAL_TICKET/);
 await reject(approve(ctx(CLAIMED,adminToken,{now:()=>Date.now()+62_000}),inspected.ticket),
  /APP536_APPROVAL_EXPIRED/);
 // Role/permission can be revoked between diagnostic and confirmation.
 await doc(admin).set({adminPermissions:{userManagement:false}},{merge:true});
 await reject(approve(claimCtx,inspected.ticket),
  /APP536_USER_MANAGEMENT_PERMISSION_REQUIRED/);
 assert.equal((await doc(CLAIMED).get()).get("ownerFollowLifecycle534.phase"),"reserved");
 await doc(admin).set({adminPermissions:{userManagement:true}},{merge:true});
 const recovery=await approve(claimCtx,inspected.ticket);
 assert.equal(recovery.recovered,true);
 assert.equal(recovery.action,"recover-reserved");
 assert.equal((await doc(CLAIMED).get()).get("ownerFollowLifecycle534.phase"),"active");
 assert.equal((await auth.getUser(CLAIMED)).customClaims[APP534_OWNER_CLAIM],reservedEpoch);
 assert.equal((await auth.getUser(CLAIMED)).customClaims.existingClaim,"preserved");
 assert.equal((await doc(CLAIMED).get()).get("musicNote"),"preserved");
 await reject(approve(claimCtx,inspected.ticket),/APP536_APPROVAL_STALE_OR_HELD/);
 stats.explicitApprovalPrivilegesAndReplay="PASS";

 // A changed target document invalidates an already-issued permit.
 const STALE=uid("stale");
 await fixtureReserved(STALE);
 const staleCtx=ctx(STALE,adminToken);
 const staleTicket=(await inspectOwnerFollowAdmin536(staleCtx)).ticket;
 await doc(STALE).set({favoriteCount:20},{merge:true});
 await reject(approve(staleCtx,staleTicket),/APP536_APPROVAL_STALE_OR_HELD/);
 assert.equal((await doc(STALE).get()).get("ownerFollowLifecycle534.phase"),"reserved");
 const newTicket=(await inspectOwnerFollowAdmin536(staleCtx)).ticket;
 const newRecovery=await approve(staleCtx,newTicket);
 assert.equal(newRecovery.recovered,true);
 stats.staleSnapshotRejected="PASS";

 // Deleting: no operator permit until the original admin's Auth deletion
 // and retained-content status are BOTH evidenced; no old-marker mutation
 // is performed merely by inspecting.
 const DELETING=uid("deleting");
 await create(DELETING);
 const active=await enrollOwnerFollowEpoch534({firestore,auth,uid:DELETING});
 assert.equal((await deliverOwnerFollower533(signedReceipt(DELETING,active.authEpoch))).accepted,true);
 await prepareOwnerFollowDeletion534({firestore,auth,uid:DELETING});
 await auth.deleteUser(DELETING);
 const deletingCtx=ctx(DELETING,adminToken);
 const noCommit=await inspectOwnerFollowAdmin536(deletingCtx);
 assert.equal(noCommit.ticket,null);
 assert.equal(noCommit.reason,"ADMIN_DELETE_NOT_COMMITTED");
 assert.equal((await marker(DELETING).get()).exists(),true);
 await doc(DELETING).set({
  authDeleted:true,adminDeletionContentPolicy:"retain-user-content",
  accountStatus:"banned",
 },{merge:true});
 const approved=await inspectOwnerFollowAdmin536(deletingCtx);
 assert.equal(approved.action,"recover-deleting");
 const oldMarker=(await marker(DELETING).get()).val();
 assert.equal(oldMarker.authEpoch,active.authEpoch);
 assert.equal((await doc(DELETING).get()).get("ownerFollowLifecycle534.phase"),"deleting");
 const cleanup=await approve(deletingCtx,approved.ticket);
 assert.equal(cleanup.recovered,true);
 assert.equal((await marker(DELETING).get()).exists(),false);
 assert.equal((await doc(DELETING).get()).get("ownerFollowLifecycle534.phase"),"deleted");
 assert.equal((await doc(DELETING).get()).get("favoriteCount"),19);
 assert.equal((await doc(DELETING).get()).get("musicNote"),"preserved");
 await reject(approve(deletingCtx,approved.ticket),/APP536_APPROVAL_STALE_OR_HELD/);
 stats.deletingRequiresAdminCommitAndExplicitApproval="PASS";

 // If a new Auth user appears under an old UID, inspect alone cannot
 // authorize completion of that old generation, even after admin status.
 const EXTERNAL=uid("external");
 await create(EXTERNAL);
 const e1=await enrollOwnerFollowEpoch534({firestore,auth,uid:EXTERNAL});
 await prepareOwnerFollowDeletion534({firestore,auth,uid:EXTERNAL});
 await auth.deleteUser(EXTERNAL);
 await doc(EXTERNAL).set({authDeleted:true,adminDeletionContentPolicy:"retain-user-content"},{merge:true});
 const once=(await inspectOwnerFollowAdmin536(ctx(EXTERNAL,adminToken))).ticket;
 await auth.createUser({uid:EXTERNAL,email:EXTERNAL+"@example.test",password:PASSWORD});
 const held=await inspectOwnerFollowAdmin536(ctx(EXTERNAL,adminToken));
 assert.equal(held.ticket,null);
 assert.equal(held.reason,"AUTH_PRESENT_AFTER_DELETE");
 await reject(approve(ctx(EXTERNAL,adminToken),once),/APP536_APPROVAL_STALE_OR_HELD/);
 assert.equal((await doc(EXTERNAL).get()).get("ownerFollowLifecycle534.phase"),"deleting");
 assert.equal((await doc(EXTERNAL).get()).get("ownerFollowLifecycle534.epoch"),e1.authEpoch);
 stats.sameUidRecreatedBlocked="PASS";

 // Diagnostics never mint fresh epochs, delete songs or release held
 // reservations, and no UI/callable/Worker module can reach this candidate.
 console.log("APP536_FIREBASE_ADMIN_APPROVAL_EMULATOR=PASS");
 console.log(JSON.stringify({project:PROJECT,checks:stats,sharedWrites:0,
  liveFeaturesEnabled:false,approvalCallables:0,ciOnly:true},null,2));
}finally{await deleteApp(app);}

// APP535 read-mostly hold recovery. No callable route/import from deployed
// Functions; user-provided UID is never sufficient authority. Any future
// endpoint must enforce requireAdminCaller + userManagement and audit.
import type {Auth,UserRecord} from "firebase-admin/auth";
import type {Firestore} from "firebase-admin/firestore";
import type {Database} from "firebase-admin/database";
import {
 APP534_OWNER_CLAIM,readOwnerFollowLifecycleState534,
 enrollOwnerFollowEpoch534,finishOwnerFollowDeletion534,
} from "./ownerFollowLifecycle534";

export const APP535_HOLD_RECOVERY_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const EPOCH=/^[0-9a-f]{32}$/;
type RecoverArgs={
 firestore:Firestore;auth:Pick<Auth,"getUser"|"setCustomUserClaims">;
 database:Database;uid:string;
};
type Inspection=
 | {action:"none"|"settled";reason:string;phase?:string}
 | {action:"hold";reason:string;phase:"reserved"|"deleting"|"active";epoch:string}
 | {action:"recover-reserved"|"recover-deleting";phase:"reserved"|"deleting";epoch:string};
const verifyUid=(uid:string)=>{
 if(!UID.test(uid))throw Error("APP535_INVALID_UID");
};
const loadAuth=async(auth:RecoverArgs["auth"],uid:string):Promise<UserRecord|null>=>{
 try{return await auth.getUser(uid);}
 catch(e){
  if((e as {code?:string}|null)?.code==="auth/user-not-found")return null;
  throw e; // Network failures are never treated as deleted accounts.
 }
};
export async function inspectOwnerFollowHold535(
 {firestore,auth,uid}:Pick<RecoverArgs,"firestore"|"auth"|"uid">
):Promise<Inspection>{
 verifyUid(uid);
 const snap=await firestore.collection("users").doc(uid).get();
 const data=snap.data();
 const state=readOwnerFollowLifecycleState534(data);
 if(!state)return {action:"none",reason:"not-enrolled"};
 if(state.phase==="deleted")return {action:"settled",reason:"already-deleted",phase:state.phase};
 const user=await loadAuth(auth,uid);
 if(state.phase==="active"){
  const match=user?.customClaims?.[APP534_OWNER_CLAIM]===state.epoch&&
   Date.parse(user.metadata?.creationTime||"")===state.createdAtMs;
  return match
   ?{action:"settled",reason:"active",phase:"active"}
   :{action:"hold",reason:"ACTIVE_AUTH_DRIFT",phase:"active",epoch:state.epoch};
 }
 if(state.phase==="reserved"){
  if(data?.authDeleted===true||data?.authDeletionPendingAt||
      data?.accountStatus==="banned")
   return {action:"hold",reason:"DELETION_STATUS",phase:"reserved",epoch:state.epoch};
  if(!user)return {action:"hold",reason:"RESERVED_AUTH_MISSING",phase:"reserved",epoch:state.epoch};
  const claim=user.customClaims?.[APP534_OWNER_CLAIM];
  if(claim!==state.epoch){
   return {action:"hold",reason:claim==null?
    "RESERVATION_UNCLAIMED":"RESERVATION_CLAIM_DRIFT",
    phase:"reserved",epoch:state.epoch};
  }
  if(Date.parse(user.metadata?.creationTime||"")!==state.createdAtMs)
   return {action:"hold",reason:"RESERVATION_CREATION_DRIFT",phase:"reserved",epoch:state.epoch};
  return {action:"recover-reserved",phase:"reserved",epoch:state.epoch};
 }
 if(state.phase==="deleting"){
  // The original admin callable first commits authDeleted and removes user
  // API keys/guards, THEN the optional owner-signal cleanup may run.
  // Auth absence alone is not evidence this mandatory step succeeded.
  if(!data||data.authDeleted!==true||
    data.adminDeletionContentPolicy!=="retain-user-content")
   return {action:"hold",reason:"ADMIN_DELETE_NOT_COMMITTED",phase:"deleting",epoch:state.epoch};
  if(user)return {action:"hold",reason:"AUTH_PRESENT_AFTER_DELETE",phase:"deleting",epoch:state.epoch};
  return {action:"recover-deleting",phase:"deleting",epoch:state.epoch};
 }
 throw Error("APP535_UNRECOGNIZED_PHASE");
}
export async function recoverOwnerFollowHold535(
 {firestore,auth,database,uid}:RecoverArgs
){
 const inspected=await inspectOwnerFollowHold535({firestore,auth,uid});
 if(inspected.action==="none"||inspected.action==="settled")
  return {recovered:false,...inspected};
 if(inspected.action==="hold")
  return {recovered:false,...inspected};
 if(!EPOCH.test(inspected.epoch))throw Error("APP535_INVALID_RECOVERY_EPOCH");
 if(inspected.action==="recover-reserved"){
  // Existing APP534 helper checks Auth generation and Firestore phase twice;
  // it will HOLD rather than mint a second claim or alter user content.
  const done=await enrollOwnerFollowEpoch534({firestore,auth,uid});
  if(done.authEpoch!==inspected.epoch)throw Error("APP535_RECOVERY_CHANGED_EPOCH");
  return {recovered:true,action:inspected.action,epoch:inspected.epoch};
 }
 // Neither Auth nor other users' content are deleted by recovery. A stale
 // RTDB marker is removed only by exact epoch CAS under APP534.
 const done=await finishOwnerFollowDeletion534({
  firestore,auth,database,uid,epoch:inspected.epoch,
 });
 return {recovered:done.finished,action:inspected.action,epoch:inspected.epoch};
}

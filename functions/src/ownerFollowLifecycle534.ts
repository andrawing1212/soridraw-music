// APP534 SOURCE CANDIDATE — no live enablement, schema, endpoint, or deployment.
// Explicitly opt-in behind APP534_LIFECYCLE_DELETE_HOOK_COMPILED_OPEN=false in index.ts.
// Single-writer reservation stored in the EXISTING users/{uid} Firestore document.
// No standalone or permanently retained deleted UID/tombstone table.
import { randomBytes } from "node:crypto";
import type { Auth, UserRecord } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import type { Database } from "firebase-admin/database";

export const APP534_LIFECYCLE_DELETE_HOOK_COMPILED_OPEN = false;
export const APP534_OWNER_CLAIM = "soridrawFollowEpoch532";
export const APP534_OWNER_MARKER_ROOT = "ownerFollowerSync532";
const UID = /^[A-Za-z0-9_-]{1,128}$/;
const EPOCH = /^[0-9a-f]{32}$/;
type Phase = "reserved"|"active"|"deleting"|"deleted";
type State = {phase:Phase;epoch:string;createdAtMs:number;changedAtMs:number};
type AuthApi = Pick<Auth,"getUser"|"setCustomUserClaims">;
type EnrollArgs = {firestore:Firestore;auth:AuthApi;uid:string;newEpoch?:()=>string;clock?:()=>number};
type DeleteArgs = {firestore:Firestore;auth:AuthApi;uid:string;clock?:()=>number};
type FinishArgs = DeleteArgs & {database:Database;epoch:string};

const validateUid = (uid:string):void => {
 if(!UID.test(uid))throw Error("APP534_INVALID_UID");
};
const validEpoch = (value:unknown):value is string => typeof value==="string"&&EPOCH.test(value);
const created = (user:UserRecord):number => Date.parse(user.metadata.creationTime||"");
const stateOf = (data:Record<string,unknown>|undefined):State|null => {
 const raw=data?.ownerFollowLifecycle534;
 if(!raw||typeof raw!=="object")return null;
 const s=raw as Partial<State>;
 if(!validEpoch(s.epoch)||!["reserved","active","deleting","deleted"].includes(String(s.phase))||
   !Number.isSafeInteger(s.createdAtMs)||Number(s.createdAtMs)<=0)
  throw Error("APP534_CORRUPT_LIFECYCLE_HOLD");
 return s as State;
};
const docFor = (db:Firestore,uid:string) => db.collection("users").doc(uid);
const assertAccount = (user:UserRecord,uid:string) => {
 if(user.uid!==uid||!Number.isSafeInteger(created(user))||created(user)<=0)
  throw Error("APP534_INVALID_AUTH_RECORD");
};
const claimOf = (user:UserRecord) => user.customClaims?.[APP534_OWNER_CLAIM];

// Existing users/{uid} content remains untouched except for its one dedicated
// additive lifecycle field. A transaction picks ONE candidate epoch; competing
// claim issuers must fail closed while reservation is held, not assign another.
export async function enrollOwnerFollowEpoch534({
 firestore,auth,uid,newEpoch=()=>randomBytes(16).toString("hex"),clock=Date.now,
}:EnrollArgs){
 validateUid(uid);
 const initial=await auth.getUser(uid);
 assertAccount(initial,uid);
 const birth=created(initial);
 const ref=docFor(firestore,uid);
 const reservation=await firestore.runTransaction(async tx=>{
  const snapshot=await tx.get(ref);
  const old=stateOf(snapshot.data());
  if(old?.phase==="deleting")throw Error("APP534_DELETION_FENCE_ACTIVE");
  if(old?.phase==="active")return {kind:"existing" as const,state:old};
  if(old?.phase==="reserved")return {kind:"held" as const,state:old};
  if(claimOf(initial)!==undefined)
   throw Error("APP534_UNCONTROLLED_EXISTING_AUTH_CLAIM");
  const epoch=newEpoch();
  if(!validEpoch(epoch))throw Error("APP534_INVALID_GENERATED_EPOCH");
  if(old?.phase==="deleted"&&epoch===old.epoch)
   throw Error("APP534_REUSED_PREVIOUS_EPOCH");
  const next:State={phase:"reserved",epoch,createdAtMs:birth,changedAtMs:clock()};
  tx.set(ref,{ownerFollowLifecycle534:next},{merge:true});
  return {kind:"new" as const,state:next};
 });
 const {state,kind}=reservation;
 if(kind==="existing"){
  const current=await auth.getUser(uid);
  assertAccount(current,uid);
  if(state.createdAtMs!==created(current)||claimOf(current)!==state.epoch)
   throw Error("APP534_ACTIVE_EPOCH_MISMATCH_HOLD");
  return {uid,authEpoch:state.epoch,createdAtMs:state.createdAtMs,reused:true};
 }
 if(kind==="held"){
  const current=await auth.getUser(uid);
  assertAccount(current,uid);
  // Crash recovery ONLY if the exact reserved claim was already committed.
  // Never auto-takeover an in-flight unclaimed reservation.
  if(claimOf(current)!==state.epoch||created(current)!==state.createdAtMs)
   throw Error("APP534_RESERVATION_HELD");
 }else{
  const pre=await auth.getUser(uid);
  assertAccount(pre,uid);
  if(created(pre)!==state.createdAtMs||claimOf(pre)!==undefined)
   throw Error("APP534_AUTH_CHANGED_BEFORE_CLAIM");
  const fence=stateOf((await ref.get()).data());
  if(fence?.phase!=="reserved"||fence.epoch!==state.epoch)
   throw Error("APP534_RESERVATION_CANCELLED");
  // Firebase replaces the whole custom-claims map. Other custom-claim writers
  // must be serialized by a future approved single-authority service.
  await auth.setCustomUserClaims(uid,{...(pre.customClaims||{}),[APP534_OWNER_CLAIM]:state.epoch});
 }
 const verified=await auth.getUser(uid);
 assertAccount(verified,uid);
 if(created(verified)!==state.createdAtMs||claimOf(verified)!==state.epoch)
  throw Error("APP534_CLAIM_NOT_VERIFIED");
 await firestore.runTransaction(async tx=>{
  const snapshot=await tx.get(ref);
  const current=stateOf(snapshot.data());
  if(!current||current.epoch!==state.epoch||current.phase!=="reserved")
   throw Error("APP534_FENCE_CHANGED_AFTER_CLAIM");
  tx.set(ref,{ownerFollowLifecycle534:{...current,phase:"active",changedAtMs:clock()}},{merge:true});
 });
 return {uid,authEpoch:state.epoch,createdAtMs:state.createdAtMs,reused:false};
}

// Hook phase 1, before the existing adminDeleteUserAccount Auth delete.
// Opted-in only: historical users without a lifecycle field produce ZERO writes.
export async function prepareOwnerFollowDeletion534({firestore,uid,clock=Date.now}:DeleteArgs){
 validateUid(uid);
 const ref=docFor(firestore,uid);
 return firestore.runTransaction(async tx=>{
  const snapshot=await tx.get(ref);
  const old=stateOf(snapshot.data());
  if(!old||old.phase==="deleted")return {skipped:true as const};
  if(old.phase==="deleting")return {skipped:false as const,epoch:old.epoch,resumed:true};
  // A reserved claim may be in-flight; fence must win its final commit.
  const next:State={...old,phase:"deleting",changedAtMs:clock()};
  tx.set(ref,{ownerFollowLifecycle534:next},{merge:true});
  return {skipped:false as const,epoch:old.epoch,resumed:false};
 });
}
const isMissing=(error:unknown):boolean =>
 (error as {code?:string}|null)?.code==="auth/user-not-found";
async function getCurrentOrNull(auth:AuthApi,uid:string):Promise<UserRecord|null>{
 try{return await auth.getUser(uid);}
 catch(e){if(isMissing(e))return null;throw e;}
}
async function cleanupExactOwnerMarker534(database:Database,uid:string,epoch:string){
 const ref=database.ref(APP534_OWNER_MARKER_ROOT+"/"+uid);
 const value=(await ref.get()).val();
 if(value?.authEpoch!==epoch)return {removed:false,reason:value?"different-generation":"absent"};
 // Initial RTDB transaction callback may be NULL before server value loaded.
 // Only a matching generation may be removed after the server CAS resolves it.
 const result=await ref.transaction(current=>{
  if(current===null)return null;
  return current?.authEpoch===epoch?null:undefined;
 },undefined,false);
 return {removed:result.committed};
}
// Hook phase 2, AFTER Firebase Auth deletion succeeded and BEFORE completion.
// On failure, "deleting" remains in users/{uid}, blocking re-enrollment;
// retry can finish later without ever clearing a newly recreated generation.
export async function finishOwnerFollowDeletion534({
 firestore,auth,database,uid,epoch,clock=Date.now,
}:FinishArgs){
 validateUid(uid);
 if(!validEpoch(epoch))throw Error("APP534_INVALID_DELETE_EPOCH");
 const ref=docFor(firestore,uid);
 const before=stateOf((await ref.get()).data());
 if(!before||before.epoch!==epoch)throw Error("APP534_DELETE_FENCE_MISMATCH");
 if(before.phase==="deleted")return {finished:true,reused:true};
 if(before.phase!=="deleting")throw Error("APP534_DELETE_NOT_PREPARED");
 const authNow=await getCurrentOrNull(auth,uid);
 // A surviving old Auth incarnation means deletion is not complete.
 if(authNow?.customClaims?.[APP534_OWNER_CLAIM]===epoch)
  throw Error("APP534_OLD_AUTH_STILL_EXISTS");
 await cleanupExactOwnerMarker534(database,uid,epoch);
 await firestore.runTransaction(async tx=>{
  const snap=await tx.get(ref);
  const current=stateOf(snap.data());
  if(!current||current.phase!=="deleting"||current.epoch!==epoch)
   throw Error("APP534_DELETE_COMMIT_FENCE_CHANGED");
  tx.set(ref,{ownerFollowLifecycle534:{
   ...current,phase:"deleted",changedAtMs:clock(),
  }},{merge:true});
 });
 return {finished:true,reused:false};
}

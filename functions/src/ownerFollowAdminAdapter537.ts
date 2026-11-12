// APP537 candidate only: no import from index.ts/securedIndex, no callable
// registration, scheduled cleanup, deployed secret, or enabled flag.
// Callers must already pass through the existing authenticated Firebase
// callable and its App Check policy when this adapter is separately approved.
import {createHash} from "node:crypto";
import type {Auth} from "firebase-admin/auth";
import type {Firestore} from "firebase-admin/firestore";
import type {Database} from "firebase-admin/database";
import {
 inspectOwnerFollowAdmin536,confirmOwnerFollowAdmin536,
 verifyOwnerFollowAdminConfirmation536,APP536_EXPLICIT_CONFIRMATION,
} from "./ownerFollowManualReview536";

export const APP537_ADMIN_RECOVERY_COMPILED_OPEN=false;
export const APP537_AUDIT_COLLECTION="admin_owner_follow_recovery_audit_537";
export const APP537_TARGET_GATE_COLLECTION="admin_owner_follow_recovery_gate_537";
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const DIGEST=/^[a-f0-9]{64}$/;
type AdminAuth=Pick<Auth,"verifyIdToken"|"getUser"|"setCustomUserClaims">;
type Resources={firestore:Firestore;auth:AdminAuth;database:Database;signingKey:string;now?:()=>number};
type AppRequest={
 auth?:{uid?:string}|null;
 data?:{targetUid?:string;adminIdToken?:string;ticket?:string;confirmation?:string};
};
type State="started"|"succeeded"|"needs-review";
type Audit={
 actorUid:string;targetUid:string;action:string;status:State;
 attemptId:string;fingerprint:string;startedAtMs:number;updatedAtMs:number;
 errorCode?:string; // Only normalized non-personal program error codes.
};

const fail=(code:string):never=>{throw Error(code);};
const sha=(v:string)=>createHash("sha256").update(v).digest("hex");
const time=(deps:Resources)=>{
 const value=(deps.now||Date.now)();
 if(!Number.isSafeInteger(value)||value<=0)fail("APP537_INVALID_SERVER_CLOCK");
 return value;
};
const digestOfTicket=(ticket:string)=>{
 if(typeof ticket!=="string"||ticket.length<50||ticket.length>1000)
  fail("APP537_INVALID_TICKET");
 return sha("APP537_AUDIT_V1:"+ticket);
};
const checkRequest=async(request:AppRequest,deps:Resources)=>{
 const actor=request.auth?.uid;
 const uid=request.data?.targetUid;
 const token=request.data?.adminIdToken;
 if(typeof actor!=="string"||!UID.test(actor)||
    typeof uid!=="string"||!UID.test(uid)||typeof token!=="string")
  throw Error("APP537_AUTHENTICATED_CALLABLE_REQUIRED");
 const decoded=await deps.auth.verifyIdToken(token,true);
 if(decoded.uid!==actor)fail("APP537_CALLABLE_PRINCIPAL_MISMATCH");
 return {targetUid:uid,adminIdToken:token};
};
const context=(deps:Resources,claims:Awaited<ReturnType<typeof checkRequest>>)=>({
 firestore:deps.firestore,auth:deps.auth,database:deps.database,
 signingKey:deps.signingKey,now:deps.now,...claims,
});
const errorCode=(error:unknown)=>{
 const message=(error as {message?:unknown}|null)?.message;
 return typeof message==="string"&&/^APP53[4-7]_[A-Z0-9_]+$/.test(message)?
  message:"APP537_UNCLASSIFIED_RECOVERY_FAILURE";
};

export async function inspectOwnerFollowCallable537(request:AppRequest,deps:Resources){
 const claims=await checkRequest(request,deps);
 return inspectOwnerFollowAdmin536(context(deps,claims));
}

async function beginAudit537(deps:Resources,record:Audit){
 const ref=deps.firestore.collection(APP537_AUDIT_COLLECTION).doc(record.attemptId);
 const gate=deps.firestore.collection(APP537_TARGET_GATE_COLLECTION).doc(record.targetUid);
 await deps.firestore.runTransaction(async tx=>{
  const [old,slot]=await Promise.all([tx.get(ref),tx.get(gate)]);
  if(old.exists)fail("APP537_APPROVAL_ALREADY_RECORDED");
  // A prior uncertain or failed attempt is NEVER silently unlocked.
  if(slot.exists){
   if(slot.get("status")!=="succeeded")
    fail("APP537_PREVIOUS_ATTEMPT_REQUIRES_REVIEW");
   // A second ticket issued against the SAME pre-recovery state cannot
   // start after another operator has just committed that recovery.
   if(slot.get("fingerprint")===record.fingerprint)
    fail("APP537_SAME_STATE_ALREADY_COMPLETED");
  }
  tx.create(ref,record);
  tx.set(gate,{
   targetUid:record.targetUid,attemptId:record.attemptId,
   fingerprint:record.fingerprint,
   actorUid:record.actorUid,action:record.action,
   status:"started",updatedAtMs:record.startedAtMs,
  });
 });
}
async function finalizeAudit537(deps:Resources,record:Audit,status:"succeeded"|"needs-review",reason?:string){
 const ref=deps.firestore.collection(APP537_AUDIT_COLLECTION).doc(record.attemptId);
 const gate=deps.firestore.collection(APP537_TARGET_GATE_COLLECTION).doc(record.targetUid);
 await deps.firestore.runTransaction(async tx=>{
  const [audit,slot]=await Promise.all([tx.get(ref),tx.get(gate)]);
  if(!audit.exists||!slot.exists||audit.get("status")!=="started"||
     slot.get("attemptId")!==record.attemptId||slot.get("status")!=="started")
   fail("APP537_AUDIT_FENCE_MISMATCH");
  const at=time(deps);
  tx.update(ref,{
   status,updatedAtMs:at,...(reason?{errorCode:reason}:{}),
  });
  tx.update(gate,{status,updatedAtMs:at});
 });
}
export async function confirmOwnerFollowCallable537(request:AppRequest,deps:Resources){
 const claims=await checkRequest(request,deps);
 const ticket=request.data?.ticket;
 const confirmation=request.data?.confirmation;
 if(typeof ticket!=="string"||typeof confirmation!=="string")
  throw Error("APP537_APPROVAL_TICKET_AND_CONFIRMATION_REQUIRED");
 const ctx={...context(deps,claims),ticket,confirmation};
 // Full APP536 validation must happen before ANY audit write.
 const permit=await verifyOwnerFollowAdminConfirmation536(ctx);
 if(confirmation!==APP536_EXPLICIT_CONFIRMATION)
  fail("APP537_EXPLICIT_CONFIRMATION_REQUIRED");
 const attemptId=digestOfTicket(ticket);
 const record:Audit={
  actorUid:permit.actor,targetUid:permit.targetUid,
  action:permit.action,attemptId,fingerprint:permit.fingerprint,status:"started",
  startedAtMs:time(deps),updatedAtMs:time(deps),
 };
 // This atomic audit + per-target lock must COMMIT before changing Auth,
 // RTDB, or lifecycle state. On audit write error, no recovery is attempted.
 await beginAudit537(deps,record);
 let result:Awaited<ReturnType<typeof confirmOwnerFollowAdmin536>>;
 try{
  // Recheck privileges + exact state a second time (APP536) after lock.
  result=await confirmOwnerFollowAdmin536(ctx);
 }catch(e){
  // A failure might happen AFTER an RTDB mutation but before the Firestore
  // lifecycle commit. No retry is safe without separate operator triage.
  try{await finalizeAudit537(deps,record,"needs-review",errorCode(e));}
  catch{fail("APP537_AUDIT_OUTCOME_UNKNOWN");}
  throw Error("APP537_RECOVERY_FAILED_HELD");
 }
 try{await finalizeAudit537(deps,record,"succeeded");}
 catch{fail("APP537_AUDIT_OUTCOME_UNKNOWN");}
 return {ok:true,recovered:true,action:result.action,targetUid:record.targetUid,attemptId};
}

// READ ONLY: inspect one previous attempt for this authenticated operator
// and the current account decision. Never replays the ticket or clears lock.
export async function inspectOwnerFollowAttempt537(request:AppRequest&{
 data?:AppRequest["data"]&{attemptId?:string};
},deps:Resources){
 const claims=await checkRequest(request,deps);
 // APP536 still enforces staff permission and protected target.
 const reviewed=await inspectOwnerFollowAdmin536(context(deps,claims));
 const id=request.data?.attemptId;
 const gate=await deps.firestore.collection(APP537_TARGET_GATE_COLLECTION)
  .doc(claims.targetUid).get();
 const latestId=gate.get("attemptId");
 const attemptId=id||latestId;
 if(typeof attemptId!=="string"||!DIGEST.test(attemptId))
  return {status:"none",targetUid:claims.targetUid,reviewAction:reviewed.action};
 if(attemptId!==latestId)fail("APP537_ATTEMPT_NOT_CURRENT");
 const audit=await deps.firestore.collection(APP537_AUDIT_COLLECTION).doc(attemptId).get();
 if(!audit.exists||audit.get("targetUid")!==claims.targetUid)
  fail("APP537_AUDIT_RECORD_MISSING_HOLD");
 const actor=request.auth?.uid;
 if(audit.get("actorUid")!==actor)
  fail("APP537_AUDIT_OPERATOR_MISMATCH");
 return {attemptId,status:audit.get("status"),action:audit.get("action"),
  errorCode:audit.get("errorCode")||null,reviewAction:reviewed.action,
  reviewReason:reviewed.reason||null,targetUid:claims.targetUid};
}

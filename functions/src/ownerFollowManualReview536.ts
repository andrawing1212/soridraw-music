// APP536 SOURCE-ONLY candidate: no registered callable, UI, cron or live import.
// Operator must provide a VERIFIED Firebase ID token at both stages. A fresh,
// explicit signed approval is bound to exactly one unchanged read-only review.
// The token is NOT an authorization substitute: recheck privileges on confirm.
import {createHash,createHmac,randomBytes,timingSafeEqual} from "node:crypto";
import type {Auth} from "firebase-admin/auth";
import type {Firestore} from "firebase-admin/firestore";
import type {Database} from "firebase-admin/database";
import {readOwnerFollowLifecycleState534} from "./ownerFollowLifecycle534";
import {inspectOwnerFollowHold535,recoverOwnerFollowHold535} from "./ownerFollowHoldRecovery535";

export const APP536_ADMIN_RECOVERY_COMPILED_OPEN=false;
export const APP536_EXPLICIT_CONFIRMATION="CONFIRM_OWNER_FOLLOW_HOLD_RECOVERY_536";
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const HMAC=/^[0-9a-f]{64}$/;
const REVIEW_MS=60_000;
type AdminAuth=Pick<Auth,"verifyIdToken"|"getUser"|"setCustomUserClaims">;
type Context={firestore:Firestore;auth:AdminAuth;database:Database;
 targetUid:string;adminIdToken:string;signingKey:string;
 now?:()=>number};
type Action="recover-reserved"|"recover-deleting";
type Decision={action:string;reason?:string;phase?:string;epoch?:string};
type Permit={v:1;actor:string;target:string;action:Action;fingerprint:string;
 issued:number;expires:number;nonce:string};

const sha=(input:string)=>createHash("sha256").update(input).digest("hex");
const assertSecret=(key:string)=>{
 if(typeof key!=="string"||key.length<32)throw Error("APP536_MISSING_SERVER_SIGNING_KEY");
};
const sameVersion=(a:any,b:any)=>String(a?.updateTime?.toMillis?.()||"")===
 String(b?.updateTime?.toMillis?.()||"");
const actionOf=(decision:Decision):decision is Decision&{action:Action;epoch:string} =>
 (decision.action==="recover-reserved"||decision.action==="recover-deleting")&&
 /^[0-9a-f]{32}$/.test(decision.epoch||"");
async function authorize536({firestore,auth,adminIdToken,targetUid}:Context){
 if(!UID.test(targetUid)||!adminIdToken||typeof adminIdToken!=="string")
  throw Error("APP536_INVALID_TARGET_OR_IDENTITY");
 // Firebase Admin validates actual token and revocation. A caller-supplied UID,
 // admin boolean, role, or unverified decoded claim is NEVER authority.
 const decoded=await auth.verifyIdToken(adminIdToken,true);
 const actor=decoded.uid;
 if(!UID.test(actor)||actor===targetUid)throw Error("APP536_DENIED_SELF_OR_INVALID_ADMIN");
 const actorRecord=await auth.getUser(actor);
 if(actorRecord.disabled)throw Error("APP536_DISABLED_ADMIN");
 const actorSnap=await firestore.collection("users").doc(actor).get();
 const admin=actorSnap.data()||{};
 const legacyAdmin=admin.role==="admin"&&!admin.staffRole;
 const role=admin.staffRole==="master"?"master":
  admin.staffRole==="admin"||legacyAdmin?"admin":null;
 if(!role||(!legacyAdmin&&role!=="master"&&
    admin.adminPermissions?.userManagement!==true))
  throw Error("APP536_USER_MANAGEMENT_PERMISSION_REQUIRED");
 const targetSnap=await firestore.collection("users").doc(targetUid).get();
 const target=targetSnap.data()||{};
 if(target.staffRole==="master"||target.staffRole==="admin"||
    (target.role==="admin"&&!target.staffRole))
  throw Error("APP536_PROTECTED_STAFF_TARGET");
 return {actor};
}
async function observe536(ctx:Context){
 const ref=ctx.firestore.collection("users").doc(ctx.targetUid);
 const before=await ref.get();
 const state=readOwnerFollowLifecycleState534(before.data());
 const decision=await inspectOwnerFollowHold535({
  firestore:ctx.firestore,auth:ctx.auth,uid:ctx.targetUid,
 });
 const after=await ref.get();
 if(!sameVersion(before,after))
  throw Error("APP536_CONCURRENT_TARGET_MUTATION");
 const v=after.updateTime?.toMillis?.()||0;
 const fingerprint=sha(JSON.stringify({
  target:ctx.targetUid,updateAt:v,
  phase:state?.phase||null,epoch:state?.epoch||null,
  createdAt:state?.createdAtMs||0,changedAt:state?.changedAtMs||0,
  decision:decision.action,reason:"reason" in decision?decision.reason:null,
 }));
 return {decision,fingerprint,phase:state?.phase||"none"};
}
const sign=(permit:Permit,key:string)=>{
 const encoded=Buffer.from(JSON.stringify(permit)).toString("base64url");
 const sig=createHmac("sha256",key).update("APP536."+encoded).digest("hex");
 return "v1."+encoded+"."+sig;
};
const decode=(ticket:string,key:string):Permit=>{
 if(typeof ticket!=="string"||ticket.length>1000)
  throw Error("APP536_INVALID_APPROVAL_TICKET");
 const segments=ticket.split(".");
 if(segments.length!==3||segments[0]!=="v1"||!HMAC.test(segments[2]))
  throw Error("APP536_INVALID_APPROVAL_TICKET");
 const expected=createHmac("sha256",key).update("APP536."+segments[1]).digest();
 const received=Buffer.from(segments[2],"hex");
 if(!timingSafeEqual(expected,received))
  throw Error("APP536_TAMPERED_APPROVAL_TICKET");
 let payload:Permit;
 try{payload=JSON.parse(Buffer.from(segments[1],"base64url").toString("utf8"));}
 catch{throw Error("APP536_INVALID_APPROVAL_PAYLOAD");}
 if(!payload||payload.v!==1||!UID.test(payload.actor||"")||
    !UID.test(payload.target||"")||!HMAC.test(payload.fingerprint||"")||
    !["recover-reserved","recover-deleting"].includes(payload.action)||
    !Number.isSafeInteger(payload.issued)||!Number.isSafeInteger(payload.expires)||
    payload.expires-payload.issued!==REVIEW_MS||
    !/^[0-9a-f]{32}$/.test(payload.nonce||""))
  throw Error("APP536_INVALID_APPROVAL_PAYLOAD");
 return payload;
};

export async function inspectOwnerFollowAdmin536(ctx:Context){
 assertSecret(ctx.signingKey);
 const {actor}=await authorize536(ctx);
 const observed=await observe536(ctx);
 const recoverable=actionOf(observed.decision);
 const result={
  targetUid:ctx.targetUid,phase:observed.phase,
  action:observed.decision.action,
  reason:"reason" in observed.decision?observed.decision.reason||null:null,
  recoverable,
  // No raw epoch, metadata, personal content, admin token, HMAC key, or
  // user list in operator-facing diagnostics.
  ticket:null as string|null,
 };
 if(!recoverable)return result;
 const now=(ctx.now||Date.now)();
 if(!Number.isSafeInteger(now)||now<=0)throw Error("APP536_INVALID_CLOCK");
 const permit:Permit={
  v:1,actor,target:ctx.targetUid,action:observed.decision.action as Action,
  fingerprint:observed.fingerprint,issued:now,expires:now+REVIEW_MS,
  nonce:randomBytes(16).toString("hex"),
 };
 return {...result,ticket:sign(permit,ctx.signingKey)};
}
type ConfirmContext=Context&{ticket:string;confirmation:string};
// APP537 uses this *read-only* verifier before reserving a durable private
// audit slot. The original confirmation calls it AGAIN after slot reservation.
// Never use an approval-ticket nonce as authorization without these checks.
export async function verifyOwnerFollowAdminConfirmation536(ctx:ConfirmContext){
 assertSecret(ctx.signingKey);
 if(ctx.confirmation!==APP536_EXPLICIT_CONFIRMATION)
  throw Error("APP536_EXPLICIT_CONFIRMATION_REQUIRED");
 const permit=decode(ctx.ticket,ctx.signingKey);
 const now=(ctx.now||Date.now)();
 if(!Number.isSafeInteger(now)||now<permit.issued||now>=permit.expires)
  throw Error("APP536_APPROVAL_EXPIRED");
 const {actor}=await authorize536(ctx);
 if(actor!==permit.actor||ctx.targetUid!==permit.target)
  throw Error("APP536_APPROVAL_PRINCIPAL_MISMATCH");
 const current=await observe536(ctx);
 if(!actionOf(current.decision)||current.decision.action!==permit.action||
    current.fingerprint!==permit.fingerprint)
  throw Error("APP536_APPROVAL_STALE_OR_HELD");
 return {actor,targetUid:ctx.targetUid,action:permit.action,fingerprint:permit.fingerprint};
}
export async function confirmOwnerFollowAdmin536(ctx:ConfirmContext){
 const permitted=await verifyOwnerFollowAdminConfirmation536(ctx);
 // APP535 inspects again and APP534 uses a generation/phase transaction.
 // Confirmation is ONLY a gate; no forced release or deletion path exists.
 const result=await recoverOwnerFollowHold535({
  firestore:ctx.firestore,auth:ctx.auth,database:ctx.database,uid:ctx.targetUid,
 });
 if(!result.recovered||result.action!==permitted.action)
  throw Error("APP536_RECOVERY_REFUSED_OR_RACED");
 return {recovered:true,action:result.action,targetUid:ctx.targetUid};
}

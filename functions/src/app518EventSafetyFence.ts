/**
 * app518 dormant, server-only Firestore event safety fence. No live writes
 * until the separate 3-environment release switch is explicitly enabled.
 * No whole-user scans or browser reads. Every key is an irreversible digest;
 * the two private collections are client-denied by the default Rules.
 */
import {createHash} from "node:crypto";
import * as admin from "firebase-admin";

const valid=(s:string,max=240)=>typeof s==="string"&&s.length>0
  &&s.length<=max&&s!=="."&&s!==".."&&!/[\\/]/.test(s);
const digest=(parts:string[])=>createHash("sha256")
  .update(JSON.stringify(parts)).digest("hex");
export const APP518_FIREBASE_RETRY_LIMIT=8;
export const APP518_FIREBASE_RETRY_WINDOW_MS=60*60*1000;
const eventRef=(db:admin.firestore.Firestore,id:string,eventId:string)=>
  db.collection("server_music_note_event_failures_518")
    .doc(digest(["event",id,eventId]));
const ownerRef=(db:admin.firestore.Firestore,id:string)=>
  db.collection("server_music_note_owner_quarantine_518")
    .doc(digest(["owner",id]));
const safeCode=(code:string)=>
  /^[A-Z][A-Z0-9_]{0,79}$/.test(code)?code:"APP518_UNKNOWN_FAILURE";

export const recordApp518OwnerCollision=async({
 db,documentId,beforeUid,afterUid,eventId,nowMs,
}:{db:admin.firestore.Firestore;documentId:string;beforeUid:string;
 afterUid:string;eventId:string;nowMs:number}):Promise<string>=>{
 if(!valid(documentId)||!valid(beforeUid,128)||!valid(afterUid,128)
   ||beforeUid===afterUid||!valid(eventId,512)
   ||!Number.isSafeInteger(nowMs)||nowMs<0)return "DENY_OWNER_FENCE_ARGUMENTS";
 const ref=ownerRef(db,documentId);
 return db.runTransaction(async tx=>{
  const old=await tx.get(ref);
  if(old.exists)return "HOLD_OWNER_QUARANTINED";
  // No client song fields stored, no automatic owner selection or deletion.
  tx.create(ref,{status:"QUARANTINED",beforeUid,afterUid,
    firstEventId:eventId,createdAtMs:nowMs});
  return "OWNER_QUARANTINE_CREATED";
 });
};

/** An existing record is ALWAYS a fence, even if its data is corrupt. */
export const readApp518OwnerQuarantine=async(
 db:admin.firestore.Firestore,documentId:string,
):Promise<boolean>=>{
 if(!valid(documentId))return true;
 const hit=await ownerRef(db,documentId).get();
 return hit.exists;
};

export const readApp518EventGuard=async({
 db,documentId,eventId,nowMs,eventTimeMs,
}:{db:admin.firestore.Firestore;documentId:string;eventId:string;
 nowMs:number;eventTimeMs:number}):Promise<string>=>{
 if(!valid(documentId)||!valid(eventId,512)
   ||!Number.isSafeInteger(nowMs)||!Number.isSafeInteger(eventTimeMs)
   ||eventTimeMs<=0)return "HOLD_BAD_EVENT_ID_OR_TIME";
 const [owner,event]=await Promise.all([
  ownerRef(db,documentId).get(),eventRef(db,documentId,eventId).get(),
 ]);
 if(owner.exists)return "HOLD_OWNER_QUARANTINED";
 if(event.exists){
  // Unknown/corrupted status MUST fail closed, never re-enable delivery.
  const data=event.data();
  if(data?.status!=="RETRY_PENDING")return "HOLD_EVENT_ALREADY_TERMINAL";
  if(!Number.isInteger(data.attempts)
    ||data.attempts>=APP518_FIREBASE_RETRY_LIMIT)
    return "HOLD_EVENT_RETRY_LIMIT";
 }
 if(nowMs<eventTimeMs-300000
   ||nowMs-eventTimeMs>=APP518_FIREBASE_RETRY_WINDOW_MS)
  return "HOLD_EVENT_RETRY_WINDOW";
 return "EVENT_DELIVERY_ALLOWED";
};

export const recordApp518EventFailure=async({
 db,documentId,eventId,nowMs,eventTimeMs,code,terminal,
}:{db:admin.firestore.Firestore;documentId:string;eventId:string;
 nowMs:number;eventTimeMs:number;code:string;terminal:boolean}):
 Promise<{code:string;attempts:number;retry:boolean}>=>{
 if(!valid(documentId)||!valid(eventId,512)
   ||!Number.isSafeInteger(nowMs)||nowMs<0
   ||!Number.isSafeInteger(eventTimeMs)||eventTimeMs<=0)
  return {code:"HOLD_BAD_EVENT_ID_OR_TIME",attempts:0,retry:false};
 const ref=eventRef(db,documentId,eventId);
 return db.runTransaction(async tx=>{
  const previous=await tx.get(ref);
  const was=previous.data();
  if(previous.exists&&was?.status!=="RETRY_PENDING")
   return {code:"HOLD_EVENT_ALREADY_TERMINAL",
    attempts:Number(was?.attempts)||0,retry:false};
  const attempts=(previous.exists?Number(was?.attempts):0)+1;
  if(!Number.isSafeInteger(attempts)||attempts>APP518_FIREBASE_RETRY_LIMIT)
   return {code:"HOLD_EVENT_RETRY_LIMIT",attempts:0,retry:false};
  const expired=nowMs<eventTimeMs-300000
    ||nowMs-eventTimeMs>=APP518_FIREBASE_RETRY_WINDOW_MS;
  const retry=!terminal&&!expired&&attempts<APP518_FIREBASE_RETRY_LIMIT;
  const result=retry?"RETRY_PENDING":"HOLD_TERMINAL";
  const record={status:result,attempts,
    code:expired?"APP518_RETRY_WINDOW_EXPIRED":safeCode(code),
    firstEventTimeMs:eventTimeMs,lastAttemptMs:nowMs};
  if(previous.exists)tx.update(ref,record);
  else tx.create(ref,record);
  return {code:result,attempts,retry};
 });
};

/** Resolution after an earlier recorded transient failure, never on fresh success. */
export const resolveApp518EventFailure=async({
 db,documentId,eventId,nowMs,
}:{db:admin.firestore.Firestore;documentId:string;eventId:string;nowMs:number})
 :Promise<string>=>{
 if(!valid(documentId)||!valid(eventId,512)
   ||!Number.isSafeInteger(nowMs)||nowMs<0)return "HOLD_INVALID_RESOLUTION";
 const ref=eventRef(db,documentId,eventId);
 return db.runTransaction(async tx=>{
  const previous=await tx.get(ref);
  if(!previous.exists)return "NO_PREVIOUS_FAILURE";
  if(previous.data()?.status!=="RETRY_PENDING")
   return "HOLD_EVENT_ALREADY_TERMINAL";
  tx.update(ref,{status:"RESOLVED",lastAttemptMs:nowMs});
  return "RESOLVED";
 });
};

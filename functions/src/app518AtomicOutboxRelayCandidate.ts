/**
 * app518 dormant relay candidate. No exported Function or Cloudflare route.
 * Exact source only: never scan favorites, owners or outbox collections.
 *
 * The atomic source outbox updateTime is the server commit version, including
 * delete. It is NOT the time a delayed trigger or HTTP retry reached us.
 * ENQUEUED is never an R2 ACK; the immutable source outbox stays persisted.
 */
import {createHash} from "node:crypto";
import * as admin from "firebase-admin";
import {dispatchApp518VerifiedEnqueue} from "./app518ServerTransport";
import type {App518Source} from "./app518CanonicalSourceProvider";

type Db=admin.firestore.Firestore;
const valid=(s:string,max=240)=>typeof s==="string"&&s.length>0
 &&s.length<=max&&s!=="."&&s!==".."&&!/[\\/]/.test(s);
const digest=(parts:string[])=>createHash("sha256")
 .update(JSON.stringify(parts)).digest("hex");
const timestamp=(v:admin.firestore.Timestamp|undefined):string|null=>{
 if(!v||!Number.isSafeInteger(v.seconds)||!Number.isInteger(v.nanoseconds)
  ||v.nanoseconds<0||v.nanoseconds>=1e9)return null;
 const date=new Date(v.seconds*1000);
 if(!Number.isFinite(date.getTime()))return null;
 return date.toISOString().slice(0,19)+"."+
  String(v.nanoseconds).padStart(9,"0")+"Z";
};
const removed=(row:Record<string,unknown>)=>row.favoriteRemoved===true
 ||row.saved===false||row.hidden===true||row.favoriteHidden===true
 ||Boolean(row.deletedAt)||Boolean(row.trashedAt);
type ReadResult={code:string;source?:App518Source};
export const readExactAtomicOutboxSource518=async({
 db,uid,documentId,mutationId,
}:{db:Db;uid:string;documentId:string;mutationId:string}):Promise<ReadResult>=>{
 if(!valid(uid,128)||!valid(documentId)||!valid(mutationId,128))
  return {code:"DENY_EXACT_SOURCE_INPUT"};
 const ownerRef=db.collection("server_music_note_owners_518")
  .doc(digest(["owner",documentId]));
 const outboxRef=db.collection("server_music_note_source_outbox_518")
  .doc(digest(["mutation",uid,documentId,mutationId]));
 const favoriteRef=db.collection("favorites").doc(documentId);
 // Read latest as a consistent Firestore snapshot, not separate GETs.
 // Transaction retries if any of these documents changes concurrently.
 return db.runTransaction(async transaction=>{
  const [ownerSnap,outboxSnap,favoriteSnap]=await Promise.all([
   transaction.get(ownerRef),transaction.get(outboxRef),transaction.get(favoriteRef),
  ]);
  const owner=ownerSnap.data(),outbox=outboxSnap.data(),favorite=favoriteSnap.data();
  if(!ownerSnap.exists||owner?.uid!==uid||owner?.documentId!==documentId
    ||owner?.immutable!==true)
   return {code:"HOLD_FIRST_OWNER_UNVERIFIED"};
  if(owner.latestMutationId!==mutationId)
   return {code:"STALE_ATOMIC_OUTBOX_NOT_CURRENT"};
  if(!outboxSnap.exists||outbox?.uid!==uid||outbox?.documentId!==documentId
    ||outbox?.mutationId!==mutationId
    ||outbox?.ownerDocumentId!==ownerRef.id
    ||outbox?.deliveryState!=="PENDING"
    ||!["saved","removed"].includes(String(outbox?.desiredState)))
   return {code:"HOLD_ATOMIC_OUTBOX_UNVERIFIED"};
  const version=timestamp(outboxSnap.updateTime);
  if(!version)return {code:"HOLD_ATOMIC_COMMIT_VERSION_MISSING"};
  const state=outbox.desiredState as "saved"|"removed";
  if(favoriteSnap.exists){
   if(!favorite||favorite.uid!==uid||favorite.app518SourceMutationId!==mutationId
     ||favorite.id!==documentId
     ||(removed(favorite)!==(state==="removed")))
    return {code:"HOLD_ATOMIC_FAVORITE_MISMATCH"};
  }else if(outbox.intent!=="delete"||state!=="removed"
    ||owner.latestIntent!=="delete")
   return {code:"HOLD_ATOMIC_DELETE_UNVERIFIED"};
  const source:App518Source={
   uid,documentId,verifiedByServer:true,origin:"server-exact-read",
   state,updateTime:version,
   ...(state==="saved"?{item:{...favorite,id:documentId,uid}}:{}),
  };
  return {code:"SOURCE_VERIFIED",source};
 });
};

export const relayExactAtomicOutbox518=async({
 db,uid,documentId,mutationId,secret,workerUrl,expectedHostname,
 nowMs,post,releaseApproved=false,
}:{
 db:Db;uid:string;documentId:string;mutationId:string;
 secret:string;workerUrl:string;expectedHostname:string;nowMs:number;
 post?:typeof fetch;releaseApproved?:boolean;
}):Promise<{code:string}>=>{
 if(releaseApproved!==true)return {code:"HOLD_ATOMIC_RELAY_UNWIRED"};
 const exact=await readExactAtomicOutboxSource518({db,uid,documentId,mutationId});
 if(exact.code!=="SOURCE_VERIFIED"||!exact.source)return {code:exact.code};
 const result=await dispatchApp518VerifiedEnqueue({
  source:exact.source,secret,workerUrl,expectedHostname,nowMs,post,
 });
 // Safe restart/retry: do not mark the Firestore outbox ACKed on enqueue.
 // Cloudflare D1/R2 final ACK is a distinct, independently proven transition.
 return {code:result.code==="ENQUEUED"?"ENQUEUED_NOT_R2_ACK":
  result.code==="STALE_OR_DUPLICATE"?"DUPLICATE_NOT_R2_ACK":
  result.code==="STALE_SIGNED_EVENT_NO_WRITE"?"STALE_RELAY_NO_WRITE":
  result.code};
};

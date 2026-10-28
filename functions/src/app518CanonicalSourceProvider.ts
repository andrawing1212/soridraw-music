/**
 * app518 UNWIRED Firebase Admin provider. This file is intentionally NOT
 * imported/exported by functions/src/index.ts or securedIndex.ts.
 * No trigger, HTTP handler, deploy, secret, schema or user data is created.
 *
 * A Firestore hard-delete has no after.updateTime. Before.updateTime is NOT
 * the delete commit time. An authenticated server event may register a
 * private receipt in one transaction, only while the exact favorite is
 * absent. The receipt's real Firestore updateTime supplies ordering.
 */
import * as admin from "firebase-admin";

type Outcome = {code:string; source?:App518Source; receiptWrite?:number};
export type App518Source = {
  uid:string; documentId:string; verifiedByServer:true;
  origin:"server-exact-read"; state:"saved"|"removed";
  updateTime:string; item?:Record<string,unknown>;
};
const valid=(s:string,max=240):boolean=>
  s.length>0&&s.length<=max&&!/[\\/]/.test(s)&&s!=="."&&s!=="..";
const fromTimestamp=(ts:admin.firestore.Timestamp|undefined):string|null=>{
  if(!ts||!Number.isSafeInteger(ts.seconds)
    ||!Number.isSafeInteger(ts.nanoseconds)||ts.nanoseconds<0
    ||ts.nanoseconds>=1_000_000_000)return null;
  const date=new Date(ts.seconds*1000);
  if(!Number.isFinite(date.getTime()))return null;
  return date.toISOString().slice(0,19)+"."+
    String(ts.nanoseconds).padStart(9,"0")+"Z";
};
const receiptId=(uid:string,documentId:string):string=>
  Buffer.from(JSON.stringify([uid,documentId])).toString("base64url");
const refs=(db:admin.firestore.Firestore,uid:string,id:string)=>({
  favorite:db.collection("favorites").doc(id),
  // New top-level collection is server-only; live Rules must explicitly
  // deny client writes before this is activated. NO Rules changed here.
  receipt:db.collection("server_music_note_delete_receipts_518")
    .doc(receiptId(uid,id)),
});
const sourceFromFavorite=(uid:string,id:string,snap:admin.firestore.DocumentSnapshot):Outcome=>{
  const data=snap.data();
  if(!snap.exists||!data||data.uid!==uid)return {code:"DENY_OWNER_OR_ABSENT"};
  const updateTime=fromTimestamp(snap.updateTime);
  if(!updateTime)return {code:"DENY_NO_SERVER_UPDATE_TIME"};
  const removed=data.favoriteRemoved===true||data.saved===false;
  const item=removed?undefined:{...data,id,uid};
  return {code:"SOURCE_VERIFIED",source:{
    uid,documentId:id,verifiedByServer:true,origin:"server-exact-read",
    state:removed?"removed":"saved",updateTime,...(item?{item}:{}),
  }};
};

/** Exact 1-song read. Never use on page enter or catalog scan. */
export const readExactApp518Source=async(
  db:admin.firestore.Firestore,uid:string,id:string,
):Promise<Outcome>=>{
  if(!valid(uid,128)||!valid(id))return {code:"DENY_ARGUMENTS"};
  const {favorite,receipt}=refs(db,uid,id);
  const latest=await favorite.get(); // exact Firestore R1
  if(latest.exists)return sourceFromFavorite(uid,id,latest);
  const deleted=await receipt.get(); // only when favorite absent
  if(!deleted.exists)return {code:"HOLD_NO_HARD_DELETE_RECEIPT"};
  const data=deleted.data();
  if(data?.uid!==uid||data.documentId!==id||typeof data.deleteEventId!=="string"
    ||!valid(data.deleteEventId))return {code:"DENY_INVALID_RECEIPT"};
  const version=fromTimestamp(deleted.updateTime);
  if(!version)return {code:"DENY_RECEIPT_VERSION"};
  // A concurrent save can happen between reads. Consumers MUST reread this
  // source again immediately before publishing a guarded R2 CAS.
  return {code:"SOURCE_VERIFIED",source:{uid,documentId:id,
    verifiedByServer:true,origin:"server-exact-read",
    state:"removed",updateTime:version}};
};

/**
 * Called ONLY after the server's Firestore onDelete event is verified
 * (eventId, before owner UID, and actual absent after image). The pending
 * trigger/export is not registered here.
 */
export const recordHardDeleteApp518=async(args:{
  db:admin.firestore.Firestore; uid:string; documentId:string;
  deleteEventId:string; beforeOwnerUid:string;
  verifiedServerDeleteEvent:boolean;
}):Promise<Outcome>=>{
  const {db,uid,documentId:id,deleteEventId,beforeOwnerUid,
    verifiedServerDeleteEvent}=args;
  if(!valid(uid,128)||!valid(id)||!valid(deleteEventId)
    ||beforeOwnerUid!==uid||verifiedServerDeleteEvent!==true)
    return {code:"DENY_UNVERIFIED_DELETE_EVENT"};
  const {favorite,receipt}=refs(db,uid,id);
  const result=await db.runTransaction(async transaction=>{
    const fav=await transaction.get(favorite);
    const existing=await transaction.get(receipt); // all reads before writes
    if(fav.exists)return "ACTIVE_FAVORITE";
    if(existing.exists){
      const data=existing.data();
      if(data?.uid!==uid||data.documentId!==id)
        return "DENY_RECEIPT_OWNER_MISMATCH";
      if(data.deleteEventId===deleteEventId)
        return "ALREADY_RECEIPTED";
      // Never overwrite a receipt with an unordered, delayed old event.
      // A second legitimate delete after a re-save needs a separately
      // designed server-ordered event epoch: HOLD rather than wrong delete.
      return "HOLD_OTHER_EVENT_RECEIPT";
    }
    transaction.create(receipt,{
      uid,documentId:id,deleteEventId,
      serverWrittenAt:admin.firestore.FieldValue.serverTimestamp(),
    });
    return "RECEIPT_CREATED";
  });
  if(result==="ACTIVE_FAVORITE")return {code:"SKIP_NEWER_SAVE_PRESENT"};
  if(result!=="ALREADY_RECEIPTED"&&result!=="RECEIPT_CREATED")
    return {code:result};
  const latest=await readExactApp518Source(db,uid,id);
  if(latest.code!=="SOURCE_VERIFIED"||latest.source?.state!=="removed")
    return {code:"HOLD_AFTER_RECEIPT_SOURCE_CHANGED"};
  return {code:"VERIFIED_DELETE_RECEIPT",source:latest.source,
    receiptWrite:result==="RECEIPT_CREATED"?1:0};
};

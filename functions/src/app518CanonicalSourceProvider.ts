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
// A trusted BEFORE snapshot version identifies the delete generation,
 // NOT the hard-delete commit time. The private receipt updateTime is
 // exclusively the new server-side commit version.
const exactVersionNs=(value:string):string|null=>{
  const match=/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?Z$/.exec(value);
  if(!match)return null;
  const ms=Date.parse(match[1]+"Z");
  if(!Number.isSafeInteger(ms)||ms<=0||
    new Date(ms).toISOString().slice(0,19)!==match[1])return null;
  return (BigInt(ms)*BigInt(1000000)+
    BigInt((match[2]||"").padEnd(9,"0")||"0")).toString().padStart(21,"0");
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
  // Match the existing Media Worker Music Note projection exclusion exactly.
  // A hidden/trashed item is a canonical removal, not an invalid saved item.
  const removed=data.favoriteRemoved===true||data.saved===false
    ||data.hidden===true||data.favoriteHidden===true
    ||Boolean(data.deletedAt)||Boolean(data.trashedAt);
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
    ||!valid(data.deleteEventId)||
    !/^\d{21}$/.test(data.beforeSourceVersionNs||""))
    return {code:"DENY_INVALID_RECEIPT"};
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
  // Server before-snapshot updateTime: only a monotonic generation marker.
  beforeUpdateTime:string; verifiedServerDeleteEvent:boolean;
}):Promise<Outcome>=>{
  const {db,uid,documentId:id,deleteEventId,beforeOwnerUid,beforeUpdateTime,
    verifiedServerDeleteEvent}=args;
  const beforeSourceVersionNs=exactVersionNs(beforeUpdateTime);
  if(!valid(uid,128)||!valid(id)||!valid(deleteEventId)
    ||!beforeSourceVersionNs||beforeOwnerUid!==uid||verifiedServerDeleteEvent!==true)
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
      const previous=typeof data.beforeSourceVersionNs==="string"&&
        /^\d{21}$/.test(data.beforeSourceVersionNs)
        ?data.beforeSourceVersionNs:null;
      if(!previous)return "HOLD_UNVERSIONED_RECEIPT";
      if(previous>beforeSourceVersionNs)return "STALE_OLDER_DELETE_EVENT";
      if(previous===beforeSourceVersionNs)
        return data.deleteEventId===deleteEventId
          ?"ALREADY_RECEIPTED":"HOLD_CONFLICTING_SAME_DELETE_GENERATION";
      // A later verified document generation has been hard-deleted.
      // Upgrade the private receipt in the same transaction. The receipt
      // itself gets a fresh server commit updateTime; the old event cannot
      // overwrite this newer generation on delayed delivery.
      transaction.update(receipt,{
        beforeSourceVersionNs,deleteEventId,
        serverWrittenAt:admin.firestore.FieldValue.serverTimestamp(),
      });
      return "RECEIPT_ADVANCED";
    }
    transaction.create(receipt,{
      uid,documentId:id,deleteEventId,beforeSourceVersionNs,
      serverWrittenAt:admin.firestore.FieldValue.serverTimestamp(),
    });
    return "RECEIPT_CREATED";
  });
  if(result==="ACTIVE_FAVORITE")return {code:"SKIP_NEWER_SAVE_PRESENT"};
  if(result!=="ALREADY_RECEIPTED"&&result!=="RECEIPT_CREATED"
    &&result!=="RECEIPT_ADVANCED")
    return {code:result};
  const latest=await readExactApp518Source(db,uid,id);
  if(latest.code!=="SOURCE_VERIFIED"||latest.source?.state!=="removed")
    return {code:"HOLD_AFTER_RECEIPT_SOURCE_CHANGED"};
  // No stale result should claim completion if another newer delete event
  // already advanced the receipt while this caller was doing its read.
  return {code:"VERIFIED_DELETE_RECEIPT",source:latest.source,
    receiptWrite:result==="RECEIPT_CREATED"||result==="RECEIPT_ADVANCED"?1:0};
};

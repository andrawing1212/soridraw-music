/**
 * app518 staged Firebase -> Worker connector. Exports remain runtime OFF
 * without an explicitly approved release switch + server-held secret.
 * Never query all favorites; event images only decide whether to re-read.
 */
import * as admin from "firebase-admin";
import {
  readExactApp518Source,recordHardDeleteApp518,type App518Source,
} from "./app518CanonicalSourceProvider";
import {dispatchApp518VerifiedEnqueue} from "./app518ServerTransport";

// Keep this whitelist byte-for-byte aligned with the existing Worker
// MUSIC_NOTE_CATALOG_FIELDS; CI checks equality before any release.
export const APP518_MUSIC_NOTE_FIELDS = [
  "uid",
  "soridrawSongId",
  "favoriteKey",
  "title",
  "koreanTitle",
  "englishTitle",
  "genre",
  "appliedKeywords",
  "searchTokens",
  "isLocked",
  "liked",
  "isLiked",
  "personalLiked",
  "favoriteLiked",
  "isFavorite",
  "isPublic",
  "exploreTrackId",
  "explorePublicationId",
  "hidden",
  "favoriteHidden",
  "favoriteRemoved",
  "favoriteRemovedAt",
  "saved",
  "deletedAt",
  "trashedAt",
  "color",
  "favoriteColor",
  "noteColor",
  "favoriteColorTag",
  "colorTag",
  "folderId",
  "folderIds",
  "musicNoteFolderIds",
  "noteFolderId",
  "myNoteFolderId",
  "favoriteFolderId",
  "sharedNoteFolderId",
  "sharedNoteFolder",
  "noteSharedFolderId",
  "sharedNoteShareId",
  "isSharedMusicNote",
  "sharedReadOnly",
  "sourceType",
  "originalFavoriteId",
  "createdAtMs",
  "createdAt",
  "updatedAtMs",
  "updatedAt",
  "sunoLinks",
  "sunoShareLinks",
  "mainSunoIndex",
  "sunoShareUrl",
  "sunoUrl",
  "sunoSongUrl",
  "sunoTitle",
  "sunoCoverUrl",
  "sunoImageUrl",
  "sunoArtworkUrl",
  "sunoDurationSeconds",
  "sunoDurationText",
  "sunoShareUrlUpdatedAt",
  "sunoCoverFetchedAt",
  "audioUrl",
  "audio_url",
  "streamAudioUrl",
  "stream_audio_url",
  "sourceAudioUrl",
  "sourceStreamAudioUrl",
  "imageUrl",
  "image_url",
  "coverUrl",
  "thumbnailUrl",
  "sunoAudioUrl",
  "creatorNickname",
  "ownerNickname",
  "ownerUid",
  "nickname"
] as const;
type Favorite = Record<string,unknown>|null;
const valid=(s:string,max=240)=>s.length>0&&s.length<=max
  &&s!=="."&&s!==".."&&!/[\\/]/.test(s);
const state=(value:Favorite)=>value&&(
  value.favoriteRemoved===true||value.saved===false
  ||value.hidden===true||value.favoriteHidden===true
  ||Boolean(value.deletedAt)||Boolean(value.trashedAt))?"removed":"saved";
const normalize=(value:unknown):unknown=>{
  if(value===undefined)return null;
  if(value&&typeof value==="object"&&typeof (value as {toJSON?:unknown}).toJSON==="function")
    return normalize((value as {toJSON:()=>unknown}).toJSON());
  if(Array.isArray(value))return value.map(normalize);
  if(value&&typeof value==="object"){
    const o:Record<string,unknown>={};
    for(const key of Object.keys(value as object).sort())
      o[key]=normalize((value as Record<string,unknown>)[key]);
    return o;
  }
  return value;
};
const projection=(record:Favorite)=>{
  if(!record||state(record)==="removed")return null;
  const view:Record<string,unknown>={};
  for(const field of APP518_MUSIC_NOTE_FIELDS)
    if(record[field]!==undefined)view[field]=record[field];
  return normalize(view);
};
export const planApp518FavoriteChange=({uid,documentId,before,after}:{
 uid:string;documentId:string;before:Favorite;after:Favorite;
}):"DENY"|"IGNORE"|"RECHECK"|"DELETE_RECEIPT"=>{
 if(!valid(uid,128)||!valid(documentId)
   ||(before&&before.uid!==uid)||(after&&after.uid!==uid))
   return "DENY";
 if(!before&&!after)return "IGNORE";
 // A newly created explicit tombstone must still publish a newer remove
 // generation, even when the catalog projection is intentionally null.
 if(!before&&after)return "RECHECK";
 if(before&&!after)return "DELETE_RECEIPT";
 return JSON.stringify(projection(before))===JSON.stringify(projection(after))
   ?"IGNORE":"RECHECK";
};
export type App518ConnectorDependencies={
 db:admin.firestore.Firestore; secret:string;workerUrl:string;expectedHostname:string;
 nowMs:number;post?:typeof fetch;
};
export const handleApp518FavoriteEvent=async({
 uid,documentId,before,after,deleteEventId,beforeUpdateTime,
 dependencies,
}:{
 uid:string;documentId:string;before:Favorite;after:Favorite;
 deleteEventId:string;beforeUpdateTime:string;
 dependencies:App518ConnectorDependencies;
}):Promise<{code:string; firestoreReadsMax:number;receiptWritesMax:number}>=>{
 const plan=planApp518FavoriteChange({uid,documentId,before,after});
 if(plan==="DENY")return {code:"DENY_OWNER_OR_ID",firestoreReadsMax:0,receiptWritesMax:0};
 if(plan==="IGNORE")return {code:"IGNORE_NO_CATALOG_CHANGE",firestoreReadsMax:0,receiptWritesMax:0};
 const d=dependencies;
 if(typeof d.secret!=="string"||Buffer.byteLength(d.secret)<32)
   return {code:"HOLD_UNPROVISIONED_SECRET",firestoreReadsMax:0,receiptWritesMax:0};
 let source:App518Source|undefined;let receiptWrites=0;
 if(plan==="DELETE_RECEIPT"){
   const deleted=await recordHardDeleteApp518({
     db:d.db,uid,documentId,deleteEventId,beforeOwnerUid:uid,
     beforeUpdateTime,verifiedServerDeleteEvent:true,
   });
   if(deleted.code!=="VERIFIED_DELETE_RECEIPT")
     return {code:deleted.code,firestoreReadsMax:2,receiptWritesMax:0};
   source=deleted.source;receiptWrites=deleted.receiptWrite||0;
 }else{
   const current=await readExactApp518Source(d.db,uid,documentId);
   if(current.code!=="SOURCE_VERIFIED")
     return {code:current.code,firestoreReadsMax:2,receiptWritesMax:0};
   source=current.source;
 }
 if(!source)return {code:"HOLD_MISSING_VERIFIED_SOURCE",
   firestoreReadsMax:2,receiptWritesMax:receiptWrites};
 const sent=await dispatchApp518VerifiedEnqueue({
   source,secret:d.secret,workerUrl:d.workerUrl,
   expectedHostname:d.expectedHostname,nowMs:d.nowMs,post:d.post,
 });
 return {code:sent.code,firestoreReadsMax:plan==="RECHECK"?2:4,
   receiptWritesMax:receiptWrites};
};

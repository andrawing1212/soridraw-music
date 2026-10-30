// app518 deletion authority gate, inactive, never used by live Worker.
// A legacy deleteDoc() erases the document and its updateTime. The trigger's
// before.updateTime is not the timestamp of the DELETE commit, and wall-clock
// receive-time can be reordered. Never fabricate a deletion source version.
// A server-verified exact CURRENT soft tombstone can use its real updateTime.
import {parseFirestoreUpdateTimeNs518} from './catalogCanonicalFence518.js';

const txt=x=>typeof x==='string'?x.trim():'';
export const assessCanonicalRemoval518=({
 uid,documentId,canonical,serverVerified,
}={})=>{
 if(!txt(uid)||!txt(documentId)||serverVerified!==true)
   return {code:'DENY_UNVERIFIED_REMOVAL'};
 if(!canonical || canonical.exists!==true){
   // Old browser hard-delete: block until a durable, strictly-ordered
   // server tombstone authority is independently designed and proven.
   return {code:'HOLD_HARD_DELETE_NO_COMMIT_VERSION',allowR2Write:false};
 }
 if(canonical.uid!==uid||canonical.documentId!==documentId)
   return {code:'DENY_OWNER_OR_DOCUMENT_MISMATCH'};
 if(canonical.favoriteRemoved!==true && canonical.saved!==false)
   return {code:'NOT_REMOVED'};
 const ns=parseFirestoreUpdateTimeNs518(canonical.updateTime);
 if(!ns)return {code:'DENY_NO_SERVER_VERSION'};
 return {code:'SOFT_REMOVAL_VERIFIED',sourceVersionNs:ns,
   allowR2Write:false,requiresSourceCas:true};
};

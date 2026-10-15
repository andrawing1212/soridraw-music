import {materializePublicLikeProjection416}
 from './public-like-projection-416.mjs';
import {readPublicLikeReleaseState416,clearPublicLikeReleaseStorage416}
 from './public-like-window-416.mjs';
import {preparePublicLikeManifest416}
 from './public-like-manifest-416.mjs';
import {sendPublicLikeRelease416}
 from './public-like-release-416.mjs';
import {settlePublicLikeCountsFromMembership448}
 from './public-like-canonical-settle-448.mjs';

// SORIDRAW_COMMON_PUBLIC_LIKE_WINDOW_448_20261015
// One shared public window. Personal membership is already settled in likes;
// only changed tracks are counted and projected when the fixed window closes.
export async function releaseDueCommonPublicLikeWindow448({
 db,r2,storage,releaseEndpoint,releaseSecret,nowMs=Date.now(),http=fetch,
}={}){
 if(!db||!r2||!storage||!Number.isSafeInteger(nowMs)||nowMs<=0)
   throw Error('448_PUBLIC_RELEASE_INPUT_INVALID');
 const state=await readPublicLikeReleaseState416(storage,nowMs);
 if(!state.exists)return {status:'EMPTY',cleared:false};
 if(!state.due)return {status:'NOT_DUE',cleared:false,
   deadlineAtMs:Number(state.window?.deadlineAtMs||0)};
 if(state.blockedUnacked)throw Error('448_PUBLIC_RELEASE_BLOCKED');
 const ids=Array.isArray(state.trackIds)?state.trackIds:[];
 if(!ids.length)throw Error('448_PUBLIC_RELEASE_NO_TRACKS');

 const canonical=await settlePublicLikeCountsFromMembership448(db,ids,nowMs);
 const projection=await materializePublicLikeProjection416({db,r2,trackIds:ids});
 const rows=Array.isArray(projection?.releaseRows)?projection.releaseRows:[];
 let receiptStatus='NO_PUBLIC_TRACKS',manifestReads=0,manifestWrites=0;
 if(rows.length){
   const prepared=await preparePublicLikeManifest416(
     r2,rows,String(state.window.windowId),Number(state.window.deadlineAtMs));
   manifestReads=Number(prepared?.r2Reads||0);
   manifestWrites=Number(prepared?.r2Writes||0);
   const claim={
     windowId:String(state.window.windowId),
     releaseToken:String(state.releaseToken),
     deadlineAtMs:Number(state.window.deadlineAtMs),
     rows:prepared.inlineRows,
     ...(prepared.manifest416?{manifest416:prepared.manifest416}:{}),
     signedAtMs:nowMs,
   };
   const delivered=await sendPublicLikeRelease416({
     endpoint:releaseEndpoint,secret:releaseSecret,claim,http});
   receiptStatus=delivered.status;
 }
 const cleared=await clearPublicLikeReleaseStorage416(
   storage,state,nowMs,{alignSuccessorToPriorDeadline:true});
 return {
   status:'RELEASED',cleared:cleared.cleared===true,
   windowId:String(state.window.windowId),trackCount:ids.length,
   publicTrackCount:rows.length,receiptStatus,
   canonicalChangedTracks448:Number(canonical.changedTracks||0),
   d1ReadQueries:Number(canonical.d1ReadQueries||0)+Number(projection?.d1ReadQueries||0),
   d1Writes:Number(canonical.d1Writes||0)+Number(projection?.d1Writes||0),
   r2Reads:Number(projection?.r2Reads||0)+manifestReads,
   r2Writes:Number(projection?.r2Writes||0)+manifestWrites,
 };
}

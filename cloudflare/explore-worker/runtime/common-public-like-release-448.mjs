import {materializePublicLikeProjection416}
 from './public-like-projection-416.mjs';
import {
 readPublicLikeReleaseState416,clearPublicLikeReleaseStorage416,
 savePublicLikeCheckpoint416,markPublicLikePublished416,
} from './public-like-window-416.mjs';
import {preparePublicLikeManifest416}
 from './public-like-manifest-416.mjs';
import {sendPublicLikeRelease416}
 from './public-like-release-416.mjs';
import {
 planPublicLikeCountsFromMembership448,applyPublicLikeCountPlan448,
} from './public-like-canonical-settle-448.mjs';

const CHECKPOINT_KIND_448='common-public-like-plan-448';

const readCheckpointRows448=(checkpoint)=>{
 const rows=Array.isArray(checkpoint?.claim?.rows)?checkpoint.claim.rows:[];
 return rows.map((row)=>({
   trackId:String(row?.trackId||'').trim(),
   targetLikeCount:Number(row?.targetLikeCount),
 })).filter((row)=>row.trackId&&Number.isSafeInteger(row.targetLikeCount)&&row.targetLikeCount>=0);
};

// SORIDRAW_COMMON_PUBLIC_LIKE_WINDOW_448_20261015
// One shared public window. Personal membership is already settled in likes;
// only tracks whose published count really changes are projected/notified.
// A DO checkpoint is persisted before track_stats is changed so retries never
// lose the exact release set after a D1 success + later R2/HTTP failure.
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

 const windowId=String(state.window.windowId);
 const originalIds=Array.isArray(state.trackIds)?state.trackIds:[];
 let checkpoint=state.checkpoint||null;
 let planRows=[],planReads=0,planRequested=0;

 if(checkpoint){
   if(checkpoint.kind!==CHECKPOINT_KIND_448)
     throw Error('448_PUBLIC_CHECKPOINT_KIND_INVALID');
   planRows=readCheckpointRows448(checkpoint);
   planRequested=Number(checkpoint.requestedTrackCount||planRows.length);
   if(checkpoint.published===true){
     const cleared=await clearPublicLikeReleaseStorage416(
       storage,state,nowMs,{alignSuccessorToPriorDeadline:true});
     return {
       status:'RELEASED',cleared:cleared.cleared===true,windowId,
       trackCount:planRequested,publicTrackCount:Number(checkpoint.publicTrackCount||0),
       receiptStatus:String(checkpoint.receiptStatus||'ALREADY_PUBLISHED'),
       canonicalChangedTracks448:planRows.length,
       d1ReadQueries:0,d1Writes:0,r2Reads:0,r2Writes:0,
     };
   }
 }else{
   if(!originalIds.length)throw Error('448_PUBLIC_RELEASE_NO_TRACKS');
   const planned=await planPublicLikeCountsFromMembership448(db,originalIds);
   planReads=Number(planned.d1ReadQueries||0);
   planRequested=Number(planned.requestedTracks||originalIds.length);
   if(!planned.changedRows.length){
     const cleared=await clearPublicLikeReleaseStorage416(
       storage,state,nowMs,{alignSuccessorToPriorDeadline:true});
     return {
       status:'NO_CHANGE',cleared:cleared.cleared===true,windowId,
       trackCount:planRequested,publicTrackCount:0,
       receiptStatus:'NO_PUBLIC_CHANGE',
       canonicalChangedTracks448:0,
       d1ReadQueries:planReads,d1Writes:0,r2Reads:0,r2Writes:0,
     };
   }
   planRows=planned.changedRows.map((row)=>({
     trackId:String(row.trackId),targetLikeCount:Number(row.targetLikeCount),
   }));
   checkpoint={
     schemaVersion:1,kind:CHECKPOINT_KIND_448,windowId,
     requestedTrackCount:planRequested,published:false,publicTrackCount:0,
     receiptStatus:'PENDING',
     claim:{rows:planRows},
   };
   // MUST precede the track_stats write. If DO storage fails here, the old
   // public count is untouched and the whole due window can retry safely.
   await savePublicLikeCheckpoint416(storage,checkpoint);
 }

 const applied=await applyPublicLikeCountPlan448(db,planRows,nowMs);
 const changedIds=planRows.map((row)=>row.trackId);
 const projection=await materializePublicLikeProjection416({
   db,r2,trackIds:changedIds,
 });
 const rows=Array.isArray(projection?.releaseRows)?projection.releaseRows:[];
 let receiptStatus='NO_PUBLIC_TRACKS',manifestReads=0,manifestWrites=0;
 if(rows.length){
   const prepared=await preparePublicLikeManifest416(
     r2,rows,windowId,Number(state.window.deadlineAtMs));
   manifestReads=Number(prepared?.r2Reads||0);
   manifestWrites=Number(prepared?.r2Writes||0);
   const claim={
     windowId,
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
 await markPublicLikePublished416(storage,windowId);
 const publishedMeta=await storage.get('stage416/public/release').catch(()=>null);
 if(publishedMeta&&publishedMeta.windowId===windowId){
   await storage.put('stage416/public/release',{
     ...publishedMeta,publicTrackCount:rows.length,receiptStatus,
   });
 }
 const cleared=await clearPublicLikeReleaseStorage416(
   storage,state,nowMs,{alignSuccessorToPriorDeadline:true});
 return {
   status:'RELEASED',cleared:cleared.cleared===true,
   windowId,trackCount:planRequested,
   publicTrackCount:rows.length,receiptStatus,
   canonicalChangedTracks448:planRows.length,
   d1ReadQueries:planReads+Number(projection?.d1ReadQueries||0),
   d1Writes:Number(applied.d1Writes||0)+Number(projection?.d1Writes||0),
   r2Reads:Number(projection?.r2Reads||0)+manifestReads,
   r2Writes:Number(projection?.r2Writes||0)+manifestWrites,
 };
}

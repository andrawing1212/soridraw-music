// APP681: repair only persisted, genuinely pending Follow/Unfollow after reload
// on ANY SORIDRAW route. No startup request for a settled account.
import {onAuthStateChanged} from 'firebase/auth';
import {auth} from '../firebase';
import {
  queueExploreFollowFinalState380,
  readPendingExploreFollowIntents380,
} from './exploreFollowBatchService380';
import {
  getExploreFollowState,
  patchExploreFollowLocalState377,
  setExploreFollow,
} from './exploreSocialService';
import {patchExplorePublicProfileFirstViewProfile} from './exploreProfileFirstViewService';
import {publishExploreFollowSync377} from './exploreFollowSyncService';
import {rememberExploreFollowLocalChoice685} from './exploreFollowChoice685';

export const EXPLORE_FOLLOW_SETTLED_EVENT_681='soridraw:explore-follow-settled-681';

export type ExploreFollowSettled681={
 viewerUid:string; targetUid:string; following:boolean;
 actorFollowingCount:number|null;
 targetFollowerCount:number|null;
 targetFollowingCount:number|null;
};

export const announceExploreFollowSettled681=(value:ExploreFollowSettled681)=>{
 if(typeof window==='undefined')return;
 // Resume may settle while Explore is unmounted. Persist the confirmed
 // one-target outcome before broadcasting, so hard reload and an older
 // RTDB retained marker cannot repaint the previous button.
 if(auth.currentUser?.uid===value.viewerUid)
  rememberExploreFollowLocalChoice685(
   value.viewerUid,value.targetUid,value.following,true);
 window.dispatchEvent(new CustomEvent(EXPLORE_FOLLOW_SETTLED_EVENT_681,{detail:value}));
};

let started681=false;
export function startExploreFollowPendingResume681(){
 // This repair is PREVIEW-only until the director approves a production release.
 if(typeof window==='undefined'||window.location.hostname!=='preview.soridraw.com')return;
 if(started681)return;
 started681=true;
 onAuthStateChanged(auth,(user)=>{
  if(!user)return;
  const viewerUid=user.uid;
  const pending=readPendingExploreFollowIntents380(viewerUid);
  // A normal reload/page visit without an actual local mutation is read/write free.
  for(const row of pending){
   const targetUid=String(row.targetUid||'').trim();
   if(!targetUid||targetUid===viewerUid)continue;
   // Keep the saved last choice visible in existing local lists while it settles.
   patchExploreFollowLocalState377(viewerUid,targetUid,row.desiredFollowing,
     row.targetProfile,{deferTargetFollowers:true});
   const hadCooldown=Number(row.notBefore||0)>Date.now();
   queueExploreFollowFinalState380({
    ...row,
    immediate:true,initialDelayMs:0,
    restoredNotBefore:row.notBefore,
    restoredUpdatedAt:row.updatedAt,
    restoredRetryUsed:row.retryUsed,
    restoredSuspended:row.suspended||hadCooldown,
    commit:(following)=>setExploreFollow(user,targetUid,following,row.targetProfile),
    onSettled:(settlement)=>{
     if(auth.currentUser?.uid!==viewerUid)return;
     const result=settlement.result;
     const following=Boolean(result.isFollowing);
     patchExploreFollowLocalState377(viewerUid,targetUid,following,row.targetProfile);
     const actor=result.actorCountVerified662===true
       && Number.isSafeInteger(result.actorFollowingCount)
       ? Number(result.actorFollowingCount):null;
     const target=result.countVerified661===true
       ? result.followerCount:null;
     const targetFollowing=result.countVerified661===true
       ? result.followingCount:null;
     if(actor!==null)patchExplorePublicProfileFirstViewProfile(viewerUid,
       {followingCount:actor});
     if(target!==null&&targetFollowing!==null)
      patchExplorePublicProfileFirstViewProfile(targetUid,
       {followerCount:target,followingCount:targetFollowing});
     announceExploreFollowSettled681({
      viewerUid,targetUid,following,actorFollowingCount:actor,
      targetFollowerCount:target,targetFollowingCount:targetFollowing,
     });
     // Publish the small same-account event only after exact canonical ACK.
     if(following!==settlement.baseFollowing&&actor!==null&&target!==null){
      void publishExploreFollowSync377(viewerUid,{
       targetUid,following,actorFollowingCount:actor,targetFollowerCount:target,
      }).catch(error=>console.warn('[681] confirmed follow signal deferred',error));
     }
    },
    onError:(failure)=>{
     // A failed HTTP response might follow a committed D1 write. One bounded
     // target recheck is allowed only for this failed user mutation.
     void getExploreFollowState(user,targetUid,true).catch(()=>null).then(latest=>{
      if(auth.currentUser?.uid!==viewerUid)return;
      const following=latest?.isFollowing??failure.baseFollowing;
      patchExploreFollowLocalState377(viewerUid,targetUid,following,row.targetProfile);
      const actor=latest?.actorCountVerified662===true
        && Number.isSafeInteger(latest.actorFollowingCount)
        ? Number(latest.actorFollowingCount):null;
      const target=latest?.countVerified661===true?latest.followerCount:null;
      if(actor!==null)
       patchExplorePublicProfileFirstViewProfile(viewerUid,{followingCount:actor});
      if(target!==null)
       patchExplorePublicProfileFirstViewProfile(targetUid,{followerCount:target});
      announceExploreFollowSettled681({
       viewerUid,targetUid,following,actorFollowingCount:actor,
       targetFollowerCount:target,targetFollowingCount:null,
      });
     });
    },
   });
  }
 });
}

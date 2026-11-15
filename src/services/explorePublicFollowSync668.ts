// APP668: public follow-counter notification transport, dormant until the
// canonical issuer, shared Rules and account-deletion revocation are VERIFIED.
// Do not use the owner's private ownerFollowerSync532 signal for visitors.
import {onValue,ref as databaseRef,type Unsubscribe} from 'firebase/database';
import {auth,realtimeDb} from '../firebase';

export const PUBLIC_FOLLOW_VISITOR_668_ENABLED=false;
export const PUBLIC_FOLLOW_PROFILE_ROOT_668='publicSync/exploreFollowProfiles667';
import {normalizePublicProfileFollow668,acceptPublicProfileFollow668} from './explorePublicFollowCore668';
export type {PublicProfileFollowSignal668} from './explorePublicFollowCore668';
const UID=/^[A-Za-z0-9_-]{1,128}$/;
export const subscribePublicProfileFollow668=(
 profileUid:string,
 onConfirmed:(signal:PublicProfileFollowSignal668)=>void,
):Unsubscribe=>{
 // All non-PREVIEW hosts and current deployed clients stay OFF until a
 // separately verified shared-server activation. No initial RTDB read.
 if(!PUBLIC_FOLLOW_VISITOR_668_ENABLED||
    typeof window==='undefined'||window.location.hostname!=='preview.soridraw.com'||
    !UID.test(profileUid)||auth.currentUser===null)return ()=>{};
 const principal=auth.currentUser;
 let seen:PublicProfileFollowSignal668|null=null;
 return onValue(databaseRef(realtimeDb,
  PUBLIC_FOLLOW_PROFILE_ROOT_668+'/'+profileUid),snapshot=>{
   if(auth.currentUser!==principal)return;
   const next=normalizePublicProfileFollow668(snapshot.val(),profileUid);
   if(!next||!acceptPublicProfileFollow668(seen,next))return;
   seen=next;
   onConfirmed(next);
 },()=>{/* Owner-private path and explicit per-profile fallback are intact. */});
};

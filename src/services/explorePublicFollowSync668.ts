// APP668: public follow-counter notification transport, dormant until the
// canonical issuer, shared Rules and account-deletion revocation are VERIFIED.
// Do not use the owner's private ownerFollowerSync532 signal for visitors.
import {onValue,ref as databaseRef,type Unsubscribe} from 'firebase/database';
import {auth,realtimeDb} from '../firebase';

export const PUBLIC_FOLLOW_VISITOR_668_ENABLED=false;
export const PUBLIC_FOLLOW_PROFILE_ROOT_668='publicSync/exploreFollowProfiles667';
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const GEN=/^[a-f0-9]{32}$/;
const HEX=/^[a-f0-9]{64}$/;
const COUNT_MAX=1_000_000_000;
const MAX_AGE=10*60_000;
export type PublicProfileFollowSignal668={
 profileUid:string;generation:string;revision:number;
 followerCount:number;followingCount:number;
 public:true;commitId:string;at:number;
};
const validCount=(v:unknown):v is number=>typeof v==='number'&&
 Number.isSafeInteger(v)&&v>=0&&v<=COUNT_MAX;
export const normalizePublicProfileFollow668=(raw:unknown,uid:string):PublicProfileFollowSignal668|null=>{
 if(!UID.test(uid)||!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const row=raw as Record<string,unknown>;
 if(Object.keys(row).sort().join(',')!==
  'at,commitId,followerCount,followingCount,generation,profileUid,public,revision'||
  row.profileUid!==uid||typeof row.generation!=='string'||!GEN.test(row.generation)||
  typeof row.commitId!=='string'||!HEX.test(row.commitId)||
  row.public!==true||typeof row.revision!=='number'||
  !Number.isSafeInteger(row.revision)||row.revision<=0||
  !validCount(row.followerCount)||!validCount(row.followingCount)||
  typeof row.at!=='number'||!Number.isSafeInteger(row.at)||row.at<=0)return null;
 return row as PublicProfileFollowSignal668;
};
// Monotonic revision is per profile, not per actor/target follow pair.
// Different account generations must NEVER inherit the prior UID cache.
export const acceptPublicProfileFollow668=(
 previous:PublicProfileFollowSignal668|null,
 incoming:PublicProfileFollowSignal668,
 now=Date.now(),
):boolean=>{
 if(!Number.isSafeInteger(now)||incoming.at>now+60_000||
    now-incoming.at>MAX_AGE)return false;
 if(!previous)return true;
 if(previous.profileUid!==incoming.profileUid||
    previous.generation!==incoming.generation)return false;
 return incoming.revision>previous.revision;
};
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

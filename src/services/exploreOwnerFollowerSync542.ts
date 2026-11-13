// APP542: one tiny, authenticated, owner-private RTDB subscription.
// No import from ExplorePage while the compile-time switch is OFF triggers a
// listener, canonical GET, Firestore read or server write.
import {getIdTokenResult} from 'firebase/auth';
import {getApp} from 'firebase/app';
import {getFunctions,httpsCallable} from 'firebase/functions';
import {onValue,ref as databaseRef,type Unsubscribe} from 'firebase/database';
import {auth,realtimeDb} from '../firebase';
import { hasOwnerFollowCanaryOptIn634 } from '../lib/ownerFollowCanaryTab634';

export const EXPLORE_OWNER_FOLLOW_REALTIME_542_ENABLED=true;
export const APP608_APPROVED_CANARY_UID='rcZ2GZrBndOZzT8C635eiNBjYIJ2';
// APP575: PREVIEW explicit QA URL only, never a general login/page-entry
// registration, scan, poll or Firestore mutation. Kept OFF until server
// canary UID, Rules, Functions and DO are safely installed and checked.
export const APP575_OWNER_CANARY_BOOTSTRAP_ENABLED=true;
export const shouldAttemptOwnerFollowCanary575=(
 hostname:string,search:string,enabled=APP575_OWNER_CANARY_BOOTSTRAP_ENABLED,
)=>enabled&&hostname==='preview.soridraw.com'&&
 new URLSearchParams(search).get('ownerFollowCanary')==='1';
// The explicit root URL may navigate / -> /explore -> ?profile=uid, which
// erases ownerFollowCanary from location.search. APP634 restores ONLY the
// same-tab opt-in originally captured on preview.soridraw.com.
const hasExplicitOwnerFollowTabOptIn634=():boolean=>{
 if(typeof window==='undefined')return false;
 try{return hasOwnerFollowCanaryOptIn634(
  window.location.hostname.toLowerCase(),window.location.search,window.sessionStorage,
 )}catch{return false}
};
export const isApp608OwnerCanaryVisible=(uid:string):boolean=>
 uid===APP608_APPROVED_CANARY_UID&&
 (shouldAttemptOwnerFollowCanary575(
   typeof window==='undefined'?'':window.location.hostname.toLowerCase(),
   typeof window==='undefined'?'':window.location.search,
 )||hasExplicitOwnerFollowTabOptIn634());
const enrollmentAttempts575=new Map<string,Promise<boolean>>();
const tryOwnerFollowCanaryEnrollment575=(
 uid:string,principal:NonNullable<typeof auth.currentUser>,
):Promise<boolean>=>{
 if(!isApp608OwnerCanaryVisible(uid)||auth.currentUser!==principal)return Promise.resolve(false);
 const key=uid;
 const prior=enrollmentAttempts575.get(key);
 if(prior)return prior;
 // One explicit attempt per account per SPA lifetime. Failed enrollment is
 // not retried on focus/profile navigation; QA must explicitly reload.
 const task=(async()=>{
  try{
   // Region instance is created ONLY on the explicit canary test attempt.
   const callable=httpsCallable(getFunctions(getApp(),'asia-northeast3'),
     'enrollOwnerFollow544Candidate');
   await callable({});
   if(auth.currentUser!==principal)return false;
   const refreshed=await getIdTokenResult(principal,true);
   return auth.currentUser===principal&&
    typeof refreshed.claims.soridrawFollowEpoch532==='string'&&
    /^[0-9a-f]{32}$/.test(refreshed.claims.soridrawFollowEpoch532);
  }catch{return false}
 })();
 enrollmentAttempts575.set(key,task);
 return task;
};
const EPOCH=/^[0-9a-f]{32}$/;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const prefix=(uid:string,epoch:string)=>
  'soridraw:explore:owner-follow-version:532:'+uid+':'+epoch;
export const readOwnerFollowerSeenVersion542=(uid:string,epoch:string):number=>{
 if(!UID.test(uid)||!EPOCH.test(epoch)||typeof localStorage==='undefined')return 0;
 try{
  const n=Number(localStorage.getItem(prefix(uid,epoch))||0);
  return Number.isSafeInteger(n)&&n>0?n:0;
 }catch{return 0}
};
export const rememberOwnerFollowerSeenVersion542=(uid:string,epoch:string,version:number)=>{
 if(!UID.test(uid)||!EPOCH.test(epoch)||!Number.isSafeInteger(version)||
    version<=0||typeof localStorage==='undefined')return;
 try{
  if(version>readOwnerFollowerSeenVersion542(uid,epoch))
   localStorage.setItem(prefix(uid,epoch),String(version));
 }catch{/* Storage quota must never block the onValue subscription. */}
};
export const subscribeExploreOwnerFollower542=async(
 uid:string,onSnapshot:(value:unknown,verifiedClaimEpoch:string)=>void,
):Promise<Unsubscribe>=>{
 // APP591: outside explicit PREVIEW QA opt-in, do not even inspect Auth.
 // This protects ordinary owners from extra token requests when compiled ON.
 if(!EXPLORE_OWNER_FOLLOW_REALTIME_542_ENABLED||!UID.test(uid)||
    !isApp608OwnerCanaryVisible(uid))return ()=>{};
 const principal=auth.currentUser;
 if(!principal||principal.uid!==uid)return ()=>{};
 let token;
 try{token=await getIdTokenResult(principal);}catch{return ()=>{}}
 let epoch=token.claims.soridrawFollowEpoch532;
 // Only explicit PREVIEW QA opt-in may bootstrap a missing owner claim.
 // Every other owner with no claim exits with zero server writes.
 if((typeof epoch!=='string'||!EPOCH.test(epoch))&&
    await tryOwnerFollowCanaryEnrollment575(uid,principal)){
  try{token=await getIdTokenResult(principal);}catch{return ()=>{}}
  epoch=token.claims.soridrawFollowEpoch532;
 }
 if(typeof epoch!=='string'||!EPOCH.test(epoch)||auth.currentUser!==principal)
   return ()=>{};
 // Rule is owner-only, bound to the exact claimed Auth generation. No client
 // writes, no 15s polling and no profile-wide listeners.
 return onValue(databaseRef(realtimeDb,'ownerFollowerSync532/'+uid),
   snapshot=>{
     if(auth.currentUser===principal)onSnapshot(snapshot.val(),epoch);
   },
   ()=>{/* Existing APP528 explicit cached-list fallback remains intact. */});
};

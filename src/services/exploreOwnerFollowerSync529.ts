import { onValue,ref as databaseRef,type Unsubscribe } from 'firebase/database';
import { realtimeDb } from '../firebase';

// Compilation and backend control BOTH OFF. User-private owner subscription.
export const EXPLORE_OWNER_FOLLOW_REALTIME_529_ENABLED=false;
const key529=(uid:string)=>'soridraw:explore:owner-follow-version:529:'+uid;
export const readOwnerFollowerSeenVersion529=(uid:string):number=>{
 if(!uid||typeof localStorage==='undefined')return 0;
 try{
   const value=Number(localStorage.getItem(key529(uid))||0);
   return Number.isSafeInteger(value)&&value>0?value:0;
 }catch{return 0;}
};
export const rememberOwnerFollowerSeenVersion529=(uid:string,version:number)=>{
 if(!uid||!Number.isSafeInteger(version)||version<=0||
    typeof localStorage==='undefined')return;
 try{
   if(version>readOwnerFollowerSeenVersion529(uid))
     localStorage.setItem(key529(uid),String(version));
 }catch{}
};
export const subscribeExploreOwnerFollower529=(
 uid:string,onSnapshot:(value:unknown)=>void,
):Unsubscribe=>{
 if(!EXPLORE_OWNER_FOLLOW_REALTIME_529_ENABLED||!uid)return ()=>{};
 return onValue(
   databaseRef(realtimeDb,'userSync/'+uid+'/exploreFollowerOwner529'),
   snapshot=>onSnapshot(snapshot.val()),
   error=>console.warn('[529] owner follow realtime deferred',error),
 );
};

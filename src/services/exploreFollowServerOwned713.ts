// APP713 PREVIEW candidate: click-time authenticated server-owned follow queue.
// Source-only OFF until the exact PREVIEW owner/Explore Workers are released.
// No background polling, no credentials persisted, no spontaneous entry writes.
import type {User} from 'firebase/auth';
import {getFirebaseAppCheckToken} from '../firebase';
import {EXPLORE_API_BASE} from '../config/exploreEnvironment';
import {getExploreFollowState} from './exploreSocialService';
export const APP713_SERVER_FOLLOW_CLIENT_COMPILED_OPEN=false;
const SAFE=/^[A-Za-z0-9_-]{1,128}$/;
const DEVICE=/^[A-Za-z0-9_-]{8,80}$/;
const TTL_MS=24*60*60_000;
type Receipt713={
 viewerUid:string;targetUid:string;deviceId:string;sequence:number;
 following:boolean;issuedAt:number;generation?:string;dueAt?:number;
};
const key=(viewer:string,target:string)=>'soridraw:follow713:'+viewer+':'+target;
const deviceKey=(viewer:string)=>'soridraw:follow713-device:'+viewer;
const counterKey=(viewer:string,target:string)=>
 'soridraw:follow713-sequence:'+viewer+':'+target;
const read=(viewer:string,target:string):Receipt713|null=>{
 if(typeof localStorage==='undefined')return null;
 try{
  const data=JSON.parse(localStorage.getItem(key(viewer,target))||'null');
  if(data?.viewerUid!==viewer||data?.targetUid!==target||
     !DEVICE.test(String(data.deviceId||''))||
     !Number.isSafeInteger(data.sequence)||data.sequence<1||
     typeof data.following!=='boolean'||!Number.isSafeInteger(data.issuedAt)||
     Date.now()-data.issuedAt>TTL_MS)return null;
  return data as Receipt713;
 }catch{return null}
};
const store=(entry:Receipt713)=>{
 try{localStorage.setItem(key(entry.viewerUid,entry.targetUid),
  JSON.stringify(entry))}catch{}
};
const deviceId=(viewer:string)=>{
 if(typeof localStorage==='undefined')throw Error('APP713_LOCAL_STORAGE_REQUIRED');
 const old=localStorage.getItem(deviceKey(viewer))||'';
 if(DEVICE.test(old))return old;
 const next='device713_'+crypto.randomUUID().replaceAll('-','_');
 localStorage.setItem(deviceKey(viewer),next);
 return next;
};
const err=(status:string,retryAfterMs=2500)=>Object.assign(
 new Error('팔로우 서버 확정 확인을 기다리고 있습니다.'),{
 code:'SERVER_OWNED_PENDING_713',status,retryAfterMs,
});
export const isExploreServerOwnedFollow713=(user?:User)=>{
 if(!APP713_SERVER_FOLLOW_CLIENT_COMPILED_OPEN||
    typeof window==='undefined')return false;
 return window.location.hostname==='preview.soridraw.com'&&
   user?.uid==='rcZ2GZrBndOZzT8C635eiNBjYIJ2';
};
export const stageExploreServerOwnedFollow713=(
 user:User,targetUid:string,following:boolean,
):Receipt713=>{
 const viewerUid=String(user.uid||'');
 if(!SAFE.test(viewerUid)||!SAFE.test(targetUid)||viewerUid===targetUid)
  throw Error('APP713_INVALID_PAIR');
 const existing=read(viewerUid,targetUid);
 const device=deviceId(viewerUid);
 const previous=Number(localStorage.getItem(counterKey(viewerUid,targetUid))||0);
 const sequence=Math.max(Number.isSafeInteger(previous)&&previous>=0?previous:0,
   existing?.deviceId===device?existing.sequence:0)+1;
 if(!Number.isSafeInteger(sequence))throw Error('APP713_SEQUENCE_EXHAUSTED');
 localStorage.setItem(counterKey(viewerUid,targetUid),String(sequence));
 const entry={viewerUid,targetUid,deviceId:device,sequence,following,
  issuedAt:Date.now()};
 store(entry);return entry;
};
type PreparedAuth713={token:string;appCheck:string;preparedAt:number};
const preparedAuth713=new WeakMap<User,Promise<PreparedAuth713>>();
const getPreparedAuth713=async(user:User)=>{
 const prior=preparedAuth713.get(user);
 if(prior){
  const ready=await prior;
  if(Date.now()-ready.preparedAt<2*60_000)return ready;
 }
 const next=Promise.all([user.getIdToken(),getFirebaseAppCheckToken()])
  .then(([token,appCheck])=>{
   if(!token||!appCheck)throw err('app-check-unavailable');
   return {token,appCheck,preparedAt:Date.now()};
  });
 preparedAuth713.set(user,next);
 try{return await next}
 catch(e){if(preparedAuth713.get(user)===next)preparedAuth713.delete(user);throw e}
};
export const primeExploreServerOwnedFollowAuth713=(user:User)=>{
 if(!isExploreServerOwnedFollow713(user))return;
 void getPreparedAuth713(user).catch(()=>{});
};
const dispatch=async(user:User,record:Receipt713)=>{
 const {token:idToken,appCheck}=await getPreparedAuth713(user);
 const response=await fetch(EXPLORE_API_BASE+'/v1/profiles/'+
  encodeURIComponent(record.targetUid)+'/follow-click-713',{
  method:'POST',keepalive:true,headers:{'Content-Type':'application/json',
   Authorization:'Bearer '+idToken,'X-Firebase-AppCheck':appCheck},
  body:JSON.stringify({following:record.following,
   deviceId:record.deviceId,sequence:record.sequence}),
 });
 const payload=await response.json().catch(()=>null);
 if(!response.ok||payload?.ok!==true||
    payload?.status!=='durably-accepted'||
    typeof payload.generation!=='string'||
    !Number.isSafeInteger(payload.dueAt)||payload.dueAt<=0)
  throw err('reservation-not-confirmed');
 const latest=read(record.viewerUid,record.targetUid);
 if(latest?.deviceId===record.deviceId&&
    latest.sequence===record.sequence&&
    latest.following===record.following){
  store({...record,generation:payload.generation,dueAt:payload.dueAt});
 }
 return {generation:payload.generation as string,dueAt:payload.dueAt as number};
};
export const sendExploreServerOwnedFollow713=async(
 user:User,record:Receipt713,
)=>{
 try{return await dispatch(user,record)}
 catch{return null} // never claim an unknown server ACK
};
export const confirmExploreServerOwnedFollow713=async(
 user:User,targetUid:string,following:boolean,
)=>{
 const record=read(user.uid,targetUid);
 if(!record||record.following!==following)throw err('local-intent-missing');
 let dueAt=record.dueAt;
 if(!record.generation||!Number.isSafeInteger(dueAt)){
  // Same device/sequence resubmission is idempotent. Unknown response
  // must never switch to legacy PUT/DELETE.
  try{dueAt=(await dispatch(user,record)).dueAt}
  catch{throw err('reservation-not-confirmed')}
 }
 const delay=Math.max(0,Number(dueAt)-Date.now());
 if(delay>0)await new Promise(resolve=>setTimeout(resolve,Math.min(delay,7000)));
 let state;
 try{state=await getExploreFollowState(user,targetUid,true)}
 catch{throw err('canonical-read-unavailable')}
 if(!state||state.isFollowing!==following)
  throw err('canonical-not-yet-settled');
 const current=read(user.uid,targetUid);
 if(current?.deviceId===record.deviceId&&
    current.sequence===record.sequence&&current.following===following)
  try{localStorage.removeItem(key(user.uid,targetUid))}catch{}
 return state;
};

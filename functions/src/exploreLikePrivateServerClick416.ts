import type { Database } from 'firebase-admin/database';
import { createHash } from 'node:crypto';

// Stage416 server-only intent authority. A future authenticated AppCheck
// callable will pass request.auth.uid, never a browser-controlled UID/time or
// Master period. Keep this function UNEXPORTED from functions/src/index.ts
// until multi-environment compatibility and billing audits are completed.
export type ServerPrivateLikeClick416 = {
  trackId:string; liked:boolean; operationId:string;
  deviceId:string; deviceSequence:number;
};
const UUID_416=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validMinute416=(n:number)=>[1,3,5,10,20].includes(n);
type Window416={id:string;minutes:number;openedAtMs:number;lastClickAtMs:number;revision:number};
type Pending416={version?:number;deviceSeq?:Record<string,number>;
  window?:Window416|null;pending?:Record<string,{trackId:string;liked:boolean;
  operationId:string;deviceId:string;deviceSequence:number;version:number;mutationAt:number}>|null;
  sealed?:unknown};
export async function recordUserPrivateClick416(
  database:Database,uid:string,click:ServerPrivateLikeClick416,
  trustedMinutes:number,receivedAtMs=Date.now(),
):Promise<{accepted:boolean;reason:string;version?:number;count?:number;deadlineAtMs?:number;expiredWindowId?:string}>{
 if(!uid||uid.length>128||!click||typeof click.trackId!=='string'||
    !click.trackId||click.trackId.length>512||
    typeof click.liked!=='boolean'||!UUID_416.test(click.operationId)||
    !UUID_416.test(click.deviceId)||
    !Number.isSafeInteger(click.deviceSequence)||click.deviceSequence<=0||
    !Number.isSafeInteger(receivedAtMs)||receivedAtMs<=0||
    !validMinute416(trustedMinutes))
  throw Error('416_BAD_SERVER_PRIVATE_CLICK');
 const trackKey=createHash('sha256').update(click.trackId,'utf8').digest('hex');
 let reason='UNDETERMINED';
 let expiredWindowId:string|undefined;
 let replay:{version:number;count:number;deadlineAtMs?:number}|null=null;
 const outcome=await database.ref('privateLikeBatch416/'+uid).transaction((raw:unknown)=>{
   const state=(raw&&typeof raw==='object'&&!Array.isArray(raw)
     ?raw:{} ) as Pending416;
   const version=Number(state.version||0);
   const devices=state.deviceSeq||{};
   const pending=state.pending||{};
   const previousDeviceSeq=Number(devices[click.deviceId]||0);
   if(!Number.isSafeInteger(version)||version<0||version>=Number.MAX_SAFE_INTEGER||
      !Number.isSafeInteger(previousDeviceSeq)||previousDeviceSeq<0||
      !devices||typeof devices!=='object'||Array.isArray(devices)||
      !pending||typeof pending!=='object'||Array.isArray(pending))
     throw Error('416_SERVER_PRIVATE_STATE_CORRUPT');
   if(click.deviceSequence<=previousDeviceSeq){
     // Confirm only the exact previously registered operation inside the
     // SAME UID RTDB transaction. A guessed duplicate is never accepted.
     const frozen=state.sealed as {rows?:Array<{
       trackId:string;liked:boolean;operationId:string;deviceId?:string;
       deviceSequence?:number;version?:number}>}|null|undefined;
     const registered=[pending[trackKey],
       ...(Array.isArray(frozen?.rows)?frozen.rows:[])]
       .find(row=>row?.trackId===click.trackId&&row.liked===click.liked&&
         row.operationId===click.operationId&&row.deviceId===click.deviceId&&
         row.deviceSequence===click.deviceSequence);
     if(click.deviceSequence===previousDeviceSeq && registered &&
        Number.isSafeInteger(registered.version)&&Number(registered.version)>0){
       reason='DUPLICATE_CONFIRMED';
       replay={version:Number(registered.version),
         count:Object.keys(pending).length||
           (Array.isArray(frozen?.rows)?frozen.rows.length:0),
         ...(state.window?{deadlineAtMs:
           state.window.lastClickAtMs+state.window.minutes*60_000}:{})};
     }else reason='STALE_OR_DUPLICATE';
     return;
   }
   if(Object.keys(devices).length>=32&&!Object.prototype.hasOwnProperty.call(devices,click.deviceId)){
     reason='DEVICE_LIMIT';return;
   }
   if(Object.keys(pending).length>=256&&!Object.prototype.hasOwnProperty.call(pending,trackKey)){
     reason='TRACK_LIMIT';return;
   }
   const previous=state.window;
   if(previous&&(!Number.isSafeInteger(previous.lastClickAtMs)||
       !validMinute416(previous.minutes))){
     throw Error('416_SERVER_PRIVATE_WINDOW_CORRUPT');
   }
   if(previous && receivedAtMs>=previous.lastClickAtMs+previous.minutes*60_000){
     // The expired preceding window must be sealed first, never mixed with a
     // later new window. Original browser outbox must retry this same click.
     reason='PRIOR_WINDOW_NEEDS_SEAL';expiredWindowId=previous.id;return;
   }
   const serverClickAt=Math.max(receivedAtMs,(previous?.lastClickAtMs||0)+1);
   const minutes=previous?previous.minutes:trustedMinutes;
   const versionNext=version+1;
   const nextPending={...pending,[trackKey]:{
     trackId:click.trackId,liked:click.liked,operationId:click.operationId,
     deviceId:click.deviceId,deviceSequence:click.deviceSequence,version:versionNext,
     mutationAt:serverClickAt,
   }};
   reason='ACCEPTED';
   return {...state,version:versionNext,
     deviceSeq:{...devices,[click.deviceId]:click.deviceSequence},
     pending:nextPending,
     window:{id:previous?.id||click.operationId,minutes,
       openedAtMs:previous?.openedAtMs||serverClickAt,
       lastClickAtMs:serverClickAt,revision:versionNext},
   };
 },undefined,false);
 if(!outcome.committed){
   // Transaction callbacks set this value asynchronously; keep the explicit
   // proof type at the post-transaction boundary for strict TypeScript.
   const exactProof=replay as {version:number;count:number;deadlineAtMs?:number}|null;
   if(exactProof)return {accepted:true,reason:'DUPLICATE_CONFIRMED',...exactProof};
   return {accepted:false,reason,
     ...(reason==='PRIOR_WINDOW_NEEDS_SEAL'&&expiredWindowId?{expiredWindowId}:{})};
 }
 const state=outcome.snapshot.val() as Pending416;
 if(!state?.window||state.version!==state.window.revision)
   throw Error('416_SERVER_PRIVATE_CLICK_PROOF_MISSING');
 return {accepted:true,reason:'ACCEPTED',
   version:state.version,count:Object.keys(state.pending||{}).length,
   deadlineAtMs:state.window.lastClickAtMs+state.window.minutes*60_000};
}

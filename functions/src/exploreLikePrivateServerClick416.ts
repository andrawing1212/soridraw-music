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
type GlobalVersion416={version?:number;devices?:Record<string,{
  deviceSequence:number;operationId:string;trackId:string;liked:boolean;version:number;
}>};

// Cross-environment state allocates only a globally monotonic version. It is
// NOT acceptance authority. An exact retry may reuse its reservation, but the
// environment private root must still prove the operation exists in pending or
// sealed state before DUPLICATE_CONFIRMED is returned.
async function reserveGlobalVersion416(database:Database,uid:string,
 click:ServerPrivateLikeClick416,receivedAtMs:number,globalVersionRoot:string,
):Promise<{reserved:boolean;reason:string;version?:number}> {
 let decision:{reserved:boolean;reason:string;version?:number}={
  reserved:false,reason:'UNDETERMINED'};
 const result=await database.ref(globalVersionRoot+'/'+uid).transaction((raw:unknown)=>{
  const unchanged=raw===undefined?null:raw;
  decision={reserved:false,reason:'UNDETERMINED'};
  const state=(raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{}) as GlobalVersion416;
  const version=Number(state.version||0);
  const devices=state.devices||{};
  const prior=devices[click.deviceId];
  if(!Number.isSafeInteger(version)||version<0||version>=Number.MAX_SAFE_INTEGER||
     !devices||typeof devices!=='object'||Array.isArray(devices))
   throw Error('416_GLOBAL_VERSION_STATE_CORRUPT');
  if(prior&&click.deviceSequence<=prior.deviceSequence){
   if(click.deviceSequence===prior.deviceSequence&&prior.operationId===click.operationId&&
      prior.trackId===click.trackId&&prior.liked===click.liked&&
      Number.isSafeInteger(prior.version)&&prior.version>0){
    decision={reserved:true,reason:'GLOBAL_RESERVATION_REUSED',version:prior.version};
   }else decision={reserved:false,reason:'STALE_OR_DUPLICATE'};
   return unchanged;
  }
  if(Object.keys(devices).length>=32&&!Object.prototype.hasOwnProperty.call(devices,click.deviceId)){
   decision={reserved:false,reason:'DEVICE_LIMIT'};return unchanged;
  }
  const next=Math.max(version+1,receivedAtMs);
  if(!Number.isSafeInteger(next)||next<=version)
   throw Error('416_GLOBAL_VERSION_EXHAUSTED');
  decision={reserved:true,reason:'GLOBAL_VERSION_RESERVED',version:next};
  return {version:next,devices:{...devices,[click.deviceId]:{
   deviceSequence:click.deviceSequence,operationId:click.operationId,
   trackId:click.trackId,liked:click.liked,version:next,
  }}};
 },undefined,false);
 if(!result.committed&&decision.reason==='UNDETERMINED')
  throw Error('416_GLOBAL_VERSION_DECISION_MISSING');
 return decision;
}
export async function recordUserPrivateClick416(
  database:Database,uid:string,click:ServerPrivateLikeClick416,
  trustedMinutes:number,receivedAtMs=Date.now(),
  authoritativeRetry=false,privateRoot='privateLikeBatch416',
  globalVersionRoot?:string,allocatedVersion?:number,
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
 if(allocatedVersion===undefined&&globalVersionRoot){
  const reservation=await reserveGlobalVersion416(
   database,uid,click,receivedAtMs,globalVersionRoot);
  if(!reservation.reserved||reservation.version===undefined)
   return {accepted:false,reason:reservation.reason};
  allocatedVersion=reservation.version;
 }
 let reason='UNDETERMINED';
 let expiredWindowId:string|undefined;
 let replay:{version:number;count:number;deadlineAtMs?:number}|null=null;
 const privateRef=database.ref(privateRoot+'/'+uid);
 const outcome=await privateRef.transaction((raw:unknown)=>{
   // Never abort a decision that depends on current server state. Returning the
   // exact local value forces RTDB to compare its hash with the server; on a
   // stale cache the transaction callback is re-run with authoritative data.
   const unchanged=raw===undefined?null:raw;
   reason='UNDETERMINED';expiredWindowId=undefined;replay=null;
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
     // The global sequencer is reservation-only. Confirm a duplicate solely
     // from this environment's exact pending/sealed operation.
     const frozen=state.sealed as {rows?:Array<{
       trackId:string;liked:boolean;operationId:string;deviceId?:string;
       deviceSequence?:number;version?:number}>}|null|undefined;
     const registered=[pending[trackKey],
       ...(Array.isArray(frozen?.rows)?frozen.rows:[])]
       .find(row=>row?.trackId===click.trackId&&row.liked===click.liked&&
         row.operationId===click.operationId&&row.deviceId===click.deviceId&&
         row.deviceSequence===click.deviceSequence);
     const registeredVersion=Number(registered?.version||0);
     const versionMatches=allocatedVersion===undefined||registeredVersion===allocatedVersion;
     if(click.deviceSequence===previousDeviceSeq && registered &&
        Number.isSafeInteger(registeredVersion)&&registeredVersion>0&&versionMatches){
       reason='DUPLICATE_CONFIRMED';
       replay={version:registeredVersion,
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
     // later new window. The global reservation is intentionally reusable by
     // this exact operation after the prior seal clears.
     reason='PRIOR_WINDOW_NEEDS_SEAL';expiredWindowId=previous.id;return unchanged;
   }
   const serverClickAt=Math.max(receivedAtMs,(previous?.lastClickAtMs||0)+1);
   const minutes=previous?previous.minutes:trustedMinutes;
   const versionNext=allocatedVersion===undefined?version+1:allocatedVersion;
   if(!Number.isSafeInteger(versionNext)||versionNext<=version)
    throw Error('416_GLOBAL_VERSION_NOT_NEWER_THAN_ENVIRONMENT');
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
   // Keep the existing W0 behavior for duplicate/limit aborts. Reuse the exact
   // global reservation across the one authoritative retry; never allocate a
   // second version merely because RTDB refreshed its transaction cache.
   if(!authoritativeRetry){
     await privateRef.get();
     return recordUserPrivateClick416(
       database,uid,click,trustedMinutes,receivedAtMs,true,privateRoot,
       globalVersionRoot,allocatedVersion);
   }
   const exactProof=replay as {version:number;count:number;deadlineAtMs?:number}|null;
   if(exactProof)return {accepted:true,reason:'DUPLICATE_CONFIRMED',...exactProof};
   return {accepted:false,reason,
     ...(reason==='PRIOR_WINDOW_NEEDS_SEAL'&&expiredWindowId?{expiredWindowId}:{})};
 }
 const state=outcome.snapshot.val() as Pending416;
 if(reason==='PRIOR_WINDOW_NEEDS_SEAL')
   return {accepted:false,reason,
     ...(expiredWindowId?{expiredWindowId}:{})};
 if(reason!=='ACCEPTED')
   throw Error('416_SERVER_PRIVATE_NOOP_REASON_MISMATCH:'+reason);
 if(!state?.window||state.version!==state.window.revision)
   throw Error('416_SERVER_PRIVATE_CLICK_PROOF_MISSING');
 return {accepted:true,reason:'ACCEPTED',
   version:state.version,count:Object.keys(state.pending||{}).length,
   deadlineAtMs:state.window.lastClickAtMs+state.window.minutes*60_000};
}

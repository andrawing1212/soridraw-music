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
  deviceSequence:number;operationId:string;trackId:string;liked:boolean;version:number;privateRoot:string;
}>;reservation?:{
  deviceId:string;deviceSequence:number;operationId:string;trackId:string;liked:boolean;
  version:number;privateRoot:string;
}};
type GlobalReservationDecision416={accepted:boolean;reason:string;version?:number;
  committedDuplicate?:boolean};

const sameGlobalOperation416=(value:{deviceId?:string;deviceSequence:number;operationId:string;
 trackId:string;liked:boolean;privateRoot:string},click:ServerPrivateLikeClick416,
 privateRoot:string)=>value.deviceId===undefined||value.deviceId===click.deviceId
  ?value.deviceSequence===click.deviceSequence&&value.operationId===click.operationId&&
    value.trackId===click.trackId&&value.liked===click.liked&&value.privateRoot===privateRoot
  :false;

// This is the only cross-environment Stage416 state. It is a bounded per-UID
// sequencer, not canonical like membership: PREVIEW/TEST/PRODUCTION still keep
// their windows, tasks and receipts isolated. Using server receive time as the
// floor makes the first allocation compatible with legacy PREVIEW users whose
// private root may already be at v39+ without a migration or bootstrap read.
async function allocateGlobalVersion416(database:Database,uid:string,
 click:ServerPrivateLikeClick416,receivedAtMs:number,globalVersionRoot:string,
 privateRoot:string):Promise<GlobalReservationDecision416> {
 let decision:GlobalReservationDecision416={accepted:false,reason:'UNDETERMINED'};
 const result=await database.ref(globalVersionRoot+'/'+uid).transaction((raw:unknown)=>{
  const unchanged=raw===undefined?null:raw;
  decision={accepted:false,reason:'UNDETERMINED'};
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
      prior.privateRoot===privateRoot&&Number.isSafeInteger(prior.version)&&prior.version>0){
    decision={accepted:true,reason:'GLOBAL_COMMITTED_DUPLICATE',version:prior.version,
      committedDuplicate:true};
   }else decision={accepted:false,reason:'STALE_OR_DUPLICATE'};
   return unchanged;
  }
  const reservation=state.reservation;
  if(reservation){
   if(sameGlobalOperation416(reservation,click,privateRoot))
    decision={accepted:true,reason:'GLOBAL_RESERVED_RETRY',version:reservation.version};
   else decision={accepted:false,reason:'GLOBAL_RESERVATION_BUSY'};
   return unchanged;
  }
  if(Object.keys(devices).length>=32&&!Object.prototype.hasOwnProperty.call(devices,click.deviceId)){
   decision={accepted:false,reason:'DEVICE_LIMIT'};return unchanged;
  }
  const next=Math.max(version+1,receivedAtMs);
  if(!Number.isSafeInteger(next)||next<=version)
   throw Error('416_GLOBAL_VERSION_EXHAUSTED');
  decision={accepted:true,reason:'GLOBAL_RESERVED',version:next};
  return {...state,version,devices,reservation:{deviceId:click.deviceId,
   deviceSequence:click.deviceSequence,operationId:click.operationId,
   trackId:click.trackId,liked:click.liked,version:next,privateRoot}};
 },undefined,false);
 if(!result.committed&&decision.reason==='UNDETERMINED')
  throw Error('416_GLOBAL_VERSION_DECISION_MISSING');
 return decision;
}

async function finishGlobalReservation416(database:Database,uid:string,
 click:ServerPrivateLikeClick416,globalVersionRoot:string,privateRoot:string,
 version:number,commit:boolean):Promise<void>{
 let matched=false;
 await database.ref(globalVersionRoot+'/'+uid).transaction((raw:unknown)=>{
  const unchanged=raw===undefined?null:raw;
  const state=(raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{}) as GlobalVersion416;
  const reservation=state.reservation;
  if(!reservation||reservation.version!==version||
     !sameGlobalOperation416(reservation,click,privateRoot))return unchanged;
  matched=true;
  const {reservation:_removed,...rest}=state;
  if(!commit)return rest;
  return {...rest,version,devices:{...(state.devices||{}),[click.deviceId]:{
   deviceSequence:click.deviceSequence,operationId:click.operationId,
   trackId:click.trackId,liked:click.liked,version,privateRoot,
  }}};
 },undefined,false);
 if(!matched)throw Error('416_GLOBAL_RESERVATION_PROOF_MISSING');
}
export async function recordUserPrivateClick416(
  database:Database,uid:string,click:ServerPrivateLikeClick416,
  trustedMinutes:number,receivedAtMs=Date.now(),
  authoritativeRetry=false,privateRoot='privateLikeBatch416',
  globalVersionRoot?:string,allocatedVersion?:number,globalCommittedDuplicate=false,
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
  const allocation=await allocateGlobalVersion416(
   database,uid,click,receivedAtMs,globalVersionRoot,privateRoot);
  if(!allocation.accepted||allocation.version===undefined)return allocation;
  // A global receipt proves only that a version was reserved. The first
  // environment-root attempt can still have returned PRIOR_WINDOW_NEEDS_SEAL
  // (or crashed) before registering the click. Always replay the reserved
  // version through the environment transaction; only that transaction may
  // report DUPLICATE_CONFIRMED.
  allocatedVersion=allocation.version;
  globalCommittedDuplicate=allocation.committedDuplicate===true;
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
     }else if(globalCommittedDuplicate&&click.deviceSequence===previousDeviceSeq&&
        allocatedVersion!==undefined&&version>=allocatedVersion){
       // Settling may already have removed pending/sealed operation details.
       // The bounded global receipt supplies exact operation identity, while
       // this environment high-water mark proves that its registration ran.
       reason='DUPLICATE_CONFIRMED';
       replay={version:allocatedVersion,count:Object.keys(pending).length,
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
   // Keep the existing W0 behavior for duplicate/limit aborts. The expired
   // prior-window branch above no longer aborts, so it reaches RTDB's own
   // server conflict reconciliation instead of relying on get() to warm cache.
   if(!authoritativeRetry){
     await privateRef.get();
     return recordUserPrivateClick416(
       database,uid,click,trustedMinutes,receivedAtMs,true,privateRoot,
       globalVersionRoot,allocatedVersion,globalCommittedDuplicate);
   }
   const exactProof=replay as {version:number;count:number;deadlineAtMs?:number}|null;
   if(exactProof){
     if(globalVersionRoot&&allocatedVersion!==undefined&&!globalCommittedDuplicate)
       await finishGlobalReservation416(database,uid,click,globalVersionRoot,
         privateRoot,allocatedVersion,true);
     return {accepted:true,reason:'DUPLICATE_CONFIRMED',...exactProof};
   }
   if(globalVersionRoot&&allocatedVersion!==undefined&&!globalCommittedDuplicate&&
      reason!=='PRIOR_WINDOW_NEEDS_SEAL')
     await finishGlobalReservation416(database,uid,click,globalVersionRoot,
       privateRoot,allocatedVersion,false);
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
 if(globalVersionRoot&&allocatedVersion!==undefined&&!globalCommittedDuplicate)
   await finishGlobalReservation416(database,uid,click,globalVersionRoot,
     privateRoot,allocatedVersion,true);
 return {accepted:true,reason:'ACCEPTED',
   version:state.version,count:Object.keys(state.pending||{}).length,
   deadlineAtMs:state.window.lastClickAtMs+state.window.minutes*60_000};
}

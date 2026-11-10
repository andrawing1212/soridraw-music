// APP539 source-only: an epoch-aware HTTPS relay boundary for the APP532
// durable Worker drain. NOT imported by preview-entry or any active Worker.
// Local loopback HTTP is permitted strictly for the isolated emulator harness.
import {signOwnerFollowPayload529} from "./owner-follow-outbox-529.mjs";
import {isOwnerFollowAuthEpoch532} from "./owner-follow-auth-epoch-532.mjs";

export const APP539_WORKER_HTTP_BRIDGE_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const HTTP_LOCAL=/^http:\/\/(?:127\.0\.0\.1|localhost):[1-9][0-9]{1,4}\/owner-follow-539$/;
const HTTP_RELEASE='https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542';
export async function sendOwnerFollowHttp539(event,{
 endpoint,secret,send=fetch,now=Date.now,
 isolatedOnly=false,
}={}){
 const target=String(endpoint||"");
 if(isolatedOnly?!HTTP_LOCAL.test(target):target!==HTTP_RELEASE)
  throw Error("APP539_ENDPOINT_NOT_PINNED");
 if(!event||!UID.test(String(event.ownerUid||""))||
   !isOwnerFollowAuthEpoch532(event.authEpoch)||
   !Number.isSafeInteger(event.version)||event.version<=0||
   !Number.isSafeInteger(event.followerCount)||event.followerCount<0||
   event.followerCount>1000000000||
   !Number.isSafeInteger(event.updatedAt)||event.updatedAt<=0)
  throw Error("APP539_INVALID_DURABLE_EVENT");
 const at=now();
 if(!Number.isSafeInteger(at)||at<=0)throw Error("APP539_INVALID_CLOCK");
 const rawBody=JSON.stringify({
  version:1,ownerUid:event.ownerUid,authEpoch:event.authEpoch,
  revision:event.version,followerCount:event.followerCount,
  updatedAt:event.updatedAt,at,
 });
 const signature=await signOwnerFollowPayload529(rawBody,at,secret);
 const response=await send(endpoint,{method:"POST",headers:{
  "Content-Type":"application/json",
  "X-Soridraw-Follow-Relay529-At":String(at),
  "X-Soridraw-Follow-Relay529-Signature":signature,
 },body:rawBody});
 const payload=await response?.json?.().catch(()=>null);
 // Canonical ACK is true for an idempotent duplicate (HTTP 200).
 // Actual RTDB application is separately reported as applied:false.
 return {ok:response?.ok===true,status:response?.status||0,
  applied:response?.ok===true&&payload?.applied===true};
}

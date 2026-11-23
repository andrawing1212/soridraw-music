// APP787 — real HMAC transport for APP755's owner-DO alarm. Default OFF.
// Uses existing APP539/APP542 wire contract; no credentials in source.
// Not imported by active PROD. No retry in this callback: APP759 owns
// bounded durable replay, and 403/503 are NEVER treated as delivered.
export const APP787_PRODUCTION_SIGNED_RELAY_COMPILED_OPEN=false;
const ENDPOINT='https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower542';
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const EPOCH=/^[a-f0-9]{32}$/;
const positive=n=>Number.isSafeInteger(n)&&n>0;
const fail=why=>{throw Error('APP787_SIGNED_OWNER_RELAY_HOLD_'+why)};
export function createApp787ProductionSignedRelay({
 enabled=APP787_PRODUCTION_SIGNED_RELAY_COMPILED_OPEN,
 scope,send=fetch,now=Date.now,subtle=globalThis.crypto?.subtle,
}={}){
 if(enabled!==true)return null;
 if(scope!=='APP787_VERIFIED_OWNER_ALARM_ONLY'||typeof send!=='function'||
    typeof now!=='function'||!subtle||typeof subtle.importKey!=='function'||
    typeof subtle.sign!=='function')
  fail('VERIFIED_OWNER_ALARM_SCOPE_OR_CRYPTO_MISSING');
 return async function sendSignedOwnerRelay(event,{endpoint,secret}={}){
  if(endpoint!==ENDPOINT||typeof secret!=='string'||
     secret.length<32||secret.length>1024)
   fail('PRODUCTION_ENDPOINT_OR_SECRET_UNVERIFIED');
  if(!event||typeof event!=='object'||
     !UID.test(event.ownerUid||'')||!EPOCH.test(event.authEpoch||'')||
     !positive(event.version)||!positive(event.updatedAt)||
     !Number.isSafeInteger(event.followerCount)||
     event.followerCount<0||event.followerCount>1_000_000_000)
   fail('SETTLED_OWNER_EVENT_INVALID');
  const at=now();
  if(!Number.isSafeInteger(at)||at<1_000_000_000_000||
     at>9_999_999_999_999)
   fail('CLOCK_OUTSIDE_RECEIVER_TIMESTAMP_CONTRACT');
  // EXACT APP542 receiver fields, types and HMAC(at+'.'+raw UTF-8 body).
  const body=JSON.stringify({
   version:1,ownerUid:event.ownerUid,authEpoch:event.authEpoch,
   revision:event.version,followerCount:event.followerCount,
   updatedAt:event.updatedAt,at,
  });
  const bytes=new TextEncoder().encode(body);
  if(bytes.length<50||bytes.length>512)
   fail('RECEIVER_BODY_BYTE_BOUND');
  const key=await subtle.importKey('raw',new TextEncoder().encode(secret),
   {name:'HMAC',hash:'SHA-256'},false,['sign']);
  const mac=new Uint8Array(await subtle.sign('HMAC',key,
   new TextEncoder().encode(String(at)+'.'+body)));
  const signature=Array.from(mac,x=>x.toString(16).padStart(2,'0')).join('');
  if(signature.length!==64)fail('SIGNATURE_LENGTH_INVALID');
  let response;
  try{
   response=await send(endpoint,{
    method:'POST',redirect:'manual',
    headers:{'Content-Type':'application/json',
      'Cache-Control':'no-store',
      'X-Soridraw-Follow-Relay529-At':String(at),
      'X-Soridraw-Follow-Relay529-Signature':signature},
    body,signal:AbortSignal.timeout(12_000),
   });
  }catch{return {ok:false,status:503}}
  if(response?.status===409)return {ok:false,status:409};
  if(response?.status!==200||response?.ok!==true)
   return {ok:false,status:Number.isInteger(response?.status)?response.status:503};
  let receipt;
  try{receipt=await response.json()}catch{return {ok:false,status:503}}
  if(receipt?.ok!==true||typeof receipt.applied!=='boolean')
   return {ok:false,status:503};
  // 'applied:false' means previously applied same/higher revision. APP542
  // has verified owner epoch and monotonic RTDB marker on either 200.
  return {ok:true,status:200,applied:receipt.applied};
 };
}

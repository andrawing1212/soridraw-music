// APP533: isolated Firebase Auth + RTDB experiment for APP532.
// NOT imported from functions/src/index.ts, securedIndex, or any live Worker.
// No Firebase SDK initialization or network work at module import time.
import {randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
const EPOCH=/^[0-9a-f]{32}$/;
const UID=/^[a-zA-Z0-9_-]{1,128}$/;
export const APP533_EMULATOR_ONLY=true;
export const MARKER_PATH_533='ownerFollowerSync532';
export const CLAIM_533='soridrawFollowEpoch532';
const valid=e=>typeof e==='string'&&EPOCH.test(e);
const isMissing=e=>e?.code==='auth/user-not-found';
const date=u=>Date.parse(u?.metadata?.creationTime||'');
const safeUid=u=>{if(!UID.test(u||''))throw Error('533_INVALID_UID');return u;};
const sameIncarnation=(user,ev)=>user?.uid===ev.ownerUid&&
 user?.customClaims?.[CLAIM_533]===ev.authEpoch&&
 Number.isSafeInteger(date(user))&&date(user)>0;
export async function enrollAuthIncarnation533(auth,uid,{newEpoch=()=>randomBytes(16).toString('hex')}={}){
 safeUid(uid);
 const before=await auth.getUser(uid);
 const claims=before.customClaims||{};
 if(Object.prototype.hasOwnProperty.call(claims,CLAIM_533)){
  if(!valid(claims[CLAIM_533]))throw Error('533_INVALID_EXISTING_CLAIM');
  return {uid,authEpoch:claims[CLAIM_533],createdAtMs:date(before),reused:true};
 }
 const epoch=newEpoch();
 if(!valid(epoch))throw Error('533_INVALID_NEW_EPOCH');
 const createdAtMs=date(before);
 if(!Number.isSafeInteger(createdAtMs)||createdAtMs<=0)throw Error('533_AUTH_CREATION_MISSING');
 // Admin SDK replaces ALL claims: preserve unrelated claims. Provisioning is
 // one authorized single-writer operation, NOT an idempotent concurrent CAS.
 await auth.setCustomUserClaims(uid,{...claims,[CLAIM_533]:epoch});
 const verified=await auth.getUser(uid);
 if(!sameIncarnation(verified,{ownerUid:uid,authEpoch:epoch})||
    date(verified)!==createdAtMs)throw Error('533_AUTH_PROVISION_RACE_FAIL_CLOSED');
 return {uid,authEpoch:epoch,createdAtMs,reused:false};
}
// Strict signed receipt: no unauthenticated client-chosen generation.
export function signReceiptForEmulator533(body,at,secret){
 return createHmac('sha256',secret).update(String(at)+'.'+body).digest('hex');
}
export function parseSignedReceipt533(body,at,signature,secret,now=Date.now()){
 if(typeof body!=='string'||body.length<50||body.length>512||
    typeof secret!=='string'||secret.length<32||
    !/^\d{13}$/.test(String(at))||!(/^[0-9a-f]{64}$/).test(signature||'')||
    Math.abs(now-Number(at))>60000)return null;
 const expected=Buffer.from(signReceiptForEmulator533(body,at,secret),'hex');
 if(!timingSafeEqual(expected,Buffer.from(signature,'hex')))return null;
 let value;
 try{value=JSON.parse(body);}catch{return null;}
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 if(Object.keys(value).sort().join(',')!==
   'at,authEpoch,followerCount,ownerUid,revision,updatedAt,version')return null;
 if(value.version!==1||!UID.test(value.ownerUid||'')||!valid(value.authEpoch)||
    !Number.isSafeInteger(value.revision)||value.revision<=0||
    !Number.isSafeInteger(value.followerCount)||value.followerCount<0||
    value.followerCount>1000000000||
    !Number.isSafeInteger(value.updatedAt)||value.updatedAt<=0||
    value.at!==Number(at))return null;
 return {ownerUid:value.ownerUid,authEpoch:value.authEpoch,
  version:value.revision,followerCount:value.followerCount,updatedAt:value.updatedAt};
}
const checkAuth=async(auth,event)=>{
 let current;
 try{current=await auth.getUser(event.ownerUid);}
 catch(e){if(isMissing(e))return {ok:false,reason:'deleted'};throw e;}
 if(!sameIncarnation(current,event))return {ok:false,reason:'epoch-mismatch'};
 return {ok:true,createdAtMs:date(current)};
};
// RTDB generation fence uses real Firebase Auth creation time as a *second*
// monotonic discriminator. Unlike random epochs, creation time can order
// old/new generations; same-millisecond different epochs fail closed.
export function nextOwnerFollowerMarker533(current,event,createdAtMs,now){
 if(!valid(event?.authEpoch)||!Number.isSafeInteger(createdAtMs)||createdAtMs<=0)
  throw Error('533_UNVERIFIED_GENERATION');
 const oldTime=Number(current?.authCreatedAtMs||0);
 const oldEpoch=current?.authEpoch||'';
 if(oldTime>createdAtMs)return undefined;
 if(oldTime===createdAtMs&&oldEpoch!==''&&oldEpoch!==event.authEpoch)
  return undefined;
 if(oldTime===createdAtMs&&oldEpoch===event.authEpoch&&
    Number(current?.version||0)>=event.version)return undefined;
 return {ownerUid:event.ownerUid,authEpoch:event.authEpoch,
  authCreatedAtMs:createdAtMs,version:event.version,
  followerCount:event.followerCount,
  receiptId:event.authEpoch+':'+event.version,at:now};
}
// Delayed Auth verification is deliberately injected by the test harness to
// exercise both sides of the non-atomic Auth <-> RTDB boundary.
// A second Auth read and generation-CAS cleanup compensate an in-flight
// deletion; client rules/epoch still fail closed for any remaining race.
// Realtime Database JS transaction() can start with a cold NULL local cache.
// Returning undefined on that first callback would ABORT *before* fetching
// the actual server value. Get the server snapshot first, and use a NULL
// initial probe only to let the server's hash/CAS resolve the true value.
async function deleteMarkerIfGeneration533(marker,matches){
 const initial=(await marker.get()).val();
 if(!matches(initial))return {removed:false,reason:initial?'different-generation':'absent'};
 const tx=await marker.transaction(current=>{
  if(current===null)return null;
  return matches(current)?null:undefined;
 },undefined,false);
 return {removed:tx.committed};
}
export async function deliverOwnerFollower533({
 auth,database,rawBody,at,signature,secret,
 beforeTransaction=async()=>{},afterTransaction=async()=>{},now=Date.now,
}){
 const event=parseSignedReceipt533(rawBody,at,signature,secret,now());
 if(!event)return {accepted:false,reason:'invalid'};
 const first=await checkAuth(auth,event);
 if(!first.ok)return {accepted:false,reason:first.reason};
 await beforeTransaction();
 const marker=database.ref(MARKER_PATH_533+'/'+event.ownerUid);
 const result=await marker.transaction(current=>
  nextOwnerFollowerMarker533(current,event,first.createdAtMs,now()),
 undefined,false);
 await afterTransaction();
 const last=await checkAuth(auth,event);
 if(!last.ok||last.createdAtMs!==first.createdAtMs){
  if(result.committed){
   await deleteMarkerIfGeneration533(marker,current=>
    current?.authEpoch===event.authEpoch&&
    current?.authCreatedAtMs===first.createdAtMs&&
    current?.version===event.version);
  }
  return {accepted:false,reason:'stale-during-delivery',stale:last.reason};
 }
 return {accepted:true,applied:result.committed,authEpoch:event.authEpoch};
}
// Auth-only deletion cleanup is separate from existing Firestore-content
// retention policy; it may remove ONLY this isolated test marker's generation.
export async function clearRetiredGeneration533({auth,database,uid,authEpoch}){
 safeUid(uid);if(!valid(authEpoch))throw Error('533_INVALID_RETIRE_EPOCH');
 let current=null;
 try{current=await auth.getUser(uid);}
 catch(e){if(!isMissing(e))throw e;}
 if(current?.customClaims?.[CLAIM_533]===authEpoch)
  return {removed:false,reason:'still-active'};
 const marker=database.ref(MARKER_PATH_533+'/'+uid);
 return deleteMarkerIfGeneration533(marker,value=>value?.authEpoch===authEpoch);
}
export const readMarkerForClaim533=(marker,uid,claimedEpoch)=>
 marker?.ownerUid===uid&&valid(claimedEpoch)&&marker?.authEpoch===claimedEpoch?
 marker:null;

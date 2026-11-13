// APP544: Firebase Admin is the ONLY issuer of enrolled owner epochs.
// APP572 exported for candidate build only; compiled OFF and not deployed.
// Controlled enrollment is an explicit mutation, never a page-entry write.
import {createHmac,createHash} from 'node:crypto';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import {getAuth,type Auth} from 'firebase-admin/auth';
import {getFirestore,type Firestore} from 'firebase-admin/firestore';
import {
 enrollOwnerFollowEpoch534,readOwnerFollowLifecycleState534,
} from './ownerFollowLifecycle534';
export const APP544_ENROLLMENT_COMPILED_OPEN=true;
const APP608_CANARY_SHA256='8b9cd603dc722a89765da05bfee9100b2645ecff290bf1f35ff4f0a1bf80fc2f';
const KEY=defineSecret('SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544');
const ENDPOINT='https://soridraw-explore-preview.andrawing1212.workers.dev/internal/owner-follow/epoch-544';
const UID=/^[A-Za-z0-9_-]{1,128}$/,EPOCH=/^[0-9a-f]{32}$/;
type Event544={uid:string;authEpoch:string;authCreatedAtMs:number;action:'bind'|'revoke'};
type Auth544=Pick<Auth,'getUser'|'setCustomUserClaims'>;
type Args544={firestore:Firestore;auth:Auth544;uid:string;secret:string;now?:()=>number;
 send?:typeof fetch;enroll?:typeof enrollOwnerFollowEpoch534};
const birth=(x:{metadata:{creationTime?:string}})=>
 Date.parse(String(x.metadata?.creationTime||''));
export async function sendOwnerEpochBinding544({
 event,secret,now=Date.now,send=fetch,endpoint=ENDPOINT,
}:{event:Event544;secret:string;now?:()=>number;send?:typeof fetch;endpoint?:string}){
 if(endpoint!==ENDPOINT)throw Error('544_ENDPOINT_NOT_PINNED');
 const at=now();
 if(!UID.test(event.uid)||!EPOCH.test(event.authEpoch)||
   !Number.isSafeInteger(event.authCreatedAtMs)||event.authCreatedAtMs<=0||
   !Number.isSafeInteger(at)||at<=0||
   typeof secret!=='string'||secret.length<32)throw Error('544_INVALID_SERVER_PROOF');
 const body=JSON.stringify({...event,at});
 const sig=createHmac('sha256',secret).update(at+'.'+body).digest('hex');
 const result=await send(endpoint,{method:'POST',headers:{
  'Content-Type':'application/json','X-Soridraw-Owner-Epoch-At':String(at),
  'X-Soridraw-Owner-Epoch-Signature':sig},body});
 if(!result.ok)throw Error('544_D1_BIND_HOLD_'+result.status);
 return true;
}
export async function enrollAndBindOwner544({
 firestore,auth,uid,secret,now=Date.now,send=fetch,
 enroll=enrollOwnerFollowEpoch534,
}:Args544){
 if(!UID.test(uid))throw Error('544_INVALID_UID');
 const verified=await enroll({firestore,auth,uid});
 if(verified.uid!==uid||!EPOCH.test(verified.authEpoch)||
    !Number.isSafeInteger(verified.createdAtMs)||verified.createdAtMs<=0)
  throw Error('544_UNVERIFIED_ENROLLMENT');
 const principal=await auth.getUser(uid);
 if(principal.uid!==uid||birth(principal)!==verified.createdAtMs||
    principal.customClaims?.soridrawFollowEpoch532!==verified.authEpoch)
  throw Error('544_AUTH_GENERATION_CHANGED');
 const snapshot=await firestore.collection('users').doc(uid).get();
 const lifecycle=readOwnerFollowLifecycleState534(snapshot.data());
 if(lifecycle?.phase!=='active'||lifecycle.epoch!==verified.authEpoch||
    lifecycle.createdAtMs!==verified.createdAtMs||
    snapshot.get('authDeleted')===true||
    snapshot.get('accountStatus')==='banned'||
    snapshot.get('authDeletionPendingAt'))
  throw Error('544_ACCOUNT_LIFECYCLE_HOLD');
 await sendOwnerEpochBinding544({event:{uid,authEpoch:verified.authEpoch,
   authCreatedAtMs:verified.createdAtMs,action:'bind'},secret,now,send});
 const after=await auth.getUser(uid);
 const latest=await firestore.collection('users').doc(uid).get();
 const state=readOwnerFollowLifecycleState534(latest.data());
 if(after.uid!==uid||birth(after)!==verified.createdAtMs||
    after.customClaims?.soridrawFollowEpoch532!==verified.authEpoch||
    state?.phase!=='active'||state.epoch!==verified.authEpoch||
    latest.get('authDeleted')===true||latest.get('authDeletionPendingAt'))
  throw Error('544_GENERATION_CHANGED_DURING_BIND_HOLD');
 return {uid,authEpoch:verified.authEpoch,reused:verified.reused};
}
// Call only after verified admin account deletion. A surviving Auth user
// blocks revocation, even if another request has the old signed epoch.
export async function revokeDeletedOwnerBinding544({
 auth,uid,authEpoch,authCreatedAtMs,secret,now=Date.now,send=fetch,
}:{auth:Pick<Auth,'getUser'>;uid:string;authEpoch:string;
 authCreatedAtMs:number;secret:string;now?:()=>number;send?:typeof fetch}){
 try{
  const current=await auth.getUser(uid);
  if(current)throw Error('544_AUTH_USER_EXISTS');
 }catch(e){
  if((e as {code?:string})?.code!=='auth/user-not-found')throw e;
 }
 return sendOwnerEpochBinding544({
  event:{uid,authEpoch,authCreatedAtMs,action:'revoke'},secret,now,send});
}
export const enrollOwnerFollow544Candidate=onCall({
 region:'asia-northeast3',enforceAppCheck:true,secrets:[KEY],
},async request=>{
 if(!APP544_ENROLLMENT_COMPILED_OPEN||process.env.SORIDRAW_OWNER_FOLLOW_READY_608!=='1'||
    createHash('sha256').update(String(process.env.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574||'')).digest('hex')!==APP608_CANARY_SHA256)
  throw new HttpsError('unavailable','OWNER_FOLLOW_OFF');
 if(!request.auth?.uid)throw new HttpsError('unauthenticated','LOGIN_REQUIRED');
 // No implicit enrollment for ordinary logins or another tenant's user.
 if(request.auth.uid!==String(process.env.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574||''))
  throw new HttpsError('permission-denied','OWNER_FOLLOW_CANARY_ONLY');
 return enrollAndBindOwner544({
  firestore:getFirestore(),auth:getAuth(),uid:request.auth.uid,secret:KEY.value(),
 });
});

// APP547: source-only authenticated Firebase Admin Auth incarnation oracle.
// APP572 export candidate only; compiled OFF, no network route live.
// One current Auth + retained Firestore lifecycle check per explicit enrollment
// or deletion request. No background reads, writes, user scans, or polling.
import {createHmac,timingSafeEqual} from 'node:crypto';
import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import {getAuth,type Auth} from 'firebase-admin/auth';
import {getFirestore,type Firestore} from 'firebase-admin/firestore';
import {readOwnerFollowLifecycleState534} from './ownerFollowLifecycle534';
export const APP547_AUTH_PROOF_COMPILED_OPEN=false;
const SECRET=defineSecret('SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544');
const UID=/^[A-Za-z0-9_-]{1,128}$/,EPOCH=/^[0-9a-f]{32}$/,HEX=/^[0-9a-f]{64}$/,NONCE=/^[0-9a-f]{32}$/;
type Action='bind'|'revoke';
type Subject={action:Action;uid:string;authEpoch:string;authCreatedAtMs:number;at:number;nonce:string};
type AuthGetter=Pick<Auth,'getUser'>;
type FirestoreReader=Pick<Firestore,'collection'>;
const response=(status:number,body:string,secret?:string)=>{
 const headers:Record<string,string>={
  'Cache-Control':'private, no-store','Content-Type':'application/json; charset=utf-8',
 };
 if(status===200&&secret){
  headers['X-Soridraw-Owner-Epoch-Proof-Signature']=
   createHmac('sha256',secret).update(body).digest('hex');
 }
 return new Response(body,{status,headers});
};
export async function isCurrentOwnerEpoch547(
 event:Subject,{auth,firestore}:{
 auth:AuthGetter;firestore:FirestoreReader;
 }):Promise<boolean>{
 const snapshot=await firestore.collection('users').doc(event.uid).get();
 const lifecycle=readOwnerFollowLifecycleState534(snapshot.data());
 if(!lifecycle)return false;
 const banned=snapshot.get('accountStatus')==='banned';
 const deleted=snapshot.get('authDeleted')===true;
 const deletionPending=Boolean(snapshot.get('authDeletionPendingAt'));
 let current;
 try{current=await auth.getUser(event.uid)}
 catch(error){
  if((error as {code?:string}|null)?.code==='auth/user-not-found')current=null;
  else throw error;
 }
 if(event.action==='bind'){
  if(!current||current.disabled||banned||deleted||deletionPending||
     lifecycle.phase!=='active'||lifecycle.epoch!==event.authEpoch||
     lifecycle.createdAtMs!==event.authCreatedAtMs)return false;
  return current.uid===event.uid&&
   Date.parse(String(current.metadata?.creationTime||''))===event.authCreatedAtMs&&
   current.customClaims?.soridrawFollowEpoch532===event.authEpoch;
 }
 // An old-gen revoke never clears a newer D1 generation (CAS on uid/epoch/birth).
 // If same UID was recreated before delayed revoke, independently verify that
 // the current Auth incarnation is genuinely NEWER and enrolled. This safely
 // permits release of the exact prior generation after its Auth was deleted.
 if(!current){
  return (lifecycle.phase==='deleting'||lifecycle.phase==='deleted')&&
   lifecycle.epoch===event.authEpoch&&
   lifecycle.createdAtMs===event.authCreatedAtMs;
 }
 const freshBirth=Date.parse(String(current.metadata?.creationTime||''));
 return !banned&&!deleted&&!deletionPending&&lifecycle.phase==='active'&&
  Number.isSafeInteger(freshBirth)&&freshBirth>event.authCreatedAtMs&&
  lifecycle.createdAtMs===freshBirth&&lifecycle.epoch!==event.authEpoch&&
  current.customClaims?.soridrawFollowEpoch532===lifecycle.epoch;
}
export async function handleOwnerAuthProof547(request:Request,{
 auth,firestore,secret,now=Date.now,
}:{
 auth:AuthGetter;firestore:FirestoreReader;secret:string;now?:()=>number;
}):Promise<Response>{
 if(request.method!=='POST')return response(405,'{"ok":false}');
 if(typeof secret!=='string'||secret.length<32)
  return response(503,'{"ok":false}');
 const atText=String(request.headers.get('X-Soridraw-Owner-Epoch-Proof-At')||'');
 const sig=String(request.headers.get('X-Soridraw-Owner-Epoch-Proof-Signature')||'');
 if(!/^\d{13}$/.test(atText)||!HEX.test(sig)||
    Math.abs(now()-Number(atText))>10000)return response(403,'{"ok":false}');
 let raw;
 try{
  const data=await request.arrayBuffer();
  if(data.byteLength<80||data.byteLength>512)
   return response(403,'{"ok":false}');
  raw=Buffer.from(data);
 }catch{return response(403,'{"ok":false}')}
 const expected=createHmac('sha256',secret)
  .update(atText+'.').update(raw).digest();
 const signed=Buffer.from(sig,'hex');
 if(expected.length!==signed.length||!timingSafeEqual(expected,signed))
  return response(403,'{"ok":false}');
 let subject:Subject;
 try{subject=JSON.parse(raw.toString('utf8')) as Subject}
 catch{return response(403,'{"ok":false}')}
 if(!subject||typeof subject!=='object'||Array.isArray(subject)||
    Object.keys(subject).sort().join(',')!==
    'action,at,authCreatedAtMs,authEpoch,nonce,uid'||
    !['bind','revoke'].includes(subject.action)||
    !UID.test(subject.uid)||!EPOCH.test(subject.authEpoch)||
    !NONCE.test(subject.nonce)||
    subject.at!==Number(atText)||
    !Number.isSafeInteger(subject.authCreatedAtMs)||subject.authCreatedAtMs<=0)
  return response(403,'{"ok":false}');
 try{
  if(!(await isCurrentOwnerEpoch547(subject,{auth,firestore})))
   return response(409,'{"ok":false}');
  const body=JSON.stringify({
   action:subject.action,at:now(),
   authCreatedAtMs:subject.authCreatedAtMs,
   authEpoch:subject.authEpoch,nonce:subject.nonce,ok:true,uid:subject.uid,
  });
  return response(200,body,secret);
 }catch{return response(503,'{"ok":false}')}
}
export const verifyOwnerFollowEpoch547Candidate=onRequest({
 region:'asia-northeast3',cors:false,secrets:[SECRET],
 timeoutSeconds:15,maxInstances:3,
},async(req,res)=>{
 if(!APP547_AUTH_PROOF_COMPILED_OPEN){
  res.status(503).json({ok:false});return;
 }
 const result=await handleOwnerAuthProof547(
  new Request('https://owner-proof.internal/verify',{
   method:req.method,headers:req.headers as Record<string,string>,
   body:req.method==='POST'?req.rawBody?.toString('utf8'):undefined,
  }),{auth:getAuth(),firestore:getFirestore(),secret:SECRET.value()});
 res.status(result.status);
 result.headers.forEach((v,k)=>res.set(k,v));
 res.send(await result.text());
});

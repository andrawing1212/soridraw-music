// APP713: narrow, PREVIEW-only, canary-only Firebase Admin actor-state proof.
// No Firestore writes, no RTDB, no user scans, no page-entry calls.
import {createHmac,timingSafeEqual} from 'node:crypto';
import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import {getAuth,type Auth} from 'firebase-admin/auth';
import {getFirestore,type Firestore} from 'firebase-admin/firestore';
export const APP713_ACTOR_PROOF_COMPILED_OPEN=true;
export const APP713_ACTOR_CANARY_UID='rcZ2GZrBndOZzT8C635eiNBjYIJ2';
const SECRET=defineSecret('SORIDRAW_OWNER_FOLLOW_HMAC_539');
const DOMAIN='soridraw:preview:actor-proof:713';
const UID=/^[A-Za-z0-9_-]{1,128}$/,OP=/^[A-Za-z0-9_-]{16,128}$/;
const HEX=/^[a-f0-9]{64}$/,NONCE=/^[a-f0-9]{32}$/;
type Subject={actorUid:string;operationId:string;issuedAtSec:number;at:number;nonce:string};
type AuthReader=Pick<Auth,'getUser'>;
type FirestoreReader=Pick<Firestore,'collection'>;
type Request713={method?:string;rawBody?:Buffer;get(name:string):string|undefined};
type Response713={set(name:string,value:string):unknown;status(code:number):{json(value:unknown):unknown;send(value:string):unknown}};
const derived=(base:string)=>createHmac('sha256',base).update(DOMAIN).digest();
const sign=(key:Buffer,at:number,raw:Buffer)=>createHmac('sha256',key).update(String(at)+'.').update(raw).digest();
export async function isCurrentActor713(
 subject:Subject,{auth,firestore,now=Date.now}:{
 auth:AuthReader;firestore:FirestoreReader;now?:()=>number;
 }):Promise<boolean>{
 if(subject.actorUid!==APP713_ACTOR_CANARY_UID)return false;
 const issuedMs=subject.issuedAtSec*1000;
 const currentMs=now();
 if(!Number.isSafeInteger(issuedMs)||issuedMs<=0||issuedMs>currentMs+60000||
    currentMs-issuedMs>3600000)return false;
 let user;
 try{user=await auth.getUser(subject.actorUid)}
 catch(e){
  if((e as {code?:string}|null)?.code==='auth/user-not-found')return false;
  throw e;
 }
 if(!user||user.uid!==subject.actorUid||user.disabled===true)return false;
 const birth=Date.parse(String(user.metadata?.creationTime||''));
 if(!Number.isSafeInteger(birth)||birth<=0||birth>issuedMs+999)return false;
 const revoked=Date.parse(String(user.tokensValidAfterTime||''));
 if(Number.isFinite(revoked)&&revoked>issuedMs+999)return false;
 const snap=await firestore.collection('users').doc(subject.actorUid).get();
 if(!snap.exists)return false;
 const data=snap.data()||{};
 if(data.authDeleted===true||data.authDeletionPendingAt||
    data.accountStatus==='banned')return false;
 const lifecycle=data.ownerFollowLifecycle534;
 if(lifecycle!==undefined&&
    (!lifecycle||typeof lifecycle!=='object'||
     lifecycle.phase==='deleting'||lifecycle.phase==='deleted'||
     (lifecycle.createdAtMs!==undefined&&lifecycle.createdAtMs!==birth)))
  return false;
 return true;
}
export const createActorProofHttp713=({
 auth,firestore,secret,enabled=false,now=Date.now,
}:{auth:AuthReader;firestore:FirestoreReader;secret:string;
 enabled?:boolean;now?:()=>number;})=>
 async(req:Request713,res:Response713)=>{
  res.set('Cache-Control','private,no-store');
  if(!enabled){res.status(503).json({ok:false});return}
  if(req.method!=='POST'){res.status(405).json({ok:false});return}
  const raw=req.rawBody;
  const atString=String(req.get('X-Soridraw-Actor-713-At')||'');
  const signature=String(req.get('X-Soridraw-Actor-713-Signature')||'');
  if(!Buffer.isBuffer(raw)||raw.length<75||raw.length>512||
     !/^\d{13}$/.test(atString)||!HEX.test(signature)||
     !Number.isSafeInteger(now())||Math.abs(now()-Number(atString))>15000||
     typeof secret!=='string'||secret.length<32){
   res.status(403).json({ok:false});return;
  }
  const key=derived(secret);
  const expected=sign(key,Number(atString),raw);
  const actual=Buffer.from(signature,'hex');
  if(!timingSafeEqual(expected,actual)){
   res.status(403).json({ok:false});return;
  }
  let data:Subject;
  try{data=JSON.parse(raw.toString('utf8')) as Subject}
  catch{res.status(400).json({ok:false});return}
  if(!data||Object.keys(data).sort().join(',')!==
      'actorUid,at,issuedAtSec,nonce,operationId'||
     data.actorUid!==APP713_ACTOR_CANARY_UID||
     !UID.test(data.actorUid)||!OP.test(data.operationId)||
     !NONCE.test(data.nonce)||data.at!==Number(atString)||
     !Number.isSafeInteger(data.issuedAtSec)||data.issuedAtSec<=0){
   res.status(409).json({ok:false});return;
  }
  try{
   if(!(await isCurrentActor713(data,{auth,firestore,now}))){
    res.status(409).json({ok:false});return;
   }
   const body=JSON.stringify({ok:true,actorUid:data.actorUid,
    operationId:data.operationId,issuedAtSec:data.issuedAtSec,
    nonce:data.nonce,at:now()});
   res.set('X-Soridraw-Actor-713-Proof',createHmac('sha256',key).update(body).digest('hex'));
   res.status(200).send(body);
  }catch{res.status(503).json({ok:false});}
 };
export const verifyExploreFollowActor713=onRequest({
 region:'asia-northeast3',cors:false,secrets:[SECRET],
 timeoutSeconds:15,maxInstances:2,
},async(req,res)=>{
 const enabled=APP713_ACTOR_PROOF_COMPILED_OPEN&&
   process.env.SORIDRAW_FOLLOW_ACTOR_PROOF_713==='1'&&
   process.env.SORIDRAW_FOLLOW_ACTOR_SCOPE_713==='preview-only';
 await createActorProofHttp713({
  auth:getAuth(),firestore:getFirestore(),secret:SECRET.value(),enabled,
 })(req,res);
});

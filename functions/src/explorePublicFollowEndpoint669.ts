// APP669 source-only, PREVIEW-fenced receiver for the existing trusted
// owner-follow bridge. No endpoint is exported from index.ts or deployed.
// Accept only domain-separated HMAC from a settled canonical Worker claim.
import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {getDatabase} from 'firebase-admin/database';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {publicFollowAuthGeneration669} from './explorePublicFollowAuthGeneration669';
import type {Auth} from 'firebase-admin/auth';
import type {Firestore} from 'firebase-admin/firestore';
import type {Database} from 'firebase-admin/database';
import {publishPublicFollowPair667} from './explorePublicFollowSignal667';
const UNVERIFIED_GENERATION='0'.repeat(32);
const UID=/^[A-Za-z0-9_-]{1,128}$/;
type MinimalAuth669=Pick<Auth,'getUser'>;
type MinimalFirestore669=Pick<Firestore,'collection'>;
type MinimalDatabase669=Pick<Database,'ref'>;
type Request669={method?:string;rawBody?:Buffer;get(name:string):string|undefined};
type Response669={set(name:string,value:string):unknown;status(code:number):{json(value:unknown):unknown}};
export const APP669_PUBLIC_FOLLOW_ENDPOINT_COMPILED_OPEN=false;
const domain='soridraw:preview:public-follow-669';
export const derivePublicFollowKey669=(baseSecret:string)=>
 createHmac('sha256',baseSecret).update(domain,'utf8').digest('hex');
const verifyCurrentAccount669=async(
 uid:string,auth:MinimalAuth669,firestore:MinimalFirestore669,
):Promise<string|null>=>{
 if(!UID.test(uid))return null;
 const record=await auth.getUser(uid);
 if(record.uid!==uid||record.disabled===true)return null;
 const generation=publicFollowAuthGeneration669(uid,record.metadata?.creationTime||'');
 if(!generation)return null;
 const snapshot=await firestore.collection('users').doc(uid).get();
 if(!snapshot.exists)return null;
 const data=snapshot.data()||{};
 if(data.authDeleted===true||data.authDeletionPendingAt||
    data.accountStatus==='banned')return null;
 const lifecycle=data.ownerFollowLifecycle534;
 if(lifecycle!==undefined && (
    !lifecycle || typeof lifecycle!=='object'||
    lifecycle.phase==='deleting'||lifecycle.phase==='deleted'||
    Date.parse(record.metadata?.creationTime||'')!==lifecycle.createdAtMs
 ))return null;
 return generation;
};
export const createPublicFollowHttp669=({
 auth,firestore,database,secret,enabled=false,now=Date.now,
}:{
 auth:MinimalAuth669;firestore:MinimalFirestore669;database:MinimalDatabase669;
 secret:string;enabled?:boolean;now?:()=>number;
})=>async(req:Request669,res:Response669):Promise<void>=>{
 res.set('Cache-Control','private,no-store');
 if(!enabled){res.status(503).json({ok:false,code:'PREVIEW_PUBLIC_FOLLOW_DISABLED'});return}
 if(req.method!=='POST'){res.status(405).json({ok:false});return}
 const raw=req.rawBody;
 const signedAt=String(req.get('X-Soridraw-Public-Follow-669-At')||'');
 const signature=String(req.get('X-Soridraw-Public-Follow-669-Signature')||'');
 const at=Number(signedAt),clock=now();
 if(!Buffer.isBuffer(raw)||raw.byteLength>2048||raw.byteLength<120||
    !/^\d{13}$/.test(signedAt)||!Number.isSafeInteger(clock)||
    Math.abs(clock-at)>60000||!/^([a-f0-9]{64})$/.test(signature)||
    typeof secret!=='string'||secret.length<32){
  res.status(403).json({ok:false});return;
 }
 // The APP667 publisher independently verifies this envelope too.
 const key=derivePublicFollowKey669(secret);
 const expected=createHmac('sha256',key).update(raw).digest();
 const supplied=Buffer.from(signature,'hex');
 if(!timingSafeEqual(supplied,expected)){
  res.status(403).json({ok:false});return;
 }
 let parsed:any;
 try{parsed=JSON.parse(raw.toString('utf8'))}
 catch{res.status(400).json({ok:false});return}
 if(parsed?.signedAtMs!==at||!parsed.actor||!parsed.target||
    !UID.test(String(parsed.actorUid||''))||
    !UID.test(String(parsed.targetUid||''))||
    parsed.actor?.profileUid!==parsed.actorUid||
    parsed.target?.profileUid!==parsed.targetUid||
    parsed.actor?.generation!==UNVERIFIED_GENERATION||
    parsed.target?.generation!==UNVERIFIED_GENERATION){
  res.status(400).json({ok:false});return;
 }
 try{
  const actor=await verifyCurrentAccount669(parsed.actorUid,auth,firestore);
  const target=await verifyCurrentAccount669(parsed.targetUid,auth,firestore);
  if(!actor||!target){res.status(409).json({ok:false,code:'AUTH_OR_PRIVACY_GENERATION_HOLD'});return}
  // The server, NOT the caller, binds both public rows to actual Auth births.
  const verifiedRaw=JSON.stringify({...parsed,
   actor:{...parsed.actor,generation:actor},
   target:{...parsed.target,generation:target},
  });
  const verifiedSignature=createHmac('sha256',key).update(verifiedRaw).digest('hex');
  const result=await publishPublicFollowPair667(
   database,verifiedRaw,verifiedSignature,key,clock);
  res.status(200).json({ok:true,...result});
 }catch{
  // Never ACK a partial RTDB pair write. Durable owner replay must retry.
  res.status(503).json({ok:false,code:'PUBLIC_FOLLOW_RETRY_REQUIRED'});
 }
};

 
// Exported but disabled until the exact PREVIEW Worker, live RTDB Rule,
// account-deletion revocation and full producer proof are all active.
// This URL never accepts browser-origin follow events or client tokens.
const HMAC669=defineSecret('SORIDRAW_OWNER_FOLLOW_HMAC_539');
export const publishExplorePublicFollow669=onRequest({
 region:'asia-northeast3',secrets:[HMAC669],cors:false,
 timeoutSeconds:15,maxInstances:3,
},async(req,res)=>{
 const enabled=APP669_PUBLIC_FOLLOW_ENDPOINT_COMPILED_OPEN&&
  process.env.SORIDRAW_PUBLIC_FOLLOW_READY_669==='1'&&
  process.env.SORIDRAW_PUBLIC_FOLLOW_SCOPE_669==='preview-only';
 await createPublicFollowHttp669({
  auth:getAuth(),firestore:getFirestore(),database:getDatabase(),
  secret:HMAC669.value(),enabled,
 })(req,res);
});

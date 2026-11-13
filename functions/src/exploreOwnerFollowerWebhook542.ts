// APP542: explicitly exported by APP572, still compiled OFF and NOT deployed.
// A separately approved Functions rollout may register this ONE endpoint
// after dedicated owner-only RTDB Rules, server enrollment, secret and shared
// Worker rollout are verified. No module-import Firebase initialization.
import {createHmac,timingSafeEqual,createHash} from 'node:crypto';
import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import {getAuth,type Auth} from 'firebase-admin/auth';
import {getDatabase,type Database} from 'firebase-admin/database';

export const APP542_OWNER_HTTP_COMPILED_OPEN=false;
const APP608_CANARY_SHA256='8b9cd603dc722a89765da05bfee9100b2645ecff290bf1f35ff4f0a1bf80fc2f';
const HMAC542=defineSecret('SORIDRAW_OWNER_FOLLOW_HMAC_539');
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const EPOCH=/^[0-9a-f]{32}$/;
const HEX=/^[0-9a-f]{64}$/;
type Receipt542={
 ownerUid:string;authEpoch:string;version:number;followerCount:number;
 updatedAt:number;at:number;revision:number;
};
type RelayRequest542={method?:string;rawBody?:Buffer;get(name:string):string|undefined};
type RelayResponse542={
 set(name:string,value:string):unknown;
 status(code:number):{json(value:unknown):unknown};
};
type Dependencies542={
 auth:Pick<Auth,'getUser'>;database:Pick<Database,'ref'>;
 secret:string;now?:()=>number;canaryUid?:string;
};
const valid=(x:unknown):x is Receipt542=>{
 if(!x||typeof x!=='object'||Array.isArray(x))return false;
 const v=x as Record<string,unknown>;
 if(Object.keys(v).sort().join(',')!=='at,authEpoch,followerCount,ownerUid,revision,updatedAt,version')
  return false;
 return v.version===1&&typeof v.ownerUid==='string'&&UID.test(v.ownerUid)&&
  typeof v.authEpoch==='string'&&EPOCH.test(v.authEpoch)&&
  typeof v.revision==='number'&&Number.isSafeInteger(v.revision)&&v.revision>0&&
  typeof v.followerCount==='number'&&Number.isSafeInteger(v.followerCount)&&
  v.followerCount>=0&&v.followerCount<=1_000_000_000&&
  typeof v.updatedAt==='number'&&Number.isSafeInteger(v.updatedAt)&&v.updatedAt>0&&
  typeof v.at==='number'&&Number.isSafeInteger(v.at)&&v.at>0;
};
const verifiedBody=(body:Buffer,at:string,signature:string,secret:string,now:number)=>{
 if(body.length<50||body.length>512||typeof secret!=='string'||secret.length<32||
    !/^\d{13}$/.test(at)||!HEX.test(signature)||Math.abs(now-Number(at))>60_000)
  return null;
 const signed=createHmac('sha256',secret).update(at+'.').update(body).digest();
 const provided=Buffer.from(signature,'hex');
 if(provided.length!==signed.length||!timingSafeEqual(provided,signed))return null;
 try{
  const payload:unknown=JSON.parse(body.toString('utf8'));
  return valid(payload)&&payload.at===Number(at)?payload:null;
 }catch{return null}
};
const errorCode=(error:unknown):string=>
 String((error as {code?:unknown}|null)?.code||'');
const birthOf=(user:Awaited<ReturnType<Auth['getUser']>>)=>
 Date.parse(String(user.metadata?.creationTime||''));
const verifyEpoch=async(auth:Pick<Auth,'getUser'>,receipt:Receipt542)=>{
 try{
  const record=await auth.getUser(receipt.ownerUid);
  const birth=birthOf(record);
  if(record.uid!==receipt.ownerUid||
     record.customClaims?.soridrawFollowEpoch532!==receipt.authEpoch||
     !Number.isSafeInteger(birth)||birth<=0)return null;
  return birth;
 }catch(error){
  if(errorCode(error)==='auth/user-not-found')return null;
  throw error;
 }
};
type Marker542={
 ownerUid:string;authEpoch:string;authCreatedAtMs:number;version:number;
 followerCount:number;receiptId:string;at:number;
};
const nextMarker=(current:Marker542|null,receipt:Receipt542,created:number,at:number)=>{
 const previous=Number(current?.authCreatedAtMs||0);
 if(previous>created)return undefined;
 if(previous===created&&current?.authEpoch&&current.authEpoch!==receipt.authEpoch)
  return undefined;
 if(previous===created&&current?.authEpoch===receipt.authEpoch&&
    Number(current.version||0)>=receipt.revision)return undefined;
 return {ownerUid:receipt.ownerUid,authEpoch:receipt.authEpoch,
  authCreatedAtMs:created,version:receipt.revision,
  followerCount:receipt.followerCount,receiptId:receipt.authEpoch+':'+receipt.revision,at};
};
const sameMarker=(v:Marker542|null,r:Receipt542,created:number)=>
 v?.authEpoch===r.authEpoch&&v?.authCreatedAtMs===created&&
 v?.version===r.revision&&v?.receiptId===r.authEpoch+':'+r.revision;
export const createOwnerFollowerHttp542=({
 auth,database,secret,now=Date.now,canaryUid,
}:Dependencies542)=>async(req:RelayRequest542,res:RelayResponse542):Promise<void>=>{
 res.set('Cache-Control','private,no-store');
 if(req.method!=='POST'){res.status(405).json({ok:false});return}
 const body=req.rawBody;
 const at=String(req.get('X-Soridraw-Follow-Relay529-At')||'');
 const signature=String(req.get('X-Soridraw-Follow-Relay529-Signature')||'');
 const receipt=Buffer.isBuffer(body)?
   verifiedBody(body,at,signature,secret,now()):null;
 if(!receipt){res.status(403).json({ok:false});return}
 // APP574: do not look up Auth or write RTDB for a non-canary owner.
 // Deployed endpoint always supplies canaryUid (empty means hard OFF).
 if(canaryUid!==undefined && receipt.ownerUid!==canaryUid){
  res.status(409).json({ok:false});return;
 }
 try{
  const created=await verifyEpoch(auth,receipt);
  if(created===null){res.status(409).json({ok:false});return}
  const marker=database.ref('ownerFollowerSync532/'+receipt.ownerUid);
  const stored=await marker.transaction(current=>
    nextMarker(current as Marker542|null,receipt,created,now()),undefined,false);
  // Auth deletion and receipt apply cannot form one cross-service transaction.
  // Verify again. If Auth changed, remove only the just-written exact event,
  // never a newer event or a different Auth generation.
  const afterward=await verifyEpoch(auth,receipt);
  if(afterward!==created){
   if(stored.committed){
    const current=(await marker.get()).val() as Marker542|null;
    if(sameMarker(current,receipt,created)){
     await marker.transaction(v=>{
      if(v===null)return null; // cold Firebase transaction probe
      return sameMarker(v as Marker542|null,receipt,created)?null:undefined;
     },undefined,false);
    }
   }
   res.status(409).json({ok:false});return;
  }
  res.status(200).json({ok:true,applied:stored.committed});
 }catch{
  // Never ACK an uncertain state. Bounded canonical retry owns recovery.
  res.status(503).json({ok:false,error:'OWNER_FOLLOW_RELAY_UNAVAILABLE'});
 }
};
export const publishExploreOwnerFollower542=onRequest({
 region:'asia-northeast3',secrets:[HMAC542],cors:false,
 timeoutSeconds:15,maxInstances:3,
},async(req,res)=>{
 if(!APP542_OWNER_HTTP_COMPILED_OPEN||process.env.SORIDRAW_OWNER_FOLLOW_READY_608!=='1'||
    createHash('sha256').update(String(process.env.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574||'')).digest('hex')!==APP608_CANARY_SHA256){
  res.status(503).json({ok:false,error:'OWNER_FOLLOW_DISABLED'});return;
 }
 await createOwnerFollowerHttp542({
  auth:getAuth(),database:getDatabase(),secret:HMAC542.value(),
  canaryUid:String(process.env.SORIDRAW_OWNER_FOLLOW_CANARY_UID_574||''),
 })(req,res);
});

// APP529: Canonical D1 count outbox -> owner-only RTDB marker.
// Exported SOURCE ONLY. No Functions/Secrets/Rules deployment authorized.
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { createHmac, timingSafeEqual } from 'crypto';

const SECRET_529=defineSecret('SORIDRAW_OWNER_FOLLOW_HMAC_529');
const UID_529=/^[a-zA-Z0-9_-]{1,128}$/;
const HEX_529=/^[0-9a-f]{64}$/;
type Receipt529={version:1;revision:number;ownerUid:string;followerCount:number;updatedAt:number;at:number};
export const parseOwnerFollowReceipt529=(raw:Buffer):Receipt529|null=>{
  if(!raw||raw.length<40||raw.length>512)return null;
  let value:Record<string,unknown>;
  try{value=JSON.parse(raw.toString('utf8'))}catch{return null;}
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  if(Object.keys(value).sort().join(',')!==
     'at,followerCount,ownerUid,revision,updatedAt,version')return null;
  const revision=Number(value.revision),count=Number(value.followerCount);
  const at=Number(value.at),updatedAt=Number(value.updatedAt);
  if(value.version!==1||!UID_529.test(String(value.ownerUid||''))||
     !Number.isSafeInteger(revision)||revision<=0||
     !Number.isSafeInteger(count)||count<0||count>1_000_000_000||
     !Number.isSafeInteger(updatedAt)||updatedAt<=0||
     !Number.isSafeInteger(at)||at<=0)return null;
  return value as Receipt529;
};
export const verifyOwnerFollowRequest529=(
  secret:string,headerAt:string,signature:string,raw:Buffer,now:number,
):boolean=>{
  if(typeof secret!=='string'||secret.length<32||
     !/^\d{13}$/.test(headerAt)||!HEX_529.test(signature)||
     Math.abs(now-Number(headerAt))>60_000)return false;
  const expected=createHmac('sha256',secret).update(headerAt+'.').update(raw).digest();
  const provided=Buffer.from(signature,'hex');
  return provided.length===expected.length&&timingSafeEqual(expected,provided);
};

// Pure replay/ordering gate: a later D1 event cannot be undone by a delayed
// webhook. Cancellation (undefined) is an idempotent successful ACK.
export const nextOwnerFollowerMarker529=(
  current: unknown, receipt: Receipt529, now: number,
) => {
  const version=Number((current as {version?:unknown}|null)?.version||0);
  if(Number.isSafeInteger(version)&&version>=receipt.revision)return undefined;
  return {ownerUid:receipt.ownerUid,version:receipt.revision,
    followerCount:receipt.followerCount,receiptId:String(receipt.revision),at:now};
};

export const publishExploreOwnerFollower529=onRequest({
  region:'asia-northeast3',secrets:[SECRET_529],cors:false,
  timeoutSeconds:15,maxInstances:3,
},async(req,res)=>{
  res.set('Cache-Control','private,no-store');
  if(req.method!=='POST'){res.status(405).json({ok:false});return;}
  const raw=req.rawBody;
  const at=String(req.get('X-Soridraw-Follow-Relay529-At')||'');
  const signature=String(req.get('X-Soridraw-Follow-Relay529-Signature')||'');
  const receipt=raw?parseOwnerFollowReceipt529(raw):null;
  if(!receipt||receipt.at!==Number(at)||
      !verifyOwnerFollowRequest529(SECRET_529.value(),at,signature,raw,Date.now())){
    res.status(403).json({ok:false});return;
  }
  try{
    const owner=admin.database().ref('userSync/'+receipt.ownerUid+'/exploreFollowerOwner529');
    const transaction=await owner.transaction(current=>
      nextOwnerFollowerMarker529(current,receipt,Date.now())
    ,undefined,false);
    // An older/duplicate receipt is a successful no-op (ACK), not a retry.
    res.status(200).json({ok:true,applied:transaction.committed});
  }catch(error){
    console.error('[529] owner delivery unavailable',String((error as Error)?.message||'error'));
    res.status(503).json({ok:false,error:'DELIVERY_UNAVAILABLE'});
  }
});

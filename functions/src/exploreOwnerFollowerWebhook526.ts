// APP526 trusted callback: isolated PREVIEW-only function candidate.
// The Cloudflare Worker verifies the actor and canonical changed edge FIRST;
// a browser cannot sign this request. Never copy an optimistic count to RTDB.
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { createHmac, timingSafeEqual } from 'crypto';

const OWNER_FOLLOW_SECRET_526 = defineSecret('SORIDRAW_OWNER_FOLLOW_HMAC_526');
const UID_526 = /^[A-Za-z0-9_-]{1,128}$/;
const HEX_526 = /^[0-9a-f]{64}$/;
const MAX_SKEW_526 = 60_000;

type OwnerFollowReceipt526 = {
  version:number; at:number; actorUid:string; ownerUid:string;
  receiptId:string; following:boolean; canonicalFollowerCount:number;
};

const parseReceipt526=(raw:Buffer):OwnerFollowReceipt526|null=>{
  if(raw.length<2 || raw.length>1024)return null;
  let value:Record<string,unknown>;
  try{value=JSON.parse(raw.toString('utf8'))}catch{return null}
  if(!value || typeof value!=='object' || Array.isArray(value))return null;
  if(Object.keys(value).sort().join(',')!==
      'actorUid,at,canonicalFollowerCount,following,ownerUid,receiptId,version')return null;
  const at=Number(value.at);
  const count=Number(value.canonicalFollowerCount);
  if(value.version!==1 || !UID_526.test(String(value.actorUid||'')) ||
      !UID_526.test(String(value.ownerUid||'')) ||
      value.actorUid===value.ownerUid || !HEX_526.test(String(value.receiptId||'')) ||
      typeof value.following!=='boolean' ||
      !Number.isSafeInteger(at) || at<=0 ||
      !Number.isSafeInteger(count) || count<0 || count>1_000_000_000)return null;
  return value as OwnerFollowReceipt526;
};

export const verifyOwnerFollowSignature526=(
  secret:string,atHeader:string,raw:Buffer,signature:string,now:number,
)=>{
  if(!secret || secret.length<32 || !/^\d{13}$/.test(atHeader) ||
      !HEX_526.test(signature))return false;
  const at=Number(atHeader);
  if(!Number.isSafeInteger(at) || Math.abs(now-at)>MAX_SKEW_526)return false;
  const expected=createHmac('sha256',secret)
    .update(atHeader+'.').update(raw).digest();
  const provided=Buffer.from(signature,'hex');
  return provided.length===expected.length && timingSafeEqual(provided,expected);
};

export const publishExploreOwnerFollower526 = onRequest({
  region:'asia-northeast3',secrets:[OWNER_FOLLOW_SECRET_526],
  maxInstances:3,timeoutSeconds:15,cors:false,
},async(req,res)=>{
  res.set('Cache-Control','private, no-store');
  if(req.method!=='POST'){res.status(405).json({ok:false});return;}
  const raw=req.rawBody;
  const receipt=raw?parseReceipt526(raw):null;
  const atHeader=String(req.get('X-Soridraw-Follow-Relay526-At')||'');
  const signature=String(req.get('X-Soridraw-Follow-Relay526-Signature')||'');
  if(!receipt || receipt.at!==Number(atHeader) ||
      !verifyOwnerFollowSignature526(
        OWNER_FOLLOW_SECRET_526.value(),atHeader,raw,signature,Date.now())){
    res.status(403).json({ok:false});return;
  }
  try{
    const database=admin.database();
    const actorRef=database.ref('userSync/'+receipt.actorUid+'/exploreFollowerDelivery526');
    const previously=await actorRef.get();
    const old=previously.val() || {};
    if(old.receiptId===receipt.receiptId || Number(old.at||0)>receipt.at){
      res.status(200).json({ok:true,duplicate:true});return;
    }
    const ownerRef=database.ref('userSync/'+receipt.ownerUid+'/exploreFollowerOwner526');
    const transaction=await ownerRef.transaction(current=>{
      if(current?.receiptId===receipt.receiptId)return;
      const version=Math.max(Date.now(),Math.floor(Number(current?.version||0))+1);
      return {ownerUid:receipt.ownerUid,version,at:Date.now(),
        receiptId:receipt.receiptId};
    },undefined,false);
    // A has been notified (or its identical marker already exists) before
    // recording B's idempotency receipt, so a crash cannot discard the event.
    await actorRef.transaction(current=>{
      if(Number(current?.at||0)>receipt.at)return;
      return {receiptId:receipt.receiptId,at:receipt.at,
        ownerUid:receipt.ownerUid,following:receipt.following};
    },undefined,false);
    res.status(200).json({ok:true,delivered:transaction.committed});
  }catch(error){
    console.error('[526] owner signal deferred',String((error as Error)?.message||'error'));
    res.status(503).json({ok:false,error:'DELIVERY_UNAVAILABLE'});
  }
});

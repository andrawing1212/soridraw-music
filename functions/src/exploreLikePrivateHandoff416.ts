import {createHmac} from 'node:crypto';

// Source-only Stage416 service. NEVER expose as an unauthenticated callable.
// The invoking Firebase Function must verify request.auth.uid, App Check,
// read the UID seal via admin RTDB, then load a provisioned Secret Manager key.
// No endpoint or secret is stored in app bundles.
export type PrivateSeal416={
 id:string;version:number;closedAtMs:number;
 rows:Array<{trackId:string;liked:boolean;operationId:string;mutationAt:number;
   deviceId?:string;deviceSequence?:number;version?:number}>;
};
export type PrivateHandoffReceipt416={
 accepted:boolean;duplicate:boolean;queued:boolean;version:number;batchIds:string[];
};
export async function deliverPrivateSealToWorker416(
 uid:string,seal:PrivateSeal416,workerEndpoint:string,secret:string,
 nowMs=Date.now(),http:typeof fetch=fetch,
):Promise<PrivateHandoffReceipt416>{
 if(!uid||uid.length>128||!seal||typeof secret!=='string'||secret.length<32||
    !Number.isSafeInteger(nowMs)||nowMs<=0)throw Error('416_INVALID_HANDOFF_ISSUER');
 const target=new URL(workerEndpoint);
 if(target.protocol!=='https:'||
    !(target.hostname==='preview.soridraw.com'||
      target.hostname==='test.soridraw.com'||
      target.hostname==='soridraw.com'||
      target.hostname.endsWith('.workers.dev'))||
    target.username||target.password||target.search||target.hash||
    target.pathname!=='/v1/internal/private-like-handoff-416')
    throw Error('416_HANDOFF_TARGET_REFUSED');
 const claim={
   uid,windowId:seal.id,version:seal.version,sealedAtMs:seal.closedAtMs,
   signedAtMs:nowMs,rows:seal.rows.map(row=>({
     trackId:row.trackId,liked:row.liked,operationId:row.operationId,
     mutationAt:row.mutationAt,
   })),
 };
 const raw=JSON.stringify(claim);
 const signature=createHmac('sha256',secret).update(raw).digest('hex');
 const response=await http(workerEndpoint,{
   method:'POST',headers:{'Content-Type':'application/json',
     'X-Soridraw-416-Signature':signature},body:raw,
 });
 const payload=await response.json().catch(()=>null) as {
   ok?:boolean;data?:Record<string,unknown>;error?:{code?:string}
 }|null;
 if(!response.ok||payload?.ok!==true||payload?.data?.queued!==true||
    payload?.data?.canonicalD1!=='settled'||
    payload?.data?.canonicalProof!=='atomic-drain-batch-418'||
    payload?.data?.personalLikeSnapshot!=='changed-track-r2'||
    (payload?.data?.finalReceipt!=='PUBLISHED'&&payload?.data?.finalReceipt!=='DUPLICATE')||
    payload?.data?.version!==seal.version||
    !Array.isArray(payload?.data?.batchIds)||
    payload.data.batchIds.length<1||payload.data.batchIds.length>6||
    payload.data.batchIds.some(id=>typeof id!=='string'||!
      /^l069_[0-9]{13}_[0-9a-f]{64}$/.test(id))){
   throw Error('416_WORKER_HANDOFF_NOT_CONFIRMED');
 }
 return {accepted:true,duplicate:payload.data.duplicate===true,
   queued:true,version:seal.version,
   batchIds:payload.data.batchIds as string[]};
}

import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import type {Database} from 'firebase-admin/database';

// Internal signed Worker callback: independently PROVE exact 069 D1 drain AND
// successful personal-R2 publication BEFORE signing this payload.
// Never turn a queued/repair-needed acknowledgement into canonical truth.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const batch=/^l069_[0-9]{13}_[0-9a-f]{64}$/;
const safeUid=(s:unknown)=>typeof s==='string'&&
 /^[A-Za-z0-9_-]{1,128}$/.test(s);
type FinalRow={trackId:string;operationId:string;ownerUid:string;liked:boolean;likeCount:number};
type SignedFinal={uid:string;windowId:string;version:number;
 signedAtMs:number;canonicalD1:string;canonicalProof:string;
 personalLikeSnapshot:string;batchIds:string[];settledBatchIds:string[];
 rows:FinalRow[];changedTrackIds?:string[]};
type PublicRow416={trackId:string;ownerUid:string;at:number};
// Publish ONE atomic public signal per settled window. Older clients still
// see <=50 rows; extra rows are optional server-owned data read by app403+.
// RTDB Admin SDK writes do not require a shared Rules/schema change.
async function notifySettledPublicLikes416(db:Database,data:SignedFinal,nowMs:number){
 const acceptedAt=Math.max(...data.batchIds.map(id=>Number(id.split('_')[1])));
 if(!Number.isSafeInteger(acceptedAt)||acceptedAt<=0||acceptedAt>data.signedAtMs)
   throw Error('416_FINAL_BAD_PUBLIC_BOUNDARY');
 const incoming=data.rows.map(row=>({
   trackId:row.trackId,ownerUid:row.ownerUid,at:acceptedAt,
 }));
 await db.ref('publicSync/exploreLike').transaction((raw:unknown)=>{
   const current=raw as {version?:number;rows?:PublicRow416[]|Record<string,PublicRow416>;
     overflow416?:PublicRow416[]|Record<string,PublicRow416>}|null;
   const retained=new Map<string,PublicRow416>();
   for(const row of [...Object.values(current?.rows||{}),
     ...Object.values(current?.overflow416||{})]){
     if(row&&typeof row.trackId==='string'&&typeof row.ownerUid==='string'&&
       Number.isSafeInteger(row.at)&&row.at>=nowMs-3*60_000)
       retained.set(row.trackId,row);
   }
   const changedIds:string[]=[];
   for(const row of incoming){
     const prior=retained.get(row.trackId);
     if(!prior||prior.at<row.at){
       retained.set(row.trackId,row);
       changedIds.push(row.trackId);
     }
   }
   if(!changedIds.length)return; // an exact retry never re-broadcasts
   // Prioritize the newest window's changed rows in legacy <=50:
   // a single new like must never be buried behind 80 retained equal-time IDs.
   const changedSet=new Set(changedIds);
   const ordered=[...changedIds.map(id=>retained.get(id)!),
     ...[...retained.values()].filter(row=>!changedSet.has(row.trackId))
       .sort((a,b)=>b.at-a.at||a.trackId.localeCompare(b.trackId))
   ].slice(0,256);
   const rows=ordered.slice(0,50),overflow=ordered.slice(50);
   return {version:Math.max(nowMs,Number(current?.version||0)+1),
     at:nowMs,actorUid:data.uid,rows,
     ...(overflow.length?{overflow416:overflow}:{})};
 },undefined,false);
}
export async function publishAuthenticatedPrivateFinal416(
 db:Database, raw:string, signature:string, secret:string,
 nowMs=Date.now(),finalRoot='privateLikeFinal416',deferPublic416=false,
):Promise<{status:'PUBLISHED'|'DUPLICATE'|'STALE';version:number;count:number;
 changedTrackIds:string[]}>{
 if(!raw||raw.length>160_000||typeof secret!=='string'||secret.length<32||
    !/^[0-9a-f]{64}$/i.test(signature||'')||!Number.isSafeInteger(nowMs)||
    nowMs<=0)throw Error('416_FINAL_INVALID_AUTH');
 const actual=createHmac('sha256',secret).update(raw,'utf8').digest();
 const claimed=Buffer.from(signature,'hex');
 if(claimed.length!==actual.length||!timingSafeEqual(claimed,actual))
   throw Error('416_FINAL_BAD_SIGNATURE');
 let data:SignedFinal;
 try{data=JSON.parse(raw) as SignedFinal;}
 catch{throw Error('416_FINAL_BAD_JSON');}
 if(!safeUid(data?.uid)||!uuid.test(data.windowId)||
    !Number.isSafeInteger(data.version)||data.version<=0||
    !Number.isSafeInteger(data.signedAtMs)||
    data.signedAtMs<nowMs-15*60_000||data.signedAtMs>nowMs+30_000||
    data.canonicalD1!=='settled'||data.canonicalProof!=='atomic-drain-batch-418'||
    data.personalLikeSnapshot!=='changed-track-r2'||
    !Array.isArray(data.rows)||data.rows.length<1||data.rows.length>256||
    !Array.isArray(data.batchIds)||data.batchIds.length<1||
    data.batchIds.length>6||!Array.isArray(data.settledBatchIds)||
    data.settledBatchIds.length!==data.batchIds.length||
    data.batchIds.some(id=>typeof id!=='string'||!batch.test(id))||
    data.batchIds.some(id=>Number(id.split('_')[1])<=0||
      Number(id.split('_')[1])>data.signedAtMs)||
    new Set(data.batchIds).size!==data.batchIds.length||
    data.batchIds.some(id=>!data.settledBatchIds.includes(id))||
    new Set(data.settledBatchIds).size!==data.settledBatchIds.length)
    throw Error('416_FINAL_CANONICAL_PROOF_REQUIRED');
 const changedTrackIds=Array.isArray(data.changedTrackIds)?data.changedTrackIds:[];
 if((deferPublic416&&!Array.isArray(data.changedTrackIds))||
    changedTrackIds.length>data.rows.length||
    new Set(changedTrackIds).size!==changedTrackIds.length||
    changedTrackIds.some(id=>typeof id!=='string'||!id||id.length>512))
   throw Error('416_FINAL_BAD_CHANGED_TRACK_IDS');
 const seen=new Set<string>();
 for(const row of data.rows){
   if(!row||typeof row.trackId!=='string'||!row.trackId||
      row.trackId.length>512||!uuid.test(row.operationId)||
      typeof row.ownerUid!=='string'||row.ownerUid.length>128||
      typeof row.liked!=='boolean'||!Number.isSafeInteger(row.likeCount)||
      row.likeCount<0||row.likeCount>1_000_000_000||seen.has(row.trackId))
     throw Error('416_FINAL_BAD_ROW');
   seen.add(row.trackId);
 }
 if(changedTrackIds.some(id=>!seen.has(id)))
   throw Error('416_FINAL_BAD_CHANGED_TRACK_IDS');
 const stable={uid:data.uid,windowId:data.windowId,version:data.version,
   batchIds:data.batchIds,rows:data.rows};
 const digest=createHash('sha256').update(JSON.stringify(stable)).digest('hex');
 let reason:'DUPLICATE'|'STALE'|'CONFLICT'='STALE';
 const result=await db.ref(finalRoot+'/'+data.uid).transaction(
   (rawState:unknown)=>{
     const current=rawState as {version?:number;digest?:string}|null;
     const prev=Number(current?.version||0);
     if(!Number.isSafeInteger(prev)||prev<0)throw Error('416_FINAL_STATE_CORRUPT');
     if(prev>=data.version){
       reason=prev===data.version?
         (current?.digest===digest?'DUPLICATE':'CONFLICT'):'STALE';
       return;
     }
     return {version:data.version,canonicalD1:'settled',
       personalLikeSnapshot:'changed-track-r2',windowId:data.windowId,
       digest,rows:data.rows,issuedAtMs:nowMs};
   },undefined,false,
 );
 if(!result.committed){
   // The RTDB transaction callback supplies this value after the await.
   const outcome=reason as 'DUPLICATE'|'STALE'|'CONFLICT';
   if(outcome==='CONFLICT')throw Error('416_FINAL_SAME_VERSION_CONFLICT');
   if(outcome==='STALE')return {status:outcome,version:data.version,count:data.rows.length,
     changedTrackIds};
 }
 // A failed public transaction must fail the signed callback, keeping the
 // existing Cloud Task/seal retry alive. The private receipt alone is not a
 // delivery checkpoint. Do not touch private intent/instant-sync transport.
 if(!deferPublic416&&result.snapshot.val()?.publicNotified416!==true){
   await notifySettledPublicLikes416(db,data,nowMs);
   await db.ref(finalRoot+'/'+data.uid).transaction((rawState:unknown)=>{
     const current=rawState as {version?:number;digest?:string;publicNotified416?:boolean}|null;
     if(current?.version!==data.version||current.digest!==digest||current.publicNotified416)return;
     return {...current,publicNotified416:true};
   },undefined,false);
 }
 return {status:result.committed?'PUBLISHED':'DUPLICATE',version:data.version,
   count:data.rows.length,changedTrackIds};
}


export async function markPublicWindowRegistered416(
 db:Database,uid:string,version:number,windowId:string,
 finalRoot='privateLikeFinal416',
):Promise<{registered:boolean;unchanged:boolean}>{
 if(!safeUid(uid)||!Number.isSafeInteger(version)||version<=0||!uuid.test(windowId))
   throw Error('416_PUBLIC_CHECKPOINT_INPUT_INVALID');
 let unchanged=false;
 const result=await db.ref(finalRoot+'/'+uid).transaction((rawState:unknown)=>{
   const current=rawState as {version?:number;windowId?:string;
     publicWindowRegistered416?:boolean}|null;
   if(current?.version!==version||current?.windowId!==windowId)
     throw Error('416_PUBLIC_CHECKPOINT_FINAL_MISMATCH');
   if(current.publicWindowRegistered416===true){unchanged=true;return;}
   return {...current,publicWindowRegistered416:true};
 },undefined,false);
 return {registered:true,unchanged:!result.committed||unchanged};
}

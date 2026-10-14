import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import type {Database} from 'firebase-admin/database';

// Stage416 delayed public release publisher.
// Source-only / HARD OFF until exact-SHA audit and coordinated PREVIEW release.
// One bounded marker serializes release retry; the public bus contains changed IDs only.
const UUID416=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNAL_RETENTION_MS_416=3*60_000;
const SIGNAL_MAX_416=256;
const SIGNAL_LEGACY_ROWS_416=50;
const SERVER_ACTOR_416='stage416-public';

type PublicReleaseRow416={trackId:string;ownerUid:string};
type PublicManifest416={schemaVersion:number;windowId:string;deadlineAtMs:number;
 digest:string;count:number;slot:number};
type PublicReleaseClaim416={
 windowId:string;releaseToken:string;deadlineAtMs:number;signedAtMs:number;
 rows:PublicReleaseRow416[];manifest416?:PublicManifest416;
};
type ReleaseMarker416={
 schemaVersion:number;windowId:string;releaseToken:string;deadlineAtMs:number;
 digest:string;status:'PENDING'|'PUBLISHED';updatedAtMs:number;publishedAtMs?:number;
};
type SignalRow416={trackId:string;ownerUid:string;at:number};
type Signal416={version?:number;at?:number;actorUid?:string;
 rows?:SignalRow416[]|Record<string,SignalRow416>;
 overflow416?:SignalRow416[]|Record<string,SignalRow416>;
 settledAfterProjection416?:boolean;manifest416?:PublicManifest416};

const validText=(value:unknown,max:number)=>typeof value==='string'&&
 value.length>0&&value.length<=max;
const values416=<T>(value:T[]|Record<string,T>|undefined):T[]=>
 Array.isArray(value)?value:value&&typeof value==='object'?Object.values(value):[];

const parseClaim416=(raw:string,nowMs:number):PublicReleaseClaim416=>{
 let data:PublicReleaseClaim416;
 try{data=JSON.parse(raw) as PublicReleaseClaim416;}
 catch{throw Error('416_PUBLIC_RELEASE_BAD_JSON');}
 const manifest=data?.manifest416;
 const manifestValid=!manifest||(
    manifest.schemaVersion===1&&manifest.windowId===data.windowId&&
    manifest.deadlineAtMs===data.deadlineAtMs&&
    /^[0-9a-f]{64}$/i.test(String(manifest.digest||''))&&
    Number.isSafeInteger(manifest.count)&&manifest.count>SIGNAL_MAX_416&&
    Number.isSafeInteger(manifest.slot)&&manifest.slot>=0&&manifest.slot<8&&
    Math.floor(data.deadlineAtMs/60_000)%8===manifest.slot);
 if(!UUID416.test(String(data?.windowId||''))||
    data?.releaseToken!=='stage416-public-'+data.windowId||
    !Number.isSafeInteger(data?.deadlineAtMs)||data.deadlineAtMs<=0||
    !Number.isSafeInteger(data?.signedAtMs)||
    data.signedAtMs<nowMs-15*60_000||data.signedAtMs>nowMs+30_000||
    data.deadlineAtMs>data.signedAtMs+30_000||
    !Array.isArray(data?.rows)||data.rows.length<1||data.rows.length>SIGNAL_MAX_416||
    !manifestValid||(manifest&&data.rows.length!==SIGNAL_MAX_416))
   throw Error('416_PUBLIC_RELEASE_BAD_CLAIM');
 const seen=new Set<string>();
 const rows=data.rows.map(row=>{
   const trackId=String(row?.trackId||'').trim();
   const ownerUid=String(row?.ownerUid||'').trim();
   if(!validText(trackId,512)||!validText(ownerUid,128)||seen.has(trackId))
     throw Error('416_PUBLIC_RELEASE_BAD_ROW');
   seen.add(trackId);return {trackId,ownerUid};
 }).sort((a,b)=>a.trackId.localeCompare(b.trackId));
 return {...data,rows,
   ...(manifest?{manifest416:{...manifest,digest:String(manifest.digest).toLowerCase()}}:{})};
};
const totalCount416=(data:PublicReleaseClaim416)=>
 data.manifest416?.count||data.rows.length;

const markerDigest416=(data:PublicReleaseClaim416)=>createHash('sha256')
 .update(JSON.stringify({windowId:data.windowId,releaseToken:data.releaseToken,
   deadlineAtMs:data.deadlineAtMs,rows:data.rows,
   manifest416:data.manifest416||null}),'utf8').digest('hex');

const sameMarker416=(value:unknown,data:PublicReleaseClaim416,digest:string,status?:string)=>{
 const row=value as Partial<ReleaseMarker416>|null;
 return !!row&&row.schemaVersion===1&&row.windowId===data.windowId&&
   row.releaseToken===data.releaseToken&&row.deadlineAtMs===data.deadlineAtMs&&
   row.digest===digest&&(!status||row.status===status);
};

export async function publishPublicLikeRelease416(
 db:Database,raw:string,signature:string,secret:string,nowMs=Date.now(),
 markerRoot='publicLikeRelease416',signalPath='publicSync/exploreLike',
):Promise<{status:'PUBLISHED'|'DUPLICATE'|'STALE';windowId:string;count:number;
 signalChanged:boolean}>{
 if(!raw||raw.length>512_000||typeof secret!=='string'||secret.length<32||
    !/^[0-9a-f]{64}$/i.test(signature||'')||!Number.isSafeInteger(nowMs)||nowMs<=0||
    !markerRoot||!signalPath)
   throw Error('416_PUBLIC_RELEASE_INVALID_AUTH');
 const actual=createHmac('sha256',secret).update(raw,'utf8').digest();
 const claimed=Buffer.from(signature,'hex');
 if(claimed.length!==actual.length||!timingSafeEqual(claimed,actual))
   throw Error('416_PUBLIC_RELEASE_BAD_SIGNATURE');
 const data=parseClaim416(raw,nowMs);
 const digest=markerDigest416(data);
 const markerRef=db.ref(markerRoot);
 const reserved=await markerRef.transaction((rawState:unknown)=>{
   const current=rawState as Partial<ReleaseMarker416>|null;
   if(current){
     const currentDeadline=Number(current.deadlineAtMs||0);
     if(!Number.isSafeInteger(currentDeadline)||currentDeadline<=0||
        (current.status!=='PENDING'&&current.status!=='PUBLISHED'))
       throw Error('416_PUBLIC_RELEASE_MARKER_CORRUPT');
     if(sameMarker416(current,data,digest))return;
     if(current.status==='PENDING'&&currentDeadline<data.deadlineAtMs)
       throw Error('416_PUBLIC_PRIOR_RELEASE_PENDING');
     if(currentDeadline>=data.deadlineAtMs)return;
   }
   const next:ReleaseMarker416={schemaVersion:1,windowId:data.windowId,
     releaseToken:data.releaseToken,deadlineAtMs:data.deadlineAtMs,digest,
     status:'PENDING',updatedAtMs:nowMs};
   return next;
 },undefined,false);
 if(!reserved.committed){
   const current=reserved.snapshot.val();
   if(sameMarker416(current,data,digest,'PUBLISHED'))
     return {status:'DUPLICATE',windowId:data.windowId,count:totalCount416(data),
       signalChanged:false};
   if(sameMarker416(current,data,digest,'PENDING')){
     // Resume an exact release whose RTDB signal or final checkpoint failed.
   }else{
     const currentDeadline=Number(current?.deadlineAtMs||0);
     if(Number.isSafeInteger(currentDeadline)&&currentDeadline>=data.deadlineAtMs)
       return {status:'STALE',windowId:data.windowId,count:totalCount416(data),
         signalChanged:false};
     throw Error('416_PUBLIC_RELEASE_RESERVATION_CONFLICT');
   }
 }

 let signalChanged=false;
 const signalResult=await db.ref(signalPath).transaction((rawState:unknown)=>{
   const current=(rawState||null) as Signal416|null;
   const currentAt=Number(current?.at||0);
   const currentVersion=Number(current?.version||0);
   if(currentAt&&(!Number.isSafeInteger(currentAt)||currentAt>nowMs+60_000)||
      currentVersion&&(!Number.isSafeInteger(currentVersion)||currentVersion<0))
     throw Error('416_PUBLIC_SIGNAL_CORRUPT');
   const cutoff=nowMs-SIGNAL_RETENTION_MS_416;
   const retained=new Map<string,SignalRow416>();
   for(const row of [...values416(current?.rows),...values416(current?.overflow416)]){
     if(!validText(row?.trackId,512)||typeof row?.ownerUid!=='string'||
        row.ownerUid.length>128||!Number.isSafeInteger(row?.at)||row.at<=0)
       continue;
     if(row.at>=cutoff)retained.set(row.trackId,row);
   }
   const changedIds:string[]=[];
   for(const row of data.rows){
     const prior=retained.get(row.trackId);
     if(prior&&prior.at>=data.deadlineAtMs)continue;
     retained.set(row.trackId,{trackId:row.trackId,ownerUid:row.ownerUid,
       at:data.deadlineAtMs});
     changedIds.push(row.trackId);
   }
   const currentManifest=current?.manifest416;
   const manifestChanged=Boolean(data.manifest416)&&(
     currentManifest?.windowId!==data.manifest416?.windowId||
     currentManifest?.digest!==data.manifest416?.digest||
     currentManifest?.count!==data.manifest416?.count);
   if(!changedIds.length&&!manifestChanged)return;
   signalChanged=true;
   const changed=new Set(changedIds);
   const ordered=[
     ...changedIds.map(id=>retained.get(id)!),
     ...[...retained.values()].filter(row=>!changed.has(row.trackId))
       .sort((a,b)=>b.at-a.at||a.trackId.localeCompare(b.trackId)),
   ].slice(0,SIGNAL_MAX_416);
   const rows=ordered.slice(0,SIGNAL_LEGACY_ROWS_416);
   const overflow=ordered.slice(SIGNAL_LEGACY_ROWS_416);
   return {version:Math.max(nowMs,currentVersion+1),at:nowMs,
     actorUid:SERVER_ACTOR_416,rows,settledAfterProjection416:true,
     ...(overflow.length?{overflow416:overflow}:{}),
     ...(data.manifest416?{manifest416:data.manifest416}:{})};
 },undefined,false);
 if(!signalResult.committed)signalChanged=false;

 const completed=await markerRef.transaction((rawState:unknown)=>{
   if(sameMarker416(rawState,data,digest,'PUBLISHED'))return;
   if(!sameMarker416(rawState,data,digest,'PENDING'))
     throw Error('416_PUBLIC_RELEASE_MARKER_LOST');
   return {...(rawState as ReleaseMarker416),status:'PUBLISHED',
     updatedAtMs:nowMs,publishedAtMs:nowMs};
 },undefined,false);
 if(!completed.committed&&!sameMarker416(completed.snapshot.val(),data,digest,'PUBLISHED'))
   throw Error('416_PUBLIC_RELEASE_CHECKPOINT_FAILED');
 return {status:'PUBLISHED',windowId:data.windowId,count:totalCount416(data),signalChanged};
}

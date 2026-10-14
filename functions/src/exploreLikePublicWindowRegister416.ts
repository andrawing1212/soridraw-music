import {createHmac} from 'node:crypto';

const UUID416=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUBLIC_ROUTE_416='/v1/internal/public-like-window-416';

const publicWorkerTarget416=(privateWorkerEndpoint:string)=>{
 const url=new URL(privateWorkerEndpoint);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||
    !url.pathname.endsWith('/v1/internal/private-like-handoff-416'))
  throw Error('416_PUBLIC_REGISTER_TARGET_REFUSED');
 url.pathname=PUBLIC_ROUTE_416;
 return url.toString();
};

export async function deliverPublicLikeWindow416({
 workerEndpoint,secret,eventId,windowCandidateId,eventAtMs,publicMinutes,trackIds,
 signedAtMs=Date.now(),http=fetch,
}:{
 workerEndpoint:string;secret:string;eventId:string;windowCandidateId:string;
 eventAtMs:number;publicMinutes:number;trackIds:string[];signedAtMs?:number;
 http?:typeof fetch;
}):Promise<{registered:boolean;duplicate:boolean;opened:boolean;needsRelease:boolean;
 windowId:string;deadlineAtMs:number;publicMinutes:number;trackCount:number}>{
 if(typeof secret!=='string'||secret.length<32||
    !UUID416.test(eventId)||!UUID416.test(windowCandidateId)||
    !Number.isSafeInteger(eventAtMs)||eventAtMs<=0||
    !Number.isSafeInteger(signedAtMs)||signedAtMs<=0||
    ![1,3,5,10,20].includes(publicMinutes)||
    !Array.isArray(trackIds)||trackIds.length<1||trackIds.length>256||
    new Set(trackIds).size!==trackIds.length||
    trackIds.some(id=>typeof id!=='string'||!id||id.length>512))
  throw Error('416_PUBLIC_REGISTER_INPUT_INVALID');
 const body={eventId,windowCandidateId,eventAtMs,publicMinutes,trackIds,signedAtMs};
 const raw=JSON.stringify(body);
 const signature=createHmac('sha256',secret).update(raw,'utf8').digest('hex');
 const response=await http(publicWorkerTarget416(workerEndpoint),{
   method:'POST',headers:{'Content-Type':'application/json',
     'X-Soridraw-416-Public-Signature':signature},body:raw,
 });
 const payload=await response.json().catch(()=>null);
 if(!response.ok||payload?.ok!==true||payload?.data?.registered!==true)
   throw Error(payload?.error?.code==='416_PUBLIC_WINDOW_DUE'
     ?'416_PUBLIC_WINDOW_DUE':'416_PUBLIC_REGISTER_NOT_CONFIRMED');
 const data=payload.data;
 return {registered:true,duplicate:data.duplicate===true,opened:data.opened===true,
   needsRelease:false,windowId:String(data.windowId||''),
   deadlineAtMs:Number(data.deadlineAtMs||0),publicMinutes:Number(data.publicMinutes||0),
   trackCount:Number(data.trackCount||0)};
}

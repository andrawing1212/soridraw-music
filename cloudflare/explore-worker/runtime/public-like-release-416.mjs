import {materializePublicLikeProjection416}
 from './public-like-projection-416.mjs';
import {clearPublicLikeReleaseStorage416,readPublicLikeReleaseState416,
 savePublicLikeCheckpoint416,markPublicLikePublished416}
 from './public-like-window-416.mjs';
import {preparePublicLikeManifest416}
 from './public-like-manifest-416.mjs';
import {clearReleasedPublicHolds446}
 from './public-like-hold-446.mjs';

// Stage416 delayed public release coordinator.
// Source-only / HARD OFF until the Worker route + Firebase task are audited.
const encoder416=new TextEncoder();
const hex416=bytes=>[...new Uint8Array(bytes)]
 .map(x=>x.toString(16).padStart(2,'0')).join('');
const sign416=async(raw,secret)=>{
 const key=await crypto.subtle.importKey('raw',encoder416.encode(secret),
   {name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex416(await crypto.subtle.sign('HMAC',key,encoder416.encode(raw)));
};
const endpoint416=value=>{
 const url=new URL(String(value||''));
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||
    !(url.hostname.endsWith('.cloudfunctions.net')||url.hostname.endsWith('.run.app')))
   throw Error('416_PUBLIC_RELEASE_TARGET_REFUSED');
 return url.toString();
};

export async function sendPublicLikeRelease416({
 endpoint,secret,claim,http=fetch,
}={}){
 if(typeof secret!=='string'||secret.length<32||!claim)
   throw Error('416_PUBLIC_RELEASE_CALLBACK_BINDING_MISSING');
 const target=endpoint416(endpoint);
 const raw=JSON.stringify(claim);
 const signature=await sign416(raw,secret);
 const response=await http(target,{method:'POST',headers:{
   'Content-Type':'application/json',
   'X-Soridraw-416-Public-Release-Signature':signature,
 },body:raw});
 const payload=await response.json().catch(()=>null);
 const status=String(payload?.data?.status||'');
 if(!response.ok||payload?.ok!==true||
    (status!=='PUBLISHED'&&status!=='DUPLICATE'))
   throw Error('416_PUBLIC_RELEASE_CALLBACK_NOT_CONFIRMED');
 return {status};
}

async function releaseDuePublicLikeWindowInner416({
 db,r2,storage,releaseEndpoint,secret,nowMs=Date.now(),http=fetch,
 materialize=materializePublicLikeProjection416,
 expectedWindowId='',expectedDeadlineAtMs=0,
}={}){
 if(!storage||!db||!r2||!Number.isSafeInteger(nowMs)||nowMs<=0)
   throw Error('416_PUBLIC_RELEASE_INPUT_INVALID');
 const state=await readPublicLikeReleaseState416(storage,nowMs);
 if(!state.exists)return {status:'EMPTY',cleared:false};
 if(expectedWindowId&&(
    String(state.window?.windowId||'')!==String(expectedWindowId)||
    Number(state.window?.deadlineAtMs||0)!==Number(expectedDeadlineAtMs||0)))
   return {status:'STALE_TASK',cleared:false,
     windowId:String(state.window?.windowId||''),
     deadlineAtMs:Number(state.window?.deadlineAtMs||0)};
 if(!state.due)return {status:'NOT_DUE',cleared:false,
   deadlineAtMs:Number(state.window?.deadlineAtMs||0)};
 if(state.blockedUnacked)throw Error('416_PUBLIC_RELEASE_REGISTRATION_PENDING');
 let checkpoint=state.checkpoint;
 let projection={d1ReadQueries:0,d1Writes:0,r2Reads:0,r2Writes:0,missingIds:[]};
 let manifestReads=0,manifestWrites=0;
 if(!checkpoint){
   if(!Array.isArray(state.trackIds)||!state.trackIds.length)
     throw Error('416_PUBLIC_RELEASE_NO_TRACKS');
   // Stage446: the independently configured PUBLIC deadline is now due and
   // every private-final registration is ACKed. Remove ONLY journal entries
   // accepted by this deadline before any canonical public R2 projection.
   // A transient R2 failure will retry after the deadline with ordinary
   // 075/191 repairing the same visible canonical value; never drop future
   // windows on the same track.
   await clearReleasedPublicHolds446(db,state.trackIds,state.window.deadlineAtMs);
   const projectionResult=await materialize({db,r2,trackIds:state.trackIds});
   projection=projectionResult;
   const rows=Array.isArray(projection?.releaseRows)?projection.releaseRows:[];
   let claim=null;
   if(rows.length){
     const prepared=await preparePublicLikeManifest416(
       r2,rows,String(state.window.windowId),Number(state.window.deadlineAtMs));
     manifestReads=Number(prepared?.r2Reads||0);
     manifestWrites=Number(prepared?.r2Writes||0);
     claim={windowId:String(state.window.windowId),
       releaseToken:String(state.releaseToken),
       deadlineAtMs:Number(state.window.deadlineAtMs),
       rows:prepared.inlineRows,
       ...(prepared.manifest416?{manifest416:prepared.manifest416}:{})};
   }
   checkpoint={windowId:String(state.window.windowId),claim,
     trackCount:state.trackIds.length,publicTrackCount:rows.length,published:false};
   // Durable exact identity BEFORE callback. A response lost after PUBLISHED
   // reuses this claim without re-reading D1 or rebuilding the R2 manifest.
   await savePublicLikeCheckpoint416(storage,checkpoint);
 }
 let receiptStatus=checkpoint.claim?'DUPLICATE':'NO_PUBLIC_TRACKS';
 if(!checkpoint.published){
   if(checkpoint.claim){
     const delivered=await sendPublicLikeRelease416({endpoint:releaseEndpoint,secret,
       claim:{...checkpoint.claim,signedAtMs:nowMs},http});
     receiptStatus=delivered.status;
   }
   await markPublicLikePublished416(storage,checkpoint.windowId);
 }
 const cleared=await clearPublicLikeReleaseStorage416(storage,state,nowMs);
 return {status:'RELEASED',cleared:cleared.cleared===true,
   windowId:String(state.window.windowId),trackCount:checkpoint.trackCount,
   publicTrackCount:checkpoint.publicTrackCount,manifest416:checkpoint.publicTrackCount>256,
   missingIds:Array.isArray(projection?.missingIds)?projection.missingIds:[],
   receiptStatus,d1ReadQueries:Number(projection?.d1ReadQueries||0),
   d1Writes:Number(projection?.d1Writes||0),
   r2Reads:Number(projection?.r2Reads||0)+manifestReads,
   r2Writes:Number(projection?.r2Writes||0)+manifestWrites};
}

// DO instances have one storage object. Serialize network release attempts,
// while short storage transactions still let canonical joins stage next IDs.
// No durable lease can strand recovery after an instance terminates.
const releasing416=new WeakMap();
export function releaseDuePublicLikeWindow416(options={}){
 const storage=options.storage;
 if(!storage)return Promise.reject(Error('416_PUBLIC_RELEASE_INPUT_INVALID'));
 const previous=releasing416.get(storage)||Promise.resolve();
 const attempt=previous.catch(()=>{}).then(()=>releaseDuePublicLikeWindowInner416(options));
 releasing416.set(storage,attempt);
 return attempt.finally(()=>{if(releasing416.get(storage)===attempt)releasing416.delete(storage);});
}

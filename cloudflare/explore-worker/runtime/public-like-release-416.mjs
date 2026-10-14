import {materializePublicLikeProjection416}
 from './public-like-projection-416.mjs';
import {clearPublicLikeReleaseStorage416,readPublicLikeReleaseState416}
 from './public-like-window-416.mjs';
import {preparePublicLikeManifest416}
 from './public-like-manifest-416.mjs';

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

export async function releaseDuePublicLikeWindow416({
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
 if(!Array.isArray(state.trackIds)||!state.trackIds.length)
   throw Error('416_PUBLIC_RELEASE_NO_TRACKS');
 const projection=await materialize({db,r2,trackIds:state.trackIds});
 const rows=Array.isArray(projection?.releaseRows)?projection.releaseRows:[];
 let receiptStatus='NO_PUBLIC_TRACKS',manifestReads=0,manifestWrites=0;
 if(rows.length){
   const prepared=await preparePublicLikeManifest416(
     r2,rows,String(state.window.windowId),Number(state.window.deadlineAtMs));
   manifestReads=Number(prepared?.r2Reads||0);
   manifestWrites=Number(prepared?.r2Writes||0);
   const claim={windowId:String(state.window.windowId),
     releaseToken:String(state.releaseToken),
     deadlineAtMs:Number(state.window.deadlineAtMs),signedAtMs:nowMs,
     rows:prepared.inlineRows,
     ...(prepared.manifest416?{manifest416:prepared.manifest416}:{})};
   const delivered=await sendPublicLikeRelease416({
     endpoint:releaseEndpoint,secret,claim,http});
   receiptStatus=delivered.status;
 }
 const cleared=await clearPublicLikeReleaseStorage416(storage,state);
 return {status:'RELEASED',cleared:cleared.cleared===true,
   windowId:String(state.window.windowId),trackCount:state.trackIds.length,
   publicTrackCount:rows.length,manifest416:rows.length>256,
   missingIds:Array.isArray(projection?.missingIds)?projection.missingIds:[],
   receiptStatus,d1ReadQueries:Number(projection?.d1ReadQueries||0),
   d1Writes:Number(projection?.d1Writes||0),
   r2Reads:Number(projection?.r2Reads||0)+manifestReads,
   r2Writes:Number(projection?.r2Writes||0)+manifestWrites};
}

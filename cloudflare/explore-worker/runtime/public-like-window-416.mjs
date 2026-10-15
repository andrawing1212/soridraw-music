// Stage416 public 5-minute window core.
// Source-only / HARD OFF until independent audit and coordinated PREVIEW release.
// This module performs no network/D1/R2/RTDB I/O. It freezes the first event's
// publicMinutes and returns deterministic, idempotent storage intents.
export const PUBLIC_LIKE_MINUTES_416=new Set([1,3,5,10,20]);
export const PUBLIC_LIKE_MAX_EVENT_TRACKS_416=256;
const UUID416=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cleanIds416=(ids)=>{
 if(!Array.isArray(ids)||ids.length<1||ids.length>PUBLIC_LIKE_MAX_EVENT_TRACKS_416)
   throw Error('416_PUBLIC_BAD_TRACKS');
 const out=[],seen=new Set();
 for(const raw of ids){
   const id=String(raw||'').trim();
   if(!id||id.length>512)throw Error('416_PUBLIC_BAD_TRACK');
   if(!seen.has(id)){seen.add(id);out.push(id);}
 }
 if(!out.length)throw Error('416_PUBLIC_BAD_TRACKS');
 return out.sort((a,b)=>a.localeCompare(b));
};

export function validatePublicLikeEvent416(raw,nowMs){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||
    !UUID416.test(String(raw.eventId||''))||
    !UUID416.test(String(raw.windowCandidateId||''))||
    !Number.isSafeInteger(raw.eventAtMs)||raw.eventAtMs<=0||
    !Number.isSafeInteger(nowMs)||nowMs<=0||
    raw.eventAtMs>nowMs+30_000||raw.eventAtMs<nowMs-15*60_000||
    !PUBLIC_LIKE_MINUTES_416.has(Number(raw.publicMinutes)))
   throw Error('416_PUBLIC_BAD_EVENT');
 return {
   eventId:String(raw.eventId),
   windowCandidateId:String(raw.windowCandidateId),
   eventAtMs:Number(raw.eventAtMs),
   publicMinutes:Number(raw.publicMinutes),
   trackIds:cleanIds416(raw.trackIds),
 };
}

export function planPublicLikeWindow416(current,event){
 const e=event;
 if(!e||!UUID416.test(String(e.eventId||''))||
    !UUID416.test(String(e.windowCandidateId||''))||
    !Number.isSafeInteger(e.eventAtMs)||e.eventAtMs<=0||
    !PUBLIC_LIKE_MINUTES_416.has(Number(e.publicMinutes))||
    !Array.isArray(e.trackIds)||!e.trackIds.length)
   throw Error('416_PUBLIC_BAD_PLAN_EVENT');
 let opened=false;
 let window=current&&typeof current==='object'&&!Array.isArray(current)?{...current}:null;
 if(window){
   if(!UUID416.test(String(window.windowId||''))||
      !Number.isSafeInteger(window.openedAtMs)||window.openedAtMs<=0||
      !Number.isSafeInteger(window.deadlineAtMs)||
      window.deadlineAtMs<=window.openedAtMs||
      !PUBLIC_LIKE_MINUTES_416.has(Number(window.publicMinutes)))
     throw Error('416_PUBLIC_WINDOW_CORRUPT');
 }
 if(window&&e.eventAtMs>=window.deadlineAtMs){
   return {opened:false,needsRelease:true,window,scheduleAtMs:null,
     eventMarkerKey:'stage416/public/event/'+e.eventId,trackEntries:[]};
 }
 if(!window){
   opened=true;
   window={
     schemaVersion:1,
     windowId:e.windowCandidateId,
     openedAtMs:e.eventAtMs,
     deadlineAtMs:e.eventAtMs+e.publicMinutes*60_000,
     publicMinutes:e.publicMinutes,
   };
 }
 return {
   opened,
   needsRelease:false,
   window,
   scheduleAtMs:opened?window.deadlineAtMs:null,
   eventMarkerKey:'stage416/public/event/'+e.eventId,
   trackEntries:e.trackIds.map(trackId=>({
     key:'stage416/public/window/'+window.windowId+'/track/'+encodeURIComponent(trackId),
     trackId,
     eventAtMs:e.eventAtMs,
   })),
 };
}

export function publicLikeReleasePlan416(window,nowMs){
 if(!window||typeof window!=='object'||Array.isArray(window)||
    !UUID416.test(String(window.windowId||''))||
    !Number.isSafeInteger(window.deadlineAtMs)||window.deadlineAtMs<=0||
    !Number.isSafeInteger(nowMs)||nowMs<=0)
   throw Error('416_PUBLIC_BAD_RELEASE_INPUT');
 return {
   due:nowMs>=window.deadlineAtMs,
   windowId:String(window.windowId),
   releaseToken:'stage416-public-'+String(window.windowId),
   deadlineAtMs:Number(window.deadlineAtMs),
 };
}


// Storage transactions serialize registration/join/seal and survive DO restarts.
const atomic416=(storage,fn)=>{
 if(typeof storage?.transaction!=='function')throw Error('416_PUBLIC_TRANSACTION_REQUIRED');
 return storage.transaction(fn);
};
export const PUBLIC_LIKE_RELEASE_KEY_416='stage416/public/release';
const PUBLIC_LIKE_NEXT_KEY_416='stage416/public/next';
const PUBLIC_LIKE_NEXT_TRACK_PREFIX_416=PUBLIC_LIKE_NEXT_KEY_416+'/track/';
export const PUBLIC_LIKE_WINDOW_KEY_416='stage416/public/current';
export const PUBLIC_LIKE_PENDING_OPEN_KEY_416='stage416/public/pending-open';
const PUBLIC_LIKE_PENDING_OPEN_MAX_TRACKS_416=50000;
const PUBLIC_LIKE_STORAGE_PUT_CHUNK_416=100;
const PUBLIC_LIKE_PENDING_PREFIX_416=PUBLIC_LIKE_PENDING_OPEN_KEY_416+'/';
const encoderPending416=new TextEncoder();
const hexPending416=bytes=>[...new Uint8Array(bytes)]
 .map(x=>x.toString(16).padStart(2,'0')).join('');

const normalizePendingIds416=(ids)=>{
 if(!Array.isArray(ids)||ids.length<1||ids.length>PUBLIC_LIKE_PENDING_OPEN_MAX_TRACKS_416)
   throw Error('416_PUBLIC_PENDING_TRACKS_INVALID');
 const out=[],seen=new Set();
 for(const raw of ids){
   const id=String(raw||'').trim();
   if(!id||id.length>512)throw Error('416_PUBLIC_PENDING_TRACK_INVALID');
   if(!seen.has(id)){seen.add(id);out.push(id);}
 }
 return out.sort((a,b)=>a.localeCompare(b));
};
const pendingDigest416=async(ids)=>hexPending416(await crypto.subtle.digest(
 'SHA-256',encoderPending416.encode(JSON.stringify(ids))));
const deleteChunked416=async(storage,keys)=>{
 for(let offset=0;offset<keys.length;offset+=128)await storage.delete(keys.slice(offset,offset+128));
};
const putChunked416=async(storage,entries)=>{
 const rows=Object.entries(entries);
 for(let offset=0;offset<rows.length;offset+=PUBLIC_LIKE_STORAGE_PUT_CHUNK_416){
   await storage.put(Object.fromEntries(
     rows.slice(offset,offset+PUBLIC_LIKE_STORAGE_PUT_CHUNK_416)));
 }
};

async function stagePublicLikeOpenPayload416Inner(storage,trackIds,eventAtMs=Date.now()){
 if(!storage?.get||!storage?.put||!Number.isSafeInteger(eventAtMs)||eventAtMs<=0)
   throw Error('416_PUBLIC_PENDING_STORAGE_UNAVAILABLE');
 const incoming=normalizePendingIds416(trackIds);
 const digest=await pendingDigest416(incoming);
 const markerKey=PUBLIC_LIKE_PENDING_PREFIX_416+'event/'+digest;
 const prior=await storage.get(markerKey);
 if(prior?.schemaVersion===2&&prior?.digest===digest&&
    Number(prior?.trackCount)===incoming.length)
   return {staged:true,unchanged:true,trackCount:incoming.length};
 const entries={
   [markerKey]:{schemaVersion:2,digest,trackCount:incoming.length,eventAtMs},
 };
 for(let offset=0;offset<incoming.length;offset+=PUBLIC_LIKE_STORAGE_PUT_CHUNK_416){
   const part=incoming.slice(offset,offset+PUBLIC_LIKE_STORAGE_PUT_CHUNK_416);
   entries[PUBLIC_LIKE_PENDING_PREFIX_416+'chunk/'+digest+'/'+
     String(offset/PUBLIC_LIKE_STORAGE_PUT_CHUNK_416).padStart(6,'0')]={
       schemaVersion:2,digest,eventAtMs,trackIds:part,
     };
 }
 await putChunked416(storage,entries);
 return {staged:true,unchanged:false,trackCount:incoming.length};
}

async function joinPublicLikeChangedTracks416Inner(storage,trackIds,eventAtMs=Date.now(),fallbackMinutes=0){
 if(!storage?.get||!storage?.put||!Number.isSafeInteger(eventAtMs)||eventAtMs<=0)
   throw Error('416_PUBLIC_JOIN_STORAGE_UNAVAILABLE');
 const ids=normalizePendingIds416(trackIds);
 let window=await storage.get(PUBLIC_LIKE_WINDOW_KEY_416);
 if(!window?.windowId){
   // A canonical drain may have observed the old window before its release
   // completed. Its captured timing allows a fresh, durably scheduled window.
   if(!PUBLIC_LIKE_MINUTES_416.has(Number(fallbackMinutes)))
     return {joined:false,reason:'NO_WINDOW',trackCount:0};
   window={schemaVersion:1,windowId:crypto.randomUUID(),openedAtMs:eventAtMs,
     deadlineAtMs:eventAtMs+Number(fallbackMinutes)*60_000,publicMinutes:Number(fallbackMinutes)};
   await storage.put(PUBLIC_LIKE_WINDOW_KEY_416,window);
   await schedulePublicLikeAlarm416(storage,window.deadlineAtMs);
 }
 if(!UUID416.test(String(window.windowId||'')))throw Error('416_PUBLIC_WINDOW_CORRUPT');
 if(window.sealed===true||eventAtMs>=window.deadlineAtMs){
   // One row per changed track, not one record per event/retry.
   await putChunked416(storage,Object.fromEntries(ids.map(trackId=>[
     PUBLIC_LIKE_NEXT_TRACK_PREFIX_416+encodeURIComponent(trackId),{trackId}])));
   if(!await storage.get(PUBLIC_LIKE_NEXT_KEY_416))
     await storage.put(PUBLIC_LIKE_NEXT_KEY_416,{publicMinutes:window.publicMinutes});
   await schedulePublicLikeAlarm416(storage,eventAtMs+1000);
   return {joined:false,staged:true,reason:'WINDOW_CLOSED',trackCount:ids.length};
 }
 const entries={};
 for(const trackId of ids)entries[
   'stage416/public/window/'+window.windowId+'/track/'+encodeURIComponent(trackId)
 ]={schemaVersion:1,trackId,eventAtMs};
 await putChunked416(storage,entries);
 return {joined:true,windowId:String(window.windowId),trackCount:ids.length};
}

async function mergePendingPublicLikeOpen416Inner(storage,eventAtMs=Date.now()){
 if(!storage?.get||!storage?.list||!storage?.delete||
    !Number.isSafeInteger(eventAtMs)||eventAtMs<=0)
   throw Error('416_PUBLIC_PENDING_STORAGE_UNAVAILABLE');
 const window=await storage.get(PUBLIC_LIKE_WINDOW_KEY_416);
 if(!window?.windowId||!UUID416.test(String(window.windowId||''))||
    window.sealed===true||eventAtMs>=window.deadlineAtMs)
   return {merged:false,trackCount:0};
 let mergedCount=0;
 // Pending chunks are immutable and digest-keyed. Drain bounded first pages
 // only after a real window exists; a crash before deletion safely retries.
 for(let pageIndex=0;pageIndex<100000;pageIndex++){
   const page=await storage.list({
     prefix:PUBLIC_LIKE_PENDING_PREFIX_416,limit:PUBLIC_LIKE_LIST_PAGE_416});
   if(!(page instanceof Map))throw Error('416_PUBLIC_PENDING_LIST_INVALID');
   if(!page.size)break;
   for(const value of page.values()){
     const ids=Array.isArray(value?.trackIds)?value.trackIds:null;
     if(!ids?.length)continue;
     const joined=await joinPublicLikeChangedTracks416Inner(storage,ids,eventAtMs);
     if(!joined.joined)throw Error('416_PUBLIC_PENDING_WINDOW_LOST');
     mergedCount+=joined.trackCount;
   }
   const keys=[...page.keys()];
   await deleteChunked416(storage,keys);
   if(keys.length<PUBLIC_LIKE_LIST_PAGE_416)break;
   if(pageIndex===99999)throw Error('416_PUBLIC_PENDING_TOO_LARGE');
 }
 return {merged:mergedCount>0,trackCount:mergedCount,
   windowId:String(window.windowId)};
}

const eventFingerprint416=(event)=>JSON.stringify({
 eventAtMs:event.eventAtMs,windowCandidateId:event.windowCandidateId,
 trackIds:event.trackIds,
});
const publicEventAliasKey416=(eventId)=>'stage416/public/event/'+eventId;
const publicWindowPrefix416=(windowId)=>'stage416/public/window/'+windowId+'/';
const publicWindowEventKey416=(windowId,eventId)=>
 publicWindowPrefix416(windowId)+'event/'+eventId;
const PUBLIC_LIKE_LIST_PAGE_416=1000;
const listPublicWindowPages416=async(storage,prefix,onPage)=>{
 let startAfter;
 for(let pageIndex=0;pageIndex<100000;pageIndex++){
   const options={prefix,limit:PUBLIC_LIKE_LIST_PAGE_416,
     ...(startAfter?{startAfter}:{})};
   const page=await storage.list(options);
   if(!(page instanceof Map))throw Error('416_PUBLIC_RELEASE_LIST_INVALID');
   if(!page.size)return;
   await onPage(page);
   if(page.size<PUBLIC_LIKE_LIST_PAGE_416)return;
   const keys=[...page.keys()];
   const last=keys[keys.length-1];
   if(!last||last===startAfter)throw Error('416_PUBLIC_RELEASE_LIST_STALLED');
   startAfter=last;
 }
 throw Error('416_PUBLIC_RELEASE_LIST_TOO_LARGE');
};

async function registerPublicLikeEventStorage416Inner(storage,raw,nowMs){
 if(!storage?.get||!storage?.put)throw Error('416_PUBLIC_STORAGE_UNAVAILABLE');
 const event=validatePublicLikeEvent416(raw,nowMs);
 const markerKey=publicEventAliasKey416(event.eventId);
 const fingerprint=eventFingerprint416(event);
 const prior=await storage.get(markerKey);
 if(prior){
   if(prior?.fingerprint!==fingerprint)throw Error('416_PUBLIC_EVENT_CONFLICT');
   return {registered:true,duplicate:true,opened:false,needsRelease:false,
     windowId:String(prior.windowId||''),deadlineAtMs:Number(prior.deadlineAtMs||0),
     publicMinutes:Number(prior.publicMinutes||0),trackCount:event.trackIds.length,
     scheduleAtMs:Number(prior.deadlineAtMs||0)};
 }
 const current=await storage.get(PUBLIC_LIKE_WINDOW_KEY_416);
 const plan=planPublicLikeWindow416(current,event);
 if(current&&(current.sealed===true||nowMs>=current.deadlineAtMs))plan.needsRelease=true;
 if(plan.needsRelease){
   return {registered:false,duplicate:false,opened:false,needsRelease:true,
     windowId:String(plan.window?.windowId||''),
     deadlineAtMs:Number(plan.window?.deadlineAtMs||0),
     publicMinutes:Number(plan.window?.publicMinutes||0),trackCount:0};
 }
 const entries={
   [markerKey]:{
     schemaVersion:1,fingerprint,windowId:plan.window.windowId,
     deadlineAtMs:plan.window.deadlineAtMs,publicMinutes:plan.window.publicMinutes,
   },
   [publicWindowEventKey416(plan.window.windowId,event.eventId)]:{
     schemaVersion:1,eventId:event.eventId,acked:false,eventAtMs:event.eventAtMs,
   },
 };
 if(plan.opened)entries[PUBLIC_LIKE_WINDOW_KEY_416]=plan.window;
 for(const row of plan.trackEntries)entries[row.key]={
   schemaVersion:1,trackId:row.trackId,eventAtMs:row.eventAtMs,
 };
 await putChunked416(storage,entries);
 return {registered:true,duplicate:false,opened:plan.opened,needsRelease:false,
   windowId:plan.window.windowId,deadlineAtMs:plan.window.deadlineAtMs,
   publicMinutes:plan.window.publicMinutes,trackCount:plan.trackEntries.length,
   scheduleAtMs:plan.scheduleAtMs};
}

async function ackPublicLikeEventStorage416Inner(storage,eventId,ackedAtMs=Date.now()){
 if(!storage?.get||!storage?.put||!UUID416.test(String(eventId||''))||
    !Number.isSafeInteger(ackedAtMs)||ackedAtMs<=0)
   throw Error('416_PUBLIC_BAD_ACK');
 const alias=await storage.get(publicEventAliasKey416(eventId));
 if(!alias?.windowId)throw Error('416_PUBLIC_ACK_EVENT_MISSING');
 const key=publicWindowEventKey416(String(alias.windowId),String(eventId));
 const marker=await storage.get(key);
 if(!marker||marker.eventId!==eventId)throw Error('416_PUBLIC_ACK_MARKER_MISSING');
 if(marker.acked===true)return {acked:true,duplicate:true,windowId:String(alias.windowId)};
 await storage.put(key,{...marker,acked:true,ackedAtMs});
 return {acked:true,duplicate:false,windowId:String(alias.windowId)};
}

async function readPublicLikeReleaseState416Inner(storage,nowMs){
 if(!storage?.get||!storage?.list||!Number.isSafeInteger(nowMs)||nowMs<=0)
   throw Error('416_PUBLIC_RELEASE_STORAGE_UNAVAILABLE');
 const window=await storage.get(PUBLIC_LIKE_WINDOW_KEY_416);
 if(!window)return {exists:false,due:false,blockedUnacked:false,trackIds:[],eventIds:[]};
 const plan=publicLikeReleasePlan416(window,nowMs);
 if(!plan.due)return {exists:true,due:false,blockedUnacked:false,
   window,trackIds:[],eventIds:[]};
 const checkpoint=await readPublicLikeCheckpoint416(storage);
 if(checkpoint){
   if(checkpoint.windowId!==window.windowId)throw Error('416_PUBLIC_CHECKPOINT_CONFLICT');
   return {exists:true,due:true,blockedUnacked:false,window,trackIds:[],eventIds:[],
     releaseToken:plan.releaseToken,checkpoint};
 }
 if(window.sealed!==true){
   window.sealed=true;
   await storage.put(PUBLIC_LIKE_WINDOW_KEY_416,window);
 }
 const prefix=publicWindowPrefix416(String(window.windowId));
 const trackIds=[],eventIds=[];let blockedUnacked=false;
 await listPublicWindowPages416(storage,prefix,async rows=>{
   for(const [key,value] of rows){
     if(key.startsWith(prefix+'track/')){
       const trackId=String(value?.trackId||'');
       if(!trackId||trackId.length>512)throw Error('416_PUBLIC_RELEASE_TRACK_CORRUPT');
       trackIds.push(trackId);
     }else if(key.startsWith(prefix+'event/')){
       const eventId=String(value?.eventId||'');
       if(!UUID416.test(eventId))throw Error('416_PUBLIC_RELEASE_EVENT_CORRUPT');
       eventIds.push(eventId);
       if(value?.acked!==true)blockedUnacked=true;
     }
   }
 });
 return {exists:true,due:true,blockedUnacked,window,
   trackIds:[...new Set(trackIds)].sort((a,b)=>a.localeCompare(b)),
   eventIds:[...new Set(eventIds)].sort((a,b)=>a.localeCompare(b)),
   releaseToken:plan.releaseToken};
}

// One compact claim, split below the DO per-value limit. The exact changed-ID
// list remains in immutable window rows / the existing bounded R2 manifest.
export async function readPublicLikeCheckpoint416(storage){
 const meta=await storage.get(PUBLIC_LIKE_RELEASE_KEY_416);
 if(!meta)return null;
 const rows=[];
 for(let i=0;i<Number(meta.rowChunks||0);i++){
   const part=await storage.get(PUBLIC_LIKE_RELEASE_KEY_416+'/'+i);
   if(!Array.isArray(part))throw Error('416_PUBLIC_CHECKPOINT_INCOMPLETE');
   rows.push(...part);
 }
 return {...meta,claim:meta.claim?{...meta.claim,rows}:null};
}
export const savePublicLikeCheckpoint416=(storage,checkpoint)=>atomic416(storage,async tx=>{
 const current=await tx.get(PUBLIC_LIKE_WINDOW_KEY_416);
 if(current?.windowId!==checkpoint.windowId||current.sealed!==true)
   throw Error('416_PUBLIC_CHECKPOINT_WINDOW_LOST');
 const rows=checkpoint.claim?.rows||[],rowChunks=Math.ceil(rows.length/100);
 const entries={[PUBLIC_LIKE_RELEASE_KEY_416]:{...checkpoint,rowChunks,
   claim:checkpoint.claim?{...checkpoint.claim,rows:undefined}:null}};
 // Omit undefined for durable JSON-style mocks as well as DO storage.
 if(entries[PUBLIC_LIKE_RELEASE_KEY_416].claim)delete entries[PUBLIC_LIKE_RELEASE_KEY_416].claim.rows;
 for(let i=0;i<rowChunks;i++)entries[PUBLIC_LIKE_RELEASE_KEY_416+'/'+i]=rows.slice(i*100,(i+1)*100);
 await tx.put(entries);
});
export const markPublicLikePublished416=(storage,windowId)=>atomic416(storage,async tx=>{
 const checkpoint=await tx.get(PUBLIC_LIKE_RELEASE_KEY_416);
 if(checkpoint?.windowId!==windowId)throw Error('416_PUBLIC_CHECKPOINT_WINDOW_LOST');
 if(checkpoint.published!==true)await tx.put(PUBLIC_LIKE_RELEASE_KEY_416,{...checkpoint,published:true});
});
const schedulePublicLikeAlarm416=async(storage,at)=>{
 const alarm=await storage.getAlarm();
 if(!alarm||alarm>at)await storage.setAlarm(at);
};

export async function clearPublicLikeReleaseStorage416(
 storage,state,nowMs=Date.now(),{alignSuccessorToPriorDeadline=false}={},
){
 if(!state?.due||state.blockedUnacked||!state?.window?.windowId)
   throw Error('416_PUBLIC_CLEAR_REFUSED');
 const windowId=String(state.window.windowId),prefix=publicWindowPrefix416(windowId);
 let deleted=0;
 // Each page and its event aliases commit together. A crash never loses the
 // information needed to collect aliases; the release checkpoint is outside
 // this prefix and is removed only with the final current-window transition.
 for(let pageIndex=0;pageIndex<100000;pageIndex++){
   const count=await atomic416(storage,async tx=>{
     const current=await tx.get(PUBLIC_LIKE_WINDOW_KEY_416);
     if(current?.windowId!==windowId)return 0;
     const rows=await tx.list({prefix,limit:PUBLIC_LIKE_LIST_PAGE_416});
     if(!(rows instanceof Map))throw Error('416_PUBLIC_CLEAR_LIST_INVALID');
     const keys=[...rows.keys()];
     const aliases=[...rows].filter(([key])=>key.startsWith(prefix+'event/'))
       .map(([,value])=>publicEventAliasKey416(value.eventId));
     if(keys.length)await deleteChunked416(tx,[...keys,...aliases]);
     return keys.length;
   });
   deleted+=count;
   if(count<PUBLIC_LIKE_LIST_PAGE_416)break;
   if(pageIndex===99999)throw Error('416_PUBLIC_CLEAR_TOO_LARGE');
 }
 await atomic416(storage,async tx=>{
   const current=await tx.get(PUBLIC_LIKE_WINDOW_KEY_416);
   if(current?.windowId!==windowId)return;
   const checkpoint=await tx.get(PUBLIC_LIKE_RELEASE_KEY_416);
   const next=await tx.get(PUBLIC_LIKE_NEXT_KEY_416);
   await tx.delete([PUBLIC_LIKE_WINDOW_KEY_416,PUBLIC_LIKE_RELEASE_KEY_416,
     PUBLIC_LIKE_NEXT_KEY_416,...Array.from({length:Number(checkpoint?.rowChunks||0)},
       (_,i)=>PUBLIC_LIKE_RELEASE_KEY_416+'/'+i)]);
   if(next){
     const minutes=Number(next.publicMinutes);
     const intervalMs=minutes*60_000;
     const priorDeadline=Number(state.window.deadlineAtMs);
     let openedAtMs=nowMs,deadlineAtMs=nowMs+intervalMs;
     if(alignSuccessorToPriorDeadline===true&&
        Number.isSafeInteger(priorDeadline)&&priorDeadline>0&&intervalMs>0){
       const steps=Math.max(1,Math.floor(Math.max(0,nowMs-priorDeadline)/intervalMs)+1);
       deadlineAtMs=priorDeadline+steps*intervalMs;
       openedAtMs=deadlineAtMs-intervalMs;
     }
     const window={schemaVersion:1,windowId:crypto.randomUUID(),openedAtMs,
       deadlineAtMs,publicMinutes:minutes};
     await tx.put(PUBLIC_LIKE_WINDOW_KEY_416,window);
     await listPublicWindowPages416(tx,PUBLIC_LIKE_NEXT_TRACK_PREFIX_416,async rows=>{
       const ids=[...rows.values()].map(row=>row.trackId);
       await joinPublicLikeChangedTracks416Inner(tx,ids,nowMs);
       await deleteChunked416(tx,[...rows.keys()]);
     });
     await mergePendingPublicLikeOpen416Inner(tx,nowMs);
     // The next deadline is fixed at opening; arrivals cannot extend it.
     const alarm=await tx.getAlarm();
     await tx.setAlarm(alarm&&alarm>nowMs?Math.min(alarm,window.deadlineAtMs):window.deadlineAtMs);
   }
 });
 return {cleared:true,windowId,deleted};
}

export const stagePublicLikeOpenPayload416=(storage,trackIds,eventAtMs=Date.now())=>
 atomic416(storage,async tx=>{
   // The drain may have started before registration opened a window. Recheck
   // inside the same transaction so a just-merged pending queue cannot strand it.
   if(await tx.get(PUBLIC_LIKE_WINDOW_KEY_416))
     return joinPublicLikeChangedTracks416Inner(tx,trackIds,eventAtMs);
   return stagePublicLikeOpenPayload416Inner(tx,trackIds,eventAtMs);
 });

export const joinPublicLikeChangedTracks416=(storage,trackIds,eventAtMs=Date.now(),fallbackMinutes=0)=>
 atomic416(storage,tx=>joinPublicLikeChangedTracks416Inner(tx,trackIds,eventAtMs,fallbackMinutes));

export const mergePendingPublicLikeOpen416=(storage,eventAtMs=Date.now())=>
 atomic416(storage,tx=>mergePendingPublicLikeOpen416Inner(tx,eventAtMs));

export const registerPublicLikeEventStorage416=(storage,raw,nowMs)=>
 atomic416(storage,tx=>registerPublicLikeEventStorage416Inner(tx,raw,nowMs));

export const ackPublicLikeEventStorage416=(storage,eventId,ackedAtMs=Date.now())=>
 atomic416(storage,tx=>ackPublicLikeEventStorage416Inner(tx,eventId,ackedAtMs));

export const readPublicLikeReleaseState416=(storage,nowMs)=>
 atomic416(storage,tx=>readPublicLikeReleaseState416Inner(tx,nowMs));

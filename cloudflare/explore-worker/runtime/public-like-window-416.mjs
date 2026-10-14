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


export const PUBLIC_LIKE_WINDOW_KEY_416='stage416/public/current';
export const PUBLIC_LIKE_PENDING_OPEN_KEY_416='stage416/public/pending-open';
const PUBLIC_LIKE_PENDING_OPEN_MAX_TRACKS_416=4096;

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

export async function stagePublicLikeOpenPayload416(storage,trackIds,eventAtMs=Date.now()){
 if(!storage?.get||!storage?.put||!Number.isSafeInteger(eventAtMs)||eventAtMs<=0)
   throw Error('416_PUBLIC_PENDING_STORAGE_UNAVAILABLE');
 const incoming=normalizePendingIds416(trackIds);
 const prior=await storage.get(PUBLIC_LIKE_PENDING_OPEN_KEY_416);
 const priorIds=Array.isArray(prior?.trackIds)?prior.trackIds:[];
 const merged=normalizePendingIds416([...priorIds,...incoming]);
 if(Array.isArray(prior?.trackIds)&&prior.trackIds.length===merged.length&&
    prior.trackIds.every((id,index)=>id===merged[index]))
   return {staged:true,unchanged:true,trackCount:merged.length};
 await storage.put(PUBLIC_LIKE_PENDING_OPEN_KEY_416,{
   schemaVersion:1,trackIds:merged,
   eventAtMs:Math.min(
     Number.isSafeInteger(prior?.eventAtMs)&&prior.eventAtMs>0?prior.eventAtMs:eventAtMs,
     eventAtMs),
 });
 return {staged:true,unchanged:false,trackCount:merged.length};
}

export async function joinPublicLikeChangedTracks416(storage,trackIds,eventAtMs=Date.now()){
 if(!storage?.get||!storage?.put||!Number.isSafeInteger(eventAtMs)||eventAtMs<=0)
   throw Error('416_PUBLIC_JOIN_STORAGE_UNAVAILABLE');
 const ids=normalizePendingIds416(trackIds);
 const window=await storage.get(PUBLIC_LIKE_WINDOW_KEY_416);
 if(!window?.windowId||!UUID416.test(String(window.windowId||'')))
   return {joined:false,reason:'NO_WINDOW',trackCount:0};
 const entries={};
 for(const trackId of ids)entries[
   'stage416/public/window/'+window.windowId+'/track/'+encodeURIComponent(trackId)
 ]={schemaVersion:1,trackId,eventAtMs};
 await storage.put(entries);
 return {joined:true,windowId:String(window.windowId),trackCount:ids.length};
}

export async function mergePendingPublicLikeOpen416(storage,eventAtMs=Date.now()){
 if(!storage?.get||!storage?.delete)
   throw Error('416_PUBLIC_PENDING_STORAGE_UNAVAILABLE');
 const pending=await storage.get(PUBLIC_LIKE_PENDING_OPEN_KEY_416);
 const ids=Array.isArray(pending?.trackIds)?pending.trackIds:[];
 if(!ids.length)return {merged:false,trackCount:0};
 const joined=await joinPublicLikeChangedTracks416(
   storage,ids,Number.isSafeInteger(pending?.eventAtMs)&&pending.eventAtMs>0
     ?pending.eventAtMs:eventAtMs);
 if(!joined.joined)return {merged:false,trackCount:ids.length};
 await storage.delete(PUBLIC_LIKE_PENDING_OPEN_KEY_416);
 return {merged:true,trackCount:ids.length,windowId:joined.windowId};
}

const eventFingerprint416=(event)=>JSON.stringify({
 eventAtMs:event.eventAtMs,windowCandidateId:event.windowCandidateId,
 trackIds:event.trackIds,
});
const publicEventAliasKey416=(eventId)=>'stage416/public/event/'+eventId;
const publicWindowPrefix416=(windowId)=>'stage416/public/window/'+windowId+'/';
const publicWindowEventKey416=(windowId,eventId)=>
 publicWindowPrefix416(windowId)+'event/'+eventId;

export async function registerPublicLikeEventStorage416(storage,raw,nowMs){
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
 await storage.put(entries);
 return {registered:true,duplicate:false,opened:plan.opened,needsRelease:false,
   windowId:plan.window.windowId,deadlineAtMs:plan.window.deadlineAtMs,
   publicMinutes:plan.window.publicMinutes,trackCount:plan.trackEntries.length,
   scheduleAtMs:plan.scheduleAtMs};
}

export async function ackPublicLikeEventStorage416(storage,eventId,ackedAtMs=Date.now()){
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

export async function readPublicLikeReleaseState416(storage,nowMs){
 if(!storage?.get||!storage?.list||!Number.isSafeInteger(nowMs)||nowMs<=0)
   throw Error('416_PUBLIC_RELEASE_STORAGE_UNAVAILABLE');
 const window=await storage.get(PUBLIC_LIKE_WINDOW_KEY_416);
 if(!window)return {exists:false,due:false,blockedUnacked:false,trackIds:[],eventIds:[]};
 const plan=publicLikeReleasePlan416(window,nowMs);
 if(!plan.due)return {exists:true,due:false,blockedUnacked:false,
   window,trackIds:[],eventIds:[]};
 const prefix=publicWindowPrefix416(String(window.windowId));
 const rows=await storage.list({prefix});
 const trackIds=[],eventIds=[];let blockedUnacked=false;
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
 return {exists:true,due:true,blockedUnacked,window,
   trackIds:[...new Set(trackIds)].sort((a,b)=>a.localeCompare(b)),
   eventIds:[...new Set(eventIds)].sort((a,b)=>a.localeCompare(b)),
   releaseToken:plan.releaseToken};
}

export async function clearPublicLikeReleaseStorage416(storage,state){
 if(!state?.due||state.blockedUnacked||!state?.window?.windowId||
    !storage?.list||!storage?.delete)
   throw Error('416_PUBLIC_CLEAR_REFUSED');
 const windowId=String(state.window.windowId);
 const prefix=publicWindowPrefix416(windowId);
 const rows=await storage.list({prefix});
 const keys=[...rows.keys(),PUBLIC_LIKE_WINDOW_KEY_416,
   ...(state.eventIds||[]).map(publicEventAliasKey416)];
 const unique=[...new Set(keys)];
 if(unique.length)await storage.delete(unique);
 return {cleared:true,windowId,deleted:unique.length};
}

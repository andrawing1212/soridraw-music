// Stage416 public 5-minute window core.
// Source-only / HARD OFF until independent audit and coordinated PREVIEW release.
// This module performs no network/D1/R2/RTDB I/O. It freezes the first event's
// publicMinutes and returns deterministic, idempotent storage intents.
export const PUBLIC_LIKE_MINUTES_416=new Set([1,3,5,10,20]);
export const PUBLIC_LIKE_MAX_EVENT_TRACKS_416=256;
const UUID416=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 if(!window||e.eventAtMs>=window.deadlineAtMs){
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

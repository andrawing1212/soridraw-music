import type {InboxNotification} from './notificationModel';

// Compact, per-account browser-only creation notices. No prompt, lyrics,
// Firestore/D1/R2 mirror, song-list mutation or page-entry network request.
const RETAIN_MS_016 = 30 * 24 * 60 * 60 * 1000;
const MAX_STORED_016 = 300;
const MAX_TEXT_016 = 240;
const MAX_ID_016 = 512;

type StoredCompleted016={
  id:string;
  title:string;
  createdAt:number;
  recentKey?:string;
  creationLink?:InboxNotification['creationLink'];
  song?:{id:string;title:string;audioUrl?:string;coverUrl?:string};
};
export const notificationRecentLogKey016=(uid:string)=>
  'soridraw:notification-completions:v1:'+encodeURIComponent(uid);

const sanitize=(value:unknown,max:number)=>
  typeof value==='string'?value.trim().slice(0,max):'';
const validTime=(value:unknown,now:number)=>
  typeof value==='number' && Number.isSafeInteger(value) &&
  value>=now-RETAIN_MS_016 && value<=now+300000;
const asStored=(value:unknown,now:number):StoredCompleted016|null=>{
  if(!value || typeof value!=='object')return null;
  const x=value as Record<string,unknown>;
  const id=sanitize(x.id,MAX_ID_016), title=sanitize(x.title,150);
  if(!id.startsWith('generated:')||!title||!validTime(x.createdAt,now))return null;
  const songRaw=x.song&&typeof x.song==='object'?x.song as Record<string,unknown>:null;
  const audio=sanitize(songRaw?.audioUrl,4096);
  const cover=sanitize(songRaw?.coverUrl,4096);
  const safeAudio=/^https:\/\//i.test(audio)?audio:'';
  const safeCover=/^https:\/\//i.test(cover)?cover:'';
  const song=songRaw&&safeAudio ? {id:sanitize(songRaw.id,MAX_ID_016)||id,
    title:sanitize(songRaw.title,150)||title,
    audioUrl:safeAudio,...(safeCover?{coverUrl:safeCover}:{})}:undefined;
  const recentKey=sanitize(x.recentKey,MAX_ID_016);
  const rawLink=x.creationLink&&typeof x.creationLink==='object'?x.creationLink as Record<string,unknown>:{};
  const exact=(v:unknown)=>typeof v==='string'&&v.trim().length<=256?v.trim():'';
  const songId=exact(rawLink.songId),noteId=exact(rawLink.noteId),sourceId=exact(rawLink.sourceId);
  const sourceCreatedAt=typeof rawLink.sourceCreatedAt==='number'&&Number.isSafeInteger(rawLink.sourceCreatedAt)&&rawLink.sourceCreatedAt>0?rawLink.sourceCreatedAt:0;
  const creationLink=songId||noteId||sourceId?{
    ...(songId?{songId}:{}),...(noteId?{noteId}:{}),...(sourceId?{sourceId}:{}),
    ...(sourceId&&sourceCreatedAt?{sourceCreatedAt}:{})
  }:undefined;
  return {id,title,createdAt:x.createdAt as number,...(recentKey?{recentKey}:{}),
    ...(creationLink?{creationLink}:{}),...(song?{song}:{})};
};
const fromNotification=(row:InboxNotification,now:number):StoredCompleted016|null=>{
  if(row.category!=='complete')return null;
  const title=sanitize(row.song?.title,150) ||
    sanitize(row.text.replace(/ 생성이 완료되었습니다\.$/,'').trim(),150);
  return asStored({id:row.id,title,createdAt:row.createdAt,recentKey:row.recentKey,creationLink:row.creationLink,
    ...(row.song?{song:row.song}:{})},now);
};
const parseStored=(uid:string,now:number):StoredCompleted016[]=>{
  if(!uid||typeof window==='undefined')return [];
  try{
    const raw=window.localStorage.getItem(notificationRecentLogKey016(uid));
    if(!raw || raw.length>250000)return [];
    const data:unknown=JSON.parse(raw);
    if(!Array.isArray(data))return [];
    return data.slice(0,MAX_STORED_016).map(x=>asStored(x,now))
      .filter((x):x is StoredCompleted016=>!!x);
  }catch{return [];}
};
const combine=(rows:StoredCompleted016[]):StoredCompleted016[]=>{
  const unique=new Map<string,StoredCompleted016>();
  const recentKeys=new Map<string,string>();
  for(const row of rows){
    const found=unique.get(row.id)||(row.recentKey?unique.get(recentKeys.get(row.recentKey)||''):undefined);
    if(found){
      // Repeated projections can lack a previously captured link. Fill only
      // missing aliases for the same immutable key (or exact id and time).
      const same=found.recentKey&&row.recentKey?found.recentKey===row.recentKey:
        found.id===row.id&&found.createdAt===row.createdAt;
      if(same&&row.creationLink){
        const a=found.creationLink||{},b=row.creationLink;
        const conflict=(a.songId&&b.songId&&a.songId!==b.songId)||
          (a.noteId&&b.noteId&&a.noteId!==b.noteId)||
          (a.sourceId&&b.sourceId&&a.sourceId!==b.sourceId)||
          (a.sourceCreatedAt&&b.sourceCreatedAt&&a.sourceCreatedAt!==b.sourceCreatedAt);
        if(!conflict)unique.set(found.id,{...found,creationLink:{...b,...a}});
      }
      continue;
    }
    unique.set(row.id,row);
    if(row.recentKey)recentKeys.set(row.recentKey,row.id);
  }
  return [...unique.values()].sort((a,b)=>b.createdAt-a.createdAt)
    .slice(0,MAX_STORED_016);
};
const toNotification=(row:StoredCompleted016):InboxNotification=>({
  id:row.id,category:'complete',actorName:'SORIDRAW',
  text:row.title+' 생성이 완료되었습니다.',createdAt:row.createdAt,
  ...(row.recentKey?{recentKey:row.recentKey}:{}),
  ...(row.creationLink?{creationLink:row.creationLink}:{}),
  ...(row.song?{song:row.song}:{})
});

/** Local read only. Never expires/re-writes storage on panel open. */
export function readCompletedGenerationLog016(uid:string,now=Date.now()):InboxNotification[]{
  return combine(parseStored(uid,now)).map(toNotification);
}

/** Only call on an actual successful generation. May import the pre-existing
 * latest-ten into the small metadata log before the eleventh is evicted.
 * Idempotent; no mutation of the canonical Recent Studio snapshot. */
export function rememberCompletedGenerationLog016(
  uid:string,notices:readonly InboxNotification[],now=Date.now()
):void{
  if(!uid||typeof window==='undefined'||!Array.isArray(notices))return;
  const old=parseStored(uid,now);
  const additions=notices.map(x=>fromNotification(x,now))
    .filter((x):x is StoredCompleted016=>!!x);
  if(!additions.length)return;
  const merged=combine([...additions,...old]);
  if(JSON.stringify(merged)===JSON.stringify(old))return;
  // Keep the same 250k-character storage ceiling. Drop optional media from
  // the oldest rows first, then oldest rows only if necessary. Never touch
  // original song/Note storage or write on a panel read.
  let bounded=merged;
  let serialized=JSON.stringify(bounded);
  if(serialized.length>250000){
    bounded=bounded.map(({song,...row})=>row);
    serialized=JSON.stringify(bounded);
    while(serialized.length>250000&&bounded.length){
      bounded=bounded.slice(0,-1);serialized=JSON.stringify(bounded);
    }
  }
  try{window.localStorage.setItem(notificationRecentLogKey016(uid),serialized);
    window.dispatchEvent?.(new Event('soridraw:notification-dot-change'));}
  catch{/* Quota or disabled storage: Recent Studio remains canonical and untouched. */}
}

/** Prefer the freshly displayed Recent Studio title if the same event is in
 * both stores, and keep independent older completion notices in scroll list. */
export function mergeCompletedGenerationNotices016(
  recent:readonly InboxNotification[],stored:readonly InboxNotification[],
  now=Date.now()
):InboxNotification[]{
  // Current canonical results remain visible even if older than the log
  // retention window; retention still applies to the independent stored log.
  const current=recent.filter(x=>x.category==='complete'&&x.id.startsWith('generated:'));
  const currentIds=new Set(current.map(x=>x.id));
  const currentKeys=new Set(current.map(x=>x.recentKey).filter(Boolean));
  const old=stored.map(x=>fromNotification(x,now))
    .filter((x):x is StoredCompleted016=>!!x)
    .filter(x=>!currentIds.has(x.id)&&(!x.recentKey||!currentKeys.has(x.recentKey)));
  const previous=stored.map(x=>fromNotification(x,now)).filter((x):x is StoredCompleted016=>!!x);
  const enriched=current.map(row=>{
    const local=fromNotification(row,now);
    if(!local)return row;
    const prior=previous.find(x=>row.recentKey&&x.recentKey?row.recentKey===x.recentKey:
      row.id===x.id&&row.createdAt===x.createdAt);
    if(!prior)return row;
    const merged=combine([local,prior])[0];
    return merged?.creationLink?{...row,creationLink:merged.creationLink}:row;
  });
  return [...enriched,...combine(old).map(toNotification)].slice(0,MAX_STORED_016);
}

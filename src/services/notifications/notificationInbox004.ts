import type {User} from 'firebase/auth';
import {getFirebaseAppCheckToken} from '../../firebase';
import {EXPLORE_API_BASE} from '../../config/exploreEnvironment';
import type {InboxNotification} from './notificationModel';
import {parseNotificationAccountSettings003,
  type NotificationAccountSettings003} from './notificationAccountSyncCore003';

// Global release hold: PREVIEW app remains exactly as before until a
// reviewed shared backend exists. No app-entry GET, timer or subscription.
export const NOTIFICATION_INBOX_ENABLED_004=false;
const LIMIT_004=30;
const limitText=(value:unknown,max:number)=>
  typeof value==='string'?value.trim().slice(0,max):'';
const timestamp=(v:unknown):number|null=>
  typeof v==='number' && Number.isSafeInteger(v)&&v>0?v:null;

type ExistingGeneration004={
  id?:unknown;taskId?:unknown;title?:unknown;status?:unknown;
  createdAt?:unknown;updatedAt?:unknown;audioUrl?:unknown;
  imageUrl?:unknown;coverUrl?:unknown;prompt?:unknown;lyrics?:unknown;
};

/** Project already-loaded Recent Studio history, not a second server copy.
 * The caller passes the same canonical in-memory snapshot the dashboard uses. */
export function projectCompletedExistingGenerations004(
  history:readonly unknown[],now=Date.now(),limit=LIMIT_004
):InboxNotification[]{
  if(!Array.isArray(history)||!Number.isSafeInteger(now)||
     !Number.isSafeInteger(limit)||limit<1||limit>LIMIT_004)return [];
  const seen=new Set<string>(),out:InboxNotification[]=[];
  for(const item of history.slice(0,Math.min(history.length,200))){
    if(!item||typeof item!=='object')continue;
    const song=item as ExistingGeneration004;
    // Recent Studio keeps *completed* prompt/lyrics SongResult entries
    // without a status field or a Suno track id. Never mark a draft pending
    // Suno response as complete; the existing canonical history is the proof.
    const recentResult=typeof song.status==='undefined' &&
      typeof song.prompt==='string' && !!song.prompt.trim() &&
      !!song.lyrics && typeof song.lyrics==='object';
    if(song.status!=='completed' && !recentResult)continue;
    const title=limitText(song.title,150);
    const at=timestamp(song.updatedAt)||timestamp(song.createdAt);
    if(!title||!at||at>now+300000||
       at<now-30*24*60*60*1000)continue;
    const stable=limitText(song.id||song.taskId,256)||
      ('recent-'+at+'-'+title);
    if(seen.has(stable))continue;
    seen.add(stable);
    const audio=limitText(song.audioUrl,4096);
    const image=limitText(song.imageUrl||song.coverUrl,4096);
    out.push({id:'generated:'+stable,category:'complete',actorName:'SORIDRAW',
      text:title+' 생성이 완료되었습니다.',createdAt:at,
      ...(song.status==='completed' && /^https:\/\//i.test(audio)
        ? {song:{id:stable,title,audioUrl:audio,
          ...(/^https:\/\//i.test(image)?{coverUrl:image}:{})}}:{})});
    if(out.length===limit)break;
  }
  return out.sort((a,b)=>b.createdAt-a.createdAt);
}

/** One authenticated GET on explicit inbox open; no polling/tab-reads. */
export async function loadOwnNotifications004(user:User):
  Promise<{items:InboxNotification[];preferences:NotificationAccountSettings003}>{
  if(!NOTIFICATION_INBOX_ENABLED_004)
    throw Error('NOTIFICATION_INBOX_NOT_ACTIVATED');
  const [jwt,appCheck]=await Promise.all([
    user.getIdToken(),getFirebaseAppCheckToken()
  ]);
  if(!jwt||!appCheck)throw Error('NOTIFICATION_INBOX_AUTH_UNAVAILABLE');
  const response=await fetch(EXPLORE_API_BASE+'/v1/me/notifications/inbox',{
    method:'GET',cache:'no-store',
    headers:{Authorization:'Bearer '+jwt,'X-Firebase-AppCheck':appCheck,
      'Accept':'application/json'}
  });
  if(!response.ok)throw Error('NOTIFICATION_INBOX_HTTP_'+response.status);
  const value=await response.json().catch(()=>null);
  const items=value?.data?.items;
  if(value?.ok!==true||!Array.isArray(items)||items.length>LIMIT_004)
    throw Error('NOTIFICATION_INBOX_INVALID_DATA');
  const allow=new Set(['like','follow','message','announcement']);
  const preferences=parseNotificationAccountSettings003(value.data.preferences);
  const parsed=items.map((item:unknown)=>{
    if(!item||typeof item!=='object')throw Error('NOTIFICATION_INBOX_INVALID_ROW');
    const x=item as Record<string,unknown>;
    const id=limitText(x.id,512),actorName=limitText(x.actorName,80);
    const text=limitText(x.text,240),createdAt=timestamp(x.createdAt);
    if(!id||!text||!actorName||!createdAt||!allow.has(String(x.category)))
      throw Error('NOTIFICATION_INBOX_INVALID_ROW');
    const category=x.category as InboxNotification['category'];
    const subject=x.song && typeof x.song==='object'
      ? x.song as Record<string,unknown> : null;
    return {id,category,actorName,text,createdAt,
      ...(typeof x.body==='string'?{body:x.body.slice(0,4000)}:{}),
      ...(typeof x.actorUid==='string'?{actorUid:x.actorUid.slice(0,256)}:{}),
      ...(subject&&typeof subject.id==='string'&&typeof subject.title==='string'
        ? {song:{id:subject.id.slice(0,512),title:subject.title.slice(0,150)}}:{})
    } as InboxNotification;
  });
  return {items:parsed,preferences};
}

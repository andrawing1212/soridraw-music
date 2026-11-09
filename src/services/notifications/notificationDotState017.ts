import type {InboxNotification,NotificationCategory,NotificationPreferences,NotificationSection} from './notificationModel';

// These preferences control only the visual pink dots; never the stored alerts.
export const NOTIFICATION_DOT_EVENT_017='soridraw:notification-dot-change';
export const notificationSeenKey017=(uid:string)=>
 'soridraw:notification-seen:v1:'+encodeURIComponent(uid);
type Mark={at:number;ids:string[]};
type Seen=Partial<Record<NotificationCategory,Mark>>;
const kinds:NotificationCategory[]=['like','follow','complete','announcement','message'];
const real=(x:InboxNotification,now:number)=>
 !x.id.startsWith('example-')&&x.id.length>0&&x.id.length<=512&&
 Number.isSafeInteger(x.createdAt)&&x.createdAt>=now-30*86400000&&x.createdAt<=now+300000;
const section=(category:NotificationCategory):NotificationSection=>
 category==='complete'?'creation':category==='announcement'?'announcement':'activity';
const seenFor=(uid:string):Seen=>{
 if(!uid||typeof window==='undefined')return {};
 try{
  const value=window.localStorage.getItem(notificationSeenKey017(uid));
  if(!value||value.length>10000)return {};
  const parsed=JSON.parse(value),result:Seen={};
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return {};
  for(const key of kinds){
   const x=parsed[key];
   if(x&&Number.isSafeInteger(x.at)&&x.at>0&&Array.isArray(x.ids))
    result[key]={at:x.at,ids:x.ids.filter((id:unknown)=>
      typeof id==='string'&&id.length>0&&id.length<=512).slice(0,100)};
  }
  return result;
 }catch{return {};}
};
const newer=(x:InboxNotification,seen:Seen)=>{
 const v=seen[x.category];
 return !v||x.createdAt>v.at||(x.createdAt===v.at&&!v.ids.includes(x.id));
};
export function getNotificationPinkDots017(uid:string,rows:readonly InboxNotification[],
 master:boolean,prefs:NotificationPreferences,now=Date.now()):
 Record<NotificationSection,boolean>{
 const result={activity:false,creation:false,announcement:false};
 if(!uid||!master)return result;
 const seen=seenFor(uid);
 for(const item of rows)
  if(real(item,now)&&prefs[item.category]&&newer(item,seen))
   result[section(item.category)]=true;
 return result;
}
/** Only opening a category acknowledges its current real records.
 * No server call, user-data update, or message deletion. */
export function acknowledgeNotificationTab017(uid:string,tab:NotificationSection,
 rows:readonly InboxNotification[],now=Date.now()):boolean{
 if(!uid||typeof window==='undefined')return false;
 const visible=rows.filter(item=>real(item,now)&&section(item.category)===tab);
 if(!visible.length)return false;
 const seen=seenFor(uid);let changed=false;
 for(const category of kinds){
  const matches=visible.filter(x=>x.category===category);
  if(!matches.length)continue;
  const at=Math.max(...matches.map(x=>x.createdAt));
  const previous=seen[category];
  if(previous&&previous.at>at)continue;
  const same=matches.filter(x=>x.createdAt===at).map(x=>x.id);
  const ids=[...new Set([...(previous?.at===at?previous.ids:[]),...same])].slice(0,100);
  if(!previous||previous.at!==at||ids.length!==previous.ids.length){
    seen[category]={at,ids};changed=true;
  }
 }
 if(!changed)return false;
 try{
  window.localStorage.setItem(notificationSeenKey017(uid),JSON.stringify(seen));
  window.dispatchEvent?.(new Event(NOTIFICATION_DOT_EVENT_017));
  return true;
 }catch{return false;}
}

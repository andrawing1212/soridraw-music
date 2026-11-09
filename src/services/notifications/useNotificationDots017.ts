import {useEffect,useMemo,useState} from 'react';
import type {InboxNotification,NotificationPreferences,NotificationSection} from './notificationModel';
import {isNotificationVisualPreview,readNotificationMasterEnabled,readNotificationPreferences} from './notificationModel';
import {NOTIFICATION_INBOX_ENABLED_004,projectCompletedExistingGenerations004} from './notificationInbox004';
import {mergeCompletedGenerationNotices016,readCompletedGenerationLog016,
 notificationRecentLogKey016} from './notificationRecentLog016';
import {NOTIFICATION_DOT_EVENT_017,notificationSeenKey017,
 getNotificationPinkDots017,acknowledgeNotificationTab017} from './notificationDotState017';

// Hook subscribes only to local changes. No polling or network reads.
export function useNotificationDots017(uid:string,recentHistory:readonly unknown[]=[],
 remoteItems:readonly InboxNotification[]=[],
 remoteSettings?:({master:boolean}&NotificationPreferences)|null){
 const [version,refreshVersion]=useState(0);
 useEffect(()=>{
  if(!uid||typeof window==='undefined')return;
  const refresh=()=>refreshVersion(n=>n+1);
  const onStorage=(event:StorageEvent)=>{
   const localUid=encodeURIComponent(uid);
   if(event.key===notificationRecentLogKey016(uid)||
      event.key===notificationSeenKey017(uid)||
      event.key==='soridraw:notification-preferences:v1:'+localUid||
      event.key==='soridraw:notification-master:v1:'+localUid)refresh();
  };
  window.addEventListener('storage',onStorage);
  window.addEventListener(NOTIFICATION_DOT_EVENT_017,refresh);
  return ()=>{
   window.removeEventListener('storage',onStorage);
   window.removeEventListener(NOTIFICATION_DOT_EVENT_017,refresh);
  };
 },[uid]);
 const rows=useMemo(()=>uid?[
  ...remoteItems,
  ...((isNotificationVisualPreview() || NOTIFICATION_INBOX_ENABLED_004)?mergeCompletedGenerationNotices016(
   projectCompletedExistingGenerations004(recentHistory),
   readCompletedGenerationLog016(uid)):[]),
 ]:[],[uid,remoteItems,recentHistory,version]);
 const preferences=useMemo(()=>{
  if(remoteSettings)return remoteSettings;
  const p=readNotificationPreferences(uid);
  return {master:readNotificationMasterEnabled(uid,p),...p};
 },[uid,remoteSettings,version]);
 const dots=useMemo(()=>getNotificationPinkDots017(
  uid,rows,preferences.master,preferences),[uid,rows,preferences]);
 const acknowledge=(section:NotificationSection)=>
  acknowledgeNotificationTab017(uid,section,rows);
 return {dots,acknowledge};
}

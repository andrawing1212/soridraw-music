import type {User} from 'firebase/auth';
import {getFirebaseAppCheckToken} from '../../firebase';
import {EXPLORE_API_BASE} from '../../config/exploreEnvironment';
import {
  NOTIFICATION_ACCOUNT_SYNC_ENABLED_003,
  parseNotificationAccountSettings003, reconcileNotificationAccountSettings003,
  type NotificationAccountChoices003,type NotificationAccountSettings003,
  type NotificationSaveResult003,
} from './notificationAccountSyncCore003';

const ROUTE_003='/v1/me/notifications/preferences';
export {NOTIFICATION_ACCOUNT_SYNC_ENABLED_003} from './notificationAccountSyncCore003';
export type {NotificationAccountSettings003, NotificationAccountChoices003} from './notificationAccountSyncCore003';
const parsePayload=async(response:Response):Promise<Record<string,unknown>>=>{
  const value=await response.json().catch(()=>null);
  if(!value||typeof value!=='object'||Array.isArray(value))
    throw Error('NOTIFICATION_ACCOUNT_RESPONSE_INVALID');
  return value as Record<string,unknown>;
};
const settingsFrom=(
  value:Record<string,unknown>,success:boolean
):NotificationAccountSettings003=>{
  const data=value.data;
  if(!data||typeof data!=='object')throw Error('NOTIFICATION_ACCOUNT_RESPONSE_INVALID');
  const settings=(data as Record<string,unknown>).preferences;
  if(success && value.ok!==true)throw Error('NOTIFICATION_ACCOUNT_RESPONSE_INVALID');
  return parseNotificationAccountSettings003(settings);
};
async function requestAccountSettings003(
  user:User,method:'GET'|'PUT',requested?:NotificationAccountChoices003,
  expectedRevision?:number,
):Promise<{status:'ok'|'conflict';settings:NotificationAccountSettings003}>{
  if(!NOTIFICATION_ACCOUNT_SYNC_ENABLED_003)
    throw Error('NOTIFICATION_ACCOUNT_SYNC_NOT_ACTIVATED');
  const [jwt,appCheck]=await Promise.all([user.getIdToken(),getFirebaseAppCheckToken()]);
  if(!jwt||!appCheck)throw Error('NOTIFICATION_ACCOUNT_AUTH_UNAVAILABLE');
  const body=method==='PUT'?JSON.stringify({
    ...requested,expectedRevision,
    // A single stable ID for exactly this attempt; failed requests are not
    // automatically retried with a new ID.
    operationId:crypto.randomUUID().replace(/-/g,''),
  }):undefined;
  const response=await fetch(EXPLORE_API_BASE+ROUTE_003,{
    method,headers:{Authorization:'Bearer '+jwt,
      'X-Firebase-AppCheck':appCheck,'Accept':'application/json',
      ...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body}:{}),cache:'no-store',
  });
  const payload=await parsePayload(response);
  if(response.status===409 && method==='PUT')
    return {status:'conflict',settings:settingsFrom(payload,false)};
  if(!response.ok)throw Error('NOTIFICATION_ACCOUNT_REQUEST_FAILED_'+response.status);
  return {status:'ok',settings:settingsFrom(payload,true)};
}
export async function loadNotificationAccountSettings003(
  user:User,local:NotificationAccountChoices003,
):Promise<{status:'ready'|'conflict';settings:NotificationAccountSettings003;migrated:boolean}>{
  return reconcileNotificationAccountSettings003(local,
    async()=>{
      const r=await requestAccountSettings003(user,'GET');
      return r.settings;
    },
    async(desired,revision)=>{
      const r=await requestAccountSettings003(user,'PUT',desired,revision);
      const status:NotificationSaveResult003['status']=
        r.status==='conflict'?'conflict':'saved';
      return {status,settings:r.settings};
    });
}
export async function saveNotificationAccountSettings003(
  user:User,choices:NotificationAccountChoices003,revision:number,
):Promise<NotificationSaveResult003>{
  const result=await requestAccountSettings003(user,'PUT',choices,revision);
  return {status:result.status==='conflict'?'conflict':'saved',settings:result.settings};
}

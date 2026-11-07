// Pure, testable account-setting reconciliation. No network/storage access.
// Account-wide sync is enabled only after a separately approved shared D1 /
// authenticated Worker release. Before then, the old local UI stays unchanged.
export const NOTIFICATION_ACCOUNT_SYNC_ENABLED_003 = false;

export type NotificationAccountSettings003 = {
  revision: number;
  master: boolean;
  like: boolean;
  follow: boolean;
  complete: boolean;
  announcement: boolean;
  message: boolean;
};
export type NotificationAccountChoices003 = Omit<NotificationAccountSettings003,'revision'>;
export type NotificationSaveResult003 = {
  status:'saved'|'unchanged'|'conflict';
  settings:NotificationAccountSettings003;
};
const fields003 = ['master','like','follow','complete','announcement','message'] as const;
export const NOTIFICATION_ACCOUNT_DEFAULT_003: NotificationAccountChoices003={
  master:true,like:true,follow:true,complete:true,announcement:true,message:true,
};

export function parseNotificationAccountSettings003(input:unknown):NotificationAccountSettings003 {
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('INVALID_ACCOUNT_SETTINGS');
  const data=input as Record<string,unknown>;
  if(!Number.isSafeInteger(data.revision)||Number(data.revision)<0||
     fields003.some(field=>typeof data[field]!=='boolean'))
    throw Error('INVALID_ACCOUNT_SETTINGS');
  return {revision:data.revision as number,...Object.fromEntries(
    fields003.map(field=>[field,data[field] as boolean])
  )} as NotificationAccountSettings003;
}
export function sameNotificationChoices003(
  a:NotificationAccountChoices003,b:NotificationAccountChoices003):boolean {
  return fields003.every(field=>a[field]===b[field]);
}
export function toNotificationChoices003(value:NotificationAccountSettings003):
  NotificationAccountChoices003{
  return Object.fromEntries(fields003.map(field=>[field,value[field]])) as
    NotificationAccountChoices003;
}
export type NotificationAccountLoadResult003 = {
  status:'ready'|'conflict';settings:NotificationAccountSettings003;
  migrated:boolean;
};
export async function reconcileNotificationAccountSettings003(
  local:NotificationAccountChoices003,
  fetchServer:()=>Promise<NotificationAccountSettings003>,
  saveServer:(desired:NotificationAccountChoices003,revision:number)=>
    Promise<NotificationSaveResult003>,
):Promise<NotificationAccountLoadResult003>{
  const remote=parseNotificationAccountSettings003(await fetchServer());
  // Preserve old local OFFs only when the server has no account settings.
  // Never overwrite a revisioned account preference from an old browser.
  if(remote.revision===0 && !sameNotificationChoices003(local,NOTIFICATION_ACCOUNT_DEFAULT_003)){
    const saved=await saveServer(local,0);
    return {
      status:saved.status==='conflict'?'conflict':'ready',
      settings:parseNotificationAccountSettings003(saved.settings),
      migrated:saved.status==='saved',
    };
  }
  return {status:'ready',settings:remote,migrated:false};
}

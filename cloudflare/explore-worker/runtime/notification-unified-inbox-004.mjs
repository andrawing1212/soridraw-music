// SORIDRAW unified notification projection candidate (dormant).
// Runs only after deliberate inbox open. Shared D1 and Worker not activated.
import {readOwnNotificationInbox001, publishGlobalAnnouncement001,
  readGlobalAnnouncements001} from './notification-inbox-001.mjs';
import {readOwnNotificationPreferences002, NOTIFICATION_RETENTION_MS_002}
  from './notification-preferences-retention-002.mjs';

const good = (v,n) => typeof v === 'string' && v.trim() === v &&
  v.length > 0 && v.length <= n && !/[\u0000-\u001f]/.test(v);
const deny = code => Object.assign(new Error(code),{code});
const ownerUid = async auth => {
  if(typeof auth!=='function')throw deny('NOTIFICATION_AUTH_REQUIRED');
  const uid=await auth();
  if(!good(uid,256))throw deny('NOTIFICATION_AUTH_REQUIRED');
  return uid;
};
const bounded = (v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const filterRecords=(items,limit,category)=>items.filter(row=>
  row && (!category || row.category===category) &&
  good(row.id,512) && good(row.text,240) &&
  bounded(row.createdAt,1,Number.MAX_SAFE_INTEGER)
).slice(0,limit);

/** Recipient private read. No global scan or writes; one call on inbox open.
 * Shared announcements MUST come from a cached public snapshot, not a D1
 * lookup repeated for each user. Recent generation history comes from the
 * existing client snapshot and is deliberately NOT copied to D1. */
export async function readUnifiedNotificationInbox004({
  db,authenticate,readSharedAnnouncements,enabled=false,limit=30,now=Date.now()
}={}){
  if(!enabled)return {status:'inactive',items:[],queries:0};
  if(!db?.prepare || !bounded(limit,1,30) || !Number.isSafeInteger(now))
    throw deny('NOTIFICATION_INBOX_INVALID');
  const uid=await ownerUid(authenticate);
  const own=async()=>uid;
  const pref=await readOwnNotificationPreferences002({
    db,authenticate:own,activated:true
  });
  if(pref.status!=='ok'||!pref.preferences)throw deny('NOTIFICATION_SETTINGS_UNKNOWN');
  const settings=pref.preferences;
  if(!settings.master)return {status:'ok',items:[],queries:1};
  const cutoff=now-NOTIFICATION_RETENTION_MS_002;
  const social= (settings.like||settings.follow)
    ? await readOwnNotificationInbox001({
      db,authenticate:own,activated:true,limit,now})
    : {status:'ok',items:[]};
  if(social.status!=='ok')throw deny('NOTIFICATION_SOCIAL_READ_FAILED');
  const direct=settings.message
    ? await db.prepare('SELECT id,title,body,created_at AS createdAt '
      +'FROM soridraw_notification_direct_messages_004 '
      +'WHERE receiver_uid=? AND created_at>=? '
      +'ORDER BY created_at DESC LIMIT ?').bind(uid,cutoff,limit).all()
    : {results:[]};
  if(!Array.isArray(direct.results)||direct.results.length>limit)
    throw deny('NOTIFICATION_DIRECT_READ_FAILED');
  let global=[];
  if(settings.announcement){
    if(typeof readSharedAnnouncements!=='function')
      throw deny('NOTIFICATION_PUBLIC_CACHE_UNAVAILABLE');
    const read=await readSharedAnnouncements();
    if(!Array.isArray(read)||read.length>20)
      throw deny('NOTIFICATION_PUBLIC_CACHE_INVALID');
    global=read;
  }
  const items=[];
  for(const x of social.items){
    if(!settings[x.category] || !good(x.actorUid,256) ||
       !good(x.subjectId,512) || !bounded(x.createdAt,cutoff,now+300000))continue;
    items.push({
      id:'social:'+x.category+':'+x.actorUid+':'+x.subjectId+':'+x.createdAt,
      category:x.category,actorUid:x.actorUid,
      actorName:good(x.actorName,80)?x.actorName:'사용자',
      text:x.category==='follow'?'나를 팔로우했습니다.':'내 곡에 좋아요를 눌렀습니다.',
      createdAt:x.createdAt,
      ...(x.category==='like' && good(x.subjectTitle,120)
        ? {song:{id:x.subjectId,title:x.subjectTitle}}:{})
    });
  }
  for(const m of direct.results){
    if(!good(m.id,128)||!good(m.title,220)||!good(m.body,4000)||
       !bounded(m.createdAt,cutoff,now+300000))continue;
    items.push({id:'direct:'+m.id,category:'message',actorName:'SORIDRAW',
      text:m.title,body:m.body,createdAt:m.createdAt});
  }
  for(const a of global){
    if(!good(a.id,128)||!good(a.title,220)||!good(a.body,4000)||
       !bounded(a.publishedAt,cutoff,now+300000))continue;
    items.push({id:'global:'+a.id,category:'announcement',
      actorName:'SORIDRAW',text:a.title,body:a.body,createdAt:a.publishedAt});
  }
  items.sort((a,b)=>b.createdAt-a.createdAt||a.id.localeCompare(b.id));
  return {status:'ok',items:filterRecords(items,limit),
    queries:1+(settings.like||settings.follow?1:0)+(settings.message?1:0)};
}

/** Exactly one named recipient. Caller must use canonical admin-role proof;
 * no per-user broadcast API or untrusted recipient from client side. */
export async function publishPrivateNotification004({
  db,verifyAdmin,receiverUid,message,enabled=false,now=Date.now()
}={}){
  if(!enabled)return {status:'inactive',rowsWritten:0};
  if(!db?.prepare||typeof verifyAdmin!=='function'||
     await verifyAdmin()!==true)throw deny('NOTIFICATION_ADMIN_REQUIRED');
  if(!good(receiverUid,256)||!message||!good(message.id,128)||
     !good(message.title,220)||!good(message.body,4000)||
     !bounded(now,1,Number.MAX_SAFE_INTEGER))
    throw deny('NOTIFICATION_MESSAGE_INVALID');
  const result=await db.prepare(
    'INSERT OR IGNORE INTO soridraw_notification_direct_messages_004 '
    +'(receiver_uid,id,title,body,created_at) '
    +'SELECT ?,?,?,?,? '
    +'WHERE NOT EXISTS (SELECT 1 FROM soridraw_notification_preferences_002 '
    +'WHERE user_uid=? AND (master_enabled=0 OR message_enabled=0))'
  ).bind(receiverUid,message.id,message.title,message.body,now,receiverUid).run();
  if(![0,1].includes(result?.meta?.changes))
    throw deny('NOTIFICATION_MESSAGE_ACK_UNKNOWN');
  return {status:result.meta.changes?'published':'skipped',rowsWritten:result.meta.changes};
}

/** Single global announcement write + one common R2 snapshot update.
 * Cache update failure is returned as failure, not a false successful delivery;
 * retrying the same id is W0 and republishes the bounded snapshot. */
export async function publishSharedAnnouncement004({
  db,announcement,verifyAdmin,publishSharedSnapshot,enabled=false
}={}){
  if(!enabled)return {status:'inactive',rowsWritten:0};
  if(typeof publishSharedSnapshot!=='function')
    throw deny('NOTIFICATION_SHARED_CACHE_REQUIRED');
  const stored=await publishGlobalAnnouncement001({
    db,announcement,verifyAdmin,activated:true
  });
  const snapshot=await readGlobalAnnouncements001({db,activated:true,limit:10});
  if(snapshot.status!=='ok')throw deny('NOTIFICATION_GLOBAL_SNAPSHOT_FAILED');
  await publishSharedSnapshot(snapshot.items);
  return {status:stored.status,rowsWritten:stored.rowsWritten,snapshotSize:snapshot.items.length};
}

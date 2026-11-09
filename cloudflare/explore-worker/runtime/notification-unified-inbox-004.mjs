// SORIDRAW unified notification projection candidate (dormant).
// Runs only after deliberate inbox open. Shared D1 and Worker not activated.
import {readOwnNotificationInbox001, publishGlobalAnnouncement001}
  from './notification-inbox-001.mjs';
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
  const settings=pref.preferences; // Dot preferences only; never suppress delivery.
  const cutoff=now-NOTIFICATION_RETENTION_MS_002;
  const social=await readOwnNotificationInbox001({
    db,authenticate:own,activated:true,limit,now});
  if(social.status!=='ok')throw deny('NOTIFICATION_SOCIAL_READ_FAILED');
  const direct=await db.prepare('SELECT id,title,body,created_at AS createdAt '
      +'FROM soridraw_notification_direct_messages_004 '
      +'WHERE receiver_uid=? AND created_at>=? '
      +'ORDER BY created_at DESC LIMIT ?').bind(uid,cutoff,limit).all();
  if(!Array.isArray(direct.results)||direct.results.length>limit)
    throw deny('NOTIFICATION_DIRECT_READ_FAILED');
  if(typeof readSharedAnnouncements!=='function')
    throw deny('NOTIFICATION_PUBLIC_CACHE_UNAVAILABLE');
  const global=await readSharedAnnouncements();
  if(!Array.isArray(global)||global.length>20)
    throw deny('NOTIFICATION_PUBLIC_CACHE_INVALID');
  const items=[];
  for(const x of social.items){
    if(!good(x.actorUid,256) ||
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
  return {status:'ok',items:filterRecords(items,limit),preferences:settings,
    queries:3};
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
    +'VALUES (?,?,?,?,?)'
  ).bind(receiverUid,message.id,message.title,message.body,now).run();
  if(![0,1].includes(result?.meta?.changes))
    throw deny('NOTIFICATION_MESSAGE_ACK_UNKNOWN');
  return {status:result.meta.changes?'published':'skipped',rowsWritten:result.meta.changes};
}

/** One global canonical D1 row + CAS-protected shared R2 snapshot.
 * Failed R2 publish reports failure; retrying the same ID is D1 W0 and repairs
 * the snapshot without producing per-recipient writes. */
export async function publishSharedAnnouncement004({
  db,announcement,verifyAdmin,reconcileSharedSnapshot,enabled=false,
}={}){
  if(!enabled)return {status:'inactive',rowsWritten:0};
  if(typeof reconcileSharedSnapshot!=='function')
    throw deny('NOTIFICATION_SHARED_CACHE_REQUIRED');
  const stored=await publishGlobalAnnouncement001({
    db,announcement,verifyAdmin,activated:true
  });
  const snapshot=await reconcileSharedSnapshot();
  if(!snapshot||!['updated','unchanged'].includes(snapshot.status)||
     !bounded(snapshot.snapshotSize,0,10))
    throw deny('NOTIFICATION_GLOBAL_SNAPSHOT_FAILED');
  return {status:stored.status,rowsWritten:stored.rowsWritten,
    snapshotSize:snapshot.snapshotSize};
}


// Explicitly invoked from an approved central retention job; never from
// a user's inbox open. One bounded indexed batch, no account fanout.
export async function cleanupExpiredDirectMessages004({
  db,enabled=false,now=Date.now(),limit=100
}={}){
  if(!enabled)return {status:'inactive',rowsDeleted:0};
  if(!db?.prepare || !bounded(now,30*86400000+1,Number.MAX_SAFE_INTEGER) ||
      !bounded(limit,1,200))throw deny('NOTIFICATION_DIRECT_CLEANUP_INVALID');
  const result=await db.prepare(
    'DELETE FROM soridraw_notification_direct_messages_004 '
    +'WHERE (receiver_uid,id) IN (SELECT receiver_uid,id '
    +'FROM soridraw_notification_direct_messages_004 '
    +'WHERE created_at<? ORDER BY created_at LIMIT ?)'
  ).bind(now-30*86400000,limit).run();
  const changes=result?.meta?.changes;
  if(!bounded(changes,0,limit))throw deny('NOTIFICATION_DIRECT_CLEANUP_INVALID_ACK');
  return {status:'ok',rowsDeleted:changes};
}

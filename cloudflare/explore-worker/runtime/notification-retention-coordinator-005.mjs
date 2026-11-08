// SOURCE-ONLY notification maintenance and global snapshot reconciliation.
// No cron/HTTP route is installed by this module; activating requires a separate release.
import {NOTIFICATION_SHARED_ANNOUNCEMENT_KEY_001} from './notification-inbox-001.mjs';
import {
  cleanupExpiredNotificationInbox002,NOTIFICATION_RETENTION_MS_002,
} from './notification-preferences-retention-002.mjs';
import {cleanupExpiredDirectMessages004} from './notification-unified-inbox-004.mjs';

const failure=code=>Object.assign(new Error(code),{code});
const bounded=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;

/** One common R2 key, optimistic conditional writes and bounded retries.
 * Concurrent admin publication or retention cannot blindly overwrite a newer
 * snapshot; an unsuccessful R2 put is never acknowledged as delivered. */
export async function reconcileGlobalAnnouncementSnapshot005({
  db,cache,now=Date.now(),
}={}){
  if(!db?.prepare||!cache?.get||!cache?.put||
    !bounded(now,NOTIFICATION_RETENTION_MS_002+1,Number.MAX_SAFE_INTEGER))
    throw failure('NOTIFICATION_SNAPSHOT_UNAVAILABLE');
  const cutoff=now-NOTIFICATION_RETENTION_MS_002;
  for(let attempt=0;attempt<3;attempt++){
    const previous=await cache.get(NOTIFICATION_SHARED_ANNOUNCEMENT_KEY_001);
    if(previous && (typeof previous.etag!=='string'||!previous.etag))
      throw failure('NOTIFICATION_SNAPSHOT_ETAG_MISSING');
    let prior=null;
    if(previous){
      try{
        const value=await previous.json();
        if(value?.schema===1&&Array.isArray(value.items)&&value.items.length<=10)
          prior=value.items;
      }catch{/* Corrupt cache is replaced by the canonical bounded D1 projection. */}
    }
    const data=await db.prepare(
      'SELECT id,title,body,published_at AS publishedAt '+
      'FROM soridraw_global_announcements_001 '+
      'WHERE published_at>=? AND published_at<=? '+
      'ORDER BY published_at DESC LIMIT 10'
    ).bind(cutoff,now+300000).all();
    if(!Array.isArray(data?.results)||data.results.length>10)
      throw failure('NOTIFICATION_GLOBAL_SNAPSHOT_READ_INVALID');
    const items=data.results;
    if((prior!==null&&JSON.stringify(prior)===JSON.stringify(items))||
       (!previous&&items.length===0))
      return {status:'unchanged',snapshotSize:items.length,r2Writes:0};
    const onlyIf=previous?{etagMatches:previous.etag}
      :new Headers({'If-None-Match':'*'});
    const stored=await cache.put(NOTIFICATION_SHARED_ANNOUNCEMENT_KEY_001,
      JSON.stringify({schema:1,items}),{
        onlyIf,httpMetadata:{contentType:'application/json'},
      });
    if(stored)return {status:'updated',snapshotSize:items.length,r2Writes:1};
  }
  throw failure('NOTIFICATION_GLOBAL_SNAPSHOT_CAS_CONFLICT');
}

/** Invoke ONLY from a separately approved, authenticated maintenance scheduler.
 * Indexed, bounded physical expiry; no per-user scan or browser-entry writes.
 * The shared snapshot also repairs an earlier failed R2 publish on the next run. */
export async function runNotificationRetention005({
  db,cache,verifyMaintenance,enabled=false,now=Date.now(),limit=100,
}={}){
  if(!enabled)return {status:'inactive',rowsDeleted:0,r2Writes:0};
  if(typeof verifyMaintenance!=='function'||await verifyMaintenance()!==true)
    throw failure('NOTIFICATION_MAINTENANCE_FORBIDDEN');
  if(!db?.prepare||!cache?.get||!cache?.put||
     !bounded(limit,1,200)||
     !bounded(now,NOTIFICATION_RETENTION_MS_002+1,Number.MAX_SAFE_INTEGER))
    throw failure('NOTIFICATION_MAINTENANCE_INVALID');
  const social=await cleanupExpiredNotificationInbox002({
    db,activated:true,now,limit,
  });
  const direct=await cleanupExpiredDirectMessages004({
    db,enabled:true,now,limit,
  });
  const global=await db.prepare(
    'DELETE FROM soridraw_global_announcements_001 '+
    'WHERE id IN (SELECT id FROM soridraw_global_announcements_001 '+
    'WHERE published_at<? ORDER BY published_at ASC LIMIT ?)'
  ).bind(now-NOTIFICATION_RETENTION_MS_002,limit).run();
  const announcements=global?.meta?.changes;
  if(!bounded(announcements,0,limit))
    throw failure('NOTIFICATION_GLOBAL_CLEANUP_UNVERIFIED');
  // Always compare but PUT only if changed: safe replay after D1 success/R2 failure.
  const snapshot=await reconcileGlobalAnnouncementSnapshot005({db,cache,now});
  const counts={social:social.rowsDeleted,direct:direct.rowsDeleted,
    announcement:announcements};
  const rowsDeleted=Object.values(counts).reduce((sum,n)=>sum+n,0);
  return {status:Object.values(counts).some(n=>n===limit)?'more-possible':'ok',
    rowsDeleted,byCategory:counts,r2Writes:snapshot.r2Writes,
    snapshotSize:snapshot.snapshotSize};
}
